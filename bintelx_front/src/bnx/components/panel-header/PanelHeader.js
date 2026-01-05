// src/bnx/components/panel-header/PanelHeader.js

class BnxPanelHeader extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return ['back-href', 'back-label', 'hide-back'];
    }

    connectedCallback() {
        this.render();
        this.setupListeners();
    }

    attributeChangedCallback() {
        if (this.shadowRoot.innerHTML) {
            this.render();
            this.setupListeners();
        }
    }

    get backHref() {
        return this.getAttribute('back-href') || '';
    }

    get backLabel() {
        return this.getAttribute('back-label') || 'Volver';
    }

    get hideBack() {
        return this.hasAttribute('hide-back');
    }

    setupListeners() {
        const backLink = this.shadowRoot.querySelector('.panel-back-link');
        if (backLink) {
            backLink.addEventListener('click', (e) => {
                e.preventDefault();
                const event = new CustomEvent('navigate', {
                    bubbles: true,
                    composed: true,
                    detail: { href: this.backHref }
                });
                this.dispatchEvent(event);

                // Default: SPA navigation si hay href
                if (this.backHref && !event.defaultPrevented) {
                    history.pushState({}, '', this.backHref);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                }
            });
        }
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                }

                .panel-header {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: var(--spacing-4, 1rem);
                    padding: var(--spacing-4, 1rem) var(--spacing-6, 1.5rem);
                    background: var(--color-white, #ffffff);
                    border-bottom: 1px solid var(--color-border-subtle, #e5e7eb);
                }

                .panel-left {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-4, 1rem);
                    flex: 1;
                    min-width: 0;
                }

                .panel-back-link {
                    display: inline-flex;
                    align-items: center;
                    gap: var(--spacing-2, 0.5rem);
                    padding: var(--spacing-2, 0.5rem) var(--spacing-3, 0.75rem);
                    font-size: var(--text-size-sm, 0.875rem);
                    font-weight: var(--font-weight-medium, 500);
                    color: var(--color-text-secondary, #6b7280);
                    text-decoration: none;
                    background: var(--color-gray-50, #f9fafb);
                    border-radius: var(--radius-md, 0.375rem);
                    cursor: pointer;
                    transition: all 150ms;
                    flex-shrink: 0;
                    border: none;
                }

                .panel-back-link:hover {
                    background: var(--color-gray-100, #f3f4f6);
                    color: var(--color-text-primary, #111827);
                }

                .panel-back-icon {
                    font-size: 1rem;
                }

                .panel-divider {
                    width: 1px;
                    height: 2rem;
                    background: var(--color-border-subtle, #e5e7eb);
                    flex-shrink: 0;
                }

                .panel-content {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-3, 0.75rem);
                    flex: 1;
                    min-width: 0;
                }

                .panel-right {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-3, 0.75rem);
                    flex-shrink: 0;
                }

                /* Variantes */
                :host([variant="compact"]) .panel-header {
                    padding: var(--spacing-3, 0.75rem) var(--spacing-4, 1rem);
                }

                :host([variant="transparent"]) .panel-header {
                    background: transparent;
                    border-bottom: none;
                }

                :host([variant="sticky"]) .panel-header {
                    position: sticky;
                    top: 0;
                    z-index: 100;
                }

                /* Hide back */
                :host([hide-back]) .panel-back-link,
                :host([hide-back]) .panel-divider {
                    display: none;
                }

                /* Responsive */
                @media (max-width: 640px) {
                    .panel-header {
                        padding: var(--spacing-3, 0.75rem);
                    }

                    .panel-right {
                        width: 100%;
                        justify-content: flex-end;
                    }
                }

                /* Slotted styles */
                ::slotted([slot="content"]) {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-3, 0.75rem);
                }
            </style>

            <header class="panel-header">
                <div class="panel-left">
                    <a href="${this.backHref || '#'}" class="panel-back-link">
                        <span class="panel-back-icon">&#8592;</span>
                        <span>${this.backLabel}</span>
                    </a>
                    <div class="panel-divider"></div>
                    <div class="panel-content">
                        <slot name="content"></slot>
                    </div>
                </div>

                <div class="panel-right">
                    <slot name="status"></slot>
                    <slot name="actions"></slot>
                </div>

                <slot></slot>
            </header>
        `;
    }
}

customElements.define('bnx-panel-header', BnxPanelHeader);

export default BnxPanelHeader;
