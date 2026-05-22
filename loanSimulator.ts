
// Interfaces for better type management
interface LoanInput {
  loanAmount: number;
  annualInterestRate: number; // e.g., 0.08 for 8%
  loanTenureMonths: number;
  loanStartDate: Date;
  emi?: number; // Optional, will be calculated if not provided
}

interface Prepayment {
  amount: number;
  date: Date;
}

interface ScheduleEntry {
  month: number; // 1-based month number in the loan tenure
  date: Date;
  openingBalance: number;
  emi: number;
  principalComponent: number;
  interestComponent: number;
  closingBalance: number;
  cumulativePrincipalPaid: number;
  cumulativeInterestPaid: number;
}

interface LoanProgress {
  paidEmis: number;
  principalPaid: number;
  interestPaid: number;
  remainingBalance: number;
  monthsRemaining: number;
}

// Details for the impact of actual prepayments, split by scenario
interface ActualPrepaymentImpactDetails {
  scenarioReduceEmi: {
    newEmi: number;
    interestSaved: number;
    percentageSavings: number;
  };
  scenarioReduceTenure: {
    newTenureMonths: number;
    monthsReduced: number;
    interestSaved: number;
    percentageSavings: number;
  };
}

// Simplified prepayment impact for the final output structure (focus on reduce tenure)
interface FinalPrepaymentImpact {
  interestSaved: number;
  newEmi?: number; // Only if choosing to reduce EMI
  newTenure?: number; // Only if choosing to reduce tenure
  monthsReduced: number;
  percentageSavings: number;
}

interface WhatIfImpact {
  amount: number; // The amount of the hypothetical prepayment
  date: Date; // The date of the hypothetical prepayment
  interestSaved: number;
  monthsReduced: number;
  percentageSavings: number;
}

interface LoanHealth {
  score: number;
  rating: "Excellent" | "Good" | "Average" | "Poor";
  message: string;
}

interface ChartData {
  principalVsInterest: { month: number; principal: number; interest: number }[];
  balanceOverTime: { month: number; balance: number }[];
}

interface LoanSimulationResult {
  emi: number; // Original EMI
  totalInterest: number; // Total interest paid over the life of the loan (after prepayments)
  totalPayment: number; // Total principal + interest paid over the life of the loan (after prepayments)

  loanProgress: LoanProgress;

  prepaymentImpact: FinalPrepaymentImpact; // Impact of actual prepayments (defaulting to reduce tenure)
  alternativeReduceEmiImpact?: { // Alternative scenario for actual prepayments
    newEmi: number;
    interestSaved: number;
    percentageSavings: number;
  };
  hypotheticalPrepaymentImpact?: WhatIfImpact; // Impact of a "what if" prepayment

  loanHealth: LoanHealth;
  insights: string[];
  breakEvenMonth?: number;
  updatedSchedule: ScheduleEntry[];
  chartData: ChartData;
}

/**
 * Calculates the Equated Monthly Installment (EMI) for a loan.
 * @param principal The principal loan amount.
 * @param annualInterestRate The annual interest rate (e.g., 0.08 for 8%).
 * @param tenureMonths The loan tenure in months.
 * @returns The calculated EMI.
 */
