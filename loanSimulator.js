// Interfaces for better type management
// Note: Interfaces are TypeScript-specific and will be removed during transpilation to JavaScript.
// They are kept here for reference if you are using a TypeScript-aware editor.

/**
 * @typedef {object} LoanInput
 * @property {number} loanAmount
 * @property {number} annualInterestRate // e.g., 0.08 for 8%
 * @property {number} loanTenureMonths
 * @property {Date} loanStartDate
 * @property {number} [emi] // Optional, will be calculated if not provided
 */

/**
 * @typedef {object} Prepayment
 * @property {number} amount
 * @property {Date} date
 */

/**
 * @typedef {object} ScheduleEntry
 * @property {number} month // 1-based month number in the loan tenure
 * @property {Date} date
 * @property {number} openingBalance
 * @property {number} emi
 * @property {number} principalComponent
 * @property {number} interestComponent
 * @property {number} closingBalance
 * @property {number} cumulativePrincipalPaid
 * @property {number} cumulativeInterestPaid
 */

/**
 * @typedef {object} LoanProgress
 * @property {number} paidEmis
 * @property {number} principalPaid
 * @property {number} interestPaid
 * @property {number} remainingBalance
 * @property {number} monthsRemaining
 */

/**
 * @typedef {object} ActualPrepaymentImpactDetails
 * @property {object} scenarioReduceEmi
 * @property {number} scenarioReduceEmi.newEmi
 * @property {number} scenarioReduceEmi.interestSaved
 * @property {number} scenarioReduceEmi.percentageSavings
 * @property {object} scenarioReduceTenure
 * @property {number} scenarioReduceTenure.newTenureMonths
 * @property {number} scenarioReduceTenure.monthsReduced
 * @property {number} scenarioReduceTenure.interestSaved
 * @property {number} scenarioReduceTenure.percentageSavings
 */

/**
 * @typedef {object} FinalPrepaymentImpact
 * @property {number} interestSaved
 * @property {number} [newEmi] // Only if choosing to reduce EMI
 * @property {number} [newTenure] // Only if choosing to reduce tenure
 * @property {number} monthsReduced
 * @property {number} percentageSavings
 */

/**
 * @typedef {object} WhatIfImpact
 * @property {number} amount // The amount of the hypothetical prepayment
 * @property {Date} date // The date of the hypothetical prepayment
 * @property {number} interestSaved
 * @property {number} monthsReduced
 * @property {number} percentageSavings
 */

/**
 * @typedef {object} LoanHealth
 * @property {number} score
 * @property {"Excellent" | "Good" | "Average" | "Poor"} rating
 * @property {string} message
 */

/**
 * @typedef {object} ChartData
 * @property {Array<{month: number, principal: number, interest: number}>} principalVsInterest
 * @property {Array<{month: number, balance: number}>} balanceOverTime
 */

/**
 * @typedef {object} LoanSimulationResult
 * @property {number} emi // Original EMI
 * @property {number} totalInterest // Total interest paid over the life of the loan (after prepayments)
 * @property {number} totalPayment // Total principal + interest paid over the life of the loan (after prepayments)
 * @property {LoanProgress} loanProgress
 * @property {FinalPrepaymentImpact} prepaymentImpact // Impact of actual prepayments (defaulting to reduce tenure)
 * @property {object} [alternativeReduceEmiImpact] // Alternative scenario for actual prepayments
 * @property {number} alternativeReduceEmiImpact.newEmi
 * @property {number} alternativeReduceEmiImpact.interestSaved
 * @property {number} alternativeReduceEmiImpact.percentageSavings
 * @property {WhatIfImpact} [hypotheticalPrepaymentImpact] // Impact of a "what if" prepayment
 * @property {LoanHealth} loanHealth
 * @property {string[]} insights
 * @property {number} [breakEvenMonth]
 * @property {ScheduleEntry[]} updatedSchedule
 * @property {ChartData} chartData
 */


/**
 * Calculates the Equated Monthly Installment (EMI) for a loan.
 * @param {number} principal The principal loan amount.
 * @param {number} annualInterestRate The annual interest rate (e.g., 0.08 for 8%).
 * @param {number} tenureMonths The loan tenure in months.
 * @returns {number} The calculated EMI.
 */
