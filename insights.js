// insights.js - Smart insight generation engine

/**
 * Generate comprehensive financial insights
 * @param {object} results - Calculation results
 * @param {number} principal - Principal amount
 * @param {number} annualRate - Annual interest rate
 * @param {number} minPaymentPercent - Minimum payment percentage
 * @param {number} extraPayment - Extra payment (optional)
 * @returns {array} Array of insight objects
 */
function generateInsights(results, principal, annualRate, minPaymentPercent, extraPayment = 0) {
    const insights = [];
    const monthlyRate = annualRate / 100 / 12;
    const firstMonthInterest = principal * monthlyRate;
    const minPaymentAmount = principal * (minPaymentPercent / 100);

    // Insight 1: Extremely High Interest
    if (results.totalInterest > principal * 0.7) {
        insights.push({
            type: 'danger',
            icon: '🚨',
            title: 'Extremely High Interest Rate',
            message: `You'll pay ₹${formatCurrency(results.totalInterest)} in interest - that's ${((results.totalInterest / principal) * 100).toFixed(0)}% of your principal!`,
            action: 'Consider balance transfer to 0% APR card or negotiate lower rate with bank.'
        });
    } else if (results.totalInterest > principal * 0.5) {
        insights.push({
            type: 'warning',
            icon: '⚠️',
            title: 'High Interest Payments',
            message: `Total interest is ₹${formatCurrency(results.totalInterest)} - over 50% of your principal.`,
            action: 'Increase monthly payments to reduce interest burden.'
        });
    }

    // Insight 2: Long Repayment Period
    if (results.months > 60) {
        insights.push({
            type: 'danger',
            icon: '⏳',
            title: 'Very Long Repayment Period',
            message: `It will take ${results.years} years ${results.remainingMonths} months to clear this debt with current payment.`,
            action: 'Even small increases in monthly payment can save years of payments.'
        });
    } else if (results.months > 36) {
        insights.push({
            type: 'warning',
            icon: '⏱️',
            title: 'Extended Repayment Timeline',
            message: `Taking ${results.years} years to repay increases total interest significantly.`,
            action: 'Try to increase payments to ₹${(principal * 0.1).toLocaleString("en-IN")} monthly.'
        });
    }

    // Insight 3: Debt Trap (minimum payment < interest)
    if (minPaymentAmount < firstMonthInterest) {
        insights.push({
            type: 'danger',
            icon: '🔴',
            title: '⚠️ DEBT TRAP DETECTED',
            message: 'Your minimum payment (₹' + formatCurrency(minPaymentAmount) + ') is LESS than monthly interest (₹' + formatCurrency(firstMonthInterest) + '). Your debt is GROWING.',
            action: 'URGENT: Increase payment immediately to avoid debt spiral.'
        });
    }

    // Insight 4: Financial Health Assessment
    const interestRatio = results.totalInterest / principal;
    if (interestRatio < 0.2) {
        insights.push({
            type: 'safe',
            icon: '✅',
            title: 'Good Debt Management',
            message: 'Your interest is only ' + (interestRatio * 100).toFixed(0) + '% of principal - well managed!',
            action: 'Keep maintaining this payment discipline.'
        });
    }

    // Insight 5: Extra Payment Impact
    if (extraPayment > 0) {
        const withoutExtra = simulateDebtPayoff(principal, annualRate, minPaymentPercent, 0);
        const savings = withoutExtra.totalInterest - results.totalInterest;

        insights.push({
            type: 'success',
            icon: '💚',
            title: 'Impact of Extra Payment',
            message: `Paying ₹${formatCurrency(extraPayment)} extra/month saves ₹${formatCurrency(savings)} in interest and ${withoutExtra.months - results.months} months!`,
            action: 'This is excellent - keep up the extra payments!'
        });
    }

    // Insight 6: Immediate Action
    if (results.months > 0) {
        const monthlyPaymentNeeded = (principal + results.totalInterest) / results.months;
        insights.push({
            type: 'info',
            icon: '📊',
            title: 'Average Monthly Payment',
            message: `You need to pay ₹${formatCurrency(monthlyPaymentNeeded)} monthly to clear in ${results.months} months.`,
            action: 'Set up automatic payment to stay on track.'
        });
    }

    // Insight 7: Alternative Scenario
    if (results.months > 24) {
        const aggressiveExtra = principal * 0.15; // 15% of principal
        const aggressive = simulateDebtPayoff(principal, annualRate, minPaymentPercent, aggressiveExtra);
        const interestSaved = results.totalInterest - aggressive.totalInterest;

        insights.push({
            type: 'suggestion',
            icon: '💡',
            title: 'Accelerated Payoff Strategy',
            message: `If you could pay ₹${formatCurrency(aggressiveExtra)} extra monthly, you'd clear debt in ${aggressive.months} months and save ₹${formatCurrency(interestSaved)}!`,
            action: 'Try to find this amount in your budget - it's game-changing.'
        });
    }

    // If no negative insights, add encouragement
    if (insights.length === 0) {
        insights.push({
            type: 'safe',
            icon: '🎉',
            title: 'Manageable Debt Situation',
            message: 'Your debt repayment looks reasonable. Keep making regular payments.',
            action: 'Monitor your progress monthly.'
        });
    }

    return insights;
}

/**
 * Generate recommendations based on risk level
 * @param {number} riskScore - Risk score (0-100)
 * @returns {array} Personalized recommendations
 */
function generateRecommendations(riskScore) {
    const recommendations = [];

    if (riskScore >= 75) {
        recommendations.push('Seek help from a financial advisor or credit counselor');
        recommendations.push('Negotiate with creditors for lower interest rates');
        recommendations.push('Consider debt consolidation or balance transfer options');
    } else if (riskScore >= 50) {
        recommendations.push('Create a strict budget and stick to it');
        recommendations.push('Try to allocate any bonus/extra income to debt reduction');
        recommendations.push('Stop using credit cards for new purchases');
    } else if (riskScore >= 30) {
        recommendations.push('Increase monthly payments when possible');
        recommendations.push('Monitor your spending and avoid lifestyle inflation');
        recommendations.push('Build emergency fund to avoid future debt');
    } else {
        recommendations.push('Maintain current payment discipline');
        recommendations.push('Focus on building wealth and investments');
        recommendations.push('Help others understand debt management');
    }

    return recommendations;
}

/**
 * Format currency amount
 * @param {number} amount - Amount to format
 * @returns {string} Formatted string
 */
function formatCurrency(amount) {
    return amount.toLocaleString('en-IN', {
        maximumFractionDigits: 0
    });
}
