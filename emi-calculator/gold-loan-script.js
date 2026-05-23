import { calculateLoanRepaymentDetails } from '../calculations.js';
import {
    attachSyncedSlider,
    createMessageController,
    debounce,
    ensureMessageContainer,
    formatCurrency,
    formatPercent,
    setButtonLoading
} from '../shared.js';

const form = document.getElementById('gold-loan-form');
const submitButton = form.querySelector('button[type="submit"]');
const spinner = document.getElementById('gl-loading-spinner');
const chartCanvas = document.getElementById('gl-pie-chart');
const messageContainer = ensureMessageContainer(form.closest('.card') || form, 'gold-loan-message-container');
const messages = createMessageController(messageContainer);

let hasRenderedOnce = false;
let goldLoanChart = null;

attachSyncedSlider(document.getElementById('loan-amount'), {
    min: 10000,
    max: 5000000,
    step: 10000,
    defaultValue: 200000,
    formatter: (value) => formatCurrency(value, 0, 0)
});

attachSyncedSlider(document.getElementById('interest-rate'), {
    min: 0,
    max: 35,
    step: 0.1,
    defaultValue: 11.5,
    formatter: (value) => `${value}%`
});

attachSyncedSlider(document.getElementById('loan-tenure'), {
    min: 1,
    max: 84,
    step: 1,
    defaultValue: 12,
    formatter: (value) => `${value}m`
});

function validateInputs(amount, rate, months, income) {
    const errors = [];

    if (!Number.isFinite(amount) || amount <= 0) {
        errors.push('Loan amount must be greater than 0.');
    }
    if (!Number.isFinite(rate) || rate < 0 || rate > 50) {
        errors.push('Interest rate must be between 0 and 50.');
    }
    if (!Number.isFinite(months) || months <= 0 || months > 84) {
        errors.push('Tenure must be between 1 and 84 months.');
    }
    if (income !== null && (!Number.isFinite(income) || income < 0)) {
        errors.push('Monthly income cannot be negative.');
    }

    return errors;
}

function buildInsights(results, loanAmount, interestRate, totalMonths, monthlyIncome) {
    const insights = [];
    const emiRatio = monthlyIncome ? (results.emi / monthlyIncome) * 100 : null;

    if (interestRate > 18) {
        insights.push({
            type: 'warning',
            icon: 'i',
            title: 'Rate is on the expensive side',
            message: `${formatPercent(interestRate, 1)} is high for a secured gold loan.`,
            action: 'Compare with bank offers or negotiate a lower rate if possible.'
        });
    }

    if (results.totalInterest > loanAmount * 0.2) {
        insights.push({
            type: 'warning',
            icon: 'i',
            title: 'Interest takes a meaningful bite',
            message: `Total interest is ${formatCurrency(results.totalInterest)}, which is ${formatPercent((results.totalInterest / loanAmount) * 100, 1)} of the loan amount.`,
            action: 'A shorter tenure or occasional prepayment can reduce this cost quickly.'
        });
    }

    if (emiRatio !== null) {
        if (emiRatio > 50) {
            insights.push({
                type: 'danger',
                icon: '!',
                title: 'EMI looks aggressive',
                message: `The EMI consumes about ${formatPercent(emiRatio, 0)} of monthly income.`,
                action: 'Reduce the loan amount or extend the tenure if cash flow is tight.'
            });
        } else if (emiRatio > 30) {
            insights.push({
                type: 'warning',
                icon: 'i',
                title: 'EMI needs monitoring',
                message: `The EMI is about ${formatPercent(emiRatio, 0)} of monthly income.`,
                action: 'Keep an emergency buffer for months with lower income.'
            });
        } else {
            insights.push({
                type: 'success',
                icon: '+',
                title: 'EMI is relatively manageable',
                message: `The EMI is about ${formatPercent(emiRatio, 0)} of monthly income.`,
                action: 'This leaves better breathing room for other expenses.'
            });
        }
    }

    if (totalMonths <= 6) {
        insights.push({
            type: 'info',
            icon: 'i',
            title: 'Short tenure chosen',
            message: 'A short gold-loan tenure keeps interest lower but pushes the EMI up.',
            action: 'Double-check cash flow before finalizing the shortest tenure.'
        });
    }

    if (insights.length === 0) {
        insights.push({
            type: 'success',
            icon: '+',
            title: 'Balanced gold loan structure',
            message: 'The current loan settings do not show any major warning signs.',
            action: 'Verify lender charges such as valuation, storage, and foreclosure fees before borrowing.'
        });
    }

    return insights;
}

