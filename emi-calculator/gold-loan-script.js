// gold-loan-script.js - Gold Loan EMI Calculator Page Logic

const goldLoanForm = document.getElementById('gold-loan-form');
goldLoanForm.addEventListener('submit', handleGoldLoanFormSubmit);

/**
 * Handle Gold Loan form submission
 * @param {Event} e - Form submit event
 */
function handleGoldLoanFormSubmit(e) {
    e.preventDefault();

    const loanAmount = parseFloat(document.getElementById('loan-amount').value);
    const interestRate = parseFloat(document.getElementById('interest-rate').value);
    const totalMonths = parseInt(document.getElementById('loan-tenure').value);
    const monthlyIncome = parseFloat(document.getElementById('monthly-income').value) || null;

    if (!validateGoldLoanInputs(loanAmount, interestRate, totalMonths)) {
        showGLError('Please enter valid values (loan amount > 0, rate >= 0, tenure 1–84 months)');
        return;
    }

    showGLLoading();

    setTimeout(() => {
        try {
            const results = calculateEMI(loanAmount, interestRate, totalMonths);
            displayGoldLoanResults(results, loanAmount, interestRate, totalMonths, monthlyIncome);
            document.getElementById('gl-results').scrollIntoView({ behavior: 'smooth' });
            hideGLLoading();
        } catch (error) {
            showGLError('Calculation error: ' + error.message);
            hideGLLoading();
        }
    }, 300);
}

/**
 * Display gold loan results
 */
function displayGoldLoanResults(results, loanAmount, interestRate, totalMonths, monthlyIncome) {
    // Metric cards
    document.getElementById('gl-emi-amount').textContent = `₹${results.emi.toLocaleString('en-IN')}`;
    document.getElementById('gl-total-amount').textContent = `₹${results.totalPayment.toLocaleString('en-IN')}`;
    document.getElementById('gl-total-interest').textContent = `₹${results.totalInterest.toLocaleString('en-IN')}`;
    document.getElementById('gl-tenure-display').textContent = `${totalMonths} month${totalMonths !== 1 ? 's' : ''}`;

    // Breakdown
    document.getElementById('gl-principal').textContent = `₹${loanAmount.toLocaleString('en-IN')}`;
    document.getElementById('gl-interest').textContent = `₹${results.totalInterest.toLocaleString('en-IN')}`;
    const interestPct = ((results.totalInterest / loanAmount) * 100).toFixed(1);
    document.getElementById('gl-interest-pct').textContent = `${interestPct}%`;
    const processingFee = Math.round(loanAmount * 0.01);
    document.getElementById('gl-processing-fee').textContent = `₹${processingFee.toLocaleString('en-IN')}`;

    // Comparisons
    updateGLComparisons(results.emi, loanAmount, interestRate, totalMonths);

    // Chart
    updateGLChart(loanAmount, results.totalInterest);

    // Amortization table
    populateGLTable(results.monthlyData);

    // Insights
    const insights = generateGLInsights(results, loanAmount, interestRate, totalMonths, monthlyIncome);
    displayGLInsights(insights);

    // Show results
    document.getElementById('gl-results').classList.remove('hidden');
    document.getElementById('gl-chart-card').classList.remove('hidden');
}

/**
 * Update EMI comparison scenarios
 */
function updateGLComparisons(currentEmi, loanAmount, interestRate, totalMonths) {
    document.getElementById('gl-current-emi').textContent = `₹${currentEmi.toLocaleString('en-IN')}`;

    const lowerRate = calculateEMI(loanAmount, Math.max(interestRate - 1, 0.01), totalMonths);
    document.getElementById('gl-lower-rate-emi').textContent = `₹${lowerRate.emi.toLocaleString('en-IN')}`;

    const higherRate = calculateEMI(loanAmount, interestRate + 1, totalMonths);
    document.getElementById('gl-higher-rate-emi').textContent = `₹${higherRate.emi.toLocaleString('en-IN')}`;

    const shorterMonths = Math.max(totalMonths - 3, 1);
    const shorter = calculateEMI(loanAmount, interestRate, shorterMonths);
    document.getElementById('gl-shorter-tenure-emi').textContent = `₹${shorter.emi.toLocaleString('en-IN')}`;
}

/**
 * Update pie/doughnut chart
 */
