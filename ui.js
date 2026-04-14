// ui.js - Enhanced UI rendering and interaction management

let pieChart = null;
let compositionChart = null;
let balanceTrendChart = null;
let categoryChart = null;

/**
 * Display calculation results in UI with enhanced features
 * @param {object} results - Calculation results
 * @param {number} principal - Principal amount
 * @param {number} annualRate - Annual interest rate
 * @param {number} minPaymentPercent - Minimum payment percentage
 * @param {number} extraPayment - Extra payment amount
 */
function displayResults(results, principal, annualRate, minPaymentPercent, extraPayment = 0) {
    // Update metric cards with enhanced formatting
    document.getElementById('monthly-rate').textContent = `${results.monthlyRate}%`;
    document.getElementById('payoff-time').textContent = formatPayoffTime(results);
    document.getElementById('total-paid').textContent = formatCurrency(results.totalPaid);
    document.getElementById('money-lost').textContent = formatCurrency(results.totalInterest);

    // Update breakdown with enhanced styling
    document.getElementById('breakdown-principal').textContent = formatCurrency(principal);
    document.getElementById('breakdown-interest').textContent = formatCurrency(results.totalInterest);
    document.getElementById('breakdown-extra').textContent = formatCurrency(extraPayment * results.months);

    const interestPercent = ((results.totalInterest / principal) * 100).toFixed(0);
    document.getElementById('breakdown-percentage').textContent = `${interestPercent}%`;

    // Calculate and update financial health score
    const healthScore = calculateFinancialHealthScore(results, principal, annualRate, minPaymentPercent, extraPayment);
    updateFinancialHealthScore(healthScore);

    // Update risk meter
    const riskAssessment = assessDebtRisk(principal, 50000);
    updateRiskMeter(riskAssessment.riskScore, riskAssessment.riskLevel, riskAssessment.advice);

    // Update charts with enhanced data
    updateCharts(results, principal, extraPayment);

    // Display enhanced insights
    const insights = generateEnhancedInsights(results, principal, annualRate, minPaymentPercent, extraPayment);
    displayInsights(insights);

    // Display prepayment scenarios with interactive elements
    displayPrepaymentScenarios(results, principal, annualRate, minPaymentPercent);

    // Display amortization schedule
    displayAmortizationSchedule(results);

    // Set up schedule toggle
    setupScheduleToggle(results);

    // Add export functionality
    addExportButtons(results, principal, annualRate, minPaymentPercent, extraPayment);

    // Show results section with smooth animation
    showResultsSection();

    // Add sticky behavior to results
    makeResultsSticky();
}

/**
 * Format payoff time with better readability
 * @param {object} results - Calculation results
 * @returns {string} Formatted time string
 */
function formatPayoffTime(results) {
    if (results.months <= 12) {
        return `${results.months} months`;
    } else if (results.months <= 24) {
        return `${results.years} year ${results.remainingMonths} months`;
    } else {
        return `${results.years} years ${results.remainingMonths} months`;
    }
}

/**
 * Format currency with Indian numbering
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
    return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Calculate comprehensive financial health score
 * @param {object} results - Calculation results
 * @param {number} principal - Principal amount
 * @param {number} annualRate - Annual rate
 * @param {number} minPaymentPercent - Min payment percent
 * @param {number} extraPayment - Extra payment
 * @returns {object} Health score data
 */
