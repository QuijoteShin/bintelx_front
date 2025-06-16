// src/bnx/loader.js

import { renderTemplate } from './utils.js';

/**
 * Dynamically loads a template (.tpls) and its associated script (.js) into a target HTML element.
 * This function is designed to be flexible, allowing loading into any DOM element,
 * including elements within a Shadow DOM.
 * * @param {Object} config - Configuration object for the content to load.
 * @param {string} config.templatePath - The full path to the .tpls file (e.g., 'src/apps/_auth/login/step1.tpls').
 * @param {string} [config.scriptPath] - The full path to the .js file.
 * @param {HTMLElement} targetElement - The element into which the content should be loaded (e.g., a div inside Stepper's Shadow DOM).
 * @param {Object} [data={}] - Optional data object to pass to the script's default export function.
 * @returns {Promise<void>}
 */
export async function loadContentIntoElement(config, targetElement, data = {}) {
  if(typeof targetElement === 'string') {
    targetElement = document.querySelector(targetElement);
    devlog(`[loadContentIntoElement] Target element is string. Loading selector.`);
  }

  if (!targetElement) {
    devlog(`[loadContentIntoElement] Target element is null or undefined. Cannot load content.`);
    return;
  }
  if (!config.templatePath) {
    devlog(`[loadContentIntoElement] config.templatePath is required to load content.`);
    // proceed with empty template if script is primary
  }

  try {
    let templateHtml  = ''
    let runLogic      = null;
     if (config.templatePath?.length > 1 && config.scriptPath) {
       const [template, { default: logic }] = await Promise.all([
            import(`../apps/${config.templatePath}`).then(m => m.default),
            import(`../apps/${config.scriptPath}`)
       ]);
       templateHtml = template;
       runLogic = logic;
     }
      else if (config.templatePath?.length > 1 && config.scriptPath.length < 1) {
      const [template, { default: logic }] = await Promise.all([
        import(`../apps/${config.templatePath}`).then(m => m.default),
      ]);
       templateHtml = template;
       runLogic = logic;
     }
     if(!templateHtml) {
       templateHtml = '<section></section>';
     }
     targetElement.innerHTML = renderTemplate(templateHtml, data);
     if (runLogic) {
          runLogic(targetElement, data);
     }

  } catch (error) {
    console.error(`[loadContentIntoElement] Error loading content for path ${config.templatePath || config.scriptPath}:`, error);
    targetElement.innerHTML = `<p class="text-error">Error loading content.</p>`;
  }
}


/**
 * Carga un componente modular (plantilla + lógica), procesa la plantilla con datos
 * y ejecuta su script de inicialización.
 *
 * @param {string} modulePath - La ruta base al módulo del componente dentro de 'src/apps/'. (ej. '_users/list')
 * @param {string} targetSelector - El selector CSS del elemento que contendrá el componente.
 * @param {Object} [data={}] - Un objeto de datos para ser inyectado en la plantilla usando renderTemplate.
 * @returns {Promise<void>}
 */
export async function loadComponent(modulePath, targetSelector, data = {}) {
  const targetElement = document.querySelector(targetSelector);
  if (!targetElement) {
    console.error(`[loadComponent] Target element "${targetSelector}" not found.`);
    return;
  }
  // Assume all modules follow the 'index.tpls' and 'index.js' convention inside their directory.
  try {
    const [template, { default: logic }] = await Promise.all([
      import(`../apps/${modulePath}/index.tpls`).then(m => m.default),
      import(`../apps/${modulePath}/index.js`)
    ]);
    const renderedHtml = renderTemplate(template, data);
    targetElement.innerHTML = renderedHtml;
    if (logic) {
      logic(targetElement, data);
    }
  } catch (error) {
    devlog(`[loadComponent] Failed to load module "${modulePath}" into "${targetSelector}".`, error);
    targetElement.innerHTML = `<p class="text-error">Error loading component: ${modulePath}</p>`;
  }
}