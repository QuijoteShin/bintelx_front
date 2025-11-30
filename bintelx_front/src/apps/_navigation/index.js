import { api } from '../../bnx/api.js';
import { renderTemplate, devlog } from '../../bnx/utils.js';
import navRoutes from './routes.json';
import { renderChips } from '../../bnx/components/chips.js';
import './index.css';

export default async function(container) {
  const routesBody = container.querySelector('#routes-body');
  const unconfBody = container.querySelector('#unconfigured-body');
  const btnRefresh = container.querySelector('#btn-refresh');
  const btnSync = container.querySelector('#btn-sync');
  const btnSaveConfig = container.querySelector('#btn-save-config');

  const scopes = ['write', 'read', 'private', 'public'];
  const nextScope = (scope) => {
    const idx = scopes.indexOf(scope);
    if (idx === -1) return 'write';
    return scopes[(idx + 1) % scopes.length];
  };

  const getChipClass = (role) => {
    if (role === 'system.admin') return 'bx-chip--danger';
    if (role === 'write') return 'bx-chip--write';
    if (role === 'read') return 'bx-chip--read';
    if (role === 'private') return 'bx-chip--private';
    if (role === 'public' || role === 'public-write') return 'bx-chip--public';
    if (!role) return 'bx-chip--muted';
    return 'bx-chip--primary';
  };

  const renderRows = (tbody, rows, allowEdit = false) => {
    if (!rows || !rows.length) {
      tbody.innerHTML = '<tr><td colspan="4">Sin datos</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => {
      const label = r.label || r.path;
      const group = r.group || '';
      const roles = r.required_roles || [];
      const rolesJson = JSON.stringify(roles);
      return `
        <tr data-path="${r.path}" data-label="${label}" data-group="${group}" data-roles='${rolesJson}'>
          <td>${r.path}</td>
          <td>${label}</td>
          <td>${group}</td>
          <td>
            <div class="bx-chips" data-chip-holder></div>
            ${allowEdit ? `<div class="role-add"><input type="text" placeholder="rol nuevo" class="role-input" /><button class="btn add-role">+</button></div>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr').forEach(tr => {
      const holder = tr.querySelector('[data-chip-holder]');
      const roles = tr.dataset.roles ? JSON.parse(tr.dataset.roles) : [];
      const rerender = (updated) => {
        tr.dataset.roles = JSON.stringify(updated);
        renderChips(holder, updated, {
          getClass: (item) => getChipClass(item.scope),
          getLabel: (item) => item.role || String(item),
          onClick: (item) => {
            if (item.role === 'system.admin') return; // no cycle for sysadmin
            const current = tr.dataset.roles ? JSON.parse(tr.dataset.roles) : [];
            const updatedList = current.map(r => {
              const roleVal = r.role || r;
              if (roleVal === (item.role || item)) {
                return { role: roleVal, scope: nextScope(item.scope || 'write') };
              }
              return r;
            });
            rerender(updatedList);
          },
          onRemove: (item) => {
            const next = (tr.dataset.roles ? JSON.parse(tr.dataset.roles) : []).filter(r => (r.role || r) !== (item.role || item));
            rerender(next);
          }
        });
      };
      rerender(roles);
      const addBtn = tr.querySelector('.add-role');
      const input = tr.querySelector('.role-input');
      if (addBtn && input) {
        const addRole = () => {
          const val = input.value.trim();
          if (!val) return;
          const current = tr.dataset.roles ? JSON.parse(tr.dataset.roles) : [];
          if (!current.find(r => (r.role || r) === val)) {
            current.push({ role: val, scope: 'write' });
            rerender(current);
          }
          input.value = '';
        };
        addBtn.addEventListener('click', addRole);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addRole();
          }
        });
      }
    });
  };

  const loadData = async () => {
    try {
      const res = await api.post('/navigation', { action: 'fetch', local_routes: navRoutes });
      const payload = res?.d || {};
      const configuredRoutes = payload.routes || [];
      const unconfigured = payload.unconfigured || [];
      renderRows(routesBody, configuredRoutes, true);
      renderRows(unconfBody, unconfigured, true);
      btnSync.disabled = !unconfigured.length;
      btnSync.title = unconfigured.length ? '' : 'No hay rutas locales pendientes';
      btnSaveConfig.disabled = configuredRoutes.length === 0;
      btnSaveConfig.title = configuredRoutes.length ? '' : 'Sin rutas configuradas';
    } catch (e) {
      devlog('Error cargando navegación', e);
      routesBody.innerHTML = '<tr><td colspan="4">Error al cargar rutas</td></tr>';
      unconfBody.innerHTML = '<tr><td colspan="4">Error al cargar rutas</td></tr>';
      btnSync.disabled = true;
      btnSaveConfig.disabled = true;
    }
  };

  const collectRows = (tbody) => Array.from(tbody.querySelectorAll('tr[data-path]')).map(tr => {
    const path = tr.dataset.path;
    const label = tr.dataset.label;
    const group = tr.dataset.group;
    const required_roles = tr.dataset.roles ? JSON.parse(tr.dataset.roles) : [];
    return { path, label, group, required_roles };
  });

  const syncUnconfigured = async () => {
    try {
      const rows = collectRows(unconfBody);
      await api.post('/navigation', { action: 'save', routes: rows, replace: false });
      await loadData();
      alert('Rutas guardadas en backend');
    } catch (e) {
      alert('Error al guardar navegación (requiere sysadmin)');
      devlog('sync error', e);
    }
  };

  const saveConfigured = async () => {
    try {
      const rows = collectRows(routesBody);
      await api.post('/navigation', { action: 'save', routes: rows, replace: false });
      await loadData();
      alert('Rutas configuradas guardadas');
    } catch (e) {
      alert('Error al guardar rutas configuradas (sysadmin requerido)');
      devlog('save configured error', e);
    }
  };

  btnRefresh?.addEventListener('click', loadData);
  btnSync?.addEventListener('click', syncUnconfigured);
  btnSaveConfig?.addEventListener('click', saveConfigured);

  loadData();
}
