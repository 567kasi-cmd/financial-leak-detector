// sub-script.js - Subscription Leak Analyzer Logic

// Global variables
let subscriptions = [];
let subscriptionId = 0;

// Form elements
const subForm = document.getElementById('subscription-form');

// Event listeners
subForm.addEventListener('submit', handleSubFormSubmit);

/**
 * Handle subscription form submission
 * @param {event} e - Form submit event
 */
function handleSubFormSubmit(e) {
    e.preventDefault();

    // Get form values
    const name = document.getElementById('sub-name').value.trim();
    const cost = parseFloat(document.getElementById('sub-cost').value);
    const category = document.getElementById('sub-category').value;
    const usage = document.getElementById('sub-used').value;

    // Validate inputs
    if (!validateSubInputs(name, cost)) {
        showError('Please enter valid subscription details');
        return;
    }

    // Create subscription object
    const subscription = {
        id: ++subscriptionId,
        name: name,
        cost: cost,
        category: category,
        usage: usage,
        monthlyCost: cost,
        annualCost: cost * 12
    };

    // Add to subscriptions array
    subscriptions.push(subscription);

    // Update UI
    updateSubscriptionList();
    updateSummary();
    analyzeSubscriptions();

    // Reset form
    subForm.reset();

    // Show results if hidden
    document.getElementById('sub-results').classList.remove('hidden');
}

/**
 * Update the subscription list display
 */
function updateSubscriptionList() {
    const container = document.getElementById('subscriptions-container');

    if (subscriptions.length === 0) {
        container.innerHTML = '<p class="empty-state">No subscriptions added yet. Add your first subscription above!</p>';
        return;
    }

    container.innerHTML = '';

    subscriptions.forEach(sub => {
        const subItem = document.createElement('div');
        subItem.className = 'subscription-item';
        subItem.innerHTML = `
            <div class="sub-info">
                <strong>${sub.name}</strong>
                <span class="sub-category">${sub.category}</span>
                <span class="sub-usage usage-${sub.usage}">${sub.usage}</span>
            </div>
            <div class="sub-cost">
                <span class="monthly">₹${sub.cost.toLocaleString('en-IN')}/month</span>
                <span class="annual">₹${sub.annualCost.toLocaleString('en-IN')}/year</span>
            </div>
            <button class="btn btn-small btn-danger" onclick="removeSubscription(${sub.id})">
                Remove
            </button>
        `;
        container.appendChild(subItem);
    });
}

/**
 * Update summary statistics
 */
function updateSummary() {
    const totalMonthly = subscriptions.reduce((sum, sub) => sum + sub.cost, 0);
    const totalAnnual = totalMonthly * 12;
    const count = subscriptions.length;
    const average = count > 0 ? totalMonthly / count : 0;

    document.getElementById('monthly-total').textContent = `₹${totalMonthly.toLocaleString('en-IN')}`;
    document.getElementById('yearly-total').textContent = `₹${totalAnnual.toLocaleString('en-IN')}`;
    document.getElementById('service-count').textContent = count;
    document.getElementById('average-cost').textContent = `₹${average.toFixed(0).toLocaleString('en-IN')}`;
}

/**
 * Analyze subscriptions and generate insights
 */
function analyzeSubscriptions() {
    if (subscriptions.length === 0) return;

    // Calculate totals for results section
    const totalMonthly = subscriptions.reduce((sum, sub) => sum + sub.cost, 0);
    const totalAnnual = totalMonthly * 12;

    // Update result metrics
    document.getElementById('total-monthly').textContent = `₹${totalMonthly.toLocaleString('en-IN')}`;
    document.getElementById('total-annual').textContent = `₹${totalAnnual.toLocaleString('en-IN')}`;
    document.getElementById('total-services').textContent = subscriptions.length;

    // Calculate potential savings (unused services)
    const unusedServices = subscriptions.filter(sub => sub.usage === 'rarely' || sub.usage === 'never');
    const potentialSavings = unusedServices.reduce((sum, sub) => sum + sub.cost, 0) * 12;
    document.getElementById('potential-savings').textContent = `₹${potentialSavings.toLocaleString('en-IN')}`;

    // Update usage breakdown
    updateUsageBreakdown();

    // Update category chart
    updateCategoryChart();

    // Generate expensive services list
    updateExpensiveServices();

    // Generate insights
    const insights = generateSubInsights(subscriptions, totalMonthly, totalAnnual, potentialSavings);
    displaySubInsights(insights);

    // Generate cancellation recommendations
    updateCancellationList(unusedServices);
}

