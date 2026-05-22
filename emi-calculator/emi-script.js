// emi-script.js - Advanced Loan Simulator Page Logic

import { simulateLoan, calculateEMI } from '../loanSimulator.js'; // Import the main simulation function and calculateEMI

// Form elements
const emiForm = document.getElementById('emi-form');
const addPrepaymentBtn = document.getElementById('add-prepayment');
const prepaymentsList = document.getElementById('prepayments-list');

// Chart instances
let emiPieChartInstance;
let principalInterestChartInstance;
let balanceOverTimeChartInstance;

// Event listeners
emiForm.addEventListener('submit', handleEmiFormSubmit);
addPrepaymentBtn.addEventListener('click', addPrepaymentField);

// Helper for currency formatting
const formatCurrency = (amount) => {
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

// Helper for date formatting
const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-IN', options);
};

/**
 * Handle EMI form submission
 * @param {event} e - Form submit event
 */
async function handleEmiFormSubmit(e) {
    e.preventDefault();

    // Get input values
    const loanAmount = parseFloat(document.getElementById('loan-amount').value);
    const annualInterestRate = parseFloat(document.getElementById('interest-rate').value) / 100; // Convert to decimal
    const years = parseInt(document.getElementById('loan-tenure-years').value) || 0;
    const months = parseInt(document.getElementById('loan-tenure-months').value) || 0;
    const loanTenureMonths = (years * 12) + months;
    const loanStartDateStr = document.getElementById('loan-start-date').value;
    const loanStartDate = new Date(loanStartDateStr);
    const monthlyIncome = parseFloat(document.getElementById('monthly-income').value) || null;

    // Validate inputs
    if (!validateLoanInputs(loanAmount, annualInterestRate, loanTenureMonths, loanStartDate)) {
        showError('Please enter valid loan details (amount > 0, rate >= 0, tenure > 0, valid start date).');
        return;
    }

    // Collect prepayments
    const prepayments = [];
    document.querySelectorAll('.prepayment-item').forEach(item => {
        const amount = parseFloat(item.querySelector('.prepayment-amount').value);
        const dateStr = item.querySelector('.prepayment-date').value;
        if (!isNaN(amount) && amount > 0 && dateStr) {
            prepayments.push({ amount: amount, date: new Date(dateStr) });
        }
    });

    // Collect hypothetical prepayment
    let hypotheticalPrepayment = undefined;
    const hypotheticalAmount = parseFloat(document.getElementById('hypothetical-prepayment-amount').value);
    const hypotheticalDateStr = document.getElementById('hypothetical-prepayment-date').value;
    if (!isNaN(hypotheticalAmount) && hypotheticalAmount > 0 && hypotheticalDateStr) {
        hypotheticalPrepayment = { amount: hypotheticalAmount, date: new Date(hypotheticalDateStr) };
    }

    // Show loading
    showEmiLoading();

    // Simulate calculation
    try {
        const simulationResult = simulateLoan(
            {
                loanAmount,
                annualInterestRate,
                loanTenureMonths,
                loanStartDate,
            },
            prepayments,
            new Date(), // Current date for loan progress
            hypotheticalPrepayment
        );

        // Display results
        displaySimulationResults(simulationResult, loanAmount, annualInterestRate, loanTenureMonths, monthlyIncome);

        // Scroll to results
        document.getElementById('emi-results').scrollIntoView({ behavior: 'smooth' });

        hideEmiLoading();
    } catch (error) {
        console.error("Simulation error:", error);
        showError('Calculation error: ' + error.message);
        hideEmiLoading();
    }
}

/**
 * Dynamically add a prepayment input field
 */
function addPrepaymentField() {
    const prepaymentItem = document.createElement('div');
    prepaymentItem.classList.add('prepayment-item', 'form-group', 'grid-2-col');
    prepaymentItem.innerHTML = `
        <input type="number" class="prepayment-amount" min="0" step="0.01" placeholder="Amount (₹)" required>
        <input type="date" class="prepayment-date" required>
        <button type="button" class="btn btn-danger btn-small remove-prepayment">X</button>
    `;
    prepaymentsList.appendChild(prepaymentItem);

    prepaymentItem.querySelector('.remove-prepayment').addEventListener('click', () => {
        prepaymentItem.remove();
    });
}

/**
 * Display comprehensive loan simulation results
 * @param {object} result - The LoanSimulationResult object
 * @param {number} originalLoanAmount - The original loan amount input by user
 * @param {number} originalAnnualRate - The original annual interest rate input by user (decimal)
 * @param {number} originalTenureMonths - The original loan tenure in months input by user
 * @param {number|null} monthlyIncome - Monthly income (optional)
 */
