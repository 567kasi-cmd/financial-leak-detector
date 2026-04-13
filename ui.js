// ui.js - UI rendering and interaction management

let pieChart = null;
let compositionChart = null;
let balanceTrendChart = null;

/**
 * Display calculation results in UI
 * @param {object} results - Calculation results
 * @param {number} principal - Principal amount
 */
function displayResults(results, principal, annualRate, minPaymentPercent, extraPayment = 0) {
    // Update metric cards
    document.getElementById('monthly-rate').textContent = `${results.monthlyRate}%`;
    document.getElementById('payoff-time').textContent = `${results.years}y ${results.remainingMonths}m`;
    document.getElementById('total-paid').textContent = `₹${results.totalPaid.toLocaleString('en-IN')}`;
    document.getElementById('money-lost').textContent = `₹${results.totalInterest.toLocaleString('en-IN')}`;

    // Update breakdown
    document.getElementById('breakdown-principal').textContent = `₹${principal.toLocaleString('en-IN')}`;
    document.getElementById('breakdown-interest').textContent = `₹${results.totalInterest.toLocaleString('en-IN')}`;
    document.getElementById('breakdown-extra').textContent = `₹${(extraPayment * results.months).toLocaleString('en-IN')}`;

    const interestPercent = ((results.totalInterest / principal) * 100).toFixed(0);
    document.getElementById('breakdown-percentage').textContent = `${interestPercent}%`;

    // Update risk meter
    const riskAssessment = assessDebtRisk(principal, 50000); // Assuming ₹50K monthly income
    updateRiskMeter(riskAssessment.riskScore, riskAssessment.riskLevel, riskAssessment.advice);

    // Update charts
    updateCharts(results, principal);

    // Display insights
    const insights = generateInsights(results, principal, annualRate, minPaymentPercent, extraPayment);
    displayInsights(insights);

    // Display scenarios
    displayPrepaymentScenarios(results, principal, annualRate, minPaymentPercent);

    // Show results section
    document.getElementById('results').classList.remove('hidden');
}

/**
 * Update risk meter visualization
 * @param {number} riskScore - Risk score (0-100)
 * @param {string} riskLevel - Risk level text
 * @param {string} advice - Advice text
 */
function updateRiskMeter(riskScore, riskLevel, advice) {
    document.getElementById('risk-level').textContent = riskLevel;
    document.getElementById('risk-bar').style.width = `${riskScore}%`;

    // Color based on risk
    const bar = document.getElementById('risk-bar');
    if (riskScore <= 30) {
        bar.style.backgroundColor = '#27ae60';
    } else if (riskScore <= 60) {
        bar.style.backgroundColor = '#f39c12';
    } else {
        bar.style.backgroundColor = '#e74c3c';
    }

    document.getElementById('risk-details').innerHTML = `<small>${advice}</small>`;
}

/**
 * Update all charts
 * @param {object} results - Calculation results
 * @param {number} principal - Principal amount
 */
function updateCharts(results, principal) {
    updatePieChart(principal, results.totalInterest);
    updateCompositionChart(principal, results.totalInterest);
    updateBalanceTrendChart(results.monthlyDataLimited);
}

/**
 * Update pie chart (debt composition)
 * @param {number} principal - Principal amount
 * @param {number} totalInterest - Total interest
 */
function updatePieChart(principal, totalInterest) {
    const ctx = document.getElementById('pie-chart');
    if (!ctx) return;

    if (pieChart) {
        pieChart.destroy();
    }

    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Principal', 'Interest'],
            datasets: [{
                data: [principal, totalInterest],
                backgroundColor: ['#3498db', '#e74c3c'],
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

/**
 * Update composition bar chart
 * @param {number} principal - Principal amount
 * @param {number} totalInterest - Total interest
 */
function updateCompositionChart(principal, totalInterest) {
    const ctx = document.getElementById('composition-chart');
    if (!ctx) return;

    if (compositionChart) {
        compositionChart.destroy();
    }

    compositionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Amount Breakdown'],
            datasets: [
                {
                    label: 'Principal',
                    data: [principal],
                    backgroundColor: '#3498db'
                },
                {
                    label: 'Interest',
                    data: [totalInterest],
                    backgroundColor: '#e74c3c'
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                x: {
                    stacked: true
                }
            }
        }
    });
}

/**
 * Update balance trend line chart
 * @param {array} monthlyData - Monthly data points
 */
function updateBalanceTrendChart(monthlyData) {
    const ctx = document.getElementById('balance-trend-chart');
    if (!ctx) return;

    if (balanceTrendChart) {
        balanceTrendChart.destroy();
    }

    const labels = monthlyData.map(d => d.month % 12 === 0 ? `${d.month / 12}y` : '');
    const balances = monthlyData.map(d => d.balance);

    balanceTrendChart = new Chart(ctx, {
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
                    beginAtZero: true
                }
            }
        }
    });
}

/**
 * Display insights as list items
 * @param {array} insights - Array of insight objects
 */
function displayInsights(insights) {
    const list = document.getElementById('insight-list');
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
 * Display prepayment scenarios
 * @param {object} results - Current results
 * @param {number} principal - Principal amount
 * @param {number} annualRate - Annual rate
 * @param {number} minPaymentPercent - Min payment percent
 */
function displayPrepaymentScenarios(results, principal, annualRate, minPaymentPercent) {
    const scenarios = [
        { extra: 5000, element: 'scenario-1' },
        { extra: 10000, element: 'scenario-2' },
        { extra: 25000, element: 'scenario-3' }
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
 * Show loading animation
 */
function showLoading() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.classList.remove('hidden');
    }
}

/**
 * Hide loading animation
 */
function hideLoading() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.classList.add('hidden');
    }
}
