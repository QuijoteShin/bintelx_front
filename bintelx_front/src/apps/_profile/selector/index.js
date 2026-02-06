// src/apps/_profile/selector/index.js
import { api } from '@bnx/api.js';
import { devlog } from '@bnx/utils.js';
import { navigate } from '@bnx/router.js';
import { authFlow } from '@bnx/auth.js';

export default async function(container, data) {
    const scopeList = container.querySelector('#scopeList');
    const footer = container.querySelector('#selectorFooter');

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

        const cogIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>`;

        scopeList.innerHTML = scopes.map(scope => {
            const isCurrent = currentScopeId && scope.id === currentScopeId;
            const isPersonal = scope.is_personal === true;
            const icon = isPersonal ? personalIcon : companyIcon;
            const label = isPersonal ? 'Área Personal' : escapeHtml(scope.name);
            const sublabel = isPersonal ? escapeHtml(scope.name) : `ID: ${scope.id}`;

            // Cog only for non-personal workspaces
            const settingsBtn = !isPersonal ? `
                <button class="scope-item-settings" data-scope-id="${scope.id}" title="Configuración">
                    ${cogIcon}
                </button>` : '';

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
                    ${settingsBtn}
                    <div class="scope-item-arrow">${arrow}</div>
                </div>
            </article>`;
        }).join('');

        // Add click handlers
        scopeList.querySelectorAll('.scope-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't select scope if clicking settings button
                if (e.target.closest('.scope-item-settings')) return;
                selectScope(item);
            });
        });

        // Settings button handlers
        scopeList.querySelectorAll('.scope-item-settings').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const scopeId = btn.dataset.scopeId;
                navigate(`/workspace/settings?scope=${scopeId}`);
            });
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
