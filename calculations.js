// calculations.js - Core financial calculation engine

/**
 * Helper function to add months to a date.
 * @param {Date} date - The starting date.
 * @param {number} months - The number of months to add.
 * @returns {Date} The new date.
 */
function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}

/**
 * Calculates the EMI (Equated Monthly Installment) for a loan.
 * @param {number} principal - The principal loan amount.
 * @param {number} monthlyRate - The monthly interest rate (decimal, e.g., 0.0075 for 0.75%).
 * @param {number} totalMonths - The total loan tenure in months.
 * @returns {number} The calculated EMI.
 */
export function calculateEMI(principal, monthlyRate, totalMonths) {
    if (principal <= 0 || totalMonths <= 0) return 0;
    if (monthlyRate === 0) {
        return principal / totalMonths;
    }
    const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
    return parseFloat(emi.toFixed(2));
}

/**
 * Generates a full amortization schedule for a loan.
 * @param {number} principal - The initial loan amount.
 * @param {number} monthlyRate - The monthly interest rate (decimal).
 * @param {number} emi - The calculated EMI.
 * @param {number} totalMonths - The total loan tenure in months.
 * @param {Date} loanStartDate - The start date of the loan.
 * @returns {Array<object>} An array representing the amortization schedule.
 */
export function generateAmortizationSchedule(principal, monthlyRate, emi, totalMonths, loanStartDate) {
    let balance = principal;
    let cumulativePrincipalPaid = 0;
    let cumulativeInterestPaid = 0;
    const schedule = [];

    for (let month = 1; month <= totalMonths && balance > 0; month++) {
        const interestComponent = balance * monthlyRate;
        let principalComponent = emi - interestComponent;

        // Adjust for last payment if balance is less than EMI
        if (balance + interestComponent < emi) {
            principalComponent = balance;
            emi = balance + interestComponent; // Adjust EMI for the last month
        }

        balance -= principalComponent;
        cumulativePrincipalPaid += principalComponent;
        cumulativeInterestPaid += interestComponent;

        schedule.push({
            month: month,
            date: addMonths(loanStartDate, month).toISOString().split('T')[0], // YYYY-MM-DD
            openingBalance: parseFloat((balance + principalComponent).toFixed(2)),
            emi: parseFloat(emi.toFixed(2)),
            principalComponent: parseFloat(principalComponent.toFixed(2)),
            interestComponent: parseFloat(interestComponent.toFixed(2)),
            closingBalance: parseFloat(Math.max(0, balance).toFixed(2)),
            cumulativePrincipalPaid: parseFloat(cumulativePrincipalPaid.toFixed(2)),
            cumulativeInterestPaid: parseFloat(cumulativeInterestPaid.toFixed(2))
        });
    }
    return schedule;
}

/**
 * Applies prepayments to an existing amortization schedule.
 * Assumes prepayments reduce tenure while keeping EMI constant.
 * @param {Array<object>} baseSchedule - The original amortization schedule.
 * @param {Array<{amount: number, date: Date}>} prepayments - Sorted array of prepayments.
 * @param {object} loanDetails - Original loan details including loanAmount, annualInterestRate, loanStartDate.
 * @returns {{modifiedSchedule: Array<object>, finalEmi: number, finalTotalInterest: number, finalTotalMonths: number}}
 */