export function calculateEMI(principal, annualInterestRate, tenureMonths) {
  if (annualInterestRate === 0) {
    return parseFloat((principal / tenureMonths).toFixed(2));
  }
  const monthlyInterestRate = annualInterestRate / 12;
  const emi =
    (principal * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, tenureMonths)) /
    (Math.pow(1 + monthlyInterestRate, tenureMonths) - 1);
  return parseFloat(emi.toFixed(2)); // Round to 2 decimal places
}

/**
 * Helper function to generate a schedule from a given starting point.
 * @param {number} startBalance The balance at the start of this partial schedule.
 * @param {number} annualInterestRate The annual interest rate.
 * @param {number} startMonth The 1-based month number from the original loan start.
 * @param {Date} initialLoanStartDate The original loan start date.
 * @param {number} emi The EMI to use for this partial schedule.
 * @param {number} maxMonths The maximum number of months to generate (e.g., original tenure remaining).
 * @param {number} cumulativePrincipalPaidBefore Cumulative principal paid before this partial schedule starts.
 * @param {number} cumulativeInterestPaidBefore Cumulative interest paid before this partial schedule starts.
 * @returns {ScheduleEntry[]} An array of ScheduleEntry objects.
 */
function _generatePartialSchedule(
  startBalance,
  annualInterestRate,
  startMonth,
  initialLoanStartDate,
  emi,
  maxMonths,
  cumulativePrincipalPaidBefore,
  cumulativeInterestPaidBefore
) {
  const schedule = [];
  let currentBalance = startBalance;
  const monthlyInterestRate = annualInterestRate / 12;

  let cumulativePrincipal = cumulativePrincipalPaidBefore;
  let cumulativeInterest = cumulativeInterestPaidBefore;

  for (let month = startMonth; month < startMonth + maxMonths; month++) {
    if (currentBalance <= 0.01) { // Loan paid off
      break;
    }

    const interestComponent = parseFloat((currentBalance * monthlyInterestRate).toFixed(2));
    let principalComponent = parseFloat((emi - interestComponent).toFixed(2));

    // Handle cases where EMI is less than interest (shouldn't happen with correct EMI)
    if (principalComponent < 0) {
        principalComponent = 0;
    }

    // Adjust for the last payment to clear the remaining balance exactly
    if (principalComponent > currentBalance) {
        principalComponent = currentBalance;
    }

    currentBalance = parseFloat((currentBalance - principalComponent).toFixed(2));
    if (currentBalance < 0) currentBalance = 0; // Ensure balance doesn't go negative due to rounding

    const paymentDate = new Date(initialLoanStartDate);
    paymentDate.setMonth(initialLoanStartDate.getMonth() + month -1); // month is 1-based, setMonth is 0-based for month index

    cumulativePrincipal += principalComponent;
    cumulativeInterest += interestComponent;

    schedule.push({
      month,
      date: paymentDate,
      openingBalance: parseFloat((currentBalance + principalComponent).toFixed(2)),
      emi: emi,
      principalComponent,
      interestComponent,
      closingBalance: currentBalance,
      cumulativePrincipalPaid: parseFloat(cumulativePrincipal.toFixed(2)),
      cumulativeInterestPaid: parseFloat(cumulativeInterest.toFixed(2)),
    });

    // If balance is cleared before maxMonths, stop generating schedule
    if (currentBalance <= 0.01) {
        const lastEntry = schedule[schedule.length - 1];
        lastEntry.closingBalance = 0;
        lastEntry.emi = parseFloat((lastEntry.principalComponent + lastEntry.interestComponent).toFixed(2)); // Actual EMI for last month
        break;
    }
  }
  return schedule;
}

/**
 * Generates the full amortization schedule for a loan.
 * @param {number} loanAmount The total loan amount.
 * @param {number} annualInterestRate The annual interest rate (e.g., 0.08 for 8%).
 * @param {number} loanTenureMonths The loan tenure in months.
 * @param {Date} loanStartDate The start date of the loan.
 * @param {number} [emi] The EMI amount. If not provided, it will be calculated.
 * @returns {ScheduleEntry[]} An array of ScheduleEntry objects representing the amortization schedule.
 */