function displaySimulationResults(result, originalLoanAmount, originalAnnualRate, originalTenureMonths, monthlyIncome) {
    // Update Key Metrics
    document.getElementById('emi-amount').textContent = formatCurrency(result.emi);
    document.getElementById('total-interest').textContent = formatCurrency(result.totalInterest);
    document.getElementById('total-payment').textContent = formatCurrency(result.totalPayment);
    document.getElementById('loan-tenure-display').textContent = `${Math.floor(result.prepaymentImpact.newTenure / 12)}y ${result.prepaymentImpact.newTenure % 12}m`;

    // Update Loan Progress
    document.getElementById('progress-emis-paid').textContent = result.loanProgress.paidEmis.toString();
    document.getElementById('progress-principal-paid').textContent = formatCurrency(result.loanProgress.principalPaid);
    document.getElementById('progress-interest-paid').textContent = formatCurrency(result.loanProgress.interestPaid);
    document.getElementById('progress-remaining-balance').textContent = formatCurrency(result.loanProgress.remainingBalance);
    document.getElementById('progress-months-remaining').textContent = result.loanProgress.monthsRemaining.toString();

    // Update Prepayment Impact (Actual Prepayments - Reduce Tenure Scenario)
    document.getElementById('impact-tenure-interest-saved').textContent = formatCurrency(result.prepaymentImpact.interestSaved);
    document.getElementById('impact-tenure-months-reduced').textContent = result.prepaymentImpact.monthsReduced.toString();
    document.getElementById('impact-tenure-percentage-savings').textContent = `${result.prepaymentImpact.percentageSavings}%`;

    // Update Prepayment Impact (Actual Prepayments - Reduce EMI Scenario)
    document.getElementById('impact-emi-new-emi').textContent = formatCurrency(result.alternativeReduceEmiImpact.newEmi);
    document.getElementById('impact-emi-interest-saved').textContent = formatCurrency(result.alternativeReduceEmiImpact.interestSaved);
    document.getElementById('impact-emi-percentage-savings').textContent = `${result.alternativeReduceEmiImpact.percentageSavings}%`;


    // Update "What If" Prepayment Impact
    const hypotheticalCard = document.getElementById('hypothetical-impact-card');
    if (result.hypotheticalPrepaymentImpact) {
        hypotheticalCard.classList.remove('hidden');
        document.getElementById('hypothetical-amount').textContent = formatCurrency(result.hypotheticalPrepaymentImpact.amount);
        document.getElementById('hypothetical-date').textContent = formatDate(result.hypotheticalPrepaymentImpact.date);
        document.getElementById('hypothetical-interest-saved').textContent = formatCurrency(result.hypotheticalPrepaymentImpact.interestSaved);
        document.getElementById('hypothetical-months-reduced').textContent = result.hypotheticalPrepaymentImpact.monthsReduced.toString();
        document.getElementById('hypothetical-percentage-savings').textContent = `${result.hypotheticalPrepaymentImpact.percentageSavings}%`;
    } else {
        hypotheticalCard.classList.add('hidden');
    }

    // Update Loan Health Score
    document.getElementById('loan-health-score').textContent = result.loanHealth.score.toString();
    document.getElementById('loan-health-rating').textContent = result.loanHealth.rating;
    document.getElementById('loan-health-message').textContent = result.loanHealth.message;

    // Update Charts
    updateEmiPieChart(originalLoanAmount, result.totalInterest); // Use original principal for pie chart
    updatePrincipalInterestChart(result.chartData.principalVsInterest);
    updateBalanceOverTimeChart(result.chartData.balanceOverTime);

    // Populate Amortization Table
    populateAmortizationTable(result.updatedSchedule);

    // Display Smart Insights
    displaySmartInsights(result.insights, result.breakEvenMonth);

    // Show results section
    document.getElementById('emi-results').classList.remove('hidden');
    document.getElementById('emi-chart-card').classList.remove('hidden');
}

/**
 * Update EMI pie chart (Principal vs Total Interest)
 * @param {number} principal - Principal amount
 * @param {number} totalInterest - Total interest
 */