export function applyPrepaymentsToSchedule(baseSchedule, prepayments, loanDetails) {
    let currentBalance = loanDetails.loanAmount;
    let currentEmi = baseSchedule[0] ? baseSchedule[0].emi : calculateEMI(loanDetails.loanAmount, loanDetails.annualInterestRate / 12, loanDetails.loanTenureMonths);
    let modifiedSchedule = [];
    let cumulativePrincipalPaid = 0;
    let cumulativeInterestPaid = 0;
    let monthCounter = 0;

    const monthlyRate = loanDetails.annualInterestRate / 12;

    // Create a temporary schedule to iterate and apply prepayments
    let tempSchedule = [...baseSchedule]; // Copy the base schedule

    for (let i = 0; i < tempSchedule.length && currentBalance > 0; i++) {
        monthCounter++;
        const scheduleEntryDate = new Date(tempSchedule[i].date);

        // Apply prepayments that occur before or on this schedule entry date
        prepayments.filter(p => p.date <= scheduleEntryDate && p.amount > 0)
            .forEach(prepayment => {
                if (currentBalance > 0) {
                    currentBalance -= prepayment.amount;
                    // Ensure balance doesn't go negative due to overpayment
                    currentBalance = Math.max(0, currentBalance);
                }
                // Mark prepayment as applied to avoid re-applying
                prepayment.amount = 0;
            });

        if (currentBalance <= 0) {
            // Loan paid off early due to prepayments
            modifiedSchedule.push({
                month: monthCounter,
                date: scheduleEntryDate.toISOString().split('T')[0],
                openingBalance: parseFloat((currentBalance + (prepayments.reduce((sum, p) => sum + p.amount, 0))).toFixed(2)), // This might be tricky, need to ensure correct opening balance
                emi: 0,
                principalComponent: 0,
                interestComponent: 0,
                closingBalance: 0,
                cumulativePrincipalPaid: parseFloat(loanDetails.loanAmount.toFixed(2)), // All principal paid
                cumulativeInterestPaid: parseFloat(cumulativeInterestPaid.toFixed(2))
            });
            break;
        }

        const interestComponent = currentBalance * monthlyRate;
        let principalComponent = currentEmi - interestComponent;

        // If EMI is less than interest, it's a debt trap scenario, principal increases
        if (principalComponent < 0) {
            principalComponent = 0; // Principal doesn't reduce
            currentBalance += Math.abs(principalComponent); // Balance increases by the negative principal component
        }

        // Adjust for last payment if balance is less than EMI
        if (currentBalance + interestComponent < currentEmi) {
            principalComponent = currentBalance;
            currentEmi = currentBalance + interestComponent; // Adjust EMI for the last month
            currentBalance = 0;
        } else {
            currentBalance -= principalComponent;
        }

        cumulativePrincipalPaid += principalComponent;
        cumulativeInterestPaid += interestComponent;

        modifiedSchedule.push({
            month: monthCounter,
            date: scheduleEntryDate.toISOString().split('T')[0],
            openingBalance: parseFloat((currentBalance + principalComponent).toFixed(2)),
            emi: parseFloat(currentEmi.toFixed(2)),
            principalComponent: parseFloat(principalComponent.toFixed(2)),
            interestComponent: parseFloat(interestComponent.toFixed(2)),
            closingBalance: parseFloat(Math.max(0, currentBalance).toFixed(2)),
            cumulativePrincipalPaid: parseFloat(cumulativePrincipalPaid.toFixed(2)),
            cumulativeInterestPaid: parseFloat(cumulativeInterestPaid.toFixed(2))
        });
    }

    const finalTotalInterest = modifiedSchedule.reduce((sum, entry) => sum + entry.interestComponent, 0);
    const finalTotalMonths = modifiedSchedule.length;

    return {
        modifiedSchedule: modifiedSchedule,
        finalEmi: currentEmi, // This will be the last EMI, which might be adjusted
        finalTotalInterest: finalTotalInterest,
        finalTotalMonths: finalTotalMonths
    };
}


/**
 * Calculates the loan progress as of a given date.
 * @param {Array<object>} schedule - The amortization schedule.
 * @param {Date} loanStartDate - The start date of the loan.
 * @param {Date} currentDate - The date for which to calculate progress.
 * @returns {object} Loan progress details.
 */
export function getLoanProgress(schedule, loanStartDate, currentDate) {
    let paidEmis = 0;
    let principalPaid = 0;
    let interestPaid = 0;
    let remainingBalance = schedule[0] ? schedule[0].openingBalance : 0; // Start with initial loan amount
    let monthsRemaining = schedule.length;

    if (currentDate < loanStartDate) {
        return {
            paidEmis: 0,
            principalPaid: 0,
            interestPaid: 0,
            remainingBalance: remainingBalance,
            monthsRemaining: monthsRemaining
        };
    }

    for (const entry of schedule) {
        const paymentDate = new Date(entry.date);
        if (paymentDate <= currentDate) {
            paidEmis++;
            principalPaid = entry.cumulativePrincipalPaid;
            interestPaid = entry.cumulativeInterestPaid;
            remainingBalance = entry.closingBalance;
            monthsRemaining = schedule.length - entry.month;
        } else {
            break; // Schedule is sorted by date, so we can stop
        }
    }

    return {
        paidEmis: paidEmis,
        principalPaid: parseFloat(principalPaid.toFixed(2)),
        interestPaid: parseFloat(interestPaid.toFixed(2)),
        remainingBalance: parseFloat(remainingBalance.toFixed(2)),
        monthsRemaining: monthsRemaining
    };
}

/**
 * Calculates the impact of actual prepayments by comparing original and modified loan scenarios.
 * @param {object} originalLoan - Summary of the loan without prepayments.
 * @param {object} modifiedLoan - Summary of the loan with prepayments.
 * @returns {object} Prepayment impact details.
 */