export function generateSchedule(
  loanAmount,
  annualInterestRate,
  loanTenureMonths,
  loanStartDate,
  emi
) {
  const calculatedEmi = emi || calculateEMI(loanAmount, annualInterestRate, loanTenureMonths);
  return _generatePartialSchedule(
    loanAmount,
    annualInterestRate,
    1, // Start from month 1
    loanStartDate,
    calculatedEmi,
    loanTenureMonths,
    0, // No cumulative principal paid before
    0  // No cumulative interest paid before
  );
}

/**
 * Provides real-time insights into loan progress based on the current date.
 * @param {ScheduleEntry[]} schedule The full amortization schedule.
 * @param {Date} currentDate The current date to evaluate progress against.
 * @returns {LoanProgress} A LoanProgress object.
 */
export function getLoanProgress(schedule, currentDate) {
  let paidEmis = 0;
  let principalPaid = 0;
  let interestPaid = 0;
  let remainingBalance = schedule.length > 0 ? schedule[0].openingBalance : 0; // Start with initial loan amount

  for (const entry of schedule) {
    if (entry.date <= currentDate) {
      paidEmis++;
      principalPaid += entry.principalComponent;
      interestPaid += entry.interestComponent;
      remainingBalance = entry.closingBalance;
    } else {
      // Once we pass the current date, the remaining balance is from the last paid EMI
      break;
    }
  }

  const monthsRemaining = schedule.length - paidEmis;

  return {
    paidEmis: parseFloat(paidEmis.toFixed(2)),
    principalPaid: parseFloat(principalPaid.toFixed(2)),
    interestPaid: parseFloat(interestPaid.toFixed(2)),
    remainingBalance: parseFloat(remainingBalance.toFixed(2)),
    monthsRemaining,
  };
}

/**
 * @typedef {object} AppliedPrepaymentResult
 * @property {ScheduleEntry[]} updatedSchedule
 * @property {number} totalInterestPaid
 * @property {number} finalBalance
 * @property {number} finalTenureMonths
 */

/**
 * Applies prepayments to the loan schedule, recalculating future EMIs based on the original EMI
 * (effectively reducing tenure).
 * @param {number} loanAmount The initial loan amount.
 * @param {number} annualInterestRate The annual interest rate.
 * @param {number} loanTenureMonths The original loan tenure in months.
 * @param {Date} loanStartDate The original loan start date.
 * @param {number} originalEmi The EMI calculated for the original loan.
 * @param {Prepayment[]} prepayments An array of prepayment objects.
 * @returns {AppliedPrepaymentResult} An AppliedPrepaymentResult object containing the updated schedule and financial summaries.
 */
export function applyPrepayments(
  loanAmount,
  annualInterestRate,
  loanTenureMonths,
  loanStartDate,
  originalEmi,
  prepayments
) {
  const sortedPrepayments = [...prepayments].sort((a, b) => a.date.getTime() - b.date.getTime());

  const schedule = [];
  let currentBalance = loanAmount;
  const monthlyInterestRate = annualInterestRate / 12;
  let cumulativePrincipal = 0;
  let cumulativeInterest = 0;
  let prepaymentIndex = 0;
  let totalInterestInNewSchedule = 0;
  let finalTenure = 0;

  for (let month = 1; month <= loanTenureMonths; month++) {
    const paymentDate = new Date(loanStartDate);
    paymentDate.setMonth(loanStartDate.getMonth() + month -1); // month is 1-based, setMonth is 0-based for month index

    // Apply prepayments that occurred before or on this payment date
    while (prepaymentIndex < sortedPrepayments.length && sortedPrepayments[prepaymentIndex].date <= paymentDate) {
      const prepay = sortedPrepayments[prepaymentIndex];
      currentBalance -= prepay.amount;
      if (currentBalance < 0) currentBalance = 0; // Loan paid off
      prepaymentIndex++;
    }

    if (currentBalance <= 0.01) { // Loan paid off
      finalTenure = month - 1; // Loan paid off in the previous month, or this month if balance was 0 before EMI
      break;
    }

    const interestComponent = parseFloat((currentBalance * monthlyInterestRate).toFixed(2));
    let principalComponent = parseFloat((originalEmi - interestComponent).toFixed(2));

    if (principalComponent < 0) {
        principalComponent = 0;
    }

    if (principalComponent > currentBalance) {
        principalComponent = currentBalance;
    }

    currentBalance = parseFloat((currentBalance - principalComponent).toFixed(2));
    if (currentBalance < 0) currentBalance = 0;

    cumulativePrincipal += principalComponent;
    cumulativeInterest += interestComponent;
    totalInterestInNewSchedule += interestComponent;

    schedule.push({
      month,
      date: paymentDate,
      openingBalance: parseFloat((currentBalance + principalComponent).toFixed(2)),
      emi: originalEmi,
      principalComponent,
      interestComponent,
      closingBalance: currentBalance,
      cumulativePrincipalPaid: parseFloat(cumulativePrincipal.toFixed(2)),
      cumulativeInterestPaid: parseFloat(cumulativeInterest.toFixed(2)),
    });

    if (currentBalance <= 0.01) {
        const lastEntry = schedule[schedule.length - 1];
        lastEntry.closingBalance = 0;
        lastEntry.emi = parseFloat((lastEntry.principalComponent + lastEntry.interestComponent).toFixed(2));
        finalTenure = month;
        break;
    }
    finalTenure = month; // Update final tenure if loop completes
  }

  return {
    updatedSchedule: schedule,
    totalInterestPaid: parseFloat(totalInterestInNewSchedule.toFixed(2)),
    finalBalance: parseFloat(currentBalance.toFixed(2)),
    finalTenureMonths: finalTenure
  };
}

