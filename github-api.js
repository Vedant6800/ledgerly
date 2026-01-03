// ==========================================
// GITHUB CONFIGURATION
// ==========================================
const GITHUB_CONFIG = {
    owner: 'Vedant6800',        // Replace with your GitHub username
    repo: 'ledgerly',                 // Replace with your repository name
    branch: 'main',                        // Replace with your branch name (main or master)
    token: '',              // Token will be loaded from localStorage
    basePath: 'data'                       // Base path for data files in repo
};

// ==========================================
// TOKEN MANAGER
// ==========================================
class TokenManager {
    static STORAGE_KEY = 'ledgerly_github_token';

    // Get token from localStorage
    static getToken() {
        return localStorage.getItem(this.STORAGE_KEY);
    }

    // Save token to localStorage
    static saveToken(token) {
        if (token && token.trim()) {
            localStorage.setItem(this.STORAGE_KEY, token.trim());
            return true;
        }
        return false;
    }

    // Remove token from localStorage
    static clearToken() {
        localStorage.removeItem(this.STORAGE_KEY);
    }

    // Prompt user for token
    static promptForToken(message = 'Please enter your GitHub Personal Access Token:') {
        const instructions = `
${message}

To generate a new token:
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name it "Ledgerly App"
4. Select "repo" scope
5. Click "Generate token"
6. Copy the token (starts with 'ghp_' or 'github_pat_')

Enter your token below:`;

        const token = prompt(instructions);

        if (token && token.trim()) {
            return token.trim();
        }

        return null;
    }

    // Validate token format (basic check)
    static isValidTokenFormat(token) {
        if (!token || typeof token !== 'string') return false;
        const trimmed = token.trim();
        // GitHub tokens start with ghp_ (personal) or github_pat_ (fine-grained)
        return trimmed.startsWith('ghp_') || trimmed.startsWith('github_pat_');
    }
}

// ==========================================
// GITHUB API CLIENT
// ==========================================
class GitHubAPIClient {
    constructor(config) {
        this.config = config;
        this.baseURL = 'https://api.github.com';
        this.cache = new Map(); // Cache file SHAs
        this.tokenValidated = false;
    }

    // Initialize and validate token
    async initializeToken() {
        // Try to get token from localStorage first
        let token = TokenManager.getToken();

        if (token) {
            console.log('✓ Token found in localStorage, validating...');
            this.config.token = token;

            // Validate the token by making a test API call
            const isValid = await this.validateToken();

            if (isValid) {
                console.log('✓ Token is valid and working!');
                this.tokenValidated = true;
                return true;
            } else {
                console.warn('✗ Token in localStorage is expired or invalid');
                TokenManager.clearToken();

                // Ask user for new token
                token = TokenManager.promptForToken('Your stored token has expired or is invalid.\n\nPlease provide a new GitHub Personal Access Token:');

                if (!token) {
                    throw new Error('GitHub token is required to use this app');
                }

                this.config.token = token;

                // Validate the new token
                const isNewTokenValid = await this.validateToken();

                if (isNewTokenValid) {
                    TokenManager.saveToken(token);
                    console.log('✓ New token validated and saved!');
                    this.tokenValidated = true;
                    return true;
                } else {
                    throw new Error('The provided token is invalid. Please check and try again.');
                }
            }
        } else {
            // No token in localStorage, ask user
            console.log('No token found in localStorage');
            token = TokenManager.promptForToken('Welcome to Ledgerly!\n\nTo connect to GitHub, you need a Personal Access Token.');

            if (!token) {
                throw new Error('GitHub token is required to use this app');
            }

            this.config.token = token;

            // Validate the token
            const isValid = await this.validateToken();

            if (isValid) {
                TokenManager.saveToken(token);
                console.log('✓ Token validated and saved to localStorage!');
                this.tokenValidated = true;
                return true;
            } else {
                throw new Error('The provided token is invalid. Please check and try again.');
            }
        }
    }

    // Validate token by making a test API call
    async validateToken() {
        try {
            const response = await fetch(`${this.baseURL}/user`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.status === 200) {
                const userData = await response.json();
                console.log(`Authenticated as: ${userData.login}`);
                return true;
            } else if (response.status === 401) {
                console.error('Token authentication failed: 401 Unauthorized');
                return false;
            } else {
                console.error(`Token validation returned status: ${response.status}`);
                return false;
            }
        } catch (error) {
            console.error('Error validating token:', error);
            return false;
        }
    }

