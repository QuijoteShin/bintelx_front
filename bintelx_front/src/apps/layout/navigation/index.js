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
    const html = routes.map(r => {
      const label = r.label || r.path;
      return `<li class="bx-nav__item"><a href="${r.path}">${label}</a></li>`;
    }).join('');
    list.innerHTML = html + `<li class="bx-nav__item bx-nav__logout"><button id="bx-logout">Cerrar sesión</button></li>`;

    const btnLogout = list.querySelector('#bx-logout');
    btnLogout?.addEventListener('click', (e) => {
      e.preventDefault();
      authFlow.logout();
    });
  };

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