/**
 * Recalculates loan parameters after prepayments, offering two scenarios:
 * A. Reduce EMI (tenure same as original)
 * B. Reduce tenure (EMI same as original)
 * @param {number} originalLoanAmount The initial loan amount.
 * @param {number} originalTenureMonths The initial loan tenure in months.
 * @param {number} originalEmi The initial calculated EMI.
 * @param {number} annualInterestRate The annual interest rate.
 * @param {number} currentRemainingBalance The loan balance after prepayments.
 * @param {number} currentRemainingTenureMonths The remaining tenure in months if EMI was kept same after prepayments (from applyPrepayments result).
 * @param {number} totalInterestPaidOriginal The total interest paid over the original loan tenure.
 * @param {number} totalInterestPaidAfterPrepayments The total interest paid in the schedule after prepayments (with reduced tenure).
 * @returns {ActualPrepaymentImpactDetails} ActualPrepaymentImpactDetails object.
 */
export function recalculateLoanAfterPrepayment(
  originalLoanAmount,
  originalTenureMonths,
  originalEmi,
  annualInterestRate,
  currentRemainingBalance,
  currentRemainingTenureMonths, // This is the tenure *after* prepayments if EMI was kept same
  totalInterestPaidOriginal,
  totalInterestPaidAfterPrepayments
) {
  const impact = {
    scenarioReduceEmi: { newEmi: 0, interestSaved: 0, percentageSavings: 0 },
    scenarioReduceTenure: { newTenureMonths: 0, monthsReduced: 0, interestSaved: 0, percentageSavings: 0 },
  };

  // Scenario B: Reduce tenure (EMI same as original)
  // This is already the outcome of `applyPrepayments`
  impact.scenarioReduceTenure.newTenureMonths = currentRemainingTenureMonths;
  impact.scenarioReduceTenure.monthsReduced = originalTenureMonths - currentRemainingTenureMonths;
  impact.scenarioReduceTenure.interestSaved = parseFloat((totalInterestPaidOriginal - totalInterestPaidAfterPrepayments).toFixed(2));
  impact.scenarioReduceTenure.percentageSavings = totalInterestPaidOriginal > 0 ?
    parseFloat(((impact.scenarioReduceTenure.interestSaved / totalInterestPaidOriginal) * 100).toFixed(2)) : 0;


  // Scenario A: Reduce EMI (tenure same as original)
  // Calculate new EMI based on current remaining balance and original remaining tenure
  const monthlyInterestRate = annualInterestRate / 12;
  if (currentRemainingBalance > 0 && originalTenureMonths > 0) {
    const newEmiIfTenureSame = calculateEMI(currentRemainingBalance, annualInterestRate, originalTenureMonths);
    impact.scenarioReduceEmi.newEmi = newEmiIfTenureSame;

    // To calculate interest saved for this scenario, we need to generate a new schedule
    // with the new EMI and original tenure.
    let tempBalance = currentRemainingBalance;
    let tempTotalInterest = 0;
    for (let month = 1; month <= originalTenureMonths; month++) {
      if (tempBalance <= 0.01) break;
      const interestComponent = parseFloat((tempBalance * monthlyInterestRate).toFixed(2));
      let principalComponent = parseFloat((newEmiIfTenureSame - interestComponent).toFixed(2));
      if (principalComponent < 0) principalComponent = 0;
      if (principalComponent > tempBalance) principalComponent = tempBalance;
      tempBalance = parseFloat((tempBalance - principalComponent).toFixed(2));
      tempTotalInterest += interestComponent;
    }
    const totalInterestWithNewEmi = parseFloat(tempTotalInterest.toFixed(2));
    impact.scenarioReduceEmi.interestSaved = parseFloat((totalInterestPaidOriginal - totalInterestWithNewEmi).toFixed(2));
    impact.scenarioReduceEmi.percentageSavings = totalInterestPaidOriginal > 0 ?
      parseFloat(((impact.scenarioReduceEmi.interestSaved / totalInterestPaidOriginal) * 100).toFixed(2)) : 0;

  } else {
    // Loan already paid off or no remaining tenure
    impact.scenarioReduceEmi.newEmi = 0;
    impact.scenarioReduceEmi.interestSaved = parseFloat(totalInterestPaidOriginal.toFixed(2)); // All interest saved if loan is paid off
    impact.scenarioReduceEmi.percentageSavings = totalInterestPaidOriginal > 0 ? 100 : 0;
  }

  return impact;
}

