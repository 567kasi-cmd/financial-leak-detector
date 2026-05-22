import { createDebtCalculatorApp } from '../ui.js';
import { attachSyncedSlider, formatCurrency } from '../shared.js';

function initApp() {
    attachSyncedSlider(document.getElementById('cc-outstanding'), {
        min: 1000,
        max: 2000000,
        step: 1000,
        defaultValue: 50000,
        formatter: (value) => formatCurrency(value, 0, 0)
    });

    attachSyncedSlider(document.getElementById('cc-rate'), {
        min: 0,
        max: 60,
        step: 0.1,
        defaultValue: 24,
        formatter: (value) => `${value}%`
    });

    attachSyncedSlider(document.getElementById('cc-min-payment'), {
        min: 1,
        max: 20,
        step: 0.1,
        defaultValue: 2,
        formatter: (value) => `${value}%`
    });

    attachSyncedSlider(document.getElementById('cc-extra-payment'), {
        min: 0,
        max: 100000,
        step: 500,
        defaultValue: 0,
        formatter: (value) => formatCurrency(value, 0, 0)
    });

    createDebtCalculatorApp({
        formId: 'cc-form',
        spinnerId: 'cc-loading-spinner',
        resultsSectionId: 'cc-results',
        chartCardId: 'cc-chart-card',
        messageContainerId: 'cc-message-container',
        idleButtonText: 'Simulate Debt Payoff',
        loadingButtonText: 'Simulating...',
        inputIds: {
            outstanding: 'cc-outstanding',
            rate: 'cc-rate',
            minPayment: 'cc-min-payment',
            extraPayment: 'cc-extra-payment'
        },
        outputIds: {
            monthlyRate: 'cc-monthly-rate',
            payoffTime: 'cc-payoff-time',
            totalPaid: 'cc-total-paid',
            totalInterest: 'cc-money-lost',
            principal: 'cc-breakdown-principal',
            breakdownInterest: 'cc-breakdown-interest',
            breakdownExtra: 'cc-breakdown-extra',
            breakdownPercentage: 'cc-breakdown-percentage',
            riskLevel: 'cc-risk-level',
            riskBar: 'cc-risk-bar',
            riskDetails: 'cc-risk-details',
            insightsList: 'cc-insight-list',
            tableBody: 'cc-table-body',
            scenarios: [
                { extra: 5000, elementId: 'cc-scenario-1' },
                { extra: 10000, elementId: 'cc-scenario-2' },
                { extra: 25000, elementId: 'cc-scenario-3' }
            ],
            scenarioContainerId: 'cc-prepayment-scenarios'
        },
        chartIds: {
            balance: 'cc-balance-chart'
        },
        assumedMonthlyIncome: 50000
    });
}

try {
    initApp();
} catch (error) {
    console.error('App crashed:', error);
}
