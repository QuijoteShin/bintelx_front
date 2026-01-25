// src/apps/layout/navigation/index.js
import { api } from '@bnx/api.js';
import { devlog } from '@bnx/utils.js';
import { authFlow } from '@bnx/auth.js';
import { localRoutesHint } from '@bnx/router.js';
import './index.css';

const AVATAR_PATTERNS = [
  '',                  // Default (soft radial)
  'pattern-checker',
  'pattern-sunburst',
  'pattern-bauhaus',
  'pattern-zigzag',
  'pattern-rings',
  'pattern-diagonal',
  'pattern-dots'
];

function simpleHash(str) {
  let hash = 5381;  // DJB2 seed for better distribution
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) + hash) + char;  // hash * 33 + char
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getAvatarProps(profileId) {
  const hash = simpleHash(profileId);
  const hue = hash % 360;
  const patternIndex = hash % AVATAR_PATTERNS.length;
  const patternClass = AVATAR_PATTERNS[patternIndex];
  return { hue, patternClass };
}

export default async function(container) {
  const list = container.querySelector('#bx-nav-list');
  const unconfiguredSection = container.querySelector('#bx-nav-unconfigured-section');
  const unconfiguredList = container.querySelector('#bx-nav-unconfigured-list');
  const unconfiguredCount = container.querySelector('#bx-nav-unconfigured-count');
  const profileSection = container.querySelector('#bx-nav-profile');
  const profileAvatar = container.querySelector('#profile-avatar');
  const profileInitial = container.querySelector('#profile-initial');
  const profileScopeName = container.querySelector('#profile-scope-name');
  const profileScopeRole = container.querySelector('#profile-scope-role');
  const profileDropdown = container.querySelector('#profile-dropdown');
  const profileSwitchScope = container.querySelector('#profile-switch-scope');
  const profileLogout = container.querySelector('#profile-logout');
  let cachedRoles = [];
  let cachedUnconfigured = [];
  let hasMultipleScopes = false;

  function renderProfileAvatar(profile) {
    if (!profile || !profileAvatar) return;

    const { profile_id, initial, scope_name, profile_name, is_own_scope, role_label, scope_entity_id } = profile;
    // Use scope_entity_id for avatar when in switched scope, profile_id for own scope
    const avatarSeed = is_own_scope ? profile_id : (scope_entity_id || profile_id);
    const { hue, patternClass } = getAvatarProps(avatarSeed);

    // Apply pattern class and hue
    profileAvatar.className = `profile-avatar size-sm ${patternClass}`;
    profileAvatar.style.setProperty('--avatar-hue', hue);

    // Set initial
    if (profileInitial) {
      profileInitial.textContent = initial || 'U';
    }

    // Set scope name and role based on context
    if (profileScopeName) {
      if (is_own_scope) {
        // In own scope: show "Mi espacio" or profile name
        profileScopeName.textContent = 'Mi espacio';
      } else {
        // In switched scope: show workspace name
        profileScopeName.textContent = scope_name || 'Workspace';
      }
    }

    // Set role (only for switched scope)
    if (profileScopeRole) {
      if (!is_own_scope && role_label) {
        profileScopeRole.textContent = role_label;
      } else if (is_own_scope) {
        profileScopeRole.textContent = profile_name || '';
      } else {
        profileScopeRole.textContent = '';
      }
    }
  }

  function setupProfileSection(profile) {
    if (!profileSection) return;

    // Toggle dropdown on click (but not on dropdown items)
    profileSection.addEventListener('click', (e) => {
      if (profileDropdown && profileDropdown.contains(e.target)) return;
      e.stopPropagation();
      profileSection.classList.toggle('is-open');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!profileSection.contains(e.target)) {
        profileSection.classList.remove('is-open');
      }
    });

    // Logout handler
    if (profileLogout) {
      profileLogout.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        profileSection.classList.remove('is-open');
        authFlow.logout();
      });
    }

    devlog('Profile section setup complete - checking scopes async...');

    // Check if user has multiple scopes - ASYNC, runs after listeners are attached
    api.get('/profile/scopes.json').then(scopesRes => {
      if (scopesRes?.d?.success && scopesRes.d.scopes?.length > 1) {
        hasMultipleScopes = true;
        if (profileSwitchScope) {
          profileSwitchScope.hidden = false;
        }
        devlog('Multiple scopes detected:', scopesRes.d.scopes.length);
      }
    }).catch(err => {
      devlog('Error checking scopes:', err);
    });
  }

  const render = (routes) => {
    if (!routes || !routes.length) {
      list.innerHTML = '<li class="bx-nav__item bx-nav__item--empty">Sin rutas disponibles</li>';
      return;
    }

    // Filter out hidden routes (navegables pero no visibles en menú)
    const visibleRoutes = routes.filter(r => !r.hidden && r.label);

    // Group routes by parent (for submenu)
    const grouped = groupRoutesByParent(visibleRoutes);

    const html = Object.entries(grouped).map(([parent, items]) => {
      if (items.length === 1 && items[0].path === parent) {
        // Single item, no submenu
        const r = items[0];
        const isActive = window.location.pathname.includes(r.path) ? 'is-active' : '';
        return `<li class="bx-nav__item ${isActive}"><a href="${r.path}">${r.label || r.path}</a></li>`;
      } else {
        // Has submenu
        const parentLabel = items[0].parent_label || parent;
        const isActive = items.some(r => window.location.pathname.includes(r.path)) ? 'is-active' : '';

        const submenuItems = items.map(r => {
          const subActive = window.location.pathname.includes(r.path) ? 'is-active' : '';
          return `<li class="bx-nav__submenu-item ${subActive}"><a href="${r.path}">${r.label || r.path}</a></li>`;
        }).join('');

        return `
          <li class="bx-nav__item bx-nav__item--has-submenu ${isActive}">
            <span class="bx-nav__parent">${parentLabel}</span>
            <ul class="bx-nav__submenu">
              ${submenuItems}
            </ul>
          </li>
        `;
      }
    }).join('');

    list.innerHTML = html;
  };

  function groupRoutesByParent(routes) {
    const groups = {};

    routes.forEach(route => {
      // Extract parent from path (e.g., /orders/create → orders)
      const parts = route.path.split('/').filter(p => p);
      const parent = parts[0] || 'root';

      if (!groups[parent]) {
        groups[parent] = [];
      }

      groups[parent].push({
        ...route,
        parent_label: route.parent_label || (parent.charAt(0).toUpperCase() + parent.slice(1))
      });
    });

    return groups;
  }

  function renderUnconfigured(unconfigured, isAdmin) {
    if (!unconfiguredSection) return;
    if (!isAdmin) {
      unconfiguredSection.hidden = true;
      return;
    }

    cachedUnconfigured = unconfigured || [];
    if (!cachedUnconfigured.length) {
      unconfiguredSection.hidden = true;
      return;
    }

    unconfiguredSection.hidden = false;
    unconfiguredCount.textContent = cachedUnconfigured.length;

    unconfiguredList.innerHTML = cachedUnconfigured.map((r, idx) => {
      const label = r.label || r.path;
      return `
        <li class="bx-nav-unconfigured__item" data-idx="${idx}">
          <span class="bx-nav-unconfigured__path">${label}</span>
          <button class="bx-nav-unconfigured__add" data-idx="${idx}">Agregar</button>
        </li>
      `;
    }).join('');

    unconfiguredList.querySelectorAll('.bx-nav-unconfigured__add').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const idx = Number(btn.dataset.idx || '-1');
        const route = cachedUnconfigured[idx];
        if (!route) return;
        await addRoute(route);
      });
    });
  }

  async function addRoute(route) {
    try {
      // Normaliza ruta para guardar en backend
      const payloadRoute = {
        path: route.path,
        label: route.label || route.path,
        app: route.app || null,
        moduleName: route.moduleName || null,
        prefix: route.prefix || null,
        required_roles: route.required_roles || []
      };
      await api.post('/navigation', { action: 'save', routes: [payloadRoute] });
      // Saca la ruta de la lista local y fuerza recarga de navegación
      cachedUnconfigured = cachedUnconfigured.filter(r => r.path !== route.path);
      renderUnconfigured(cachedUnconfigured, cachedRoles.includes('system.admin'));
      await reloadNavigation();
    } catch (error) {
      devlog('No se pudo agregar ruta a navegación', error);
    }
  }

  async function reloadNavigation() {
    try {
      const res = await api.post('/navigation', { action: 'fetch', local_routes: localRoutesHint });
      const payload = res?.d || {};
      const routes = payload.routes || [];
      cachedRoles = payload.roles || cachedRoles;
      render(routes);
    } catch (e) {
      devlog('Falló recarga de navegación', e);
    }
  }

  try {
    const res = await api.post('/navigation', { action: 'fetch', local_routes: localRoutesHint });
    const payload = res?.d || {};
    const routes = payload.routes || [];
    const configured = payload.configured ?? false;
    const unconfigured = payload.unconfigured || [];
    cachedRoles = payload.roles || {};
    // roles es un objeto {id: 'role_code'}, convertir a array de valores
    const roleValues = Object.values(cachedRoles);
    const isAdmin = roleValues.includes('system.admin');

    // Render profile avatar with pattern and hue
    renderProfileAvatar(payload.profile);

    // Check if user has multiple scopes and setup profile click
    setupProfileSection(payload.profile);

    renderUnconfigured(unconfigured, isAdmin);

    if (!configured && (!routes || routes.length === 0)) {
      render(localRoutesHint); // fallback to local routes
    } else {
      render(routes);
    }
  } catch (e) {
    devlog('Nav load failed, using local routes', e);
    render(localRoutesHint);
  }
}