function calculateFinancialHealthScore(results, principal, annualRate, minPaymentPercent, extraPayment) {
    let score = 100;

    // Interest burden (0-30 points)
    const interestRatio = results.totalInterest / principal;
    if (interestRatio > 0.5) score -= 30;
    else if (interestRatio > 0.3) score -= 20;
    else if (interestRatio > 0.2) score -= 10;

    // Tenure length (0-25 points)
    if (results.months > 60) score -= 25;
    else if (results.months > 36) score -= 15;
    else if (results.months > 24) score -= 10;

    // Payment behavior (0-20 points)
    const monthlyRate = annualRate / 100 / 12;
    const firstMonthInterest = principal * monthlyRate;
    const minPaymentAmount = principal * (minPaymentPercent / 100);

    if (minPaymentAmount < firstMonthInterest) score -= 20; // Debt trap
    else if (extraPayment > 0) score += 10; // Good behavior

    // Interest rate (0-15 points)
    if (annualRate > 30) score -= 15;
    else if (annualRate > 20) score -= 10;
    else if (annualRate > 15) score -= 5;

    // Extra payment bonus (0-10 points)
    if (extraPayment > principal * 0.05) score += 10;
    else if (extraPayment > 0) score += 5;

    score = Math.max(0, Math.min(100, score));

    let level = 'Excellent';
    let color = '#27ae60';
    let icon = '🟢';

    if (score < 30) {
        level = 'High Risk';
        color = '#e74c3c';
        icon = '🔴';
    } else if (score < 60) {
        level = 'Moderate Risk';
        color = '#f39c12';
        icon = '🟡';
    } else if (score < 80) {
        level = 'Good';
        color = '#3498db';
        icon = '🟢';
    }

    return {
        score: score,
        level: level,
        color: color,
        icon: icon,
        factors: {
            interestBurden: interestRatio,
            tenure: results.months,
            paymentBehavior: extraPayment > 0,
            interestRate: annualRate
        }
    };
}

/**
 * Update financial health score display
 * @param {object} healthData - Health score data
 */
function updateFinancialHealthScore(healthData) {
    const healthElement = document.getElementById('financial-health-score');
    if (!healthElement) return;

    healthElement.innerHTML = `
        <div class="health-score-display">
            <div class="health-score-circle" style="background: ${healthData.color}">
                <div class="health-score-number">${healthData.score}</div>
                <div class="health-score-label">${healthData.level}</div>
            </div>
            <div class="health-score-details">
                <div class="health-factor">
                    <span>Interest Burden</span>
                    <span>${(healthData.factors.interestBurden * 100).toFixed(0)}%</span>
                </div>
                <div class="health-factor">
                    <span>Tenure</span>
                    <span>${healthData.factors.tenure} months</span>
                </div>
                <div class="health-factor">
                    <span>Extra Payments</span>
                    <span>${healthData.factors.paymentBehavior ? 'Yes' : 'No'}</span>
                </div>
            </div>
        </div>
    `;
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
 * Update all charts with enhanced data
 * @param {object} results - Calculation results
 * @param {number} principal - Principal amount
 * @param {number} extraPayment - Extra payment amount
 */
function updateCharts(results, principal, extraPayment = 0) {
    updatePieChart(principal, results.totalInterest);
    updateCompositionChart(principal, results.totalInterest, extraPayment);
    updateBalanceTrendChart(results.monthlyDataLimited, extraPayment);
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
                borderWidth: 3,
                hoverBorderWidth: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed;
                            const percentage = ((value / (principal + totalInterest)) * 100).toFixed(1);
                            return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Update composition bar chart with extra payment
 * @param {number} principal - Principal amount
 * @param {number} totalInterest - Total interest
 * @param {number} extraPayment - Extra payment amount
 */
function updateCompositionChart(principal, totalInterest, extraPayment = 0) {
    const ctx = document.getElementById('composition-chart');
    if (!ctx) return;

    if (compositionChart) {
        compositionChart.destroy();
    }

    const totalExtra = extraPayment * Math.min(60, Math.ceil((principal + totalInterest) / (principal * 0.02 + extraPayment))); // Estimate months

    compositionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Payment Breakdown'],
            datasets: [
                {
                    label: 'Principal',
                    data: [principal],
                    backgroundColor: '#3498db',
                    borderRadius: 4
                },
                {
                    label: 'Interest',
                    data: [totalInterest],
                    backgroundColor: '#e74c3c',
                    borderRadius: 4
                },
                {
                    label: 'Extra Payments',
                    data: [totalExtra],
                    backgroundColor: '#27ae60',
                    borderRadius: 4
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.x)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

/**
 * Update balance trend line chart with enhanced features
 * @param {array} monthlyData - Monthly data points
 * @param {number} extraPayment - Extra payment amount
 */
function updateBalanceTrendChart(monthlyData, extraPayment = 0) {
    const ctx = document.getElementById('balance-trend-chart');
    if (!ctx) return;

    if (balanceTrendChart) {
        balanceTrendChart.destroy();
    }

    const labels = [];
    const balances = [];
    const interestData = [];
    const paymentData = [];

    monthlyData.forEach(data => {
        labels.push(data.month % 12 === 0 ? `${data.month / 12}y` : '');
        balances.push(data.balance);
        interestData.push(data.interest);
        paymentData.push(data.payment);
    });

    balanceTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Outstanding Balance',
                    data: balances,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    yAxisID: 'y'
                },
                {
                    label: 'Monthly Interest',
                    data: interestData,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    yAxisID: 'y1',
                    hidden: true // Hidden by default
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                return `Balance: ${formatCurrency(context.parsed.y)}`;
                            } else {
                                return `Interest: ${formatCurrency(context.parsed.y)}`;
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Balance (₹)'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: false,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Interest (₹)'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            }
        }
    });
}

