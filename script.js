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
        this.sortBy = 'date'; // Default sort field
        this.sortOrder = 'desc'; // Default sort order (descending)
        this.filterBy = 'both'; // Default filter: both, income, or expense

        // ---- Transaction Queue System ----
        // FIFO queue of pending transaction requests (add/update)
        this.txnQueue = [];
        // Lock flag: true while a request is actively being committed to GitHub
        this.isProcessing = false;
        // Debounce flag: prevents rapid double-click from submitting twice
        this.isSubmitLocked = false;

        // ---- Search System ----
        this.searchField = 'all';  // Currently selected search field
        this.searchQuery = '';     // Current raw search input value

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

        // Sort button event listeners
        document.getElementById('sort-date-btn').addEventListener('click', () => {
            this.handleSortClick('date');
        });

        document.getElementById('sort-amount-btn').addEventListener('click', () => {
            this.handleSortClick('amount');
        });

        document.getElementById('sort-description-btn').addEventListener('click', () => {
            this.handleSortClick('description');
        });

        // Filter button event listeners
        document.getElementById('filter-both-btn').addEventListener('click', () => {
            this.handleFilterClick('both');
        });

        document.getElementById('filter-income-btn').addEventListener('click', () => {
            this.handleFilterClick('income');
        });

        document.getElementById('filter-expense-btn').addEventListener('click', () => {
            this.handleFilterClick('expense');
        });

        // Search: field selector
        document.getElementById('search-field').addEventListener('change', (e) => {
            this.searchField = e.target.value;
            this.handleSearchFieldChange();
        });

        // Search: live input (debounced 200ms for smooth typing)
        let searchDebounce;
        document.getElementById('search-input').addEventListener('input', (e) => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                this.searchQuery = e.target.value;
                this.updateSearchUI();
                this.renderTransactions();
            }, 200);
        });

        // Search: clear button (single input)
        document.getElementById('search-clear-btn').addEventListener('click', () => {
            this.clearSearch();
        });

        // Search: Escape key clears everything
        document.getElementById('search-input').addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.clearSearch();
        });

        // Search: Duration — from-date change
        document.getElementById('search-from-date').addEventListener('change', () => {
            this.updateSearchUI();
            this.renderTransactions();
        });

        // Search: Duration — to-date change
        document.getElementById('search-to-date').addEventListener('change', () => {
            this.updateSearchUI();
            this.renderTransactions();
        });

        // Search: clear duration button
        document.getElementById('search-clear-duration-btn').addEventListener('click', () => {
            this.clearSearch();
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
        // Guard: prevent rapid double-click from enqueuing a duplicate request.
        // isSubmitLocked is released after a short debounce window (350ms).
        if (this.isSubmitLocked) return;
        this.isSubmitLocked = true;

        // Capture all form values synchronously right now — before any async work
        // or a form reset could invalidate them.
        const date        = document.getElementById('transaction-date').value;
        const type        = document.getElementById('transaction-type').value;
        const description = document.getElementById('transaction-description').value.trim();
        const amount      = parseFloat(document.getElementById('transaction-amount').value);
        const category    = document.getElementById('transaction-category').value;

        // Validate inputs synchronously — immediate user feedback with no API calls.
        if (!date || !description || isNaN(amount) || amount <= 0) {
            alert('Please fill all fields with valid data');
            this.isSubmitLocked = false;
            return;
        }

        // Build the transaction payload.
        const transactionData = { date, description, amount };
        if (category && category !== '__add_new__') {
            transactionData.category = category;
        }

        // Capture the editing state NOW, before resetForm() clears this.editingId.
        const operationType = this.editingId ? 'update' : 'add';
        const editingId     = this.editingId || null;

        // Build a self-contained request object.
        // Everything the queue processor needs is baked in — no shared mutable state.
        const request = {
            operationType,    // 'add' | 'update'
            transactionData,  // { date, description, amount, category? }
            txnType: type,    // 'income' | 'expense'  (only used for 'add')
            editingId,        // transaction ID to update (only used for 'update')
            requestId: `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        };

        // Push request into the queue — do NOT await; queue handles sequencing.
        this.enqueueTransaction(request);

        // Reset the form immediately so the user can queue another transaction
        // while the previous one is still being committed to GitHub.
        this.resetForm();

        // Release the double-click guard after a short debounce window.
        setTimeout(() => { this.isSubmitLocked = false; }, 350);
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
        // Refresh the queue badge to reflect any state change.
        this.updateQueueUI();
    }

    cancelEdit() {
        this.resetForm();
    }

    // ==========================================
    // TRANSACTION QUEUE SYSTEM
    // ==========================================

    /**
     * Public gateway for all transaction submissions (add & update).
     * Pushes the request onto the FIFO queue and kicks off the processor.
     * @param {Object} request  Self-contained request object produced by handleFormSubmit.
     */
    enqueueTransaction(request) {
        this.txnQueue.push(request);
        console.log(`[Queue] Enqueued "${request.operationType}" (${request.requestId}). Queue length: ${this.txnQueue.length}`);
        this.updateQueueUI();
        // Kick off the processor. If it is already running this call is a no-op
        // (the processor re-calls itself after each item finishes).
        this.processQueue();
    }

    /**
     * Sequential queue processor — the core of the race-condition prevention.
     *
     * Contract:
     *  - Only one instance runs at a time (enforced by this.isProcessing).
     *  - After each item the processor calls itself via setTimeout(0) so the
     *    browser can repaint the UI between commits.
     *  - Errors are caught per-item; the queue always continues.
     */
    async processQueue() {
        // If already processing or nothing to do, bail out.
        // A new call to processQueue() after the current item finishes will
        // pick up the next item.
        if (this.isProcessing || this.txnQueue.length === 0) return;

        this.isProcessing = true;
        this.updateQueueUI();

        // Dequeue the next request (FIFO — oldest first).
        const request = this.txnQueue.shift();
        console.log(`[Queue] Processing "${request.operationType}" (${request.requestId}). Remaining: ${this.txnQueue.length}`);

        try {
            await this.executeSingleTransaction(request);
        } catch (error) {
            // Surface the error without blocking the next queued item.
            console.error(`[Queue] "${request.requestId}" failed:`, error);
            this.showTransactionError(error.message);
        } finally {
            this.isProcessing = false;
            this.updateQueueUI();
            // Yield to the browser for a repaint, then process the next item.
            setTimeout(() => this.processQueue(), 0);
        }
    }

    /**
     * Executes a single dequeued transaction request against the GitHub API.
     * This function is deliberately isolated from all queue machinery so it
     * stays easy to test and reason about independently.
     * @param {Object} request  Dequeued request object.
     */
    async executeSingleTransaction(request) {
        const { operationType, transactionData, txnType, editingId } = request;

        // Show inline progress in the queue badge (not the full-screen overlay,
        // which would block the user from queuing more transactions).
        this.updateQueueStatusMessage(
            operationType === 'update'
                ? '✏️ Updating transaction&hellip;'
                : '☁️ Syncing to GitHub&hellip;'
        );

        if (operationType === 'update') {
            await this.dataManager.updateTransaction(editingId, transactionData);
        } else {
            await this.dataManager.addTransaction(transactionData, txnType);
        }

        // Re-render the transaction list to show the newly committed item.
        this.render();
    }

    /**
     * Translates a raw technical error message into a user-friendly sentence.
     * Acts as the final safety net — even if buildApiError() in github-api.js
     * didn't catch a specific pattern, this normalises it here.
     * @param {string} raw  Original error.message string.
     * @returns {string}    Plain-English message safe to show in the UI.
     */
    friendlyErrorMessage(raw) {
        if (!raw) return 'Something went wrong. Please try again.';

        // 409 Conflict — stale SHA, most common race-condition symptom
        if (raw.includes('409') || raw.toLowerCase().includes('does not match')) {
            return '⏳ Still saving… Please wait a moment before adding the next one.';
        }
        // 401 / 403 — auth issues
        if (raw.includes('401') || raw.toLowerCase().includes('unauthorized')) {
            return '🔑 GitHub token is invalid or expired. Click the 🔑 icon to update it.';
        }
        if (raw.includes('403') || raw.toLowerCase().includes('forbidden')) {
            return '🚫 Access denied. Make sure your token has the "repo" scope.';
        }
        // 404 — config error
        if (raw.includes('404') || raw.toLowerCase().includes('not found')) {
            return '📂 File not found on GitHub. Check your GITHUB_CONFIG settings.';
        }
        // 5xx — GitHub is down
        if (/50[023]/.test(raw)) {
            return '🌐 GitHub is temporarily unavailable. Please try again shortly.';
        }
        // Already a human-readable message (from buildApiError) — pass through as-is
        if (!raw.toLowerCase().startsWith('github api error')) {
            return raw;
        }
        // Generic fallback — strip the raw technical prefix
        return 'Sync failed. Please check your internet connection and try again.';
    }

    /**
     * Displays a non-blocking, auto-dismissing error inside the queue badge.
     * Uses inline display instead of alert() so the queue can continue
     * processing subsequent items without waiting for user interaction.
     * @param {string} message  Error message to display.
     */
    showTransactionError(message) {
        const statusEl = document.getElementById('queue-status');
        if (!statusEl) return;

        const friendly = this.friendlyErrorMessage(message);

        statusEl.style.display = 'flex';
        statusEl.innerHTML = `<span>⚠️</span><span>${this.escapeHtml(friendly)}</span>`;
        statusEl.classList.add('queue-status--error');

        // Auto-clear after 6 seconds so it doesn't linger forever.
        setTimeout(() => {
            statusEl.classList.remove('queue-status--error');
            this.updateQueueUI(); // Restore the normal pending count (if any).
        }, 6000);
    }

    /**
     * Refreshes the queue status badge and submit-button disabled state.
     * Called whenever isProcessing or txnQueue changes.
     */
    updateQueueUI() {
        const submitBtn = document.getElementById('submit-btn');
        const statusEl  = document.getElementById('queue-status');

        const queuedCount = this.txnQueue.length;
        const totalPending = queuedCount + (this.isProcessing ? 1 : 0);

        // Disable the submit button only during the brief debounce window
        // (isSubmitLocked). We intentionally keep it enabled while the queue
        // is running so users can keep adding transactions.
        if (submitBtn) {
            submitBtn.disabled = this.isSubmitLocked;
        }

        // Don't overwrite an active error message.
        if (!statusEl || statusEl.classList.contains('queue-status--error')) return;

        if (totalPending === 0) {
            statusEl.style.display = 'none';
            statusEl.innerHTML = '';
            return;
        }

        // Build the status label.
        const spinner = '<span class="queue-spinner"></span>';
        let label;
        if (this.isProcessing) {
            label = queuedCount > 0
                ? `Syncing to GitHub&hellip; <strong>(${queuedCount} more queued)</strong>`
                : 'Syncing to GitHub&hellip;';
        } else {
            label = `${queuedCount} transaction${queuedCount > 1 ? 's' : ''} queued`;
        }

        statusEl.style.display = 'flex';
        statusEl.innerHTML = `${spinner}<span>${label}</span>`;
    }

    /**
     * Updates only the status text inside the badge (used during active processing
     * to show a more specific message without a full UI refresh).
     * @param {string} message  HTML string to display (may contain &hellip; etc.).
     */
    updateQueueStatusMessage(message) {
        const statusEl = document.getElementById('queue-status');
        if (!statusEl || statusEl.classList.contains('queue-status--error')) return;

        const queuedCount = this.txnQueue.length;
        const suffix = queuedCount > 0
            ? ` <strong>(${queuedCount} more queued)</strong>`
            : '';

        statusEl.style.display = 'flex';
        statusEl.innerHTML = `<span class="queue-spinner"></span><span>${message}${suffix}</span>`;
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
        let transactions = this.dataManager.getAllTransactionsForMonth(this.currentYear, this.currentMonth);
        const tbody = document.getElementById('transaction-tbody');
        const emptyState = document.getElementById('empty-state');
        const table = document.getElementById('transaction-table');

        // Apply type filter (Both / Income / Expense buttons)
        if (this.filterBy === 'income') {
            transactions = transactions.filter(t => t.type === 'income');
        } else if (this.filterBy === 'expense') {
            transactions = transactions.filter(t => t.type === 'expense');
        }

        // Apply search filter (context-aware, field-specific)
        if (this.hasActiveSearch()) {
            transactions = this.applySearchFilter(transactions);
        }

        if (transactions.length === 0) {
            table.style.display = 'none';
            emptyState.classList.add('visible');
            const emptyMessage = document.querySelector('.empty-message');
            if (this.hasActiveSearch()) {
                emptyMessage.textContent = 'No transactions match your search';
            } else if (this.filterBy === 'income') {
                emptyMessage.textContent = 'No income transactions for this month';
            } else if (this.filterBy === 'expense') {
                emptyMessage.textContent = 'No expense transactions for this month';
            } else {
                emptyMessage.textContent = 'No transactions for this month';
            }
            // Update the match count badge even when zero results
            this.updateSearchResultCount(0);
            return;
        }

        // Apply sorting to the filtered transactions
        transactions = this.sortTransactions(transactions);

        table.style.display = 'table';
        emptyState.classList.remove('visible');

        // Update count badge AFTER filtering + sorting
        this.updateSearchResultCount(transactions.length);

        tbody.innerHTML = transactions.map(t => `
            <tr class="fade-in${this.hasActiveSearch() ? ' search-match' : ''}">
                <td class="transaction-date">${this.formatDate(t.date)}</td>
                <td class="transaction-description">${this.escapeHtml(t.description)}</td>
                <td class="transaction-category">${this.escapeHtml(t.category)}</td>
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

    // ==========================================
    // SORTING
    // ==========================================
    sortTransactions(transactions) {
        // Create a copy to avoid mutating the original array
        const sorted = [...transactions];

        sorted.sort((a, b) => {
            let compareValue = 0;

            switch (this.sortBy) {
                case 'date':
                    compareValue = new Date(a.date) - new Date(b.date);
                    break;
                case 'amount':
                    compareValue = a.amount - b.amount;
                    break;
                case 'description':
                    compareValue = a.description.localeCompare(b.description, undefined, { sensitivity: 'base' });
                    break;
                default:
                    compareValue = 0;
            }

            // Apply sort order (ascending or descending)
            return this.sortOrder === 'asc' ? compareValue : -compareValue;
        });

        return sorted;
    }

    handleSortClick(sortField) {
        // Toggle sort order if clicking the same field
        if (this.sortBy === sortField) {
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            // New field: default to ascending
            this.sortBy = sortField;
            this.sortOrder = 'asc';
        }

        // Update sort buttons UI
        this.updateSortButtonUI();

        // Re-render transactions with new sort
        this.renderTransactions();
    }

    updateSortButtonUI() {
        const sortFields = ['date', 'amount', 'description'];

        sortFields.forEach(field => {
            const btn = document.getElementById(`sort-${field}-btn`);
            const icon = btn.querySelector('.sort-icon');

            if (field === this.sortBy) {
                btn.classList.add('active');
                // Update icon based on sort order
                icon.textContent = this.sortOrder === 'asc' ? '↑' : '↓';
            } else {
                btn.classList.remove('active');
                // Show default descending icon for inactive buttons
                icon.textContent = '↓';
            }
        });
    }

    // ==========================================
    // FILTERING
    // ==========================================
    handleFilterClick(filter) {
        // Update active filter button
        this.updateFilterButtonUI(filter);

        // Update filter state
        this.filterBy = filter;

        // Re-render transactions with new filter
        this.renderTransactions();
    }

    updateFilterButtonUI(activeFilter) {
        const filters = ['both', 'income', 'expense'];

        filters.forEach(filter => {
            const btn = document.getElementById(`filter-${filter}-btn`);

            if (filter === activeFilter) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // ==========================================
    // SEARCH SYSTEM
    // ==========================================

    /**
     * Returns true if any search is currently active
     * (either a text/number/date query in the single input,
     * or at least one date set in the duration range pickers).
     */
    hasActiveSearch() {
        if (this.searchField === 'duration') {
            const from = document.getElementById('search-from-date')?.value;
            const to   = document.getElementById('search-to-date')?.value;
            return !!(from || to);
        }
        return this.searchQuery.trim().length > 0;
    }

    /**
     * Changes the search input's type, placeholder, min/step attributes,
     * and clears any active query whenever the user picks a new field.
     */
    handleSearchFieldChange() {
        const singleWrapper   = document.getElementById('search-single-wrapper');
        const durationWrapper = document.getElementById('search-duration-wrapper');
        const input           = document.getElementById('search-input');

        if (this.searchField === 'duration') {
            // Show the two date pickers; hide the single adaptive input
            singleWrapper.style.display   = 'none';
            durationWrapper.style.display = 'flex';
            this.clearSearch();
            return;
        }

        // For all other fields: show single input, hide duration pickers
        singleWrapper.style.display   = '';
        durationWrapper.style.display = 'none';

        const config = {
            all:         { type: 'text',   placeholder: 'Search all fields…' },
            description: { type: 'text',   placeholder: 'e.g. Grocery, Rent, Salary…' },
            category:    { type: 'text',   placeholder: 'e.g. Food, Transportation…' },
            amount:      { type: 'number', placeholder: 'e.g. 1500', min: '0', step: '0.01' },
            date:        { type: 'date',   placeholder: '' }
        };

        const cfg = config[this.searchField] || config['all'];

        input.type        = cfg.type;
        input.placeholder = cfg.placeholder;

        if (cfg.min  !== undefined) input.min  = cfg.min;  else input.removeAttribute('min');
        if (cfg.step !== undefined) input.step = cfg.step; else input.removeAttribute('step');

        this.clearSearch();
    }

    /**
     * Filters the given transaction array using the current searchField and searchQuery.
     * Matching is:
     *   - text fields (all / description / category): case-insensitive substring
     *   - amount: exact match with ±0.01 tolerance to handle float precision
     *   - date: exact ISO date match (YYYY-MM-DD)
     *
     * @param {Array} transactions  Pre-filtered (by type) transaction array.
     * @returns {Array}             Transactions that satisfy the search.
     */
    applySearchFilter(transactions) {
        const query = this.searchQuery.trim();

        // Duration mode — uses the two date inputs directly instead of searchQuery
        if (this.searchField === 'duration') {
            const fromDate = document.getElementById('search-from-date').value; // YYYY-MM-DD or ''
            const toDate   = document.getElementById('search-to-date').value;

            return transactions.filter(t => {
                const d = t.date || '';
                if (fromDate && toDate) return d >= fromDate && d <= toDate;
                if (fromDate)           return d >= fromDate;
                if (toDate)             return d <= toDate;
                return true; // neither set — no filter
            });
        }

        if (!query) return transactions;

        const lowerQuery = query.toLowerCase();

        return transactions.filter(t => {
            switch (this.searchField) {
                case 'description':
                    return (t.description || '').toLowerCase().includes(lowerQuery);

                case 'category':
                    return (t.category || '').toLowerCase().includes(lowerQuery);

                case 'amount': {
                    const target = parseFloat(query);
                    if (isNaN(target)) return false;
                    return Math.abs(Number(t.amount) - target) < 0.01;
                }

                case 'date':
                    return t.date === query;

                case 'all':
                default:
                    return (
                        (t.description || '').toLowerCase().includes(lowerQuery) ||
                        (t.category    || '').toLowerCase().includes(lowerQuery) ||
                        (t.date        || '').includes(query) ||
                        String(t.amount).includes(query)
                    );
            }
        });
    }

    /**
     * Syncs the search input's visual state (gold border, clear button visibility)
     * with the current searchQuery. Called on every input event.
     */
    updateSearchUI() {
        if (this.searchField === 'duration') {
            // For duration mode, manage the duration clear button
            const from     = document.getElementById('search-from-date').value;
            const to       = document.getElementById('search-to-date').value;
            const hasRange = !!(from || to);
            const durationClearBtn = document.getElementById('search-clear-duration-btn');
            durationClearBtn.style.display = hasRange ? 'flex' : 'none';

            // Also add is-active class to both date inputs that have a value
            document.getElementById('search-from-date').classList.toggle('is-active', !!from);
            document.getElementById('search-to-date').classList.toggle('is-active', !!to);
            return;
        }

        // Single input mode
        const input    = document.getElementById('search-input');
        const clearBtn = document.getElementById('search-clear-btn');
        const hasQuery = this.searchQuery.trim().length > 0;

        input.classList.toggle('is-active', hasQuery);
        clearBtn.style.display = hasQuery ? 'flex' : 'none';
    }

    /**
     * Updates the match-count badge below the search bar.
     * Hidden when no search is active; red-tinted when zero matches.
     * @param {number} count  Number of transactions currently visible.
     */
    updateSearchResultCount(count) {
        const badge = document.getElementById('search-count');
        if (!this.hasActiveSearch()) {
            badge.style.display = 'none';
            return;
        }

        badge.style.display = 'inline-block';
        badge.classList.toggle('no-results', count === 0);
        badge.textContent = count === 0
            ? 'No matches'
            : `${count} match${count === 1 ? '' : 'es'}`;
    }

    /**
     * Resets the search input, query state, and all related UI elements.
     * Called by the × button, Escape key, and field-change handler.
     */
    clearSearch() {
        // Reset single input
        const input    = document.getElementById('search-input');
        const clearBtn = document.getElementById('search-clear-btn');
        input.value = '';
        this.searchQuery = '';
        input.classList.remove('is-active');
        clearBtn.style.display = 'none';

        // Reset duration inputs
        const fromDateEl = document.getElementById('search-from-date');
        const toDateEl   = document.getElementById('search-to-date');
        const durationClearBtn = document.getElementById('search-clear-duration-btn');
        if (fromDateEl) { fromDateEl.value = ''; fromDateEl.classList.remove('is-active'); }
        if (toDateEl)   { toDateEl.value   = ''; toDateEl.classList.remove('is-active'); }
        if (durationClearBtn) durationClearBtn.style.display = 'none';

        // Hide count badge
        const badge = document.getElementById('search-count');
        badge.style.display = 'none';

        this.renderTransactions();
    }
}

// ==========================================
// INITIALIZE APP
// ==========================================
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new Ledgerly();
});

