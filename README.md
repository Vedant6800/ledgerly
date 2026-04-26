# 💰 Ledgerly - Personal Finance Tracker

A beautiful, minimalist monthly income and expense ledger that uses **GitHub as a cloud backend**. No server required — all data is stored as JSON files directly in your GitHub repository, synced in real-time via the GitHub REST API.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![GitHub](https://img.shields.io/badge/storage-GitHub-black.svg)
![No Backend](https://img.shields.io/badge/no%20backend-required-brightgreen.svg)

---

## ✨ Features

### 💎 Core Functionality
- **📊 Monthly Financial Tracking** — Separate income and expense tracking by month/year
- **☁️ GitHub Cloud Storage** — All data stored securely in your GitHub repository as JSON files
- **🔐 Secure Authentication** — GitHub Personal Access Token with `localStorage` management
- **🔄 Queue-Based Auto-Sync** — Transactions committed sequentially to GitHub; no race conditions even during rapid input
- **📱 Responsive Design** — Works seamlessly on desktop, tablet, and mobile
- **🌓 Dark/Light Theme** — Toggleable theme with `prefers-color-scheme` detection and persistent preference

### 🧾 Transaction Management
- ✅ Add income and expense transactions with date, description, category, and amount
- ✅ Edit transactions — updates in-place with `updatedAt` timestamp
- ✅ Delete transactions — removes from GitHub with a descriptive commit
- ✅ **Cross-month editing** — changing a transaction's date to a different month automatically moves it between month files
- ✅ Real-time balance calculation (Income − Expenses)
- ✅ Transactions sorted by date (newest first) after every change

### ⚡ Transaction Queue System
Ledgerly uses a **FIFO (First-In-First-Out) queue** to prevent GitHub API race conditions when transactions are submitted quickly:

- **Non-blocking UI** — The form resets immediately after submission so you can keep adding transactions while previous ones sync in the background
- **Sequential processing** — Only one GitHub API call runs at a time; subsequent submissions wait safely in the queue
- **Double-click guard** — A 350ms debounce lock prevents accidentally queuing the same transaction twice
- **Queue status badge** — A subtle animated spinner appears below the form showing *"Syncing to GitHub… (2 more queued)"* so you always know what's happening
- **Error recovery** — If a single transaction fails, the error is shown non-intrusively for 6 seconds and the queue continues processing the remaining items automatically

**Queue architecture:**
```
Submit form → enqueueTransaction() → txnQueue[] (FIFO)
                                          ↓
                                    processQueue() ← isProcessing lock
                                          ↓
                                  executeSingleTransaction()
                                          ↓
                                  GitHub API commit → render()
                                          ↓
                              setTimeout(processQueue, 0)  ← loop
```

### 🏷️ Category System
- ✅ Separate category lists for income and expenses
- ✅ Categories stored in `data/category.json` on GitHub
- ✅ Add new categories on-the-fly directly from the transaction form
- ✅ Duplicate category detection (case-insensitive)
- ✅ Categories auto-sorted alphabetically after each addition
- ✅ Category dropdown updates dynamically when switching between Income/Expense type

**Default Income Categories:** Salary, FD/RD, Received from someone, Others

**Default Expense Categories:** Rent, Food, Grocery, Transportation, Healthcare, Entertainment, Clothing, Education, Utilities, Travel, Personal Care, Gifts, Online Shopping, Dining Out, Investment, EMI, Family Support, Given at Home, Miscellaneous, Return Taken Money

### 🔍 Search, Filter & Sort

#### Context-Aware Search Bar
A powerful search bar with a **field selector dropdown** that intelligently adapts the input based on what you're searching:

| Field selected | Input type | Behaviour |
|---|---|---|
| **All Fields** | Text | Case-insensitive substring match across description, category, date, and amount |
| **Description** | Text | Matches any transaction whose description contains the query |
| **Category** | Text | Matches any transaction whose category contains the query |
| **Amount (₹)** | Number | Native number spinner; exact match with ±0.01 float tolerance |
| **Date** | Date picker | Native date picker; exact date match |
| **Duration** | Two date pickers | Filters to a date range — *From* date → *To* date |

**Duration range picker** — when "Duration" is selected, two native date pickers appear (From / To). Supports open-ended ranges: set only "From" to see everything from that date onwards, set only "To" to see everything up to that date.

**Additional search UX features:**
- Live filtering with a 200ms debounce — results update as you type with no lag
- **× clear button** — appears inside the input the moment you type; clears everything and restores all transactions
- **Match count badge** — shows *"5 matches"* when a search is active; turns red "No matches" when nothing is found
- **Escape key** — clears the search from the keyboard
- Switching fields automatically clears any stale query so stale values never cross over between field types
- Subtle gold row highlight on matched transactions

#### Type Filter
- Filter transactions by **Both** | **Income only** | **Expense only**

#### Column Sort
- Sort by **Date** | **Amount** | **Description**
- Toggle ascending/descending per sort field with directional arrow indicators (↑/↓)
- All three controls (search + type filter + sort) work simultaneously in the pipeline:  
  `type filter → search filter → sort`

### 📈 Reports & Analytics Dashboard (`reports.html`)
- ✅ **Monthly Summary** — Total income, total expenses, and net balance
- ✅ **Expense Ratio Indicator** — Expenses as % of income with colour-coded status:
  - 🟢 ≤50%: Healthy — Great savings rate!
  - 🟡 ≤80%: Moderate — Watch your spending
  - 🔴 >80%: Risky — Expenses too high!
- ✅ **Month-to-Month Comparison** — % change in income and expenses vs previous month (with 📈/📉 indicators, colour-coded appropriately)
- ✅ **Income vs Expenses Chart** — Bar or Pie (switchable)
- ✅ **Income by Category Chart** — Bar or Pie — grouped and sorted by amount descending
- ✅ **Expenses by Category Chart** — Horizontal Bar or Pie — grouped and sorted by amount descending
- ✅ **Rich category tooltips** — Hovering over any bar or pie slice shows not just the category total but a full description-level breakdown:
  ```
  Clothing: ₹550.00

  ┌ Track pant: ₹350.00
  └ T-shirt: ₹200.00
  ```
  Items within each category are sorted highest-to-lowest. Pie slices also show the percentage of the grand total.
- ✅ Transactions without a category are shown as "Uncategorized" in charts

### 🔔 Friendly Error Messages
All GitHub API errors are translated into plain-English messages before being shown to the user. Raw technical strings like `"GitHub API error: 409 - data/2026/04/expenses.json does not match 030ea7ea..."` are never surfaced.

| HTTP Status | User-facing message |
|---|---|
| **409 Conflict** | *"A previous transaction is still being saved. Please wait a moment before adding the next one."* |
| 401 | *"Your GitHub token is invalid or has expired. Click the 🔑 icon to update it."* |
| 403 | *"Access denied. Make sure your token has the 'repo' scope."* |
| 404 | *"File or repository not found. Check owner/repo in GITHUB_CONFIG."* |
| 500/502/503 | *"GitHub is temporarily unavailable. Please try again in a few seconds."* |
| other | Cleaned-up fallback without raw API path/SHA dumps |

The raw technical message is still logged to the browser console for developer debugging.

### 🔑 Token Management
- ✅ Automatic token validation on app startup (via GitHub `/user` API)
- ✅ Prompts for token if missing or expired — no manual file editing needed
- ✅ Token format pre-validation (`ghp_` or `github_pat_` prefix check)
- ✅ Token Settings modal (🔑 button in header):
  - Real-time token status indicator (valid/invalid dot)
  - Show/Hide token visibility toggle
  - Update token with live validation before saving
  - Clear token with confirmation (reloads page)
- ✅ Token stored in `localStorage` under key `ledgerly_github_token`

### 🔄 GitHub Sync Details
Every operation creates a meaningful commit message:
| Operation | Commit Message |
|-----------|---------------|
| Add income | `Add income: Salary (₹50,000)` |
| Add expense | `Add expense: Groceries (₹1,500)` |
| Edit transaction | `Update income: Freelance Payment` |
| Delete transaction | `Delete expense: Rent (₹25,000)` |
| Move to new month | `Move income transaction to 2026/02` |
| Add new category | `Add new expense category: Travel` |
| Initialize month | `Initialize income.json for 2026/04` |
| Create folder | `Create folder structure for 2026/04` |

### 🛡️ Input Validation
- Amount must be a positive number
- Date must be in `YYYY-MM-DD` format
- Date must belong to the currently selected month
- Description is required
- Transaction IDs are globally unique (`inc_`/`exp_` + year + month + timestamp + random)

---

## 🚀 Quick Start

### Prerequisites
- A GitHub account
- A web browser (Chrome, Firefox, Safari, or Edge)
- A GitHub Personal Access Token

### Installation

1. **Clone or Download**
   ```bash
   git clone https://github.com/Vedant6800/ledgerly.git
   cd ledgerly
   ```

2. **Create a Data Repository on GitHub**
   - Create a new repository (e.g., `ledgerly-data`) — public or private both work
   - No need to initialize with README

3. **Configure the App**
   - Open `github-api.js` and update:
     ```javascript
     const GITHUB_CONFIG = {
         owner: 'YOUR_GITHUB_USERNAME',
         repo: 'YOUR_REPOSITORY_NAME',
         branch: 'main',
         token: '',        // Managed via UI — do not hardcode
         basePath: 'data'  // Base folder in repo
     };
     ```

4. **Generate a GitHub Personal Access Token**
   - Go to [GitHub Settings → Tokens (classic)](https://github.com/settings/tokens)
   - Click "Generate new token (classic)"
   - Note: `Ledgerly App`
   - Scope: ✓ **repo** (Full control of private repositories)
   - Click "Generate token" and copy it (starts with `ghp_` or `github_pat_`)

5. **Launch the App**
   - Open `index.html` in a browser (or use VS Code Live Server)
   - Enter your GitHub token when prompted
   - The app validates the token, saves it, and loads your data

---

## 📖 Usage Guide

### Adding a Transaction
1. Select the date using the date picker
2. Click **Income** or **Expenses** to set the type
3. Enter a description (e.g., "Salary", "Groceries")
4. Select a category from the dropdown (optional)
5. Enter the amount
6. Click **Add Transaction** — the transaction is queued, the form clears immediately, and GitHub sync happens in the background

### Adding Multiple Transactions Quickly
You can submit transactions back-to-back without waiting. Each submission enters the queue, the form resets instantly, and the queue badge keeps you informed:
> *"Syncing to GitHub… (2 more queued)"*

### Editing a Transaction
1. Click ✏️ on any row in the transaction list
2. Modify any field (including the date — even to a different month!)
3. Click **Update Transaction**
4. Click **Cancel** to discard changes

### Deleting a Transaction
1. Click ❌ on any transaction row
2. Confirm deletion — removes from GitHub immediately

### Adding a New Category
1. In the transaction form, switch to the desired type (Income/Expense)
2. Open the Category dropdown and select **+ Add New Category**
3. Enter the category name in the prompt
4. The category is saved to `data/category.json` on GitHub and selected automatically

### Searching Transactions
1. Use the **Search:** field selector to pick what to search by
2. The input transforms to match the field type:
   - **Text fields** — just start typing; results filter in real time
   - **Amount** — enter a number; finds exact matches
   - **Date** — a date picker opens; picks exactly one day
   - **Duration** — two date pickers appear (From → To); shows all transactions in that range
3. Click **×** or press `Escape` to clear the search

### Filtering & Sorting Transactions
- Use the **Show** buttons to filter: Both / Income / Expenses
- Use the **Sort by** buttons to sort by: Date / Amount / Description
- Click the same sort button again to reverse order (↑/↓)
- Search, filter, and sort all apply simultaneously

### Switching Months
- Use the month `<input type="month">` selector at the top
- Data is fetched from GitHub automatically when the month changes

### Managing Your GitHub Token
1. Click the 🔑 button in the header
2. View live token validity status
3. Toggle visibility, update, or clear your token

### Viewing Reports
- Click the 📊 button in the header (or navigate to `reports.html`)
- Select a month to view analytics for that period
- **Hover over any bar or pie slice** in the Expenses by Category chart to see a breakdown by individual transaction (description + amount)
- Toggle between Bar Chart and Pie Chart views for each graph

---

## 🏗️ Project Structure

```
ledgerly/
├── index.html          # Main ledger page
├── styles.css          # Global styles — light & dark themes, responsive layout
├── script.js           # Main app logic (Ledgerly class) — CRUD, queue, search, filter, sort
├── github-api.js       # GitHub API integration (GitHubAPIClient, GitHubDataManager, TokenManager)
├── reports.html        # Financial analytics dashboard
├── reports.js          # Reports logic (LedgerlyReports class) — charts, comparisons
├── reports.css         # Reports-specific styles
├── GITHUB_SETUP.md     # Detailed GitHub setup & API reference
└── data/               # Created automatically in your GitHub repository
    ├── category.json   # Income & expense categories
    └── YYYY/           # Year folders
        └── MM/         # Month folders (zero-padded: 01–12)
            ├── income.json
            └── expenses.json
```

---

## 💾 Data Structure

### Repository Layout (Auto-Created)
```
your-repo/
└── data/
    ├── category.json
    ├── 2025/
    │   └── MM/
    │       ├── income.json
    │       └── expenses.json
    └── 2026/
        └── MM/
            ├── income.json
            └── expenses.json
```

### Transaction JSON Format
```json
[
  {
    "id": "inc_2026011737012345678",
    "date": "2026-01-03",
    "description": "Monthly Salary",
    "amount": 50000,
    "category": "Salary",
    "createdAt": "2026-01-03T10:30:00.000Z",
    "updatedAt": "2026-01-03T10:30:00.000Z"
  }
]
```

> **Note:** `category` is an optional field. Transactions without a category are displayed as "Uncategorized" in charts.

### Transaction ID Format
- **Income:** `inc_[year][month][timestamp][random]`
- **Expense:** `exp_[year][month][timestamp][random]`

### Category File (`data/category.json`)
```json
{
  "income": ["FD/RD", "Others", "Salary"],
  "expenses": ["Clothing", "Education", "Food", "Rent", "Travel"]
}
```

---

## 🎨 Features in Detail

### 🌓 Theme System

**Light Theme:**
- Warm beige background (`#FCF6D9`)
- Soft blue accents (`#9CC6DB`)
- Gold highlights (`#DDBA7D`)

**Dark Theme:**
- Deep navy background (`#1a1f2e`)
- Cool blue accents (`#9CC6DB`)
- High contrast for readability

Theme is detected from `prefers-color-scheme` on first load, then persisted to `localStorage` under `ledgerly-theme`.

### 📊 Monthly Summary Cards
Three summary cards always visible on the main page:
- **Total Income** — Sum of all income transactions for the month
- **Total Expenses** — Sum of all expense transactions for the month
- **Balance** — Income minus Expenses (green if positive, red if negative)

### ⚡ Performance & Caching
- **In-memory data cache** — Month data loaded from GitHub once per session and cached; no redundant API calls
- **SHA caching** — GitHub file SHAs are cached in a `Map` to avoid extra GET requests before every PUT
- **Parallel fetching** — `income.json` and `expenses.json` for a month are fetched in parallel using `Promise.all`
- **Duplicate load prevention** — Concurrent load requests for the same month are de-duplicated with a `loadingStates` map
- **Browser yield between commits** — `processQueue` uses `setTimeout(0)` between items so the UI stays responsive even during a long queue flush

### 🔧 Cross-Month Transaction Move
When editing a transaction, if the date is changed to a different month:
1. The transaction is removed from the old month's JSON file
2. The transaction is added to the new month's JSON file
3. Both GitHub files are updated in parallel via `Promise.all`

---

## ⚙️ Configuration

### `github-api.js` Config Object
```javascript
const GITHUB_CONFIG = {
    owner: 'YOUR_USERNAME',   // Your GitHub username
    repo: 'YOUR_REPO',        // Repository name (for data storage)
    branch: 'main',           // Branch name
    token: '',                // Leave empty — managed via UI
    basePath: 'data'          // Base folder in the repo
};
```

### LocalStorage Keys
| Key | Purpose |
|-----|---------|
| `ledgerly_github_token` | GitHub Personal Access Token |
| `ledgerly-theme` | Theme preference (`light` or `dark`) |

---

## 🛠️ Technical Details

### Technologies Used
| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JavaScript (ES6+, Classes) |
| Styling | Pure CSS with CSS Custom Properties |
| Storage | GitHub REST API v3 (Contents API) |
| Authentication | GitHub Personal Access Tokens |
| Data Format | JSON (base64-encoded in API) |
| Charts | Chart.js 4.4.1 (CDN) |

### Core Classes
| Class | File | Responsibility |
|-------|------|---------------|
| `TokenManager` | `github-api.js` | Token storage, validation, prompting |
| `GitHubAPIClient` | `github-api.js` | Raw GitHub REST API calls, SHA caching, friendly error translation |
| `GitHubDataManager` | `github-api.js` | Business logic: CRUD, validation, in-memory cache |
| `Ledgerly` | `script.js` | Main app: UI, forms, queue, rendering, search, sorting, filtering |
| `LedgerlyReports` | `reports.js` | Analytics: charts, metric calculations, tooltip breakdowns |

### Key Methods — Search System
| Method | Purpose |
|--------|---------|
| `handleSearchFieldChange()` | Swaps input type/placeholder, shows/hides duration pickers, clears stale query |
| `applySearchFilter(txns)` | Field-aware filter: substring / exact / ±0.01 amount / date range |
| `hasActiveSearch()` | Returns `true` if single input has text OR duration pickers have a date |
| `updateSearchUI()` | Syncs gold border, × button, date input states with current query |
| `updateSearchResultCount(n)` | Shows/hides match count badge; red tint when 0 |
| `clearSearch()` | Resets everything: both inputs, both clear buttons, count badge |

### Key Methods — Queue System
| Method | Purpose |
|--------|---------|
| `enqueueTransaction(req)` | Pushes a self-contained request object onto `txnQueue[]` |
| `processQueue()` | Sequential processor; `isProcessing` lock prevents concurrency |
| `executeSingleTransaction(req)` | Dispatches a single add/update to `GitHubDataManager` |
| `showTransactionError(msg)` | Non-blocking error badge with 6s auto-dismiss |
| `friendlyErrorMessage(raw)` | Translates raw API error strings to plain English |
| `updateQueueUI()` | Refreshes the queue status badge and submit button state |

### API Endpoints Used
| Method | Endpoint | Purpose |
|--------|----------|---------||
| `GET` | `/user` | Token validation |
| `GET` | `/repos/{owner}/{repo}/contents/{path}` | Fetch JSON data files |
| `PUT` | `/repos/{owner}/{repo}/contents/{path}` | Create or update JSON data files |

### Browser Compatibility
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Opera 76+

### GitHub API Rate Limits (Authenticated)
- **5,000 requests/hour** per token
- Sufficient for normal personal use
- SHA caching and in-memory caching minimise unnecessary API calls

---

## 📱 Responsive Design

### Breakpoints
| Breakpoint | Range |
|-----------|-------|
| Desktop | 1024px and above |
| Tablet | 768px – 1023px |
| Mobile | 480px – 767px |
| Small Mobile | Below 480px |

### Mobile Optimisations
- Touch-friendly minimum button size (48px)
- Hidden date column on small screens
- Full-width forms and buttons
- Duration pickers stack vertically with rotated separator arrow
- Search bar collapses to full-width single column

---

## 🔒 Security & Privacy

### ✅ Best Practices
- ✓ Token never committed to the repository — entered via UI only
- ✓ Token validated against GitHub API before saving
- ✓ Token format pre-checked (`ghp_` / `github_pat_` prefix)
- ✓ Set token expiration (90 days recommended)
- ✓ Use minimal permissions (only `repo` scope needed)
- ✓ Clear browser data when using shared computers
- ✓ All data sent only to `api.github.com` — no third-party services

### ⚠️ Important Notes
- Tokens are stored in the browser's `localStorage` (per device/browser)
- Each browser/device needs its own token entry
- Clearing browser data will remove the stored token
- Private repositories are recommended for sensitive financial data

### 🌐 Deployment Options
| Option | Description |
|--------|-------------|
| **GitHub Pages** | Push to repo → Settings → Pages → Enable |
| **VS Code Live Server** | Right-click `index.html` → Open with Live Server |
| **Vercel / Netlify** | Drop the folder — static site hosting |

---

## 🐛 Troubleshooting

### Token Issues
| Problem | Solution |
|---------|---------|
| "Token is invalid or expired" | Click 🔑 → Update Token → Enter new token |
| "401 Unauthorized" | Generate new token with `repo` scope |
| Token prompt keeps appearing | Verify token has correct permissions and hasn't expired |

### Data / Sync Issues
| Problem | Solution |
|---------|---------|
| "Still saving… Please wait" badge | A 409 conflict occurred — the queue will auto-retry on next submission; wait a moment |
| "No transactions for this month" | Files are created automatically on first transaction |
| "Error loading data from GitHub" | Check internet connection and repository access |
| Changes not syncing | Check GitHub repository for recent commits |
| `404 Not Found` | Verify `owner` and `repo` in `GITHUB_CONFIG` |
| `403 Forbidden` | Token may be expired or missing `repo` scope |
| Rate limit exceeded | Wait for reset (shown in error message) |
| CORS error | GitHub API supports CORS; if persistent, use a serverless proxy |

### Search Issues
| Problem | Solution |
|---------|---------|
| Duration filter shows no results | Check that transactions exist for the selected month and date range |
| Amount search returns nothing | Amounts are matched exactly (±0.01); ensure the number matches the stored value |
| Search not clearing | Click the × button or press Escape |

### Code Issues
| Error | Solution |
|-------|---------|
| `GitHubAPIClient is not defined` | Ensure `github-api.js` loads before `script.js` in `index.html` |
| `Chart is not defined` | Ensure Chart.js CDN loads before `reports.js` in `reports.html` |

---

## 🤝 Contributing

Contributions are welcome!

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Guidelines
- Follow existing code style (ES6 classes, clear method names)
- Add JSDoc comments for new public methods
- Test on both light and dark themes
- Test on mobile viewport
- Update this README if adding new features

---

## 📝 Changelog

### Version 2.0.0 (April 2026)
- ⚡ **Transaction Queue System** — FIFO queue with `isProcessing` lock; prevents race conditions when adding transactions rapidly
- 🔔 **Queue Status Badge** — Animated spinner below the form showing queue depth and current sync progress
- 🛡️ **Friendly Error Messages** — `buildApiError()` translates HTTP 409/401/403/404/5xx into plain-English user messages; raw API strings never reach the UI
- 🔍 **Context-Aware Search Bar** — Field selector dropdown (All Fields / Description / Category / Amount / Date / Duration) with adaptive input types
- 📅 **Duration Range Filter** — From/To date pickers; supports open-ended ranges (from-only or to-only)
- 📊 **Rich Category Tooltips** — Expense chart tooltips now show a full description-level breakdown (e.g., Clothing: ₹550 → Track pant ₹350, T-shirt ₹200)
- 🗑️ **Removed Rolling 3-Month Average** — Section removed from the reports dashboard
- 🐛 Double-click debounce guard on submit button (350ms)

### Version 1.0.0 (January 2026)
- ✨ Initial release
- 🔐 GitHub token management with `localStorage` and live validation
- 📊 Monthly income/expense tracking with GitHub sync
- 🏷️ Category system with add-new-category support
- 🔍 Filter transactions by type (Both / Income / Expense)
- ↕️ Sort transactions by Date, Amount, or Description (asc/desc toggle)
- 🔀 Cross-month transaction move when editing date
- 📈 Reports dashboard with Chart.js:
  - Income vs Expenses (Bar/Pie)
  - Income by Category (Bar/Pie)
  - Expenses by Category (Horizontal Bar/Pie)
  - Expense Ratio Indicator
  - Month-to-Month Comparison
- 🌓 Dark/Light theme with `prefers-color-scheme` detection
- 📱 Responsive design across all screen sizes
- ⚡ In-memory caching and parallel data loading

---

## 🗺️ Roadmap

Future enhancements being considered:

- [ ] Export data to CSV / Excel
- [ ] Budget setting with alerts when approaching limits
- [ ] Recurring / scheduled transactions
- [ ] Multi-year overview charts
- [ ] Backup and restore features
- [ ] Multi-currency support
- [ ] Mobile PWA version
- [ ] Multiple repository support
- [x] ~~Search and text filter within transactions~~ ✅ Done in v2.0.0
- [x] ~~Race condition prevention for rapid submissions~~ ✅ Done in v2.0.0

---

## 📄 License

This project is licensed under the MIT License.

```
MIT License

Copyright (c) 2026 Vedant Nogja

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 👨‍💻 Author

**Vedant Nogja**
- GitHub: [@Vedant6800](https://github.com/Vedant6800)
- Project: [Ledgerly](https://github.com/Vedant6800/ledgerly)

---

## 🙏 Acknowledgments

- [GitHub REST API](https://docs.github.com/en/rest) for excellent documentation
- [Chart.js](https://www.chartjs.org/) for the beautiful, responsive charts
- The open-source community for inspiration

---

<div align="center">

**Made with ❤️ by Vedant Nogja**

*Track your finances, one transaction at a time.*

[⬆ Back to Top](#-ledgerly---personal-finance-tracker)

</div>