function updateGLChart(principal, totalInterest) {
    const ctx = document.getElementById('gl-pie-chart');
    if (!ctx) return;

    if (window.glPieChart) {
        window.glPieChart.destroy();
    }

    window.glPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Principal', 'Interest'],
            datasets: [{
                data: [principal, totalInterest],
                backgroundColor: ['#f39c12', '#e74c3c'],
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

/**
 * Populate amortization table
 */
function populateGLTable(monthlyData) {
    const tbody = document.getElementById('gl-table-body');
    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();

    monthlyData.forEach(data => {
        const row = document.createElement('tr');

        const cells = [
            { text: data.month, cls: '' },
            { text: `₹${Number(data.payment).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, cls: 'currency' },
            { text: `₹${Number(data.principal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, cls: 'currency principal' },
            { text: `₹${Number(data.interest).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, cls: 'currency interest' },
            { text: `₹${Number(data.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, cls: 'currency balance' }
        ];

        cells.forEach(c => {
            const td = document.createElement('td');
            td.className = c.cls;
            td.textContent = c.text;
            row.appendChild(td);
        });

        fragment.appendChild(row);
    });

    tbody.appendChild(fragment);
}

/**
 * Generate gold-loan-specific insights
 */
function generateGLInsights(results, loanAmount, interestRate, totalMonths, monthlyIncome) {
    const insights = [];

    // High interest rate warning
    if (interestRate > 20) {
        insights.push({
            type: 'danger',
            icon: '🚨',
            title: 'Very High Interest Rate',
            message: `${interestRate}% is exceptionally high for a gold loan.`,
            action: 'Consider switching to a bank gold loan (7–15%) to save significantly on interest.'
        });
    } else if (interestRate > 12) {
        insights.push({
            type: 'warning',
            icon: '⚠️',
            title: 'Above-Average Interest Rate',
            message: `${interestRate}% is higher than typical bank gold loan rates.`,
            action: 'Compare with other lenders — banks often offer gold loans at 7–12%.'
        });
    } else {
        insights.push({
            type: 'success',
            icon: '✅',
            title: 'Competitive Interest Rate',
            message: `${interestRate}% is a good rate for a gold loan.`,
            action: 'Ensure timely repayments to retain your pledged gold.'
        });
    }

    // High interest burden
    if (results.totalInterest > loanAmount * 0.25) {
        insights.push({
            type: 'warning',
            icon: '💸',
            title: 'Significant Interest Cost',
            message: `You'll pay ₹${results.totalInterest.toLocaleString('en-IN')} in interest — ${((results.totalInterest / loanAmount) * 100).toFixed(1)}% of your loan amount.`,
            action: 'Consider prepaying or shortening the tenure to reduce total interest paid.'
        });
    }

    // Short tenure advisory
    if (totalMonths <= 6) {
        insights.push({
            type: 'info',
            icon: '📅',
            title: 'Short Tenure',
            message: `A ${totalMonths}-month tenure means high monthly EMI but lower total interest.`,
            action: 'Ensure your cash flow can comfortably handle the monthly payments.'
        });
    }

    // EMI affordability
    if (monthlyIncome && monthlyIncome > 0) {
        const emiRatio = (results.emi / monthlyIncome) * 100;
        if (emiRatio > 50) {
            insights.push({
                type: 'danger',
                icon: '🚨',
                title: 'High Financial Risk',
                message: `EMI is ${emiRatio.toFixed(0)}% of your monthly income.`,
                action: 'Consider a lower loan amount or longer tenure to reduce EMI burden.'
            });
        } else if (emiRatio > 30) {
            insights.push({
                type: 'warning',
                icon: '⚠️',
                title: 'Moderate EMI Burden',
                message: `EMI takes ${emiRatio.toFixed(0)}% of your monthly income.`,
                action: 'Ensure sufficient buffer for other expenses and emergencies.'
            });
        } else {
            insights.push({
                type: 'success',
                icon: '✅',
                title: 'Healthy EMI Level',
                message: `EMI is only ${emiRatio.toFixed(0)}% of your monthly income.`,
                action: 'Great! You have good financial breathing room for other expenses.'
            });
        }
    } else {
        insights.push({
            type: 'info',
            icon: '💡',
            title: 'EMI Affordability Check',
            message: 'Ideally, your gold loan EMI should be less than 30–40% of monthly income.',
            action: 'Enter your monthly income above to get personalized affordability insights.'
        });
    }

    return insights;
}

/**
 * Display insights list
 */
function displayGLInsights(insights) {
    const list = document.getElementById('gl-insight-list');
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
 * Validate gold loan form inputs
 */
function validateGoldLoanInputs(amount, rate, months) {
    if (isNaN(amount) || amount <= 0) return false;
    if (isNaN(rate) || rate < 0 || rate > 50) return false;
    if (isNaN(months) || months <= 0 || months > 84) return false;
    return true;
}

function showGLLoading() {
    const spinner = document.getElementById('gl-loading-spinner');
    if (spinner) spinner.classList.remove('hidden');
}

function hideGLLoading() {
    const spinner = document.getElementById('gl-loading-spinner');
    if (spinner) spinner.classList.add('hidden');
}

function showGLError(message) {
    alert(message);
}

