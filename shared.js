const RUPEE_SYMBOL = '\u20B9';

export function formatCurrency(amount, minimumFractionDigits = 0, maximumFractionDigits = 0) {
    if (!Number.isFinite(Number(amount))) {
        return `${RUPEE_SYMBOL}0`;
    }

    return `${RUPEE_SYMBOL}${Number(amount).toLocaleString('en-IN', {
        minimumFractionDigits,
        maximumFractionDigits
    })}`;
}

export function formatPercent(value, maximumFractionDigits = 2) {
    if (!Number.isFinite(Number(value))) {
        return '0%';
    }

    return `${Number(value).toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits
    })}%`;
}

export function formatDurationMonths(totalMonths) {
    const months = Math.max(0, Math.round(Number(totalMonths) || 0));
    const years = Math.floor(months / 12);
    const remainder = months % 12;

    if (years === 0) {
        return `${remainder} month${remainder === 1 ? '' : 's'}`;
    }

    if (remainder === 0) {
        return `${years} year${years === 1 ? '' : 's'}`;
    }

    return `${years}y ${remainder}m`;
}

export function formatDate(value) {
    if (!value) {
        return '';
    }

    return new Date(value).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

export function debounce(fn, wait = 250) {
    let timeoutId = null;

    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => fn(...args), wait);
    };
}

export function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
        switch (character) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            default:
                return '&#39;';
        }
    });
}

export function ensureMessageContainer(anchorElement, id) {
    let container = document.getElementById(id);

    if (!container) {
        container = document.createElement('div');
        container.id = id;
        container.className = 'message-container';
        anchorElement.insertAdjacentElement('afterend', container);
    }

    return container;
}

export function createMessageController(container) {
    return {
        clear() {
            container.innerHTML = '';
        },
        show(type, message) {
            const item = document.createElement('div');
            item.className = `message-banner message-${type}`;
            item.textContent = message;
            container.appendChild(item);
        }
    };
}

export function setButtonLoading(button, spinner, isLoading, idleText, busyText) {
    if (button) {
        button.disabled = isLoading;
    }

    if (spinner) {
        spinner.classList.toggle('hidden', !isLoading);
    }

    const textNode = button ? button.querySelector('.btn-text') : null;
    if (textNode) {
        textNode.textContent = isLoading ? busyText : idleText;
    }
}

export function attachSyncedSlider(input, options) {
    if (!input || input.dataset.sliderAttached === 'true') {
        return null;
    }

    const {
        min,
        max,
        step,
        defaultValue = min,
        formatter = (value) => value,
        parser = (value) => Number(value)
    } = options;
    const container = document.createElement('div');
    container.className = 'input-slider';
    container.innerHTML = `
        <input type="range" min="${min}" max="${max}" step="${step}" value="${input.value || defaultValue}">
        <div class="input-slider-scale">
            <span>${formatter(min)}</span>
            <span class="input-slider-current">${formatter(Number(input.value || defaultValue))}</span>
            <span>${formatter(max)}</span>
        </div>
    `;

    const slider = container.querySelector('input');
    const current = container.querySelector('.input-slider-current');
    const normalizeValue = (rawValue) => {
        const parsedValue = parser(rawValue);
        if (!Number.isFinite(parsedValue)) {
            return null;
        }

        const clampedValue = Math.min(max, Math.max(min, parsedValue));
        return Number.isInteger(step) ? Math.round(clampedValue) : clampedValue;
    };

    const syncFromSlider = () => {
        const normalizedValue = normalizeValue(slider.value);
        if (normalizedValue === null) {
            return;
        }

        input.value = String(normalizedValue);
        current.textContent = formatter(normalizedValue);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const syncFromInput = () => {
        const normalizedValue = normalizeValue(input.value);
        if (normalizedValue === null) {
            return;
        }

        slider.value = String(normalizedValue);
        current.textContent = formatter(normalizedValue);
    };

    slider.addEventListener('input', syncFromSlider);
    input.addEventListener('input', syncFromInput);
    input.addEventListener('blur', () => {
        const normalizedValue = normalizeValue(input.value);
        if (normalizedValue !== null) {
            input.value = String(normalizedValue);
            current.textContent = formatter(normalizedValue);
        }
    });
    input.insertAdjacentElement('afterend', container);
    input.dataset.sliderAttached = 'true';
    syncFromInput();

    return { container, slider };
}
