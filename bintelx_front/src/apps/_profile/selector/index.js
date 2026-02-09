// src/apps/_profile/selector/index.js
import { api } from '../../../bnx/api.js';
import { devlog } from '../../../bnx/utils.js';
import { navigate } from '../../../bnx/router.js';
import { authFlow } from '../../../bnx/auth.js';

export default async function(container, data) {
    const scopeList = container.querySelector('#scopeList');
    const footer = container.querySelector('#selectorFooter');

    const btnWorkspaceSettings = container.querySelector('#btnWorkspaceSettings');

    // Get current scope from data or try to detect it
    const currentScopeId = data?.currentScopeId || null;

    // Get return URL from query params, data, or default to /
    const urlParams = new URLSearchParams(window.location.search);
    const redirectTo = urlParams.get('returnUrl') || data?.redirectTo || '/';

    // Load and render scopes
    await loadScopes();

    async function loadScopes() {
        try {
            const res = await api.get('/profile/scopes.json');
            devlog('Scopes loaded:', res);

            if (res?.d?.success && res.d.scopes?.length > 0) {
                renderScopes(res.d.scopes);
                if (footer) footer.hidden = false;
            } else if (res?.d?.scopes?.length === 0) {
                renderEmpty();
            } else {
                renderError('No se pudieron cargar los espacios');
            }
        } catch (err) {
            devlog('Error loading scopes:', err);
            renderError('Error de conexión');
        }
    }

    function renderScopes(scopes) {
        const companyIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 21h18M5 21V7l8-4 8 4v14M9 21v-6h6v6M9 9h.01M15 9h.01M9 13h.01M15 13h.01"/>
        </svg>`;

        const personalIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
        </svg>`;

        const arrow = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <polyline points="9 18 15 12 9 6"/>
        </svg>`;

        // Show workspace settings button if current scope is non-personal
        const currentScope = scopes.find(s => currentScopeId && s.id === currentScopeId);
        if (btnWorkspaceSettings && currentScope && !currentScope.is_personal) {
            btnWorkspaceSettings.hidden = false;
        }

        scopeList.innerHTML = scopes.map(scope => {
            const isCurrent = currentScopeId && scope.id === currentScopeId;
            const isPersonal = scope.is_personal === true;
            const icon = isPersonal ? personalIcon : companyIcon;
            const label = isPersonal ? 'Área Personal' : escapeHtml(scope.name);
            const sublabel = isPersonal ? escapeHtml(scope.name) : `ID: ${scope.id}`;

            return `
            <article class="scope-item ${isCurrent ? 'is-current' : ''} ${isPersonal ? 'is-personal' : ''}" data-scope-id="${scope.id}">
                <div class="scope-item-icon">${icon}</div>
                <div class="scope-item-info">
                    <h3 class="scope-item-name">${label}</h3>
                    <div class="scope-item-meta">
                        <span>${sublabel}</span>
                        ${isCurrent ? '<span class="scope-item-badge">Actual</span>' : ''}
                    </div>
                </div>
                <div class="scope-item-actions">
                    <div class="scope-item-arrow">${arrow}</div>
                </div>
            </article>`;
        }).join('');

        // Add click handlers
        scopeList.querySelectorAll('.scope-item').forEach(item => {
            item.addEventListener('click', () => selectScope(item));
        });
    }

    function renderEmpty() {
        scopeList.innerHTML = `
            <div class="scope-empty">
                <div class="scope-empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                        <path d="M3 21h18M5 21V7l8-4 8 4v14"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                </div>
                <p>No tienes acceso a ningún espacio de trabajo.</p>
                <p>Contacta al administrador.</p>
            </div>
        `;
    }

    function renderError(message) {
        scopeList.innerHTML = `
            <div class="scope-error">
                <p>${message}</p>
                <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer;">
                    Reintentar
                </button>
            </div>
        `;
    }

    async function selectScope(item) {
        const scopeId = parseInt(item.dataset.scopeId);

        // If already current, just navigate away
        if (item.classList.contains('is-current')) {
            navigate(redirectTo);
            return;
        }

        // Show loading state
        item.classList.add('is-loading');

        try {
            const res = await api.post('/profile/scope/switch.json', {
                scope_entity_id: scopeId
            });

            devlog('Scope switch response:', res);

            if (res?.d?.success && res.d.token) {
                // Save new token via authFlow
                authFlow.setToken(res.d.token);

                // Reload to apply new scope
                window.location.href = redirectTo;
            } else {
                item.classList.remove('is-loading');
                alert(res?.d?.message || 'Error al cambiar espacio');
            }
        } catch (err) {
            devlog('Error switching scope:', err);
            item.classList.remove('is-loading');
            alert('Error de conexión');
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;');
    }
}
