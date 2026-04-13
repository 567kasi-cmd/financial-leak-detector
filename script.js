// script.js - Modular JavaScript for Hidden Charges Calculator

// DOM elements
const form = document.getElementById('calc-form');
const resultsSection = document.getElementById('results');
const monthlyRateEl = document.getElementById('monthly-rate');
const payoffTimeEl = document.getElementById('payoff-time');
const totalInterestEl = document.getElementById('total-interest');
const moneyLostEl = document.getElementById('money-lost');
const insightListEl = document.getElementById('insight-list');

// Event listener for form submission
form.addEventListener('submit', function(e) {
    e.preventDefault();

    // Get input values
    const outstanding = parseFloat(document.getElementById('outstanding').value);
    const annualRate = parseFloat(document.getElementById('rate').value);
    const minPaymentPercent = parseFloat(document.getElementById('min-payment').value);

    // Validate inputs
    if (!validateFinancialInput(outstanding, 0.01) || !validateFinancialInput(annualRate, 0) || !validateFinancialInput(minPaymentPercent, 0.01, 100)) {
        alert('Please enter valid values.');
        return;
    }

    // Calculate results
    const results = calculateCreditCardLeak(outstanding, annualRate, minPaymentPercent);

    // Generate insights
    const inputs = { outstanding, annualRate, minPaymentPercent };
    const insights = generateInsights(results, inputs);

    // Display results
    displayResults(results);
    displayInsights(insights);

    // Show results section
    resultsSection.classList.remove('hidden');
});

// Calculation function
function calculateCreditCardLeak(outstanding, annualRate, minPaymentPercent) {
    // Monthly interest rate = annual rate / 12 / 100
    const monthlyRate = calculateMonthlyRate(annualRate);

    let balance = outstanding;
    let totalInterest = 0;
    let months = 0;

    // Minimum payment amount
    let minPayment = balance * (minPaymentPercent / 100);

    // Simulate payments until balance is zero or max iterations
    const maxMonths = 1200; // 100 years max to prevent infinite loop
    while (balance > 0.01 && months < maxMonths) {
        // Calculate interest for this month
        const interest = balance * monthlyRate;
        totalInterest += interest;

        // Minimum payment (recalculate each month as balance changes)
        minPayment = balance * (minPaymentPercent / 100);

        // Actual payment: minimum of what's owed plus interest, or minimum payment
        const payment = Math.min(balance + interest, minPayment);

        // Update balance: add interest, subtract payment
        balance = balance + interest - payment;

        months++;

        // Safety check: if balance grows too much, break
        if (balance > outstanding * 2) {
            break;
        }
    }

    // Format payoff time
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    let payoffTime;
    if (years > 0) {
        payoffTime = `${years} year${years > 1 ? 's' : ''} ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
    } else {
        payoffTime = `${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
    }

    return {
        monthlyRate: (monthlyRate * 100).toFixed(4),
        payoffTime: payoffTime,
        totalInterest: parseFloat(totalInterest.toFixed(2)),
        moneyLost: parseFloat(totalInterest.toFixed(2)),
        months: months
    };
}

// Generate insights based on results
function generateInsights(results, inputs) {
    const insights = [];
    const { totalInterest, months } = results;
    const { outstanding, annualRate, minPaymentPercent } = inputs;

    // Check if total interest is more than 50% of principal
    if (totalInterest > outstanding * 0.5) {
        insights.push({
            type: 'warning',
            icon: '⚠️',
            message: 'You are paying extremely high interest - over 50% of your principal!'
        });
    }

    // Check if payoff time is more than 2 years
    if (months > 24) {
        insights.push({
            type: 'danger',
            icon: '⏳',
            message: 'This debt will take a long time to clear - over 2 years!'
        });
    }

    // Check for debt trap: minimum payment less than first month's interest
    const firstMonthInterest = outstanding * (annualRate / 100 / 12);
    const minPaymentAmount = outstanding * (minPaymentPercent / 100);
    if (minPaymentAmount < firstMonthInterest) {
        insights.push({
            type: 'danger',
            icon: '🚨',
            message: 'You are stuck in a debt trap - minimum payment is less than monthly interest!'
        });
    }

    // If no warnings, give positive feedback
    if (insights.length === 0) {
        insights.push({
            type: 'safe',
            icon: '✅',
            message: 'Your debt situation looks manageable. Keep up the good work!'
        });
    }

    return insights;
}

// Display results in the UI
function displayResults(results) {
    monthlyRateEl.textContent = `${results.monthlyRate}%`;
    payoffTimeEl.textContent = results.payoffTime;
    totalInterestEl.textContent = formatCurrency(results.totalInterest);
    moneyLostEl.textContent = formatCurrency(results.moneyLost);
}

// Display insights in the UI
function displayInsights(insights) {
    insightListEl.innerHTML = '';
    insights.forEach(insight => {
        const li = document.createElement('li');
        li.className = insight.type;
        li.setAttribute('data-icon', insight.icon);
        li.textContent = insight.message;
        insightListEl.appendChild(li);
    });
}
