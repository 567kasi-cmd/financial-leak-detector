import { createMessageController, ensureMessageContainer, escapeHtml, formatCurrency } from '../shared.js';

let subscriptions = [];
let subscriptionId = 0;
let categoryChart = null;

const form = document.getElementById('subscription-form');
const messageContainer = ensureMessageContainer(form.closest('.card') || form, 'subscription-message-container');
const messages = createMessageController(messageContainer);

form.addEventListener('submit', handleSubmit);

function validateSubscription(name, cost) {
    const errors = [];

    if (!name || name.trim().length === 0) {
        errors.push('Subscription name is required.');
    }
    if (!Number.isFinite(cost) || cost <= 0) {
        errors.push('Monthly cost must be greater than 0.');
    }

    return errors;
}

function handleSubmit(event) {
    event.preventDefault();
    messages.clear();

    const name = document.getElementById('sub-name').value.trim();
    const cost = parseFloat(document.getElementById('sub-cost').value);
    const category = document.getElementById('sub-category').value;
    const usage = document.getElementById('sub-used').value;
    const errors = validateSubscription(name, cost);

    if (errors.length > 0) {
        messages.show('error', errors[0]);
        return;
    }

    subscriptions.push({
        id: ++subscriptionId,
        name,
        cost,
        category,
        usage,
        annualCost: cost * 12
    });

    render();
    form.reset();
}

function render() {
    const results = document.getElementById('sub-results');
    const list = document.getElementById('subscriptions-container');

    if (subscriptions.length === 0) {
        results.classList.add('hidden');
        list.innerHTML = '<p class="empty-state">No subscriptions added yet. Add your first subscription above.</p>';
        return;
    }

    results.classList.remove('hidden');
    renderSubscriptionList(list);
    renderSummary();
    renderUsageBreakdown();
    renderCategoryChart();
    renderExpensiveServices();
    renderInsights();
    renderCancellationList();
}

function renderSubscriptionList(container) {
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();

    subscriptions.forEach((subscription) => {
        const item = document.createElement('div');
        item.className = 'subscription-item';
        item.innerHTML = `
            <div class="sub-info">
                <strong>${escapeHtml(subscription.name)}</strong>
                <span class="sub-category">${escapeHtml(subscription.category)}</span>
                <span class="sub-usage usage-${escapeHtml(subscription.usage)}">${escapeHtml(subscription.usage)}</span>
            </div>
            <div class="sub-cost">
                <span class="monthly">${formatCurrency(subscription.cost)}/month</span>
                <span class="annual">${formatCurrency(subscription.annualCost)}/year</span>
            </div>
            <button class="btn btn-small btn-danger" data-remove-id="${subscription.id}">Remove</button>
        `;
        fragment.appendChild(item);
    });

    container.appendChild(fragment);
    container.querySelectorAll('[data-remove-id]').forEach((button) => {
        button.addEventListener('click', () => {
            subscriptions = subscriptions.filter((subscription) => subscription.id !== Number(button.dataset.removeId));
            render();
        });
    });
}

function renderSummary() {
    const totalMonthly = subscriptions.reduce((sum, subscription) => sum + subscription.cost, 0);
    const count = subscriptions.length;
    const average = count > 0 ? totalMonthly / count : 0;

    document.getElementById('monthly-total').textContent = formatCurrency(totalMonthly);
    document.getElementById('yearly-total').textContent = formatCurrency(totalMonthly * 12);
    document.getElementById('service-count').textContent = String(count);
    document.getElementById('average-cost').textContent = formatCurrency(average);
    document.getElementById('total-monthly').textContent = formatCurrency(totalMonthly);
    document.getElementById('total-annual').textContent = formatCurrency(totalMonthly * 12);
    document.getElementById('total-services').textContent = String(count);

    const potentialSavings = subscriptions
        .filter((subscription) => subscription.usage === 'rarely' || subscription.usage === 'never')
        .reduce((sum, subscription) => sum + subscription.annualCost, 0);
    document.getElementById('potential-savings').textContent = formatCurrency(potentialSavings);
}