export function calculatePrepaymentImpact(originalLoan, modifiedLoan) {
    const interestSaved = originalLoan.totalInterest - modifiedLoan.totalInterest;
    const monthsReduced = originalLoan.totalMonths - modifiedLoan.totalMonths;
    const percentageSavings = originalLoan.totalInterest > 0 ? (interestSaved / originalLoan.totalInterest * 100) : 0;

    // Placeholder for "reduce EMI" scenario - actual implementation would require re-calculating EMI
    // For now, we assume "reduce tenure" is the default impact.
    const alternativeReduceEmiImpact = {
        newEmi: modifiedLoan.emi, // This would be the new EMI if tenure was kept same
        interestSaved: interestSaved, // Same interest saved
        percentageSavings: percentageSavings
    };

    return {
        interestSaved: parseFloat(interestSaved.toFixed(2)),
        monthsReduced: monthsReduced,
        percentageSavings: parseFloat(percentageSavings.toFixed(2)),
        alternativeReduceEmiImpact: alternativeReduceEmiImpact // For UI display
    };
}

/**
 * Simulates the impact of a single hypothetical prepayment.
 * @param {object} baseLoan - The loan object (e.g., modifiedLoan) on which to apply the hypothetical prepayment.
 * @param {object} hypotheticalPrepayment - { amount: number, date: Date }.
 * @param {Array<object>} baseSchedule - The amortization schedule corresponding to the baseLoan.
 * @returns {object|null} Hypothetical prepayment impact details, or null if no impact.
 */
export function calculateHypotheticalPrepaymentImpact(baseLoan, hypotheticalPrepayment, baseSchedule) {
    if (!hypotheticalPrepayment || hypotheticalPrepayment.amount <= 0) {
        return null;
    }

    let tempBalance = baseLoan.principal; // Start with original principal for a fresh simulation
    let tempCumulativeInterestPaid = 0;
    let tempCumulativePrincipalPaid = 0;
    let hypotheticalApplied = false;
    let hypotheticalMonth = -1;

    const monthlyRate = baseLoan.annualInterestRate / 12;
    const emi = baseLoan.emi; // Use the EMI of the baseLoan

    // Find the balance and cumulative values just before the hypothetical prepayment date
    for (let i = 0; i < baseSchedule.length; i++) {
        const entry = baseSchedule[i];
        const paymentDate = new Date(entry.date);

        if (paymentDate < hypotheticalPrepayment.date) {
            tempBalance = entry.closingBalance;
            tempCumulativeInterestPaid = entry.cumulativeInterestPaid;
            tempCumulativePrincipalPaid = entry.cumulativePrincipalPaid;
            hypotheticalMonth = entry.month;
        } else {
            break;
        }
    }

    // If prepayment date is before loan start or after loan completion, no impact
    if (hypotheticalPrepayment.date < new Date(baseSchedule[0].date) || tempBalance <= 0) {
        return null;
    }

    // Apply hypothetical prepayment
    const balanceBeforeHypothetical = tempBalance;
    tempBalance -= hypotheticalPrepayment.amount;
    tempBalance = Math.max(0, tempBalance); // Ensure balance doesn't go negative

    if (tempBalance === balanceBeforeHypothetical) { // Prepayment was not enough to reduce balance
        return null;
    }

    // Recalculate remaining schedule from the month of hypothetical prepayment
    let newTotalMonths = hypotheticalMonth;
    let newTotalInterest = tempCumulativeInterestPaid;
    let currentMonth = hypotheticalMonth;

    while (tempBalance > 0 && currentMonth < baseLoan.totalMonths + 100) { // Add buffer for longer tenure
        currentMonth++;
        const interestComponent = tempBalance * monthlyRate;
        let principalComponent = emi - interestComponent;

        if (principalComponent < 0) { // Debt trap scenario
            principalComponent = 0;
            tempBalance += Math.abs(principalComponent);
        }

        if (tempBalance + interestComponent < emi) { // Last payment
            principalComponent = tempBalance;
            tempBalance = 0;
            newTotalInterest += interestComponent;
            newTotalMonths = currentMonth;
            break;
        } else {
            tempBalance -= principalComponent;
        }

        newTotalInterest += interestComponent;
        newTotalMonths = currentMonth;
    }

    const interestSaved = baseLoan.totalInterest - newTotalInterest;
    const monthsReduced = baseLoan.totalMonths - newTotalMonths;
    const percentageSavings = baseLoan.totalInterest > 0 ? (interestSaved / baseLoan.totalInterest * 100) : 0;

    return {
        amount: hypotheticalPrepayment.amount,
        date: hypotheticalPrepayment.date,
        interestSaved: parseFloat(interestSaved.toFixed(2)),
        monthsReduced: monthsReduced,
        percentageSavings: parseFloat(percentageSavings.toFixed(2))
    };
}


