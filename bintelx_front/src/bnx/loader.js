// src/bnx/loader.js

import { renderTemplate } from './utils.js'; // Asumo que renderTemplate ya está importado

/**
 * Dynamically loads a template (.tpls) and its associated script (.js) into a target HTML element.
 * This function is designed to be flexible, allowing loading into any DOM element,
 * including elements within a Shadow DOM.
 * * @param {Object} config - Configuration object for the content to load.
 * @param {string} config.templatePath - The full path to the .tpls file (e.g., 'src/apps/_auth/login/step1.tpls').
 * @param {string} [config.scriptPath] - The full path to the .js file.
 * @param {HTMLElement} targetElement - The element into which the content should be loaded (e.g., a div inside Stepper's Shadow DOM).
 * @param {Object} [data={}] - Optional data object to pass to the script's default export function.
 * Expected to contain `stepData` and `updateStepDataCallback` for Stepper.
 * @returns {Promise<void>}
 */
export async function loadContentIntoElement(config, targetElement, data = {}) {
    if (!targetElement) {
        console.error(`[loadContentIntoElement] Target element is null or undefined. Cannot load content.`);
        return;
    }
    if (!config.templatePath) {
        console.error(`[loadContentIntoElement] config.templatePath is required to load content.`);
        // No return, might proceed with empty template if script is primary
    }

    try {
        let templateHtml = '';
        if (config.templatePath) {
            // Fetch the template using its full path
            const templateResponse = await fetch(`/${config.templatePath}`);
            if (!templateResponse.ok) {
                throw new Error(`Failed to load template from ${config.templatePath}: ${templateResponse.statusText}`);
            }
            templateHtml = await templateResponse.text();
        }
        
        // Render the template into the target element.
        // Assumes renderTemplate is available and handles data injection.
        targetElement.innerHTML = renderTemplate(templateHtml, data); 

        // Execute the module's logic if a script path is provided.
        // Dynamic import paths are resolved relative to the importing module's URL.
        // By using an absolute path (`/${config.scriptPath}`), we ensure consistency.
        if (config.scriptPath) {
            const module = await import(`/${config.scriptPath}`);
            if (module.default && typeof module.default === 'function') {
                // Pass the targetElement (the step's container), previous step data, and update callback.
                // This aligns with how Stepper.js currently passes these.
                module.default(targetElement, data.stepData || {}, data.updateStepDataCallback);
            } else {
                console.warn(`[loadContentIntoElement] Script for ${config.scriptPath} has no default export function.`);
            }
        }
    } catch (error) {
        console.error(`[loadContentIntoElement] Error loading content for path ${config.templatePath || config.scriptPath}:`, error);
        targetElement.innerHTML = `<p style="color:red;">Error loading content.</p>`;
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
    // Refactorizar esto para usar loadContentIntoElement si la estructura de `modulePath` lo permite,
    // o mantenerlo separado si tienen propósitos y convenciones muy distintas.
    // Por ahora, lo dejamos como estaba y añadimos la nueva función.
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
        console.error(`[loadComponent] Failed to load module "${modulePath}" into "${targetSelector}".`, error);
        targetElement.innerHTML = `<p style="color:red;">Error loading component: ${modulePath}</p>`;
    }
}