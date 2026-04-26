# Ledgerly - GitHub Integration Setup Guide

## 📋 Overview

Ledgerly uses GitHub as its cloud backend. All financial data — transactions and categories — is stored as JSON files in a GitHub repository and accessed via the GitHub REST API. No server or database is required.

---

## 🚀 Setup Instructions

### Step 1: Create a GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Suggested name: `ledgerly-data` (or any name you prefer)
3. Make it **Public** or **Private** (both work)
4. No need to initialize with a README

### Step 2: Configure the Application

Open `github-api.js` and update the configuration block at the top:

```javascript
const GITHUB_CONFIG = {
    owner: 'YOUR_GITHUB_USERNAME',   // e.g. 'vedantnogja'
    repo: 'YOUR_REPOSITORY_NAME',    // e.g. 'ledgerly-data'
    branch: 'main',                  // or 'master' depending on your repo
    token: '',                       // Leave empty — token is entered via UI
    basePath: 'data'                 // Base folder for all data files in the repo
};
```

> **Note:** The folder structure is created automatically when you add your first transaction. You do not need to create it manually.

### Step 3: Generate a GitHub Personal Access Token (PAT)

1. Go to [GitHub Settings → Tokens (classic)](https://github.com/settings/tokens)
2. Click **Generate new token → Generate new token (classic)**
3. Give it a name: `Ledgerly App`
4. Set expiration: **No expiration** (for personal use) or **90 days** (recommended for security)
5. Select scopes: ✅ **repo** (Full control of private repositories)
6. Click **Generate token**
7. **Copy the token immediately** — you won't see it again!

Tokens will start with `ghp_` (classic) or `github_pat_` (fine-grained).

### Step 4: Launch the Application

**Option A: Run Locally with VS Code Live Server**
1. Install the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) in VS Code
2. Right-click `index.html` → **Open with Live Server**
3. App opens at `http://localhost:5500`

**Option B: Deploy to GitHub Pages**
1. Push your Ledgerly files to a new GitHub repository
2. Go to **Settings → Pages**
3. Source: Deploy from a branch → Select `main` branch → `/root`
4. Your app will be live at `https://YOUR_USERNAME.github.io/ledgerly`

