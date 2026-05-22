// emi-script.js - Advanced Loan Simulator Page Logic

import { simulateLoan } from '../loanSimulator.js'; // Import the main simulation function

// Form elements
const emiForm = document.getElementById('emi-form');
const prepaymentsList = document.getElementById('prepayments-list');
const addPrepaymentBtn = document.getElementById('add-prepayment');

// Chart instances
let emiPieChartInstance;
let principalInterestChartInstance;
let balanceOverTimeChartInstance;

// Event listeners
emiForm.addEventListener('submit', handleEmiFormSubmit);
addPrepaymentBtn.addEventListener('click', addPrepaymentInput);
prepaymentsList.addEventListener('click', handlePrepaymentListClick);


// Initialize date inputs with current date
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const dd = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${yyyy}-${mm}-${dd}`;

    const loanStartDateInput = document.getElementById('loan-start-date');
    if (loanStartDateInput) {
        loanStartDateInput.value = formattedDate;
    }

    const hypotheticalPrepaymentDateInput = document.getElementById('hypothetical-prepayment-date');
    if (hypotheticalPrepaymentDateInput) {
        hypotheticalPrepaymentDateInput.value = formattedDate;
    }
    // Add one initial prepayment field for convenience
    addPrepaymentInput();
});

// Helper for currency formatting
const formatCurrency = (amount) => {
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

// Helper for date formatting
const formatDate = (date) => {
    if (!date) return '';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(date).toLocaleDateString('en-IN', options);
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
    const loanStartDate = new Date(document.getElementById('loan-start-date').value);
    // monthlyIncome is not directly used by simulateLoan, but can be used for custom insights if needed
    // const monthlyIncome = parseFloat(document.getElementById('monthly-income').value) || null;

    // Validate main inputs first
    if (!validateLoanInputs(loanAmount, annualInterestRate * 100, loanTenureMonths, loanStartDate)) {
        // validateLoanInputs will show specific error
        return;
    }

    // Collect prepayments
    const prepayments = [];
    let prepaymentValidationError = false; // Flag to stop processing if an error occurs

    document.querySelectorAll('.prepayment-item').forEach(item => {
        const amountInput = item.querySelector('.prepayment-item-amount');
        const dateInput = item.querySelector('.prepayment-item-date');

        const amountStr = amountInput.value.trim();
        const dateStr = dateInput.value.trim();

        // If both amount and date fields are empty, skip this prepayment item
        if (amountStr === '' && dateStr === '') {
            return; // Continue to next item in forEach
        }

        const amount = parseFloat(amountStr);
        const date = new Date(dateStr);

        // Validate if either field has content
        if (isNaN(amount) || amount <= 0) {
            showError('Please ensure all entered prepayment amounts are positive numbers.');
            prepaymentValidationError = true;
            return; // Stop processing this item
        }
        if (isNaN(date.getTime())) {
            showError('Please provide a valid date for all entered prepayments.');
            prepaymentValidationError = true;
            return; // Stop processing this item
        }

        prepayments.push({ amount, date });
    });

    if (prepaymentValidationError) {
        hideEmiLoading();
        return; // Stop form submission if any prepayment validation failed
    }

    // Collect hypothetical prepayment
    let hypotheticalPrepayment = undefined;
    const hypotheticalAmountInput = document.getElementById('hypothetical-prepayment-amount');
    const hypotheticalDateInput = document.getElementById('hypothetical-prepayment-date');

    const hypotheticalAmountStr = hypotheticalAmountInput.value.trim();
    const hypotheticalDateStr = hypotheticalDateInput.value.trim();

    // Only validate hypothetical prepayment if either field has content
    if (hypotheticalAmountStr !== '' || hypotheticalDateStr !== '') {
        const hypotheticalAmount = parseFloat(hypotheticalAmountStr);
        const hypotheticalDate = new Date(hypotheticalDateStr);

        if (isNaN(hypotheticalAmount) || hypotheticalAmount <= 0) {
            showError('Hypothetical prepayment amount must be a positive number if entered.');
            hideEmiLoading();
            return;
        }
        if (isNaN(hypotheticalDate.getTime())) {
            showError('Please provide a valid date for the hypothetical prepayment if entered.');
            hideEmiLoading();
            return;
        }
        hypotheticalPrepayment = { amount: hypotheticalAmount, date: hypotheticalDate };
    }

    // Show loading
    showEmiLoading();

    // Simulate calculation
    try {
        const simulationResult = await simulateLoan(
            { loanAmount, annualInterestRate, loanTenureMonths, loanStartDate },
            prepayments,
            new Date(), // Current date for loan progress
            hypotheticalPrepayment
        );

        // Display results
        displaySimulationResults(simulationResult, loanAmount); // Pass original loanAmount for pie chart

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
 * Adds a new prepayment input group to the form.
 */
function addPrepaymentInput() {
    const prepaymentCount = document.querySelectorAll('.prepayment-item').length;
    const newPrepaymentDiv = document.createElement('div');
    newPrepaymentDiv.classList.add('form-group', 'prepayment-item');
    newPrepaymentDiv.innerHTML = `
        <label>Prepayment ${prepaymentCount + 1}</label>
        <div class="tenure-inputs">
            <input type="number" class="prepayment-item-amount" min="0" step="0.01" placeholder="Amount (₹)">
            <input type="date" class="prepayment-item-date">
            <button type="button" class="btn btn-danger btn-sm remove-prepayment">Remove</button>
        </div>
    `;
    prepaymentsList.appendChild(newPrepaymentDiv);

    // Set default date to today for new prepayment
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    newPrepaymentDiv.querySelector('.prepayment-item-date').value = `${yyyy}-${mm}-${dd}`;
}

/**
 * Handles clicks within the prepayments list (for removing items).
 * @param {Event} e - The click event.
 */
function handlePrepaymentListClick(e) {
    if (e.target.classList.contains('remove-prepayment')) {
        e.target.closest('.prepayment-item').remove();
        // Re-label remaining prepayments
        document.querySelectorAll('.prepayment-item').forEach((item, index) => {
            item.querySelector('label').textContent = `Prepayment ${index + 1}`;
        });
    }
}


/**
 * Display comprehensive simulation results
 * @param {object} simulationResult - The result object from simulateLoan
 * @param {number} originalLoanAmount - Original loan amount for EMI pie chart
 */
function displaySimulationResults(simulationResult, originalLoanAmount) {
    // Update Key Metrics
    document.getElementById('emi-amount').textContent = formatCurrency(simulationResult.emi);
    document.getElementById('total-interest').textContent = formatCurrency(simulationResult.totalInterest);
    document.getElementById('total-payment').textContent = formatCurrency(simulationResult.totalPayment);
    const finalYears = Math.floor(simulationResult.prepaymentImpact.newTenure / 12);
    const finalMonths = simulationResult.prepaymentImpact.newTenure % 12;
    document.getElementById('loan-tenure-display').textContent = `${finalYears}y ${finalMonths}m`;

    // Update Loan Progress
    document.getElementById('progress-emis-paid').textContent = simulationResult.loanProgress.paidEmis.toLocaleString('en-IN');
    document.getElementById('progress-principal-paid').textContent = formatCurrency(simulationResult.loanProgress.principalPaid);
    document.getElementById('progress-interest-paid').textContent = formatCurrency(simulationResult.loanProgress.interestPaid);
    document.getElementById('progress-remaining-balance').textContent = formatCurrency(simulationResult.loanProgress.remainingBalance);
    document.getElementById('progress-months-remaining').textContent = simulationResult.loanProgress.monthsRemaining.toLocaleString('en-IN');

    // Update Prepayment Impact (Actual Prepayments)
    document.getElementById('impact-tenure-interest-saved').textContent = formatCurrency(simulationResult.prepaymentImpact.interestSaved);
    document.getElementById('impact-tenure-months-reduced').textContent = simulationResult.prepaymentImpact.monthsReduced.toLocaleString('en-IN');
    document.getElementById('impact-tenure-percentage-savings').textContent = `${simulationResult.prepaymentImpact.percentageSavings}%`;

    // The element for new tenure in reduce tenure scenario is not present in HTML, so commenting out.
    // if (simulationResult.prepaymentImpact.newTenure !== undefined) {
    //     const newTenureYears = Math.floor(simulationResult.prepaymentImpact.newTenure / 12);
    //     const newTenureMonths = simulationResult.prepaymentImpact.newTenure % 12;
    //     document.getElementById('impact-tenure-new-tenure').textContent = `${newTenureYears}y ${newTenureMonths}m`;
    // }

    if (simulationResult.alternativeReduceEmiImpact) {
        document.getElementById('impact-emi-new-emi').textContent = formatCurrency(simulationResult.alternativeReduceEmiImpact.newEmi);
        document.getElementById('impact-emi-interest-saved').textContent = formatCurrency(simulationResult.alternativeReduceEmiImpact.interestSaved);
        document.getElementById('impact-emi-percentage-savings').textContent = `${simulationResult.alternativeReduceEmiImpact.percentageSavings}%`;
    }

    // Update "What If" Prepayment Impact
    const hypotheticalImpactCard = document.getElementById('hypothetical-impact-card');
    if (simulationResult.hypotheticalPrepaymentImpact) {
        hypotheticalImpactCard.classList.remove('hidden');
        document.getElementById('hypothetical-amount').textContent = formatCurrency(simulationResult.hypotheticalPrepaymentImpact.amount);
        document.getElementById('hypothetical-date').textContent = formatDate(simulationResult.hypotheticalPrepaymentImpact.date);
        document.getElementById('hypothetical-interest-saved').textContent = formatCurrency(simulationResult.hypotheticalPrepaymentImpact.interestSaved);
        document.getElementById('hypothetical-months-reduced').textContent = simulationResult.hypotheticalPrepaymentImpact.monthsReduced.toLocaleString('en-IN');
        document.getElementById('hypothetical-percentage-savings').textContent = `${simulationResult.hypotheticalPrepaymentImpact.percentageSavings}%`;
    } else {
        hypotheticalImpactCard.classList.add('hidden');
    }

    // Update Loan Health Score
    document.getElementById('loan-health-score').textContent = simulationResult.loanHealth.score.toString();
    document.getElementById('loan-health-rating').textContent = simulationResult.loanHealth.rating;
    document.getElementById('loan-health-message').textContent = simulationResult.loanHealth.message;

    // Update Charts
    updateEmiPieChart(originalLoanAmount, simulationResult.totalInterest); // Still useful for overall breakdown
    updatePrincipalInterestChart(simulationResult.chartData.principalVsInterest);
    updateBalanceOverTimeChart(simulationResult.chartData.balanceOverTime);

    // Populate Amortization Table
    populateAmortizationTable(simulationResult.updatedSchedule);

    // Display Insights
    displaySmartInsights(simulationResult.insights, simulationResult.breakEvenMonth);

    // Show results section
    document.getElementById('emi-results').classList.remove('hidden');
    document.getElementById('emi-chart-card').classList.remove('hidden'); // Keep original EMI breakdown chart
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
 * @param {Array<object>} data - Chart data from simulationResult.chartData.principalVsInterest
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
            labels: data.map(d => `Month ${d.month}`),
            datasets: [
                {
                    label: 'Cumulative Principal Paid',
                    data: data.map(d => d.principal),
                    borderColor: '#2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.2)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Cumulative Interest Paid',
                    data: data.map(d => d.interest),
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.2)',
                    fill: true,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Cumulative Principal vs Interest Paid Over Time'
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
            },
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
            }
        }
    });
}

/**
 * Update Balance Over Time Chart
 * @param {Array<object>} data - Chart data from simulationResult.chartData.balanceOverTime
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
            labels: data.map(d => `Month ${d.month}`),
            datasets: [
                {
                    label: 'Remaining Balance',
                    data: data.map(d => d.balance),
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.2)',
                    fill: true,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Loan Balance Over Time'
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
            },
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
            }
        }
    });
}


/**
 * Populate Amortization table
 * @param {array} schedule - The updated schedule from simulationResult.updatedSchedule
 */
function populateAmortizationTable(schedule) {
    const tbody = document.getElementById('emi-table-body');
    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();

    schedule.forEach(data => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${data.month}</td>
            <td>${formatDate(data.date)}</td>
            <td class="currency">${formatCurrency(data.openingBalance)}</td>
            <td class="currency">${formatCurrency(data.emi)}</td>
            <td class="currency principal">${formatCurrency(data.principalComponent)}</td>
            <td class="currency interest">${formatCurrency(data.interestComponent)}</td>
            <td class="currency balance">${formatCurrency(data.closingBalance)}</td>
            <td class="currency">${formatCurrency(data.cumulativePrincipalPaid)}</td>
            <td class="currency">${formatCurrency(data.cumulativeInterestPaid)}</td>
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

    insights.forEach(insightText => {
        const li = document.createElement('li');
        li.className = `insight-item`; // You might want to add dynamic classes based on insight type if available
        li.innerHTML = `<span class="insight-icon">💡</span> <p class="insight-message">${insightText}</p>`;
        list.appendChild(li);
    });

    const breakEvenDisplay = document.getElementById('break-even-point-display');
    if (breakEvenMonth !== undefined) {
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
    }
    const btnText = document.querySelector('#emi-form button[type="submit"] .btn-text');
    if (btnText) {
        btnText.textContent = 'Calculating...';
    }
    emiForm.querySelector('button[type="submit"]').disabled = true;
}

/**
 * Hide EMI loading animation
 */
function hideEmiLoading() {
    const spinner = document.getElementById('emi-loading-spinner');
    if (spinner) {
        spinner.classList.add('hidden');
    }
    const btnText = document.querySelector('#emi-form button[type="submit"] .btn-text');
    if (btnText) {
        btnText.textContent = 'Run Simulation';
    }
    emiForm.querySelector('button[type="submit"]').disabled = false;
}

/**
 * Validate loan form inputs
 * @param {number} amount - Loan amount
 * @param {number} rate - Interest rate (percentage)
 * @param {number} months - Total months
 * @param {Date} startDate - Loan start date
 * @returns {boolean} Valid or not
 */
function validateLoanInputs(amount, rate, months, startDate) {
    if (isNaN(amount) || amount <= 0) {
        showError('Loan Amount must be a positive number.');
        return false;
    }
    if (isNaN(rate) || rate < 0 || rate > 50) { // Assuming max 50% annual rate
        showError('Annual Interest Rate must be between 0% and 50%.');
        return false;
    }
    if (isNaN(months) || months <= 0 || months > 600) { // Max 50 years (600 months)
        showError('Loan Tenure must be between 1 month and 50 years.');
        return false;
    }
    if (isNaN(startDate.getTime())) { // Check for valid date
        showError('Please provide a valid Loan Start Date.');
        return false;
    }
    return true;
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
    alert(message); // In production, use a toast notification
}
