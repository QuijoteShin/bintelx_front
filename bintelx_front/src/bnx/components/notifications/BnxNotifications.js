// src/bnx/components/notifications/BnxNotifications.js
import { renderTemplate } from '../../utils.js';

const STYLES = `
/* === BNX NOTIFICATIONS (Design System Aligned) === */
bnx-notifications {
    display: block;
}

.bnx-notifications-wrapper {
    display: flex;
    align-items: center;
    position: relative;
    padding-right: 1rem;
    margin-right: 1rem;
    border-right: 1px solid hsl(var(--slate-700) / 0.5);
    font-family: var(--font-family-sans);
}

.bnx-ticker {
    max-width: 0;
    opacity: 0;
    overflow: hidden;
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    white-space: nowrap;
    text-align: right;
    margin-right: 0;
}

.bnx-ticker.is-active {
    max-width: 200px;
    opacity: 1;
    margin-right: 1rem;
}

.bnx-ticker-title {
    color: var(--color-white);
    font-size: 11px;
    font-weight: 700;
    line-height: 1.2;
}

.bnx-ticker-body {
    color: hsl(var(--slate-400));
    font-size: 10px;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
}

.bnx-bell-btn {
    position: relative;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-full);
    background-color: hsl(var(--slate-800));
    border: 1px solid hsl(var(--slate-700));
    color: hsl(var(--slate-400));
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    padding: 0;
}

.bnx-bell-btn:hover {
    color: var(--color-white);
    border-color: hsl(var(--slate-500));
    background-color: hsl(var(--slate-700));
}

.bnx-bell-btn.has-alert {
    color: hsl(var(--orange-400));
    border-color: hsl(var(--orange-500) / 0.5);
    background-color: hsl(var(--orange-500) / 0.1);
}

.bnx-bell-btn.has-success {
    color: hsl(var(--emerald-400));
    border-color: hsl(var(--emerald-500) / 0.5);
    background-color: hsl(var(--emerald-500) / 0.1);
}

.bnx-ping {
    position: absolute;
    top: 0;
    right: 0;
    width: 10px;
    height: 10px;
    background-color: hsl(var(--indigo-500));
    border-radius: var(--radius-full);
    border: 2px solid hsl(var(--slate-900));
}

.bnx-ping.is-animating::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: var(--radius-full);
    background-color: hsl(var(--indigo-400));
    animation: bnx-ping-anim 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes bnx-ping-anim {
    75%, 100% { transform: scale(2.5); opacity: 0; }
}

.bnx-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.75rem;
    width: 300px;
    background-color: hsl(var(--slate-900));
    border: 1px solid hsl(var(--slate-800));
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    z-index: 100;
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
    visibility: hidden;
    transition: all 0.2s ease-out;
}

.bnx-dropdown.is-open {
    opacity: 1;
    transform: scale(1) translateY(0);
    visibility: visible;
}

.bnx-dropdown-header {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid hsl(var(--slate-800));
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: hsl(var(--slate-800) / 0.3);
}

.bnx-dropdown-title {
    font-size: 12px;
    font-weight: 700;
    color: hsl(var(--slate-200));
}

.bnx-mark-read {
    font-size: 10px;
    color: hsl(var(--indigo-400));
    background: none;
    border: none;
    cursor: pointer;
    font-weight: 600;
}

.bnx-mark-read:hover { text-decoration: underline; }

.bnx-notification-list {
    max-height: 320px;
    overflow-y: auto;
    padding: 0.5rem;
}

.bnx-notification-item {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background-color 0.2s;
}

.bnx-notification-item:hover {
    background-color: hsl(var(--slate-800));
}

.bnx-item-icon {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.bnx-item-icon.info { background-color: hsl(var(--indigo-500) / 0.2); color: hsl(var(--indigo-400)); }
.bnx-item-icon.success { background-color: hsl(var(--emerald-500) / 0.2); color: hsl(var(--emerald-400)); }
.bnx-item-icon.alert { background-color: hsl(var(--orange-500) / 0.2); color: hsl(var(--orange-400)); }

.bnx-item-content { flex: 1; min-width: 0; }
.bnx-item-header { display: flex; justify-content: space-between; margin-bottom: 2px; }
.bnx-item-title { font-size: 12px; font-weight: 700; color: var(--color-white); }
.bnx-item-time { font-size: 9px; color: hsl(var(--slate-500)); }
.bnx-item-body { font-size: 11px; color: hsl(var(--slate-400)); line-height: 1.4; }

.bnx-empty-state {
    padding: 2rem 1rem;
    text-align: center;
    color: hsl(var(--slate-500));
    font-size: 12px;
}

/* Scrollbar */
.bnx-notification-list::-webkit-scrollbar { width: 4px; }
.bnx-notification-list::-webkit-scrollbar-track { background: transparent; }
.bnx-notification-list::-webkit-scrollbar-thumb { background: hsl(var(--slate-700)); border-radius: 10px; }
`;

const ICONS = {
    bell: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
    info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>',
    success: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="M22 4L12 14.01l-3-3"></path></svg>',
    alert: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>'
};

class BnxNotifications extends HTMLElement {
    constructor() {
        super();
        this._notifications = [];
        this._tickerTimeout = null;
        this._isOpen = false;
    }

