// src/bnx/components/sidebar/StepperSidebar.js
// Sidebar especializado para steppers con navegación de pasos + info panel

import './Sidebar.js';
import '../step-nav/StepNav.js';

class BnxStepperSidebar extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._steps = [];
        this._current = 0;
    }

    static get observedAttributes() {
        return ['current', 'auto-complete'];
    }

    connectedCallback() {
        this.render();
    }

    attributeChangedCallback(name, oldVal, newVal) {
        if (oldVal === newVal) return;

        if (name === 'current') {
            this._current = parseInt(newVal) || 0;
            const nav = this.shadowRoot?.querySelector('bnx-step-nav');
            if (nav) nav.current = this._current;
        }
        if (name === 'auto-complete') {
            const nav = this.shadowRoot?.querySelector('bnx-step-nav');
            if (nav) nav.toggleAttribute('auto-complete', this.hasAttribute('auto-complete'));
        }
    }

    get current() {
        return this._current;
    }

    set current(val) {
        this._current = parseInt(val) || 0;
        this.setAttribute('current', this._current);
        const nav = this.shadowRoot?.querySelector('bnx-step-nav');
        if (nav) nav.current = this._current;
    }

    get stepNav() {
        return this.shadowRoot?.querySelector('bnx-step-nav');
    }

    get sidebar() {
        return this.shadowRoot?.querySelector('bnx-sidebar');
    }

    setSteps(steps) {
        this._steps = steps;
        const nav = this.shadowRoot?.querySelector('bnx-step-nav');
        if (nav) {
            nav.setSteps(steps.map(s => ({ id: s.id, label: s.label })));
        }
    }

    setCompleted(index, completed = true) {
        const nav = this.shadowRoot?.querySelector('bnx-step-nav');
        if (nav) nav.setCompleted(index, completed);
    }

    setCompletedSteps(indices) {
        const nav = this.shadowRoot?.querySelector('bnx-step-nav');
        if (nav) nav.setCompletedSteps(indices);
    }

    setStepStatus(index, status) {
        const nav = this.shadowRoot?.querySelector('bnx-step-nav');
        if (nav) nav.setStepStatus(index, status);
    }

    render() {
        const width = this.getAttribute('width') || '220px';
        const collapsedWidth = this.getAttribute('collapsed-width') || '60px';
        const breakpoint = this.getAttribute('breakpoint') || '768';

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    height: 100%;
                }

                bnx-sidebar {
                    height: 100%;
                }

                .info-panel {
                    padding: var(--spacing-4, 1rem);
                }

                .info-panel h4 {
                    font-size: var(--text-size-sm, 0.875rem);
                    font-weight: var(--font-weight-semibold, 600);
                    color: var(--color-text-primary, #111827);
                    margin: 0 0 var(--spacing-2, 0.5rem) 0;
                }

                .info-panel p {
                    font-size: var(--text-size-sm, 0.875rem);
                    color: var(--color-text-tertiary, #9ca3af);
                    margin: 0;
                }

                ::slotted([slot="info"]) {
                    padding: var(--spacing-4, 1rem);
                }
            </style>

            <bnx-sidebar width="${width}" collapsed-width="${collapsedWidth}" breakpoint="${breakpoint}">
                <bnx-step-nav current="${this._current}" ${this.hasAttribute('auto-complete') ? 'auto-complete' : ''}></bnx-step-nav>
                <div slot="footer">
                    <slot name="info"></slot>
                </div>
            </bnx-sidebar>
        `;

        this.setupListeners();
    }

    setupListeners() {
        const sidebar = this.shadowRoot?.querySelector('bnx-sidebar');
        const nav = this.shadowRoot?.querySelector('bnx-step-nav');

        // Sync collapsed state
        if (sidebar && nav) {
            sidebar.addEventListener('collapse-change', (e) => {
                nav.toggleAttribute('compact', e.detail.collapsed);
                this.dispatchEvent(new CustomEvent('collapse-change', {
                    bubbles: true,
                    composed: true,
                    detail: e.detail
                }));
            });
        }

        // Forward step-click
        if (nav) {
            nav.addEventListener('step-click', (e) => {
                this.dispatchEvent(new CustomEvent('step-click', {
                    bubbles: true,
                    composed: true,
                    detail: e.detail
                }));
            });
        }
    }
}

customElements.define('bnx-stepper-sidebar', BnxStepperSidebar);

export default BnxStepperSidebar;
