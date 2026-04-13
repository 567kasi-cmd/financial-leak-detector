// emi-script.js - EMI Calculator Page Logic

// Form elements
const emiForm = document.getElementById('emi-form');

// Event listener
emiForm.addEventListener('submit', handleEmiFormSubmit);

/**
 * Handle EMI form submission
 * @param {event} e - Form submit event
 */
function handleEmiFormSubmit(e) {
    e.preventDefault();

    // Get input values
    const loanAmount = parseFloat(document.getElementById('loan-amount').value);
    const interestRate = parseFloat(document.getElementById('interest-rate').value);
    const years = parseInt(document.getElementById('loan-tenure-years').value) || 0;
    const months = parseInt(document.getElementById('loan-tenure-months').value) || 0;
    const totalMonths = (years * 12) + months;

    // Validate inputs
    if (!validateEmiInputs(loanAmount, interestRate, totalMonths)) {
        showError('Please enter valid values (loan amount > 0, rate >= 0, tenure > 0)');
        return;
    }

    // Show loading
    showEmiLoading();

    // Simulate calculation (setTimeout for smooth UX)
    setTimeout(() => {
        try {
            // Perform calculations
            const results = calculateEMI(loanAmount, interestRate, totalMonths);

            // Display results
            displayEmiResults(results, loanAmount, interestRate, totalMonths);

            // Scroll to results
            document.getElementById('emi-results').scrollIntoView({ behavior: 'smooth' });

            hideEmiLoading();
        } catch (error) {
            showError('Calculation error: ' + error.message);
            hideEmiLoading();
        }
    }, 300);
}

/**
 * Display EMI calculation results
 * @param {object} results - EMI calculation results
 * @param {number} loanAmount - Principal amount
 * @param {number} interestRate - Annual interest rate
 * @param {number} totalMonths - Total tenure in months
 */
function displayEmiResults(results, loanAmount, interestRate, totalMonths) {
    // Update metric cards
    document.getElementById('emi-amount').textContent = `₹${results.emi.toLocaleString('en-IN')}`;
    document.getElementById('total-amount').textContent = `₹${results.totalPayment.toLocaleString('en-IN')}`;
    document.getElementById('total-interest').textContent = `₹${results.totalInterest.toLocaleString('en-IN')}`;
    document.getElementById('loan-tenure-display').textContent = `${Math.floor(totalMonths / 12)}y ${totalMonths % 12}m`;

    // Update breakdown
    document.getElementById('emi-principal').textContent = `₹${loanAmount.toLocaleString('en-IN')}`;
    document.getElementById('emi-interest').textContent = `₹${results.totalInterest.toLocaleString('en-IN')}`;

    const interestPercent = ((results.totalInterest / loanAmount) * 100).toFixed(0);
    document.getElementById('emi-percentage').textContent = `${interestPercent}%`;

    // Processing fee estimate (1% of loan)
    const processingFee = Math.round(loanAmount * 0.01);
    document.getElementById('processing-fee').textContent = `₹${processingFee.toLocaleString('en-IN')}`;

    // EMI comparisons
    updateEmiComparisons(results.emi, loanAmount, interestRate, totalMonths);

    // Update chart
    updateEmiChart(loanAmount, results.totalInterest);

    // Populate amortization table
    populateEmiTable(results.monthlyData);

    // Display insights
    const insights = generateEmiInsights(results, loanAmount, interestRate, totalMonths);
    displayEmiInsights(insights);

    // Display prepayment scenarios
    displayEmiPrepaymentScenarios(results, loanAmount, interestRate, totalMonths);

    // Show results section
    document.getElementById('emi-results').classList.remove('hidden');
    document.getElementById('emi-chart-card').classList.remove('hidden');
}

/**
 * Update EMI comparison scenarios
 * @param {number} currentEmi - Current EMI amount
 * @param {number} loanAmount - Principal amount
 * @param {number} interestRate - Annual rate
 * @param {number} totalMonths - Total months
 */
