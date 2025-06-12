// /src/bnx/router.js
import { renderTemplate } from './utils.js';
import { config } from '../config.js';
const routes = __ROUTES__;
const appContainer = document.getElementById('app');

/**
 * [NEW SYSTEM] Loads an application based on a route object from __ROUTES__.
 * @param {object} route - The route object from __ROUTES__.
 * @param {object} [params={}] - The dynamic parameters extracted from the URL.
 */
async function loadApp(route, params = {}) {
  if (!appContainer) {
    console.error('Main application container #app not found.');
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

    if (logic) {
      logic(appContainer, { params });
    }
  } catch (error) {
    console.error(`Failed to load app: ${route.app}`, error);
    appContainer.innerHTML = '<h2>404 - Page Not Found</h2><p>Could not load the application module.</p>';
  }
}

/**
 * Loads an application by convention from the URL path.
 * Example: A call to '/_demo/list' will try to load '../apps/_demo/list.js'.
 * @param {string} path - The URL path, like '/_demo/list'.
 */
async function loadAppByConvention(path) {
  // remove leading slash, e.g. /_demo/list -> _demo/list
  const modulePath = path.substring(1);

  if (!modulePath) {
    throw new Error("Convention-based routing cannot handle the root path.");
  }

  appContainer.innerHTML = config.appContainer.loading;

  // The .js file is mandatory for a page to exist by convention.
  const { default: logic } = await import(`../apps/${modulePath}.js`);

  // The template file (.tpls) is optional.
  let template = '<div></div>'; // Use an empty div if no template is found.
  try {
    const tplModule = await import(`../apps/${modulePath}.tpls`);
    template = tplModule.default;
  } catch (e) {
    console.warn(`No template found for convention-based route: ${modulePath}.tpls. This may be expected.`);
  }

  const renderedHtml = renderTemplate(template, {}); // No params in this system
  appContainer.innerHTML = renderedHtml;

  if (logic) {
    logic(appContainer, {});
  }
}


/**
 * Finds a matching route from the __ROUTES__ variable.
 * @param {string} currentPath - The current URL path.
 * @returns {object|null} An object with the matched route and params, or null.
 */
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
 * Main function to handle route changes with fallback logic.
 */
async function handleRouteChange() {
  let path = window.location.pathname;

  if (path === '/') {
    path = config.defaultRoute || '/';
    history.replaceState(null, '', path);
  }

  const match = findMatchingRoute(path);

  if (match) {
    // Priority 1: Use the new system if a route is defined in a routes.json
    loadApp(match.route, match.params);
  } else {
    // Priority 2: Fallback to the old convention-based system
    try {
      await loadAppByConvention(path);
    } catch (error) {
      // If both systems fail, then it's a 404.
      appContainer.innerHTML = '<h2>404 - Page Not Found</h2>';
      console.warn(`No route found for path: ${path}. Failed both route.json and convention-based lookup.`);
      console.error(error); // Log the error for debugging.
    }
  }
}

/**
 * Initializes the router.
 */
export function initRouter() {
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

  handleRouteChange();
}