/**
 * Update usage breakdown statistics
 */
function updateUsageBreakdown() {
    const usageCounts = {
        daily: subscriptions.filter(s => s.usage === 'daily').length,
        weekly: subscriptions.filter(s => s.usage === 'weekly').length,
        monthly: subscriptions.filter(s => s.usage === 'monthly').length,
        rarely: subscriptions.filter(s => s.usage === 'rarely').length,
        never: subscriptions.filter(s => s.usage === 'never').length
    };

    document.getElementById('daily-use').textContent = `${usageCounts.daily} services`;
    document.getElementById('weekly-use').textContent = `${usageCounts.weekly} services`;
    document.getElementById('monthly-use').textContent = `${usageCounts.monthly} services`;
    document.getElementById('rarely-use').textContent = `${usageCounts.rarely} services`;
    document.getElementById('never-use').textContent = `${usageCounts.never} services`;
}

/**
 * Update category breakdown chart
 */
function updateCategoryChart() {
    const categoryTotals = {};
    subscriptions.forEach(sub => {
        categoryTotals[sub.category] = (categoryTotals[sub.category] || 0) + sub.cost;
    });

    const ctx = document.getElementById('category-chart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (window.categoryChart) {
        window.categoryChart.destroy();
    }

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    window.categoryChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#3498db', '#e74c3c', '#2ecc71', '#f39c12',
                    '#9b59b6', '#1abc9c', '#34495e', '#e67e22'
                ],
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
 * Update expensive services list
 */
function updateExpensiveServices() {
    const container = document.getElementById('expensive-services');

    // Sort by cost descending and take top 5
    const topServices = subscriptions
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5);

    container.innerHTML = '';

    topServices.forEach((service, index) => {
        const serviceItem = document.createElement('div');
        serviceItem.className = 'expensive-item';
        serviceItem.innerHTML = `
            <div class="rank">#${index + 1}</div>
            <div class="service-details">
                <strong>${service.name}</strong>
                <span class="category">${service.category}</span>
            </div>
            <div class="cost">
                <span class="monthly-cost">₹${service.cost.toLocaleString('en-IN')}/month</span>
                <span class="annual-cost">₹${service.annualCost.toLocaleString('en-IN')}/year</span>
            </div>
        `;
        container.appendChild(serviceItem);
    });
}

/**
 * Generate subscription-specific insights
 * @param {array} subs - Subscriptions array
 * @param {number} totalMonthly - Total monthly cost
 * @param {number} totalAnnual - Total annual cost
 * @param {number} potentialSavings - Potential savings from unused services
 * @returns {array} Insights array
 */
