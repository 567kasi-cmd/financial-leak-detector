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
    const userInput = Object.freeze({
        principal: Math.round(Number(loanAmount) || 0),
        interestRate: Number(annualInterestRate) || 0,
        tenureMonths: Math.round(Number(loanTenureMonths) || 0),
        loanStartDate: new Date(loanStartDate)
    });
    const monthlyRate = annualInterestRate / 12;

    // --- 1. Calculate Original Loan (without any prepayments) ---
    const originalEmi = calculateEMI(userInput.principal, monthlyRate, userInput.tenureMonths);
    const originalSchedule = generateAmortizationSchedule(userInput.principal, monthlyRate, originalEmi, userInput.tenureMonths, userInput.loanStartDate);

    const originalTotalInterest = originalSchedule.reduce((sum, entry) => sum + entry.interestComponent, 0);
    const originalTotalPayment = userInput.principal + originalTotalInterest;

    const originalLoan = {
        principal: userInput.principal,
        annualInterestRate: annualInterestRate,
        totalMonths: userInput.tenureMonths,
        emi: originalEmi,
        totalInterest: originalTotalInterest,
        totalPayment: originalTotalPayment,
        schedule: originalSchedule
    };

    // --- 2. Apply Actual Prepayments to generate the Modified Loan ---
    // Sort prepayments by date to ensure correct application order
    const sortedActualPrepayments = [...actualPrepayments].sort((a, b) => a.date.getTime() - b.date.getTime());
    const hasActualPrepayments = sortedActualPrepayments.length > 0;

    const reduceTenureScenario = applyPrepaymentsToSchedule(originalSchedule, sortedActualPrepayments, loanDetails, 'reduce-tenure');
    const reduceEmiScenario = applyPrepaymentsToSchedule(originalSchedule, sortedActualPrepayments, loanDetails, 'reduce-emi');
    const {
        modifiedSchedule,
        finalEmi: modifiedEmi,
        finalTotalInterest: modifiedTotalInterest,
        finalTotalMonths: modifiedTotalMonths
    } = reduceTenureScenario;

    const modifiedTotalPayment = userInput.principal + modifiedTotalInterest;

    const modifiedLoan = {
        principal: userInput.principal,
        annualInterestRate: annualInterestRate,
        totalMonths: modifiedTotalMonths,
        emi: modifiedEmi,
        totalInterest: modifiedTotalInterest,
        totalPayment: modifiedTotalPayment,
        schedule: modifiedSchedule
    };

    const reduceEmiLoan = {
        principal: userInput.principal,
        annualInterestRate: annualInterestRate,
        totalMonths: reduceEmiScenario.finalTotalMonths,
        emi: reduceEmiScenario.finalEmi,
        totalInterest: reduceEmiScenario.finalTotalInterest,
        totalPayment: userInput.principal + reduceEmiScenario.finalTotalInterest,
        schedule: reduceEmiScenario.modifiedSchedule
    };

    const emiComparisonTolerance = 2;
    const emiFallbackTolerance = 100;

    if (!hasActualPrepayments && modifiedLoan.totalMonths !== userInput.tenureMonths) {
        console.error('Tenure override bug', {
            expectedTenureMonths: userInput.tenureMonths,
            actualTenureMonths: modifiedLoan.totalMonths
        });
        throw new Error('Tenure override bug');
    }

    if (!hasActualPrepayments) {
        const roundedOriginalEmi = Math.round(originalLoan.emi);
        const roundedModifiedEmi = Math.round(modifiedLoan.emi);
        const emiDifference = Math.abs(roundedOriginalEmi - roundedModifiedEmi);

        if (emiDifference > emiComparisonTolerance) {
            console.warn('EMI mismatch without prepayments exceeded tolerance', {
                expectedEmi: roundedOriginalEmi,
                actualEmi: roundedModifiedEmi,
                tolerance: emiComparisonTolerance
            });

            if (emiDifference > emiFallbackTolerance) {
                const fallbackEmi = calculateEMI(userInput.principal, monthlyRate, userInput.tenureMonths);
                modifiedLoan.emi = fallbackEmi;
                reduceEmiLoan.emi = fallbackEmi;
                console.warn('Applied fallback EMI after large mismatch without prepayments', {
                    fallbackEmi,
                    expectedEmi: roundedOriginalEmi,
                    actualEmi: roundedModifiedEmi
                });
            }
        }
    }

    // --- 3. Calculate Loan Progress as of currentDate ---
    const loanProgress = getLoanProgress(modifiedSchedule, loanStartDate, currentDate);

    // --- 4. Calculate Prepayment Impact (comparison between original and modified loan) ---
    const prepaymentImpact = calculatePrepaymentImpact(originalLoan, modifiedLoan, reduceEmiLoan);

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
        userInput,
        calculatedOutput: {
            emi: originalLoan.emi,
            totalInterest: originalLoan.totalInterest,
            totalPayment: originalLoan.totalPayment,
            amortizationSchedule: originalSchedule
        },
        actualPlan: {
            emi: modifiedLoan.emi,
            totalInterest: modifiedLoan.totalInterest,
            totalPayment: modifiedLoan.totalPayment,
            totalMonths: modifiedLoan.totalMonths,
            amortizationSchedule: modifiedSchedule
        },
        simulationContext: {
            hypotheticalPrepayment
        },
        emi: modifiedEmi, // Final EMI after prepayments (will be original EMI if reduce tenure)
        totalInterest: modifiedTotalInterest, // Final total interest after prepayments
        totalPayment: modifiedTotalPayment, // Final total payment after prepayments

        loanProgress: loanProgress,

        prepaymentImpact: prepaymentImpact, // Impact of actual prepayments
        hypotheticalPrepaymentImpact: hypotheticalPrepaymentImpactResult, // Impact of what-if scenario

        loanHealth: loanHealth,
        insights: insights,

        updatedSchedule: modifiedSchedule, // The schedule after actual prepayments
        originalSchedule: originalSchedule,
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
        },
        reduceEmiLoan: {
            principal: reduceEmiLoan.principal,
            annualInterestRate: reduceEmiLoan.annualInterestRate,
            emi: reduceEmiLoan.emi,
            totalInterest: reduceEmiLoan.totalInterest,
            totalPayment: reduceEmiLoan.totalPayment,
            totalMonths: reduceEmiLoan.totalMonths
        }
    };
}