function updateEmiComparisons(currentEmi, loanAmount, interestRate, totalMonths) {
    // Current EMI
    document.getElementById('current-emi').textContent = `₹${currentEmi.toLocaleString('en-IN')}`;

    // Lower rate (-1%)
    const lowerRateResult = calculateEMI(loanAmount, interestRate - 1, totalMonths);
    document.getElementById('lower-rate-emi').textContent = `₹${lowerRateResult.emi.toLocaleString('en-IN')}`;

    // Higher rate (+1%)
    const higherRateResult = calculateEMI(loanAmount, interestRate + 1, totalMonths);
    document.getElementById('higher-rate-emi').textContent = `₹${higherRateResult.emi.toLocaleString('en-IN')}`;

    // Shorter tenure (-1 year)
    const shorterMonths = Math.max(totalMonths - 12, 1);
    const shorterResult = calculateEMI(loanAmount, interestRate, shorterMonths);
    document.getElementById('shorter-tenure-emi').textContent = `₹${shorterResult.emi.toLocaleString('en-IN')}`;
}

/**
 * Update EMI pie chart
 * @param {number} principal - Principal amount
 * @param {number} totalInterest - Total interest
 */
function updateEmiChart(principal, totalInterest) {
    const ctx = document.getElementById('emi-pie-chart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (window.emiPieChart) {
        window.emiPieChart.destroy();
    }

    window.emiPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Principal', 'Interest'],
            datasets: [{
                data: [principal, totalInterest],
                backgroundColor: ['#3498db', '#e74c3c'],
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

/**
 * Populate EMI amortization table
 * @param {array} monthlyData - Monthly breakdown data
 */
function populateEmiTable(monthlyData) {
    const tbody = document.getElementById('emi-table-body');
    tbody.innerHTML = '';

    // Show first 12 months, then every 12th month, then last few months
    const displayData = [];
    const totalMonths = monthlyData.length;

    // First 12 months
    for (let i = 0; i < Math.min(12, totalMonths); i++) {
        displayData.push(monthlyData[i]);
    }

    // Every 12th month in between
    for (let i = 23; i < totalMonths - 12; i += 12) {
        displayData.push(monthlyData[i]);
    }

    // Last 12 months
    for (let i = Math.max(totalMonths - 12, 12); i < totalMonths; i++) {
        if (i < totalMonths) {
            displayData.push(monthlyData[i]);
        }
    }

    displayData.forEach(data => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${data.month}</td>
            <td>₹${data.payment.toLocaleString('en-IN')}</td>
            <td>₹${data.principal.toFixed(0).toLocaleString('en-IN')}</td>
            <td>₹${data.interest.toFixed(0).toLocaleString('en-IN')}</td>
            <td>₹${data.balance.toFixed(0).toLocaleString('en-IN')}</td>
        `;
        tbody.appendChild(row);
    });

    // Add note if table is truncated
    if (totalMonths > displayData.length) {
        const noteRow = document.createElement('tr');
        noteRow.innerHTML = `<td colspan="5" style="text-align: center; font-style: italic; color: #666;">... ${totalMonths - displayData.length} months in between ...</td>`;
        tbody.appendChild(noteRow);
    }
}

/**
 * Generate EMI-specific insights
 * @param {object} results - EMI results
 * @param {number} loanAmount - Principal
 * @param {number} interestRate - Annual rate
 * @param {number} totalMonths - Total months
 * @returns {array} Insights array
 */
function generateEmiInsights(results, loanAmount, interestRate, totalMonths) {
    const insights = [];
    const years = totalMonths / 12;

    // High interest burden
    if (results.totalInterest > loanAmount * 0.5) {
        insights.push({
            type: 'danger',
            icon: '🚨',
            title: 'High Interest Burden',
            message: `You'll pay ₹${results.totalInterest.toLocaleString('en-IN')} in interest - ${((results.totalInterest / loanAmount) * 100).toFixed(0)}% of your loan amount!`,
            action: 'Consider negotiating a lower interest rate or prepaying when possible.'
        });
    }

    // Long tenure
    if (years > 20) {
        insights.push({
            type: 'warning',
            icon: '⏳',
            title: 'Very Long Tenure',
            message: `${years.toFixed(0)} years is a very long time to repay this loan.`,
            action: 'Consider increasing EMI to reduce tenure, or explore balance transfer options.'
        });
    }

    // EMI affordability (assuming 50K monthly income)
    const monthlyIncome = 50000;
    const emiRatio = (results.emi / monthlyIncome) * 100;
    if (emiRatio > 50) {
        insights.push({
            type: 'danger',
            icon: '💸',
            title: 'EMI Too High',
            message: `EMI is ${emiRatio.toFixed(0)}% of monthly income - this may strain your finances.`,
            action: 'Consider a longer tenure or lower loan amount to reduce EMI burden.'
        });
    } else if (emiRatio > 30) {
        insights.push({
            type: 'warning',
            icon: '⚠️',
            title: 'High EMI Ratio',
            message: `EMI takes ${emiRatio.toFixed(0)}% of your monthly income.`,
            action: 'Ensure you have buffer for other expenses and emergencies.'
        });
    }

    // Interest rate comparison
    if (interestRate > 12) {
        insights.push({
            type: 'warning',
            icon: '📈',
            title: 'High Interest Rate',
            message: `${interestRate}% is above average for most loan types.`,
            action: 'Shop around for better rates or improve your credit score.'
        });
    }

    // Positive insights
    if (results.totalInterest < loanAmount * 0.3) {
        insights.push({
            type: 'success',
            icon: '✅',
            title: 'Reasonable Loan Terms',
            message: 'Your loan terms are reasonable with manageable interest burden.',
            action: 'Focus on regular payments and consider prepayments when possible.'
        });
    }

    return insights;
}

/**
 * Display EMI insights
 * @param {array} insights - Array of insight objects
 */
function displayEmiInsights(insights) {
    const list = document.getElementById('emi-insight-list');
    list.innerHTML = '';

    insights.forEach(insight => {
        const li = document.createElement('li');
        li.className = `insight-item ${insight.type}`;

        li.innerHTML = `
            <div class="insight-header">
                <span class="insight-icon">${insight.icon}</span>
                <span class="insight-title">${insight.title}</span>
            </div>
            <p class="insight-message">${insight.message}</p>
            <p class="insight-action"><strong>Action:</strong> ${insight.action}</p>
        `;

        list.appendChild(li);
    });
}

/**
 * Display EMI prepayment scenarios
 * @param {object} results - Current results
 * @param {number} loanAmount - Principal
 * @param {number} interestRate - Annual rate
 * @param {number} totalMonths - Total months
 */
function displayEmiPrepaymentScenarios(results, loanAmount, interestRate, totalMonths) {
    const scenarios = [
        { amount: 50000, element: 'prepay-50k' },
        { amount: 100000, element: 'prepay-1lakh' },
        { amount: 200000, element: 'prepay-2lakh' }
    ];

    scenarios.forEach(scenario => {
        // Calculate new loan with prepayment
        const newPrincipal = loanAmount - scenario.amount;
        if (newPrincipal > 0) {
            const newResults = calculateEMI(newPrincipal, interestRate, totalMonths);
            const interestSaved = results.totalInterest - newResults.totalInterest;

            const text = `Save ₹${interestSaved.toLocaleString('en-IN')} in interest, new EMI: ₹${newResults.emi.toLocaleString('en-IN')}`;
            document.getElementById(scenario.element).textContent = text;
        } else {
            document.getElementById(scenario.element).textContent = 'Loan would be fully paid off!';
        }
    });
}

/**
 * Show EMI loading animation
 */
function showEmiLoading() {
    const spinner = document.getElementById('emi-loading-spinner');
    if (spinner) {
        spinner.classList.remove('hidden');
    }
}

/**
 * Hide EMI loading animation
 */
function hideEmiLoading() {
    const spinner = document.getElementById('emi-loading-spinner');
    if (spinner) {
        spinner.classList.add('hidden');
    }
}

/**
 * Validate EMI form inputs
 * @param {number} amount - Loan amount
 * @param {number} rate - Interest rate
 * @param {number} months - Total months
 * @returns {boolean} Valid or not
 */
function validateEmiInputs(amount, rate, months) {
    if (isNaN(amount) || amount <= 0) return false;
    if (isNaN(rate) || rate < 0 || rate > 50) return false;
    if (isNaN(months) || months <= 0 || months > 360) return false;
    return true;
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
    alert(message); // In production, use a toast notification
}