/**
 * Calculates a loan health score based on various factors.
 * @param {object} loan - The loan object (e.g., modifiedLoan).
 * @param {number|null} monthlyIncome - Optional monthly income for DTI calculation.
 * @param {number} currentEmi - The current EMI of the loan.
 * @returns {object} Loan health score, rating, and message.
 */
export function calculateLoanHealth(loan, monthlyIncome, currentEmi) {
    let score = 100; // Max score
    let messages = [];

    // Factor 1: Interest Burden Ratio (Total Interest / Principal)
    const interestRatio = loan.principal > 0 ? loan.totalInterest / loan.principal : 0;
    if (interestRatio > 1.0) { // More interest than principal
        score -= 40;
        messages.push('Very high interest burden. Consider aggressive repayment or refinancing.');
    } else if (interestRatio > 0.7) {
        score -= 25;
        messages.push('High interest burden. Focus on reducing total interest paid.');
    } else if (interestRatio > 0.4) {
        score -= 10;
        messages.push('Moderate interest burden. Good, but could be better.');
    }

    // Factor 2: Loan Tenure
    if (loan.totalMonths > 360) { // Over 30 years
        score -= 30;
        messages.push('Very long loan tenure. This increases total interest significantly.');
    } else if (loan.totalMonths > 240) { // Over 20 years
        score -= 15;
        messages.push('Long loan tenure. Consider shortening it if possible.');
    }

    // Factor 3: Debt-to-Income Ratio (if monthlyIncome is provided)
    if (monthlyIncome && monthlyIncome > 0) {
        const annualEmi = currentEmi * 12;
        const annualIncome = monthlyIncome * 12;
        const dtiRatio = annualEmi / annualIncome;

        if (dtiRatio > 0.5) { // EMI > 50% of income
            score -= 25;
            messages.push('High EMI-to-income ratio. This might strain your monthly budget.');
        } else if (dtiRatio > 0.3) { // EMI > 30% of income
            score -= 10;
            messages.push('Moderate EMI-to-income ratio. Manageable, but keep an eye on it.');
        }
    } else {
        messages.push('Provide your monthly income for a more accurate EMI affordability assessment.');
    }

    // Ensure score doesn't go below 0
    score = Math.max(0, score);

    let rating;
    if (score >= 80) rating = 'Excellent';
    else if (score >= 60) rating = 'Good';
    else if (score >= 40) rating = 'Fair';
    else rating = 'Poor';

    return {
        score: score,
        rating: rating,
        message: messages.length > 0 ? messages.join(' ') : 'Your loan health appears to be in good standing.'
    };
}

/**
 * Calculates the break-even point where cumulative principal paid exceeds cumulative interest paid.
 * @param {Array<object>} schedule - The amortization schedule.
 * @returns {number|null} The month number at which break-even occurs, or null if not within tenure.
 */
export function calculateBreakEvenPoint(schedule) {
    for (const entry of schedule) {
        if (entry.cumulativePrincipalPaid > entry.cumulativeInterestPaid) {
            return entry.month;
        }
    }
    return null; // Break-even point not reached within the schedule
}

/**
 * Simulate credit card debt payoff with compound interest
 * NOTE: This function is kept for compatibility but is not directly used by the main loan simulator flow.
 * @param {number} principal - Initial outstanding amount
 * @param {number} annualRate - Annual interest rate (%)
 * @param {number} minPaymentPercent - Minimum payment percentage
 * @param {number} extraPayment - Extra monthly payment (₹)
 * @returns {object} Detailed simulation results
 */
export function simulateDebtPayoff(principal, annualRate, minPaymentPercent, extraPayment = 0) {
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
            balance: parseFloat(Math.max(0, balance).toFixed(2)),
            interest: parseFloat(interest.toFixed(2)),
            payment: parseFloat(totalPayment.toFixed(2))
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
 * Calculate debt-to-income ratio risk
 * NOTE: This function is kept for compatibility but is not directly used by the main loan simulator flow.
 * @param {number} totalDebt - Total debt amount
 * @param {number} monthlyIncome - Monthly income
 * @returns {object} Risk assessment
 */
export function assessDebtRisk(totalDebt, monthlyIncome) {
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
