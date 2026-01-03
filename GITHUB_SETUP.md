# Ledgerly - GitHub Integration Setup Guide

## 📋 Overview
Ledgerly now uses GitHub as the backend storage for all financial data. All transactions are stored in JSON files in your GitHub repository and accessed via the GitHub REST API.

---

## 🚀 Setup Instructions

### Step 1: Create a GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Repository name: `ledgerly-data` (or any name you prefer)
3. Make it **Public** or **Private** (both work)
4. Initialize with a README (optional)

### Step 2: Create the Data Folder Structure

In your repository, create the following folder structure:

```
ledgerly-data/
└── Data/
    ├── 2025/
    │   ├── 10/
    │   │   ├── income.json
    │   │   └── expenses.json
    │   ├── 11/
    │   │   ├── income.json
    │   │   └── expenses.json
    │   └── 12/
    │       ├── income.json
    │       └── expenses.json
    └── 2026/
        └── 01/
            ├── income.json
            └── expenses.json
```

### Step 3: Initialize JSON Files

Each `income.json` and `expenses.json` file should start as an empty array:

```json
[]
```

Or with demo data matching the schema below.

### Step 4: Generate a GitHub Personal Access Token (PAT)

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a descriptive name: `Ledgerly App`
4. Set expiration (recommend: No expiration for personal use)
5. Select scopes:
   - ✅ **repo** (Full control of private repositories)
