// src/bnx/router.js
import { renderTemplate, devlog } from './utils.js';
import { config } from '../config.js';
import { authFlow } from "./auth.js"; // Import the simplified authFlow
import { api } from './api.js';

const staticRoutes = __ROUTES__;
const appContainer = document.getElementById('app');
let cachedRoutes = null;
let cachedRoles = null;
export { staticRoutes as localRoutesHint };
const allowConvention = __ALLOW_CONVENTION_ROUTES__ !== false;

// --- helper Functions  ---
async function DOMDefaults(container) {
  const buttons = container.querySelectorAll('button:not([type])');
  buttons.forEach(button => {
    button.type = 'button';
  });
}
async function loadApp(route, params = {}) {
  if (!appContainer) {
    devlog('Main application container #app not found.', 'trace');
    return;
  }
  try {
    const appName = route.app;
    const moduleName = route.moduleName || 'index';
    const prefix = route.prefix || '';
    appContainer.innerHTML = config.appContainer.loading;
    let basePath = appName.split('-').join('/');
    const finalAppPath = prefix ? `${prefix}/${basePath}` : basePath;
    const [template, { default: logic }] = await Promise.all([
      import(`../apps/${finalAppPath}/${moduleName}.tpls`).then(m => m.default),
      import(`../apps/${finalAppPath}/${moduleName}.js`)
    ]);
    const renderedHtml = renderTemplate(template, { params });
    appContainer.innerHTML = renderedHtml;
    DOMDefaults(appContainer);
    if (logic) {
      logic(appContainer, { params });
    }
  } catch (error) {
    devlog(`Failed to load app: ${route.app}`, error, 'trace');
    appContainer.innerHTML = '<h2>404 - Page Not Found</h2><p>Could not load the application module.</p>';
  }
}
async function loadAppByConvention(path) {
  const modulePath = path.substring(1);
  if (!modulePath) {
    throw new Error("Convention-based routing cannot handle the root path.");
  }
  appContainer.innerHTML = config.appContainer.loading;
  const { default: logic } = await import(`../apps/${modulePath}.js`);
  let template = '<div></div>';
  try {
    const tplModule = await import(`../apps/${modulePath}.tpls`);
    template = tplModule.default;
  } catch (e) {
    devlog(`No template found for convention-based route: ${modulePath}.tpls. This may be expected.`, 'trace');
  }
  const renderedHtml = renderTemplate(template, {});
  appContainer.innerHTML = renderedHtml;
  DOMDefaults(appContainer);
  if (logic) {
    logic(appContainer, {});
  }
}
function findMatchingRoute(currentPath) {
  const activeRoutes = cachedRoutes || staticRoutes;
  for (const route of activeRoutes) {
    const paramNames = [];
    const pathRegex = new RegExp('^' + route.path.replace(/:(\w+)/g, (_, name) => {
      paramNames.push(name);
      return '([\\w-]+)';
    }) + '$');
    const match = currentPath.match(pathRegex);
    if (match) {
      const params = {};
      paramNames.forEach((name, index) => {
        params[name] = match[index + 1];
      });
      return { route, params };
    }
  }
  return null;
}

/**
 * Main function to handle route changes.
 */
async function handleRouteChange() {
  devlog(`--- Handling route change for: ${window.location.pathname} ---`);
  // Call the main auth function. It will handle showing the overlay if needed.
  const isAuthenticated = await authFlow.validate();
  // If not authenticated, authFlow has already shown the overlay. Stop processing.
  if (!isAuthenticated) {
    devlog('Authentication required. Halting route processing.');
    return;
  }

  // If authenticated, proceed to load the application.
  devlog('Authentication successful. Proceeding to load application.');

  // Load user roles and routes (once per session)
  if (!cachedRoles) {
    try {
      const profile = await api.get('/profile');
      const data = profile?.d?.data || profile?.d || profile;
      cachedRoles = data.roles || [];
    } catch (error) {
      devlog('No se pudieron obtener roles del perfil; se usarán rutas estáticas.', error);
      cachedRoles = [];
    }
  }

  if (!cachedRoutes) {
    cachedRoutes = await loadRoutesFromEndpoint(cachedRoles);
  }

  let path = window.location.pathname;

  if (path === '/') {
    path = config.defaultRoute || '/';
    history.replaceState(null, '', path);
  }

  const match = findMatchingRoute(path);

  if (match) {
    if (match.route.app) {
      loadApp(match.route, match.params);
    } else if (allowConvention) {
      await loadAppByConvention(path);
    } else {
      appContainer.innerHTML = '<h2>403 - Ruta no permitida</h2>';
    }
  } else {
    if (allowConvention) {
      try {
        await loadAppByConvention(path);
      } catch (error) {
        appContainer.innerHTML = '<h2>404 - Page Not Found</h2>';
        devlog(`Route not found: ${path}`, error, 'trace');
      }
    } else {
      appContainer.innerHTML = '<h2>404 - Page Not Found</h2>';
      devlog(`Route not found (convention disabled): ${path}`, 'trace');
    }
  }
}

/**
 * Initializes the router.
 */
export function initRouter() {
  devlog('Initializing router...');
  window.addEventListener('popstate', handleRouteChange);

  document.body.addEventListener('click', e => {
    const anchor = e.target.closest('a');
    if (!anchor || !anchor.href) {
      return;
    }
    if (anchor.pathname === window.location.pathname && anchor.hash) {
      return;
    }
    if (anchor.host === window.location.host) {
      e.preventDefault();
      const newPath = anchor.pathname;
      if (newPath !== window.location.pathname) {
        history.pushState({ path: newPath }, '', newPath);
        handleRouteChange();
      }
    }
  });

  // Trigger the first route handling on initial page load.
  handleRouteChange();
}

async function loadRoutesFromEndpoint(userRoles = []) {
  const endpoint = (config.navEndpoint || '').trim();
  if (!endpoint) {
    return staticRoutes;
  }
  try {
    // Send local/static routes so backend knows what's available; action=fetch (read-only)
    const res = await api.post(endpoint, { action: 'fetch', local_routes: staticRoutes });
    const payload = res?.d || {};
    const remoteRoutes = payload.routes || [];
    const configured = payload.configured ?? false;
    const filtered = Array.isArray(remoteRoutes)
      ? remoteRoutes.filter(r => {
          const req = r.required_roles || [];
          if (!req.length) return true;
          if (userRoles.includes('system.admin')) return true;
          return req.some(x => userRoles.includes(x));
        })
      : staticRoutes;
    // If backend has no configured routes and returned empty, fall back to static/local
    if (!configured && filtered.length === 0) {
      return staticRoutes;
    }
    return filtered;
  } catch (e) {
    devlog('Fallo al cargar rutas desde NAV_ENDPOINT; usando estáticas.', e);
    return staticRoutes;
  }
}