/**
 * Simulates the impact of a hypothetical prepayment on the loan.
 * @param {LoanInput} loanInput The initial loan details.
 * @param {Prepayment[]} existingPrepayments An array of prepayments already applied to the loan.
 * @param {Prepayment} hypotheticalPrepayment The single hypothetical prepayment to simulate.
 * @returns {WhatIfImpact} A WhatIfImpact object.
 */
export function simulatePrepaymentImpact(
  loanInput,
  existingPrepayments,
  hypotheticalPrepayment
) {
  const originalEmi = loanInput.emi || calculateEMI(loanInput.loanAmount, loanInput.annualInterestRate, loanInput.loanTenureMonths);

  // 1. Calculate scenario WITHOUT hypothetical prepayment (but with existing prepayments)
  const {
    totalInterestPaid: totalInterestWithoutHypothetical,
    finalTenureMonths: tenureWithoutHypothetical
  } = applyPrepayments(
    loanInput.loanAmount,
    loanInput.annualInterestRate,
    loanInput.loanTenureMonths,
    loanInput.loanStartDate,
    originalEmi,
    existingPrepayments
  );

  // 2. Calculate scenario WITH hypothetical prepayment (and existing prepayments)
  const allPrepayments = [...existingPrepayments, hypotheticalPrepayment];
  const {
    totalInterestPaid: totalInterestWithHypothetical,
    finalTenureMonths: tenureWithHypothetical
  } = applyPrepayments(
    loanInput.loanAmount,
    loanInput.annualInterestRate,
    loanInput.loanTenureMonths,
    loanInput.loanStartDate,
    originalEmi,
    allPrepayments
  );

  const interestSaved = parseFloat((totalInterestWithoutHypothetical - totalInterestWithHypothetical).toFixed(2));
  const monthsReduced = tenureWithoutHypothetical - tenureWithHypothetical;
  const percentageSavings = totalInterestWithoutHypothetical > 0 ?
    parseFloat(((interestSaved / totalInterestWithoutHypothetical) * 100).toFixed(2)) : 0;

  return {
    amount: hypotheticalPrepayment.amount,
    date: hypotheticalPrepayment.date,
    interestSaved,
    monthsReduced,
    percentageSavings,
  };
}

/**
 * Generates data suitable for charting cumulative principal vs interest and balance over time.
 * @param {ScheduleEntry[]} schedule The amortization schedule.
 * @returns {ChartData} ChartData object.
 */
export function getChartData(schedule) {
  const principalVsInterest = [];
  const balanceOverTime = [];

  schedule.forEach(entry => {
    principalVsInterest.push({
      month: entry.month,
      principal: entry.cumulativePrincipalPaid,
      interest: entry.cumulativeInterestPaid,
    });
    balanceOverTime.push({
      month: entry.month,
      balance: entry.closingBalance,
    });
  });

  return {
    principalVsInterest,
    balanceOverTime,
  };
}

/**
 * Finds the month where cumulative principal paid exceeds cumulative interest paid (break-even point).
 * @param {ScheduleEntry[]} schedule The amortization schedule.
 * @returns {number | undefined} The month number, or undefined if not found within the schedule.
 */