    connectedCallback() {
        if (!this._rendered) {
            this._injectStyles();
            this._render();
            this._setupEvents();
            this._rendered = true;
            window.bnx = window.bnx || {};
            window.bnx.notify = this.notify.bind(this);
            window.bnx.clear = this.clear.bind(this);
        }
    }

    _injectStyles() {
        if (!document.getElementById('bnx-notifications-styles')) {
            const style = document.createElement('style');
            style.id = 'bnx-notifications-styles';
            style.textContent = STYLES;
            document.head.appendChild(style);
        }
    }

    _render() {
        this.innerHTML = `
            <div class="bnx-notifications-wrapper">
                <div class="bnx-ticker" data-ref="ticker">
                    <div class="bnx-ticker-title" data-ref="tickerTitle"></div>
                    <div class="bnx-ticker-body" data-ref="tickerBody"></div>
                </div>

                <button class="bnx-bell-btn" data-ref="bellBtn" title="Notificaciones">
                    ${ICONS.bell}
                    <span class="bnx-ping hidden" data-ref="ping"></span>
                </button>

                <div class="bnx-dropdown" data-ref="dropdown">
                    <div class="bnx-dropdown-header">
                        <span class="bnx-dropdown-title">Notificaciones</span>
                        <button class="bnx-mark-read" data-ref="markReadBtn">Limpiar</button>
                    </div>
                    <div class="bnx-notification-list" data-ref="list">
                        <div class="bnx-empty-state">No tienes notificaciones</div>
                    </div>
                </div>
            </div>
        `;

        this._refs = {
            ticker: this.querySelector('[data-ref="ticker"]'),
            tickerTitle: this.querySelector('[data-ref="tickerTitle"]'),
            tickerBody: this.querySelector('[data-ref="tickerBody"]'),
            bellBtn: this.querySelector('[data-ref="bellBtn"]'),
            ping: this.querySelector('[data-ref="ping"]'),
            dropdown: this.querySelector('[data-ref="dropdown"]'),
            list: this.querySelector('[data-ref="list"]'),
            markReadBtn: this.querySelector('[data-ref="markReadBtn"]')
        };
    }

    _setupEvents() {
        this._refs.bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleDropdown();
        });

        document.addEventListener('click', (e) => {
            if (this._isOpen && !this.contains(e.target)) {
                this._closeDropdown();
            }
        });

        this._refs.markReadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.clear();
        });
    }

    notify(type = 'info', title, body) {
        const id = Date.now();
        const notification = { id, type, title, body, time: new Date() };
        this._notifications.unshift(notification);
        
        this._showTicker(notification);
        this._renderList();
        this._updatePing();
        this._updateBellStatus(type);

        if (this._tickerTimeout) clearTimeout(this._tickerTimeout);
        this._tickerTimeout = setTimeout(() => {
            this._refs.ticker.classList.remove('is-active');
        }, 4000);
    }

    clear() {
        this._notifications = [];
        this._renderList();
        this._updatePing();
        this._resetBellStatus();
        this._closeDropdown();
    }

    _updateBellStatus(type) {
        this._resetBellStatus();
        if (type === 'alert' || type === 'error') {
            this._refs.bellBtn.classList.add('has-alert');
        } else if (type === 'success') {
            this._refs.bellBtn.classList.add('has-success');
        }
    }

    _resetBellStatus() {
        this._refs.bellBtn.classList.remove('has-alert', 'has-success');
    }

    _showTicker(n) {
        this._refs.tickerTitle.textContent = n.title;
        this._refs.tickerBody.textContent = n.body;
        this._refs.ticker.classList.remove('is-active');
        void this._refs.ticker.offsetWidth; // Force reflow
        this._refs.ticker.classList.add('is-active');
    }

    _renderList() {
        if (this._notifications.length === 0) {
            this._refs.list.innerHTML = '<div class="bnx-empty-state">No tienes notificaciones</div>';
            return;
        }

        this._refs.list.innerHTML = this._notifications.map(n => {
            const icon = ICONS[n.type] || ICONS.info;
            const time = n.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
                <div class="bnx-notification-item">
                    <div class="bnx-item-icon ${n.type}">${icon}</div>
                    <div class="bnx-item-content">
                        <div class="bnx-item-header">
                            <span class="bnx-item-title">${n.title}</span>
                            <span class="bnx-item-time">${time}</span>
                        </div>
                        <div class="bnx-item-body">${n.body}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    _updatePing() {
        if (this._notifications.length > 0) {
            this._refs.ping.classList.remove('hidden');
            this._refs.ping.classList.add('is-animating');
        } else {
            this._refs.ping.classList.add('hidden');
            this._refs.ping.classList.remove('is-animating');
        }
    }

    _toggleDropdown() {
        if (this._isOpen) this._closeDropdown();
        else this._openDropdown();
    }

    _openDropdown() {
        this._refs.dropdown.classList.add('is-open');
        this._isOpen = true;
    }

    _closeDropdown() {
        this._refs.dropdown.classList.remove('is-open');
        this._isOpen = false;
    }
}

customElements.define('bnx-notifications', BnxNotifications);
export default BnxNotifications;