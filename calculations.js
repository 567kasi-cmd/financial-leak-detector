// calculations.js - Core financial calculation engine

/**
 * Simulate credit card debt payoff with compound interest
 * @param {number} principal - Initial outstanding amount
 * @param {number} annualRate - Annual interest rate (%)
 * @param {number} minPaymentPercent - Minimum payment percentage
 * @param {number} extraPayment - Extra monthly payment (₹)
 * @returns {object} Detailed simulation results
 */
function simulateDebtPayoff(principal, annualRate, minPaymentPercent, extraPayment = 0) {
    const monthlyRate = annualRate / 100 / 12;
    let balance = principal;
    let totalInterest = 0;
    let months = 0;
    const monthlyData = [];
    const maxMonths = 600; // 50 years safety limit

    while (balance > 0.01 && months < maxMonths) {
        const interest = balance * monthlyRate;
        totalInterest += interest;

        const minPayment = balance * (minPaymentPercent / 100);
        const totalPayment = Math.max(minPayment + extraPayment, balance + interest);

        balance = Math.max(0, balance + interest - totalPayment);
        months++;

        monthlyData.push({
            month: months,
            balance: Math.max(0, balance),
            interest: interest,
            payment: totalPayment
        });

        if (balance > principal * 5) break; // Debt exploding - stop
    }

    return {
        monthlyRate: (monthlyRate * 100).toFixed(4),
        months: months,
        years: Math.floor(months / 12),
        remainingMonths: months % 12,
        totalInterest: parseFloat(totalInterest.toFixed(2)),
        totalPaid: parseFloat((principal + totalInterest).toFixed(2)),
        monthlyData: monthlyData,
        monthlyDataLimited: monthlyData.slice(0, Math.min(monthlyData.length, 120)) // Last 10 years
    };
}

/**
 * Calculate EMI (Equated Monthly Installment) for loans
 * @param {number} principal - Loan amount
 * @param {number} annualRate - Annual interest rate (%)
 * @param {number} months - Loan tenure in months
 * @returns {object} EMI and detailed breakdown
 */
function calculateEMI(principal, annualRate, months) {
    const monthlyRate = annualRate / 100 / 12;

    if (monthlyRate === 0) {
        return {
            emi: parseFloat((principal / months).toFixed(2)),
            totalPayment: principal,
            totalInterest: 0,
            monthlyData: generateAMortizationSchedule(principal, 0, months)
        };
    }

    const numerator = principal * monthlyRate * Math.pow(1 + monthlyRate, months);
    const denominator = Math.pow(1 + monthlyRate, months) - 1;
    const emi = numerator / denominator;
    const totalPayment = emi * months;
    const totalInterest = totalPayment - principal;

    return {
        emi: parseFloat(emi.toFixed(2)),
        totalPayment: parseFloat(totalPayment.toFixed(2)),
        totalInterest: parseFloat(totalInterest.toFixed(2)),
        monthlyData: generateAMortizationSchedule(principal, monthlyRate, months, emi)
    };
}

/**
 * Generate amortization schedule for loans
 * @param {number} principal - Loan amount
 * @param {number} monthlyRate - Monthly interest rate (decimal)
 * @param {number} months - Total tenure in months
 * @param {number} emi - EMI amount
 * @returns {array} Monthly breakdown
 */
function generateAMortizationSchedule(principal, monthlyRate, months, emi) {
    let balance = principal;
    const schedule = [];

    for (let i = 1; i <= Math.min(months, 120); i++) {
        const interest = balance * monthlyRate;
        const principalPayment = emi - interest;
        balance -= principalPayment;

        schedule.push({
            month: i,
            payment: parseFloat(emi.toFixed(2)),
            principal: parseFloat(Math.max(0, principalPayment).toFixed(2)),
            interest: parseFloat(interest.toFixed(2)),
            balance: parseFloat(Math.max(0, balance).toFixed(2))
        });

        if (balance <= 0) break;
    }

    return schedule;
}

/**
 * Calculate impact of prepayment (extra payment)
 * @param {number} principal - Outstanding amount
 * @param {number} annualRate - Annual interest rate
 * @param {number} minPaymentPercent - Minimum payment percentage
 * @param {number} extraPaymentAmount - Extra monthly payment
 * @returns {object} Comparison of with/without extra payment
 */
function calculatePrepaymentSavings(principal, annualRate, minPaymentPercent, extraPaymentAmount) {
    const without = simulateDebtPayoff(principal, annualRate, minPaymentPercent, 0);
    const with_ = simulateDebtPayoff(principal, annualRate, minPaymentPercent, extraPaymentAmount);

    return {
        without: without,
        with: with_,
        savings: {
            interestSaved: parseFloat((without.totalInterest - with_.totalInterest).toFixed(2)),
            monthsSaved: without.months - with_.months,
            totalPaymentReduction: parseFloat((without.totalPaid - with_.totalPaid).toFixed(2))
        }
    };
}

/**
 * Calculate debt-to-income ratio risk
 * @param {number} totalDebt - Total debt amount
 * @param {number} monthlyIncome - Monthly income
 * @returns {object} Risk assessment
 */
function assessDebtRisk(totalDebt, monthlyIncome) {
    const ratio = totalDebt / (monthlyIncome * 12);

    let riskLevel = 'Low';
    let riskScore = 0; // 0-100
    let advice = '';

    if (ratio > 1) {
        riskLevel = 'Critical';
        riskScore = 95;
        advice = 'Your debt exceeds your annual income. Seek financial counseling immediately.';
    } else if (ratio > 0.75) {
        riskLevel = 'High';
        riskScore = 75;
        advice = 'Consider aggressive debt reduction strategy.';
    } else if (ratio > 0.5) {
        riskLevel = 'Moderate';
        riskScore = 50;
        advice = 'Focus on increasing income or reducing debt.';
    } else if (ratio > 0.25) {
        riskLevel = 'Manageable';
        riskScore = 30;
        advice = 'On track but monitor spending closely.';
    } else {
        riskLevel = 'Healthy';
        riskScore = 15;
        advice = 'Excellent debt management. Continue current strategy.';
    }

    return {
        ratio: parseFloat(ratio.toFixed(2)),
        riskLevel: riskLevel,
        riskScore: riskScore,
        advice: advice
    };
}
