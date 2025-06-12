// /src/bnx/loader.js
import { renderTemplate } from './utils.js';

/**
 * Dynamically loads a component (template and logic) into a specified DOM element.
 * @param {string} modulePath - The path to the module directory (e.g., 'layout/navigation').
 * @param {string} targetSelector - The CSS selector for the target element.
 * @param {object} [data={}] - Optional data to pass to the template.
 * @returns {Promise<void>}
 */
export async function loadComponent(modulePath, targetSelector, data = {}) {
    const targetElement = document.querySelector(targetSelector);
    if (!targetElement) {
        console.error(`[loadComponent] Target element "${targetSelector}" not found.`);
        return;
    }

    try {
        // Assume all modules follow the 'index.tpls' and 'index.js' convention inside their directory.
        const [template, { default: logic }] = await Promise.all([
            import(`../apps/${modulePath}/index.tpls`).then(m => m.default),
            import(`../apps/${modulePath}/index.js`)
        ]);

        // Render the template with the provided data
        const renderedHtml = renderTemplate(template, data);
        targetElement.innerHTML = renderedHtml;

        // Execute the module's logic if it exists
        if (logic) {
            logic(targetElement, data);
        }
    } catch (error) {
        console.error(`[loadComponent] Failed to load module "${modulePath}" into "${targetSelector}".`, error);
        targetElement.innerHTML = `<p style="color:red;">Error loading component: ${modulePath}</p>`;
    }
}