import { assessDebtRisk, simulateDebtPayoff } from './calculations.js';
import { generateDebtInsights } from './insights.js';
import {
    createMessageController,
    debounce,
    ensureMessageContainer,
    formatCurrency,
    formatDurationMonths,
    setButtonLoading
} from './shared.js';

function createChart(target, config, existingChart) {
    if (!target || typeof Chart === 'undefined') {
        return existingChart || null;
    }

    if (existingChart) {
        existingChart.destroy();
    }

    return new Chart(target, config);
}

function validateDebtInputs(outstanding, rate, minPayment, extraPayment) {
    const errors = [];

    if (!Number.isFinite(outstanding) || outstanding <= 0) {
        errors.push('Outstanding amount must be greater than 0.');
    }
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        errors.push('Interest rate must be between 0 and 100.');
    }
    if (!Number.isFinite(minPayment) || minPayment <= 0 || minPayment > 100) {
        errors.push('Minimum payment must be between 0 and 100.');
    }
    if (!Number.isFinite(extraPayment) || extraPayment < 0) {
        errors.push('Extra payment cannot be negative.');
    }

    return errors;
}

function buildScenarioText(baseResults, principal, annualRate, minPaymentPercent, extraPayment) {
    const simulated = simulateDebtPayoff(principal, annualRate, minPaymentPercent, extraPayment);
    const monthsSaved = Math.max(0, baseResults.months - simulated.months);
    const interestSaved = Math.max(0, baseResults.totalInterest - simulated.totalInterest);

    return `Clear in ${formatDurationMonths(simulated.months)} | Save ${formatCurrency(interestSaved)} | Finish ${monthsSaved} month(s) sooner`;
}

function renderInsights(listElement, insights) {
    listElement.innerHTML = '';

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
        listElement.appendChild(item);
    });
}

