import { api } from '../../bnx/api.js';
import { renderTemplate, devlog } from '../../bnx/utils.js';
import '../_navigation/index.css';

export default async function(container) {
  container.innerHTML = renderTemplate(`
    <div class="nav-admin">
      <h1>Roles & Accesos</h1>
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Roles del perfil actual</h2>
            <small>Fuente: /api/profile</small>
          </div>
          <button id="btn-refresh-roles" class="btn">Refrescar</button>
        </div>
        <ul id="roles-list"></ul>
      </section>
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Rutas y roles requeridos</h2>
            <small>Fuente: /api/navigation</small>
          </div>
        </div>
        <table class="nav-table">
          <thead><tr><th>Path</th><th>Label</th><th>Roles requeridos</th></tr></thead>
          <tbody id="roles-routes-body"><tr><td colspan="3">Cargando...</td></tr></tbody>
        </table>
      </section>
    </div>
  `, {});

  const rolesList = container.querySelector('#roles-list');
  const routesBody = container.querySelector('#roles-routes-body');
  const btnRefresh = container.querySelector('#btn-refresh-roles');

  const renderRoles = (roles) => {
    if (!roles || !roles.length) {
      rolesList.innerHTML = '<li>Sin roles asignados</li>';
      return;
    }
    rolesList.innerHTML = roles.map(r => `<li>${r}</li>`).join('');
  };

  const renderRoutes = (routes) => {
    if (!routes || !routes.length) {
      routesBody.innerHTML = '<tr><td colspan="3">Sin rutas configuradas</td></tr>';
      return;
    }
    routesBody.innerHTML = routes.map(r => {
      const req = (r.required_roles || []).join(', ');
      return `<tr><td>${r.path}</td><td>${r.label || r.path}</td><td>${req || '—'}</td></tr>`;
    }).join('');
  };

  const load = async () => {
    try {
      const prof = await api.get('/profile');
      const pdata = prof?.d?.data || prof?.d || prof;
      renderRoles(pdata.roles || []);
    } catch (e) {
      rolesList.innerHTML = '<li>Error al cargar roles</li>';
    }
    try {
      const nav = await api.post('/navigation', { action: 'fetch' });
      const nd = nav?.d || {};
      renderRoutes(nd.routes || []);
    } catch (e) {
      routesBody.innerHTML = '<tr><td colspan="3">Error al cargar rutas</td></tr>';
    }
  };

  btnRefresh?.addEventListener('click', load);
  load();
}
