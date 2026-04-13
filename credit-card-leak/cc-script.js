// cc-script.js - Credit Card Calculator Page Logic

// Form elements
const ccForm = document.getElementById('cc-form');

// Event listener
ccForm.addEventListener('submit', handleCCFormSubmit);

/**
 * Handle credit card form submission
 * @param {event} e - Form submit event
 */
function handleCCFormSubmit(e) {
    e.preventDefault();

    // Get input values
    const outstanding = parseFloat(document.getElementById('cc-outstanding').value);
    const annualRate = parseFloat(document.getElementById('cc-rate').value);
    const minPaymentPercent = parseFloat(document.getElementById('cc-min-payment').value);
    const extraPayment = parseFloat(document.getElementById('cc-extra-payment').value) || 0;

    // Validate inputs
    if (!validateInputs(outstanding, annualRate, minPaymentPercent)) {
        showError('Please enter valid values (positive numbers only)');
        return;
    }

    // Show loading
    showCCLoading();

    // Simulate calculation (setTimeout for smooth UX)
    setTimeout(() => {
        try {
            // Perform calculations
            const results = simulateDebtPayoff(outstanding, annualRate, minPaymentPercent, extraPayment);

            // Display results
            displayCCResults(results, outstanding, annualRate, minPaymentPercent, extraPayment);

            // Scroll to results
            document.getElementById('cc-results').scrollIntoView({ behavior: 'smooth' });

            hideCCLoading();
        } catch (error) {
            showError('Calculation error: ' + error.message);
            hideCCLoading();
        }
    }, 300);
}

/**
 * Display credit card calculation results
 * @param {object} results - Calculation results
 * @param {number} principal - Principal amount
 * @param {number} annualRate - Annual rate
 * @param {number} minPaymentPercent - Min payment percent
 * @param {number} extraPayment - Extra payment
 */
function displayCCResults(results, principal, annualRate, minPaymentPercent, extraPayment) {
    // Update metric cards
    document.getElementById('cc-monthly-rate').textContent = `${results.monthlyRate}%`;
    document.getElementById('cc-payoff-time').textContent = `${results.years}y ${results.remainingMonths}m`;
    document.getElementById('cc-total-paid').textContent = `₹${results.totalPaid.toLocaleString('en-IN')}`;
    document.getElementById('cc-money-lost').textContent = `₹${results.totalInterest.toLocaleString('en-IN')}`;

    // Update breakdown
    document.getElementById('cc-breakdown-principal').textContent = `₹${principal.toLocaleString('en-IN')}`;
    document.getElementById('cc-breakdown-interest').textContent = `₹${results.totalInterest.toLocaleString('en-IN')}`;
    document.getElementById('cc-breakdown-extra').textContent = `₹${(extraPayment * results.months).toLocaleString('en-IN')}`;

    const interestPercent = ((results.totalInterest / principal) * 100).toFixed(0);
    document.getElementById('cc-breakdown-percentage').textContent = `${interestPercent}%`;

    // Update risk meter
    const riskAssessment = assessDebtRisk(principal, 50000); // Assuming ₹50K monthly income
    updateCCRiskMeter(riskAssessment.riskScore, riskAssessment.riskLevel, riskAssessment.advice);

    // Update chart
    updateCCChart(results.monthlyDataLimited);

    // Populate monthly table
    populateCCTable(results.monthlyDataLimited);

    // Display insights
    const insights = generateInsights(results, principal, annualRate, minPaymentPercent, extraPayment);
    displayCCInsights(insights);

    // Display scenarios
    displayCCPrepaymentScenarios(results, principal, annualRate, minPaymentPercent);

    // Show results section
    document.getElementById('cc-results').classList.remove('hidden');
    document.getElementById('cc-chart-card').classList.remove('hidden');
}

/**
 * Update credit card risk meter
 * @param {number} riskScore - Risk score
 * @param {string} riskLevel - Risk level
 * @param {string} advice - Advice text
 */