6. Click "Generate token"
7. **Copy the token immediately** (you won't see it again!)

### Step 5: Configure the Application

Open `github-api.js` and update the configuration:

```javascript
const GITHUB_CONFIG = {
    owner: 'YOUR_GITHUB_USERNAME',        // Your GitHub username
    repo: 'ledgerly-data',                 // Your repository name
    branch: 'main',                        // Your branch (main or master)
    token: 'ghp_xxxxxxxxxxxxxxxxxxxx',     // Your Personal Access Token
    basePath: 'Data'                       // Data folder path
};
```

**Example:**
```javascript
const GITHUB_CONFIG = {
    owner: 'vedantnogja',
    repo: 'ledgerly-data',
    branch: 'main',
    token: 'ghp_abc123def456ghi789jkl012mno345pqr678',
    basePath: 'Data'
};
```

### Step 6: Deploy or Run Locally

**Option A: Deploy to GitHub Pages**
1. Push your Ledgerly files to a GitHub repository
2. Go to Settings → Pages
3. Select branch and folder
4. Your app will be live at `https://username.github.io/ledgerly`

**Option B: Run Locally with Live Server**
1. Use VS Code Live Server extension
2. Right-click `index.html` → "Open with Live Server"
3. App opens at `http://localhost:5500`

---

## 📊 JSON Schema

### Income Transaction (`income.json`)
```json
[
  {
    "id": "inc_2601001",
    "date": "2026-01-15",
    "description": "Monthly Salary",
    "amount": 75000,
    "createdAt": "2026-01-15T09:00:00.000Z",
    "updatedAt": "2026-01-15T09:00:00.000Z"
  }
]
```

### Expense Transaction (`expenses.json`)
```json
[
  {
    "id": "exp_2601001",
    "date": "2026-01-02",
    "description": "Rent Payment",
    "amount": 25000,
    "createdAt": "2026-01-02T10:00:00.000Z",
    "updatedAt": "2026-01-02T10:00:00.000Z"
  }
]
```

---

## 🔧 How It Works

### Data Flow

1. **Load Month Data**
   - App fetches `income.json` and `expenses.json` for selected month
   - Data is cached in memory for fast access
   - Files are base64-decoded from GitHub API response

2. **Add Transaction**
   - Validates transaction data
   - Adds to in-memory array
   - Encodes to base64
   - Commits to GitHub with message: `"Add income: Salary (₹75,000)"`

3. **Edit Transaction**
   - Locates transaction by ID
   - Updates fields and `updatedAt` timestamp
   - If date changes to different month:
     - Removes from original month's file
     - Adds to new month's file
     - Commits both files
   - Otherwise updates in same file

4. **Delete Transaction**
   - Removes from array by ID
   - Commits updated file with message: `"Delete expense: Groceries (₹5,000)"`

### API Calls

Every operation uses GitHub REST API:

- **GET** `/repos/{owner}/{repo}/contents/{path}`
  - Fetches file content and SHA
  
- **PUT** `/repos/{owner}/{repo}/contents/{path}`
  - Updates or creates file
  - Requires current SHA for updates
  - Content must be base64-encoded

### Month Isolation

- Each month has its own `income.json` and `expenses.json`
- Transactions belong only to their year/month
- Changing a transaction date moves it to correct month automatically
- No cross-month data contamination

### Validation Rules

✅ Amount must be positive  
✅ Date must be in YYYY-MM-DD format  
✅ Date must match target month  
✅ Description is mandatory  
✅ IDs are globally unique  

---

## 🎯 Features

### ✨ Real-time GitHub Sync
- All changes immediately committed to GitHub
- Full version history in repository
- Meaningful commit messages for tracking

### ✨ Loading Indicators
- Shows spinner during API calls
- User-friendly status messages
- Non-blocking UI

### ✨ Error Handling
- Graceful error messages
- Retry logic for network issues
- Validates before saving

### ✨ No Local Storage
- All data in GitHub
- No localStorage/cookies
- Works across devices
- Access from anywhere

### ✨ Security
- Token stored in code (for demo)
- Use environment variables in production
- Consider serverless proxy for public apps

---

## 🔐 Security Best Practices

### For Personal Use
```javascript
// Keep token in github-api.js (not committed to public repo)
const GITHUB_CONFIG = {
    token: 'ghp_your_token_here'
};
```

### For Production
```javascript
// Use environment variables
const GITHUB_CONFIG = {
    token: process.env.GITHUB_TOKEN || prompt('Enter GitHub Token')
};
```

### For Public Deployment
- Use serverless function (Vercel, Netlify) as proxy
- Store token in function environment
- Frontend calls your API, not GitHub directly

---

## 📝 Example Usage

### Add a Transaction
1. Select month: January 2026
2. Choose type: Income
3. Date: 2026-01-15
4. Description: "Freelance Project"
5. Amount: 15000
6. Click "Add Transaction"
7. ✅ Committed to `Data/2026/01/income.json`

### Edit a Transaction
1. Click ✏️ on any transaction
2. Change amount: 18000
3. Click "Update Transaction"
4. ✅ File updated with new amount and timestamp

### Move Transaction to Different Month
1. Edit transaction
2. Change date: 2026-02-15
3. Click "Update Transaction"
4. ✅ Removed from `2026/01/income.json`
5. ✅ Added to `2026/02/income.json`

---

## 🐛 Troubleshooting

### "Failed to fetch" Error
- Check internet connection
- Verify GitHub token is valid
- Confirm repository exists and is accessible

### 404 Not Found
- Verify repository name and owner
- Check branch name (main vs master)
- Ensure Data folder structure exists

### 403 Forbidden
- Token may be expired
- Token needs 'repo' scope
- Check repository permissions

### CORS Error
- GitHub API supports CORS for direct requests
- If issues persist, use serverless proxy

---

## 📚 API Reference

### GitHubAPIClient Methods

- `getFile(year, month, type)` - Fetch JSON file
- `updateFile(year, month, type, content, message)` - Update/create file
- `deleteFile(year, month, type, message)` - Delete file

### GitHubDataManager Methods

- `loadMonthData(year, month)` - Load month from GitHub
- `addTransaction(transaction, type)` - Add and commit
- `updateTransaction(id, updates)` - Update and commit
- `deleteTransaction(id)` - Delete and commit
- `calculateMonthlySummary(year, month)` - Calculate totals
- `getAllTransactionsForMonth(year, month)` - Get sorted list

---

## 🎉 Success!

You now have a fully functional personal finance app that:
- ✅ Stores all data in GitHub
- ✅ Works without a backend server
- ✅ Syncs in real-time
- ✅ Has full version history
- ✅ Is accessible from any device
- ✅ Follows strict month-wise isolation

**Start tracking your finances with Ledgerly!** 💰