function renderDebtTable(tbody, tfoot, headerRow, results, mode = 'full') {
    if (!tbody) {
        return;
    }

    tbody.innerHTML = '';
    if (tfoot) {
        tfoot.innerHTML = '';
    }

    const headerLabels = mode === 'yearly'
        ? ['Year', 'Total Payment', 'Principal', 'Interest', 'Ending Balance']
        : ['Month', 'Payment', 'Principal', 'Interest', 'Balance'];

    if (headerRow) {
        headerRow.innerHTML = '';
        headerLabels.forEach((label) => {
            const th = document.createElement('th');
            th.scope = 'col';
            th.textContent = label;
            headerRow.appendChild(th);
        });
    }

    const rows = mode === 'yearly'
        ? Object.values(results.monthlyData.reduce((accumulator, entry) => {
            const year = Math.ceil(entry.month / 12);
            if (!accumulator[year]) {
                accumulator[year] = {
                    period: year,
                    payment: 0,
                    principal: 0,
                    interest: 0,
                    balance: entry.balance
                };
            }

            accumulator[year].payment += entry.payment;
            accumulator[year].principal += entry.payment - entry.interest;
            accumulator[year].interest += entry.interest;
            accumulator[year].balance = entry.balance;
            return accumulator;
        }, {}))
        : results.monthlyData.map((entry) => ({
            period: entry.month,
            payment: entry.payment,
            principal: entry.payment - entry.interest,
            interest: entry.interest,
            balance: entry.balance
        }));

    const fragment = document.createDocumentFragment();
    rows.forEach((row) => {
        const tr = document.createElement('tr');
        [row.period, row.payment, row.principal, row.interest, row.balance].forEach((value, index) => {
            const td = document.createElement('td');
            if (index === 0) {
                td.textContent = String(value);
            } else {
                td.className = index === 2 ? 'currency principal' : index === 3 ? 'currency interest' : index === 4 ? 'currency balance' : 'currency';
                td.textContent = formatCurrency(value, 2, 2);
            }
            tr.appendChild(td);
        });
        fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);

    if (tfoot) {
        const footerRow = document.createElement('tr');
        footerRow.className = 'summary-row';
        const totalPrincipal = results.monthlyData.reduce((sum, entry) => sum + (entry.payment - entry.interest), 0);
        const footerCells = ['Total', results.totalPaid, totalPrincipal, results.totalInterest, '-'];
        footerCells.forEach((value, index) => {
            const td = document.createElement('td');
            if (index === 0 || value === '-') {
                td.textContent = String(value);
            } else {
                td.className = index === 2 ? 'currency principal' : index === 3 ? 'currency interest' : 'currency';
                td.textContent = formatCurrency(value, 2, 2);
            }
            footerRow.appendChild(td);
        });
        tfoot.appendChild(footerRow);
    }
}

function mountScenarioSlider(container, baseResults, principal, annualRate, minPaymentPercent, sliderIdPrefix) {
    if (!container) {
        return;
    }

    const existing = container.querySelector('.interactive-scenario');
    if (existing) {
        existing.remove();
    }

    const max = Math.max(1000, Math.round(principal * 0.1));
    const wrapper = document.createElement('div');
    wrapper.className = 'scenario-item interactive-scenario';
    wrapper.innerHTML = `
        <h4>Custom extra payment</h4>
        <input type="range" id="${sliderIdPrefix}-slider" min="0" max="${max}" step="500" value="0">
        <div class="slider-values">
            <span>${formatCurrency(0)}</span>
            <span id="${sliderIdPrefix}-value">${formatCurrency(0)}</span>
            <span>${formatCurrency(max)}</span>
        </div>
        <p id="${sliderIdPrefix}-result">Move the slider to test an extra monthly payment.</p>
    `;
    container.appendChild(wrapper);

    const slider = wrapper.querySelector('input');
    const value = wrapper.querySelector(`#${sliderIdPrefix}-value`);
    const result = wrapper.querySelector(`#${sliderIdPrefix}-result`);

    slider.addEventListener('input', () => {
        const extra = Number(slider.value);
        value.textContent = formatCurrency(extra);
        result.textContent = extra > 0
            ? buildScenarioText(baseResults, principal, annualRate, minPaymentPercent, extra)
            : 'Move the slider to test an extra monthly payment.';
    });
}

export function createDebtCalculatorApp(config) {
    const form = document.getElementById(config.formId);
    if (!form) {
        return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const spinner = document.getElementById(config.spinnerId);
    const resultsSection = document.getElementById(config.resultsSectionId);
    const chartCard = document.getElementById(config.chartCardId);
    const messageContainer = ensureMessageContainer(form.closest('.card') || form, config.messageContainerId);
    const messages = createMessageController(messageContainer);

    let hasRenderedOnce = false;
    let balanceChart = null;
    let pieChart = null;
    let compositionChart = null;

    const runCalculation = ({ scrollIntoView = false, forceErrors = false } = {}) => {
        messages.clear();

        const outstanding = parseFloat(document.getElementById(config.inputIds.outstanding).value);
        const annualRate = parseFloat(document.getElementById(config.inputIds.rate).value);
        const minPaymentPercent = parseFloat(document.getElementById(config.inputIds.minPayment).value);
        const extraPayment = parseFloat(document.getElementById(config.inputIds.extraPayment).value || '0');

        const errors = validateDebtInputs(outstanding, annualRate, minPaymentPercent, extraPayment);
        if (errors.length > 0) {
            if (hasRenderedOnce || forceErrors) {
                messages.show('warning', errors[0]);
            }
            return false;
        }

        setButtonLoading(submitButton, spinner, true, config.idleButtonText, config.loadingButtonText);

        try {
            const results = simulateDebtPayoff(outstanding, annualRate, minPaymentPercent, extraPayment);
            const insights = generateDebtInsights(results, outstanding, annualRate, minPaymentPercent, extraPayment);
            const risk = assessDebtRisk(outstanding, config.assumedMonthlyIncome || 50000);

            document.getElementById(config.outputIds.monthlyRate).textContent = `${results.monthlyRate}%`;
            document.getElementById(config.outputIds.payoffTime).textContent = formatDurationMonths(results.months);
            document.getElementById(config.outputIds.totalPaid).textContent = formatCurrency(results.totalPaid);
            document.getElementById(config.outputIds.totalInterest).textContent = formatCurrency(results.totalInterest);
            document.getElementById(config.outputIds.principal).textContent = formatCurrency(outstanding);
            document.getElementById(config.outputIds.breakdownInterest).textContent = formatCurrency(results.totalInterest);
            document.getElementById(config.outputIds.breakdownExtra).textContent = formatCurrency(extraPayment * results.months);
            document.getElementById(config.outputIds.breakdownPercentage).textContent = `${Math.round((results.totalInterest / outstanding) * 100)}%`;

            if (config.outputIds.healthScore) {
                const health = document.getElementById(config.outputIds.healthScore);
                health.innerHTML = `
                    <div class="health-score-display">
                        <div class="health-score-circle" style="background:${risk.riskScore > 60 ? '#e74c3c' : risk.riskScore > 30 ? '#f39c12' : '#27ae60'}">
                            <div class="health-score-number">${100 - risk.riskScore}</div>
                            <div class="health-score-label">${risk.riskLevel}</div>
                        </div>
                        <div class="health-score-details">
                            <div class="health-factor"><span>Total payoff time</span><span>${formatDurationMonths(results.months)}</span></div>
                            <div class="health-factor"><span>Total interest</span><span>${formatCurrency(results.totalInterest)}</span></div>
                            <div class="health-factor"><span>Extra payment</span><span>${formatCurrency(extraPayment)}</span></div>
                        </div>
                    </div>
                `;
            }

            if (config.outputIds.riskLevel) {
                document.getElementById(config.outputIds.riskLevel).textContent = risk.riskLevel;
                document.getElementById(config.outputIds.riskDetails).innerHTML = `<small>${risk.advice}</small>`;
                const riskBar = document.getElementById(config.outputIds.riskBar);
                riskBar.style.width = `${risk.riskScore}%`;
                riskBar.style.backgroundColor = risk.riskScore > 60 ? '#e74c3c' : risk.riskScore > 30 ? '#f39c12' : '#27ae60';
            }

            if (config.outputIds.scenarios) {
                config.outputIds.scenarios.forEach((scenario) => {
                    document.getElementById(scenario.elementId).textContent = buildScenarioText(
                        results,
                        outstanding,
                        annualRate,
                        minPaymentPercent,
                        scenario.extra
                    );
                });
            }

            if (config.outputIds.insightsList) {
                renderInsights(document.getElementById(config.outputIds.insightsList), insights);
            }

            if (config.outputIds.tableBody) {
                renderDebtTable(
                    document.getElementById(config.outputIds.tableBody),
                    config.outputIds.tableFooter ? document.getElementById(config.outputIds.tableFooter) : null,
                    config.outputIds.tableHeader ? document.querySelector(config.outputIds.tableHeader) : null,
                    results,
                    'full'
                );

                if (config.outputIds.toggleFull && config.outputIds.toggleYearly) {
                    const toggleFull = document.getElementById(config.outputIds.toggleFull);
                    const toggleYearly = document.getElementById(config.outputIds.toggleYearly);
                    toggleFull.onclick = () => {
                        toggleFull.classList.add('active');
                        toggleYearly.classList.remove('active');
                        renderDebtTable(
                            document.getElementById(config.outputIds.tableBody),
                            document.getElementById(config.outputIds.tableFooter),
                            document.querySelector(config.outputIds.tableHeader),
                            results,
                            'full'
                        );
                    };
                    toggleYearly.onclick = () => {
                        toggleYearly.classList.add('active');
                        toggleFull.classList.remove('active');
                        renderDebtTable(
                            document.getElementById(config.outputIds.tableBody),
                            document.getElementById(config.outputIds.tableFooter),
                            document.querySelector(config.outputIds.tableHeader),
                            results,
                            'yearly'
                        );
                    };
                }
            }

            if (config.chartIds.pie) {
                pieChart = createChart(document.getElementById(config.chartIds.pie), {
                    type: 'doughnut',
                    data: {
                        labels: ['Principal', 'Interest'],
                        datasets: [{
                            data: [outstanding, results.totalInterest],
                            backgroundColor: ['#1f7a8c', '#c44536'],
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
                }, pieChart);
            }

            if (config.chartIds.balance) {
                balanceChart = createChart(document.getElementById(config.chartIds.balance), {
                    type: 'line',
                    data: {
                        labels: results.monthlyDataLimited.map((item) => item.month),
                        datasets: [{
                            label: 'Balance',
                            data: results.monthlyDataLimited.map((item) => item.balance),
                            borderColor: '#1f7a8c',
                            backgroundColor: 'rgba(31, 122, 140, 0.16)',
                            fill: true,
                            tension: 0.3,
                            pointRadius: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'bottom' }
                        }
                    }
                }, balanceChart);
            }

            if (config.chartIds.composition) {
                compositionChart = createChart(document.getElementById(config.chartIds.composition), {
                    type: 'bar',
                    data: {
                        labels: ['Principal', 'Interest', 'Extra paid'],
                        datasets: [{
                            label: 'Amount',
                            data: [outstanding, results.totalInterest, extraPayment * results.months],
                            backgroundColor: ['#1f7a8c', '#c44536', '#4caf50']
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { display: false }
                        }
                    }
                }, compositionChart);
            }

            if (config.outputIds.scenarioContainerId) {
                const scenarioContainer = document.getElementById(config.outputIds.scenarioContainerId) ||
                    document.querySelector(config.outputIds.scenarioContainerId);
                mountScenarioSlider(
                    scenarioContainer,
                    results,
                    outstanding,
                    annualRate,
                    minPaymentPercent,
                    config.outputIds.scenarioContainerId
                );
            }

            resultsSection.classList.remove('hidden');
            if (chartCard) {
                chartCard.classList.remove('hidden');
            }

            hasRenderedOnce = true;
            if (scrollIntoView) {
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            return true;
        } catch (error) {
            messages.show('error', `Calculation error: ${error.message}`);
            return false;
        } finally {
            setButtonLoading(submitButton, spinner, false, config.idleButtonText, config.loadingButtonText);
        }
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        runCalculation({ scrollIntoView: true, forceErrors: true });
    });

    const debouncedRun = debounce(() => {
        if (hasRenderedOnce) {
            runCalculation();
        }
    }, 250);

    form.addEventListener('input', debouncedRun);
}