function renderUsageBreakdown() {
    ['daily', 'weekly', 'monthly', 'rarely', 'never'].forEach((usage) => {
        const count = subscriptions.filter((subscription) => subscription.usage === usage).length;
        document.getElementById(`${usage}-use`).textContent = `${count} service${count === 1 ? '' : 's'}`;
    });
}

function renderCategoryChart() {
    const canvas = document.getElementById('category-chart');
    if (!canvas || typeof Chart === 'undefined') {
        return;
    }

    const categoryTotals = subscriptions.reduce((map, subscription) => {
        map[subscription.category] = (map[subscription.category] || 0) + subscription.cost;
        return map;
    }, {});

    if (categoryChart) {
        categoryChart.destroy();
    }

    categoryChart = new Chart(canvas, {
        type: 'pie',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: ['#1f7a8c', '#bfdbf7', '#ff6b6b', '#4caf50', '#f4b942', '#5c5470', '#7d8597']
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

function renderExpensiveServices() {
    const container = document.getElementById('expensive-services');
    container.innerHTML = '';

    subscriptions
        .slice()
        .sort((left, right) => right.cost - left.cost)
        .slice(0, 5)
        .forEach((subscription, index) => {
            const item = document.createElement('div');
            item.className = 'expensive-item';
            item.innerHTML = `
                <div class="rank">#${index + 1}</div>
                <div class="service-details">
                    <strong>${escapeHtml(subscription.name)}</strong>
                    <span class="category">${escapeHtml(subscription.category)}</span>
                </div>
                <div class="cost">
                    <span class="monthly-cost">${formatCurrency(subscription.cost)}/month</span>
                    <span class="annual-cost">${formatCurrency(subscription.annualCost)}/year</span>
                </div>
            `;
            container.appendChild(item);
        });
}

function renderInsights() {
    const totalMonthly = subscriptions.reduce((sum, subscription) => sum + subscription.cost, 0);
    const potentialSavings = subscriptions
        .filter((subscription) => subscription.usage === 'rarely' || subscription.usage === 'never')
        .reduce((sum, subscription) => sum + subscription.annualCost, 0);
    const unusedCount = subscriptions.filter((subscription) => subscription.usage === 'rarely' || subscription.usage === 'never').length;

    const insights = [];
    if (unusedCount > 0) {
        insights.push({
            type: 'danger',
            icon: '!',
            title: 'Immediate cancellation candidates',
            message: `${unusedCount} service(s) appear underused and represent ${formatCurrency(potentialSavings)} per year.`,
            action: 'Cancel the least-used subscriptions first to create instant monthly savings.'
        });
    }
    if (totalMonthly > 3000) {
        insights.push({
            type: 'warning',
            icon: 'i',
            title: 'Subscription budget is climbing',
            message: `Monthly recurring spend is already at ${formatCurrency(totalMonthly)}.`,
            action: 'Review duplicate streaming, software, and premium plans.'
        });
    }
    if (insights.length === 0) {
        insights.push({
            type: 'success',
            icon: '+',
            title: 'Subscriptions look controlled',
            message: 'There are no obvious red flags in the current subscription list.',
            action: 'Keep reviewing recurring charges every few months.'
        });
    }

    const list = document.getElementById('sub-insight-list');
    list.innerHTML = '';
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
        list.appendChild(item);
    });
}

function renderCancellationList() {
    const container = document.getElementById('cancellation-list');
    const candidates = subscriptions.filter((subscription) => subscription.usage === 'rarely' || subscription.usage === 'never');

    if (candidates.length === 0) {
        container.innerHTML = '<p class="no-cancellations">No clear cancellation candidates right now.</p>';
        return;
    }

    container.innerHTML = '';
    candidates.forEach((subscription) => {
        const item = document.createElement('div');
        item.className = 'cancel-item';
        item.innerHTML = `
            <div class="cancel-info">
                <strong>${escapeHtml(subscription.name)}</strong>
                <span class="cancel-reason">Usage: ${escapeHtml(subscription.usage)}</span>
            </div>
            <div class="cancel-savings">
                <span class="monthly-save">Save ${formatCurrency(subscription.cost)}/month</span>
                <span class="annual-save">${formatCurrency(subscription.annualCost)}/year</span>
            </div>
        `;
        container.appendChild(item);
    });
}