function updateCCRiskMeter(riskScore, riskLevel, advice) {
    document.getElementById('cc-risk-level').textContent = riskLevel;
    document.getElementById('cc-risk-bar').style.width = `${riskScore}%`;

    // Color based on risk
    const bar = document.getElementById('cc-risk-bar');
    if (riskScore <= 30) {
        bar.style.backgroundColor = '#27ae60';
    } else if (riskScore <= 60) {
        bar.style.backgroundColor = '#f39c12';
    } else {
        bar.style.backgroundColor = '#e74c3c';
    }

    document.getElementById('cc-risk-details').innerHTML = `<small>${advice}</small>`;
}

/**
 * Update credit card balance chart
 * @param {array} monthlyData - Monthly data points
 */
function updateCCChart(monthlyData) {
    const ctx = document.getElementById('cc-balance-chart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (window.ccBalanceChart) {
        window.ccBalanceChart.destroy();
    }

    const labels = monthlyData.map(d => d.month % 12 === 0 ? `${d.month / 12}y` : '');
    const balances = monthlyData.map(d => d.balance);

    window.ccBalanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Outstanding Balance',
                data: balances,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₹' + value.toLocaleString('en-IN');
                        }
                    }
                }
            }
        }
    });
}

/**
 * Populate monthly breakdown table
 * @param {array} monthlyData - Monthly data points
 */
function populateCCTable(monthlyData) {
    const tbody = document.getElementById('cc-table-body');
    tbody.innerHTML = '';

    monthlyData.forEach(data => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${data.month}</td>
            <td>₹${data.payment.toLocaleString('en-IN')}</td>
            <td>₹${data.interest.toFixed(0).toLocaleString('en-IN')}</td>
            <td>₹${(data.payment - data.interest).toFixed(0).toLocaleString('en-IN')}</td>
            <td>₹${data.balance.toFixed(0).toLocaleString('en-IN')}</td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * Display credit card insights
 * @param {array} insights - Array of insight objects
 */
function displayCCInsights(insights) {
    const list = document.getElementById('cc-insight-list');
    list.innerHTML = '';

    insights.forEach(insight => {
        const li = document.createElement('li');
        li.className = `insight-item ${insight.type}`;

        li.innerHTML = `
            <div class="insight-header">
                <span class="insight-icon">${insight.icon}</span>
                <span class="insight-title">${insight.title}</span>
            </div>
            <p class="insight-message">${insight.message}</p>
            <p class="insight-action"><strong>Action:</strong> ${insight.action}</p>
        `;

        list.appendChild(li);
    });
}

/**
 * Display credit card prepayment scenarios
 * @param {object} results - Current results
 * @param {number} principal - Principal amount
 * @param {number} annualRate - Annual rate
 * @param {number} minPaymentPercent - Min payment percent
 */
function displayCCPrepaymentScenarios(results, principal, annualRate, minPaymentPercent) {
    const scenarios = [
        { extra: 5000, element: 'cc-scenario-1' },
        { extra: 10000, element: 'cc-scenario-2' },
        { extra: 25000, element: 'cc-scenario-3' }
    ];

    scenarios.forEach(scenario => {
        const simulated = simulateDebtPayoff(principal, annualRate, minPaymentPercent, scenario.extra);
        const monthsSaved = results.months - simulated.months;
        const interestSaved = results.totalInterest - simulated.totalInterest;

        const text = `Clear in ${simulated.months} months (${monthsSaved} months faster) | Save ₹${interestSaved.toLocaleString('en-IN')} in interest`;
        document.getElementById(scenario.element).textContent = text;
    });
}

/**
 * Show credit card loading animation
 */
function showCCLoading() {
    const spinner = document.getElementById('cc-loading-spinner');
    if (spinner) {
        spinner.classList.remove('hidden');
    }
}

/**
 * Hide credit card loading animation
 */
function hideCCLoading() {
    const spinner = document.getElementById('cc-loading-spinner');
    if (spinner) {
        spinner.classList.add('hidden');
    }
}

/**
 * Validate form inputs
 * @param {number} outstanding - Outstanding amount
 * @param {number} rate - Interest rate
 * @param {number} minPayment - Minimum payment
 * @returns {boolean} Valid or not
 */
function validateInputs(outstanding, rate, minPayment) {
    if (isNaN(outstanding) || outstanding <= 0) return false;
    if (isNaN(rate) || rate < 0 || rate > 100) return false;
    if (isNaN(minPayment) || minPayment <= 0 || minPayment > 100) return false;
    return true;
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
    alert(message); // In production, use a toast notification
}
