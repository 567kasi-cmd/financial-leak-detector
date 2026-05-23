// validation.js - Centralized validation logic for loan simulator

/**
 * Validates main loan input fields.
 * @param {number} amount - Loan amount.
 * @param {number} rate - Annual interest rate (as percentage).
 * @param {number} months - Loan tenure in months.
 * @param {string} startDateStr - Loan start date string (YYYY-MM-DD).
 * @returns {{isValid: boolean, errors: string[]}} Validation result.
 */
export function validateLoanInputs(amount, rate, months, startDateStr) {
    const errors = [];

    if (isNaN(amount) || amount <= 0) {
        errors.push('Loan Amount must be a positive number.');
    }
    if (isNaN(rate) || rate < 0 || rate > 100) { // Assuming max 100% annual rate for flexibility
        errors.push('Annual Interest Rate must be between 0% and 100%.');
    }
    if (isNaN(months) || months <= 0 || months > 600) { // Max 50 years (600 months)
        errors.push('Loan Tenure must be between 1 month and 50 years.');
    }
    const startDate = new Date(startDateStr);
    if (isNaN(startDate.getTime())) {
        errors.push('Please provide a valid Loan Start Date.');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * Validates a list of prepayment inputs.
 * Prepayments are optional. If a row has either amount or date, both must be valid.
 * @param {Array<{amount: string, date: string}>} rawPrepayments - Array of raw prepayment objects.
 * @returns {{isValid: boolean, errors: string[], validatedData: Array<{amount: number, date: Date}>}} Validation result.
 */
export function validatePrepaymentInputs(rawPrepayments) {
    const errors = [];
    const validatedData = [];

    rawPrepayments.forEach((raw, index) => {
        const hasAmount = raw.amount !== '';
        const hasDate = raw.date !== '';
        const amount = parseFloat(raw.amount);
        const date = new Date(raw.date);

        // If both are empty, skip this entry (it's optional)
        if (!hasAmount && !hasDate) {
            return;
        }

        let itemErrors = [];
        if (!hasAmount) {
            itemErrors.push(`Prepayment ${index + 1}: Amount is required when a date is provided.`);
        } else if (isNaN(amount) || amount <= 0) {
            itemErrors.push(`Prepayment ${index + 1}: Amount must be a positive number.`);
        }
        if (!hasDate) {
            itemErrors.push(`Prepayment ${index + 1}: Date is required when an amount is provided.`);
        } else if (isNaN(date.getTime())) {
            itemErrors.push(`Prepayment ${index + 1}: Date must be valid.`);
        }

        if (itemErrors.length > 0) {
            errors.push(...itemErrors);
        } else {
            validatedData.push({ amount: Math.round(amount), date });
        }
    });

    return {
        isValid: errors.length === 0,
        errors: errors,
        validatedData: validatedData
    };
}

/**
 * Validates hypothetical prepayment inputs.
 * Hypothetical prepayment is optional. If either amount or date is provided, both must be valid.
 * @param {string} amountStr - Hypothetical prepayment amount string.
 * @param {string} dateStr - Hypothetical prepayment date string (YYYY-MM-DD).
 * @returns {{isValid: boolean, errors: string[], validatedData: {amount: number, date: Date}|null}} Validation result.
 */
export function validateHypotheticalPrepayment(amountStr, dateStr) {
    const errors = [];
    let validatedData = null;
    const hasAmount = amountStr !== '';
    const hasDate = dateStr !== '';

    // If both are empty, it's valid and there's no data
    if (!hasAmount && !hasDate) {
        return { isValid: true, errors: [], validatedData: null };
    }

    const amount = parseFloat(amountStr);
    const date = new Date(dateStr);

    if (!hasAmount) {
        errors.push('Simulation Prepayment: Amount is required when a date is provided.');
    } else if (isNaN(amount)) {
        errors.push('Simulation Prepayment: Amount must be a valid number.');
    } else if (amount < 0) {
        errors.push('Simulation Prepayment: Amount cannot be negative.');
    } else if (amount === 0) {
        errors.push('Simulation Prepayment: Amount must be greater than 0.');
    }
    if (!hasDate) {
        errors.push('Simulation Prepayment: Date is required when an amount is provided.');
    } else if (isNaN(date.getTime())) {
        errors.push('Simulation Prepayment: Date must be valid.');
    }

    if (errors.length === 0) {
        validatedData = { amount: Math.round(amount), date };
    }

    return {
        isValid: errors.length === 0,
        errors: errors,
        validatedData: validatedData
    };
}
