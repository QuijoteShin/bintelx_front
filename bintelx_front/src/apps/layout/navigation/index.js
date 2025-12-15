import { api } from '../../../bnx/api.js';
import { devlog } from '../../../bnx/utils.js';
import { authFlow } from '../../../bnx/auth.js';
import { localRoutesHint } from '../../../bnx/router.js';
import './index.css';

export default async function(container) {
  const list = container.querySelector('#bx-nav-list');
  const unconfiguredSection = container.querySelector('#bx-nav-unconfigured-section');
  const unconfiguredList = container.querySelector('#bx-nav-unconfigured-list');
  const unconfiguredCount = container.querySelector('#bx-nav-unconfigured-count');
  let cachedRoles = [];
  let cachedUnconfigured = [];

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

    list.innerHTML = html + `<li class="bx-nav__item bx-nav__logout"><button id="bx-logout">Cerrar sesión</button></li>`;

    const btnLogout = list.querySelector('#bx-logout');
    btnLogout?.addEventListener('click', (e) => {
      e.preventDefault();
      authFlow.logout();
    });
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
    cachedRoles = payload.roles || [];
    const isAdmin = cachedRoles.includes('system.admin');

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
