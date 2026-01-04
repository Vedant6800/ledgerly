// ==========================================
// LEDGERLY REPORTS - FINANCIAL ANALYTICS
// ==========================================

class LedgerlyReports {
    constructor() {
        this.githubClient = null;
        this.dataManager = null;
        this.currentYear = '';
        this.currentMonth = '';
        this.theme = 'light';
        this.charts = {}; // Store chart instances
        this.chartTypes = {
            'income-expense': 'bar',
            'income-category': 'bar',
            'expense-category': 'bar'
        };
        this.init();
    }

    async init() {
        try {
            // Initialize GitHub API client
            this.githubClient = new GitHubAPIClient(GITHUB_CONFIG);

            // Initialize and validate token
            this.showLoading('Verifying GitHub authentication...');
            await this.githubClient.initializeToken();

            this.dataManager = new GitHubDataManager(this.githubClient);

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
                    'Please return to the home page to configure your GitHub token.'
                );
            } else {
                alert('Error initializing reports:\n\n' + error.message);
            }
        }
    }

    // Load current month data
    async loadCurrentMonth() {
        this.showLoading('Loading financial data from GitHub...');
        try {
            await this.dataManager.loadMonthData(this.currentYear, this.currentMonth);
            await this.generateReports();
        } catch (error) {
            console.error('Error loading month data:', error);
            alert('Error loading data from GitHub. Please check your connection.');
        } finally {
            this.hideLoading();
        }
    }

    // Generate all reports
    async generateReports() {
        // Get data using the correct method
        const summary = this.dataManager.calculateMonthlySummary(this.currentYear, this.currentMonth);
        const allTransactions = this.dataManager.getAllTransactionsForMonth(this.currentYear, this.currentMonth);

        // Separate income and expenses
        const incomeData = allTransactions.filter(t => t.type === 'income');
        const expenseData = allTransactions.filter(t => t.type === 'expense');

        // Calculate totals
        const totalIncome = summary.totalIncome;
        const totalExpenses = summary.totalExpenses;
        const balance = summary.balance;

        // Update summary cards
        this.updateSummaryCards(totalIncome, totalExpenses, balance);

        // Update expense ratio
        this.updateExpenseRatio(totalIncome, totalExpenses);

        // Update month-to-month comparison
        await this.updateMonthComparison();

        // Update rolling 3-month average
        await this.updateRollingAverage();

        // Generate charts
        this.generateIncomeExpenseChart(totalIncome, totalExpenses);
        this.generateIncomeCategoryChart(incomeData);
        this.generateExpenseCategoryChart(expenseData);
    }

    // Update summary cards
    updateSummaryCards(income, expenses, balance) {
        document.getElementById('total-income').textContent = this.formatCurrency(income);
        document.getElementById('total-expenses').textContent = this.formatCurrency(expenses);
        document.getElementById('balance').textContent = this.formatCurrency(balance);
    }

    // Update expense ratio indicator
    updateExpenseRatio(income, expenses) {
        const ratioValueEl = document.getElementById('expense-ratio-value');
        const ratioStatusEl = document.getElementById('expense-ratio-status');
        const ratioBarEl = document.getElementById('expense-ratio-bar');

        if (income === 0) {
            ratioValueEl.textContent = '--';
            ratioStatusEl.textContent = 'No income data available';
            ratioStatusEl.className = 'expense-ratio-status';
            ratioBarEl.style.width = '0%';
            return;
        }

        const ratio = (expenses / income) * 100;
        const cappedRatio = Math.min(ratio, 100); // Cap at 100% for display

        ratioValueEl.textContent = ratio.toFixed(1) + '%';
        ratioBarEl.style.width = cappedRatio + '%';

        // Determine status
        let status = '';
        let statusClass = '';

        if (ratio <= 50) {
            status = '✅ Healthy - Great savings rate!';
            statusClass = 'healthy';
        } else if (ratio <= 80) {
            status = '⚠️ Moderate - Watch your spending';
            statusClass = 'moderate';
        } else {
            status = '🚨 Risky - Expenses too high!';
            statusClass = 'risky';
        }

        ratioStatusEl.textContent = status;
        ratioStatusEl.className = 'expense-ratio-status ' + statusClass;
    }

    // Update month-to-month comparison
    async updateMonthComparison() {
        const incomeChangeEl = document.getElementById('income-change');
        const incomeChangeSubtextEl = document.getElementById('income-change-subtext');
        const expenseChangeEl = document.getElementById('expense-change');
        const expenseChangeSubtextEl = document.getElementById('expense-change-subtext');

        // Calculate previous month
        const currentDate = new Date(this.currentYear, parseInt(this.currentMonth) - 1, 1);
        const prevDate = new Date(currentDate);
        prevDate.setMonth(prevDate.getMonth() - 1);

        const prevYear = prevDate.getFullYear().toString();
        const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');

        try {
            // Load previous month data
            await this.dataManager.loadMonthData(prevYear, prevMonth);

            // Get summaries for both months
            const prevSummary = this.dataManager.calculateMonthlySummary(prevYear, prevMonth);
            const currentSummary = this.dataManager.calculateMonthlySummary(this.currentYear, this.currentMonth);

            const prevIncome = prevSummary.totalIncome;
            const prevExpenses = prevSummary.totalExpenses;
            const currentIncome = currentSummary.totalIncome;
            const currentExpenses = currentSummary.totalExpenses;

            // Calculate changes
            const incomeChange = this.calculatePercentageChange(prevIncome, currentIncome);
            const expenseChange = this.calculatePercentageChange(prevExpenses, currentExpenses);

            // Update income change
            this.updateComparisonCard(incomeChangeEl, incomeChangeSubtextEl, incomeChange, 'income');

            // Update expense change
            this.updateComparisonCard(expenseChangeEl, expenseChangeSubtextEl, expenseChange, 'expense');

        } catch (error) {
            console.log('Previous month data not available:', error);
            incomeChangeEl.textContent = '--';
            incomeChangeEl.className = 'comparison-value neutral';
            incomeChangeSubtextEl.textContent = 'No previous month data';

            expenseChangeEl.textContent = '--';
            expenseChangeEl.className = 'comparison-value neutral';
            expenseChangeSubtextEl.textContent = 'No previous month data';
        }
    }

    // Update comparison card
    updateComparisonCard(valueEl, subtextEl, change, type) {
        if (change === null) {
            valueEl.textContent = '--';
            valueEl.className = 'comparison-value neutral';
            subtextEl.textContent = 'No previous data';
            return;
        }

        const icon = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
        const sign = change > 0 ? '+' : '';
        valueEl.textContent = `${icon} ${sign}${change.toFixed(1)}%`;

        // For income: positive is good, for expenses: negative is good
        let className = 'comparison-value ';
        if (type === 'income') {
            className += change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
        } else {
            className += change < 0 ? 'positive' : change > 0 ? 'negative' : 'neutral';
        }

        valueEl.className = className;
        subtextEl.textContent = 'vs previous month';
    }

    // Calculate percentage change
    calculatePercentageChange(oldValue, newValue) {
        if (oldValue === 0 && newValue === 0) return 0;
        if (oldValue === 0) return null; // Can't calculate percentage
        return ((newValue - oldValue) / oldValue) * 100;
    }

    // Load month data for comparison (without updating current state)
    async loadMonthDataForComparison(year, month) {
        const incomeFile = await this.githubClient.getFile(year, month, 'income');
        const expenseFile = await this.githubClient.getFile(year, month, 'expenses');

        return {
            income: incomeFile.content || [],
            expenses: expenseFile.content || []
        };
    }

    // Update rolling 3-month average
    async updateRollingAverage() {
        const avgIncomeEl = document.getElementById('avg-income');
        const avgExpensesEl = document.getElementById('avg-expenses');
        const avgBurnRateEl = document.getElementById('avg-burn-rate');
        const rollingInfoEl = document.getElementById('rolling-info');

        try {
            // Get current month and two previous months
            const months = this.getLastNMonths(3);
            const monthsData = [];

            for (const month of months) {
                try {
                    const data = await this.loadMonthDataForComparison(month.year, month.month);
                    monthsData.push(data);
                } catch (error) {
                    console.log(`Month ${month.year}-${month.month} not available`);
                }
            }

            if (monthsData.length === 0) {
                avgIncomeEl.textContent = '₹0.00';
                avgExpensesEl.textContent = '₹0.00';
                avgBurnRateEl.textContent = '₹0.00/day';
                rollingInfoEl.textContent = 'No data available';
                return;
            }

            // Calculate averages
            let totalIncome = 0;
            let totalExpenses = 0;

            for (const data of monthsData) {
                totalIncome += data.income.reduce((sum, item) => sum + Number(item.amount), 0);
                totalExpenses += data.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
            }

            const avgIncome = totalIncome / monthsData.length;
            const avgExpenses = totalExpenses / monthsData.length;
            const avgBurnRate = avgExpenses / 30; // Approximate daily burn rate

            avgIncomeEl.textContent = this.formatCurrency(avgIncome);
            avgExpensesEl.textContent = this.formatCurrency(avgExpenses);
            avgBurnRateEl.textContent = this.formatCurrency(avgBurnRate) + '/day';

            rollingInfoEl.textContent = `Calculated from ${monthsData.length} month${monthsData.length > 1 ? 's' : ''}`;

        } catch (error) {
            console.error('Error calculating rolling average:', error);
            avgIncomeEl.textContent = '₹0.00';
            avgExpensesEl.textContent = '₹0.00';
            avgBurnRateEl.textContent = '₹0.00/day';
            rollingInfoEl.textContent = 'Error calculating averages';
        }
    }

    // Get last N months including current month
    getLastNMonths(n) {
        const months = [];
        const currentDate = new Date(this.currentYear, parseInt(this.currentMonth) - 1, 1);

        for (let i = 0; i < n; i++) {
            const date = new Date(currentDate);
            date.setMonth(date.getMonth() - i);
            months.push({
                year: date.getFullYear().toString(),
                month: String(date.getMonth() + 1).padStart(2, '0')
            });
        }

        return months;
    }

    // Generate Income vs Expense Chart
    generateIncomeExpenseChart(income, expenses) {
        const chartId = 'income-expense-chart';
        const chartType = this.chartTypes['income-expense'];

        // Destroy existing chart
        if (this.charts[chartId]) {
            this.charts[chartId].destroy();
        }

        const ctx = document.getElementById(chartId).getContext('2d');

        if (chartType === 'bar') {
            this.charts[chartId] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Income', 'Expenses'],
                    datasets: [{
                        label: 'Amount (₹)',
                        data: [income, expenses],
                        backgroundColor: [
                            'rgba(45, 122, 79, 0.7)',
                            'rgba(207, 75, 0, 0.7)'
                        ],
                        borderColor: [
                            'rgba(45, 122, 79, 1)',
                            'rgba(207, 75, 0, 1)'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        title: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => '₹' + value.toLocaleString('en-IN')
                            }
                        }
                    }
                }
            });
        } else {
            this.charts[chartId] = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: ['Income', 'Expenses'],
                    datasets: [{
                        data: [income, expenses],
                        backgroundColor: [
                            'rgba(45, 122, 79, 0.7)',
                            'rgba(207, 75, 0, 0.7)'
                        ],
                        borderColor: [
                            'rgba(45, 122, 79, 1)',
                            'rgba(207, 75, 0, 1)'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    return `${label}: ₹${value.toLocaleString('en-IN')}`;
                                }
                            }
                        }
                    }
                });
        }
    }

    // Generate Income Category Chart
    generateIncomeCategoryChart(incomeData) {
        const chartId = 'income-category-chart';
        const noDataEl = document.getElementById('income-category-no-data');
        const chartContainer = document.getElementById(chartId).parentElement;

        if (incomeData.length === 0) {
            chartContainer.style.display = 'none';
            noDataEl.style.display = 'block';
            return;
        }

        chartContainer.style.display = 'block';
        noDataEl.style.display = 'none';

        // Group by category
        const categoryTotals = this.groupByCategory(incomeData);
        const labels = Object.keys(categoryTotals);
        const data = Object.values(categoryTotals);
        const colors = this.generateColors(labels.length, 'income');

        // Destroy existing chart
        if (this.charts[chartId]) {
            this.charts[chartId].destroy();
        }

        const ctx = document.getElementById(chartId).getContext('2d');
        const chartType = this.chartTypes['income-category'];

        if (chartType === 'bar') {
            this.charts[chartId] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Amount (₹)',
                        data: data,
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => '₹' + value.toLocaleString('en-IN')
                            }
                        }
                    }
                });
        } else {
            this.charts[chartId] = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right'
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${label}: ₹${value.toLocaleString('en-IN')} (${percentage}%)`;
                                }
                            }
                        }
                    }
                });
        }
    }

    // Generate Expense Category Chart
    generateExpenseCategoryChart(expenseData) {
        const chartId = 'expense-category-chart';
        const noDataEl = document.getElementById('expense-category-no-data');
        const chartContainer = document.getElementById(chartId).parentElement;

        if (expenseData.length === 0) {
            chartContainer.style.display = 'none';
            noDataEl.style.display = 'block';
            return;
        }

        chartContainer.style.display = 'block';
        noDataEl.style.display = 'none';

        // Group by category
        const categoryTotals = this.groupByCategory(expenseData);
        const labels = Object.keys(categoryTotals);
        const data = Object.values(categoryTotals);
        const colors = this.generateColors(labels.length, 'expense');

        // Destroy existing chart
        if (this.charts[chartId]) {
            this.charts[chartId].destroy();
        }

        const ctx = document.getElementById(chartId).getContext('2d');
        const chartType = this.chartTypes['expense-category'];

        if (chartType === 'bar') {
            this.charts[chartId] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Amount (₹)',
                        data: data,
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y', // Horizontal bar chart for better category label visibility
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => '₹' + value.toLocaleString('en-IN')
                            }
                        }
                    }
                });
        } else {
            this.charts[chartId] = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right'
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${label}: ₹${value.toLocaleString('en-IN')} (${percentage}%)`;
                                }
                            }
                        }
                    }
                });
        }
    }

    // Group transactions by category
    groupByCategory(transactions) {
        const categoryTotals = {};

        for (const transaction of transactions) {
            const category = transaction.category || 'Uncategorized';
            if (!categoryTotals[category]) {
                categoryTotals[category] = 0;
            }
            categoryTotals[category] += Number(transaction.amount);
        }

        // Sort by amount (descending)
        const sortedEntries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
        return Object.fromEntries(sortedEntries);
    }

    // Generate color palette for charts
    generateColors(count, type) {
        const baseColors = type === 'income'
            ? [
                { bg: 'rgba(45, 122, 79, 0.7)', border: 'rgba(45, 122, 79, 1)' },
                { bg: 'rgba(76, 175, 80, 0.7)', border: 'rgba(76, 175, 80, 1)' },
                { bg: 'rgba(102, 187, 106, 0.7)', border: 'rgba(102, 187, 106, 1)' },
                { bg: 'rgba(129, 199, 132, 0.7)', border: 'rgba(129, 199, 132, 1)' },
                { bg: 'rgba(156, 204, 101, 0.7)', border: 'rgba(156, 204, 101, 1)' }
            ]
            : [
                { bg: 'rgba(207, 75, 0, 0.7)', border: 'rgba(207, 75, 0, 1)' },
                { bg: 'rgba(255, 107, 31, 0.7)', border: 'rgba(255, 107, 31, 1)' },
                { bg: 'rgba(255, 138, 101, 0.7)', border: 'rgba(255, 138, 101, 1)' },
                { bg: 'rgba(221, 186, 125, 0.7)', border: 'rgba(221, 186, 125, 1)' },
                { bg: 'rgba(156, 198, 219, 0.7)', border: 'rgba(156, 198, 219, 1)' },
                { bg: 'rgba(245, 124, 0, 0.7)', border: 'rgba(245, 124, 0, 1)' },
                { bg: 'rgba(255, 152, 0, 0.7)', border: 'rgba(255, 152, 0, 1)' },
                { bg: 'rgba(255, 183, 77, 0.7)', border: 'rgba(255, 183, 77, 1)' },
                { bg: 'rgba(255, 193, 7, 0.7)', border: 'rgba(255, 193, 7, 1)' },
                { bg: 'rgba(255, 204, 128, 0.7)', border: 'rgba(255, 204, 128, 1)' }
            ];

        const background = [];
        const border = [];

        for (let i = 0; i < count; i++) {
            const color = baseColors[i % baseColors.length];
            background.push(color.bg);
            border.push(color.border);
        }

        return { background, border };
    }

    // Toggle chart type
    toggleChartType(chartName, type) {
        this.chartTypes[chartName] = type;

        // Get current data
        const summary = this.dataManager.calculateMonthlySummary(this.currentYear, this.currentMonth);
        const allTransactions = this.dataManager.getAllTransactionsForMonth(this.currentYear, this.currentMonth);
        const incomeData = allTransactions.filter(t => t.type === 'income');
        const expenseData = allTransactions.filter(t => t.type === 'expense');

        // Regenerate the chart
        if (chartName === 'income-expense') {
            this.generateIncomeExpenseChart(summary.totalIncome, summary.totalExpenses);
        } else if (chartName === 'income-category') {
            this.generateIncomeCategoryChart(incomeData);
        } else if (chartName === 'expense-category') {
            this.generateExpenseCategoryChart(expenseData);
        }
    }

    // Event Listeners
    setupEventListeners() {
        // Month selector
        document.getElementById('month-selector').addEventListener('change', async (e) => {
            const [year, month] = e.target.value.split('-');
            this.currentYear = year;
            this.currentMonth = month;
            await this.loadCurrentMonth();
        });

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Chart type toggle buttons
        document.querySelectorAll('.chart-toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chartName = e.currentTarget.dataset.chart;
                const chartType = e.currentTarget.dataset.type;

                // Update active state
                const chartControls = e.currentTarget.parentElement;
                chartControls.querySelectorAll('.chart-toggle-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');

                // Toggle chart
                this.toggleChartType(chartName, chartType);
            });
        });
    }

    // Set current month
    setCurrentMonth() {
        const now = new Date();
        this.currentYear = now.getFullYear().toString();
        this.currentMonth = String(now.getMonth() + 1).padStart(2, '0');

        const monthSelector = document.getElementById('month-selector');
        monthSelector.value = `${this.currentYear}-${this.currentMonth}`;
    }

    // Theme Management
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

    // Show/Hide Loading
    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const text = overlay.querySelector('.loading-text');
        text.textContent = message;
        overlay.classList.add('active');
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.remove('active');
    }

    // Format currency
    formatCurrency(amount) {
        return '₹' + Number(amount).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
}

// Initialize the reports app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.ledgerlyReports = new LedgerlyReports();
});