export function getBreakEvenPoint(schedule) {
  for (const entry of schedule) {
    if (entry.cumulativePrincipalPaid > entry.cumulativeInterestPaid) {
      return entry.month;
    }
  }
  return undefined;
}

/**
 * Generates a health score and rating for the loan.
 * @param {number} loanAmount The initial loan amount.
 * @param {number} annualInterestRate The annual interest rate.
 * @param {number} originalTenureMonths The original loan tenure in months.
 * @param {number} totalInterestPaid The total interest paid over the loan's lifetime.
 * @param {number} totalPrincipalPaid The total principal paid over the loan's lifetime.
 * @param {number} prepaymentsCount The number of prepayments made.
 * @param {number} finalTenureMonths The actual final tenure after prepayments.
 * @returns {LoanHealth} LoanHealth object.
 */
export function getLoanHealthScore(
  loanAmount,
  annualInterestRate,
  originalTenureMonths,
  totalInterestPaid,
  totalPrincipalPaid,
  prepaymentsCount,
  finalTenureMonths
) {
  let score = 0;
  const messages = [];

  // 1. Interest Paid Ratio
  const totalPayment = totalPrincipalPaid + totalInterestPaid;
  const interestRatio = totalPayment > 0 ? (totalInterestPaid / totalPayment) : 0;
  if (interestRatio < 0.2) { // Less than 20% interest
    score += 40;
    messages.push("Excellent interest-to-principal ratio.");
  } else if (interestRatio < 0.35) { // 20-35%
    score += 30;
    messages.push("Good interest-to-principal ratio.");
  } else if (interestRatio < 0.5) { // 35-50%
    score += 20;
    messages.push("Average interest-to-principal ratio.");
  } else {
    score += 10;
    messages.push("High interest-to-principal ratio.");
  }

  // 2. Tenure Length (relative to original)
  const tenureReduction = originalTenureMonths - finalTenureMonths;
  if (tenureReduction > originalTenureMonths * 0.25) { // Reduced by more than 25%
    score += 30;
    messages.push("Significantly reduced loan tenure.");
  } else if (tenureReduction > originalTenureMonths * 0.1) { // Reduced by 10-25%
    score += 20;
    messages.push("Good reduction in loan tenure.");
  } else if (tenureReduction > 0) {
    score += 10;
    messages.push("Some reduction in loan tenure.");
  } else {
    messages.push("No tenure reduction from prepayments.");
  }

  // 3. Prepayment Activity
  if (prepaymentsCount > 2) {
    score += 20;
    messages.push("Frequent prepayment activity.");
  } else if (prepaymentsCount > 0) {
    score += 10;
    messages.push("Active prepayment strategy.");
  } else {
    messages.push("No prepayments made.");
  }

  // 4. Interest Rate Impact (simple check)
  if (annualInterestRate <= 0.05) { // 5% or less
    score += 10;
    messages.push("Favorable low interest rate.");
  } else if (annualInterestRate <= 0.08) { // 5-8%
    score += 5;
    messages.push("Moderate interest rate.");
  } else {
    messages.push("Higher interest rate loan.");
  }

  // Cap score at 100
  score = Math.min(100, score);

  let rating;
  if (score >= 80) {
    rating = "Excellent";
  } else if (score >= 60) {
    rating = "Good";
  } else if (score >= 40) {
    rating = "Average";
  } else {
    rating = "Poor";
  }

  return {
    score: parseFloat(score.toFixed(0)),
    rating,
    message: messages.join(" "),
  };
}

/**
 * Generates smart insights about the loan.
 * @param {LoanInput} loanInput The initial loan details.
 * @param {ScheduleEntry[]} schedule The final amortization schedule.
 * @param {LoanProgress} loanProgress The current loan progress.
 * @param {ActualPrepaymentImpactDetails} actualPrepaymentImpact The impact of actual prepayments.
 * @param {number} [breakEvenMonth] The break-even month.
 * @param {WhatIfImpact} [hypotheticalPrepaymentImpact] Optional hypothetical prepayment impact.
 * @returns {string[]} An array of insight strings.
 */
