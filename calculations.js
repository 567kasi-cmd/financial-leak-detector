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
        return parseFloat((principal / totalMonths).toFixed(2));
    }
    const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
    return parseFloat(emi.toFixed(2));
}

/**
 * Calculates EMI, interest, total payment, and monthly schedule for a standard term loan.
 * @param {number} principal - Loan amount.
 * @param {number} annualRatePercent - Annual interest rate in percent.
 * @param {number} totalMonths - Tenure in months.
 * @param {Date} loanStartDate - Optional loan start date.
 * @returns {{emi: number, totalInterest: number, totalPayment: number, monthlyRate: number, monthlyData: Array<object>}}
 */
export function calculateLoanRepaymentDetails(principal, annualRatePercent, totalMonths, loanStartDate = new Date()) {
    if (!Number.isFinite(principal) || principal <= 0 || !Number.isFinite(totalMonths) || totalMonths <= 0) {
        return {
            emi: 0,
            totalInterest: 0,
            totalPayment: 0,
            monthlyRate: 0,
            monthlyData: []
        };
    }

    const monthlyRate = Math.max(0, annualRatePercent) / 100 / 12;
    const emi = calculateEMI(principal, monthlyRate, totalMonths);
    const schedule = generateAmortizationSchedule(principal, monthlyRate, emi, totalMonths, loanStartDate);
    const totalInterest = schedule.reduce((sum, entry) => sum + entry.interestComponent, 0);

    return {
        emi,
        totalInterest: parseFloat(totalInterest.toFixed(2)),
        totalPayment: parseFloat((principal + totalInterest).toFixed(2)),
        monthlyRate: parseFloat((monthlyRate * 100).toFixed(4)),
        monthlyData: schedule.map((entry) => ({
            month: entry.month,
            date: entry.date,
            payment: entry.emi,
            principal: entry.principalComponent,
            interest: entry.interestComponent,
            balance: entry.closingBalance
        }))
    };
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

    const firstMonthInterest = principal * monthlyRate;
    if (emi <= firstMonthInterest) {
        throw new Error('Invalid EMI: EMI is below monthly interest.');
    }

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
 * Supports both the standard bank-style flow (keep EMI, reduce tenure)
 * and the alternative flow (keep tenure, recalculate EMI).
 * @param {Array<object>} baseSchedule - The original amortization schedule.
 * @param {Array<{amount: number, date: Date}>} prepayments - Sorted array of prepayments.
 * @param {object} loanDetails - Original loan details including loanAmount, annualInterestRate, loanStartDate.
 * @param {'reduceTenure'|'reduceEmi'} strategy - How prepayments should affect the loan.
 * @returns {{modifiedSchedule: Array<object>, finalEmi: number, finalTotalInterest: number, finalTotalMonths: number}}
 */
export function applyPrepaymentsToSchedule(baseSchedule, prepayments, loanDetails, strategy = 'reduceTenure') {
    let currentBalance = loanDetails.loanAmount;
    const originalEmi = baseSchedule[0] ? baseSchedule[0].emi : calculateEMI(loanDetails.loanAmount, loanDetails.annualInterestRate / 12, loanDetails.loanTenureMonths);
    let currentEmi = originalEmi;
    let scenarioEmi = originalEmi;
    let modifiedSchedule = [];
    let lastNonZeroScheduledEmi = 0;
    let cumulativePrincipalPaid = 0;
    let cumulativeInterestPaid = 0;
    let monthCounter = 0;
    let prepaymentIndex = 0;
    const sortedPrepayments = [...prepayments]
        .filter((prepayment) => prepayment && prepayment.amount > 0 && prepayment.date)
        .sort((a, b) => a.date.getTime() - b.date.getTime());
    const monthlyRate = loanDetails.annualInterestRate / 12;
    const tempSchedule = [...baseSchedule];

    for (let i = 0; i < tempSchedule.length && currentBalance > 0; i++) {
        monthCounter++;
        const scheduleEntryDate = new Date(tempSchedule[i].date);
        const openingBalanceBeforeEvents = currentBalance;
        let prepaymentAppliedThisMonth = false;

        while (prepaymentIndex < sortedPrepayments.length && sortedPrepayments[prepaymentIndex].date <= scheduleEntryDate) {
            const appliedPrepaymentAmount = Math.min(currentBalance, sortedPrepayments[prepaymentIndex].amount);
            currentBalance = Math.max(0, currentBalance - appliedPrepaymentAmount);
            cumulativePrincipalPaid += appliedPrepaymentAmount;
            prepaymentIndex++;
            prepaymentAppliedThisMonth = true;
        }
        const openingBalanceForEmi = currentBalance;

        if (currentBalance <= 0) {
            modifiedSchedule.push({
                month: monthCounter,
                date: scheduleEntryDate.toISOString().split('T')[0],
                openingBalance: parseFloat(openingBalanceBeforeEvents.toFixed(2)),
                emi: 0,
                principalComponent: 0,
                interestComponent: 0,
                closingBalance: 0,
                cumulativePrincipalPaid: parseFloat(cumulativePrincipalPaid.toFixed(2)),
                cumulativeInterestPaid: parseFloat(cumulativeInterestPaid.toFixed(2))
            });
            break;
        }

        if (strategy === 'reduceEmi' && prepaymentAppliedThisMonth) {
            const remainingMonthsIncludingCurrent = Math.max(1, tempSchedule.length - i);
            scenarioEmi = calculateEMI(currentBalance, monthlyRate, remainingMonthsIncludingCurrent);
            currentEmi = scenarioEmi;
        } else if (strategy !== 'reduceEmi') {
            currentEmi = originalEmi;
        }
        const scheduledEmiForMonth = currentEmi;

        const interestComponent = currentBalance * monthlyRate;
        if (currentEmi <= interestComponent) {
            throw new Error('Invalid EMI: EMI is below monthly interest.');
        }
        let principalComponent = currentEmi - interestComponent;

        // Adjust for last payment if balance is less than EMI
        if (currentBalance + interestComponent < currentEmi) {
            principalComponent = currentBalance;
            const finalPaymentEmi = currentBalance + interestComponent;
            currentBalance = 0;
            modifiedSchedule.push({
                month: monthCounter,
                date: scheduleEntryDate.toISOString().split('T')[0],
                openingBalance: parseFloat(openingBalanceForEmi.toFixed(2)),
                emi: parseFloat(finalPaymentEmi.toFixed(2)),
                principalComponent: parseFloat(principalComponent.toFixed(2)),
                interestComponent: parseFloat(interestComponent.toFixed(2)),
                closingBalance: 0,
                cumulativePrincipalPaid: parseFloat((cumulativePrincipalPaid + principalComponent).toFixed(2)),
                cumulativeInterestPaid: parseFloat((cumulativeInterestPaid + interestComponent).toFixed(2))
            });
            cumulativePrincipalPaid += principalComponent;
            cumulativeInterestPaid += interestComponent;
            if (scheduledEmiForMonth > 0) {
                lastNonZeroScheduledEmi = scheduledEmiForMonth;
            }
            break;
        } else {
            currentBalance -= principalComponent;
        }

        cumulativePrincipalPaid += principalComponent;
        cumulativeInterestPaid += interestComponent;
        if (scheduledEmiForMonth > 0) {
            lastNonZeroScheduledEmi = scheduledEmiForMonth;
        }

        modifiedSchedule.push({
            month: monthCounter,
            date: scheduleEntryDate.toISOString().split('T')[0],
            openingBalance: parseFloat(openingBalanceForEmi.toFixed(2)),
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
    const summaryEmi = strategy === 'reduceEmi'
        ? parseFloat((lastNonZeroScheduledEmi || 0).toFixed(2))
        : originalEmi;

    return {
        modifiedSchedule: modifiedSchedule,
        finalEmi: parseFloat(summaryEmi.toFixed(2)),
        finalTotalInterest: parseFloat(finalTotalInterest.toFixed(2)),
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
 * @param {object} modifiedLoan - Summary of the loan with prepayments under reduce-tenure mode.
 * @param {object|null} alternativeReduceEmiImpact - Optional reduce-EMI comparison summary.
 * @returns {object} Prepayment impact details.
 */
export function calculatePrepaymentImpact(originalLoan, modifiedLoan, alternativeReduceEmiImpact = null) {
    const interestSaved = originalLoan.totalInterest - modifiedLoan.totalInterest;
    const monthsReduced = originalLoan.totalMonths - modifiedLoan.totalMonths;
    const percentageSavings = originalLoan.totalInterest > 0 ? (interestSaved / originalLoan.totalInterest * 100) : 0;

    return {
        interestSaved: parseFloat(interestSaved.toFixed(2)),
        monthsReduced: monthsReduced,
        percentageSavings: parseFloat(percentageSavings.toFixed(2)),
        alternativeReduceEmiImpact: alternativeReduceEmiImpact
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
    const impact = calculatePrepaymentPlanImpact(baseLoan, [hypotheticalPrepayment], baseSchedule);
    if (!impact) {
        return null;
    }

    return {
        amount: impact.totalPlannedAmount,
        date: impact.firstPlannedDate,
        interestSaved: parseFloat(impact.reduceTenure.interestSaved.toFixed(2)),
        monthsReduced: impact.reduceTenure.monthsReduced,
        percentageSavings: parseFloat(impact.reduceTenure.percentageSavings.toFixed(2))
    };
}

/**
 * Simulates a planned set of future prepayments on top of an existing loan state.
 * @param {object} baseLoan - The loan object being used as the starting point.
 * @param {Array<object>} plannedPrepayments - Array of hypothetical prepayments.
 * @param {Array<object>} baseSchedule - The amortization schedule for the base loan state.
 * @returns {object|null} Detailed plan impact, or null if no valid future prepayments were supplied.
 */
export function calculatePrepaymentPlanImpact(baseLoan, plannedPrepayments, baseSchedule) {
    const validPrepayments = [...plannedPrepayments]
        .filter((prepayment) => prepayment && prepayment.amount > 0 && prepayment.date)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (validPrepayments.length === 0 || !baseSchedule || baseSchedule.length === 0) {
        return null;
    }

    const loanDetails = {
        loanAmount: baseLoan.principal,
        annualInterestRate: baseLoan.annualInterestRate,
        loanTenureMonths: baseLoan.totalMonths,
        loanStartDate: new Date(baseSchedule[0].date)
    };

    const reduceTenureResult = applyPrepaymentsToSchedule(baseSchedule, validPrepayments, loanDetails, 'reduceTenure');
    const reduceEmiResult = applyPrepaymentsToSchedule(baseSchedule, validPrepayments, loanDetails, 'reduceEmi');

    const totalPlannedAmount = validPrepayments.reduce((sum, item) => sum + item.amount, 0);
    const firstPlannedDate = validPrepayments[0].date;
    const lastPlannedDate = validPrepayments[validPrepayments.length - 1].date;

    return {
        totalPlannedAmount: parseFloat(totalPlannedAmount.toFixed(2)),
        prepaymentCount: validPrepayments.length,
        firstPlannedDate,
        lastPlannedDate,
        reduceTenure: {
            emi: baseLoan.emi,
            totalInterest: reduceTenureResult.finalTotalInterest,
            totalPayment: parseFloat((loanDetails.loanAmount + reduceTenureResult.finalTotalInterest).toFixed(2)),
            totalMonths: reduceTenureResult.finalTotalMonths,
            interestSaved: parseFloat((baseLoan.totalInterest - reduceTenureResult.finalTotalInterest).toFixed(2)),
            monthsReduced: baseLoan.totalMonths - reduceTenureResult.finalTotalMonths,
            percentageSavings: baseLoan.totalInterest > 0
                ? parseFloat((((baseLoan.totalInterest - reduceTenureResult.finalTotalInterest) / baseLoan.totalInterest) * 100).toFixed(2))
                : 0
        },
        reduceEmi: {
            emi: reduceEmiResult.finalEmi,
            totalInterest: reduceEmiResult.finalTotalInterest,
            totalPayment: parseFloat((loanDetails.loanAmount + reduceEmiResult.finalTotalInterest).toFixed(2)),
            totalMonths: reduceEmiResult.finalTotalMonths,
            interestSaved: parseFloat((baseLoan.totalInterest - reduceEmiResult.finalTotalInterest).toFixed(2)),
            monthsReduced: baseLoan.totalMonths - reduceEmiResult.finalTotalMonths,
            percentageSavings: baseLoan.totalInterest > 0
                ? parseFloat((((baseLoan.totalInterest - reduceEmiResult.finalTotalInterest) / baseLoan.totalInterest) * 100).toFixed(2))
                : 0
        }
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
    if (!Number.isFinite(principal) || principal <= 0 || !Number.isFinite(annualRate) || annualRate < 0 ||
        !Number.isFinite(minPaymentPercent) || minPaymentPercent <= 0 || !Number.isFinite(extraPayment) || extraPayment < 0) {
        return {
            monthlyRate: '0.0000',
            months: 0,
            years: 0,
            remainingMonths: 0,
            totalInterest: 0,
            totalPaid: 0,
            monthlyData: [],
            monthlyDataLimited: []
        };
    }

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
        const scheduledPayment = minPayment + extraPayment;
        const totalPayment = Math.min(balance + interest, scheduledPayment);

        balance = Math.max(0, balance + interest - totalPayment);
        months++;

        monthlyData.push({
            month: months,
            balance: parseFloat(Math.max(0, balance).toFixed(2)),
            interest: parseFloat(interest.toFixed(2)),
            payment: parseFloat(totalPayment.toFixed(2))
        });

        if (scheduledPayment <= 0 || balance > principal * 5) break; // Debt exploding - stop
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
