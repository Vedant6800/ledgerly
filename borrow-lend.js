// Shared Borrow & Lend calculations and UI.
(function () {
    const formatCurrency = amount => '₹' + Number(amount).toLocaleString('en-IN', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });
    const escapeHtml = value => {
        const div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    };
    const today = () => new Date().toISOString().slice(0, 10);

    async function createManager() {
        const client = new GitHubAPIClient(GITHUB_CONFIG);
        await client.initializeToken();
        const manager = new BorrowLendDataManager(client);
        await manager.load();
        return manager;
    }

    function renderPosition(summary, allTimeBalance, prefix) {
        const adjusted = allTimeBalance + summary.totalBorrowed - summary.totalRepaid -
            summary.totalLent + summary.totalReceivedBack;
        const net = adjusted + summary.outstandingReceivables - summary.outstandingLiabilities;
        const values = {
            [`${prefix}adjusted`]: adjusted,
            [`${prefix}liabilities`]: summary.outstandingLiabilities,
            [`${prefix}receivables`]: summary.outstandingReceivables,
            [`${prefix}net`]: net
        };
        Object.entries(values).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = formatCurrency(value);
        });
        return { ...summary, adjustedAvailableBalance: adjusted, netFinancialPosition: net };
    }

    async function calculateAllTimeBalance(githubClient) {
        const years = await githubClient.listDataFiles(githubClient.config.basePath);
        const directories = Array.isArray(years) ? years.filter(item => item.type === 'dir' && /^\d{4}$/.test(item.name)) : [];
        let balanceCents = 0;
        for (const year of directories) {
            const months = await githubClient.listDataFiles(year.path);
            const monthDirectories = Array.isArray(months)
                ? months.filter(item => item.type === 'dir' && /^\d{2}$/.test(item.name)) : [];
            for (const month of monthDirectories) {
                const [income, expenses] = await Promise.all([
                    githubClient.getFile(year.name, month.name, 'income'),
                    githubClient.getFile(year.name, month.name, 'expenses')
                ]);
                balanceCents += (income.content || []).reduce((sum, item) => sum + BorrowLendDataManager.cents(item.amount), 0);
                balanceCents -= (expenses.content || []).reduce((sum, item) => sum + BorrowLendDataManager.cents(item.amount), 0);
            }
        }
        return BorrowLendDataManager.amount(balanceCents);
    }

    window.loadBorrowLendPosition = async function (githubClient, allTimeBalance, prefix = 'bl-') {
        const manager = new BorrowLendDataManager(githubClient);
        await manager.load();
        const balance = allTimeBalance === undefined ? await calculateAllTimeBalance(githubClient) : allTimeBalance;
        return renderPosition(manager.getSummary(), Number(balance) || 0, prefix);
    };

    window.loadBorrowLendReport = async function (githubClient, allTimeBalance) {
        const manager = new BorrowLendDataManager(githubClient);
        await manager.load();
        const overallBalance = allTimeBalance === undefined
            ? await calculateAllTimeBalance(githubClient)
            : Number(allTimeBalance);
        const summary = manager.getSummary();
        const liabilities = document.getElementById('report-bl-liabilities');
        const receivables = document.getElementById('report-bl-receivables');
        const netPosition = overallBalance + summary.outstandingReceivables - summary.outstandingLiabilities;
        const netPositionElement = document.getElementById('report-bl-net-position');
        const netPositionStatus = document.getElementById('report-bl-net-position-status');
        const netPositionCard = document.getElementById('report-bl-net-position-card');
        if (liabilities) liabilities.textContent = formatCurrency(summary.outstandingLiabilities);
        if (receivables) receivables.textContent = formatCurrency(summary.outstandingReceivables);
        if (netPositionElement) {
            netPositionElement.textContent = formatCurrency(netPosition);
            netPositionElement.classList.toggle('positive', netPosition >= 0);
            netPositionElement.classList.toggle('negative', netPosition < 0);
        }
        if (netPositionStatus) {
            netPositionStatus.textContent = netPosition >= 0
                ? 'Positive position'
                : 'Negative position';
            netPositionStatus.className = `net-position-status ${netPosition >= 0 ? 'positive' : 'negative'}`;
        }
        if (netPositionCard) {
            netPositionCard.classList.toggle('positive', netPosition >= 0);
            netPositionCard.classList.toggle('negative', netPosition < 0);
        }
        const byPerson = {};
        manager.getSnapshot().records.forEach(record => {
            const personName = manager.getPersonName(record.personId);
            if (!byPerson[personName]) byPerson[personName] = { liabilities: 0, receivables: 0 };
            if (record.type === 'borrowed') byPerson[personName].liabilities += record.outstanding;
            else byPerson[personName].receivables += record.outstanding;
        });
        renderPersonChart(byPerson);
        return summary;
    };

    let personChart;
    let personChartType = 'bar';
    let personChartData = {};

    function renderPersonChart(byPerson) {
        personChartData = byPerson;
        const chart = document.getElementById('borrow-lend-person-chart');
        const container = chart?.parentElement;
        const noData = document.getElementById('borrow-lend-person-no-data');
        if (!chart || !container || !noData || typeof Chart === 'undefined') return;

        const entries = Object.entries(byPerson)
            .filter(([, values]) => values.liabilities || values.receivables)
            .sort(([a], [b]) => a.localeCompare(b));
        if (!entries.length) {
            container.style.display = 'none';
            noData.style.display = 'block';
            if (personChart) personChart.destroy();
            return;
        }

        container.style.display = 'block';
        noData.style.display = 'none';
        if (personChart) personChart.destroy();
        const labels = entries.map(([name]) => name);
        const liabilities = entries.map(([, values]) => values.liabilities);
        const receivables = entries.map(([, values]) => values.receivables);
        const colors = {
            liabilities: '#CF4B00',
            receivables: '#2d7a4f'
        };
        const money = value => formatCurrency(value);
        const ctx = chart.getContext('2d');

        personChart = new Chart(ctx, {
            type: personChartType,
            data: personChartType === 'bar'
                ? {
                    labels,
                    datasets: [
                        { label: 'You owe', data: liabilities, backgroundColor: colors.liabilities },
                        { label: "You're owed", data: receivables, backgroundColor: colors.receivables }
                    ]
                }
                : {
                    labels,
                    datasets: [{
                        data: entries.map(([, values]) => values.liabilities + values.receivables),
                        backgroundColor: labels.map((_, index) =>
                            ['#CF4B00', '#2d7a4f', '#9CC6DB', '#DDBA7D', '#6ba5c4'][index % 5])
                    }]
                },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: personChartType === 'bar' ? 'y' : 'x',
                plugins: {
                    legend: { display: personChartType === 'pie', position: 'right' },
                    tooltip: {
                        callbacks: {
                            label: context => {
                                if (personChartType === 'pie') {
                                    return `${context.label}: ${money(context.parsed)}`;
                                }
                                return `${context.dataset.label}: ${money(context.parsed.x)}`;
                            }
                        }
                    }
                },
                scales: personChartType === 'bar' ? {
                    x: {
                        beginAtZero: true,
                        ticks: { callback: value => '₹' + value.toLocaleString('en-IN') }
                    }
                } : {}
            }
        });
    }

    function setupPersonChartControls() {
        document.querySelectorAll('[data-bl-person-chart]').forEach(button => {
            button.addEventListener('click', event => {
                document.querySelectorAll('[data-bl-person-chart]').forEach(item => item.classList.remove('active'));
                event.currentTarget.classList.add('active');
                personChartType = event.currentTarget.dataset.blPersonChart;
                renderPersonChart(personChartData);
            });
        });
    }

    class BorrowLendPage {
        constructor() {
            this.manager = null;
            this.search = '';
            this.init();
        }

        async init() {
            try {
                this.showLoading(true);
                this.manager = await createManager();
                document.getElementById('record-date').value = today();
                this.bindEvents();
                this.render();
            } catch (error) {
                console.error('Borrow & Lend initialization failed:', error);
                alert(`Could not load Borrow & Lend data.\n\n${error.message}`);
            } finally {
                this.showLoading(false);
            }
        }

        bindEvents() {
            document.getElementById('record-form').addEventListener('submit', event => {
                event.preventDefault();
                this.addRecord();
            });
            document.getElementById('record-search').addEventListener('input', event => {
                this.search = event.target.value.trim().toLocaleLowerCase();
                this.renderRecords();
            });
            document.getElementById('record-person-filter').addEventListener('change', event => {
                this.personFilter = event.target.value;
                this.renderRecords();
            });
            document.getElementById('theme-toggle').addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme') || 'light';
                document.documentElement.setAttribute('data-theme', current === 'light' ? 'dark' : 'light');
                document.querySelector('.theme-icon').setAttribute('data-mode', current === 'light' ? 'dark' : 'light');
            });
        }

        async addRecord() {
            const form = document.getElementById('record-form');
            try {
                const record = await this.manager.addRecord({
                    type: document.getElementById('record-type').value,
                    personName: document.getElementById('person-name').value,
                    amount: document.getElementById('record-amount').value,
                    date: document.getElementById('record-date').value,
                    description: document.getElementById('record-description').value,
                    notes: document.getElementById('record-notes').value
                });
                form.reset();
                document.getElementById('record-date').value = today();
                this.render();
                alert(`${record.type === 'borrowed' ? 'Borrowing' : 'Lending'} record saved.`);
            } catch (error) {
                console.error('Could not save Borrow & Lend record:', error);
                alert(error.message);
            }
        }

        personName(record) { return this.manager.getPersonName(record.personId); }

        render() {
            const people = document.getElementById('people-list');
            people.innerHTML = this.manager.people.map(person => `<option value="${escapeHtml(person.name)}"></option>`).join('');
            const personFilter = document.getElementById('record-person-filter');
            const selectedPerson = this.personFilter || '';
            personFilter.innerHTML = '<option value="">All people</option>' +
                this.manager.people.map(person =>
                    `<option value="${escapeHtml(person.id)}">${escapeHtml(person.name)}</option>`
                ).join('');
            personFilter.value = selectedPerson;
            const summary = this.manager.getSummary();
            renderPosition(summary, 0, 'bl-');
            this.renderRecords();
        }

        renderRecords() {
            const list = document.getElementById('record-list');
            const empty = document.getElementById('record-empty');
            const records = this.manager.getSnapshot().records
                .filter(record => !this.personFilter || record.personId === this.personFilter)
                .filter(record => !this.search ||
                    `${this.personName(record)} ${record.description}`.toLocaleLowerCase().includes(this.search))
                .sort((a, b) => b.date.localeCompare(a.date));
            empty.style.display = records.length ? 'none' : '';
            list.innerHTML = records.map(record => this.recordHtml(record)).join('');
            list.querySelectorAll('[data-add-repayment]').forEach(button =>
                button.addEventListener('click', () => this.addRepayment(button.dataset.addRepayment)));
            list.querySelectorAll('[data-edit-repayment]').forEach(button =>
                button.addEventListener('click', () => this.editRepayment(button.dataset.editRepayment, button.dataset.recordId)));
            list.querySelectorAll('[data-delete-repayment]').forEach(button =>
                button.addEventListener('click', () => this.deleteRepayment(button.dataset.deleteRepayment, button.dataset.recordId)));
            list.querySelectorAll('[data-edit-record]').forEach(button =>
                button.addEventListener('click', () => this.editRecord(button.dataset.editRecord)));
            list.querySelectorAll('[data-delete-record]').forEach(button =>
                button.addEventListener('click', () => this.deleteRecord(button.dataset.deleteRecord)));
        }

        recordHtml(record) {
            const settled = record.status === 'Settled';
            const repayments = record.repayments.map(item => `
                <div class="bl-repayment">
                    <span>${escapeHtml(item.date)} · ${formatCurrency(item.amount)}${item.notes ? ` · ${escapeHtml(item.notes)}` : ''}</span>
                    <span class="bl-actions">
                        <button class="btn-secondary" data-edit-repayment="${item.id}" data-record-id="${record.id}">Correct</button>
                        <button class="btn-secondary" data-delete-repayment="${item.id}" data-record-id="${record.id}">Delete</button>
                    </span>
                </div>`).join('');
            return `<article class="bl-record">
                <div class="bl-record-header"><h3>${escapeHtml(this.personName(record))}</h3>
                    <span class="bl-status ${record.status.toLocaleLowerCase().replace(' ', '-')}">${record.status}</span></div>
                <div class="bl-record-meta"><span>${record.type === 'borrowed' ? 'Borrowed' : 'Lent'} · ${escapeHtml(record.date)}</span>
                    <span class="bl-amount">${formatCurrency(record.amount)}</span>
                    <span>Repaid/received: ${formatCurrency(record.totalRepaid)}</span>
                    <span class="bl-amount ${record.type === 'borrowed' ? 'bl-outstanding' : 'bl-receivable'}">Outstanding: ${formatCurrency(record.outstanding)}</span></div>
                ${record.description ? `<p>${escapeHtml(record.description)}</p>` : ''}
                ${record.notes ? `<p class="text-muted">${escapeHtml(record.notes)}</p>` : ''}
                <div class="bl-actions"><button class="btn-secondary" data-edit-record="${record.id}">Edit record</button>
                    ${record.repayments.length === 0 ? `<button class="btn-secondary" data-delete-record="${record.id}">Delete record</button>` : ''}
                    ${settled ? '' : `<button class="btn btn-primary" data-add-repayment="${record.id}">${record.type === 'borrowed' ? 'Add repayment' : 'Add received amount'}</button>`}</div>
                <div class="bl-repayments"><strong>Repayment history</strong>${repayments || '<p class="text-muted">None yet.</p>'}</div>
            </article>`;
        }

        async addRepayment(recordId) {
            const amount = prompt('Amount:');
            const date = prompt('Date (YYYY-MM-DD):', today());
            const notes = prompt('Notes (optional):', '');
            if (amount === null || date === null) return;
            try { await this.manager.addRepayment(recordId, { amount, date, notes }); this.render(); }
            catch (error) { alert(error.message); }
        }

        async editRepayment(repaymentId, recordId) {
            const record = this.manager.findRecord(recordId);
            const repayment = record.repayments.find(item => item.id === repaymentId);
            const amount = prompt('Correct amount:', repayment.amount);
            const date = prompt('Correct date (YYYY-MM-DD):', repayment.date);
            if (amount === null || date === null) return;
            try { await this.manager.updateRepayment(recordId, repaymentId, { amount, date, notes: repayment.notes }); this.render(); }
            catch (error) { alert(error.message); }
        }

        async deleteRepayment(repaymentId, recordId) {
            if (!confirm('Delete this repayment? The outstanding amount will be restored.')) return;
            try { await this.manager.deleteRepayment(recordId, repaymentId); this.render(); }
            catch (error) { alert(error.message); }
        }

        async editRecord(recordId) {
            const record = this.manager.findRecord(recordId);
            const amount = prompt('Original amount:', record.amount);
            const date = prompt('Date (YYYY-MM-DD):', record.date);
            const description = prompt('Description:', record.description);
            if (amount === null || date === null || description === null) return;
            try { await this.manager.updateRecord(recordId, { amount, date, description }); this.render(); }
            catch (error) { alert(error.message); }
        }

        async deleteRecord(recordId) {
            if (!confirm('Delete this record? This cannot be undone.')) return;
            try { await this.manager.deleteRecord(recordId); this.render(); }
            catch (error) { alert(error.message); }
        }

        showLoading(active) { document.getElementById('loading-overlay').classList.toggle('active', active); }
    }

    if (document.getElementById('record-form')) {
        document.addEventListener('DOMContentLoaded', () => { window.borrowLendPage = new BorrowLendPage(); });
    }
    if (document.getElementById('borrow-lend-person-chart')) {
        document.addEventListener('DOMContentLoaded', setupPersonChartControls);
    }
})();
