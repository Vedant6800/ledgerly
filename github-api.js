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

    // Get category file path
    getCategoryFilePath() {
        return `${this.config.basePath}/category.json`;
    }

    getBorrowLendPath(relativePath) {
        return `${this.config.basePath}/borrow-lend/${relativePath}`;
    }

    async getDataFile(path, cacheKey) {
        const url = `${this.baseURL}/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (response.status === 404) {
                return { content: null, sha: null, exists: false };
            }
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const content = JSON.parse(atob(data.content));
            this.cache.set(cacheKey, data.sha);
            return { content, sha: data.sha, exists: true };
        } catch (error) {
            console.error(`Error fetching data file ${path}:`, error);
            throw error;
        }
    }

    async updateDataFile(path, cacheKey, content, message) {
        const url = `${this.baseURL}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
        let sha = this.cache.get(cacheKey);

        if (!sha) {
            const existing = await this.getDataFile(path, cacheKey);
            sha = existing.sha;
        }

        const body = {
            message: message || `Update ${path}`,
            content: btoa(JSON.stringify(content, null, 2)),
            branch: this.config.branch
        };
        if (sha) body.sha = sha;

        const response = await fetch(url, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(this.buildApiError(response.status, errorData.message));
        }

        const data = await response.json();
        this.cache.set(cacheKey, data.content.sha);
        return data;
    }

    async listDataFiles(path) {
        const url = `${this.baseURL}/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`;
        const response = await fetch(url, { method: 'GET', headers: this.getHeaders() });
        if (response.status === 404) return [];
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(this.buildApiError(response.status, errorData.message));
        }
        return await response.json();
    }

    async deleteDataFile(path, cacheKey, message) {
        const url = `${this.baseURL}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
        const sha = this.cache.get(cacheKey) || (await this.getDataFile(path, cacheKey)).sha;
        if (!sha) throw new Error('Cannot delete a record that is not present on GitHub');
        const response = await fetch(url, {
            method: 'DELETE',
            headers: this.getHeaders(),
            body: JSON.stringify({ message, sha, branch: this.config.branch })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(this.buildApiError(response.status, errorData.message));
        }
        this.cache.delete(cacheKey);
        return response.json();
    }

    // Get category file from GitHub
    async getCategoryFile() {
        const path = this.getCategoryFilePath();
        const url = `${this.baseURL}/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (response.status === 404) {
                // File doesn't exist - return default categories
                return {
                    content: {
                        income: [],
                        expenses: []
                    },
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
            this.cache.set('category', data.sha);

            return {
                content,
                sha: data.sha,
                exists: true
            };
        } catch (error) {
            console.error(`Error fetching category file:`, error);
            return {
                content: {
                    income: [],
                    expenses: []
                },
                sha: null,
                exists: false
            };
        }
    }

    // Update category file on GitHub
    async updateCategoryFile(content, message) {
        const path = this.getCategoryFilePath();
        const url = `${this.baseURL}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;

        // Get current SHA if file exists
        let sha = this.cache.get('category');

        // If SHA not in cache, try to fetch it
        if (!sha) {
            try {
                const fileData = await this.getCategoryFile();
                sha = fileData.sha;
            } catch (error) {
                sha = null;
            }
        }

        // Encode content to base64
        const encodedContent = btoa(JSON.stringify(content, null, 2));

        const body = {
            message: message || 'Update category.json',
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
                throw new Error(this.buildApiError(response.status, errorData.message));
            }

            const data = await response.json();

            // Update cache with new SHA
            this.cache.set('category', data.content.sha);

            return data;
        } catch (error) {
            console.error(`Error updating category file:`, error);
            throw error;
        }
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
                throw new Error(this.buildApiError(response.status, errorData.message));
            }

            const data = await response.json();

            // Update cache with new SHA
            this.cache.set(cacheKey, data.content.sha);

            // Invalidate Financial Position cache for this month in localStorage
            const lsKey = `ledgerly_fp_agg_${year}-${month}`;
            try {
                localStorage.removeItem(lsKey);
            } catch (_) {}

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

        // Invalidate Financial Position cache for this month in localStorage
        const lsKey = `ledgerly_fp_agg_${year}-${month}`;
        try {
            localStorage.removeItem(lsKey);
        } catch (_) {}

        return await response.json();
    }
    /**
     * Translates a raw GitHub API HTTP status into a plain-English error message.
     * Keeps technical details out of the user-facing UI while still logging the
     * original reason for developer reference.
     *
     * @param {number} status       HTTP status code returned by GitHub.
     * @param {string} rawMessage   Raw message from the GitHub API response body.
     * @returns {string}            Human-readable error string.
     */
    buildApiError(status, rawMessage) {
        console.error(`[GitHub API] ${status} — ${rawMessage}`);

        switch (status) {
            case 409:
                // Conflict: the cached file SHA is stale, usually because a
                // previous write hasn't propagated yet. Tell the user to wait.
                return 'A previous transaction is still being saved. ' +
                    'Please wait a moment before adding the next one.';

            case 401:
                return 'Your GitHub token is invalid or has expired. ' +
                    'Click the 🔑 icon to update it.';

            case 403:
                return 'Access denied. Make sure your GitHub token has the ' +
                    '"repo" scope and has not expired.';

            case 404:
                return 'File or repository not found. ' +
                    'Check the owner and repo name in GITHUB_CONFIG.';

            case 422:
                return 'GitHub could not process the request. ' +
                    'The file may already exist or the data is invalid.';

            case 500:
            case 502:
            case 503:
                return 'GitHub is temporarily unavailable. ' +
                    'Please try again in a few seconds.';

            default:
                // Fall back to a cleaned-up version of the raw message so it
                // is still readable but not a raw API dump.
                return rawMessage
                    ? `Sync failed (${status}): ${rawMessage}`
                    : `An unexpected error occurred (HTTP ${status}).`;
        }
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

    // ==========================================
    // BORROW & LEND DATA MANAGER
    // ==========================================
    static BorrowLendDataManager = class BorrowLendDataManager {
        constructor(githubClient) {
            this.github = githubClient;
            this.people = [];
            this.records = [];
            this.loaded = false;
            this.loadingPromise = null;
            this.writeQueue = Promise.resolve();
        }

        static normalizePersonName(name) {
            return String(name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
        }

        static cents(value) {
            const number = Number(value);
            if (!Number.isFinite(number)) throw new Error('Amount must be a valid number');
            return Math.round(number * 100);
        }

        static amount(cents) {
            return cents / 100;
        }

        static status(record) {
            const repaid = (record.repayments || []).reduce((sum, item) => sum + this.cents(item.amount), 0);
            const principal = this.cents(record.amount);
            if (repaid === 0) return 'Active';
            if (repaid >= principal) return 'Settled';
            return 'Partially Settled';
        }

        calculateRecord(record) {
            const principal = BorrowLendDataManager.cents(record.amount);
            const repaid = (record.repayments || []).reduce(
                (sum, item) => sum + BorrowLendDataManager.cents(item.amount), 0
            );
            return {
                ...record,
                repayments: record.repayments || [],
                totalRepaid: BorrowLendDataManager.amount(repaid),
                outstanding: BorrowLendDataManager.amount(Math.max(0, principal - repaid)),
                status: BorrowLendDataManager.status(record)
            };
        }

        async load() {
            if (this.loaded) return this.getSnapshot();
            if (this.loadingPromise) return this.loadingPromise;

            this.loadingPromise = (async () => {
                const peopleFile = await this.github.getDataFile(
                    this.github.getBorrowLendPath('people.json'), 'borrow-lend-people'
                );
                this.people = Array.isArray(peopleFile.content) ? peopleFile.content : [];

                let files = [];
                try {
                    files = await this.github.listDataFiles(this.github.getBorrowLendPath('records'));
                } catch (error) {
                    if (!String(error.message).includes('404')) throw error;
                }

                const recordFiles = Array.isArray(files)
                    ? files.filter(file => file.type === 'file' && file.name.endsWith('.json'))
                    : [];
                const loadedRecords = await Promise.all(recordFiles.map(file =>
                    this.github.getDataFile(file.path, `borrow-lend-record-${file.name}`)
                ));
                this.records = loadedRecords
                    .map(file => file.content)
                    .filter(record => record && record.id)
                    .map(record => ({ ...record, repayments: Array.isArray(record.repayments) ? record.repayments : [] }));
                this.loaded = true;
                return this.getSnapshot();
            })();

            try {
                return await this.loadingPromise;
            } finally {
                this.loadingPromise = null;
            }
        }

        getSnapshot() {
            return {
                people: [...this.people],
                records: this.records.map(record => this.calculateRecord(record))
            };
        }

        async enqueueWrite(operation) {
            const next = this.writeQueue.then(operation, operation);
            this.writeQueue = next.catch(() => {});
            return next;
        }

        async savePeople() {
            return this.github.updateDataFile(
                this.github.getBorrowLendPath('people.json'),
                'borrow-lend-people',
                this.people,
                'Update Borrow & Lend people'
            );
        }

        async ensurePerson(name) {
            const displayName = String(name || '').trim().replace(/\s+/g, ' ');
            if (!displayName) throw new Error('Person name is required');
            const normalized = BorrowLendDataManager.normalizePersonName(displayName);
            let person = this.people.find(item => item.normalizedName === normalized);
            if (person) return person;

            person = {
                id: `person_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                name: displayName,
                normalizedName: normalized,
                createdAt: new Date().toISOString()
            };
            this.people.push(person);
            await this.enqueueWrite(() => this.savePeople());
            return person;
        }

        validateRecordInput(input) {
            if (!input.personName || !String(input.personName).trim()) throw new Error('Person name is required');
            if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('A valid date is required');
            if (BorrowLendDataManager.cents(input.amount) <= 0) throw new Error('Amount must be greater than zero');
            if (!['borrowed', 'lent'].includes(input.type)) throw new Error('Invalid Borrow & Lend record type');
        }

        recordPath(id) {
            return this.github.getBorrowLendPath(`records/${id}.json`);
        }

        async addRecord(input) {
            await this.load();
            this.validateRecordInput(input);
            const person = await this.ensurePerson(input.personName);
            const prefix = input.type === 'borrowed' ? 'bor' : 'len';
            const record = {
                id: `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                personId: person.id,
                type: input.type,
                amount: BorrowLendDataManager.amount(BorrowLendDataManager.cents(input.amount)),
                date: input.date,
                description: String(input.description || '').trim(),
                notes: String(input.notes || '').trim(),
                repayments: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            await this.enqueueWrite(() => this.github.updateDataFile(
                this.recordPath(record.id),
                `borrow-lend-record-${record.id}.json`,
                record,
                `Add ${input.type} record for ${person.name}`
            ));
            this.records.push(record);
            return this.calculateRecord(record);
        }

        findRecord(id) {
            const record = this.records.find(item => item.id === id);
            if (!record) throw new Error('Borrow & Lend record not found');
            return record;
        }

        async updateRecord(id, updates) {
            await this.load();
            const record = this.findRecord(id);
            const next = {
                ...record,
                ...updates,
                personId: record.personId,
                type: record.type,
                id: record.id,
                amount: BorrowLendDataManager.amount(BorrowLendDataManager.cents(
                    updates.amount !== undefined ? updates.amount : record.amount
                )),
                date: updates.date || record.date,
                description: String(updates.description !== undefined ? updates.description : record.description).trim(),
                notes: String(updates.notes !== undefined ? updates.notes : record.notes).trim(),
                repayments: record.repayments,
                updatedAt: new Date().toISOString()
            };
            this.validateRecordInput({
                ...next,
                personName: this.people.find(person => person.id === next.personId)?.name
            });
            const total = this.calculateRecord(next);
            const repaymentCents = next.repayments.reduce((sum, item) => sum + BorrowLendDataManager.cents(item.amount), 0);
            if (repaymentCents > BorrowLendDataManager.cents(next.amount)) {
                throw new Error('Original amount cannot be less than repayments');
            }
            await this.enqueueWrite(() => this.github.updateDataFile(
                this.recordPath(id), `borrow-lend-record-${id}.json`, next, `Update Borrow & Lend record ${id}`
            ));
            this.records[this.records.findIndex(item => item.id === id)] = next;
            return total;
        }

        async addRepayment(recordId, input) {
            await this.load();
            const record = this.findRecord(recordId);
            const amount = BorrowLendDataManager.amount(BorrowLendDataManager.cents(input.amount));
            if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('A valid repayment date is required');
            if (amount <= 0) throw new Error('Repayment must be greater than zero');
            const current = this.calculateRecord(record);
            if (BorrowLendDataManager.cents(amount) > BorrowLendDataManager.cents(current.outstanding)) {
                throw new Error('Repayment cannot exceed the outstanding amount');
            }
            const repayment = {
                id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                amount,
                date: input.date,
                notes: String(input.notes || '').trim()
            };
            const next = { ...record, repayments: [...record.repayments, repayment], updatedAt: new Date().toISOString() };
            await this.enqueueWrite(() => this.github.updateDataFile(
                this.recordPath(recordId), `borrow-lend-record-${recordId}.json`, next, `Add repayment to ${recordId}`
            ));
            this.records[this.records.findIndex(item => item.id === recordId)] = next;
            return this.calculateRecord(next);
        }

        async updateRepayment(recordId, repaymentId, input) {
            await this.load();
            const record = this.findRecord(recordId);
            const existing = record.repayments.find(item => item.id === repaymentId);
            if (!existing) throw new Error('Repayment not found');
            const remaining = this.calculateRecord({
                ...record,
                repayments: record.repayments.filter(item => item.id !== repaymentId)
            }).outstanding;
            const amount = BorrowLendDataManager.amount(BorrowLendDataManager.cents(input.amount));
            if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
                throw new Error('A valid repayment date is required');
            }
            if (amount <= 0 || BorrowLendDataManager.cents(amount) > BorrowLendDataManager.cents(remaining)) {
                throw new Error('Repayment must be positive and cannot exceed the outstanding amount');
            }
            const next = {
                ...record,
                repayments: record.repayments.map(item => item.id === repaymentId
                    ? { ...item, amount, date: input.date, notes: String(input.notes || '').trim() } : item),
                updatedAt: new Date().toISOString()
            };
            await this.enqueueWrite(() => this.github.updateDataFile(
                this.recordPath(recordId), `borrow-lend-record-${recordId}.json`, next, `Correct repayment on ${recordId}`
            ));
            this.records[this.records.findIndex(item => item.id === recordId)] = next;
            return this.calculateRecord(next);
        }

        async deleteRepayment(recordId, repaymentId) {
            await this.load();
            const record = this.findRecord(recordId);
            const next = {
                ...record,
                repayments: record.repayments.filter(item => item.id !== repaymentId),
                updatedAt: new Date().toISOString()
            };
            await this.enqueueWrite(() => this.github.updateDataFile(
                this.recordPath(recordId), `borrow-lend-record-${recordId}.json`, next, `Delete repayment on ${recordId}`
            ));
            this.records[this.records.findIndex(item => item.id === recordId)] = next;
            return this.calculateRecord(next);
        }

        async deleteRecord(id) {
            await this.load();
            const record = this.findRecord(id);
            if (record.repayments.length > 0) throw new Error('Records with repayment history cannot be deleted. Correct the repayments instead.');
            await this.enqueueWrite(() => this.github.deleteDataFile(
                this.recordPath(id), `borrow-lend-record-${id}.json`, `Delete Borrow & Lend record ${id}`
            ));
            this.records = this.records.filter(item => item.id !== id);
            return true;
        }

        getSummary() {
            const records = this.records.map(record => this.calculateRecord(record));
            const totals = records.reduce((result, record) => {
                const principal = BorrowLendDataManager.cents(record.amount);
                const repaid = BorrowLendDataManager.cents(record.totalRepaid);
                if (record.type === 'borrowed') {
                    result.totalBorrowed += principal;
                    result.totalRepaid += repaid;
                } else {
                    result.totalLent += principal;
                    result.totalReceivedBack += repaid;
                }
                return result;
            }, { totalBorrowed: 0, totalRepaid: 0, totalLent: 0, totalReceivedBack: 0 });
            totals.outstandingLiabilities = totals.totalBorrowed - totals.totalRepaid;
            totals.outstandingReceivables = totals.totalLent - totals.totalReceivedBack;
            return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, BorrowLendDataManager.amount(value)]));
        }

        getPersonName(personId) {
            return this.people.find(person => person.id === personId)?.name || 'Unknown person';
        }

        getSnapshotWithSummary() {
            const snapshot = this.getSnapshot();
            return { ...snapshot, summary: this.getSummary() };
        }
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
        if (this.data[year]?.[month]?.loaded) {
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

        // Add category if provided (optional field)
        if (transaction.category) {
            newTransaction.category = transaction.category;
        }

        // Normalize type to plural form for file operations
        const fileType = type === 'income' ? 'income' : 'expenses';

        // Add to in-memory data
        const targetArray = type === 'income'
            ? this.data[year][month].income
            : this.data[year][month].expenses;

        targetArray.push(newTransaction);

        // Sort by date
        targetArray.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Update GitHub
        const commitMessage = `Add ${type}: ${transaction.description} (₹${transaction.amount})`;
        await this.github.updateFile(year, month, fileType, targetArray, commitMessage);

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

        // Update category if provided in updates
        if (updates.category !== undefined) {
            if (updates.category) {
                updatedTransaction.category = updates.category;
            } else {
                // Remove category if empty string passed
                delete updatedTransaction.category;
            }
        }

        this.validateTransaction(updatedTransaction, newYear, newMonth);

        // Check if moving to different month
        if (newYear !== year || newMonth !== month) {
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
            const fileType = type === 'income' ? 'income' : 'expenses';
            const removeMessage = `Move ${type} transaction to ${newYear}/${newMonth}`;
            const addMessage = `Move ${type} transaction from ${year}/${month}`;

            await Promise.all([
                this.github.updateFile(year, month, fileType, oldArray, removeMessage),
                this.github.updateFile(newYear, newMonth, fileType, newArray, addMessage)
            ]);
        } else {
            // Update in same month
            const targetArray = type === 'income'
                ? this.data[year][month].income
                : this.data[year][month].expenses;

            targetArray[index] = updatedTransaction;
            targetArray.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Update GitHub
            const fileType = type === 'income' ? 'income' : 'expenses';
            const commitMessage = `Update ${type}: ${updatedTransaction.description}`;
            await this.github.updateFile(year, month, fileType, targetArray, commitMessage);
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
        const fileType = type === 'income' ? 'income' : 'expenses';
        await this.github.updateFile(year, month, fileType, targetArray, commitMessage);

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

// Export for use in main application
window.GitHubAPIClient = GitHubAPIClient;
window.GitHubDataManager = GitHubDataManager;
window.BorrowLendDataManager = GitHubDataManager.BorrowLendDataManager;
window.GITHUB_CONFIG = GITHUB_CONFIG;
window.TokenManager = TokenManager;
