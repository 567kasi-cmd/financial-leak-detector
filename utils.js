// utils.js - Common utility functions for financial calculations

/**
 * Format currency in Indian Rupees
 * @param {number} amount - The amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
    return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Calculate monthly interest rate from annual rate
 * @param {number} annualRate - Annual interest rate in percent
 * @returns {number} Monthly interest rate as decimal
 */
function calculateMonthlyRate(annualRate) {
    return annualRate / 100 / 12;
}

/**
 * Calculate compound interest over time
 * @param {number} principal - Initial amount
 * @param {number} rate - Annual interest rate in percent
 * @param {number} time - Time in years
 * @param {number} compoundingFrequency - Times interest is compounded per year (default: 12 for monthly)
 * @returns {number} Final amount
 */
function calculateCompoundInterest(principal, rate, time, compoundingFrequency = 12) {
    const r = rate / 100;
    const n = compoundingFrequency;
    const t = time;
    return principal * Math.pow(1 + r / n, n * t);
}

/**
 * Calculate simple interest
 * @param {number} principal - Initial amount
 * @param {number} rate - Annual interest rate in percent
 * @param {number} time - Time in years
 * @returns {number} Interest amount
 */
function calculateSimpleInterest(principal, rate, time) {
    return principal * (rate / 100) * time;
}

/**
 * Validate financial input values
 * @param {number} value - Value to validate
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value (optional)
 * @returns {boolean} True if valid
 */
function validateFinancialInput(value, min = 0, max = null) {
    if (typeof value !== 'number' || isNaN(value)) return false;
    if (value < min) return false;
    if (max !== null && value > max) return false;
    return true;
}

/**
 * Generate insight based on debt-to-income ratio (placeholder for future use)
 * @param {number} debt - Total debt
 * @param {number} income - Monthly income
 * @returns {object} Insight object with type, icon, message
 */
function generateDebtToIncomeInsight(debt, income) {
    const ratio = debt / (income * 12); // Annual debt to income
    if (ratio > 0.5) {
        return { type: 'danger', icon: '💸', message: 'High debt-to-income ratio - consider debt consolidation' };
    } else if (ratio > 0.3) {
        return { type: 'warning', icon: '⚠️', message: 'Moderate debt-to-income ratio - monitor spending' };
    } else {
        return { type: 'safe', icon: '✅', message: 'Healthy debt-to-income ratio' };
    }
}

/**
 * Calculate EMI (Equated Monthly Installment) for loans
 * @param {number} principal - Loan amount
 * @param {number} rate - Annual interest rate in percent
 * @param {number} tenure - Tenure in months
 * @returns {number} Monthly EMI
 */
function calculateEMI(principal, rate, tenure) {
    const monthlyRate = rate / 100 / 12;
    const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, tenure) / (Math.pow(1 + monthlyRate, tenure) - 1);
    return emi;
}

/**
 * Calculate total interest paid on loan
 * @param {number} principal - Loan amount
 * @param {number} emi - Monthly EMI
 * @param {number} tenure - Tenure in months
 * @returns {number} Total interest paid
 */
function calculateTotalInterest(principal, emi, tenure) {
    return (emi * tenure) - principal;
}
