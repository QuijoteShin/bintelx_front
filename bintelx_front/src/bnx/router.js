import { renderTemplate } from './utils.js';

const appContainer = document.getElementById('app');

/**
 * Dynamically loads a module (template, script, and CSS) based on a path.
 * @param {string} path - The module path (e.g., 'dashboard/index' or 'users/list').
 */
async function loadModule(path) {
  try {
    appContainer.innerHTML = '<h2>Loading...</h2>';

    // Dynamically import the module's files using convention
    const [template, { default: logic }, styles] = await Promise.all([
      import(`../apps/${path}.tpls`).then(m => m.default),
      import(`../apps/${path}.js`),
      import(`../apps/${path}.css`).then(m => m.default).catch(() => ''), // CSS is optional
    ]);

    // Render the template (no data for now, module logic will fetch it)
    const renderedHtml = renderTemplate(template);
    appContainer.innerHTML = renderedHtml;

    // If the module has logic, execute it, passing the container element
    if (logic) {
      logic(appContainer);
    }
  } catch (error) {
    console.error(`Failed to load module for path: ${path}`, error);
    appContainer.innerHTML = '<h2>404 - Page Not Found</h2><p>Could not load the requested module.</p>';
  }
}

/**
 * Parses the browser's URL path and determines which module to load.
 */
function handleRouteChange() {
  let path = window.location.pathname;

  // Default route
  if (path === '/') {
    path = '/dashboard/index';
  }

  // Remove leading slash for module path resolution
  const modulePath = path.substring(1);
  loadModule(modulePath);
}

/**
 * Initializes the router, sets up event listeners for navigation.
 */
export function initRouter() {
  // Listen for back/forward navigation
  window.addEventListener('popstate', handleRouteChange);

  // Handle initial page load
  document.addEventListener('DOMContentLoaded', () => {
    // Intercept clicks on local links to prevent full page reloads
    document.body.addEventListener('click', e => {
      if (e.target.matches('a[href^="/"]')) {
        e.preventDefault();
        history.pushState(null, '', e.target.href);
        handleRouteChange();
      }
    });

    handleRouteChange(); // Load the module for the initial URL
  });
}
