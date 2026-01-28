// Enhanced Reports and Analytics
let currentPeriod = 'month';
let currentReportType = 'overview';
let reportData = {};
let charts = {};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    setupEventListeners();
    loadReport();
});

// Setup event listeners
function setupEventListeners() {
    const reportTypeEl = document.getElementById('reportType');
    const periodTypeEl = document.getElementById('periodType');

    if (reportTypeEl) {
        reportTypeEl.addEventListener('change', function () {
            currentReportType = this.value;
            showReportSection(currentReportType);
            loadReport();
        });
    }

    if (periodTypeEl) {
        periodTypeEl.addEventListener('change', function () {
            currentPeriod = this.value;
            toggleCustomDateInputs(currentPeriod === 'custom');
        });
    }
}

// Toggle custom date inputs
function toggleCustomDateInputs(show) {
    const dateFromContainer = document.getElementById('dateFromContainer');
    const dateToContainer = document.getElementById('dateToContainer');

    if (dateFromContainer && dateToContainer) {
        dateFromContainer.style.display = show ? 'block' : 'none';
        dateToContainer.style.display = show ? 'block' : 'none';
    }
}

// Show specific report section
function showReportSection(reportType) {
    const sections = ['overview', 'stock', 'finance', 'sales'];
    sections.forEach(section => {
        const el = document.getElementById(section + 'Report');
        if (el) {
            el.style.display = (section === reportType) ? 'block' : 'none';
        }
    });
}

// Generate and load report
async function generateReport() {
    await loadReport();
}

// Main report loading function
async function loadReport() {
    showLoading();

    try {
        const period = document.getElementById('periodType')?.value || 'month';
        let params = { period };

        // Add custom dates if selected
        if (period === 'custom') {
            const startDate = document.getElementById('dateFrom')?.value;
            const endDate = document.getElementById('dateTo')?.value;
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;
        }

        // Load data based on report type
        switch (currentReportType) {
            case 'overview':
                await loadOverviewReport(params);
                break;
            case 'sales':
                await loadSalesReport(params);
                break;
            case 'stock':
                await loadStockReport(params);
                break;
            case 'finance':
                await loadFinanceReport(params);
                break;
        }

        showReportSection(currentReportType);
    } catch (error) {
        console.error('Error loading report:', error);
        showError('Erreur lors du chargement du rapport');
    } finally {
        hideLoading();
    }
}

// Load overview report
async function loadOverviewReport(params) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const response = await apiRequest(`/api/reports/overview?${queryString}`);
        reportData.overview = response.data || response;

        // Update KPI cards
        updateOverviewKPIs(reportData.overview.kpis);

        // Render charts
        renderOverviewCharts();
    } catch (error) {
        console.error('Error loading overview:', error);
        throw error;
    }
}

// Update overview KPIs
function updateOverviewKPIs(kpis) {
    if (!kpis) return;

    // Revenue
    updateElement('totalRevenue', formatCurrency(kpis.revenue?.total || 0));

    // Products
    updateElement('totalProducts', kpis.stock?.total_products || 0);

    // Invoices
    updateElement('totalInvoices', kpis.revenue?.count || 0);

    // Clients
    updateElement('totalClients', kpis.clients?.active_in_period || 0);
}

// Render overview charts
function renderOverviewCharts() {
    // For now, keep existing chart rendering
    // TODO: Update with real data from API
}

// Load sales report
async function loadSalesReport(params) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const response = await apiRequest(`/api/reports/sales?${queryString}`);
        reportData.sales = response.data || response;

        // Update sales summary
        if (reportData.sales.summary) {
            updateElement('totalRevenue', formatCurrency(reportData.sales.summary.total_revenue || 0));
        }

        // Render sales charts
        renderSalesCharts();
        renderTopProducts();
    } catch (error) {
        console.error('Error loading sales:', error);
        throw error;
    }
}

