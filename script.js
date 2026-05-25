import { createDebtCalculatorApp } from './ui.js';
import { attachSyncedSlider, formatCurrency } from './shared.js';
import { simulateLoan } from './loanSimulator.js';

const EMI_QUICK_START_KEY = 'finleak-emi-quick-start';

function initApp() {
    attachSyncedSlider(document.getElementById('outstanding'), {
        min: 1000,
        max: 2000000,
        step: 1000,
        defaultValue: 50000,
        formatter: (value) => formatCurrency(value, 0, 0)
    });

    attachSyncedSlider(document.getElementById('rate'), {
        min: 0,
        max: 60,
        step: 0.1,
        defaultValue: 24,
        formatter: (value) => `${value}%`
    });

    attachSyncedSlider(document.getElementById('min-payment'), {
        min: 1,
        max: 20,
        step: 0.1,
        defaultValue: 2,
        formatter: (value) => `${value}%`
    });

    attachSyncedSlider(document.getElementById('extra-payment'), {
        min: 0,
        max: 100000,
        step: 500,
        defaultValue: 0,
        formatter: (value) => formatCurrency(value, 0, 0)
    });

    createDebtCalculatorApp({
        formId: 'calc-form',
        spinnerId: 'loading-spinner',
        resultsSectionId: 'results',
        chartCardId: 'chart-card',
        messageContainerId: 'home-message-container',
        idleButtonText: 'Analyze Debt',
        loadingButtonText: 'Analyzing...',
        inputIds: {
            outstanding: 'outstanding',
            rate: 'rate',
            minPayment: 'min-payment',
            extraPayment: 'extra-payment'
        },
        outputIds: {
            monthlyRate: 'monthly-rate',
            payoffTime: 'payoff-time',
            totalPaid: 'total-paid',
            totalInterest: 'money-lost',
            principal: 'breakdown-principal',
            breakdownInterest: 'breakdown-interest',
            breakdownExtra: 'breakdown-extra',
            breakdownPercentage: 'breakdown-percentage',
            healthScore: 'financial-health-score',
            riskLevel: 'risk-level',
            riskBar: 'risk-bar',
            riskDetails: 'risk-details',
            insightsList: 'insight-list',
            tableBody: 'amortizationBody',
            tableFooter: 'amortizationFooter',
            tableHeader: '#amortization-table thead tr',
            toggleFull: 'toggle-full',
            toggleYearly: 'toggle-yearly',
            scenarios: [
                { extra: 5000, elementId: 'scenario-1' },
                { extra: 10000, elementId: 'scenario-2' },
                { extra: 25000, elementId: 'scenario-3' }
            ],
            scenarioContainerId: 'home-prepayment-scenarios'
        },
        chartIds: {
            pie: 'pie-chart',
            balance: 'balance-trend-chart',
            composition: 'composition-chart'
        },
        assumedMonthlyIncome: 50000
    });

    initEmiHomepagePrompts();
}

function initEmiHomepagePrompts() {
    document.querySelectorAll('.emi-demo-btn').forEach((button) => {
        button.addEventListener('click', () => launchEmiQuickStart(button.dataset));
    });

    renderEmiHomepageExample().catch((error) => {
        console.warn('Unable to render EMI homepage example', error);
    });
}

async function renderEmiHomepageExample() {
    const withoutEl = document.getElementById('emi-example-without');
    const withEl = document.getElementById('emi-example-with');
    const saveEl = document.getElementById('emi-example-save');
    if (!withoutEl || !withEl || !saveEl) {
        return;
    }

    const startDate = new Date();
    const baseResult = await simulateLoan({
        loanAmount: 1000000,
        annualInterestRate: 0.09,
        loanTenureMonths: 20 * 12,
        loanStartDate: startDate,
        monthlyIncome: 120000
    }, [], startDate);
    const withPrepaymentResult = await simulateLoan({
        loanAmount: 1000000,
        annualInterestRate: 0.09,
        loanTenureMonths: 20 * 12,
        loanStartDate: startDate,
        monthlyIncome: 120000
    }, [{ amount: 100000, date: startDate }], startDate);

    const interestSaved = Math.max(0, baseResult.modifiedLoan.totalInterest - withPrepaymentResult.modifiedLoan.totalInterest);
    withoutEl.textContent = formatCurrency(baseResult.modifiedLoan.totalInterest);
    withEl.textContent = formatCurrency(withPrepaymentResult.modifiedLoan.totalInterest);
    saveEl.textContent = `You save ${formatCurrency(interestSaved)} in interest over the remaining loan period`;
}

function launchEmiQuickStart(dataset) {
    const payload = {
        loanAmount: Math.round(Number(dataset.demoLoan) || 0),
        interestRate: Number(dataset.demoRate) || 0,
        tenureYears: Math.max(0, Math.round(Number(dataset.demoYears) || 0)),
        tenureMonths: Math.max(0, Math.round(Number(dataset.demoMonths) || 0)),
        prepaymentAmount: Math.max(0, Math.round(Number(dataset.demoPrepayment) || 0))
    };

    sessionStorage.setItem(EMI_QUICK_START_KEY, JSON.stringify(payload));
    window.location.href = '/emi-calculator/';
}

try {
    initApp();
} catch (error) {
    console.error('App crashed:', error);
}