**Option C: Deploy to Vercel or Netlify**
1. Sign in to [Vercel](https://vercel.com) or [Netlify](https://netlify.com)
2. Import the repository or drag-and-drop the project folder
3. Deploy as a static site — no build step needed

### Step 5: Enter Your Token

1. Open the app in your browser
2. A prompt will appear asking for your GitHub Personal Access Token
3. Paste the token — it is validated against the GitHub API before saving
4. The token is saved to `localStorage` and reused on future visits

---

## 📁 Data File Structure

The app automatically creates and manages the following file structure in your GitHub repository:

```
your-repo/
└── data/
    ├── category.json          ← Income & expense categories
    ├── 2025/
    │   ├── 10/
    │   │   ├── income.json
    │   │   └── expenses.json
    │   └── 11/
    │       ├── income.json
    │       └── expenses.json
    └── 2026/
        ├── 01/
        │   ├── income.json
        │   └── expenses.json
        └── 04/
            ├── income.json
            └── expenses.json
```

When a new month is first used, the app creates a `.gitkeep` sentinel file in the folder and initializes the `income.json` and `expenses.json` files with empty arrays.

---

## 📊 JSON Schemas

### Income Transaction (`income.json`)
```json
[
  {
    "id": "inc_2602011737012345678",
    "date": "2026-02-15",
    "description": "Monthly Salary",
    "amount": 75000,
    "category": "Salary",
    "createdAt": "2026-02-15T09:00:00.000Z",
    "updatedAt": "2026-02-15T09:00:00.000Z"
  }
]
```

### Expense Transaction (`expenses.json`)
```json
[
  {
    "id": "exp_2602011737012349999",
    "date": "2026-02-02",
    "description": "Monthly Rent",
    "amount": 25000,
    "category": "Rent",
    "createdAt": "2026-02-02T10:00:00.000Z",
    "updatedAt": "2026-02-02T10:00:00.000Z"
  }
]
```

> **Note:** `category` is optional. Transactions without a category appear as "Uncategorized" in chart reports.

### Category File (`data/category.json`)
```json
{
  "income": [
    "FD/RD",
    "Others",
    "Salary"
  ],
  "expenses": [
    "Clothing",
    "Education",
    "EMI",
    "Food",
    "Grocery",
    "Rent",
    "Travel",
    "Utilities"
  ]
}
```

Categories are sorted alphabetically and managed entirely through the app UI.

---

## 🔧 How It Works

### Data Flow

1. **App Startup**
   - Loads token from `localStorage`, validates it via `GET /user`
   - Fetches `data/category.json` to populate the category dropdown
   - Loads `income.json` and `expenses.json` for the current month in parallel

2. **Add Transaction**
   - Validates inputs (date, description, amount > 0, date belongs to selected month)
   - Generates a unique ID: `inc_` or `exp_` + year + month + timestamp + random
   - Appends to the in-memory array and sorts by date
   - PUTs (creates or updates) the file on GitHub with commit message: `Add income: Salary (₹75,000)`

3. **Edit Transaction**
   - Locates transaction by ID across all loaded months
   - Updates fields and `updatedAt` timestamp
   - **If date changes to a different month:**
     - Removes transaction from old month's file
     - Adds to new month's file (loads it first if not cached)
     - Updates both files on GitHub in parallel with `Promise.all`
   - **Same month:** Updates the file in-place

4. **Delete Transaction**
   - Removes from the in-memory array by index
   - PUTs the updated array to GitHub: `Delete expense: Rent (₹25,000)`

5. **Add Category**
   - Adds the new name to the in-memory category list and sorts it
   - PUTs the updated `category.json` to GitHub: `Add new expense category: Travel`
   - Selects the new category automatically in the dropdown

6. **Reports Page**
   - Loads the selected month's data from GitHub
   - Also loads the previous month's data for comparison
   - Loads the last 3 months for the rolling average calculation
   - Renders all charts using Chart.js, which can be toggled between Bar and Pie views

### GitHub API Calls

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/user` | Token validation |
| `GET` | `/repos/{owner}/{repo}/contents/{path}` | Fetch JSON file + SHA |
| `PUT` | `/repos/{owner}/{repo}/contents/{path}` | Create or update JSON file |

> Files are base64-encoded in both directions. The app uses `btoa` (encode) and `atob` (decode) for this.

### SHA Caching

The GitHub Contents API requires the current file SHA when updating a file. The `GitHubAPIClient` caches SHAs in a `Map` after every GET or PUT response, avoiding an extra round-trip before each write.

### Month Isolation

- Each month has its own `income.json` and `expenses.json`
- Transactions strictly belong to their year/month
- The app prevents adding a transaction with a date outside the selected month

---

## 🔐 Security

### Token Validation
1. Token format checked (`ghp_` or `github_pat_` prefix)
2. `GET /user` called to confirm the token is active and authorised
3. Invalid tokens are rejected before saving

### Deployment Security

| Scenario | Recommendation |
|----------|---------------|
| Personal use | Token entered via UI, stored in `localStorage` |
| Public GitHub Pages | Use a private data repository |
| Team / production | Use a serverless function (Vercel/Netlify) as a proxy; store token in env vars |

---

## 📚 API Reference

### `TokenManager` (static class)

| Method | Description |
|--------|-------------|
| `getToken()` | Retrieve token from `localStorage` |
| `saveToken(token)` | Save trimmed token to `localStorage` |
| `clearToken()` | Remove token from `localStorage` |
| `promptForToken(message?)` | Show browser prompt for user input |
| `isValidTokenFormat(token)` | Check `ghp_` / `github_pat_` prefix |

### `GitHubAPIClient`

| Method | Description |
|--------|-------------|
| `initializeToken()` | Load, validate, and prompt for token on startup |
| `validateToken()` | `GET /user` to verify the token |
| `getFile(year, month, type)` | Fetch and decode a JSON data file |
| `updateFile(year, month, type, content, message)` | Encode and PUT a JSON data file |
| `getCategoryFile()` | Fetch and decode `data/category.json` |
| `updateCategoryFile(content, message)` | Encode and PUT `data/category.json` |
| `checkExists(path)` | Check if a path exists (200 vs 404) |
| `createFolderStructure(year, month)` | Create a `.gitkeep` for a new month folder |

### `GitHubDataManager`

| Method | Description |
|--------|-------------|
| `loadMonthData(year, month)` | Load both `income.json` and `expenses.json` in parallel |
| `getMonthTransactions(year, month)` | Return cached income + expenses arrays |
| `addTransaction(transaction, type)` | Validate, add, and commit to GitHub |
| `updateTransaction(id, updates)` | Find by ID, update, handle cross-month move |
| `deleteTransaction(id)` | Find by ID, remove, commit to GitHub |
| `findTransaction(id)` | Search across all loaded months |
| `calculateMonthlySummary(year, month)` | Return `{ totalIncome, totalExpenses, balance, transactionCount }` |
| `getAllTransactionsForMonth(year, month)` | Combined sorted list with `type` field added |
| `refreshMonth(year, month)` | Force re-fetch from GitHub (bypass cache) |
| `generateId(type, year, month)` | Generate unique transaction ID |
| `validateTransaction(data, year, month)` | Validate fields and date match |

---

## 📝 Example Workflows

### Add a Transaction
1. Open the app → select month **April 2026**
2. Choose type: **Expense**
3. Date: `2026-04-05`, Description: `Groceries`, Category: `Grocery`, Amount: `1500`
4. Click **Add Transaction**
5. ✅ Committed to `data/2026/04/expenses.json` with message `Add expense: Groceries (₹1500)`

### Move a Transaction to a Different Month
1. Click ✏️ on a transaction dated `2026-04-15`
2. Change date to `2026-05-01`
3. Click **Update Transaction**
4. ✅ Removed from `data/2026/04/expenses.json`
5. ✅ Added to `data/2026/05/expenses.json` (file created if it didn't exist)

### Add a New Category
1. In the form, select type: **Expense**
2. Open the Category dropdown → select **+ Add New Category**
3. Enter: `Subscriptions`
4. ✅ `data/category.json` updated with commit message `Add new expense category: Subscriptions`
5. The new category is selected automatically

---

## 🐛 Troubleshooting

| Error | Cause | Solution |
|-------|-------|---------|
| `Failed to fetch` | No internet or repo unreachable | Check connection, verify repo name and owner |
| `404 Not Found` | Wrong repo name, owner, or branch | Double-check `GITHUB_CONFIG` values |
| `403 Forbidden` | Token expired or missing `repo` scope | Generate a new token with correct scope |
| `401 Unauthorized` | Invalid token | Re-enter token via the 🔑 settings modal |
| CORS error | Unusual network/proxy setup | GitHub API supports CORS; use a serverless proxy if needed |
| Rate limit exceeded | >5,000 API calls/hour | Wait for reset; SHA caching reduces calls significantly |
| `GitHubAPIClient is not defined` | Script load order wrong | Ensure `github-api.js` loads before `script.js` |
| `Chart is not defined` | Chart.js not loaded | Ensure Chart.js CDN tag appears before `reports.js` |

---

## 🎉 Summary

Ledgerly gives you a fully functional personal finance tracker that:
- ✅ Requires zero backend setup
- ✅ Stores all data in your GitHub repository
- ✅ Provides a complete audit trail via Git commit history
- ✅ Works from any browser, any device
- ✅ Supports categories, filtering, sorting, and analytics charts

**Start tracking your finances with Ledgerly!** 💰