export function generateInsights(
  loanInput,
  schedule,
  loanProgress,
  actualPrepaymentImpact,
  breakEvenMonth,
  hypotheticalPrepaymentImpact
) {
  const insights = [];

  const totalInterestPaid = schedule.reduce((sum, entry) => sum + entry.interestComponent, 0);
  const totalPrincipalPaid = schedule.reduce((sum, entry) => sum + entry.principalComponent, 0);

  // General insights
  if (loanProgress.remainingBalance > 0) { // Only if loan is not yet completed
    if (loanProgress.principalPaid < loanProgress.interestPaid) {
      insights.push("You have paid more interest than principal so far.");
    } else {
      insights.push("You have paid more principal than interest so far. Good progress!");
    }
  }


  if (breakEvenMonth !== undefined) {
    insights.push(`Your loan's break-even point (where cumulative principal paid exceeds cumulative interest paid) is around month ${breakEvenMonth}.`);
  } else if (totalPrincipalPaid > totalInterestPaid) {
    insights.push("You've paid off more principal than interest over the loan's lifetime.");
  } else {
    insights.push("Over the loan's lifetime, you've paid more interest than principal.");
  }

  // Prepayment insights
  if (actualPrepaymentImpact.scenarioReduceTenure.monthsReduced > 0) {
    insights.push(
      `Your prepayments have helped you reduce your loan tenure by ${actualPrepaymentImpact.scenarioReduceTenure.monthsReduced} months, saving you ₹${actualPrepaymentImpact.scenarioReduceTenure.interestSaved.toFixed(2)} in interest.`
    );
  } else if (actualPrepaymentImpact.scenarioReduceEmi.interestSaved > 0) {
    insights.push(
      `By keeping your original tenure, your prepayments could reduce your EMI to ₹${actualPrepaymentImpact.scenarioReduceEmi.newEmi.toFixed(2)}, saving you ₹${actualPrepaymentImpact.scenarioReduceEmi.interestSaved.toFixed(2)} in interest.`
    );
  } else {
    insights.push("Consider making prepayments to save on interest and reduce your loan tenure.");
  }

  // Hypothetical prepayment insight
  if (hypotheticalPrepaymentImpact) {
    insights.push(
      `A hypothetical prepayment of ₹${hypotheticalPrepaymentImpact.amount.toFixed(2)} on ${hypotheticalPrepaymentImpact.date.toLocaleDateString()} could save you an additional ₹${hypotheticalPrepaymentImpact.interestSaved.toFixed(2)} in interest and reduce your tenure by ${hypotheticalPrepaymentImpact.monthsReduced} months.`
    );
  }

  // Loan completion insight
  if (loanProgress.remainingBalance <= 0.01) {
    insights.push("Congratulations! Your loan is fully paid off.");
  } else if (loanProgress.monthsRemaining <= 12 && loanProgress.monthsRemaining > 0) {
    insights.push(`You are in the final year of your loan! Only ${loanProgress.monthsRemaining} months remaining.`);
  }

  return insights;
}


/**
 * Main function to simulate the loan and generate a comprehensive report.
 * @param {LoanInput} loanInput The initial loan details.
 * @param {Prepayment[]} [prepayments=[]] An array of prepayments made.
 * @param {Date} [currentDate=new Date()] The current date for loan progress calculation.
 * @param {Prepayment} [hypotheticalPrepayment] Optional: a single hypothetical prepayment to simulate "What If".
 * @returns {LoanSimulationResult} A LoanSimulationResult object.
 */
