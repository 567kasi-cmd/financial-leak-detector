// loanSimulator.js - Core Loan Simulation Engine

import {
    calculateEMI,
    generateAmortizationSchedule,
    applyPrepaymentsToSchedule,
    getLoanProgress,
    calculatePrepaymentImpact,
    calculateHypotheticalPrepaymentImpact,
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
 * @param {object|null} hypotheticalPrepayment - { amount: number, date: Date } or null
 * @returns {object} Comprehensive simulation results.
 */
export async function simulateLoan(loanDetails, actualPrepayments = [], currentDate = new Date(), hypotheticalPrepayment = null) {
    const { loanAmount, annualInterestRate, loanTenureMonths, loanStartDate, monthlyIncome } = loanDetails;
    const monthlyRate = annualInterestRate / 12;

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
        finalEmi: modifiedEmi, // This will be the same as originalEmi if strategy is reduce tenure
        finalTotalInterest: modifiedTotalInterest,
        finalTotalMonths: modifiedTotalMonths
    } = applyPrepaymentsToSchedule(originalSchedule, sortedActualPrepayments, loanDetails);

    const modifiedTotalPayment = loanAmount + modifiedTotalInterest;

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
    const prepaymentImpact = calculatePrepaymentImpact(originalLoan, modifiedLoan);

    // --- 5. Simulate Hypothetical Prepayment Impact ---
    let hypotheticalPrepaymentImpactResult = null;
    if (hypotheticalPrepayment && hypotheticalPrepayment.amount > 0) {
        hypotheticalPrepaymentImpactResult = calculateHypotheticalPrepaymentImpact(
            modifiedLoan, // Use the modified loan as the base for hypothetical
            hypotheticalPrepayment,
            modifiedSchedule
        );
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
