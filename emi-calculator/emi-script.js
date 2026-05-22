// emi-script.js - Advanced Loan Simulator Page Logic

import { calculateHypotheticalPrepaymentImpact } from '../calculations.js';
import { simulateLoan } from '../loanSimulator.js'; // Import the main simulation function
import { validateLoanInputs, validatePrepaymentInputs, validateHypotheticalPrepayment } from '../validation.js'; // New validation module
import { attachSyncedSlider, debounce, formatCurrency, formatDate, setButtonLoading } from '../shared.js';

function initApp() {
// Form elements
const emiForm = document.getElementById('emi-form');
const prepaymentsList = document.getElementById('prepayments-list');
const addPrepaymentBtn = document.getElementById('add-prepayment');
let applyHypotheticalBtn;
let applyWhatIfToPlanCheckbox;
let hypotheticalAmountInput;
let hypotheticalDateInput;
const messageContainer = document.getElementById('message-container'); // Assuming this exists in HTML

// Chart instances
let emiPieChartInstance;
let principalInterestChartInstance;
let balanceOverTimeChartInstance;
let hasRenderedOnce = false;
let lastSimulationResult = null;

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

    ensurePrepaymentExperience();

    // Add one initial prepayment field for convenience
    addPrepaymentInput();
    displayMessage('info', 'Add real prepayments in the Actual Plan section. Use the simulation section separately to test an idea before applying it.', 'prepayment-tip');

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

function ensurePrepaymentExperience() {
    hypotheticalAmountInput = document.getElementById('hypothetical-prepayment-amount');
    hypotheticalDateInput = document.getElementById('hypothetical-prepayment-date');

    const prepaymentHeading = prepaymentsList?.previousElementSibling;
    const prepaymentSmall = addPrepaymentBtn?.nextElementSibling;
    const hypotheticalHeading = hypotheticalAmountInput?.closest('.form-group')?.previousElementSibling;
    const hypotheticalSmall = hypotheticalDateInput?.closest('.form-group')?.nextElementSibling;
    const actualSectionNodes = [prepaymentHeading, prepaymentsList, addPrepaymentBtn, prepaymentSmall].filter(Boolean);
    const simulationSectionNodes = [
        hypotheticalHeading,
        hypotheticalAmountInput?.closest('.form-group'),
        hypotheticalDateInput?.closest('.form-group'),
        hypotheticalSmall
    ].filter(Boolean);

    if (prepaymentHeading && prepaymentHeading.tagName === 'H3') {
        prepaymentHeading.innerHTML = '<span class="plan-badge plan-badge-actual">&#9989; Actual Plan</span> Prepayments (Optional) <span class="info-pill" title="These are real payments. Results shown below will include these prepayments." aria-label="Real prepayments info">&#9432;</span>';
        prepaymentHeading.classList.add('prepayment-section-title');
    }

    if (prepaymentSmall) {
        prepaymentSmall.textContent = 'These are real payments. Results shown below will include these prepayments.';
    }

    if (addPrepaymentBtn) {
        addPrepaymentBtn.textContent = 'Add Actual Prepayment';
    }

    if (prepaymentsList && !document.getElementById('actual-plan-description')) {
        const description = document.createElement('p');
        description.id = 'actual-plan-description';
        description.className = 'section-description';
        description.textContent = 'Add actual prepayments you have already made or are certainly planning to make. These will directly impact your loan results, EMI, tenure, and interest calculations.';
        prepaymentHeading?.insertAdjacentElement('afterend', description);
    }

    if (hypotheticalHeading && hypotheticalHeading.tagName === 'H3') {
        hypotheticalHeading.innerHTML = '<span class="plan-badge plan-badge-simulated">&#128269; Simulation Only</span> Try a Prepayment (Simulation Only) <span class="info-pill" title="This is only for comparison and decision-making. It does not affect your current results." aria-label="Simulation-only info">&#9432;</span>';
        hypotheticalHeading.classList.add('prepayment-section-title');
    }

    if (hypotheticalSmall) {
        hypotheticalSmall.textContent = 'This is only for comparison and decision-making. It does not affect your current results.';
    }

    if (hypotheticalAmountInput?.closest('.form-group') && !document.getElementById('simulation-plan-description')) {
        const description = document.createElement('p');
        description.id = 'simulation-plan-description';
        description.className = 'section-description';
        description.textContent = 'Simulate a hypothetical prepayment to see how it would affect your loan. This does not change your actual loan calculations unless added to Prepayments.';
        hypotheticalHeading?.insertAdjacentElement('afterend', description);
    }

    if (hypotheticalSmall && !document.getElementById('apply-hypothetical-to-prepayments')) {
        const controls = document.createElement('div');
        controls.className = 'simulation-actions';
        controls.innerHTML = `
            <label class="checkbox-row mt-2" for="apply-what-if-to-plan">
                <input type="checkbox" id="apply-what-if-to-plan">
                <span>Apply What-If to Actual Prepayments</span>
            </label>
            <p class="helper-text">Happy with this scenario? Add it to your actual plan.</p>
            <button type="button" class="btn btn-secondary btn-block mt-2" id="apply-hypothetical-to-prepayments">Add to Prepayments</button>
        `;
        hypotheticalSmall.insertAdjacentElement('afterend', controls);
    }

    if (!document.getElementById('actual-prepayment-section') && prepaymentHeading?.parentElement) {
        const wrapper = document.createElement('div');
        wrapper.id = 'actual-prepayment-section';
        wrapper.className = 'prepayment-section prepayment-section-actual';
        prepaymentHeading.parentElement.insertBefore(wrapper, prepaymentHeading);
        actualSectionNodes.forEach((node) => wrapper.appendChild(node));
        const description = document.getElementById('actual-plan-description');
        if (description) {
            wrapper.insertBefore(description, prepaymentsList);
        }
    }

    if (!document.getElementById('simulation-prepayment-section') && hypotheticalHeading?.parentElement) {
        const wrapper = document.createElement('div');
        wrapper.id = 'simulation-prepayment-section';
        wrapper.className = 'prepayment-section prepayment-section-simulated';
        hypotheticalHeading.parentElement.insertBefore(wrapper, hypotheticalHeading);
        simulationSectionNodes.forEach((node) => wrapper.appendChild(node));
        const description = document.getElementById('simulation-plan-description');
        if (description) {
            wrapper.insertBefore(description, hypotheticalAmountInput.closest('.form-group'));
        }
        const controls = document.querySelector('.simulation-actions');
        if (controls) {
            wrapper.appendChild(controls);
        }
    }

    applyHypotheticalBtn = document.getElementById('apply-hypothetical-to-prepayments');
    applyWhatIfToPlanCheckbox = document.getElementById('apply-what-if-to-plan');

    const comparisonCard = document.querySelector('#emi-results .card.mt-3');
    const comparisonHeading = document.querySelector('#emi-results .card.mt-3 h3');
    if (comparisonHeading?.textContent.trim() === 'Before vs After') {
        comparisonHeading.textContent = 'Current Loan vs Actual Plan';
    }
    const panels = document.querySelectorAll('.comparison-panel h4');
    if (panels[0]) {
        panels[0].textContent = 'Without Actual Prepayments';
    }
    if (panels[1]) {
        panels[1].textContent = 'With Actual Prepayments';
    }

    const summarySignal = document.getElementById('loan-summary-prepayment');
    if (summarySignal) {
        summarySignal.textContent = 'We will separate actual plan impact from simulation-only ideas here.';
    }

    const hypotheticalImpactCard = document.getElementById('hypothetical-impact-card');
    if (hypotheticalImpactCard) {
        hypotheticalImpactCard.innerHTML = `
            <div class="scenario-comparison-header">
                <div>
                    <span class="plan-badge plan-badge-simulated">&#128269; Simulation Only</span>
                    <h3>&#128202; Scenario Comparison</h3>
                </div>
                <p class="scenario-highlight" id="hypothetical-highlight">Try a hypothetical prepayment to compare it against your current actual plan.</p>
            </div>
            <p class="scenario-context">If you prepay <span id="hypothetical-amount">â‚¹0</span> on <span id="hypothetical-date"></span>, this is how your current plan would compare.</p>
            <div class="comparison-grid scenario-comparison-grid">
                <div class="comparison-panel">
                    <h4>Current Plan</h4>
                    <div class="comparison-item">
                        <span>EMI</span>
                        <span id="scenario-current-emi" class="value">â‚¹0</span>
                    </div>
                    <div class="comparison-item">
                        <span>Interest Saved</span>
                        <span id="scenario-current-interest-saved" class="value">â‚¹0</span>
                    </div>
                    <div class="comparison-item">
                        <span>Tenure</span>
                        <span id="scenario-current-tenure" class="value">0m</span>
                    </div>
                </div>
                <div class="comparison-panel comparison-panel-simulated">
                    <h4>With What-If</h4>
                    <div class="comparison-item">
                        <span>EMI</span>
                        <span id="scenario-hypothetical-emi" class="value">â‚¹0</span>
                    </div>
                    <div class="comparison-item">
                        <span>Interest Saved</span>
                        <span id="scenario-hypothetical-interest-saved" class="value">â‚¹0</span>
                    </div>
                    <div class="comparison-item">
                        <span>Tenure</span>
                        <span id="scenario-hypothetical-tenure" class="value">0m</span>
                    </div>
                </div>
            </div>
            <p class="helper-text mt-2">This comparison is for decision-making only. Use "Add to Prepayments" if you want to make it part of your actual plan.</p>
        `;
    }

    if (applyHypotheticalBtn) {
        applyHypotheticalBtn.addEventListener('click', handleApplyHypotheticalToPrepayments);
    }

    if (hypotheticalAmountInput) {
        hypotheticalAmountInput.addEventListener('input', debounce(handleWhatIfInputChange, 150));
    }

    if (hypotheticalDateInput) {
        hypotheticalDateInput.addEventListener('input', debounce(handleWhatIfInputChange, 150));
    }
}

function getHypotheticalPrepaymentInput() {
    return {
        amountStr: hypotheticalAmountInput.value.trim(),
        dateStr: hypotheticalDateInput.value.trim()
    };
}

function resetHypotheticalComparison() {
    const hypotheticalImpactCard = document.getElementById('hypothetical-impact-card');
    hypotheticalImpactCard.classList.add('hidden');
    hypotheticalImpactCard.classList.remove('scenario-flash');
    document.getElementById('hypothetical-highlight').textContent = 'Try a hypothetical prepayment to compare it against your current actual plan.';
    document.getElementById('hypothetical-amount').textContent = formatCurrency(0);
    document.getElementById('hypothetical-date').textContent = '';
    document.getElementById('scenario-current-emi').textContent = formatCurrency(0);
    document.getElementById('scenario-current-interest-saved').textContent = formatCurrency(0);
    document.getElementById('scenario-current-tenure').textContent = '0m';
    document.getElementById('scenario-hypothetical-emi').textContent = formatCurrency(0);
    document.getElementById('scenario-hypothetical-interest-saved').textContent = formatCurrency(0);
    document.getElementById('scenario-hypothetical-tenure').textContent = '0m';
}

function renderHypotheticalComparison(baseLoan, hypotheticalPrepaymentImpact) {
    const hypotheticalImpactCard = document.getElementById('hypothetical-impact-card');
    const resultingLoan = hypotheticalPrepaymentImpact?.resultingLoan;

    if (!baseLoan || !hypotheticalPrepaymentImpact || !resultingLoan) {
        resetHypotheticalComparison();
        return;
    }

    hypotheticalImpactCard.classList.remove('hidden');
    hypotheticalImpactCard.classList.remove('scenario-flash');
    void hypotheticalImpactCard.offsetWidth;
    hypotheticalImpactCard.classList.add('scenario-flash');

    document.getElementById('hypothetical-highlight').textContent = `You save ${formatCurrency(hypotheticalPrepaymentImpact.interestSaved)} and ${formatTenure(hypotheticalPrepaymentImpact.monthsReduced)} with this simulation.`;
    document.getElementById('hypothetical-amount').textContent = formatCurrency(hypotheticalPrepaymentImpact.amount);
    document.getElementById('hypothetical-date').textContent = formatDate(hypotheticalPrepaymentImpact.date);
    document.getElementById('scenario-current-emi').textContent = formatCurrency(baseLoan.emi);
    document.getElementById('scenario-current-interest-saved').textContent = formatCurrency(0);
    document.getElementById('scenario-current-tenure').textContent = formatTenure(baseLoan.totalMonths);
    document.getElementById('scenario-hypothetical-emi').textContent = formatCurrency(resultingLoan.emi);
    document.getElementById('scenario-hypothetical-interest-saved').textContent = formatCurrency(hypotheticalPrepaymentImpact.interestSaved);
    document.getElementById('scenario-hypothetical-tenure').textContent = formatTenure(resultingLoan.totalMonths);
}

function refreshWhatIfComparison({ showErrors = false } = {}) {
    clearMessages('what-if-validation');

    const { amountStr, dateStr } = getHypotheticalPrepaymentInput();
    const hypotheticalValidation = validateHypotheticalPrepayment(amountStr, dateStr);

    if (!hypotheticalValidation.isValid) {
        resetHypotheticalComparison();
        if (showErrors) {
            hypotheticalValidation.errors.forEach((err) => displayMessage('error', err, 'what-if-validation'));
        }
        return null;
    }

    if (!lastSimulationResult || !hypotheticalValidation.validatedData) {
        resetHypotheticalComparison();
        return hypotheticalValidation.validatedData;
    }

    const hypotheticalImpact = calculateHypotheticalPrepaymentImpact(
        lastSimulationResult.modifiedLoan,
        hypotheticalValidation.validatedData,
        lastSimulationResult.updatedSchedule
    );

    renderHypotheticalComparison(lastSimulationResult.modifiedLoan, hypotheticalImpact);
    return hypotheticalValidation.validatedData;
}

function handleWhatIfInputChange() {
    if (!hasRenderedOnce) {
        clearMessages('what-if-validation');
        return;
    }

    refreshWhatIfComparison({ showErrors: true });
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
    resetHypotheticalComparison();

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
            new Date()
        );

        // Display results
        displaySimulationResults(simulationResult);
        lastSimulationResult = simulationResult;
        hasRenderedOnce = true;
        refreshWhatIfComparison({ showErrors: true });

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

function addPrepaymentInput(prefill = {}) {
    const prepaymentCount = document.querySelectorAll('.prepayment-item').length;
    const newPrepaymentDiv = document.createElement('div');
    newPrepaymentDiv.classList.add('form-group', 'prepayment-item');
    newPrepaymentDiv.innerHTML = `
        <label>Prepayment ${prepaymentCount + 1}</label>
        <div class="tenure-inputs">
            <input type="number" class="prepayment-item-amount" min="0" step="0.01" placeholder="Amount (INR)" value="${prefill.amount ?? ''}">
            <input type="date" class="prepayment-item-date" value="${prefill.date ?? ''}">
            <button type="button" class="btn btn-danger btn-sm remove-prepayment">Remove</button>
        </div>
    `;
    prepaymentsList.appendChild(newPrepaymentDiv);
}

function handlePrepaymentListClick(e) {
    if (e.target.classList.contains('remove-prepayment')) {
        e.target.closest('.prepayment-item').remove();
        document.querySelectorAll('.prepayment-item').forEach((item, index) => {
            item.querySelector('label').textContent = `Prepayment ${index + 1}`;
        });
    }
}

async function handleApplyHypotheticalToPrepayments() {
    clearMessages('what-if-validation');
    clearMessages('what-if-applied');
    clearMessages('what-if-apply-next-step');

    const hypotheticalValidation = validateHypotheticalPrepayment(
        hypotheticalAmountInput.value.trim(),
        hypotheticalDateInput.value.trim()
    );

    if (!hypotheticalValidation.isValid) {
        hypotheticalValidation.errors.forEach((err) => displayMessage('error', err, 'what-if-validation'));
        return;
    }

    if (!hypotheticalValidation.validatedData) {
        displayMessage('info', 'Enter a simulation amount and date before adding it to your actual plan.', 'what-if-applied');
        return;
    }

    const shouldApplyNow = applyWhatIfToPlanCheckbox.checked;

    addPrepaymentInput({
        amount: hypotheticalValidation.validatedData.amount,
        date: hypotheticalDateInput.value.trim()
    });

    hypotheticalAmountInput.value = '';
    hypotheticalDateInput.value = '';
    applyWhatIfToPlanCheckbox.checked = false;
    resetHypotheticalComparison();

    displayMessage('success', 'The simulated prepayment has been copied to your Actual Plan.', 'what-if-applied');

    if (hasRenderedOnce) {
        if (shouldApplyNow) {
            await runSimulation();
        } else {
            displayMessage('info', 'Run the simulation again when you want this new actual prepayment to affect your results.', 'what-if-apply-next-step');
        }
    }
}

function displaySimulationResults(simulationResult) {
    const {
        originalLoan,
        modifiedLoan,
        loanProgress,
        prepaymentImpact,
        insights,
        updatedSchedule,
        loanHealth
    } = simulationResult;

    document.getElementById('emi-amount').textContent = formatCurrency(modifiedLoan.emi);
    document.getElementById('total-interest').textContent = formatCurrency(modifiedLoan.totalInterest);
    document.getElementById('total-payment').textContent = formatCurrency(modifiedLoan.totalPayment);
    document.getElementById('loan-tenure-display').textContent = formatTenure(modifiedLoan.totalMonths);

    document.getElementById('compare-original-emi').textContent = formatCurrency(originalLoan.emi);
    document.getElementById('compare-original-interest').textContent = formatCurrency(originalLoan.totalInterest);
    document.getElementById('compare-original-payment').textContent = formatCurrency(originalLoan.totalPayment);
    document.getElementById('compare-original-tenure').textContent = formatTenure(originalLoan.totalMonths);
    document.getElementById('compare-modified-emi').textContent = formatCurrency(modifiedLoan.emi);
    document.getElementById('compare-modified-interest').textContent = formatCurrency(modifiedLoan.totalInterest);
    document.getElementById('compare-modified-payment').textContent = formatCurrency(modifiedLoan.totalPayment);
    document.getElementById('compare-modified-tenure').textContent = formatTenure(modifiedLoan.totalMonths);
    updateScenarioSummary(originalLoan, modifiedLoan, prepaymentImpact, loanHealth);

    document.getElementById('progress-emis-paid').textContent = loanProgress.paidEmis.toLocaleString('en-IN');
    document.getElementById('progress-principal-paid').textContent = formatCurrency(loanProgress.principalPaid);
    document.getElementById('progress-interest-paid').textContent = formatCurrency(loanProgress.interestPaid);
    document.getElementById('progress-remaining-balance').textContent = formatCurrency(loanProgress.remainingBalance);
    document.getElementById('progress-months-remaining').textContent = loanProgress.monthsRemaining.toLocaleString('en-IN');

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

    document.getElementById('loan-health-score').textContent = loanHealth.score.toString();
    document.getElementById('loan-health-rating').textContent = loanHealth.rating;
    document.getElementById('loan-health-message').textContent = loanHealth.message;

    updateEmiPieChart(modifiedLoan.principal, modifiedLoan.totalInterest);
    updatePrincipalInterestChart(updatedSchedule.map((entry) => ({
        month: entry.month,
        principal: entry.cumulativePrincipalPaid,
        interest: entry.cumulativeInterestPaid
    })));
    updateBalanceOverTimeChart(updatedSchedule.map((entry) => ({
        month: entry.month,
        balance: entry.closingBalance
    })));

    populateAmortizationTable(updatedSchedule);
    displaySmartInsights(insights, simulationResult.breakEvenMonth);

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

function updateScenarioSummary(originalLoan, modifiedLoan, prepaymentImpact, loanHealth) {
    const primary = document.getElementById('loan-summary-primary');
    const interest = document.getElementById('loan-summary-interest');
    const prepayment = document.getElementById('loan-summary-prepayment');

    if (prepaymentImpact && prepaymentImpact.interestSaved > 0) {
        primary.textContent = `Your actual prepayment plan already saves ${formatCurrency(prepaymentImpact.interestSaved)} and shortens the loan by ${formatTenure(prepaymentImpact.monthsReduced)}.`;
    } else if (loanHealth.score < 60) {
        primary.textContent = 'Your current loan looks interest-heavy. Add real prepayments only when you are confident, and use the simulation section first to test ideas.';
    } else {
        primary.textContent = 'Your actual plan is stable. Use the simulation section to test one extra prepayment before committing it.';
    }

    const interestRatio = originalLoan.totalInterest > 0 && modifiedLoan.totalPayment > 0
        ? (modifiedLoan.totalInterest / modifiedLoan.totalPayment) * 100
        : 0;
    interest.textContent = `Interest is about ${interestRatio.toFixed(1)}% of total cash outflow in your current actual plan.`;

    if (document.getElementById('hypothetical-impact-card').classList.contains('hidden')) {
        prepayment.textContent = 'Actual prepayments change your main results. Simulation-only ideas stay separate until you add them to your actual plan.';
    } else {
        prepayment.textContent = 'The simulation card below compares your current actual plan with a hypothetical extra prepayment without changing the main results.';
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

emiForm.addEventListener('input', debounce((event) => {
    const target = event.target;

    if (!target) {
        return;
    }

    if (target.id === 'hypothetical-prepayment-amount' || target.id === 'hypothetical-prepayment-date' || target.id === 'apply-what-if-to-plan') {
        return;
    }

    if (hasRenderedOnce) {
        runSimulation();
    }
}, 300));
}

try {
    initApp();
} catch (error) {
    console.error('App crashed:', error);
}
