import { formatCurrency, formatDurationMonths, formatDate } from './shared.js';

/**
 * Insights for credit-card debt payoff flows.
 * @param {object} results - Debt payoff result.
 * @param {number} principal - Outstanding balance.
 * @param {number} annualRate - APR.
 * @param {number} minPaymentPercent - Minimum payment percentage.
 * @param {number} extraPayment - Extra monthly payment.
 * @returns {Array<object>}
 */
export function generateDebtInsights(results, principal, annualRate, minPaymentPercent, extraPayment = 0) {
    const insights = [];
    const monthlyRate = annualRate / 100 / 12;
    const firstMonthInterest = principal * monthlyRate;
    const firstMonthMinimum = principal * (minPaymentPercent / 100);
    const firstMonthPayment = firstMonthMinimum + extraPayment;
    const interestRatio = principal > 0 ? results.totalInterest / principal : 0;

    if (firstMonthPayment <= firstMonthInterest) {
        insights.push({
            type: 'danger',
            icon: '!',
            title: 'Debt trap risk',
            message: `Your first payment of ${formatCurrency(firstMonthPayment)} does not fully cover the first month's interest of ${formatCurrency(firstMonthInterest)}.`,
            action: `Increase the monthly payment above ${formatCurrency(firstMonthInterest)} to start reducing the balance.`
        });
    }

    if (results.months >= 600) {
        insights.push({
            type: 'danger',
            icon: '!',
            title: 'Unsustainably long payoff',
            message: 'At the current payment pace, the balance does not clear within the 50-year safety limit.',
            action: 'Raise the payment amount materially or reduce the interest rate.'
        });
    } else if (results.months > 120) {
        insights.push({
            type: 'warning',
            icon: 'i',
            title: 'Long payoff horizon',
            message: `This payoff plan runs for ${formatDurationMonths(results.months)}.`,
            action: 'Even a modest extra payment each month can cut years off the timeline.'
        });
    }

    if (interestRatio > 1) {
        insights.push({
            type: 'danger',
            icon: '!',
            title: 'Interest exceeds principal',
            message: `Total interest of ${formatCurrency(results.totalInterest)} is higher than the original balance.`,
            action: 'Prioritize this debt before lower-interest goals if possible.'
        });
    } else if (interestRatio > 0.5) {
        insights.push({
            type: 'warning',
            icon: 'i',
            title: 'Heavy interest burden',
            message: `Interest adds up to ${Math.round(interestRatio * 100)}% of the original balance.`,
            action: 'Try higher fixed payments instead of relying on minimum payments alone.'
        });
    }

    if (extraPayment > 0) {
        insights.push({
            type: 'success',
            icon: '+',
            title: 'Extra payment strategy active',
            message: `An extra ${formatCurrency(extraPayment)} each month accelerates the payoff and reduces interest leakage.`,
            action: 'Keep the extra payment consistent for the strongest impact.'
        });
    } else {
        insights.push({
            type: 'info',
            icon: 'i',
            title: 'Fastest win',
            message: 'Small recurring extra payments usually have the biggest impact on credit-card debt.',
            action: 'Test an extra monthly amount in the scenario section below.'
        });
    }

    if (insights.length === 0) {
        insights.push({
            type: 'success',
            icon: '+',
            title: 'Manageable debt plan',
            message: 'This payoff plan is progressing without major warning signs.',
            action: 'Review it periodically as rates, income, and cash flow change.'
        });
    }

    return insights;
}

/**
 * Insights for the loan simulator flow.
 * @param {object} simulationResults - Loan simulator result payload.
 * @returns {Array<object>}
 */