export function calculateEMI(principal: number, annualInterestRate: number, tenureMonths: number): number {
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
 * @param startBalance The balance at the start of this partial schedule.
 * @param annualInterestRate The annual interest rate.
 * @param startMonth The 1-based month number from the original loan start.
 * @param initialLoanStartDate The original loan start date.
 * @param emi The EMI to use for this partial schedule.
 * @param maxMonths The maximum number of months to generate (e.g., original tenure remaining).
 * @param cumulativePrincipalPaidBefore Cumulative principal paid before this partial schedule starts.
 * @param cumulativeInterestPaidBefore Cumulative interest paid before this partial schedule starts.
 * @returns An array of ScheduleEntry objects.
 */
function _generatePartialSchedule(
  startBalance: number,
  annualInterestRate: number,
  startMonth: number,
  initialLoanStartDate: Date,
  emi: number,
  maxMonths: number,
  cumulativePrincipalPaidBefore: number,
  cumulativeInterestPaidBefore: number
): ScheduleEntry[] {
  const schedule: ScheduleEntry[] = [];
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
 * @param loanAmount The total loan amount.
 * @param annualInterestRate The annual interest rate (e.g., 0.08 for 8%).
 * @param loanTenureMonths The loan tenure in months.
 * @param loanStartDate The start date of the loan.
 * @param emi The EMI amount. If not provided, it will be calculated.
 * @returns An array of ScheduleEntry objects representing the amortization schedule.
 */
export function generateSchedule(
  loanAmount: number,
  annualInterestRate: number,
  loanTenureMonths: number,
  loanStartDate: Date,
  emi?: number,
): ScheduleEntry[] {
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
 * @param schedule The full amortization schedule.
 * @param currentDate The current date to evaluate progress against.
 * @returns A LoanProgress object.
 */
export function getLoanProgress(schedule: ScheduleEntry[], currentDate: Date): LoanProgress {
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

interface AppliedPrepaymentResult {
  updatedSchedule: ScheduleEntry[];
  totalInterestPaid: number;
  finalBalance: number;
  finalTenureMonths: number;
}

/**
 * Applies prepayments to the loan schedule, recalculating future EMIs based on the original EMI
 * (effectively reducing tenure).
 * @param loanAmount The initial loan amount.
 * @param annualInterestRate The annual interest rate.
 * @param loanTenureMonths The original loan tenure in months.
 * @param loanStartDate The original loan start date.
 * @param originalEmi The EMI calculated for the original loan.
 * @param prepayments An array of prepayment objects.
 * @returns An AppliedPrepaymentResult object containing the updated schedule and financial summaries.
 */
export function applyPrepayments(
  loanAmount: number,
  annualInterestRate: number,
  loanTenureMonths: number,
  loanStartDate: Date,
  originalEmi: number,
  prepayments: Prepayment[]
): AppliedPrepaymentResult {
  const sortedPrepayments = [...prepayments].sort((a, b) => a.date.getTime() - b.date.getTime());

  const schedule: ScheduleEntry[] = [];
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
 * @param originalLoanAmount The initial loan amount.
 * @param originalTenureMonths The initial loan tenure in months.
 * @param originalEmi The initial calculated EMI.
 * @param annualInterestRate The annual interest rate.
 * @param currentRemainingBalance The loan balance after prepayments.
 * @param currentRemainingTenureMonths The remaining tenure in months if EMI was kept same after prepayments (from applyPrepayments result).
 * @param totalInterestPaidOriginal The total interest paid over the original loan tenure.
 * @param totalInterestPaidAfterPrepayments The total interest paid in the schedule after prepayments (with reduced tenure).
 * @returns ActualPrepaymentImpactDetails object.
 */
export function recalculateLoanAfterPrepayment(
  originalLoanAmount: number,
  originalTenureMonths: number,
  originalEmi: number,
  annualInterestRate: number,
  currentRemainingBalance: number,
  currentRemainingTenureMonths: number, // This is the tenure *after* prepayments if EMI was kept same
  totalInterestPaidOriginal: number,
  totalInterestPaidAfterPrepayments: number
): ActualPrepaymentImpactDetails {
  const impact: ActualPrepaymentImpactDetails = {
    scenarioReduceEmi: { newEmi: 0, interestSaved: 0, percentageSavings: 0 },
    scenarioReduceTenure: { newTenureMonths: 0, monthsReduced: 0, interestSaved: 0, percentageSavings: 0 },
  };

  // If no actual interest was saved, then there's no impact from prepayments.
  // This also handles the case where totalInterestPaidAfterPrepayments might be incorrectly 0
  // while totalInterestPaidOriginal is not (indicating no real prepayment effect).
  if (Math.abs(totalInterestPaidOriginal - totalInterestPaidAfterPrepayments) < 0.01 ||
      (totalInterestPaidOriginal > 0.01 && totalInterestPaidAfterPrepayments < 0.01)) {
      impact.scenarioReduceTenure.newTenureMonths = originalTenureMonths;
      impact.scenarioReduceTenure.monthsReduced = 0;
      impact.scenarioReduceTenure.interestSaved = 0;
      impact.scenarioReduceTenure.percentageSavings = 0;

      impact.scenarioReduceEmi.newEmi = originalEmi;
      impact.scenarioReduceEmi.interestSaved = 0;
      impact.scenarioReduceEmi.percentageSavings = 0;
      return impact;
  }

  // Scenario B: Reduce tenure (EMI same as original)
  impact.scenarioReduceTenure.newTenureMonths = currentRemainingTenureMonths;
  impact.scenarioReduceTenure.monthsReduced = originalTenureMonths - currentRemainingTenureMonths;
  impact.scenarioReduceTenure.interestSaved = parseFloat((totalInterestPaidOriginal - totalInterestPaidAfterPrepayments).toFixed(2));
  impact.scenarioReduceTenure.percentageSavings = totalInterestPaidOriginal > 0 ?
    parseFloat(((impact.scenarioReduceTenure.interestSaved / totalInterestPaidOriginal) * 100).toFixed(2)) : 0;


  // Scenario A: Reduce EMI (tenure same as original)
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
    // If currentRemainingBalance is 0, it means the loan was paid off.
    // If this path is reached, it means totalInterestPaidOriginal was significantly different from totalInterestPaidAfterPrepayments,
    // so some interest was saved (e.g., totalInterestPaidAfterPrepayments was 0).
    impact.scenarioReduceEmi.newEmi = 0;
    impact.scenarioReduceEmi.interestSaved = parseFloat((totalInterestPaidOriginal - totalInterestPaidAfterPrepayments).toFixed(2));
    impact.scenarioReduceEmi.percentageSavings = totalInterestPaidOriginal > 0 ?
      parseFloat(((impact.scenarioReduceEmi.interestSaved / totalInterestPaidOriginal) * 100).toFixed(2)) : 0;
  }

  return impact;
}

/**
 * Simulates the impact of a hypothetical prepayment on the loan.
 * @param loanInput The initial loan details.
 * @param existingPrepayments An array of prepayments already applied to the loan.
 * @param hypotheticalPrepayment The single hypothetical prepayment to simulate.
 * @returns A WhatIfImpact object.
 */
export function simulatePrepaymentImpact(
  loanInput: LoanInput,
  existingPrepayments: Prepayment[],
  hypotheticalPrepayment: Prepayment
): WhatIfImpact {
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
 * @param schedule The amortization schedule.
 * @returns ChartData object.
 */
export function getChartData(schedule: ScheduleEntry[]): ChartData {
  const principalVsInterest: { month: number; principal: number; interest: number }[] = [];
  const balanceOverTime: { month: number; balance: number }[] = [];

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
 * @param schedule The amortization schedule.
 * @returns The month number, or undefined if not found within the schedule.
 */
export function getBreakEvenPoint(schedule: ScheduleEntry[]): number | undefined {
  for (const entry of schedule) {
    if (entry.cumulativePrincipalPaid > entry.cumulativeInterestPaid) {
      return entry.month;
    }
  }
  return undefined;
}

/**
 * Generates a health score and rating for the loan.
 * @param loanAmount The initial loan amount.
 * @param annualInterestRate The annual interest rate.
 * @param originalTenureMonths The original loan tenure in months.
 * @param totalInterestPaid The total interest paid over the loan's lifetime.
 * @param totalPrincipalPaid The total principal paid over the loan's lifetime.
 * @param prepaymentsCount The number of prepayments made.
 * @param finalTenureMonths The actual final tenure after prepayments.
 * @returns LoanHealth object.
 */
export function getLoanHealthScore(
  loanAmount: number,
  annualInterestRate: number,
  originalTenureMonths: number,
  totalInterestPaid: number,
  totalPrincipalPaid: number,
  prepaymentsCount: number,
  finalTenureMonths: number
): LoanHealth {
  let score = 0;
  const messages: string[] = [];

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

  let rating: "Excellent" | "Good" | "Average" | "Poor";
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
 * @param loanInput The initial loan details.
 * @param schedule The final amortization schedule.
 * @param loanProgress The current loan progress.
 * @param actualPrepaymentImpact The impact of actual prepayments.
 * @param breakEvenMonth The break-even month.
 * @param hypotheticalPrepaymentImpact Optional hypothetical prepayment impact.
 * @returns An array of insight strings.
 */
export function generateInsights(
  loanInput: LoanInput,
  schedule: ScheduleEntry[],
  loanProgress: LoanProgress,
  actualPrepaymentImpact: ActualPrepaymentImpactDetails,
  breakEvenMonth?: number,
  hypotheticalPrepaymentImpact?: WhatIfImpact
): string[] {
  const insights: string[] = [];

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
 * @param loanInput The initial loan details.
 * @param prepayments An array of prepayments made.
 * @param currentDate The current date for loan progress calculation.
 * @param hypotheticalPrepayment Optional: a single hypothetical prepayment to simulate "What If".
 * @returns A LoanSimulationResult object.
 */
export function simulateLoan(
  loanInput: LoanInput,
  prepayments: Prepayment[] = [],
  currentDate: Date = new Date(),
  hypotheticalPrepayment?: Prepayment
): LoanSimulationResult {
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
  const finalPrepaymentImpact: FinalPrepaymentImpact = {
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
  let hypotheticalImpactResult: WhatIfImpact | undefined;
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
const loanDetails: LoanInput = {
  loanAmount: 2000000, // 20 Lakhs
  annualInterestRate: 0.085, // 8.5%
  loanTenureMonths: 240, // 20 years
  loanStartDate: new Date('2023-03-01'),
};

const existingPrepayments: Prepayment[] = [
  { amount: 50000, date: new Date('2023-12-15') },
  { amount: 25000, date: new Date('2024-06-01') },
];

const hypotheticalPrepayment: Prepayment = { amount: 100000, date: new Date('2024-10-20') };

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
