// insights.js - Smart insight generation engine

// Helper for currency formatting (local to insights.js)
const formatCurrency = (amount) => {
    if (isNaN(amount)) return '₹0';
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

// Helper for date formatting (local to insights.js)
function formatDate(date) {
    if (!date) return '';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(date).toLocaleDateString('en-IN', options);
}

/**
 * Generate enhanced insights with actionable recommendations and savings calculations
 * @param {object} simulationResults - The full simulation result object from loanSimulator.js
 * @returns {array} Array of enhanced insight objects
 */
export function generateEnhancedInsights(simulationResults) {
    const insights = [];
    const { originalLoan, modifiedLoan, loanProgress, prepaymentImpact, hypotheticalPrepaymentImpact, loanHealth } = simulationResults;

    const principal = modifiedLoan.principal; // Use original principal for comparison base
    const annualRate = modifiedLoan.annualInterestRate * 100; // Convert back to percentage for display
    const monthlyRate = modifiedLoan.annualInterestRate / 12;
    const currentEmi = modifiedLoan.emi;
    const totalMonths = modifiedLoan.totalMonths;
    const totalInterest = modifiedLoan.totalInterest;

    // --- CRITICAL INSIGHTS ---

    // Insight 1: Debt Trap (EMI not covering interest)
    if (currentEmi < (principal * monthlyRate) && principal > 0) {
        const requiredPaymentToCoverInterest = Math.ceil(principal * monthlyRate * 1.05); // 5% more than interest
        insights.push({
            type: 'danger',
            icon: '🚨',
            title: 'CRITICAL: Debt Trap Detected!',
            message: `Your current EMI (₹${formatCurrency(currentEmi)}) is less than the monthly interest (₹${formatCurrency(principal * monthlyRate)}). Your principal balance is increasing!`,
            action: `URGENT: Increase your monthly payment to at least ₹${formatCurrency(requiredPaymentToCoverInterest)} to start paying down principal.`,
            savings: null // No direct savings calculation here, but prevents debt growth
        });
    }

    // Insight 2: Extremely High Interest Burden
    const interestRatio = principal > 0 ? totalInterest / principal : 0;
    if (interestRatio > 1.0) { // Total interest is more than principal
        insights.push({
            type: 'danger',
            icon: '💸',
            title: 'Extremely High Interest Burden',
            message: `You'll pay over ${interestRatio.toFixed(1)} times your principal in interest alone. This is extremely expensive debt.`,
            action: 'Prioritize aggressive prepayments, consider refinancing to a lower rate, or explore balance transfer options.',
            savings: null
        });
    } else if (interestRatio > 0.7) {
        insights.push({
            type: 'warning',
            icon: '⚠️',
            title: 'High Interest Payments',
            message: `Total interest is ₹${formatCurrency(totalInterest)} - over 70% of your principal.`,
            action: 'Increase monthly payments to reduce interest burden. Even small increases help significantly.',
            savings: null
        });
    }

    // Insight 3: Very Long Payoff Period
    if (totalMonths > 600) { // > 50 years, effectively infinite
        insights.push({
            type: 'danger',
            icon: '⏳',
            title: 'EXTREMELY Long Repayment Period',
            message: `At this rate, it will take over 50 years to clear this debt. This is unsustainable.`,
            action: 'You must significantly increase your monthly payments or reduce the principal through large prepayments.',
            savings: null
        });
    } else if (totalMonths > 360) { // > 30 years
        insights.push({
            type: 'warning',
            icon: '⏳',
            title: 'Very Long Repayment Period',
            message: `It will take ${Math.floor(totalMonths / 12)} years and ${totalMonths % 12} months to clear this debt.`,
            action: 'Consider increasing your EMI or making prepayments to shorten the tenure and save on interest.',
            savings: null
        });
    }

    // --- POSITIVE & ACTIONABLE INSIGHTS ---

    // Insight 4: Actual Prepayment Impact
    if (prepaymentImpact && prepaymentImpact.interestSaved > 0) {
        insights.push({
            type: 'success',
            icon: '💚',
            title: 'Actual Prepayments Made a Difference!',
            message: `Your actual prepayments saved you ₹${formatCurrency(prepaymentImpact.interestSaved)} in interest and reduced your loan tenure by ${prepaymentImpact.monthsReduced} months!`,
            action: 'Excellent strategy! Keep up the extra payments to accelerate debt freedom.',
            savings: prepaymentImpact.interestSaved
        });
    }

    // Insight 5: Hypothetical Prepayment Impact
    if (hypotheticalPrepaymentImpact && hypotheticalPrepaymentImpact.interestSaved > 0) {
        insights.push({
            type: 'info',
            icon: '💡',
            title: '"What If" Prepayment Impact',
            message: `A hypothetical prepayment of ₹${formatCurrency(hypotheticalPrepaymentImpact.amount)} on ${formatDate(hypotheticalPrepaymentImpact.date)} could save you an additional ₹${formatCurrency(hypotheticalPrepaymentImpact.interestSaved)} and reduce your loan by ${hypotheticalPrepaymentImpact.monthsReduced} months!`,
            action: 'Consider making this prepayment if your finances allow.',
            savings: hypotheticalPrepaymentImpact.interestSaved
        });
    }

    // Insight 6: Loan Health Score
    if (loanHealth.score < 60) {
        insights.push({
            type: 'warning',
            icon: '🩺',
            title: `Loan Health: ${loanHealth.rating}`,
            message: `Your loan health score is ${loanHealth.score}/100. ${loanHealth.message}`,
            action: 'Review your loan details and consider the recommendations to improve your financial standing.'
        });
    } else if (loanHealth.score >= 80) {
        insights.push({
            type: 'success',
            icon: '✅',
            title: `Loan Health: ${loanHealth.rating}`,
            message: `Your loan health score is ${loanHealth.score}/100. ${loanHealth.message}`,
            action: 'Keep up the great work in managing your loan!'
        });
    }

    // Insight 7: Early vs. Late Prepayment (if multiple prepayments or hypothetical exists)
    if (prepaymentImpact && prepaymentImpact.monthsReduced > 0 && prepaymentImpact.interestSaved > 0) {
        insights.push({
            type: 'info',
            icon: '📅',
            title: 'Power of Early Prepayments',
            message: 'Prepayments made earlier in the loan tenure have a much larger impact on total interest saved.',
            action: 'Aim to make prepayments as early as possible in your loan cycle.'
        });
    }

    // Insight 8: Break-even point
    if (simulationResults.breakEvenMonth !== null) {
        insights.push({
            type: 'info',
            icon: '⚖️',
            title: 'Break-Even Point Reached',
            message: `You will have paid more principal than interest by month ${simulationResults.breakEvenMonth}.`,
            action: 'This indicates good progress in your loan repayment journey.'
        });
    } else {
        insights.push({
            type: 'warning',
            icon: '📈',
            title: 'Break-Even Point Not Reached',
            message: 'You will pay more interest than principal throughout the entire loan tenure.',
            action: 'Consider increasing payments to reach the break-even point sooner and save interest.'
        });
    }

    // Insight 9: Zero Interest Rate (Edge Case)
    if (annualRate === 0 && principal > 0) {
        insights.push({
            type: 'success',
            icon: '🎉',
            title: 'Interest-Free Loan!',
            message: 'Congratulations! Your loan has a 0% interest rate, meaning you only repay the principal amount.',
            action: 'Ensure you make regular payments to clear the principal on time.'
        });
    }

    // Default/Fallback Insight if no specific insights are generated
    if (insights.length === 0) {
        insights.push({
            type: 'safe',
            icon: '✅',
            title: 'Manageable Loan Situation',
            message: 'Your loan repayment appears to be on track with no major concerns.',
            action: 'Continue monitoring your loan progress and consider small prepayments to save more.'
        });
    }

    return insights;
}
