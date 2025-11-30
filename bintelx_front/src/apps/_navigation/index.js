import { api } from '../../bnx/api.js';
import { renderTemplate, devlog } from '../../bnx/utils.js';
import navRoutes from './routes.json';
import { localRoutesHint } from '../../bnx/router.js';
import { renderChips } from '../../bnx/components/chips.js';
import './index.css';

export default async function(container) {
  const routesBody = container.querySelector('#routes-body');
  const unconfBody = container.querySelector('#unconfigured-body');
  const btnRefresh = container.querySelector('#btn-refresh');
  const btnSync = container.querySelector('#btn-sync');
  const btnSaveConfig = container.querySelector('#btn-save-config');
  const btnAddRoute = container.querySelector('#btn-add-route');
  const inputNewPath = container.querySelector('#new-path');
  const inputNewLabel = container.querySelector('#new-label');
  const inputNewGroup = container.querySelector('#new-group');
  const inputNewApp = container.querySelector('#new-app');
  const inputNewModule = container.querySelector('#new-module');
  const inputNewRole = container.querySelector('#new-role');
  const selectNewScope = container.querySelector('#new-scope');

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
      const app = r.app || '';
      const moduleName = r.moduleName || '';
      const roles = r.required_roles || [];
      const rolesJson = JSON.stringify(roles);
      return `
        <tr data-path="${r.path}" data-label="${label}" data-group="${group}" data-app="${app}" data-module="${moduleName}" data-roles='${rolesJson}'>
          <td>${r.path}</td>
          <td>${label}</td>
          <td>${group || app || moduleName}</td>
          <td>
            <div class="bx-chips" data-chip-holder></div>
            ${allowEdit ? `<div class="role-add"><input type="text" placeholder="rol nuevo" class="role-input" /><button class="btn add-role">+</button><button class="btn remove-route">Eliminar</button></div>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr').forEach(tr => initRow(tr, allowEdit));
  };

  const loadData = async () => {
    try {
      const res = await api.post('/navigation', { action: 'fetch', local_routes: localRoutesHint });
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
    const app = tr.dataset.app || '';
    const moduleName = tr.dataset.module || '';
    const required_roles = tr.dataset.roles ? JSON.parse(tr.dataset.roles) : [];
    return { path, label, group, app, moduleName, required_roles };
  });

  const addNewRoute = () => {
    const path = (inputNewPath?.value || '').trim();
    if (!path) {
      alert('Path es requerido');
      return;
    }
    const label = (inputNewLabel?.value || '').trim() || path;
    const group = (inputNewGroup?.value || '').trim() || '';
    const app = (inputNewApp?.value || '').trim() || '';
    const moduleName = (inputNewModule?.value || '').trim() || '';
    const roleVal = (inputNewRole?.value || '').trim();
    const scopeVal = selectNewScope?.value || 'write';
    const required_roles = roleVal ? [{ role: roleVal, scope: scopeVal }] : [];
    const existingPaths = new Set([
      ...collectRows(routesBody).map(r => r.path),
      ...collectRows(unconfBody).map(r => r.path),
      ...localRoutesHint.map(r => r.path)
    ]);
    if (existingPaths.has(path)) {
      alert('La ruta ya existe en navegación o locales');
      return;
    }
    const newRoute = { path, label, group, app, moduleName, required_roles };
    appendRow(routesBody, newRoute, true);
    btnSaveConfig.disabled = false;
    if (inputNewPath) inputNewPath.value = '';
    if (inputNewLabel) inputNewLabel.value = '';
    if (inputNewGroup) inputNewGroup.value = '';
    if (inputNewApp) inputNewApp.value = '';
    if (inputNewModule) inputNewModule.value = '';
    if (inputNewRole) inputNewRole.value = '';
    if (selectNewScope) selectNewScope.value = 'write';
  };

  const appendRow = (tbody, route, allowEdit) => {
    const label = route.label || route.path;
    const group = route.group || '';
    const app = route.app || '';
    const moduleName = route.moduleName || '';
    const rolesJson = JSON.stringify(route.required_roles || []);
    const rowHtml = `
      <tr data-path="${route.path}" data-label="${label}" data-group="${group}" data-app="${app}" data-module="${moduleName}" data-roles='${rolesJson}'>
        <td>${route.path}</td>
        <td>${label}</td>
        <td>${group}</td>
        <td>
          <div class="bx-chips" data-chip-holder></div>
          ${allowEdit ? `<div class="role-add"><input type="text" placeholder="rol nuevo" class="role-input" /><button class="btn add-role">+</button><button class="btn remove-route">Eliminar</button></div>` : ''}
        </td>
      </tr>
    `;
    tbody.insertAdjacentHTML('beforeend', rowHtml);
    initRow(tbody.lastElementChild, allowEdit);
  };

  const initRow = (tr, allowEdit) => {
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
        onRemove: allowEdit ? (item) => {
          const next = (tr.dataset.roles ? JSON.parse(tr.dataset.roles) : []).filter(r => (r.role || r) !== (item.role || item));
          rerender(next);
        } : undefined
      });
    };
    rerender(roles);
    if (allowEdit) {
      const addBtn = tr.querySelector('.add-role');
      const input = tr.querySelector('.role-input');
      const removeBtn = tr.querySelector('.remove-route');
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
      removeBtn?.addEventListener('click', () => {
        tr.remove();
        btnSaveConfig.disabled = false;
      });
    }
  };

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
      await api.post('/navigation', { action: 'save', routes: rows, replace: true });
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
  btnAddRoute?.addEventListener('click', addNewRoute);
  [inputNewPath, inputNewLabel, inputNewGroup, inputNewRole].forEach(inp => {
    inp?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addNewRoute();
      }
    });
  });

  loadData();
}
