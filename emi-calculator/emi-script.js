// emi-script.js - Advanced Loan Simulator Page Logic

import { simulateLoan } from '../loanSimulator.js'; // Import the main simulation function
import { validateLoanInputs, validatePrepaymentInputs, validateHypotheticalPrepayment } from '../validation.js'; // New validation module
import { attachSyncedSlider, debounce, formatCurrency, formatDate, setButtonLoading } from '../shared.js';

// Form elements
const emiForm = document.getElementById('emi-form');
const prepaymentsList = document.getElementById('prepayments-list');
const addPrepaymentBtn = document.getElementById('add-prepayment');
const messageContainer = document.getElementById('message-container'); // Assuming this exists in HTML

// Chart instances
let emiPieChartInstance;
let principalInterestChartInstance;
let balanceOverTimeChartInstance;
let hasRenderedOnce = false;

const loanTypePresets = {
    home: { rate: 8.5, years: 20, months: 0, amount: 5000000 },
    car: { rate: 9.25, years: 5, months: 0, amount: 800000 },
    personal: { rate: 13.5, years: 3, months: 0, amount: 500000 },
    education: { rate: 10.25, years: 7, months: 0, amount: 1200000 },
    business: { rate: 14.5, years: 10, months: 0, amount: 2500000 }
};

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

    // Add one initial prepayment field for convenience
    addPrepaymentInput();
    displayMessage('info', 'Add a prepayment to see how much interest you can save!', 'prepayment-tip');

    attachSyncedSlider(document.getElementById('loan-amount'), {
        min: 50000,
        max: 50000000,
        step: 50000,
        defaultValue: 5000000,
        formatter: (value) => formatCurrency(value, 0, 0)
    });

    attachSyncedSlider(document.getElementById('interest-rate'), {
        min: 0,
        max: 20,
        step: 0.1,
        defaultValue: 8.5,
        formatter: (value) => `${value}%`
    });

    attachSyncedSlider(document.getElementById('loan-tenure-years'), {
        min: 0,
        max: 30,
        step: 1,
        defaultValue: 20,
        formatter: (value) => `${value}y`
    });

    attachSyncedSlider(document.getElementById('loan-tenure-months'), {
        min: 0,
        max: 11,
        step: 1,
        defaultValue: 0,
        formatter: (value) => `${value}m`
    });

    const loanTypeSelect = document.getElementById('loan-type');
    if (loanTypeSelect) {
        loanTypeSelect.addEventListener('change', handleLoanTypePresetChange);
        handleLoanTypePresetChange();
    }
});

function handleLoanTypePresetChange() {
    const loanType = document.getElementById('loan-type')?.value;
    const preset = loanTypePresets[loanType];

    if (!preset) {
        return;
    }

    document.getElementById('loan-amount').value = String(preset.amount);
    document.getElementById('interest-rate').value = String(preset.rate);
    document.getElementById('loan-tenure-years').value = String(preset.years);
    document.getElementById('loan-tenure-months').value = String(preset.months);

    ['loan-amount', 'interest-rate', 'loan-tenure-years', 'loan-tenure-months'].forEach((id) => {
        document.getElementById(id).dispatchEvent(new Event('input', { bubbles: true }));
    });
}

/**
 * Displays a message to the user.
 * @param {string} type - 'success', 'error', 'warning', 'info'
 * @param {string} message - The message text.
 * @param {string} id - Optional ID for the message element, useful for clearing specific messages.
 */
