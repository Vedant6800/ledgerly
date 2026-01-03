// ==========================================
// LEDGERLY - PERSONAL FINANCE TRACKER
// Vanilla JavaScript with GitHub API Integration
// ==========================================

// ==========================================
// LEDGERLY APPLICATION CLASS
// ==========================================
class Ledgerly {
    constructor() {
        this.githubClient = null;
        this.dataManager = null;
        this.currentYear = '';
        this.currentMonth = '';
        this.editingId = null;
        this.theme = 'light';
        this.categories = { income: [], expenses: [] }; // Category cache
        this.init();
    }

    async init() {
        try {
            // Initialize GitHub API client
            this.githubClient = new GitHubAPIClient(GITHUB_CONFIG);

            // Initialize and validate token (will prompt user if needed)
            this.showLoading('Verifying GitHub authentication...');
            await this.githubClient.initializeToken();

            this.dataManager = new GitHubDataManager(this.githubClient);

            // Load categories from GitHub
            await this.loadCategories();

            this.loadThemePreference();
            this.setupEventListeners();
            this.setCurrentMonth();

            // Load initial month data
            await this.loadCurrentMonth();
        } catch (error) {
            console.error('Initialization error:', error);
            this.hideLoading();

            if (error.message.includes('token') || error.message.includes('GitHub')) {
                alert(
                    '⚠️ GitHub Authentication Failed\n\n' +
                    error.message + '\n\n' +
                    'Please check the console for more details.'
                );
            } else {
                alert('Error initializing application:\n\n' + error.message);
            }
        }
    }

    // Load categories from GitHub
    async loadCategories() {
        try {
            const categoryFile = await this.githubClient.getCategoryFile();
            this.categories = categoryFile.content || { income: [], expenses: [] };
            this.updateCategoryDropdown();
        } catch (error) {
            console.error('Error loading categories:', error);
            this.categories = { income: [], expenses: [] };
        }
    }

    // Load current month data from GitHub
    async loadCurrentMonth() {
        this.showLoading('Loading data from GitHub...');
        try {
            await this.dataManager.loadMonthData(this.currentYear, this.currentMonth);
            this.render();
        } catch (error) {
            console.error('Error loading month data:', error);
            alert('Error loading data from GitHub. Please check your connection and configuration.');
        } finally {
            this.hideLoading();
        }
    }