export function simulateLoan(
  loanInput,
  prepayments = [],
  currentDate = new Date(),
  hypotheticalPrepayment
) {
  const originalEmi = loanInput.emi || calculateEMI(loanInput.loanAmount, loanInput.annualInterestRate, loanInput.loanTenureMonths);

  // 1. Generate original schedule to get total interest for comparison
  const originalSchedule = generateSchedule(
    loanInput.loanAmount,
    loanInput.annualInterestRate,
    loanInput.loanTenureMonths,
    loanInput.loanStartDate,
    originalEmi
  );
  const totalInterestOriginal = originalSchedule.reduce((sum, entry) => sum + entry.interestComponent, 0);

  // 2. Apply prepayments to get the updated schedule and actual final tenure/interest
  const {
    updatedSchedule,
    totalInterestPaid: totalInterestAfterPrepayments,
    finalBalance,
    finalTenureMonths
  } = applyPrepayments(
    loanInput.loanAmount,
    loanInput.annualInterestRate,
    loanInput.loanTenureMonths,
    loanInput.loanStartDate,
    originalEmi,
    prepayments
  );

  const totalPrincipalPaid = updatedSchedule.reduce((sum, entry) => sum + entry.principalComponent, 0);
  const totalPayment = totalPrincipalPaid + totalInterestAfterPrepayments;

  // 3. Recalculate loan impact (reduce EMI vs reduce tenure)
  const actualPrepaymentImpactDetails = recalculateLoanAfterPrepayment(
    loanInput.loanAmount,
    loanInput.loanTenureMonths,
    originalEmi,
    loanInput.annualInterestRate,
    finalBalance, // Use the final balance after all prepayments
    finalTenureMonths, // Use the actual final tenure after prepayments
    totalInterestOriginal,
    totalInterestAfterPrepayments
  );

  // Populate the FinalPrepaymentImpact for the result (defaulting to reduce tenure)
  const finalPrepaymentImpact = {
    interestSaved: actualPrepaymentImpactDetails.scenarioReduceTenure.interestSaved,
    monthsReduced: actualPrepaymentImpactDetails.scenarioReduceTenure.monthsReduced,
    newTenure: actualPrepaymentImpactDetails.scenarioReduceTenure.newTenureMonths,
    percentageSavings: actualPrepaymentImpactDetails.scenarioReduceTenure.percentageSavings,
  };

  // Populate the alternative reduce EMI impact
  const alternativeReduceEmiImpact = {
    newEmi: actualPrepaymentImpactDetails.scenarioReduceEmi.newEmi,
    interestSaved: actualPrepaymentImpactDetails.scenarioReduceEmi.interestSaved,
    percentageSavings: actualPrepaymentImpactDetails.scenarioReduceEmi.percentageSavings,
  };

  // 4. Get loan progress
  const loanProgress = getLoanProgress(updatedSchedule, currentDate);

  // 5. Get chart data
  const chartData = getChartData(updatedSchedule);

  // 6. Get break-even point
  const breakEvenMonth = getBreakEvenPoint(updatedSchedule);

  // 7. Get loan health score
  const loanHealth = getLoanHealthScore(
    loanInput.loanAmount,
    loanInput.annualInterestRate,
    loanInput.loanTenureMonths,
    totalInterestAfterPrepayments,
    totalPrincipalPaid,
    prepayments.length,
    finalTenureMonths
  );

  // 8. Simulate hypothetical prepayment impact if provided
  let hypotheticalImpactResult;
  if (hypotheticalPrepayment) {
    hypotheticalImpactResult = simulatePrepaymentImpact(loanInput, prepayments, hypotheticalPrepayment);
  }

  // 9. Generate insights
  const insights = generateInsights(
    loanInput,
    updatedSchedule,
    loanProgress,
    actualPrepaymentImpactDetails,
    breakEvenMonth,
    hypotheticalImpactResult
  );

  return {
    emi: originalEmi,
    totalInterest: parseFloat(totalInterestAfterPrepayments.toFixed(2)),
    totalPayment: parseFloat(totalPayment.toFixed(2)),
    loanProgress,
    prepaymentImpact: finalPrepaymentImpact,
    alternativeReduceEmiImpact: alternativeReduceEmiImpact,
    hypotheticalPrepaymentImpact: hypotheticalImpactResult,
    loanHealth,
    insights,
    breakEvenMonth,
    updatedSchedule,
    chartData,
  };
}

// Example Usage:
/*
const loanDetails = {
  loanAmount: 2000000, // 20 Lakhs
  annualInterestRate: 0.085, // 8.5%
  loanTenureMonths: 240, // 20 years
  loanStartDate: new Date('2023-03-01'),
};

const existingPrepayments = [
  { amount: 50000, date: new Date('2023-12-15') },
  { amount: 25000, date: new Date('2024-06-01') },
];

const hypotheticalPrepayment = { amount: 100000, date: new Date('2024-10-20') };

const simulationResult = simulateLoan(
  loanDetails,
  existingPrepayments,
  new Date('2024-08-01'), // Current date for progress
  hypotheticalPrepayment
);

console.log(JSON.stringify(simulationResult, null, 2));

// You can also test individual functions
// const emi = calculateEMI(100000, 0.08, 120);
// console.log(`EMI: ${emi}`);
*/