    // Get authorization headers
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.config.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
    }

    // Build file path
    getFilePath(year, month, type) {
        return `${this.config.basePath}/${year}/${month}/${type}.json`;
    }

    // Check if file or folder exists
    async checkExists(path) {
        const url = `${this.baseURL}/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`;
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });
            
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    // Create folder structure by creating a .gitkeep file
    async createFolderStructure(year, month) {
        const folderPath = `${this.config.basePath}/${year}/${month}/.gitkeep`;
        const url = `${this.baseURL}/repos/${this.config.owner}/${this.config.repo}/contents/${folderPath}`;
        
        try {
            // Check if folder already exists
            const exists = await this.checkExists(`${this.config.basePath}/${year}/${month}`);
            if (exists) {
                return true; // Folder already exists
            }

            const body = {
                message: `Create folder structure for ${year}/${month}`,
                content: btoa(''), // Empty .gitkeep file
                branch: this.config.branch
            };

            const response = await fetch(url, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(body)
            });

            if (!response.ok && response.status !== 422) { // 422 means file already exists
                throw new Error(`Failed to create folder: ${response.status}`);
            }

            return true;
        } catch (error) {
            console.warn(`Could not create folder structure for ${year}/${month}:`, error);
            return false;
        }
    }

    // Get file content from GitHub
    async getFile(year, month, type) {
        const path = this.getFilePath(year, month, type);
        const url = `${this.baseURL}/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (response.status === 404) {
                // File doesn't exist - try to create folder structure and return empty
                await this.createFolderStructure(year, month);
                
                return {
                    content: [],
                    sha: null,
                    exists: false
                };
            }

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            // Decode base64 content
            const content = JSON.parse(atob(data.content));
            
            // Cache the SHA for future updates
            const cacheKey = `${year}-${month}-${type}`;
            this.cache.set(cacheKey, data.sha);

            return {
                content,
                sha: data.sha,
                exists: true
            };
        } catch (error) {
            console.error(`Error fetching file ${path}:`, error);
            
            // Try to create folder structure for new months
            if (error.message.includes('404')) {
                await this.createFolderStructure(year, month);
            }
            
            return {
                content: [],
                sha: null,
                exists: false
            };
        }
    }

    // Create initial file structure for a new month
    async initializeMonthFiles(year, month) {
        try {
            // Create folder structure first
            await this.createFolderStructure(year, month);
            
            // Create empty income.json
            await this.updateFile(year, month, 'income', [], `Initialize income.json for ${year}/${month}`);
            
            // Create empty expenses.json
            await this.updateFile(year, month, 'expenses', [], `Initialize expenses.json for ${year}/${month}`);
            
            return true;
        } catch (error) {
            console.error(`Error initializing month files for ${year}/${month}:`, error);
            return false;
        }
    }

    // Update or create file on GitHub
    async updateFile(year, month, type, content, message) {
        const path = this.getFilePath(year, month, type);
        const url = `${this.baseURL}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
        
        // Get current SHA if file exists
        const cacheKey = `${year}-${month}-${type}`;
        let sha = this.cache.get(cacheKey);

        // If SHA not in cache, try to fetch it
        if (!sha) {
            try {
                const fileData = await this.getFile(year, month, type);
                sha = fileData.sha;
            } catch (error) {
                // File doesn't exist, ensure folder structure exists
                await this.createFolderStructure(year, month);
                sha = null;
            }
        }

        // Encode content to base64
        const encodedContent = btoa(JSON.stringify(content, null, 2));

        const body = {
            message: message || `Update ${type}.json for ${year}/${month}`,
            content: encodedContent,
            branch: this.config.branch
        };

        // Add SHA only if file exists (for update)
        if (sha) {
            body.sha = sha;
        }

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`GitHub API error: ${response.status} - ${errorData.message}`);
            }

            const data = await response.json();
            
            // Update cache with new SHA
            this.cache.set(cacheKey, data.content.sha);

            return data;
        } catch (error) {
            console.error(`Error updating file ${path}:`, error);
            throw error;
        }
    }

    // Delete file from GitHub (optional - for cleanup)
    async deleteFile(year, month, type, message) {
        const path = this.getFilePath(year, month, type);
        const url = `${this.baseURL}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;

        const cacheKey = `${year}-${month}-${type}`;
        let sha = this.cache.get(cacheKey);

        if (!sha) {
            const fileData = await this.getFile(year, month, type);
            sha = fileData.sha;
        }

        const body = {
            message: message || `Delete ${type}.json for ${year}/${month}`,
            sha: sha,
            branch: this.config.branch
        };

        const response = await fetch(url, {
            method: 'DELETE',
            headers: this.getHeaders(),
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`Failed to delete file: ${response.status}`);
        }

        this.cache.delete(cacheKey);
        return await response.json();
    }
}

// ==========================================
// DATA MANAGER WITH GITHUB INTEGRATION
// ==========================================
class GitHubDataManager {
    constructor(githubClient) {
        this.github = githubClient;
        this.data = {}; // In-memory cache
        this.loadingStates = new Map(); // Track loading states
    }

    // Extract year and month from date
    extractYearMonth(date) {
        const [year, month] = date.split('-');
        return { year, month };
    }

    // Validate transaction data
    validateTransaction(transaction, targetYear, targetMonth) {
        if (!transaction.date || !transaction.description || transaction.amount === undefined) {
            throw new Error('Date, description, and amount are required');
        }

        if (transaction.amount <= 0) {
            throw new Error('Amount must be a positive number');
        }

        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (!datePattern.test(transaction.date)) {
            throw new Error('Invalid date format. Use YYYY-MM-DD');
        }

        // Verify date belongs to target month
        const { year, month } = this.extractYearMonth(transaction.date);
        if (year !== targetYear || month !== targetMonth) {
            throw new Error(`Transaction date must be in ${targetYear}-${targetMonth}`);
        }

        return true;
    }

    // Generate unique ID
    generateId(type, year, month) {
        const prefix = type === 'income' ? 'inc' : 'exp';
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        return `${prefix}_${year}${month}${timestamp}${random}`;
    }

    // Load month data from GitHub
    async loadMonthData(year, month) {
        const loadingKey = `${year}-${month}`;

        // Check if already loading
        if (this.loadingStates.get(loadingKey)) {
            return this.loadingStates.get(loadingKey);
        }

        // Create loading promise
        const loadingPromise = (async () => {
            try {
                // Fetch both files in parallel
                const [incomeFile, expensesFile] = await Promise.all([
                    this.github.getFile(year, month, 'income'),
                    this.github.getFile(year, month, 'expenses')
                ]);

                // Ensure data structure exists
                if (!this.data[year]) {
                    this.data[year] = {};
                }

                this.data[year][month] = {
                    income: incomeFile.content || [],
                    expenses: expensesFile.content || [],
                    loaded: true
                };

                return this.data[year][month];
            } catch (error) {
                console.error(`Error loading month data for ${year}/${month}:`, error);
                throw error;
            } finally {
                this.loadingStates.delete(loadingKey);
            }
        })();

        this.loadingStates.set(loadingKey, loadingPromise);
        return loadingPromise;
    }

    // Get month transactions (from cache or GitHub)
    async getMonthTransactions(year, month) {
        // Check if already in memory
        if (this.data[year]?.[ month]?.loaded) {
            return {
                income: this.data[year][month].income,
                expenses: this.data[year][month].expenses
            };
        }

        // Load from GitHub
        await this.loadMonthData(year, month);
        return {
            income: this.data[year][month].income,
            expenses: this.data[year][month].expenses
        };
    }

    // Add transaction
    async addTransaction(transaction, type) {
        const { year, month } = this.extractYearMonth(transaction.date);

        // Validate transaction
        this.validateTransaction(transaction, year, month);

        // Ensure month data is loaded
        await this.loadMonthData(year, month);

        // Create new transaction
        const newTransaction = {
            id: this.generateId(type, year, month),
            date: transaction.date,
            description: transaction.description.trim(),
            amount: parseFloat(transaction.amount),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Add to in-memory data
        const targetArray = type === 'income'
            ? this.data[year][month].income
            : this.data[year][month].expenses;

        targetArray.push(newTransaction);

        // Sort by date
        targetArray.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Update GitHub
        const commitMessage = `Add ${type}: ${transaction.description} (₹${transaction.amount})`;
        await this.github.updateFile(year, month, type, targetArray, commitMessage);

        return newTransaction;
    }

    // Find transaction across all loaded months
    findTransaction(id) {
        for (const year in this.data) {
            for (const month in this.data[year]) {
                if (!this.data[year][month].loaded) continue;

                // Check income
                const incomeIndex = this.data[year][month].income.findIndex(t => t.id === id);
                if (incomeIndex !== -1) {
                    return {
                        transaction: this.data[year][month].income[incomeIndex],
                        type: 'income',
                        year,
                        month,
                        index: incomeIndex
                    };
                }

                // Check expenses
                const expenseIndex = this.data[year][month].expenses.findIndex(t => t.id === id);
                if (expenseIndex !== -1) {
                    return {
                        transaction: this.data[year][month].expenses[expenseIndex],
                        type: 'expense',
                        year,
                        month,
                        index: expenseIndex
                    };
                }
            }
        }
        return null;
    }

    // Update transaction
    async updateTransaction(id, updates) {
        const found = this.findTransaction(id);
        if (!found) {
            throw new Error('Transaction not found');
        }

        const { transaction, type, year, month, index } = found;

        // Determine new date
        const newDate = updates.date || transaction.date;
        const { year: newYear, month: newMonth } = this.extractYearMonth(newDate);

        // Validate updated transaction
        const updatedTransaction = {
            ...transaction,
            date: newDate,
            description: updates.description?.trim() || transaction.description,
            amount: parseFloat(updates.amount !== undefined ? updates.amount : transaction.amount),
            updatedAt: new Date().toISOString()
        };

        this.validateTransaction(updatedTransaction, newYear, newMonth);

        // Check if moving to different month
        if (newYear !== year || newMonth !== newMonth) {
            // Remove from old month
            const oldArray = type === 'income'
                ? this.data[year][month].income
                : this.data[year][month].expenses;
            oldArray.splice(index, 1);

            // Ensure new month is loaded
            await this.loadMonthData(newYear, newMonth);

            // Add to new month
            const newArray = type === 'income'
                ? this.data[newYear][newMonth].income
                : this.data[newYear][newMonth].expenses;
            newArray.push(updatedTransaction);
            newArray.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Update both files on GitHub
            const removeMessage = `Move ${type} transaction to ${newYear}/${newMonth}`;
            const addMessage = `Move ${type} transaction from ${year}/${month}`;

            await Promise.all([
                this.github.updateFile(year, month, type, oldArray, removeMessage),
                this.github.updateFile(newYear, newMonth, type, newArray, addMessage)
            ]);
        } else {
            // Update in same month
            const targetArray = type === 'income'
                ? this.data[year][month].income
                : this.data[year][month].expenses;

            targetArray[index] = updatedTransaction;
            targetArray.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Update GitHub
            const commitMessage = `Update ${type}: ${updatedTransaction.description}`;
            await this.github.updateFile(year, month, type, targetArray, commitMessage);
        }

        return updatedTransaction;
    }

    // Delete transaction
    async deleteTransaction(id) {
        const found = this.findTransaction(id);
        if (!found) {
            throw new Error('Transaction not found');
        }

        const { transaction, type, year, month, index } = found;

        // Remove from in-memory data
        const targetArray = type === 'income'
            ? this.data[year][month].income
            : this.data[year][month].expenses;

        targetArray.splice(index, 1);

        // Update GitHub
        const commitMessage = `Delete ${type}: ${transaction.description} (₹${transaction.amount})`;
        await this.github.updateFile(year, month, type, targetArray, commitMessage);

        return true;
    }

    // Calculate monthly summary
    calculateMonthlySummary(year, month) {
        if (!this.data[year]?.[month]?.loaded) {
            return {
                totalIncome: 0,
                totalExpenses: 0,
                balance: 0,
                transactionCount: { income: 0, expenses: 0 }
            };
        }

        const monthData = this.data[year][month];

        const totalIncome = monthData.income.reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = monthData.expenses.reduce((sum, t) => sum + t.amount, 0);
        const balance = totalIncome - totalExpenses;

        return {
            totalIncome,
            totalExpenses,
            balance,
            transactionCount: {
                income: monthData.income.length,
                expenses: monthData.expenses.length
            }
        };
    }

    // Get all transactions for display
    getAllTransactionsForMonth(year, month) {
        if (!this.data[year]?.[month]?.loaded) {
            return [];
        }

        const monthData = this.data[year][month];

        const incomeWithType = monthData.income.map(t => ({ ...t, type: 'income' }));
        const expensesWithType = monthData.expenses.map(t => ({ ...t, type: 'expense' }));

        const combined = [...incomeWithType, ...expensesWithType];
        combined.sort((a, b) => new Date(b.date) - new Date(a.date));

        return combined;
    }

    // Refresh data from GitHub (force reload)
    async refreshMonth(year, month) {
        const loadingKey = `${year}-${month}`;
        this.loadingStates.delete(loadingKey);

        if (this.data[year]?.[month]) {
            this.data[year][month].loaded = false;
        }

        return await this.loadMonthData(year, month);
    }
}