export function generateEnhancedInsights(simulationResults) {
    const insights = [];
    const {
        modifiedLoan,
        loanProgress,
        prepaymentImpact,
        hypotheticalPrepaymentImpact,
        futurePrepaymentPlanImpact,
        loanHealth,
        breakEvenMonth
    } = simulationResults;

    const principal = modifiedLoan.principal;
    const currentEmi = modifiedLoan.emi;
    const totalMonths = modifiedLoan.totalMonths;
    const totalInterest = modifiedLoan.totalInterest;
    const monthlyRate = modifiedLoan.annualInterestRate / 12;
    const interestRatio = principal > 0 ? totalInterest / principal : 0;

    if (currentEmi < principal * monthlyRate && principal > 0) {
        const targetPayment = Math.ceil(principal * monthlyRate * 1.05);
        insights.push({
            type: 'danger',
            icon: '!',
            title: 'EMI below interest',
            message: `The EMI of ${formatCurrency(currentEmi)} is below the monthly interest charge.`,
            action: `Increase the EMI to at least ${formatCurrency(targetPayment)} to reduce principal consistently.`
        });
    }

    if (interestRatio > 1) {
        insights.push({
            type: 'danger',
            icon: '!',
            title: 'Very expensive loan',
            message: `Total interest is more than the original principal at ${formatCurrency(totalInterest)}.`,
            action: 'Consider refinancing, shortening tenure, or making prepayments early.'
        });
    } else if (interestRatio > 0.6) {
        insights.push({
            type: 'warning',
            icon: 'i',
            title: 'High interest burden',
            message: `Interest adds up to roughly ${Math.round(interestRatio * 100)}% of the borrowed amount.`,
            action: 'Compare shorter tenure and prepayment options before locking the plan.'
        });
    }

    if (prepaymentImpact && prepaymentImpact.interestSaved > 0) {
        insights.push({
            type: 'success',
            icon: '+',
            title: 'Prepayments are working',
            message: `Actual prepayments save ${formatCurrency(prepaymentImpact.interestSaved)} and cut ${prepaymentImpact.monthsReduced} months.`,
            action: 'Keep prepayments early in the schedule to maximize savings.'
        });
    }

    if (futurePrepaymentPlanImpact && futurePrepaymentPlanImpact.additionalInterestSaved > 0) {
        insights.push({
            type: 'info',
            icon: 'i',
            title: 'Future plan adds value',
            message: `Your planned prepayments can save an additional ${formatCurrency(futurePrepaymentPlanImpact.additionalInterestSaved)} and reduce the schedule by ${futurePrepaymentPlanImpact.additionalMonthsReduced} more month(s).`,
            action: 'Use the optional reduced EMI only if cash flow matters more than finishing early.'
        });
    } else if (hypotheticalPrepaymentImpact && hypotheticalPrepaymentImpact.interestSaved > 0) {
        insights.push({
            type: 'info',
            icon: 'i',
            title: 'Useful what-if scenario',
            message: `A prepayment of ${formatCurrency(hypotheticalPrepaymentImpact.amount)} on ${formatDate(hypotheticalPrepaymentImpact.date)} can save ${formatCurrency(hypotheticalPrepaymentImpact.interestSaved)}.`,
            action: 'Use this as a target for bonus, windfall, or annual savings planning.'
        });
    }

    if (loanProgress.remainingBalance <= 0.01) {
        insights.push({
            type: 'success',
            icon: '+',
            title: 'Loan closed',
            message: 'The simulated schedule shows the loan fully paid off.',
            action: 'Confirm foreclosure charges with the lender if you plan to settle early.'
        });
    } else if (loanProgress.monthsRemaining <= 12) {
        insights.push({
            type: 'success',
            icon: '+',
            title: 'Final stretch',
            message: `Only ${loanProgress.monthsRemaining} month(s) remain in the simulated schedule.`,
            action: 'A final prepayment could eliminate a meaningful chunk of remaining interest.'
        });
    }

    if (loanHealth.score < 60) {
        insights.push({
            type: 'warning',
            icon: 'i',
            title: `Loan health: ${loanHealth.rating}`,
            message: `Health score is ${loanHealth.score}/100. ${loanHealth.message}`,
            action: 'Review EMI affordability, tenure, and total interest before proceeding.'
        });
    } else if (loanHealth.score >= 80) {
        insights.push({
            type: 'success',
            icon: '+',
            title: `Loan health: ${loanHealth.rating}`,
            message: `Health score is ${loanHealth.score}/100. ${loanHealth.message}`,
            action: 'This structure looks comparatively healthy for a long-term loan.'
        });
    }

    if (breakEvenMonth !== null && breakEvenMonth !== undefined) {
        insights.push({
            type: 'info',
            icon: 'i',
            title: 'Principal-over-interest crossover',
            message: `Principal paid overtakes cumulative interest around month ${breakEvenMonth}.`,
            action: 'Prepayments before this point usually deliver the highest marginal interest savings.'
        });
    }

    if (insights.length === 0) {
        insights.push({
            type: 'success',
            icon: '+',
            title: 'Stable loan plan',
            message: 'The current loan structure does not show any major red flags.',
            action: 'Keep validating assumptions against lender charges, insurance, and processing fees.'
        });
    }

    return insights;
}
