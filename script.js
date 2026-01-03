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
        this.init();
    }

    async init() {
        try {
            // Initialize GitHub API client
            this.githubClient = new GitHubAPIClient(GITHUB_CONFIG);
            this.dataManager = new GitHubDataManager(this.githubClient);

            this.loadThemePreference();
            this.setupEventListeners();
            this.setCurrentMonth();

            // Load initial month data
            await this.loadCurrentMonth();
        } catch (error) {
            console.error('Initialization error:', error);
            alert('Error initializing application. Please check your GitHub configuration.');
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
    }

    // ==========================================
    // FORM HANDLING
    // ==========================================
    async handleFormSubmit() {
        const date = document.getElementById('transaction-date').value;
        const type = document.getElementById('transaction-type').value;
        const description = document.getElementById('transaction-description').value.trim();
        const amount = parseFloat(document.getElementById('transaction-amount').value);

        if (!date || !description || !amount || amount <= 0) {
            alert('Please fill all fields with valid data');
            return;
        }

        this.showLoading(this.editingId ? 'Updating transaction...' : 'Adding transaction...');

        try {
            if (this.editingId) {
                // Update existing transaction
                await this.dataManager.updateTransaction(this.editingId, {
                    date,
                    description,
                    amount
                });
                this.editingId = null;
            } else {
                // Add new transaction
                await this.dataManager.addTransaction({
                    date,
                    description,
                    amount
                }, type);
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

