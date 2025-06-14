// src/bnx/utils.js

import { config } from '../config.js';
const MODE_IN = __MODE_IN__;

/**
 * A basic HTML sanitizer to prevent XSS.
 */
function sanitize(str) {
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

/**
 * A collection of helper functions available inside all templates.
 */
const templateHelpers = {
  formatDate: (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(config.defaultLocale, { year: 'numeric', month: 'short', day: 'numeric' });
  },
  truncate: (text, length = 50) => {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  },
  capitalize: (text) => {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
};


/**
 * Renders a template string with the provided data and helper functions.
 * @param {string} templateString - The raw template string (from a .tpls file).
 * @param {object} data - The data to inject into the template.
 * @returns {string} The rendered HTML string.
 */
export function renderTemplate(templateString, data = {}) {
  // Sanitize all string values in the data object before rendering
  const sanitizedData = {};
  for (const key in data) {
    if (typeof data[key] === 'string') {
      sanitizedData[key] = sanitize(data[key]);
    } else {
      sanitizedData[key] = data[key];
    }
  }

  // Create a context that includes both the data and our helper functions
  const context = { ...sanitizedData, h: templateHelpers };

  const keys = Object.keys(context);
  const values = Object.values(context);

  try {
    // Note: Using new Function() is safer than eval(), but still requires trusted template strings.
    const templateFunction = new Function(...keys, `return \`${templateString}\`;`);
    return templateFunction(...values);
  } catch (e) {
    console.error("Error rendering template:", e);
    return "<p>Error: Could not render content.</p>";
  }
}

/**
 * Displays a message in the console only if the application is in development mode.
 * This function does nothing in the production build.
 * @param {any} message - The message or data to display in the console.
 * @param {string} [mode='log'] - The console method to use ('log', 'warn', 'error', 'table', 'info', etc.).
 */
export function devlog(message, mode = 'log') {
  if(MODE_IN === 'production') {
    return;
  }

  if (typeof console[mode] === 'function') {
    console[mode](message);
  } else {
    // Si el modo no es válido, usamos console.log como fallback.
    console.log(`[devlog] Invalid mode '${mode}'. Falling back to 'log'.`);
    console.log(message);
  }
}