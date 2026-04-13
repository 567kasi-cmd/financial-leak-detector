// script.js - Main application logic and form handling

// Form elements
const form = document.getElementById('calc-form');

// Event listener
form.addEventListener('submit', handleFormSubmit);

/**
 * Handle form submission
 * @param {event} e - Form submit event
 */
function handleFormSubmit(e) {
    e.preventDefault();

    // Get input values
    const outstanding = parseFloat(document.getElementById('outstanding').value);
    const annualRate = parseFloat(document.getElementById('rate').value);
    const minPaymentPercent = parseFloat(document.getElementById('min-payment').value);
    const extraPayment = parseFloat(document.getElementById('extra-payment').value) || 0;

    // Validate inputs
    if (!validateInputs(outstanding, annualRate, minPaymentPercent)) {
        showError('Please enter valid values (positive numbers only)');
        return;
    }

    // Show loading
    showLoading();

    // Simulate calculation (setTimeout for smooth UX)
    setTimeout(() => {
        try {
            // Perform calculations
            const results = simulateDebtPayoff(outstanding, annualRate, minPaymentPercent, extraPayment);

            // Display results
            displayResults(results, outstanding, annualRate, minPaymentPercent, extraPayment);

            // Display insights
            const insights = generateEnhancedInsights(results, outstanding, annualRate, minPaymentPercent, extraPayment);
            displayInsights(insights);

            // Scroll to results
            document.getElementById('results').scrollIntoView({ behavior: 'smooth' });

            hideLoading();
        } catch (error) {
            showError('Calculation error: ' + error.message);
            hideLoading();
        }
    }, 300);
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