function displayMessage(type, message, id = '') {
    if (!messageContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message-banner message-${type}`;
    if (id) {
        messageDiv.id = id;
    }
    messageDiv.textContent = message;
    messageContainer.appendChild(messageDiv);
}

/**
 * Clears all or a specific message from the message container.
 * @param {string} id - Optional ID of the message to clear. If not provided, all messages are cleared.
 */
function clearMessages(id = '') {
    if (!messageContainer) return;

    if (id) {
        const specificMessage = document.getElementById(id);
        if (specificMessage) {
            specificMessage.remove();
        }
    } else {
        messageContainer.innerHTML = '';
    }
}


/**
 * Handle EMI form submission
 * @param {event} e - Form submit event
 */
async function handleEmiFormSubmit(e) {
    e.preventDefault();
    await runSimulation({ scrollToResults: true });
}

async function runSimulation({ scrollToResults = false } = {}) {
    clearMessages(); // Clear previous messages

    // Show loading
    showEmiLoading();

    // Get input values
    const loanAmount = parseFloat(document.getElementById('loan-amount').value);
    const annualInterestRate = parseFloat(document.getElementById('interest-rate').value); // Keep as percentage for validation
    const years = parseInt(document.getElementById('loan-tenure-years').value) || 0;
    const months = parseInt(document.getElementById('loan-tenure-months').value) || 0;
    const loanTenureMonths = (years * 12) + months;
    const loanStartDate = document.getElementById('loan-start-date').value;
    const monthlyIncome = parseFloat(document.getElementById('monthly-income').value) || null; // Pass for insights

    // Validate main loan inputs
    const loanValidation = validateLoanInputs(loanAmount, annualInterestRate, loanTenureMonths, loanStartDate);
    if (!loanValidation.isValid) {
        loanValidation.errors.forEach(err => displayMessage('error', err));
        hideEmiLoading();
        return;
    }

    // Collect and validate prepayments
    const rawPrepayments = [];
    document.querySelectorAll('.prepayment-item').forEach(item => {
        const amountStr = item.querySelector('.prepayment-item-amount').value.trim();
        const dateStr = item.querySelector('.prepayment-item-date').value.trim();
        if (amountStr || dateStr) { // Only consider if either field has content
            rawPrepayments.push({ amount: amountStr, date: dateStr });
        }
    });

    const prepaymentValidation = validatePrepaymentInputs(rawPrepayments);
    if (!prepaymentValidation.isValid) {
        prepaymentValidation.errors.forEach(err => displayMessage('error', err));
        hideEmiLoading();
        return;
    }
    const prepayments = prepaymentValidation.validatedData; // Use validated and parsed data

    // Collect and validate hypothetical prepayment
    let hypotheticalPrepayment = null;
    const hypotheticalAmountStr = document.getElementById('hypothetical-prepayment-amount').value.trim();
    const hypotheticalDateStr = document.getElementById('hypothetical-prepayment-date').value.trim();

    if (hypotheticalAmountStr || hypotheticalDateStr) { // Only validate if either field has content
        const hypotheticalValidation = validateHypotheticalPrepayment(hypotheticalAmountStr, hypotheticalDateStr);
        if (!hypotheticalValidation.isValid) {
            hypotheticalValidation.errors.forEach(err => displayMessage('error', err));
            hideEmiLoading();
            return;
        }
        hypotheticalPrepayment = hypotheticalValidation.validatedData;
    }

    // Clear the "Add prepayment to see savings" tip if prepayments are present
    if (prepayments.length > 0) {
        clearMessages('prepayment-tip');
    }


    // Simulate calculation
    try {
        const simulationResult = await simulateLoan(
            {
                loanAmount,
                annualInterestRate: annualInterestRate / 100, // Convert to decimal for simulation
                loanTenureMonths,
                loanStartDate: new Date(loanStartDate),
                monthlyIncome // Pass monthly income for insights
            },
            prepayments,
            new Date(), // Current date for loan progress
            hypotheticalPrepayment
        );

        // Display results
        displaySimulationResults(simulationResult);
        hasRenderedOnce = true;

        // Scroll to results
        if (scrollToResults) {
            document.getElementById('emi-results').scrollIntoView({ behavior: 'smooth' });
        }

        hideEmiLoading();
    } catch (error) {
        displayMessage('error', 'Calculation error: ' + error.message);
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
 */
function displaySimulationResults(simulationResult) {
    const {
        originalLoan,
        modifiedLoan,
        loanProgress,
        prepaymentImpact,
        hypotheticalPrepaymentImpact,
        insights,
        updatedSchedule,
        loanHealth
    } = simulationResult;

    // Update Key Metrics (using modifiedLoan for final results)
    document.getElementById('emi-amount').textContent = formatCurrency(modifiedLoan.emi);
    document.getElementById('total-interest').textContent = formatCurrency(modifiedLoan.totalInterest);
    document.getElementById('total-payment').textContent = formatCurrency(modifiedLoan.totalPayment);
    const finalYears = Math.floor(modifiedLoan.totalMonths / 12);
    const finalMonths = modifiedLoan.totalMonths % 12;
    document.getElementById('loan-tenure-display').textContent = `${finalYears}y ${finalMonths}m`;

    document.getElementById('compare-original-emi').textContent = formatCurrency(originalLoan.emi);
    document.getElementById('compare-original-interest').textContent = formatCurrency(originalLoan.totalInterest);
    document.getElementById('compare-original-payment').textContent = formatCurrency(originalLoan.totalPayment);
    document.getElementById('compare-original-tenure').textContent = formatTenure(originalLoan.totalMonths);
    document.getElementById('compare-modified-emi').textContent = formatCurrency(modifiedLoan.emi);
    document.getElementById('compare-modified-interest').textContent = formatCurrency(modifiedLoan.totalInterest);
    document.getElementById('compare-modified-payment').textContent = formatCurrency(modifiedLoan.totalPayment);
    document.getElementById('compare-modified-tenure').textContent = formatTenure(modifiedLoan.totalMonths);
    updateScenarioSummary(originalLoan, modifiedLoan, prepaymentImpact, hypotheticalPrepaymentImpact, loanHealth);

    // Update Loan Progress
    document.getElementById('progress-emis-paid').textContent = loanProgress.paidEmis.toLocaleString('en-IN');
    document.getElementById('progress-principal-paid').textContent = formatCurrency(loanProgress.principalPaid);
    document.getElementById('progress-interest-paid').textContent = formatCurrency(loanProgress.interestPaid);
    document.getElementById('progress-remaining-balance').textContent = formatCurrency(loanProgress.remainingBalance);
    document.getElementById('progress-months-remaining').textContent = loanProgress.monthsRemaining.toLocaleString('en-IN');

    // Update Prepayment Impact (Actual Prepayments)
    if (prepaymentImpact && prepaymentImpact.interestSaved > 0) {
        document.getElementById('impact-tenure-interest-saved').textContent = formatCurrency(prepaymentImpact.interestSaved);
        document.getElementById('impact-tenure-months-reduced').textContent = prepaymentImpact.monthsReduced.toLocaleString('en-IN');
        document.getElementById('impact-tenure-percentage-savings').textContent = `${prepaymentImpact.percentageSavings.toFixed(2)}%`;

        if (prepaymentImpact.alternativeReduceEmiImpact) {
            document.getElementById('impact-emi-new-emi').textContent = formatCurrency(prepaymentImpact.alternativeReduceEmiImpact.newEmi);
            document.getElementById('impact-emi-interest-saved').textContent = formatCurrency(prepaymentImpact.alternativeReduceEmiImpact.interestSaved);
            document.getElementById('impact-emi-percentage-savings').textContent = `${prepaymentImpact.alternativeReduceEmiImpact.percentageSavings.toFixed(2)}%`;
        }
    } else {
        document.getElementById('impact-tenure-interest-saved').textContent = formatCurrency(0);
        document.getElementById('impact-tenure-months-reduced').textContent = '0';
        document.getElementById('impact-tenure-percentage-savings').textContent = '0.00%';
        document.getElementById('impact-emi-new-emi').textContent = formatCurrency(modifiedLoan.emi);
        document.getElementById('impact-emi-interest-saved').textContent = formatCurrency(0);
        document.getElementById('impact-emi-percentage-savings').textContent = '0.00%';
    }


    // Update "What If" Prepayment Impact
    const hypotheticalImpactCard = document.getElementById('hypothetical-impact-card');
    if (hypotheticalPrepaymentImpact) {
        hypotheticalImpactCard.classList.remove('hidden');
        document.getElementById('hypothetical-amount').textContent = formatCurrency(hypotheticalPrepaymentImpact.amount);
        document.getElementById('hypothetical-date').textContent = formatDate(hypotheticalPrepaymentImpact.date);
        document.getElementById('hypothetical-interest-saved').textContent = formatCurrency(hypotheticalPrepaymentImpact.interestSaved);
        document.getElementById('hypothetical-months-reduced').textContent = hypotheticalPrepaymentImpact.monthsReduced.toLocaleString('en-IN');
        document.getElementById('hypothetical-percentage-savings').textContent = `${hypotheticalPrepaymentImpact.percentageSavings.toFixed(2)}%`;
    } else {
        hypotheticalImpactCard.classList.add('hidden');
    }

    // Update Loan Health Score
    document.getElementById('loan-health-score').textContent = loanHealth.score.toString();
    document.getElementById('loan-health-rating').textContent = loanHealth.rating;
    document.getElementById('loan-health-message').textContent = loanHealth.message;

    // Update Charts
    updateEmiPieChart(modifiedLoan.principal, modifiedLoan.totalInterest);
    updatePrincipalInterestChart(updatedSchedule.map(s => ({
        month: s.month,
        principal: s.cumulativePrincipalPaid,
        interest: s.cumulativeInterestPaid
    })));
    updateBalanceOverTimeChart(updatedSchedule.map(s => ({
        month: s.month,
        balance: s.closingBalance
    })));

    // Populate Amortization Table
    populateAmortizationTable(updatedSchedule);

    // Display Insights
    displaySmartInsights(insights, simulationResult.breakEvenMonth);

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
 * @param {array} insights - Array of insight objects from insights.js
 * @param {number|undefined} breakEvenMonth - Break-even month
 */
function displaySmartInsights(insights, breakEvenMonth) {
    const list = document.getElementById('emi-insight-list');
    list.innerHTML = '';

    if (insights.length === 0) {
        displayMessage('info', 'No specific insights generated for this scenario. Your loan appears to be well-managed.', 'no-insights-tip');
        return;
    }

    insights.forEach(insight => {
        const li = document.createElement('li');
        li.className = `insight-item insight-item-${insight.type}`; // Use insight type for styling
        li.innerHTML = `
            <span class="insight-icon">${insight.icon}</span>
            <div class="insight-content">
                <h4 class="insight-title">${insight.title}</h4>
                <p class="insight-message">${insight.message}</p>
                ${insight.action ? `<p class="insight-action"><strong>Action:</strong> ${insight.action}</p>` : ''}
            </div>
        `;
        list.appendChild(li);
    });

    const breakEvenDisplay = document.getElementById('break-even-point-display');
    if (breakEvenMonth !== undefined && breakEvenMonth !== null) {
        breakEvenDisplay.textContent = `Break-even Point: Principal paid exceeds interest paid at month ${breakEvenMonth}.`;
    } else {
        breakEvenDisplay.textContent = `Break-even Point: Not reached within the loan tenure, or principal always exceeded interest.`;
    }
}


/**
 * Show EMI loading animation
 */
function showEmiLoading() {
    setButtonLoading(
        emiForm.querySelector('button[type="submit"]'),
        document.getElementById('emi-loading-spinner'),
        true,
        'Run Simulation',
        'Calculating...'
    );
}

function formatTenure(totalMonths) {
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    return `${years}y ${months}m`;
}

function updateScenarioSummary(originalLoan, modifiedLoan, prepaymentImpact, hypotheticalPrepaymentImpact, loanHealth) {
    const primary = document.getElementById('loan-summary-primary');
    const interest = document.getElementById('loan-summary-interest');
    const prepayment = document.getElementById('loan-summary-prepayment');

    if (prepaymentImpact && prepaymentImpact.interestSaved > 0) {
        primary.textContent = `Current prepayments already save ${formatCurrency(prepaymentImpact.interestSaved)} and shorten the loan by ${prepaymentImpact.monthsReduced} months.`;
    } else if (loanHealth.score < 60) {
        primary.textContent = 'This structure looks expensive. Focus on lowering tenure or adding early prepayments.';
    } else {
        primary.textContent = 'This loan structure is workable. Use the what-if section to test early lump-sum savings.';
    }

    const interestRatio = originalLoan.totalInterest > 0 && modifiedLoan.totalPayment > 0
        ? (modifiedLoan.totalInterest / modifiedLoan.totalPayment) * 100
        : 0;
    interest.textContent = `Interest makes up about ${interestRatio.toFixed(1)}% of total cash outflow in the current scenario.`;

    if (hypotheticalPrepaymentImpact && hypotheticalPrepaymentImpact.interestSaved > 0) {
        prepayment.textContent = `Your what-if prepayment can save another ${formatCurrency(hypotheticalPrepaymentImpact.interestSaved)} if timed well.`;
    } else {
        prepayment.textContent = 'Early prepayments usually have the highest effect before the loan crosses the break-even point.';
    }
}

/**
 * Hide EMI loading animation
 */
function hideEmiLoading() {
    setButtonLoading(
        emiForm.querySelector('button[type="submit"]'),
        document.getElementById('emi-loading-spinner'),
        false,
        'Run Simulation',
        'Calculating...'
    );
}

emiForm.addEventListener('input', debounce(() => {
    if (hasRenderedOnce) {
        runSimulation();
    }
}, 300));
