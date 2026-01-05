// src/bnx/components/step-indicator/StepIndicator.js

class BnxStepIndicator extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._steps = [];
        this._current = 0;
    }

    static get observedAttributes() {
        return ['current', 'clickable'];
    }

    connectedCallback() {
        this.render();
    }

    attributeChangedCallback(name, oldVal, newVal) {
        if (name === 'current' && oldVal !== newVal) {
            this._current = parseInt(newVal) || 0;
            this.updateSteps();
        }
    }

    get current() {
        return this._current;
    }

    set current(val) {
        this._current = parseInt(val) || 0;
        this.setAttribute('current', this._current);
        this.updateSteps();
    }

    get clickable() {
        return this.hasAttribute('clickable');
    }

    setSteps(steps) {
        this._steps = steps.map((s, i) => ({
            id: s.id || `step-${i}`,
            label: s.label || s,
            icon: s.icon || null
        }));
        this.render();
    }

    updateSteps() {
        const items = this.shadowRoot.querySelectorAll('.step-item');
        items.forEach((item, i) => {
            item.classList.toggle('active', i === this._current);
            item.classList.toggle('completed', i < this._current);
        });
    }

    setupListeners() {
        if (!this.clickable) return;

        const items = this.shadowRoot.querySelectorAll('.step-item');
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
        const stepsHtml = this._steps.map((step, i) => `
            <div class="step-item ${i === this._current ? 'active' : ''} ${i < this._current ? 'completed' : ''}"
                 data-step="${i}">
                <span class="step-num">${step.icon || i + 1}</span>
                <span class="step-label">${step.label}</span>
            </div>
        `).join('');

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                }

                .step-container {
                    display: flex;
                    gap: var(--spacing-2, 0.5rem);
                }

                .step-item {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-2, 0.5rem);
                    padding: var(--spacing-2, 0.5rem) var(--spacing-3, 0.75rem);
                    background: var(--color-gray-100, #f3f4f6);
                    border-radius: var(--radius-md, 0.375rem);
                    color: var(--color-text-tertiary, #9ca3af);
                    font-size: var(--text-size-sm, 0.875rem);
                    transition: all 150ms;
                    border: none;
                }

                :host([clickable]) .step-item {
                    cursor: pointer;
                }

                :host([clickable]) .step-item:hover:not(.active) {
                    background: var(--color-gray-200, #e5e7eb);
                }

                .step-item.active {
                    background: var(--color-brand-50, #eff6ff);
                    color: var(--color-brand-primary, #3b82f6);
                }

                .step-item.completed {
                    background: var(--color-success-50, #f0fdf4);
                    color: var(--color-success-600, #16a34a);
                }

                .step-num {
                    width: 1.5rem;
                    height: 1.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--color-white, #ffffff);
                    border-radius: var(--radius-full, 9999px);
                    font-weight: var(--font-weight-bold, 700);
                    font-size: var(--text-size-xs, 0.75rem);
                    flex-shrink: 0;
                }

                .step-item.active .step-num {
                    background: var(--color-brand-primary, #3b82f6);
                    color: var(--color-white, #ffffff);
                }

                .step-item.completed .step-num {
                    background: var(--color-success-600, #16a34a);
                    color: var(--color-white, #ffffff);
                }

                .step-item.completed .step-num::before {
                    content: '✓';
                }

                .step-item.completed .step-num:not(:empty)::before {
                    content: none;
                }

                .step-label {
                    font-weight: var(--font-weight-medium, 500);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                /* Variantes */
                :host([variant="vertical"]) .step-container {
                    flex-direction: column;
                }

                :host([variant="compact"]) .step-item {
                    padding: var(--spacing-1, 0.25rem) var(--spacing-2, 0.5rem);
                }

                :host([variant="compact"]) .step-num {
                    width: 1.25rem;
                    height: 1.25rem;
                }

                :host([variant="numbers-only"]) .step-label {
                    display: none;
                }

                :host([variant="numbers-only"]) .step-item {
                    flex: 0;
                    padding: var(--spacing-2, 0.5rem);
                }

                /* Conectores opcionales */
                :host([connectors]) .step-item:not(:last-child)::after {
                    content: '';
                    flex: 0 0 1rem;
                    height: 2px;
                    background: var(--color-border-subtle, #e5e7eb);
                    margin-left: var(--spacing-2, 0.5rem);
                }

                :host([connectors]) .step-item.completed:not(:last-child)::after {
                    background: var(--color-success-400, #4ade80);
                }

                /* Size */
                :host([size="sm"]) .step-item {
                    font-size: var(--text-size-xs, 0.75rem);
                    padding: var(--spacing-1, 0.25rem) var(--spacing-2, 0.5rem);
                }

                :host([size="sm"]) .step-num {
                    width: 1.25rem;
                    height: 1.25rem;
                    font-size: 0.625rem;
                }

                :host([size="lg"]) .step-item {
                    font-size: var(--text-size-base, 1rem);
                    padding: var(--spacing-3, 0.75rem) var(--spacing-4, 1rem);
                }

                :host([size="lg"]) .step-num {
                    width: 2rem;
                    height: 2rem;
                }
            </style>

            <div class="step-container">
                ${stepsHtml}
            </div>
        `;

        this.setupListeners();
    }
}

customElements.define('bnx-step-indicator', BnxStepIndicator);

export default BnxStepIndicator;
