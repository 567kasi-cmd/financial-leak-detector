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
    const normalizedPrincipal = Number(principal);
    const normalizedMonths = Math.round(Number(totalMonths) || 0);

    if (!Number.isFinite(normalizedPrincipal) || normalizedPrincipal <= 0 || normalizedMonths <= 0) {
        return 0;
    }

    if (monthlyRate === 0) {
        return roundCurrency(normalizedPrincipal / normalizedMonths);
    }

    const growthFactor = Math.pow(1 + monthlyRate, normalizedMonths);
    const emi = normalizedPrincipal * monthlyRate * growthFactor / (growthFactor - 1);
    return roundCurrency(emi);
}

function roundCurrency(value) {
    return parseFloat(Number(value || 0).toFixed(2));
}

function normalizeRupees(value) {
    return Math.max(0, Math.round(Number(value) || 0));
}

function sanitizeCount(value) {
    const normalized = Math.round(Number(value) || 0);
    return Number.isFinite(normalized) ? Math.max(0, normalized) : 0;
}

function createClosedLoanScenario(interestPaidBefore, elapsedMonths) {
    return {
        emi: 0,
        totalInterest: roundCurrency(interestPaidBefore),
        totalPayment: roundCurrency(interestPaidBefore),
        totalMonths: sanitizeCount(elapsedMonths),
        displayMonths: 0,
        finalPayment: 0,
        reduceEmiApplicable: false
    };
}

function createNearClosureScenario(newPrincipal, currentEmi, interestPaidBefore, currentMonth, baselineMonths, baselineInterest, loanStartDate, monthlyRate) {
    const safeEmi = roundCurrency(currentEmi);
    const monthsToClose = 1;
    const schedule = generateAmortizationSchedule(
        newPrincipal,
        monthlyRate,
        safeEmi,
        monthsToClose,
        loanStartDate
    );
    const futureInterest = schedule.reduce((sum, entry) => sum + entry.interestComponent, 0);
    const totalInterest = roundCurrency(interestPaidBefore + futureInterest);
    const totalMonths = sanitizeCount(currentMonth + schedule.length);

    return {
        emi: safeEmi,
        totalInterest,
        totalPayment: roundCurrency(newPrincipal + totalInterest),
        totalMonths,
        displayMonths: monthsToClose,
        interestSaved: roundCurrency(Math.max(0, baselineInterest - totalInterest)),
        monthsSaved: Math.max(0, sanitizeCount(baselineMonths) - totalMonths),
        emiReduction: 0,
        monthsToClose,
        finalPayment: roundCurrency(schedule[schedule.length - 1]?.emi || 0),
        reduceEmiApplicable: false
    };
}

