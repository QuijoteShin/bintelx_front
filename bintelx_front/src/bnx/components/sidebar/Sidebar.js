// src/bnx/components/sidebar/Sidebar.js

class BnxSidebar extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._collapsed = false;
        this._breakpoint = 768;
        this._resizeObserver = null;
    }

    static get observedAttributes() {
        return ['collapsed', 'width', 'collapsed-width', 'breakpoint'];
    }

    connectedCallback() {
        this.render();
        this.setupResizeObserver();
    }

    disconnectedCallback() {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }
    }

    attributeChangedCallback(name, oldVal, newVal) {
        if (oldVal === newVal) return;

        if (name === 'collapsed') {
            this._collapsed = this.hasAttribute('collapsed');
            this.updateCollapsedState();
        }
        if (name === 'breakpoint') {
            this._breakpoint = parseInt(newVal) || 768;
        }
    }

    get collapsed() {
        return this._collapsed;
    }

    set collapsed(val) {
        this._collapsed = !!val;
        if (val) {
            this.setAttribute('collapsed', '');
        } else {
            this.removeAttribute('collapsed');
        }
        this.updateCollapsedState();
    }

    get width() {
        return this.getAttribute('width') || '220px';
    }

    get collapsedWidth() {
        return this.getAttribute('collapsed-width') || '60px';
    }

    setupResizeObserver() {
        if (typeof ResizeObserver === 'undefined') return;

        const checkWidth = () => {
            const parentWidth = this.parentElement?.offsetWidth || window.innerWidth;
            const shouldCollapse = parentWidth < this._breakpoint;

            if (shouldCollapse !== this._collapsed) {
                this.collapsed = shouldCollapse;
                this.dispatchEvent(new CustomEvent('collapse-change', {
                    bubbles: true,
                    composed: true,
                    detail: { collapsed: shouldCollapse }
                }));
            }
        };

        this._resizeObserver = new ResizeObserver(checkWidth);
        this._resizeObserver.observe(document.body);
        checkWidth();
    }

    updateCollapsedState() {
        const container = this.shadowRoot?.querySelector('.sidebar');
        if (container) {
            container.classList.toggle('collapsed', this._collapsed);
        }
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: flex;
                    flex-direction: column;
                    flex-shrink: 0;
                    height: 100%;
                }

                .sidebar {
                    width: ${this.width};
                    background: var(--color-white, #ffffff);
                    border-right: 1px solid var(--color-border-subtle, #e5e7eb);
                    display: flex;
                    flex-direction: column;
                    flex-shrink: 0;
                    overflow-y: auto;
                    overflow-x: hidden;
                    transition: width 200ms ease;
                    height: 100%;
                }

                .sidebar.collapsed {
                    width: ${this.collapsedWidth};
                }

                .sidebar-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                }

                .sidebar-footer {
                    margin-top: auto;
                    border-top: 1px solid var(--color-border-subtle, #e5e7eb);
                    background: var(--color-gray-50, #f9fafb);
                }

                /* Hide footer content when collapsed */
                .sidebar.collapsed .sidebar-footer {
                    padding: var(--spacing-2, 0.5rem);
                }

                /* Slot styles */
                ::slotted([slot="footer"]) {
                    padding: var(--spacing-4, 1rem);
                }

                .sidebar.collapsed ::slotted([slot="footer"]) {
                    display: none;
                }

                /* Toggle button */
                .sidebar-toggle {
                    display: none;
                    position: absolute;
                    top: var(--spacing-2, 0.5rem);
                    right: calc(-1 * var(--spacing-3, 0.75rem));
                    width: 1.5rem;
                    height: 1.5rem;
                    border-radius: var(--radius-full, 9999px);
                    background: var(--color-white, #ffffff);
                    border: 1px solid var(--color-border-subtle, #e5e7eb);
                    box-shadow: var(--shadow-sm);
                    cursor: pointer;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.75rem;
                    z-index: 10;
                }

                :host([show-toggle]) .sidebar-toggle {
                    display: flex;
                }

                .sidebar-toggle:hover {
                    background: var(--color-gray-50, #f9fafb);
                }

                /* Variant: bordered */
                :host([variant="bordered"]) .sidebar {
                    border: 1px solid var(--color-border-subtle, #e5e7eb);
                    border-radius: var(--radius-lg, 0.5rem);
                    margin: var(--spacing-4, 1rem);
                    height: calc(100% - var(--spacing-8, 2rem));
                }

                /* Variant: floating */
                :host([variant="floating"]) .sidebar {
                    box-shadow: var(--shadow-lg);
                    border-right: none;
                }
            </style>

            <aside class="sidebar ${this._collapsed ? 'collapsed' : ''}">
                <button class="sidebar-toggle" aria-label="Toggle sidebar">
                    ${this._collapsed ? '→' : '←'}
                </button>
                <div class="sidebar-content">
                    <slot></slot>
                </div>
                <div class="sidebar-footer">
                    <slot name="footer"></slot>
                </div>
            </aside>
        `;

        const toggle = this.shadowRoot.querySelector('.sidebar-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                this.collapsed = !this.collapsed;
            });
        }
    }
}

customElements.define('bnx-sidebar', BnxSidebar);

export default BnxSidebar;