// Render sales charts
function renderSalesCharts() {
    const data = reportData.sales;
    if (!data || !data.daily_sales) return;

    // Sales trend chart
    const ctx = document.getElementById('salesTrendChart');
    if (!ctx) return;

    if (charts.salesTrendChart) {
        charts.salesTrendChart.destroy();
    }

    const labels = data.daily_sales.map(d => d.date);
    const values = data.daily_sales.map(d => d.revenue);

    charts.salesTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Chiffre d\'affaires',
                data: values,
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

// Render top products
function renderTopProducts() {
    const container = document.getElementById('topProducts');
    if (!container) return;

    const data = reportData.sales;
    if (!data || !data.top_products || data.top_products.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-3">Aucune donnée</div>';
        return;
    }

    container.innerHTML = '';
    data.top_products.forEach((product, index) => {
        const item = document.createElement('div');
        item.className = 'd-flex justify-content-between align-items-center mb-2 pb-2 border-bottom';
        item.innerHTML = `
            <div>
                <span class="badge bg-primary me-2">${index + 1}</span>
                <span>${escapeHtml(product.name)}</span>
            </div>
            <div class="text-end">
                <div class="fw-bold">${formatCurrency(product.revenue)}</div>
                <small class="text-muted">${product.quantity} unités</small>
            </div>
        `;
        container.appendChild(item);
    });
}

// Load stock report
async function loadStockReport(params) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const response = await apiRequest(`/api/reports/stock?${queryString}`);
        reportData.stock = response.data || response;

        // Render stock information
        renderStockCharts();
        renderStockTable();
        renderStockAlerts();
    } catch (error) {
        console.error('Error loading stock:', error);
        throw error;
    }
}

// Render stock charts
function renderStockCharts() {
    const data = reportData.stock;
    if (!data || !data.current_stock || !data.current_stock.by_category) return;

    const ctx = document.getElementById('stockChart');
    if (!ctx) return;

    if (charts.stockChart) {
        charts.stockChart.destroy();
    }

    const categories = Object.keys(data.current_stock.by_category);
    const quantities = Object.values(data.current_stock.by_category).map(cat => cat.quantity);

    charts.stockChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: categories,
            datasets: [{
                label: 'Quantité en stock',
                data: quantities,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Render stock table
function renderStockTable() {
    // Keep existing table rendering
}

// Render stock alerts
function renderStockAlerts() {
    // Keep existing alerts rendering
}

// Load finance report
async function loadFinanceReport(params) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const response = await apiRequest(`/api/reports/finance?${queryString}`);
        reportData.finance = response.data || response;

        // Render finance charts
        renderFinanceCharts();
    } catch (error) {
        console.error('Error loading finance:', error);
        throw error;
    }
}

// Render finance charts
function renderFinanceCharts() {
    const data = reportData.finance;
    if (!data || !data.daily_balance) return;

    const ctx = document.getElementById('financeChart');
    if (!ctx) return;

    if (charts.financeChart) {
        charts.financeChart.destroy();
    }

    const labels = data.daily_balance.map(d => d.date);
    const balances = data.daily_balance.map(d => d.balance);

    charts.financeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Solde bancaire',
                data: balances,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    ticks: {
                        callback: function (value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

// Refresh reports
function refreshReports() {
    loadReport();
}

// Export report
function exportReport() {
    showInfo('Fonctionnalité d\'export en cours de développement');
}

// Utility functions
function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = value;
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'XOF',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading() {
    const metricsRow = document.getElementById('metricsRow');
    if (metricsRow) {
        metricsRow.style.opacity = '0.5';
    }
}

function hideLoading() {
    const metricsRow = document.getElementById('metricsRow');
    if (metricsRow) {
        metricsRow.style.opacity = '1';
    }
}

function showError(message) {
    if (typeof showAlert === 'function') {
        showAlert(message, 'danger');
    } else {
        console.error(message);
    }
}

function showInfo(message) {
    if (typeof showAlert === 'function') {
        showAlert(message, 'info');
    } else {
        console.log(message);
    }
}

// Use the global apiRequest from http.js
async function apiRequest(url) {
    if (window.api) {
        return await window.api.get(url);
    } else if (window.axios) {
        return await window.axios.get(url);
    } else {
        throw new Error('No HTTP client available');
    }
}