export function recalculateTenure(principal, monthlyRate, emi, maxMonths = 1200) {
    const normalizedPrincipal = normalizeRupees(principal);
    if (normalizedPrincipal <= 0 || emi <= 0) {
        return 0;
    }

    if (monthlyRate === 0) {
        return Math.ceil(normalizedPrincipal / emi);
    }

    let balance = normalizedPrincipal;
    let months = 0;

    while (balance > 0 && months < maxMonths) {
        const interestComponent = balance * monthlyRate;
        const principalComponent = emi - interestComponent;

        if (principalComponent <= 0) {
            return maxMonths;
        }

        balance = Math.max(0, balance - principalComponent);
        months += 1;
    }

    return months;
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
    const normalizedPrincipal = roundCurrency(principal);
    const normalizedMonths = Math.max(0, Math.round(Number(totalMonths) || 0));
    const scheduledEmi = roundCurrency(emi);
    let balance = normalizedPrincipal;
    let cumulativePrincipalPaid = 0;
    let cumulativeInterestPaid = 0;
    const schedule = [];
    const startDate = loanStartDate instanceof Date ? loanStartDate : new Date(loanStartDate);

    for (let month = 1; month <= normalizedMonths && balance > 0; month++) {
        const interestComponent = balance * monthlyRate;
        let emiForMonth = scheduledEmi;
        let principalComponent = emiForMonth - interestComponent;

        // Adjust for last payment if balance is less than EMI
        if (balance + interestComponent < emiForMonth) {
            principalComponent = balance;
            emiForMonth = balance + interestComponent;
        }

        balance -= principalComponent;
        cumulativePrincipalPaid += principalComponent;
        cumulativeInterestPaid += interestComponent;

        schedule.push({
            month: month,
            date: addMonths(startDate, month).toISOString().split('T')[0], // YYYY-MM-DD
            openingBalance: parseFloat((balance + principalComponent).toFixed(2)),
            emi: parseFloat(emiForMonth.toFixed(2)),
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
export function applyPrepaymentsToSchedule(baseSchedule, prepayments, loanDetails, strategy = 'reduce-tenure') {
    return buildPrepaymentScenario(baseSchedule, prepayments, loanDetails, strategy);
}

function buildPrepaymentScenario(baseSchedule, prepayments, loanDetails, strategy = 'reduce-tenure') {
    let currentBalance = roundCurrency(loanDetails.loanAmount);
    const scheduledEmi = baseSchedule[0]
        ? baseSchedule[0].emi
        : calculateEMI(currentBalance, loanDetails.annualInterestRate / 12, loanDetails.loanTenureMonths);
    let currentEmi = scheduledEmi;
    const modifiedSchedule = [];
    let cumulativePrincipalPaid = 0;
    let cumulativeInterestPaid = 0;
    let monthCounter = 0;
    let prepaymentIndex = 0;
    const sortedPrepayments = [...prepayments]
        .filter((prepayment) => prepayment && prepayment.amount > 0 && prepayment.date)
        .sort((a, b) => a.date.getTime() - b.date.getTime());
    const monthlyRate = loanDetails.annualInterestRate / 12;
    const tempSchedule = [...baseSchedule];
    const originalTenureMonths = loanDetails.loanTenureMonths;
    const prepaymentEvents = [];

    for (let i = 0; i < tempSchedule.length && currentBalance > 0; i++) {
        monthCounter++;
        const scheduleEntryDate = new Date(tempSchedule[i].date);
        const openingBalanceBeforeEvents = currentBalance;
        let totalPrepaymentThisMonth = 0;

        while (prepaymentIndex < sortedPrepayments.length && sortedPrepayments[prepaymentIndex].date <= scheduleEntryDate) {
            const requestedPrepaymentAmount = normalizeRupees(sortedPrepayments[prepaymentIndex].amount);
            const appliedPrepaymentAmount = roundCurrency(Math.min(requestedPrepaymentAmount, currentBalance));
            currentBalance = roundCurrency(Math.max(0, currentBalance - appliedPrepaymentAmount));
            cumulativePrincipalPaid += appliedPrepaymentAmount;
            totalPrepaymentThisMonth += appliedPrepaymentAmount;
            prepaymentEvents.push({
                requestedAmount: requestedPrepaymentAmount,
                amount: appliedPrepaymentAmount,
                date: new Date(sortedPrepayments[prepaymentIndex].date),
                balanceAfterPrepayment: currentBalance,
                month: monthCounter,
                wasCapped: requestedPrepaymentAmount > appliedPrepaymentAmount,
                remainingMonths: Math.max(1, originalTenureMonths - monthCounter + 1)
            });
            prepaymentIndex++;
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

        if (strategy === 'reduce-emi' && totalPrepaymentThisMonth > 0) {
            const remainingMonths = Math.max(1, originalTenureMonths - monthCounter + 1);
            currentEmi = calculateEMI(currentBalance, monthlyRate, remainingMonths);
        }

        const interestComponent = currentBalance * monthlyRate;
        const emiForMonth = currentBalance + interestComponent < currentEmi
            ? currentBalance + interestComponent
            : currentEmi;
        let principalComponent = emiForMonth - interestComponent;

        // If EMI is less than interest, it's a debt trap scenario, principal increases
        if (principalComponent < 0) {
            principalComponent = 0;
        }

        currentBalance = Math.max(0, currentBalance - principalComponent);

        cumulativePrincipalPaid += principalComponent;
        cumulativeInterestPaid += interestComponent;

        modifiedSchedule.push({
            month: monthCounter,
            date: scheduleEntryDate.toISOString().split('T')[0],
            openingBalance: roundCurrency(openingBalanceForEmi),
            emi: roundCurrency(emiForMonth),
            principalComponent: roundCurrency(principalComponent),
            interestComponent: roundCurrency(interestComponent),
            closingBalance: roundCurrency(Math.max(0, currentBalance)),
            cumulativePrincipalPaid: roundCurrency(cumulativePrincipalPaid),
            cumulativeInterestPaid: roundCurrency(cumulativeInterestPaid)
        });
    }

    const finalTotalInterest = modifiedSchedule.reduce((sum, entry) => sum + entry.interestComponent, 0);
    const finalTotalMonths = modifiedSchedule.length;

    return {
        modifiedSchedule,
        finalEmi: currentBalance <= 0 ? 0 : (strategy === 'reduce-emi' ? roundCurrency(currentEmi) : roundCurrency(scheduledEmi)),
        finalTotalInterest: roundCurrency(finalTotalInterest),
        finalTotalMonths,
        prepaymentEvents
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
export function calculatePrepaymentImpact(originalLoan, modifiedLoan, alternativeReduceEmiLoan = null) {
    const interestSaved = originalLoan.totalInterest - modifiedLoan.totalInterest;
    const monthsReduced = originalLoan.totalMonths - modifiedLoan.totalMonths;
    const percentageSavings = originalLoan.totalInterest > 0 ? (interestSaved / originalLoan.totalInterest * 100) : 0;
    const alternativeReduceEmiImpact = alternativeReduceEmiLoan
        ? {
            newEmi: roundCurrency(alternativeReduceEmiLoan.emi),
            interestSaved: roundCurrency(originalLoan.totalInterest - alternativeReduceEmiLoan.totalInterest),
            percentageSavings: roundCurrency(originalLoan.totalInterest > 0
                ? ((originalLoan.totalInterest - alternativeReduceEmiLoan.totalInterest) / originalLoan.totalInterest) * 100
                : 0),
            totalInterest: roundCurrency(alternativeReduceEmiLoan.totalInterest),
            totalMonths: alternativeReduceEmiLoan.totalMonths
        }
        : {
            newEmi: roundCurrency(modifiedLoan.emi),
            interestSaved: roundCurrency(interestSaved),
            percentageSavings: roundCurrency(percentageSavings),
            totalInterest: roundCurrency(modifiedLoan.totalInterest),
            totalMonths: modifiedLoan.totalMonths
        };

    return {
        interestSaved: roundCurrency(interestSaved),
        monthsReduced,
        percentageSavings: roundCurrency(percentageSavings),
        alternativeReduceEmiImpact
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
    if (!baseSchedule || baseSchedule.length === 0) {
        return null;
    }

    const monthlyRate = baseLoan.annualInterestRate / 12;
    const normalizedAmount = normalizeRupees(hypotheticalPrepayment.amount);
    const hypotheticalDate = new Date(hypotheticalPrepayment.date);
    const remainingEntry = baseSchedule.find((entry) => new Date(entry.date) >= hypotheticalDate);

    if (!remainingEntry) {
        return null;
    }

    const previousEntry = baseSchedule[remainingEntry.month - 2] || null;
    const interestPaidBefore = previousEntry ? previousEntry.cumulativeInterestPaid : 0;
    const currentMonth = remainingEntry.month - 1;
    const remainingMonths = Math.max(1, baseLoan.totalMonths - currentMonth);
    const balanceBeforePrepayment = previousEntry ? previousEntry.closingBalance : remainingEntry.openingBalance;
    const remainingPrincipalBeforePrepayment = normalizeRupees(balanceBeforePrepayment);
    const appliedAmount = Math.min(normalizedAmount, remainingPrincipalBeforePrepayment);
    const remainingPrincipal = Math.max(0, remainingPrincipalBeforePrepayment - appliedAmount);
    const baselineInterest = roundCurrency(baseLoan.totalInterest);
    const baselineMonths = sanitizeCount(baseLoan.totalMonths);
    const currentEmi = roundCurrency(baseLoan.emi);

    if (remainingPrincipal >= remainingPrincipalBeforePrepayment) {
        return null;
    }

    if (remainingPrincipal <= 0) {
        const closedScenario = createClosedLoanScenario(interestPaidBefore, currentMonth);
        const interestSaved = roundCurrency(Math.max(0, baselineInterest - closedScenario.totalInterest));
        const monthsReduced = Math.max(0, baselineMonths - closedScenario.totalMonths);

        return {
            amount: appliedAmount,
            requestedAmount: normalizedAmount,
            remainingPrincipalAfterPrepayment: 0,
            displayCurrentMonths: remainingMonths,
            date: hypotheticalDate,
            interestSaved,
            monthsReduced,
            percentageSavings: roundCurrency(baselineInterest > 0 ? (interestSaved / baselineInterest) * 100 : 0),
            message: 'Loan fully closed with this prepayment.',
            status: 'closed',
            reduceEmiApplicable: false,
            reduceEmiDisabledMessage: 'Reduce EMI is not applicable as the loan will close immediately.',
            comparisonScenarios: {
                reduceTenure: {
                    ...closedScenario,
                    interestSaved,
                    monthsReduced
                },
                reduceEmi: {
                    ...closedScenario,
                    interestSaved,
                    monthsReduced
                }
            },
            resultingLoan: closedScenario,
            reduceEmiLoan: closedScenario
        };
    }

    if (remainingPrincipal <= currentEmi) {
        const nearClosureScenario = createNearClosureScenario(
            remainingPrincipal,
            currentEmi,
            interestPaidBefore,
            currentMonth,
            baselineMonths,
            baselineInterest,
            hypotheticalDate,
            monthlyRate
        );

        return {
            amount: appliedAmount,
            requestedAmount: normalizedAmount,
            remainingPrincipalAfterPrepayment: roundCurrency(remainingPrincipal),
            displayCurrentMonths: remainingMonths,
            date: hypotheticalDate,
            interestSaved: roundCurrency(nearClosureScenario.interestSaved),
            monthsReduced: Math.max(0, baselineMonths - nearClosureScenario.totalMonths),
            percentageSavings: roundCurrency(baselineInterest > 0 ? (nearClosureScenario.interestSaved / baselineInterest) * 100 : 0),
            message: `Loan closes in ${nearClosureScenario.monthsToClose} month${nearClosureScenario.monthsToClose === 1 ? '' : 's'}.`,
            status: 'near-closure',
            reduceEmiApplicable: false,
            reduceEmiDisabledMessage: 'Reduce EMI is not applicable as the loan will close immediately.',
            comparisonScenarios: {
                reduceTenure: nearClosureScenario,
                reduceEmi: nearClosureScenario
            },
            resultingLoan: nearClosureScenario,
            reduceEmiLoan: nearClosureScenario
        };
    }

    const reduceTenureMonths = recalculateTenure(remainingPrincipal, monthlyRate, baseLoan.emi);
    const reduceTenureSchedule = generateAmortizationSchedule(
        remainingPrincipal,
        monthlyRate,
        baseLoan.emi,
        Math.max(1, reduceTenureMonths),
        hypotheticalDate
    );
    const reduceTenureInterest = reduceTenureSchedule.reduce((sum, entry) => sum + entry.interestComponent, 0);
    const reduceTenureTotalInterest = interestPaidBefore + reduceTenureInterest;
    const reduceTenureTotalMonths = (remainingEntry.month - 1) + reduceTenureSchedule.length;

    const newEmi = calculateEMI(remainingPrincipal, monthlyRate, remainingMonths);
    const reduceEmiSchedule = generateAmortizationSchedule(
        remainingPrincipal,
        monthlyRate,
        newEmi,
        remainingMonths,
        hypotheticalDate
    );
    const reduceEmiInterest = reduceEmiSchedule.reduce((sum, entry) => sum + entry.interestComponent, 0);
    const totalInterestWithWhatIf = interestPaidBefore + reduceEmiInterest;
    const totalMonthsWithWhatIf = (remainingEntry.month - 1) + reduceEmiSchedule.length;

    const interestSaved = baseLoan.totalInterest - reduceTenureTotalInterest;
    const monthsReduced = baseLoan.totalMonths - reduceTenureTotalMonths;
    const percentageSavings = baseLoan.totalInterest > 0 ? (interestSaved / baseLoan.totalInterest * 100) : 0;

    return {
        amount: appliedAmount,
        requestedAmount: normalizedAmount,
        remainingPrincipalAfterPrepayment: roundCurrency(remainingPrincipal),
        displayCurrentMonths: remainingMonths,
        date: hypotheticalDate,
        interestSaved: roundCurrency(Math.max(0, interestSaved)),
        monthsReduced: Math.max(0, monthsReduced),
        percentageSavings: roundCurrency(percentageSavings),
        message: `Remaining principal after prepayment: ${formatAdvisorCurrency(remainingPrincipal)}.`,
        status: 'normal',
        reduceEmiApplicable: true,
        comparisonScenarios: {
            reduceTenure: {
                emi: roundCurrency(baseLoan.emi),
                totalInterest: roundCurrency(reduceTenureTotalInterest),
                totalPayment: roundCurrency(baseLoan.principal + reduceTenureTotalInterest),
                totalMonths: reduceTenureTotalMonths,
                displayMonths: reduceTenureSchedule.length,
                interestSaved: roundCurrency(baseLoan.totalInterest - reduceTenureTotalInterest),
                monthsReduced: Math.max(0, baseLoan.totalMonths - reduceTenureTotalMonths),
                finalPayment: roundCurrency(reduceTenureSchedule[reduceTenureSchedule.length - 1]?.emi || 0),
                reduceEmiApplicable: true
            },
            reduceEmi: {
                emi: roundCurrency(newEmi),
                totalInterest: roundCurrency(totalInterestWithWhatIf),
                totalPayment: roundCurrency(baseLoan.principal + totalInterestWithWhatIf),
                totalMonths: totalMonthsWithWhatIf,
                displayMonths: reduceEmiSchedule.length,
                interestSaved: roundCurrency(baseLoan.totalInterest - totalInterestWithWhatIf),
                monthsReduced: Math.max(0, baseLoan.totalMonths - totalMonthsWithWhatIf),
                finalPayment: roundCurrency(reduceEmiSchedule[reduceEmiSchedule.length - 1]?.emi || 0),
                reduceEmiApplicable: true
            }
        },
        resultingLoan: {
            emi: roundCurrency(baseLoan.emi),
            totalInterest: roundCurrency(reduceTenureTotalInterest),
            totalPayment: roundCurrency(baseLoan.principal + reduceTenureTotalInterest),
            totalMonths: reduceTenureTotalMonths,
            displayMonths: reduceTenureSchedule.length,
            finalPayment: roundCurrency(reduceTenureSchedule[reduceTenureSchedule.length - 1]?.emi || 0)
        },
        reduceEmiLoan: {
            emi: roundCurrency(newEmi),
            totalInterest: roundCurrency(totalInterestWithWhatIf),
            totalPayment: roundCurrency(baseLoan.principal + totalInterestWithWhatIf),
            totalMonths: totalMonthsWithWhatIf,
            displayMonths: reduceEmiSchedule.length,
            finalPayment: roundCurrency(reduceEmiSchedule[reduceEmiSchedule.length - 1]?.emi || 0)
        }
    };
}

export function calculateSmartPrepaymentAdvisor(baseLoan, hypotheticalPrepayment, baseSchedule, monthlyIncome = null) {
    if (!hypotheticalPrepayment || hypotheticalPrepayment.amount <= 0 || !baseSchedule || baseSchedule.length === 0) {
        return null;
    }

    const monthlyRate = baseLoan.annualInterestRate / 12;
    const normalizedAmount = normalizeRupees(hypotheticalPrepayment.amount);
    const hypotheticalDate = new Date(hypotheticalPrepayment.date);
    const remainingEntry = baseSchedule.find((entry) => new Date(entry.date) >= hypotheticalDate);

    if (!remainingEntry) {
        return {
            isValid: false,
            error: 'This prepayment date falls after the loan would already be closed.'
        };
    }

    const previousEntry = baseSchedule[remainingEntry.month - 2] || null;
    const currentMonth = remainingEntry.month - 1;
    const remainingMonths = Math.max(1, baseLoan.totalMonths - currentMonth);
    const interestPaidBefore = previousEntry ? previousEntry.cumulativeInterestPaid : 0;
    const remainingPrincipal = roundCurrency(previousEntry ? previousEntry.closingBalance : remainingEntry.openingBalance);

    if (normalizedAmount <= 0) {
        return {
            isValid: false,
            error: 'Prepayment amount must be greater than 0.'
        };
    }

    const appliedAmount = Math.min(normalizedAmount, remainingPrincipal);
    const newPrincipal = roundCurrency(Math.max(0, remainingPrincipal - appliedAmount));
    const currentEmi = roundCurrency(baseLoan.emi);
    const baselineInterest = roundCurrency(baseLoan.totalInterest);
    const baselineMonths = sanitizeCount(baseLoan.totalMonths);

    if (newPrincipal <= 0) {
        const closedScenario = createClosedLoanScenario(interestPaidBefore, currentMonth);
        const interestSaved = roundCurrency(Math.max(0, baselineInterest - closedScenario.totalInterest));

        return {
            isValid: true,
            sourceDate: hypotheticalDate,
            sourceAmount: appliedAmount,
            requestedAmount: normalizedAmount,
            message: normalizedAmount > remainingPrincipal
                ? 'Requested prepayment was capped to the remaining principal. Loan fully closed with this prepayment.'
                : 'Loan fully closed with this prepayment.',
            currentState: {
                remainingPrincipal,
                currentEmi,
                remainingMonths,
                monthlyInterestRate: monthlyRate,
                currentMonth,
                totalMonths: baselineMonths,
                cappedAmount: roundCurrency(appliedAmount),
                remainingPrincipalAfterPrepayment: 0
            },
            scenarios: {
                current: {
                    emi: currentEmi,
                    totalInterest: baselineInterest,
                    totalMonths: baselineMonths,
                    displayMonths: remainingMonths
                },
                reduceTenure: {
                    ...closedScenario,
                    interestSaved,
                    monthsSaved: Math.max(0, baselineMonths - closedScenario.totalMonths),
                    emiReduction: currentEmi
                },
                reduceEmi: {
                    ...closedScenario,
                    interestSaved,
                    monthsSaved: Math.max(0, baselineMonths - closedScenario.totalMonths),
                    emiReduction: currentEmi
                }
            },
            reduceEmiApplicable: false,
            reduceEmiDisabledMessage: 'Reduce EMI is not applicable as the loan will close immediately.',
            recommendation: 'Loan Closed',
            recommendationMessage: 'Recommendation: This prepayment pays off the loan in full.',
            timingInsight: 'No future EMI remains after this prepayment.',
            helperText: 'This prepayment fully closes the loan, so no further EMI is due.'
        };
    }

    if (newPrincipal <= currentEmi) {
        const nearClosureScenario = createNearClosureScenario(
            newPrincipal,
            currentEmi,
            interestPaidBefore,
            currentMonth,
            baselineMonths,
            baselineInterest,
            hypotheticalDate,
            monthlyRate
        );

        return {
            isValid: true,
            sourceDate: hypotheticalDate,
            sourceAmount: appliedAmount,
            requestedAmount: normalizedAmount,
            message: `Loan closes in ${nearClosureScenario.monthsToClose} month${nearClosureScenario.monthsToClose === 1 ? '' : 's'}.`,
            currentState: {
                remainingPrincipal,
                currentEmi,
                remainingMonths,
                monthlyInterestRate: monthlyRate,
                currentMonth,
                totalMonths: baselineMonths,
                cappedAmount: roundCurrency(appliedAmount),
                remainingPrincipalAfterPrepayment: roundCurrency(newPrincipal)
            },
            scenarios: {
                current: {
                    emi: currentEmi,
                    totalInterest: baselineInterest,
                    totalMonths: baselineMonths,
                    displayMonths: remainingMonths
                },
                reduceTenure: nearClosureScenario,
                reduceEmi: nearClosureScenario
            },
            reduceEmiApplicable: false,
            reduceEmiDisabledMessage: 'Reduce EMI is not applicable as the loan will close immediately.',
            recommendation: 'Reduce Tenure',
            recommendationMessage: 'Recommendation: Keep the EMI unchanged and let the loan close in the next few months.',
            timingInsight: 'This prepayment significantly reduces your loan. If you choose tenure reduction, your loan may close within a few months.',
            helperText: `Final payment: ${formatAdvisorCurrency(nearClosureScenario.finalPayment)} instead of the regular EMI.`
        };
    }

    const newTenureMonths = recalculateTenure(newPrincipal, monthlyRate, currentEmi);
    const reduceTenureSchedule = generateAmortizationSchedule(
        newPrincipal,
        monthlyRate,
        currentEmi,
        Math.max(1, newTenureMonths),
        hypotheticalDate
    );
    const reduceTenureFutureInterest = reduceTenureSchedule.reduce((sum, entry) => sum + entry.interestComponent, 0);
    const reduceTenureTotalInterest = roundCurrency(interestPaidBefore + reduceTenureFutureInterest);
    const reduceTenureTotalMonths = currentMonth + reduceTenureSchedule.length;
    const reduceTenureInterestSaved = roundCurrency(baselineInterest - reduceTenureTotalInterest);
    const reduceTenureMonthsSaved = Math.max(0, baselineMonths - reduceTenureTotalMonths);

    const reduceEmi = calculateEMI(newPrincipal, monthlyRate, remainingMonths);
    const reduceEmiSchedule = generateAmortizationSchedule(
        newPrincipal,
        monthlyRate,
        reduceEmi,
        remainingMonths,
        hypotheticalDate
    );
    const reduceEmiFutureInterest = reduceEmiSchedule.reduce((sum, entry) => sum + entry.interestComponent, 0);
    const reduceEmiTotalInterest = roundCurrency(interestPaidBefore + reduceEmiFutureInterest);
    const reduceEmiTotalMonths = currentMonth + reduceEmiSchedule.length;
    const reduceEmiInterestSaved = roundCurrency(baselineInterest - reduceEmiTotalInterest);
    const emiReduction = roundCurrency(currentEmi - reduceEmi);

    const emiToIncomeRatio = monthlyIncome && monthlyIncome > 0 ? currentEmi / monthlyIncome : null;
    const recommendReduceEmi = emiToIncomeRatio !== null && emiToIncomeRatio > 0.35;
    const recommendation = recommendReduceEmi
        ? 'Reduce EMI'
        : 'Reduce Tenure';
    const recommendationMessage = recommendReduceEmi
        ? 'Recommendation: Reduce EMI to ease monthly cash flow.'
        : 'Recommendation: Reduce tenure to maximize savings.';

    let timingLabel = 'Lower impact - most interest is already paid.';
    if (currentMonth < baselineMonths * 0.3) {
        timingLabel = 'Best time to prepay - maximum savings.';
    } else if (currentMonth < baselineMonths * 0.7) {
        timingLabel = 'Moderate benefit.';
    }

    return {
        isValid: true,
        sourceDate: hypotheticalDate,
        sourceAmount: appliedAmount,
        requestedAmount: normalizedAmount,
        message: normalizedAmount > remainingPrincipal
            ? `Requested prepayment was capped at ${formatAdvisorCurrency(remainingPrincipal)}.`
            : `Remaining principal after prepayment: ${formatAdvisorCurrency(newPrincipal)}.`,
        currentState: {
            remainingPrincipal,
            currentEmi,
            remainingMonths,
            monthlyInterestRate: monthlyRate,
            currentMonth,
            totalMonths: baselineMonths,
            cappedAmount: roundCurrency(appliedAmount),
            remainingPrincipalAfterPrepayment: roundCurrency(newPrincipal)
        },
        scenarios: {
            current: {
                emi: currentEmi,
                totalInterest: baselineInterest,
                totalMonths: baselineMonths,
                displayMonths: remainingMonths
            },
            reduceTenure: {
                emi: currentEmi,
                totalInterest: reduceTenureTotalInterest,
                totalMonths: reduceTenureTotalMonths,
                displayMonths: reduceTenureSchedule.length,
                interestSaved: reduceTenureInterestSaved,
                monthsSaved: reduceTenureMonthsSaved,
                emiReduction: 0,
                finalPayment: roundCurrency(reduceTenureSchedule[reduceTenureSchedule.length - 1]?.emi || 0),
                reduceEmiApplicable: true
            },
            reduceEmi: {
                emi: roundCurrency(reduceEmi),
                totalInterest: reduceEmiTotalInterest,
                totalMonths: reduceEmiTotalMonths,
                displayMonths: reduceEmiSchedule.length,
                interestSaved: reduceEmiInterestSaved,
                monthsSaved: Math.max(0, baselineMonths - reduceEmiTotalMonths),
                emiReduction,
                finalPayment: roundCurrency(reduceEmiSchedule[reduceEmiSchedule.length - 1]?.emi || 0),
                reduceEmiApplicable: true
            }
        },
        reduceEmiApplicable: true,
        recommendation,
        recommendationMessage,
        timingInsight: timingLabel,
        helperText: 'Earlier prepayments save more interest.'
    };
}

function formatAdvisorCurrency(amount) {
    return `₹${Number(amount || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    })}`;
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
