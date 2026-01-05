// src/bnx/components/step-nav/StepNav.js

class BnxStepNav extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._steps = [];
        this._current = 0;
        this._visited = new Set([0]);
        this._completed = new Set();
        this._autoComplete = false; // Si true, visited = completed (comportamiento anterior)
    }

    static get observedAttributes() {
        return ['current', 'auto-complete'];
    }

    connectedCallback() {
        this.render();
    }

    attributeChangedCallback(name, oldVal, newVal) {
        if (name === 'current' && oldVal !== newVal) {
            this._current = parseInt(newVal) || 0;
            this._visited.add(this._current);
            this.updateSteps();
        }
        if (name === 'auto-complete') {
            this._autoComplete = this.hasAttribute('auto-complete');
            this.updateSteps();
        }
    }

    get current() {
        return this._current;
    }

    set current(val) {
        this._current = parseInt(val) || 0;
        this._visited.add(this._current);
        this.setAttribute('current', this._current);
        this.updateSteps();
    }

    // Marcar paso como completado (verde)
    setCompleted(index, completed = true) {
        if (completed) {
            this._completed.add(index);
        } else {
            this._completed.delete(index);
        }
        this.updateSteps();
    }

    // Marcar múltiples pasos como completados
    setCompletedSteps(indices) {
        this._completed = new Set(indices);
        this.updateSteps();
    }

    // Reset visited/completed
    reset() {
        this._visited = new Set([0]);
        this._completed = new Set();
        this._current = 0;
        this.updateSteps();
    }

    setSteps(steps) {
        this._steps = steps.map((s, i) => ({
            id: s.id || `step-${i}`,
            label: s.label || s,
            status: s.status || null
        }));
        this.render();
    }

    setStepStatus(index, status) {
        if (this._steps[index]) {
            this._steps[index].status = status;
            this.updateStepStatus(index);
        }
    }

    updateSteps() {
        const items = this.shadowRoot.querySelectorAll('.step-nav-item');
        items.forEach((item, i) => {
            const isActive = i === this._current;
            const isVisited = this._visited.has(i) && !isActive;
            const isCompleted = this._autoComplete ? (i < this._current) : this._completed.has(i);

            item.classList.toggle('active', isActive);
            item.classList.toggle('visited', isVisited && !isCompleted);
            item.classList.toggle('completed', isCompleted);
        });
    }

    updateStepStatus(index) {
        const item = this.shadowRoot.querySelectorAll('.step-nav-item')[index];
        if (!item) return;

        const status = this._steps[index].status;
        item.classList.remove('has-error', 'has-warning');
        if (status === 'error') item.classList.add('has-error');
        if (status === 'warning') item.classList.add('has-warning');

        const statusEl = item.querySelector('.step-status');
        if (statusEl) {
            statusEl.textContent = status === 'error' ? '!' : status === 'warning' ? '?' : '';
            statusEl.style.display = status ? 'flex' : 'none';
        }
    }

    setupListeners() {
        const items = this.shadowRoot.querySelectorAll('.step-nav-item');
        items.forEach((item, i) => {
            item.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('step-click', {
                    bubbles: true,
                    composed: true,
                    detail: { index: i, step: this._steps[i] }
                }));
            });
        });
    }

    render() {
        const stepsHtml = this._steps.map((step, i) => {
            const isActive = i === this._current;
            const isVisited = this._visited.has(i) && !isActive;
            const isCompleted = this._autoComplete ? (i < this._current) : this._completed.has(i);
            const classes = [
                'step-nav-item',
                isActive ? 'active' : '',
                isVisited && !isCompleted ? 'visited' : '',
                isCompleted ? 'completed' : ''
            ].filter(Boolean).join(' ');

            return `
                <button class="${classes}" data-step="${i}">
                    <span class="step-number">${i + 1}</span>
                    <span class="step-label">${step.label}</span>
                    <span class="step-status" style="display: none;"></span>
                </button>
            `;
        }).join('');

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-2, 0.5rem);
                    padding: var(--spacing-4, 1rem);
                }

                .step-nav-item {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-3, 0.75rem);
                    padding: var(--spacing-3, 0.75rem);
                    border: none;
                    background: transparent;
                    border-radius: var(--radius-md, 0.375rem);
                    cursor: pointer;
                    transition: background-color 150ms;
                    text-align: left;
                    position: relative;
                    width: 100%;
                }

                .step-nav-item:hover {
                    background: var(--color-gray-50, #f9fafb);
                }

                .step-nav-item.active {
                    background: var(--color-primary-100, #dbeafe);
                }

                .step-nav-item.active .step-number {
                    background: var(--color-brand-primary, #3b82f6);
                    color: var(--color-white, #ffffff);
                }

                /* Visited: paso visitado pero no completado (neutral) */
                .step-nav-item.visited .step-number {
                    background: var(--color-gray-400, #9ca3af);
                    color: var(--color-white, #ffffff);
                }

                /* Completed: paso marcado como completado (verde) */
                .step-nav-item.completed .step-number {
                    background: var(--color-success-600, #16a34a);
                    color: var(--color-white, #ffffff);
                }

                .step-nav-item.completed .step-number::after {
                    content: '✓';
                    position: absolute;
                    font-size: 0.75em;
                }

                .step-nav-item.has-error .step-number {
                    background: var(--color-error-500, #ef4444);
                    color: var(--color-white, #ffffff);
                }

                .step-nav-item.has-warning .step-number {
                    background: var(--color-warning-500, #f59e0b);
                    color: var(--color-white, #ffffff);
                }

                .step-number {
                    width: 1.75rem;
                    height: 1.75rem;
                    border-radius: var(--radius-full, 9999px);
                    background: var(--color-gray-200, #e5e7eb);
                    color: var(--color-text-secondary, #6b7280);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: var(--font-weight-bold, 700);
                    font-size: var(--text-size-sm, 0.875rem);
                    flex-shrink: 0;
                    position: relative;
                }

                .step-label {
                    font-size: var(--text-size-sm, 0.875rem);
                    font-weight: var(--font-weight-medium, 500);
                    color: var(--color-text-primary, #111827);
                    flex: 1;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .step-status {
                    width: 1rem;
                    height: 1rem;
                    border-radius: var(--radius-full, 9999px);
                    background: var(--color-error-500, #ef4444);
                    color: var(--color-white, #ffffff);
                    font-size: 0.625rem;
                    font-weight: var(--font-weight-bold, 700);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                /* Compact mode - smallscreen */
                :host([compact]) .step-label,
                :host([compact]) .step-status {
                    display: none !important;
                }

                :host([compact]) .step-nav-item {
                    justify-content: center;
                    padding: var(--spacing-3, 0.75rem);
                }

                :host([compact]) {
                    padding: var(--spacing-2, 0.5rem);
                }

                /* Size variants */
                :host([size="sm"]) .step-nav-item {
                    padding: var(--spacing-2, 0.5rem);
                    gap: var(--spacing-2, 0.5rem);
                }

                :host([size="sm"]) .step-number {
                    width: 1.5rem;
                    height: 1.5rem;
                    font-size: var(--text-size-xs, 0.75rem);
                }

                :host([size="sm"]) .step-label {
                    font-size: var(--text-size-xs, 0.75rem);
                }
            </style>

            <nav class="step-nav">
                ${stepsHtml}
            </nav>
        `;

        this.setupListeners();
    }
}

customElements.define('bnx-step-nav', BnxStepNav);

export default BnxStepNav;
