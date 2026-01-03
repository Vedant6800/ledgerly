# 💰 Ledgerly - Personal Finance Tracker

A beautiful, minimalist monthly income and expense ledger that uses GitHub as a backend storage solution. Track your finances with a clean interface and automatic cloud sync via GitHub API.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![GitHub](https://img.shields.io/badge/storage-GitHub-black.svg)

---

## ✨ Features

### 💎 Core Functionality
- **📊 Monthly Financial Tracking** - Separate income and expense tracking by month
- **☁️ GitHub Cloud Storage** - All data stored securely in your GitHub repository
- **🔐 Secure Authentication** - GitHub Personal Access Token with localStorage management
- **💾 Auto-Sync** - Automatic synchronization with GitHub on every change
- **📱 Responsive Design** - Works seamlessly on desktop, tablet, and mobile
- **🌓 Dark/Light Theme** - Toggleable theme with persistent preference

### 🎯 Key Features
- ✅ Add, edit, and delete transactions
- ✅ Real-time balance calculation
- ✅ Monthly summary cards (Income, Expenses, Balance)
- ✅ Transaction history with sorting by date
- ✅ Smart token management with validation
- ✅ User-friendly token settings modal
- ✅ Visual status indicators for token validity
- ✅ Automatic folder structure creation
- ✅ Commit messages for every transaction

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

2. **Set Up GitHub Repository**
   - Create a new repository on GitHub (e.g., `ledgerly-data`)
   - Can be public or private
   - No need to initialize with README

3. **Configure the App**
   - Open `github-api.js`
   - Update the configuration:
     ```javascript
     const GITHUB_CONFIG = {
         owner: 'YOUR_GITHUB_USERNAME',
         repo: 'YOUR_REPOSITORY_NAME',
         branch: 'main',
         token: '',  // Will be set via UI
         basePath: 'data'
     };
     ```

4. **Generate GitHub Token**
   - Go to [GitHub Settings → Tokens](https://github.com/settings/tokens)
   - Click "Generate new token (classic)"
   - Set a note: `Ledgerly App`
   - Select scope: ✓ **repo** (Full control of private repositories)
   - Click "Generate token"
   - Copy the token (starts with `ghp_` or `github_pat_`)

5. **Launch the App**
   - Open `index.html` in your web browser
   - Enter your GitHub token when prompted
   - Start tracking your finances!

---

## 📖 Usage Guide

### First Time Setup

1. **Open the app** - Launch `index.html` in your browser
2. **Enter token** - A prompt will ask for your GitHub Personal Access Token
3. **Paste and submit** - The token will be validated and saved to localStorage
4. **Start tracking** - Begin adding your income and expenses!

### Adding Transactions

1. **Select the date** using the date picker
2. **Choose type** - Click "Income" or "Expense" button
3. **Enter description** - e.g., "Salary", "Groceries", "Rent"
4. **Enter amount** - Positive numbers only
5. **Click "Add Transaction"** - Syncs immediately to GitHub

### Editing Transactions

1. **Click the edit icon** (✏️) on any transaction
2. **Modify the fields** as needed
3. **Click "Update Transaction"** to save changes

### Deleting Transactions

1. **Click the delete icon** (❌) on any transaction
2. **Confirm deletion** in the popup
3. Transaction is removed from GitHub immediately

### Managing GitHub Token

1. **Click the 🔑 key icon** in the header
2. **View token status** - See if your token is valid
3. **Show/Hide token** - Toggle visibility
4. **Update token** - Replace with a new token
5. **Clear token** - Remove and re-authenticate

### Switching Months

- Use the **month selector** dropdown to view different months
- Data is loaded automatically from GitHub
- Create new months by adding transactions with dates in that month

---

## 🏗️ Project Structure

```
ledgerly/
├── index.html              # Main HTML structure
├── styles.css              # All styling (light & dark themes)
├── script.js               # Main app logic & UI handling
├── github-api.js           # GitHub API integration & data management
├── GITHUB_SETUP.md         # GitHub integration setup guide
├── TOKEN_SETUP_INSTRUCTIONS.md  # Token generation guide
├── TOKEN_MANAGEMENT_README.md   # Token management documentation
└── data/                   # Created in GitHub repository
    └── YYYY/               # Year folders
        └── MM/             # Month folders
            ├── income.json
            └── expenses.json
```

---

## 💾 Data Structure

### Repository Structure (Created Automatically)
```
your-repo/
└── data/
    ├── 2026/
    │   ├── 01/
    │   │   ├── income.json
    │   │   └── expenses.json
    │   ├── 02/
    │   │   ├── income.json
    │   │   └── expenses.json
    │   └── ...
    └── 2027/
        └── ...
```

### Transaction JSON Format
```json
[
  {
    "id": "inc_2026011737012345678",
    "date": "2026-01-03",
    "description": "Monthly Salary",
    "amount": 50000,
    "createdAt": "2026-01-03T10:30:00.000Z",
    "updatedAt": "2026-01-03T10:30:00.000Z"
  }
]
```

### Transaction ID Format
- **Income:** `inc_[year][month][timestamp][random]`
- **Expense:** `exp_[year][month][timestamp][random]`

---

## 🎨 Features in Detail

### 🔐 Token Management System

**Smart localStorage Integration:**
- Token stored securely in browser's localStorage
- Automatic validation on app startup
- Detects expired/invalid tokens
- Prompts for new token when needed
- No manual code editing required

**Token Settings Modal:**
- Real-time token status indicator
- Show/hide token visibility
- One-click token update
- Clear token with confirmation
- Step-by-step token generation guide

### 📊 Monthly Summary

Displays three key metrics:
- **Total Income** - Sum of all income for the month
- **Total Expenses** - Sum of all expenses for the month
- **Balance** - Income minus expenses (color-coded)

### 🎨 Theme System

**Light Theme:**
- Warm beige background (#FCF6D9)
- Soft blue accents (#9CC6DB)
- Gold highlights (#DDBA7D)

**Dark Theme:**
- Deep navy background (#1a1f2e)
- Cool blue accents (#9CC6DB)
- High contrast for readability

### 🔄 Auto-Sync with GitHub

Every transaction operation creates a meaningful commit:
- ✅ `Add income: Salary (₹50000)`
- ✏️ `Update expense: Groceries`
- ❌ `Delete income: Bonus (₹5000)`
- 📦 `Initialize income.json for 2026/01`

---

## ⚙️ Configuration

### GitHub Configuration (`github-api.js`)

```javascript
const GITHUB_CONFIG = {
    owner: 'YOUR_USERNAME',     // Your GitHub username
    repo: 'YOUR_REPO',          // Repository name
    branch: 'main',             // Branch name
    token: '',                  // Managed via UI
    basePath: 'data'            // Base folder in repo
};
```

### LocalStorage Keys

- `ledgerly_github_token` - GitHub Personal Access Token
- `ledgerly-theme` - Theme preference (light/dark)

---

## 🔒 Security & Privacy

### ✅ Best Practices

- ✓ **Never commit tokens** to public repositories
- ✓ **Set token expiration** (90 days recommended)
- ✓ **Use minimal permissions** (only `repo` scope needed)
- ✓ **Rotate tokens regularly** for better security
- ✓ **Clear browser data** when using shared computers

### ⚠️ Important Notes

- Tokens are stored in browser's localStorage (per-browser)
- Each browser/device needs its own token entry
- Clearing browser data will remove the stored token
- Private repositories recommended for sensitive data
- Token is sent to GitHub API only (no third-party services)

---

## 🛠️ Technical Details

### Technologies Used

- **Frontend:** Vanilla JavaScript (ES6+)
- **Styling:** Pure CSS with CSS Variables
- **Storage:** GitHub REST API v3
- **Authentication:** GitHub Personal Access Tokens
- **Data Format:** JSON

### Browser Compatibility

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Opera 76+

### API Rate Limits

GitHub API rate limits (authenticated):
- **5,000 requests per hour** per token
- Sufficient for normal personal use
- Rate limit info available in response headers

---

## 📱 Responsive Design

### Breakpoints

- **Desktop:** 1024px and above
- **Tablet:** 768px - 1023px
- **Mobile:** 480px - 767px
- **Small Mobile:** Below 480px

### Mobile Optimizations

- Touch-friendly buttons (48px minimum)
- Simplified table view (hidden date column on small screens)
- Full-width forms and buttons
- Optimized font sizes
- Collapsible sections

---

## 🐛 Troubleshooting

### Token Issues

**Problem:** "Token is invalid or expired"
- **Solution:** Click 🔑 button → Update Token → Enter new token

**Problem:** "401 Unauthorized" errors
- **Solution:** Generate new token with `repo` scope enabled

**Problem:** Token prompt keeps appearing
- **Solution:** Check token has correct permissions and hasn't expired

### Data Loading Issues

**Problem:** "No transactions for this month"
- **Solution:** Files will be created automatically when you add first transaction

**Problem:** "Error loading data from GitHub"
- **Solution:** Check internet connection and repository access

**Problem:** Changes not syncing
- **Solution:** Check GitHub repository for recent commits

### Common Errors

**Error:** `GitHubAPIClient is not defined`
- **Solution:** Ensure `github-api.js` is loaded before `script.js` in `index.html`

**Error:** `404 Not Found`
- **Solution:** Check repository name and owner in `GITHUB_CONFIG`

**Error:** Rate limit exceeded
- **Solution:** Wait for rate limit reset (shown in error message)

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines

- Follow existing code style
- Add comments for complex logic
- Test thoroughly before submitting
- Update documentation as needed

---

## 📝 Changelog

### Version 1.0.0 (January 2026)
- ✨ Initial release
- 🔐 GitHub token management with localStorage
- 📊 Monthly income/expense tracking
- 🎨 Dark/Light theme support
- 📱 Responsive design
- 🔄 Auto-sync with GitHub
- ✏️ CRUD operations for transactions
- 🔑 Token settings modal

---

## 📄 License

This project is licensed under the MIT License - see below for details:

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

- GitHub API for providing excellent documentation
- The open-source community for inspiration
- All contributors and users of Ledgerly

---

## 📞 Support

If you encounter any issues or have questions:

1. **Check Documentation:** Review this README and other docs
2. **Check Troubleshooting:** See common issues above
3. **GitHub Issues:** Open an issue on the repository
4. **Discussions:** Start a discussion for general questions

---

## 🗺️ Roadmap

Future enhancements being considered:

- [ ] Export data to CSV/Excel
- [ ] Category-based expense tracking
- [ ] Budget setting and alerts
- [ ] Charts and visualizations
- [ ] Multi-currency support
- [ ] Recurring transactions
- [ ] Search and filter functionality
- [ ] Backup and restore features
- [ ] Mobile app version
- [ ] Multiple repository support

---

## ⭐ Star History

If you find this project useful, please consider giving it a star on GitHub!

---

<div align="center">

**Made with ❤️ by Vedant Nogja**

*Track your finances, one transaction at a time.*

[⬆ Back to Top](#-ledgerly---personal-finance-tracker)

</div>

