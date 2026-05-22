// loanSimulator.js - Core Loan Simulation Engine

import {
    calculateEMI,
    generateAmortizationSchedule,
    applyPrepaymentsToSchedule,
    getLoanProgress,
    calculatePrepaymentImpact,
    calculateHypotheticalPrepaymentImpact,
    calculatePrepaymentPlanImpact,
    calculateLoanHealth,
    calculateBreakEvenPoint,
    simulateDebtPayoff // Keeping this import as insights.js might still use it
} from './calculations.js';

import { generateEnhancedInsights } from './insights.js';

/**
 * Main function to simulate a loan with optional prepayments and hypothetical scenarios.
 * @param {object} loanDetails - loanAmount, annualInterestRate (decimal), loanTenureMonths, loanStartDate, monthlyIncome (optional)
 * @param {Array<object>} actualPrepayments - Array of { amount: number, date: Date }
 * @param {Date} currentDate - The current date for loan progress calculation.
 * @param {Array<object>|object|null} futurePrepaymentsOrHypothetical - Hypothetical prepayment(s) to simulate.
 * @returns {object} Comprehensive simulation results.
 */
export async function simulateLoan(loanDetails, actualPrepayments = [], currentDate = new Date(), futurePrepaymentsOrHypothetical = null) {
    const { loanAmount, annualInterestRate, loanTenureMonths, loanStartDate, monthlyIncome } = loanDetails;
    const monthlyRate = annualInterestRate / 12;
    const futurePrepayments = Array.isArray(futurePrepaymentsOrHypothetical)
        ? futurePrepaymentsOrHypothetical
        : futurePrepaymentsOrHypothetical
            ? [futurePrepaymentsOrHypothetical]
            : [];

    // --- 1. Calculate Original Loan (without any prepayments) ---
    const originalEmi = calculateEMI(loanAmount, monthlyRate, loanTenureMonths);
    const originalSchedule = generateAmortizationSchedule(loanAmount, monthlyRate, originalEmi, loanTenureMonths, loanStartDate);

    const originalTotalInterest = originalSchedule.reduce((sum, entry) => sum + entry.interestComponent, 0);
    const originalTotalPayment = loanAmount + originalTotalInterest;

    const originalLoan = {
        principal: loanAmount,
        annualInterestRate: annualInterestRate,
        totalMonths: originalSchedule.length, // Use actual length in case of early payoff
        emi: originalEmi,
        totalInterest: originalTotalInterest,
        totalPayment: originalTotalPayment,
        schedule: originalSchedule
    };

    // --- 2. Apply Actual Prepayments to generate the Modified Loan ---
    // Sort prepayments by date to ensure correct application order
    const sortedActualPrepayments = [...actualPrepayments].sort((a, b) => a.date.getTime() - b.date.getTime());

    const {
        modifiedSchedule,
        finalEmi: modifiedEmi,
        finalTotalInterest: modifiedTotalInterest,
        finalTotalMonths: modifiedTotalMonths
    } = applyPrepaymentsToSchedule(originalSchedule, sortedActualPrepayments, loanDetails, 'reduceTenure');

    const {
        finalEmi: reducedEmiScenarioEmi,
        finalTotalInterest: reducedEmiScenarioInterest,
        finalTotalMonths: reducedEmiScenarioMonths
    } = applyPrepaymentsToSchedule(originalSchedule, sortedActualPrepayments, loanDetails, 'reduceEmi');

    const modifiedTotalPayment = loanAmount + modifiedTotalInterest;
    const reducedEmiScenarioPayment = loanAmount + reducedEmiScenarioInterest;

    const modifiedLoan = {
        principal: loanAmount, // This is the original principal, not remaining
        annualInterestRate: annualInterestRate,
        totalMonths: modifiedTotalMonths,
        emi: modifiedEmi,
        totalInterest: modifiedTotalInterest,
        totalPayment: modifiedTotalPayment,
        schedule: modifiedSchedule
    };

    // --- 3. Calculate Loan Progress as of currentDate ---
    const loanProgress = getLoanProgress(modifiedSchedule, loanStartDate, currentDate);

    // --- 4. Calculate Prepayment Impact (comparison between original and modified loan) ---
    const alternativeReduceEmiImpact = {
        newEmi: reducedEmiScenarioEmi,
        interestSaved: parseFloat((originalTotalInterest - reducedEmiScenarioInterest).toFixed(2)),
        percentageSavings: parseFloat((originalTotalInterest > 0
            ? ((originalTotalInterest - reducedEmiScenarioInterest) / originalTotalInterest) * 100
            : 0).toFixed(2)),
        totalMonths: reducedEmiScenarioMonths,
        totalInterest: reducedEmiScenarioInterest,
        totalPayment: parseFloat(reducedEmiScenarioPayment.toFixed(2))
    };

    const prepaymentImpact = calculatePrepaymentImpact(originalLoan, modifiedLoan, alternativeReduceEmiImpact);

    // --- 5. Simulate Future Prepayment Plan Impact ---
    let futurePlanImpact = null;
    let hypotheticalPrepaymentImpactResult = null;
    if (futurePrepayments.length > 0) {
        const sortedFuturePrepayments = [...futurePrepayments].sort((a, b) => a.date.getTime() - b.date.getTime());
        const combinedPrepayments = [...sortedActualPrepayments, ...futurePrepayments]
            .sort((a, b) => a.date.getTime() - b.date.getTime());
        futurePlanImpact = calculatePrepaymentPlanImpact(originalLoan, combinedPrepayments, originalSchedule);
        if (futurePlanImpact) {
            const futureAdditionalInterestSaved = parseFloat((modifiedLoan.totalInterest - futurePlanImpact.reduceTenure.totalInterest).toFixed(2));
            const futureAdditionalMonthsReduced = modifiedLoan.totalMonths - futurePlanImpact.reduceTenure.totalMonths;
            const firstFutureDate = sortedFuturePrepayments[0]?.date || futurePlanImpact.firstPlannedDate;
            const totalFutureAmount = sortedFuturePrepayments.reduce((sum, item) => sum + item.amount, 0);

            hypotheticalPrepaymentImpactResult = {
                amount: totalFutureAmount,
                date: firstFutureDate,
                interestSaved: futureAdditionalInterestSaved,
                monthsReduced: futureAdditionalMonthsReduced,
                percentageSavings: parseFloat((modifiedLoan.totalInterest > 0
                    ? (futureAdditionalInterestSaved / modifiedLoan.totalInterest) * 100
                    : 0).toFixed(2))
            };

            futurePlanImpact.additionalInterestSaved = futureAdditionalInterestSaved;
            futurePlanImpact.additionalMonthsReduced = futureAdditionalMonthsReduced;
            futurePlanImpact.additionalPercentageSavings = parseFloat((modifiedLoan.totalInterest > 0
                ? (futureAdditionalInterestSaved / modifiedLoan.totalInterest) * 100
                : 0).toFixed(2));
            futurePlanImpact.optionalEmiReduction = parseFloat((modifiedLoan.emi - futurePlanImpact.reduceEmi.emi).toFixed(2));
            futurePlanImpact.futurePlannedAmount = parseFloat(totalFutureAmount.toFixed(2));
        }
    }

    // --- 6. Calculate Loan Health Score ---
    const loanHealth = calculateLoanHealth(modifiedLoan, monthlyIncome, modifiedEmi);

    // --- 7. Calculate Break-even Point ---
    const breakEvenMonth = calculateBreakEvenPoint(modifiedSchedule);

    // --- 8. Generate Insights ---
    // Pass the entire simulation results object to insights for comprehensive analysis
    const insights = generateEnhancedInsights({
        originalLoan,
        modifiedLoan,
        loanProgress,
        prepaymentImpact,
        hypotheticalPrepaymentImpact: hypotheticalPrepaymentImpactResult,
        futurePrepaymentPlanImpact: futurePlanImpact,
        loanHealth,
        breakEvenMonth
    });

    // --- Final Output Structure ---
    return {
        emi: modifiedEmi, // Final EMI after prepayments (will be original EMI if reduce tenure)
        totalInterest: modifiedTotalInterest, // Final total interest after prepayments
        totalPayment: modifiedTotalPayment, // Final total payment after prepayments

        loanProgress: loanProgress,

        prepaymentImpact: prepaymentImpact, // Impact of actual prepayments
        hypotheticalPrepaymentImpact: hypotheticalPrepaymentImpactResult, // Impact of what-if scenario
        futurePrepaymentPlanImpact: futurePlanImpact,

        loanHealth: loanHealth,
        insights: insights,

        updatedSchedule: modifiedSchedule, // The schedule after actual prepayments
        breakEvenMonth: breakEvenMonth,

        // For comparison mode
        originalLoan: {
            principal: originalLoan.principal,
            annualInterestRate: originalLoan.annualInterestRate,
            emi: originalLoan.emi,
            totalInterest: originalLoan.totalInterest,
            totalPayment: originalLoan.totalPayment,
            totalMonths: originalLoan.totalMonths
        },
        modifiedLoan: { // Summary of the loan after actual prepayments
            principal: modifiedLoan.principal,
            annualInterestRate: modifiedLoan.annualInterestRate,
            emi: modifiedLoan.emi,
            totalInterest: modifiedLoan.totalInterest,
            totalPayment: modifiedLoan.totalPayment,
            totalMonths: modifiedLoan.totalMonths
        }
    };
}
