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
 * Generate enhanced insights with actionable recommendations and savings calculations
 * @param {object} results - Calculation results
 * @param {number} principal - Principal amount
 * @param {number} annualRate - Annual interest rate
 * @param {number} minPaymentPercent - Minimum payment percentage
 * @param {number} extraPayment - Extra payment amount
 * @returns {array} Array of enhanced insight objects
 */
function generateEnhancedInsights(results, principal, annualRate, minPaymentPercent, extraPayment = 0) {
    const insights = [];
    const monthlyRate = annualRate / 100 / 12;
    const firstMonthInterest = principal * monthlyRate;
    const minPaymentAmount = principal * (minPaymentPercent / 100);

    // Critical Debt Trap Insight
    if (minPaymentAmount < firstMonthInterest) {
        const requiredPayment = Math.ceil(firstMonthInterest + 1);
        const increaseNeeded = requiredPayment - minPaymentAmount;
        const savings = calculatePotentialSavings(principal, annualRate, minPaymentPercent, requiredPayment);

        insights.push({
            type: 'danger',
            icon: '🚨',
            title: 'CRITICAL: Debt Trap Detected',
            message: `Your minimum payment (₹${minPaymentAmount.toLocaleString('en-IN')}) is LESS than monthly interest (₹${firstMonthInterest.toFixed(0).toLocaleString('en-IN')}). Your debt is GROWING every month!`,
            action: `Increase your monthly payment by at least ₹${increaseNeeded.toLocaleString('en-IN')} to break the cycle.`,
            savings: savings.interestSaved
        });
    }

    // High Interest Burden
    const interestRatio = results.totalInterest / principal;
    if (interestRatio > 0.7) {
        const optimalPayment = calculateOptimalPayment(principal, annualRate, minPaymentPercent);
        const savings = calculatePotentialSavings(principal, annualRate, minPaymentPercent, optimalPayment);

        insights.push({
            type: 'danger',
            icon: '💸',
            title: 'Extremely High Interest Burden',
            message: `You'll pay ${interestRatio.toFixed(1)}x your principal in interest alone. This is extremely expensive debt.`,
            action: `Pay at least ₹${optimalPayment.toLocaleString('en-IN')}/month to reduce interest to a reasonable level.`,
            savings: savings.interestSaved
        });
    } else if (interestRatio > 0.5) {
        const optimalPayment = calculateOptimalPayment(principal, annualRate, minPaymentPercent);
        const savings = calculatePotentialSavings(principal, annualRate, minPaymentPercent, optimalPayment);

        insights.push({
            type: 'warning',
            icon: '⚠️',
            title: 'High Interest Payments',
            message: `Total interest is ${interestRatio.toFixed(1)}x your principal amount.`,
            action: `Consider increasing payments to ₹${optimalPayment.toLocaleString('en-IN')}/month.`,
            savings: savings.interestSaved
        });
    }

    // Long Payoff Period
    if (results.months > 60) {
        const aggressivePayment = principal * 0.05; // 5% of principal
        const savings = calculatePotentialSavings(principal, annualRate, minPaymentPercent, aggressivePayment);

        insights.push({
            type: 'danger',
            icon: '⏳',
            title: 'Very Long Payoff Timeline',
            message: `It will take ${results.years} years ${results.remainingMonths} months to clear this debt with current payments.`,
            action: `Pay ₹${aggressivePayment.toLocaleString('en-IN')}/month extra to clear debt in just ${savings.monthsSaved} months.`,
            savings: savings.interestSaved
        });
    } else if (results.months > 36) {
        const moderatePayment = principal * 0.03; // 3% of principal
        const savings = calculatePotentialSavings(principal, annualRate, minPaymentPercent, moderatePayment);

        insights.push({
            type: 'warning',
            icon: '📅',
            title: 'Extended Payoff Period',
            message: `Taking ${results.years} years to repay increases total interest significantly.`,
            action: `Add ₹${moderatePayment.toLocaleString('en-IN')}/month to save ${savings.monthsSaved} months.`,
            savings: savings.interestSaved
        });
    }

    // Extra Payment Impact
    if (extraPayment > 0) {
        const withoutExtra = simulateDebtPayoff(principal, annualRate, minPaymentPercent, 0);
        const interestSaved = withoutExtra.totalInterest - results.totalInterest;
        const monthsSaved = withoutExtra.months - results.months;

        insights.push({
            type: 'success',
            icon: '💚',
            title: 'Extra Payment Impact',
            message: `Your ₹${extraPayment.toLocaleString('en-IN')}/month extra payment saves you ₹${interestSaved.toLocaleString('en-IN')} in interest and ${monthsSaved} months!`,
            action: 'Excellent strategy! Keep up the extra payments to accelerate debt freedom.',
            savings: interestSaved
        });
    }

    // Optimal Payment Suggestion
    if (results.months > 12 && extraPayment === 0) {
        const optimalPayment = calculateOptimalPayment(principal, annualRate, minPaymentPercent);
        const savings = calculatePotentialSavings(principal, annualRate, minPaymentPercent, optimalPayment);

        insights.push({
            type: 'info',
            icon: '💡',
            title: 'Optimal Payment Strategy',
            message: `Pay ₹${optimalPayment.toLocaleString('en-IN')}/month to clear debt in 12 months instead of ${results.months} months.`,
            action: `This would save you ₹${savings.interestSaved.toLocaleString('en-IN')} in interest.`,
            savings: savings.interestSaved
        });
    }

    // Interest Rate Analysis
    if (annualRate > 25) {
        insights.push({
            type: 'warning',
            icon: '📈',
            title: 'High Interest Rate',
            message: `${annualRate}% APR is very high. Consider balance transfer options.`,
            action: 'Look for 0% APR balance transfer cards to save significantly on interest.'
        });
    }

    // Positive Feedback
    if (results.months <= 12 && interestRatio < 0.3) {
        insights.push({
            type: 'success',
            icon: '🎉',
            title: 'Excellent Debt Management',
            message: 'Your debt payoff strategy is excellent! You\'re managing this very well.',
            action: 'Keep up the great work. Consider building an emergency fund next.'
        });
    }

    // Minimum viable insights
    if (insights.length === 0) {
        insights.push({
            type: 'safe',
            icon: '✅',
            title: 'Manageable Debt Situation',
            message: 'Your debt situation is manageable with current payment strategy.',
            action: 'Monitor your progress monthly and consider small payment increases when possible.'
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

/**
 * Calculate optimal monthly payment for 12-month payoff
 * @param {number} principal - Principal amount
 * @param {number} annualRate - Annual rate
 * @param {number} minPaymentPercent - Min payment percent
 * @returns {number} Optimal monthly payment
 */
function calculateOptimalPayment(principal, annualRate, minPaymentPercent) {
    const monthlyRate = annualRate / 100 / 12;
    const minPayment = principal * (minPaymentPercent / 100);

    // Calculate payment needed for 12-month payoff
    // Formula: EMI = [P x R x (1+R)^N] / [(1+R)^N - 1]
    const n = 12; // 12 months
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);

    return Math.max(minPayment, Math.ceil(emi));
}

/**
 * Calculate potential savings with increased payment
 * @param {number} principal - Principal amount
 * @param {number} annualRate - Annual rate
 * @param {number} minPaymentPercent - Min payment percent
 * @param {number} increasedPayment - Increased monthly payment
 * @returns {object} Savings data
 */
function calculatePotentialSavings(principal, annualRate, minPaymentPercent, increasedPayment) {
    const current = simulateDebtPayoff(principal, annualRate, minPaymentPercent, 0);
    const improved = simulateDebtPayoff(principal, annualRate, minPaymentPercent, increasedPayment);

    return {
        interestSaved: current.totalInterest - improved.totalInterest,
        monthsSaved: current.months - improved.months,
        totalSaved: (current.totalInterest - improved.totalInterest) + (increasedPayment * improved.months)
    };
}