function generateSubInsights(subs, totalMonthly, totalAnnual, potentialSavings) {
    const insights = [];

    // High spending insight
    if (totalMonthly > 5000) {
        insights.push({
            type: 'danger',
            icon: '💸',
            title: 'High Subscription Spending',
            message: `You're spending ₹${totalMonthly.toLocaleString('en-IN')}/month on subscriptions - that's ${((totalMonthly / 50000) * 100).toFixed(0)}% of average monthly salary!`,
            action: 'Review and cancel unused services to save significantly.'
        });
    } else if (totalMonthly > 2000) {
        insights.push({
            type: 'warning',
            icon: '⚠️',
            title: 'Moderate Subscription Costs',
            message: `₹${totalMonthly.toLocaleString('en-IN')}/month is reasonable, but could be optimized.`,
            action: 'Look for cheaper alternatives or family plans.'
        });
    }

    // Unused services insight
    const unusedCount = subs.filter(s => s.usage === 'rarely' || s.usage === 'never').length;
    if (unusedCount > 0) {
        insights.push({
            type: 'danger',
            icon: '🗑️',
            title: 'Unused Subscriptions Found',
            message: `You have ${unusedCount} subscription${unusedCount > 1 ? 's' : ''} you rarely or never use, costing ₹${potentialSavings.toLocaleString('en-IN')}/year.`,
            action: 'Cancel these services immediately to save money.'
        });
    }

    // Too many services
    if (subs.length > 10) {
        insights.push({
            type: 'warning',
            icon: '📊',
            title: 'Too Many Subscriptions',
            message: `You have ${subs.length} subscriptions - that's a lot to manage!`,
            action: 'Consider consolidating services or using fewer platforms.'
        });
    }

    // Category concentration
    const categories = {};
    subs.forEach(sub => {
        categories[sub.category] = (categories[sub.category] || 0) + 1;
    });

    const maxCategory = Object.entries(categories).reduce((a, b) => categories[a[0]] > b[1] ? a : b);
    if (maxCategory[1] > subs.length * 0.4) {
        insights.push({
            type: 'info',
            icon: '🎯',
            title: 'Category Concentration',
            message: `${maxCategory[1]} of your ${subs.length} subscriptions are in ${maxCategory[0]}.`,
            action: 'Consider if you need multiple services in the same category.'
        });
    }

    // Expensive single service
    const expensiveService = subs.find(s => s.cost > 2000);
    if (expensiveService) {
        insights.push({
            type: 'warning',
            icon: '💰',
            title: 'Very Expensive Service',
            message: `${expensiveService.name} costs ₹${expensiveService.cost.toLocaleString('en-IN')}/month - that's quite expensive!`,
            action: 'Check if there are cheaper alternatives or negotiate a better rate.'
        });
    }

    // Positive insights
    if (insights.length === 0) {
        insights.push({
            type: 'success',
            icon: '✅',
            title: 'Well-Managed Subscriptions',
            message: 'Your subscriptions appear to be well-managed and reasonably priced.',
            action: 'Keep monitoring and review annually.'
        });
    }

    return insights;
}

/**
 * Display subscription insights
 * @param {array} insights - Array of insight objects
 */
function displaySubInsights(insights) {
    const list = document.getElementById('sub-insight-list');
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
 * Update cancellation recommendations list
 * @param {array} unusedServices - Array of unused services
 */
function updateCancellationList(unusedServices) {
    const container = document.getElementById('cancellation-list');

    if (unusedServices.length === 0) {
        container.innerHTML = '<p class="no-cancellations">Great! No obvious cancellation candidates found.</p>';
        return;
    }

    container.innerHTML = '';

    unusedServices.forEach(service => {
        const cancelItem = document.createElement('div');
        cancelItem.className = 'cancel-item';
        cancelItem.innerHTML = `
            <div class="cancel-info">
                <strong>${service.name}</strong>
                <span class="cancel-reason">Usage: ${service.usage}</span>
            </div>
            <div class="cancel-savings">
                <span class="monthly-save">Save ₹${service.cost.toLocaleString('en-IN')}/month</span>
                <span class="annual-save">₹${service.annualCost.toLocaleString('en-IN')}/year</span>
            </div>
        `;
        container.appendChild(cancelItem);
    });
}

/**
 * Remove a subscription
 * @param {number} id - Subscription ID to remove
 */
function removeSubscription(id) {
    subscriptions = subscriptions.filter(sub => sub.id !== id);
    updateSubscriptionList();
    updateSummary();

    if (subscriptions.length === 0) {
        document.getElementById('sub-results').classList.add('hidden');
    } else {
        analyzeSubscriptions();
    }
}

/**
 * Validate subscription form inputs
 * @param {string} name - Service name
 * @param {number} cost - Monthly cost
 * @returns {boolean} Valid or not
 */
function validateSubInputs(name, cost) {
    if (!name || name.trim().length === 0) return false;
    if (isNaN(cost) || cost <= 0) return false;
    return true;
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
    alert(message); // In production, use a toast notification
}
