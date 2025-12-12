import { api } from '../../../bnx/api.js';
import { devlog } from '../../../bnx/utils.js';
import { authFlow } from '../../../bnx/auth.js';
import { localRoutesHint } from '../../../bnx/router.js';
import './index.css';

export default async function(container) {
  const list = container.querySelector('#bx-nav-list');

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
        const isActive = window.location.hash.includes(r.path) ? 'is-active' : '';
        return `<li class="bx-nav__item ${isActive}"><a href="${r.path}">${r.label || r.path}</a></li>`;
      } else {
        // Has submenu
        const parentLabel = items[0].parent_label || parent;
        const isActive = items.some(r => window.location.hash.includes(r.path)) ? 'is-active' : '';

        const submenuItems = items.map(r => {
          const subActive = window.location.hash.includes(r.path) ? 'is-active' : '';
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

  try {
    const res = await api.post('/navigation', { action: 'fetch', local_routes: localRoutesHint });
    const payload = res?.d || {};
    const routes = payload.routes || [];
    const configured = payload.configured ?? false;
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
