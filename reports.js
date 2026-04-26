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
        // ── Financial Position ──────────────────────────────
        // In-memory cache: { 'YYYY-MM': { income: 0, expenses: 0 } }
        this.fpAggregateCache = {};
        // Precomputed breakdown arrays for tooltip rendering
        this.fpTooltipData = { ytd: [], alltime: [] };
        // Flag so we skip a second call while one is in-flight
        this.fpLoading = false;
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

        // Generate charts
        this.generateIncomeExpenseChart(totalIncome, totalExpenses);
        this.generateIncomeCategoryChart(incomeData);
        this.generateExpenseCategoryChart(expenseData);

        // Update Financial Position (YTD + All-Time)
        // Fire-and-forget: errors are handled internally
        this.updateFinancialPosition().catch(err =>
            console.warn('Financial Position update failed silently:', err)
        );
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

        // Build both a totals map (for chart data) AND a detail map (for tooltips)
        const categoryDetails = this.groupByCategoryWithDetails(expenseData);
        const labels = Object.keys(categoryDetails);
        const data   = labels.map(cat => categoryDetails[cat].total);
        const colors = this.generateColors(labels.length, 'expense');

        // Shared tooltip callbacks — used by both bar and pie variants
        const buildTooltipLines = (categoryLabel, parsedTotal, datasetData) => {
            const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN', {
                minimumFractionDigits: 2, maximumFractionDigits: 2
            });

            const lines = [];

            // Pie chart needs a percentage; bar chart doesn't have a meaningful one
            if (datasetData) {
                const grandTotal = datasetData.reduce((s, v) => s + v, 0);
                const pct = grandTotal > 0 ? ((parsedTotal / grandTotal) * 100).toFixed(1) : '0.0';
                lines.push(`${categoryLabel}: ${fmt(parsedTotal)} (${pct}%)`);
            } else {
                lines.push(`${categoryLabel}: ${fmt(parsedTotal)}`);
            }

            // Description breakdown
            const detail = categoryDetails[categoryLabel];
            if (detail && detail.items.length > 0) {
                lines.push(''); // blank separator line
                detail.items.forEach((item, idx) => {
                    const bullet = idx === 0 ? '┌' : idx === detail.items.length - 1 ? '└' : '├';
                    lines.push(`${bullet} ${item.description}: ${fmt(item.amount)}`);
                });
            }

            return lines;
        };

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
                    indexAxis: 'y', // Horizontal bar for better category label visibility
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                // Return an array → Chart.js renders each entry as its own line
                                label: (context) => buildTooltipLines(
                                    context.label,
                                    context.parsed.x, // horizontal bar: value is on x-axis
                                    null              // no grand-total % for bar chart
                                )
                            }
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
                        legend: { position: 'right' },
                        tooltip: {
                            callbacks: {
                                label: (context) => buildTooltipLines(
                                    context.label,
                                    context.parsed,         // pie: the raw value
                                    context.dataset.data    // pass full dataset for % calc
                                )
                            }
                        }
                    }
                }
            });
        }
    }

    // Group transactions by category — returns { [category]: total }
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

    /**
     * Groups transactions by category and keeps a per-category breakdown of
     * every individual transaction (description + amount), sorted by amount.
     * Returns: { [category]: { total: number, items: [{description, amount}] } }
     */
    groupByCategoryWithDetails(transactions) {
        const result = {};

        for (const t of transactions) {
            const category = t.category || 'Uncategorized';
            if (!result[category]) {
                result[category] = { total: 0, items: [] };
            }
            result[category].total += Number(t.amount);
            result[category].items.push({
                description: t.description || '—',
                amount: Number(t.amount)
            });
        }

        // Sort categories by total descending, items within each category by amount descending
        const sorted = Object.entries(result)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([cat, val]) => [
                cat,
                { ...val, items: val.items.sort((a, b) => b.amount - a.amount) }
            ]);

        return Object.fromEntries(sorted);
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

    // ============================================================
    // FINANCIAL POSITION — YTD + ALL-TIME
    // ============================================================

    /**
     * Main entry point. Orchestrates all data fetching, caching,
     * computation, and DOM rendering for the Financial Position section.
     */
    async updateFinancialPosition() {
        if (this.fpLoading) return; // Debounce concurrent calls
        this.fpLoading = true;

        const loadingEl = document.getElementById('fp-loading');
        const emptyEl   = document.getElementById('fp-empty');
        const contentEl = document.getElementById('fp-content');

        // Show skeleton, hide everything else
        loadingEl.style.display = '';
        emptyEl.style.display   = 'none';
        contentEl.style.display = 'none';

        try {
            // ── 1. Discover all available year/month directories ──────
            const allMonths = await this.fetchAllAvailableMonths();

            if (allMonths.length === 0) {
                loadingEl.style.display = 'none';
                emptyEl.style.display   = '';
                this.fpLoading = false;
                return;
            }

            // ── 2. YTD: Jan to currentMonth in currentYear ────────────
            const ytdResult = await this.computeYTD(allMonths);

            // ── 3. All-Time: every month up to and including selected ─
            const allTimeResult = await this.computeAllTime(allMonths);

            // ── 4. Render ─────────────────────────────────────────────
            this.renderFPUI(ytdResult, allTimeResult);

            loadingEl.style.display = 'none';
            contentEl.style.display = '';

            // ── 5. Wire up tooltip interactions ───────────────────────
            this.setupFPTooltips();

        } catch (err) {
            console.error('updateFinancialPosition error:', err);
            loadingEl.style.display = 'none';
            emptyEl.style.display   = '';
            // Show a more helpful empty-state message
            const p = emptyEl.querySelector('p');
            if (p) p.textContent = 'Could not load financial position data. Please check your connection.';
        } finally {
            this.fpLoading = false;
        }
    }

    /**
     * Returns YTD aggregates (Jan → currentMonth of currentYear).
     * Only months that exist in the repo are counted; missing ones = 0.
     * @param {{ year: string, month: string }[]} allMonths
     */
    async computeYTD(allMonths) {
        const year  = this.currentYear;
        const endMM = parseInt(this.currentMonth, 10);

        let totalIncome   = 0;
        let totalExpenses = 0;
        const breakdown   = []; // [{ label, income, expenses, balance }]

        for (let mm = 1; mm <= endMM; mm++) {
            const monthStr = String(mm).padStart(2, '0');
            const exists   = allMonths.some(m => m.year === year && m.month === monthStr);

            let inc = 0, exp = 0;
            if (exists) {
                const agg = await this.getMonthAggregate(year, monthStr);
                inc = agg.income;
                exp = agg.expenses;
            }

            totalIncome   += inc;
            totalExpenses += exp;

            const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun',
                                 'Jul','Aug','Sep','Oct','Nov','Dec'];
            breakdown.push({
                label   : MONTH_NAMES[mm - 1],
                income  : inc,
                expenses: exp,
                balance : inc - exp
            });
        }

        return {
            totalIncome,
            totalExpenses,
            balance  : totalIncome - totalExpenses,
            breakdown          // month-by-month for tooltip
        };
    }

    /**
     * Returns All-Time aggregates up to and including the selected month.
     * @param {{ year: string, month: string }[]} allMonths
     */
    async computeAllTime(allMonths) {
        const cutoffYear  = parseInt(this.currentYear,  10);
        const cutoffMonth = parseInt(this.currentMonth, 10);

        let totalIncome   = 0;
        let totalExpenses = 0;

        // Group months by year for the year-wise breakdown tooltip
        const yearMap = {}; // { '2024': { income, expenses } }

        // Sort months chronologically
        const sorted = [...allMonths].sort((a, b) => {
            if (a.year !== b.year) return a.year.localeCompare(b.year);
            return a.month.localeCompare(b.month);
        });

        for (const { year, month } of sorted) {
            const y = parseInt(year,  10);
            const m = parseInt(month, 10);

            // Skip months after the selected month
            if (y > cutoffYear) continue;
            if (y === cutoffYear && m > cutoffMonth) continue;

            const agg = await this.getMonthAggregate(year, month);

            totalIncome   += agg.income;
            totalExpenses += agg.expenses;

            if (!yearMap[year]) yearMap[year] = { income: 0, expenses: 0 };
            yearMap[year].income   += agg.income;
            yearMap[year].expenses += agg.expenses;
        }

        const breakdown = Object.keys(yearMap)
            .sort()
            .map(y => ({
                label   : y,
                income  : yearMap[y].income,
                expenses: yearMap[y].expenses,
                balance : yearMap[y].income - yearMap[y].expenses
            }));

        return {
            totalIncome,
            totalExpenses,
            balance: totalIncome - totalExpenses,
            breakdown          // year-by-year for tooltip
        };
    }

    /**
     * Returns the cached income + expense aggregate for a single month.
     * Priority: in-memory → localStorage → GitHub fetch.
     * The result is written back into both caches.
     */
    async getMonthAggregate(year, month) {
        const key = `${year}-${month}`;

        // 1. In-memory hit
        if (this.fpAggregateCache[key]) {
            return this.fpAggregateCache[key];
        }

        // 2. localStorage hit
        const lsKey  = `ledgerly_fp_agg_${key}`;
        const stored = localStorage.getItem(lsKey);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (typeof parsed.income === 'number' && typeof parsed.expenses === 'number') {
                    this.fpAggregateCache[key] = parsed;
                    return parsed;
                }
            } catch (_) { /* ignore corrupt entries */ }
        }

        // 3. GitHub fetch — reuse dataManager's in-memory store if already loaded
        await this.dataManager.loadMonthData(year, month);
        const summary = this.dataManager.calculateMonthlySummary(year, month);
        const agg = { income: summary.totalIncome, expenses: summary.totalExpenses };

        // Write back to both caches
        this.fpAggregateCache[key] = agg;
        try { localStorage.setItem(lsKey, JSON.stringify(agg)); } catch (_) {}

        return agg;
    }

    /**
     * Invalidates the cached aggregate for a specific month so that the next
     * call to updateFinancialPosition re-fetches it from GitHub.
     * Call this after any add/edit/delete that affects (year, month).
     */
    invalidateFPCacheForMonth(year, month) {
        const key = `${year}-${month}`;
        delete this.fpAggregateCache[key];
        try { localStorage.removeItem(`ledgerly_fp_agg_${key}`); } catch (_) {}
    }

    /**
     * Discovers all year/month combos that exist in the GitHub repo
     * by walking the data/ directory tree.
     * Returns [{ year, month }].
     */
    async fetchAllAvailableMonths() {
        const { owner, repo, branch, basePath } = this.githubClient.config;
        const apiBase = this.githubClient.baseURL;
        const headers = this.githubClient.getHeaders();

        // Helper: fetch JSON from GH contents API, returns [] on 404
        const ghContents = async (path) => {
            const url = `${apiBase}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
            try {
                const res = await fetch(url, { headers });
                if (!res.ok) return [];
                return await res.json();
            } catch {
                return [];
            }
        };

        const yearEntries = await ghContents(basePath);
        const months = [];

        const yearDirs = (Array.isArray(yearEntries) ? yearEntries : [])
            .filter(e => e.type === 'dir' && /^\d{4}$/.test(e.name));

        await Promise.all(yearDirs.map(async (yDir) => {
            const monthEntries = await ghContents(`${basePath}/${yDir.name}`);
            const monthDirs = (Array.isArray(monthEntries) ? monthEntries : [])
                .filter(e => e.type === 'dir' && /^\d{2}$/.test(e.name));
            for (const mDir of monthDirs) {
                months.push({ year: yDir.name, month: mDir.name });
            }
        }));

        return months;
    }

    /**
     * Writes computed data to the DOM.
     */
    renderFPUI(ytd, allTime) {
        const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun',
                             'Jul','Aug','Sep','Oct','Nov','Dec'];
        const selectedMonthName = MONTH_NAMES[parseInt(this.currentMonth, 10) - 1];

        // ── YTD period label
        document.getElementById('fp-ytd-period').textContent =
            `Jan – ${selectedMonthName} ${this.currentYear}`;

        // ── YTD values
        document.getElementById('fp-ytd-income').textContent   = this.formatCurrency(ytd.totalIncome);
        document.getElementById('fp-ytd-expenses').textContent = this.formatCurrency(ytd.totalExpenses);
        this._setBalanceEl('fp-ytd-balance', ytd.balance);

        // ── All-Time period label
        document.getElementById('fp-alltime-period').textContent = 'All records up to ' + selectedMonthName;

        // ── All-Time values
        document.getElementById('fp-alltime-income').textContent   = this.formatCurrency(allTime.totalIncome);
        document.getElementById('fp-alltime-expenses').textContent = this.formatCurrency(allTime.totalExpenses);
        this._setBalanceEl('fp-alltime-balance', allTime.balance);

        // Store breakdown for tooltip
        this.fpTooltipData.ytd     = ytd.breakdown;
        this.fpTooltipData.alltime = allTime.breakdown;
    }

    /** Sets a balance element's text and positive/negative class. */
    _setBalanceEl(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = this.formatCurrency(value);
        el.classList.remove('fp-positive', 'fp-negative');
        if (value > 0)      el.classList.add('fp-positive');
        else if (value < 0) el.classList.add('fp-negative');
    }

    /**
     * Attaches mouseenter / mousemove / mouseleave listeners to the two
     * hoverable balance cards to show/position the custom tooltip.
     */
    setupFPTooltips() {
        const tooltip = document.getElementById('fp-tooltip');
        const inner   = document.getElementById('fp-tooltip-inner');
        if (!tooltip || !inner) return;

        const cards = document.querySelectorAll('.fp-card--hoverable');
        cards.forEach(card => {
            // Remove old listeners by cloning (idempotent attaching)
            const fresh = card.cloneNode(true);
            card.parentNode.replaceChild(fresh, card);

            fresh.addEventListener('mouseenter', (e) => {
                const target = fresh.dataset.tooltipTarget; // 'ytd' | 'alltime'
                const data   = this.fpTooltipData[target] || [];

                if (data.length === 0) return;

                // Build HTML
                inner.innerHTML = this._buildTooltipHTML(target, data);
                tooltip.classList.add('visible');
                tooltip.setAttribute('aria-hidden', 'false');
                this._positionFPTooltip(tooltip, e);
            });

            fresh.addEventListener('mousemove', (e) => {
                this._positionFPTooltip(tooltip, e);
            });

            fresh.addEventListener('mouseleave', () => {
                tooltip.classList.remove('visible');
                tooltip.setAttribute('aria-hidden', 'true');
            });
        });
    }

    /** Positions the floating tooltip near the cursor, keeping it on-screen. */
    _positionFPTooltip(tooltip, mouseEvent) {
        const OFFSET = 16;
        const tw = tooltip.offsetWidth  || 260;
        const th = tooltip.offsetHeight || 200;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let left = mouseEvent.clientX + OFFSET;
        let top  = mouseEvent.clientY - th - OFFSET;

        // Flip right if overflows viewport
        if (left + tw > vw - 8) left = mouseEvent.clientX - tw - OFFSET;
        // Flip below if overflows top
        if (top < 8) top = mouseEvent.clientY + OFFSET;

        tooltip.style.left = left + 'px';
        tooltip.style.top  = top  + 'px';
    }

    /** Builds the tooltip inner HTML for a breakdown array. */
    _buildTooltipHTML(target, data) {
        const title = target === 'ytd' ? 'Monthly Breakdown' : 'Yearly Breakdown';
        const sign  = (n) => n >= 0 ? '+' : '';
        const fmt   = (n) => this.formatCurrency(Math.abs(n));
        const cls   = (n) => n >= 0 ? 'fp-positive' : 'fp-negative';

        let html = `<div class="fp-tooltip-title">${title}</div>`;

        for (const row of data) {
            const bal    = row.balance;
            const valStr = `${sign(bal)}${fmt(bal)}`;
            html += `
                <div class="fp-tooltip-row">
                    <span class="fp-tt-label">${row.label}</span>
                    <span class="fp-tt-value ${cls(bal)}">${valStr}</span>
                </div>`;
        }

        return html;
    }
}

// Initialize the reports app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.ledgerlyReports = new LedgerlyReports();
});


