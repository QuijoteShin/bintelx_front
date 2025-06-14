// src/bnx/router.js
import { renderTemplate, devlog } from './utils.js';
import { config } from '../config.js';
import { authFlow } from "./auth.js"; // Import the simplified authFlow

const routes = __ROUTES__;
const appContainer = document.getElementById('app');

// --- Helper Functions (unchanged) ---
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
  for (const route of routes) {
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
  let path = window.location.pathname;

  if (path === '/') {
    path = config.defaultRoute || '/';
    history.replaceState(null, '', path);
  }

  const match = findMatchingRoute(path);

  if (match) {
    loadApp(match.route, match.params);
  } else {
    try {
      await loadAppByConvention(path);
    } catch (error) {
      appContainer.innerHTML = '<h2>404 - Page Not Found</h2>';
      devlog(`Route not found: ${path}`, error, 'trace');
    }
  }
}

/**
 * Initializes the router.
 */
export function initRouter() {
  devlog('Initializing router...');

  // REMOVED: The call to `authFlow.init()` is no longer needed.
  // The auth module is now self-contained.

  window.addEventListener('popstate', handleRouteChange);

  document.body.addEventListener('click', e => {
    const anchor = e.target.closest('a');
    if (anchor && anchor.href && anchor.host === window.location.host) {
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