/**
 * Display enhanced insights with better formatting
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
            ${insight.savings ? `<div class="insight-savings">💰 Potential Savings: ${formatCurrency(insight.savings)}</div>` : ''}
        `;

        list.appendChild(li);
    });
}

/**
 * Display prepayment scenarios with interactive sliders
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

        const text = `Clear in ${simulated.months} months (${monthsSaved} months faster) | Save ${formatCurrency(interestSaved)} in interest`;
        document.getElementById(scenario.element).textContent = text;
    });

    // Add interactive slider for custom scenarios
    addInteractiveSlider(results, principal, annualRate, minPaymentPercent);
}

/**
 * Add interactive slider for custom prepayment scenarios
 * @param {object} results - Current results
 * @param {number} principal - Principal amount
 * @param {number} annualRate - Annual rate
 * @param {number} minPaymentPercent - Min payment percent
 */
function addInteractiveSlider(results, principal, annualRate, minPaymentPercent) {
    const sliderContainer = document.querySelector('.prepayment-scenarios');
    if (!sliderContainer) return;

    const sliderDiv = document.createElement('div');
    sliderDiv.className = 'scenario-item interactive-scenario';
    sliderDiv.innerHTML = `
        <h4>🎚️ Custom Extra Payment</h4>
        <input type="range" id="extra-payment-slider" min="0" max="${principal * 0.1}" step="1000" value="0">
        <div class="slider-values">
            <span>₹0</span>
            <span id="slider-value">₹0</span>
            <span>${formatCurrency(principal * 0.1)}</span>
        </div>
        <p id="custom-scenario-result">Add extra payment above to see results</p>
    `;

    sliderContainer.appendChild(sliderDiv);

    // Add slider event listener
    const slider = document.getElementById('extra-payment-slider');
    const valueDisplay = document.getElementById('slider-value');
    const resultDisplay = document.getElementById('custom-scenario-result');

    slider.addEventListener('input', function() {
        const extraAmount = parseInt(this.value);
        valueDisplay.textContent = formatCurrency(extraAmount);

        if (extraAmount > 0) {
            const simulated = simulateDebtPayoff(principal, annualRate, minPaymentPercent, extraAmount);
            const monthsSaved = results.months - simulated.months;
            const interestSaved = results.totalInterest - simulated.totalInterest;

            resultDisplay.textContent = `Clear in ${simulated.months} months (${monthsSaved} months faster) | Save ${formatCurrency(interestSaved)} in interest`;
        } else {
            resultDisplay.textContent = 'Add extra payment above to see results';
        }
    });
}