function renderResults(results, loanAmount, interestRate, totalMonths, monthlyIncome) {
    document.getElementById('gl-emi-amount').textContent = formatCurrency(results.emi, 2, 2);
    document.getElementById('gl-total-amount').textContent = formatCurrency(results.totalPayment, 2, 2);
    document.getElementById('gl-total-interest').textContent = formatCurrency(results.totalInterest, 2, 2);
    document.getElementById('gl-tenure-display').textContent = `${totalMonths} month${totalMonths === 1 ? '' : 's'}`;

    document.getElementById('gl-principal').textContent = formatCurrency(loanAmount, 2, 2);
    document.getElementById('gl-interest').textContent = formatCurrency(results.totalInterest, 2, 2);
    document.getElementById('gl-interest-pct').textContent = formatPercent((results.totalInterest / loanAmount) * 100, 1);
    document.getElementById('gl-processing-fee').textContent = formatCurrency(Math.round(loanAmount * 0.01), 0, 0);

    document.getElementById('gl-current-emi').textContent = formatCurrency(results.emi, 2, 2);
    document.getElementById('gl-lower-rate-emi').textContent = formatCurrency(
        calculateLoanRepaymentDetails(loanAmount, Math.max(0, interestRate - 1), totalMonths).emi,
        2,
        2
    );
    document.getElementById('gl-higher-rate-emi').textContent = formatCurrency(
        calculateLoanRepaymentDetails(loanAmount, interestRate + 1, totalMonths).emi,
        2,
        2
    );
    document.getElementById('gl-shorter-tenure-emi').textContent = formatCurrency(
        calculateLoanRepaymentDetails(loanAmount, interestRate, Math.max(1, totalMonths - 3)).emi,
        2,
        2
    );

    const tbody = document.getElementById('gl-table-body');
    tbody.innerHTML = '';
    const fragment = document.createDocumentFragment();
    results.monthlyData.forEach((entry) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.month}</td>
            <td class="currency">${formatCurrency(entry.payment, 2, 2)}</td>
            <td class="currency principal">${formatCurrency(entry.principal, 2, 2)}</td>
            <td class="currency interest">${formatCurrency(entry.interest, 2, 2)}</td>
            <td class="currency balance">${formatCurrency(entry.balance, 2, 2)}</td>
        `;
        fragment.appendChild(row);
    });
    tbody.appendChild(fragment);

    if (chartCanvas && typeof Chart !== 'undefined') {
        if (goldLoanChart) {
            goldLoanChart.destroy();
        }

        goldLoanChart = new Chart(chartCanvas, {
            type: 'doughnut',
            data: {
                labels: ['Principal', 'Interest'],
                datasets: [{
                    data: [loanAmount, results.totalInterest],
                    backgroundColor: ['#d08c00', '#c44536'],
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

    const insights = buildInsights(results, loanAmount, interestRate, totalMonths, monthlyIncome);
    const insightList = document.getElementById('gl-insight-list');
    insightList.innerHTML = '';
    insights.forEach((insight) => {
        const item = document.createElement('li');
        item.className = `insight-item ${insight.type}`;
        item.innerHTML = `
            <div class="insight-header">
                <span class="insight-icon">${insight.icon}</span>
                <span class="insight-title">${insight.title}</span>
            </div>
            <p class="insight-message">${insight.message}</p>
            <p class="insight-action"><strong>Action:</strong> ${insight.action}</p>
        `;
        insightList.appendChild(item);
    });

    document.getElementById('gl-results').classList.remove('hidden');
    document.getElementById('gl-chart-card').classList.remove('hidden');
}

function calculate({ scroll = false, forceErrors = false } = {}) {
    messages.clear();

    const loanAmount = parseFloat(document.getElementById('loan-amount').value);
    const interestRate = parseFloat(document.getElementById('interest-rate').value);
    const totalMonths = parseInt(document.getElementById('loan-tenure').value, 10);
    const monthlyIncomeValue = document.getElementById('monthly-income').value;
    const monthlyIncome = monthlyIncomeValue ? parseFloat(monthlyIncomeValue) : null;
    const errors = validateInputs(loanAmount, interestRate, totalMonths, monthlyIncome);

    if (errors.length > 0) {
        if (hasRenderedOnce || forceErrors) {
            messages.show('warning', errors[0]);
        }
        return;
    }

    setButtonLoading(submitButton, spinner, true, 'Calculate Gold Loan EMI', 'Calculating...');

    try {
        const results = calculateLoanRepaymentDetails(loanAmount, interestRate, totalMonths);
        renderResults(results, loanAmount, interestRate, totalMonths, monthlyIncome);
        hasRenderedOnce = true;

        if (scroll) {
            document.getElementById('gl-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } catch (error) {
        messages.show('error', `Calculation error: ${error.message}`);
    } finally {
        setButtonLoading(submitButton, spinner, false, 'Calculate Gold Loan EMI', 'Calculating...');
    }
}

form.addEventListener('submit', (event) => {
    event.preventDefault();
    calculate({ scroll: true, forceErrors: true });
});

form.addEventListener('input', debounce(() => {
    if (hasRenderedOnce) {
        calculate();
    }
}, 250));