function updateEmiPieChart(principal, totalInterest) {
    const ctx = document.getElementById('emi-pie-chart');
    if (!ctx) return;

    if (emiPieChartInstance) {
        emiPieChartInstance.destroy();
    }

    emiPieChartInstance = new Chart(ctx, {
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
 * Update Principal vs Interest Timeline Chart
 * @param {array} data - Array of { month, principal, interest }
 */
function updatePrincipalInterestChart(data) {
    const ctx = document.getElementById('principal-interest-chart');
    if (!ctx) return;

    if (principalInterestChartInstance) {
        principalInterestChartInstance.destroy();
    }

    principalInterestChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(entry => entry.month),
            datasets: [
                {
                    label: 'Cumulative Principal Paid',
                    data: data.map(entry => entry.principal),
                    borderColor: '#28a745', // Green
                    backgroundColor: 'rgba(40, 167, 69, 0.2)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Cumulative Interest Paid',
                    data: data.map(entry => entry.interest),
                    borderColor: '#dc3545', // Red
                    backgroundColor: 'rgba(220, 53, 69, 0.2)',
                    fill: true,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Month'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Amount (₹)'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatCurrency(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Update Balance Over Time Chart
 * @param {array} data - Array of { month, balance }
 */
function updateBalanceOverTimeChart(data) {
    const ctx = document.getElementById('balance-over-time-chart');
    if (!ctx) return;

    if (balanceOverTimeChartInstance) {
        balanceOverTimeChartInstance.destroy();
    }

    balanceOverTimeChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(entry => entry.month),
            datasets: [
                {
                    label: 'Remaining Balance',
                    data: data.map(entry => entry.balance),
                    borderColor: '#007bff', // Blue
                    backgroundColor: 'rgba(0, 123, 255, 0.2)',
                    fill: true,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Month'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Amount (₹)'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatCurrency(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Populate Amortization Table
 * @param {array} schedule - Array of ScheduleEntry objects
 */
function populateAmortizationTable(schedule) {
    const tbody = document.getElementById('emi-table-body');
    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();

    schedule.forEach(entry => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${entry.month}</td>
            <td>${formatDate(entry.date)}</td>
            <td class="currency">${formatCurrency(entry.openingBalance)}</td>
            <td class="currency">${formatCurrency(entry.emi)}</td>
            <td class="currency principal">${formatCurrency(entry.principalComponent)}</td>
            <td class="currency interest">${formatCurrency(entry.interestComponent)}</td>
            <td class="currency balance">${formatCurrency(entry.closingBalance)}</td>
            <td class="currency">${formatCurrency(entry.cumulativePrincipalPaid)}</td>
            <td class="currency">${formatCurrency(entry.cumulativeInterestPaid)}</td>
        `;
        fragment.appendChild(row);
    });

    tbody.appendChild(fragment);
}

/**
 * Display Smart Insights
 * @param {array} insights - Array of insight strings
 * @param {number|undefined} breakEvenMonth - Break-even month
 */
function displaySmartInsights(insights, breakEvenMonth) {
    const list = document.getElementById('emi-insight-list');
    list.innerHTML = '';

    insights.forEach(message => {
        const li = document.createElement('li');
        li.className = `insight-item`; // You can add dynamic classes based on message content if needed
        li.innerHTML = `<span class="insight-icon">💡</span> <p class="insight-message">${message}</p>`;
        list.appendChild(li);
    });

    const breakEvenDisplay = document.getElementById('break-even-point-display');
    if (breakEvenMonth) {
        breakEvenDisplay.textContent = `Break-even Point: Principal paid exceeds interest paid at month ${breakEvenMonth}.`;
    } else {
        breakEvenDisplay.textContent = `Break-even Point: Not reached within the loan tenure, or principal always exceeded interest.`;
    }
}

/**
 * Show EMI loading animation
 */
function showEmiLoading() {
    const spinner = document.getElementById('emi-loading-spinner');
    if (spinner) {
        spinner.classList.remove('hidden');
        emiForm.querySelector('button[type="submit"]').disabled = true;
    }
}

/**
 * Hide EMI loading animation
 */
function hideEmiLoading() {
    const spinner = document.getElementById('emi-loading-spinner');
    if (spinner) {
        spinner.classList.add('hidden');
        emiForm.querySelector('button[type="submit"]').disabled = false;
    }
}

/**
 * Validate loan form inputs
 * @param {number} amount - Loan amount
 * @param {number} rate - Annual interest rate (decimal)
 * @param {number} months - Total months
 * @param {Date} startDate - Loan start date
 * @returns {boolean} Valid or not
 */
function validateLoanInputs(amount, rate, months, startDate) {
    if (isNaN(amount) || amount <= 0) return false;
    if (isNaN(rate) || rate < 0 || rate > 1) return false; // Rate should be between 0 and 1 (0-100%)
    if (isNaN(months) || months <= 0 || months > 600) return false; // Max 50 years
    if (isNaN(startDate.getTime())) return false; // Check for valid date
    return true;
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
    alert(message); // In production, use a toast notification
}

// Initial call to add one prepayment field for convenience
addPrepaymentField();