    // Show loading overlay
    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const text = overlay.querySelector('.loading-text');
        text.textContent = message;
        overlay.classList.add('active');
    }

    // Hide loading overlay
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.remove('active');
    }

    // ==========================================
    // THEME MANAGEMENT
    // ==========================================
    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme();
        this.saveThemePreference();
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        const themeIcon = document.querySelector('.theme-icon');
        themeIcon.textContent = this.theme === 'light' ? '🌙' : '☀️';
    }

    saveThemePreference() {
        localStorage.setItem('ledgerly-theme', this.theme);
    }

    loadThemePreference() {
        const savedTheme = localStorage.getItem('ledgerly-theme');
        if (savedTheme) {
            this.theme = savedTheme;
        } else {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                this.theme = 'dark';
            }
        }
        this.applyTheme();
    }

    // ==========================================
    // EVENT LISTENERS
    // ==========================================
    setupEventListeners() {
        // Month selector
        document.getElementById('month-selector').addEventListener('change', async (e) => {
            const [year, month] = e.target.value.split('-');
            this.currentYear = year;
            this.currentMonth = month;
            await this.loadCurrentMonth();
        });

        // Type toggle buttons
        document.getElementById('income-btn').addEventListener('click', () => {
            this.setTransactionType('income');
        });

        document.getElementById('expense-btn').addEventListener('click', () => {
            this.setTransactionType('expense');
        });

        // Form submission
        document.getElementById('transaction-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleFormSubmit();
        });

        // Cancel button
        document.getElementById('cancel-btn').addEventListener('click', () => {
            this.cancelEdit();
        });

        // Theme toggle button
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Token settings button
        document.getElementById('token-settings-btn').addEventListener('click', () => {
            this.openTokenModal();
        });

        // Token modal close button
        document.getElementById('token-modal-close').addEventListener('click', () => {
            this.closeTokenModal();
        });

        // Close modal when clicking outside
        document.getElementById('token-modal').addEventListener('click', (e) => {
            if (e.target.id === 'token-modal') {
                this.closeTokenModal();
            }
        });

        // Toggle token visibility
        document.getElementById('toggle-token-visibility').addEventListener('click', () => {
            this.toggleTokenVisibility();
        });

        // Update token button
        document.getElementById('update-token-btn').addEventListener('click', async () => {
            await this.updateToken();
        });

        // Clear token button
        document.getElementById('clear-token-btn').addEventListener('click', () => {
            this.clearToken();
        });

        // Category change handler
        document.getElementById('transaction-category').addEventListener('change', () => {
            this.handleCategoryChange();
        });
    }

    // ==========================================
    // TOKEN MANAGEMENT
    // ==========================================
    openTokenModal() {
        const modal = document.getElementById('token-modal');
        modal.classList.add('active');
        this.updateTokenStatus();
    }

    closeTokenModal() {
        const modal = document.getElementById('token-modal');
        modal.classList.remove('active');
    }

    async updateTokenStatus() {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');
        const tokenInput = document.getElementById('token-display-input');

        const token = TokenManager.getToken();

        if (!token) {
            statusDot.className = 'status-dot invalid';
            statusText.textContent = 'No token configured';
            tokenInput.value = '';
            return;
        }

        // Display masked token
        tokenInput.value = token;

        // Validate token
        statusDot.className = 'status-dot';
        statusText.textContent = 'Validating token...';

        const isValid = await this.githubClient.validateToken();

        if (isValid) {
            statusDot.className = 'status-dot valid';
            statusText.textContent = '✓ Token is valid and working';
        } else {
            statusDot.className = 'status-dot invalid';
            statusText.textContent = '✗ Token is invalid or expired';
        }
    }

    toggleTokenVisibility() {
        const tokenInput = document.getElementById('token-display-input');
        const toggleBtn = document.getElementById('toggle-token-visibility');

        if (tokenInput.type === 'password') {
            tokenInput.type = 'text';
            toggleBtn.textContent = '🙈 Hide';
        } else {
            tokenInput.type = 'password';
            toggleBtn.textContent = '👁️ Show';
        }
    }

    async updateToken() {
        const newToken = TokenManager.promptForToken('Enter your new GitHub Personal Access Token:');

        if (!newToken) {
            alert('Token update cancelled.');
            return;
        }

        this.showLoading('Validating new token...');

        // Temporarily set the token to validate it
        const oldToken = this.githubClient.config.token;
        this.githubClient.config.token = newToken;

        const isValid = await this.githubClient.validateToken();

        if (isValid) {
            TokenManager.saveToken(newToken);
            this.hideLoading();
            alert('✓ Token updated successfully!');
            this.updateTokenStatus();
        } else {
            // Restore old token if validation fails
            this.githubClient.config.token = oldToken;
            this.hideLoading();
            alert('✗ Invalid token. Please check and try again.');
        }
    }

    clearToken() {
        if (!confirm('Are you sure you want to clear your GitHub token?\n\nYou will need to enter it again to use the app.')) {
            return;
        }

        TokenManager.clearToken();
        alert('Token cleared. The page will reload.');
        setTimeout(() => location.reload(), 1000);
    }

    // ==========================================
    // MONTH MANAGEMENT
    // ==========================================
    setCurrentMonth() {
        const now = new Date();
        this.currentYear = now.getFullYear().toString();
        this.currentMonth = String(now.getMonth() + 1).padStart(2, '0');
        document.getElementById('month-selector').value = `${this.currentYear}-${this.currentMonth}`;
    }

    // ==========================================
    // TRANSACTION TYPE TOGGLE
    // ==========================================
    setTransactionType(type) {
        const incomeBtn = document.getElementById('income-btn');
        const expenseBtn = document.getElementById('expense-btn');

        if (type === 'income') {
            incomeBtn.classList.add('active');
            expenseBtn.classList.remove('active');
        } else {
            expenseBtn.classList.add('active');
            incomeBtn.classList.remove('active');
        }

        document.getElementById('transaction-type').value = type;
        this.updateCategoryDropdown();
    }

    // ==========================================
    // CATEGORY MANAGEMENT
    // ==========================================
    updateCategoryDropdown() {
        const categorySelect = document.getElementById('transaction-category');
        if (!categorySelect) return;

        const type = document.getElementById('transaction-type').value;
        const categories = type === 'income' ? this.categories.income : this.categories.expenses;

        // Clear existing options
        categorySelect.innerHTML = '<option value="">Select Category</option>';

        // Add categories from data
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            categorySelect.appendChild(option);
        });

        // Add "Add New Category" option
        const addNewOption = document.createElement('option');
        addNewOption.value = '__add_new__';
        addNewOption.textContent = '+ Add New Category';
        categorySelect.appendChild(addNewOption);
    }

    handleCategoryChange() {
        const categorySelect = document.getElementById('transaction-category');
        if (categorySelect.value === '__add_new__') {
            this.showAddCategoryInput();
        }
    }

    showAddCategoryInput() {
        const type = document.getElementById('transaction-type').value;
        const categoryName = prompt(`Enter new ${type} category name:`);

        if (!categoryName) {
            // User cancelled - reset dropdown
            document.getElementById('transaction-category').value = '';
            return;
        }

        this.addNewCategory(categoryName.trim(), type);
    }

    async addNewCategory(categoryName, type) {
        // Validate input
        if (!categoryName || categoryName.trim() === '') {
            alert('Category name cannot be empty');
            document.getElementById('transaction-category').value = '';
            return;
        }

        const trimmedName = categoryName.trim();

        // Check for duplicates (case-insensitive)
        const categoryList = type === 'income' ? this.categories.income : this.categories.expenses;
        const exists = categoryList.some(cat => cat.toLowerCase() === trimmedName.toLowerCase());

        if (exists) {
            alert(`Category "${trimmedName}" already exists for ${type}`);
            document.getElementById('transaction-category').value = '';
            return;
        }

        this.showLoading('Adding new category...');

        try {
            // Add to appropriate list
            if (type === 'income') {
                this.categories.income.push(trimmedName);
                this.categories.income.sort();
            } else {
                this.categories.expenses.push(trimmedName);
                this.categories.expenses.sort();
            }

            // Update GitHub
            const commitMessage = `Add new ${type} category: ${trimmedName}`;
            await this.githubClient.updateCategoryFile(this.categories, commitMessage);

            // Update dropdown
            this.updateCategoryDropdown();

            // Select the newly added category
            document.getElementById('transaction-category').value = trimmedName;

            console.log(`✓ Category "${trimmedName}" added successfully`);
        } catch (error) {
            console.error('Error adding category:', error);
            alert('Error adding category: ' + error.message);

            // Rollback the change
            if (type === 'income') {
                const index = this.categories.income.indexOf(trimmedName);
                if (index > -1) this.categories.income.splice(index, 1);
            } else {
                const index = this.categories.expenses.indexOf(trimmedName);
                if (index > -1) this.categories.expenses.splice(index, 1);
            }

            document.getElementById('transaction-category').value = '';
        } finally {
            this.hideLoading();
        }
    }

    // ==========================================
    // FORM HANDLING
    // ==========================================
    async handleFormSubmit() {
        const date = document.getElementById('transaction-date').value;
        const type = document.getElementById('transaction-type').value;
        const description = document.getElementById('transaction-description').value.trim();
        const amount = parseFloat(document.getElementById('transaction-amount').value);
        const category = document.getElementById('transaction-category').value;

        if (!date || !description || !amount || amount <= 0) {
            alert('Please fill all fields with valid data');
            return;
        }

        this.showLoading(this.editingId ? 'Updating transaction...' : 'Adding transaction...');

        try {
            const transactionData = {
                date,
                description,
                amount
            };

            // Add category if selected (optional field)
            if (category && category !== '__add_new__') {
                transactionData.category = category;
            }

            if (this.editingId) {
                // Update existing transaction
                await this.dataManager.updateTransaction(this.editingId, transactionData);
                this.editingId = null;
            } else {
                // Add new transaction
                await this.dataManager.addTransaction(transactionData, type);
            }

            this.resetForm();
            this.render();
        } catch (error) {
            console.error('Error saving transaction:', error);
            alert('Error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    resetForm() {
        document.getElementById('transaction-form').reset();
        document.getElementById('transaction-form').classList.remove('edit-mode');
        document.getElementById('form-title').textContent = 'Add Transaction';
        document.getElementById('submit-btn').textContent = 'Add Transaction';
        document.getElementById('cancel-btn').style.display = 'none';
        this.setTransactionType('income');
        this.updateCategoryDropdown();
        this.editingId = null;
    }

    cancelEdit() {
        this.resetForm();
    }

    // ==========================================
    // TRANSACTION OPERATIONS
    // ==========================================
    editTransaction(id) {
        const found = this.dataManager.findTransaction(id);
        if (!found) {
            alert('Transaction not found');
            return;
        }

        const { transaction, type } = found;
        this.editingId = id;

        document.getElementById('transaction-date').value = transaction.date;
        document.getElementById('transaction-description').value = transaction.description;
        document.getElementById('transaction-amount').value = transaction.amount;
        this.setTransactionType(type);

        // Set category if exists
        if (transaction.category) {
            document.getElementById('transaction-category').value = transaction.category;
        }

        // Update UI to show edit mode
        document.getElementById('transaction-form').classList.add('edit-mode');
        document.getElementById('form-title').textContent = 'Edit Transaction';
        document.getElementById('submit-btn').textContent = 'Update Transaction';
        document.getElementById('cancel-btn').style.display = 'inline-block';

        // Scroll to form
        document.getElementById('transaction-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    async deleteTransaction(id) {
        if (!confirm('Delete this transaction? This will update your GitHub repository.')) return;

        this.showLoading('Deleting transaction...');

        try {
            await this.dataManager.deleteTransaction(id);
            this.render();
        } catch (error) {
            console.error('Error deleting transaction:', error);
            alert('Error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // ==========================================
    // RENDERING
    // ==========================================
    render() {
        this.renderSummary();
        this.renderTransactions();
    }

    renderSummary() {
        const summary = this.dataManager.calculateMonthlySummary(this.currentYear, this.currentMonth);

        document.getElementById('total-income').textContent = this.formatCurrency(summary.totalIncome);
        document.getElementById('total-expenses').textContent = this.formatCurrency(summary.totalExpenses);

        const balanceElement = document.getElementById('balance');
        balanceElement.textContent = this.formatCurrency(summary.balance);

        // Update balance color
        balanceElement.classList.remove('positive', 'negative');
        if (summary.balance > 0) {
            balanceElement.classList.add('positive');
        } else if (summary.balance < 0) {
            balanceElement.classList.add('negative');
        }
    }

    renderTransactions() {
        const transactions = this.dataManager.getAllTransactionsForMonth(this.currentYear, this.currentMonth);
        const tbody = document.getElementById('transaction-tbody');
        const emptyState = document.getElementById('empty-state');
        const table = document.getElementById('transaction-table');

        if (transactions.length === 0) {
            table.style.display = 'none';
            emptyState.classList.add('visible');
            return;
        }

        table.style.display = 'table';
        emptyState.classList.remove('visible');

        tbody.innerHTML = transactions.map(t => `
            <tr class="fade-in">
                <td class="transaction-date">${this.formatDate(t.date)}</td>
                <td class="transaction-description">${this.escapeHtml(t.description)}</td>
                <td class="transaction-amount ${t.type}">${this.formatCurrency(t.amount)}</td>
                <td>
                    <div class="transaction-actions">
                        <button class="action-btn edit" onclick="app.editTransaction('${t.id}')" title="Edit">✏️</button>
                        <button class="action-btn delete" onclick="app.deleteTransaction('${t.id}')" title="Delete">❌</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // ==========================================
    // FORMATTING UTILITIES
    // ==========================================
    formatCurrency(amount) {
        return '₹' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    formatDate(dateString) {
        const date = new Date(dateString + 'T00:00:00');
        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        return date.toLocaleDateString('en-IN', options);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ==========================================
// INITIALIZE APP
// ==========================================
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new Ledgerly();
});