/**
 * Add export and share functionality
 * @param {object} results - Calculation results
 * @param {number} principal - Principal amount
 * @param {number} annualRate - Annual rate
 * @param {number} minPaymentPercent - Min payment percent
 * @param {number} extraPayment - Extra payment
 */
function addExportButtons(results, principal, annualRate, minPaymentPercent, extraPayment) {
    const resultsSection = document.getElementById('results');
    if (!resultsSection) return;

    // Remove existing export buttons
    const existingButtons = resultsSection.querySelector('.export-buttons');
    if (existingButtons) existingButtons.remove();

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'export-buttons';
    buttonContainer.innerHTML = `
        <button class="btn btn-secondary" onclick="exportToPDF(results, principal, annualRate, minPaymentPercent, extraPayment)">
            📄 Download Report
        </button>
        <button class="btn btn-secondary" onclick="shareResults(results, principal)">
            📤 Share Results
        </button>
    `;

    // Insert after metrics grid
    const metricsGrid = resultsSection.querySelector('.metrics-grid');
    if (metricsGrid) {
        metricsGrid.insertAdjacentElement('afterend', buttonContainer);
    }
}

/**
 * Export results to PDF (placeholder - would need pdf library)
 * @param {object} results - Results data
 * @param {number} principal - Principal
 * @param {number} annualRate - Rate
 * @param {number} minPaymentPercent - Min payment %
 * @param {number} extraPayment - Extra payment
 */
function exportToPDF(results, principal, annualRate, minPaymentPercent, extraPayment) {
    alert('PDF export feature would be implemented with a library like jsPDF. This is a placeholder.');
}

/**
 * Share results (placeholder)
 * @param {object} results - Results data
 * @param {number} principal - Principal
 */
