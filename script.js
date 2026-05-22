import { createDebtCalculatorApp } from './ui.js';
import { attachSyncedSlider, formatCurrency } from './shared.js';

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