function shareResults(results, principal) {
    const shareText = `My credit card analysis: ₹${principal.toLocaleString('en-IN')} debt at ${results.monthlyRate}% monthly rate. Payoff in ${results.months} months, total interest ₹${results.totalInterest.toLocaleString('en-IN')}. Check out FinLeak for your financial analysis!`;

    if (navigator.share) {
        navigator.share({
            title: 'Credit Card Analysis',
            text: shareText,
            url: window.location.href
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(shareText).then(() => {
            alert('Results copied to clipboard!');
        });
    }
}

/**
 * Show results section with smooth animation
 */
function showResultsSection() {
    const resultsSection = document.getElementById('results');
    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Make results section sticky on scroll
 */
function makeResultsSticky() {
    const resultsSection = document.getElementById('results');
    if (!resultsSection) return;

    window.addEventListener('scroll', function() {
        const rect = resultsSection.getBoundingClientRect();
        if (rect.top <= 100) {
            resultsSection.classList.add('sticky-results');
        } else {
            resultsSection.classList.remove('sticky-results');
        }
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

/**
 * Display amortization schedule in a professional table
 * @param {object} results - Calculation results with monthlyData
 * @param {string} mode - 'full' for monthly, 'yearly' for annual summary
 */
function displayAmortizationSchedule(results, mode = 'full') {
    const tbody = document.getElementById('amortization-body');
    const tfoot = document.getElementById('amortization-footer');
    const thead = document.querySelector('.amortization-table thead tr');
    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    if (mode === 'yearly') {
        // Change header for yearly
        thead.innerHTML = `
            <th>Year</th>
            <th>Total EMI</th>
            <th>Total Principal</th>
            <th>Total Interest</th>
            <th>Ending Balance</th>
        `;

        // Aggregate by year
        const yearlyData = {};
        results.monthlyData.forEach(data => {
            const year = Math.ceil(data.month / 12);
            if (!yearlyData[year]) {
                yearlyData[year] = {
                    year: year,
                    totalPayment: 0,
                    totalPrincipal: 0,
                    totalInterest: 0,
                    balance: data.balance
                };
            }
            yearlyData[year].totalPayment += data.payment;
            yearlyData[year].totalPrincipal += data.payment - data.interest;
            yearlyData[year].totalInterest += data.interest;
        });

        Object.values(yearlyData).forEach(data => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${data.year}</td>
                <td class="currency">${formatCurrency(data.totalPayment)}</td>
                <td class="currency principal">${formatCurrency(data.totalPrincipal)}</td>
                <td class="currency interest">${formatCurrency(data.totalInterest)}</td>
                <td class="currency balance">${formatCurrency(data.balance)}</td>
            `;
            tbody.appendChild(row);
        });

        // Summary for yearly
        const totalPrincipal = Object.values(yearlyData).reduce((sum, y) => sum + y.totalPrincipal, 0);
        const totalInterest = Object.values(yearlyData).reduce((sum, y) => sum + y.totalInterest, 0);
        const summaryRow = document.createElement('tr');
        summaryRow.className = 'summary-row';
        summaryRow.innerHTML = `
            <td><strong>Total</strong></td>
            <td class="currency"><strong>${formatCurrency(results.totalPaid)}</strong></td>
            <td class="currency principal"><strong>${formatCurrency(totalPrincipal)}</strong></td>
            <td class="currency interest"><strong>${formatCurrency(totalInterest)}</strong></td>
            <td class="currency balance"><strong>-</strong></td>
        `;
        tfoot.appendChild(summaryRow);

    } else {
        // Full monthly schedule
        thead.innerHTML = `
            <th>Month</th>
            <th>EMI</th>
            <th>Principal</th>
            <th>Interest</th>
            <th>Balance</th>
        `;

        const dataToShow = results.monthlyData;

        let totalPrincipalPaid = 0;
        let totalInterestPaid = 0;

        dataToShow.forEach(data => {
            const principalPaid = data.payment - data.interest;
            totalPrincipalPaid += principalPaid;
            totalInterestPaid += data.interest;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${data.month}</td>
                <td class="currency">${formatCurrency(data.payment)}</td>
                <td class="currency principal">${formatCurrency(principalPaid)}</td>
                <td class="currency interest">${formatCurrency(data.interest)}</td>
                <td class="currency balance">${formatCurrency(data.balance)}</td>
            `;
            tbody.appendChild(row);
        });

        // Add summary row
        const summaryRow = document.createElement('tr');
        summaryRow.className = 'summary-row';
        summaryRow.innerHTML = `
            <td><strong>Total</strong></td>
            <td class="currency"><strong>${formatCurrency(results.totalPaid)}</strong></td>
            <td class="currency principal"><strong>${formatCurrency(totalPrincipalPaid)}</strong></td>
            <td class="currency interest"><strong>${formatCurrency(totalInterestPaid)}</strong></td>
            <td class="currency balance"><strong>-</strong></td>
        `;
        tfoot.appendChild(summaryRow);

    }
}

/**
 * Set up schedule toggle buttons
 * @param {object} results - Calculation results
 */
function setupScheduleToggle(results) {
    const toggleFull = document.getElementById('toggle-full');
    const toggleYearly = document.getElementById('toggle-yearly');

    if (!toggleFull || !toggleYearly) return;

    // Remove existing event listeners
    toggleFull.replaceWith(toggleFull.cloneNode(true));
    toggleYearly.replaceWith(toggleYearly.cloneNode(true));

    // Get fresh references
    const newToggleFull = document.getElementById('toggle-full');
    const newToggleYearly = document.getElementById('toggle-yearly');

    // Set initial state
    newToggleFull.classList.add('active');
    newToggleYearly.classList.remove('active');

    // Add event listeners
    newToggleFull.addEventListener('click', function() {
        newToggleFull.classList.add('active');
        newToggleYearly.classList.remove('active');
        displayAmortizationSchedule(results, 'full');
    });

    newToggleYearly.addEventListener('click', function() {
        newToggleYearly.classList.add('active');
        newToggleFull.classList.remove('active');
        displayAmortizationSchedule(results, 'yearly');
    });
}
