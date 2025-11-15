/* src/bnx/styles/globalStyles.js */
/**
 * Constructable Stylesheet for Shadow DOM components
 *
 * This file creates a reusable stylesheet that can be adopted by multiple
 * Shadow DOM components. It contains the essential base styles that components
 * need while relying on CSS Custom Properties (variables) that inherit from
 * the document's :root.
 *
 * Benefits:
 * - Single source of truth for component base styles
 * - Efficient memory usage (shared across all shadow roots)
 * - CSS variables automatically inherit through the shadow boundary
 * - Easy to maintain and update
 */

const baseStyles = `
/* --------------------------------------------------------------------------
   SHADOW DOM BASE STYLES
   These styles apply inside Shadow DOM components.
   CSS Custom Properties (--variables) automatically inherit from :root
-------------------------------------------------------------------------- */

/* Reset box-sizing for shadow content */
*, *::before, *::after {
    box-sizing: border-box;
}

/* Host element defaults */
:host {
    display: block;
    font-family: var(--font-family-sans);
    color: var(--color-text-primary);
    line-height: var(--line-height-normal);
}

/* Typography inside shadow */
h1, h2, h3, h4, h5, h6, legend {
    font-weight: var(--font-weight-semibold);
    line-height: var(--line-height-heading);
    margin: 0;
}

p {
    margin: 0;
    color: var(--color-text-secondary);
}

a {
    color: var(--color-text-link);
    text-decoration: none;
    font-weight: var(--font-weight-medium);
}
a:hover {
    text-decoration: underline;
}

/* Forms & Fieldsets */
form {
    display: flex;
    flex-direction: column;
    height: 100%;
}

fieldset {
    border: none;
    padding: 0;
    margin: 0;
    margin-bottom: var(--spacing-3);
}

legend {
    font-size: var(--text-size-lg);
    padding: 0;
    margin-bottom: var(--spacing-3);
    width: 100%;
}

/* Form Controls */
label {
    display: block;
    font-weight: var(--font-weight-medium);
    margin-bottom: var(--spacing-2);
}

input,
textarea,
select {
    display: block;
    width: 100%;
    padding: var(--spacing-2) var(--spacing-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    font-size: var(--text-size-base);
    background-color: var(--color-white);
    transition: border-color 150ms, box-shadow 150ms;
}

input:focus,
textarea:focus,
select:focus {
    outline: none;
    border-color: var(--color-brand-primary);
    box-shadow: 0 0 0 3px var(--color-primary-100);
}

::placeholder {
    color: var(--color-gray-300);
    opacity: 1;
}

/* Buttons */
button, .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2) var(--spacing-4);
    border-radius: var(--radius-md);
    font-weight: var(--font-weight-medium);
    text-decoration: none;
    border: 1px solid transparent;
    cursor: pointer;
    transition: background-color 150ms, border-color 150ms, color 150ms;
    user-select: none;
}

.button-primary {
    background-color: var(--color-brand-primary);
    color: var(--color-white);
    border-color: var(--color-brand-primary);
}
.button-primary:hover {
    background-color: var(--color-primary-600);
    border-color: var(--color-primary-600);
}

.button-secondary {
    background-color: var(--color-white);
    color: var(--color-text-secondary);
    border-color: var(--color-border-default);
}
.button-secondary:hover {
    background-color: var(--color-gray-50);
    border-color: var(--color-gray-700);
    color: var(--color-text-primary);
}

.link {
    background: none;
    border: none;
    color: var(--color-text-link);
    padding: 0;
}
.link:hover {
    text-decoration: underline;
}

/* Card component */
.card {
    background-color: var(--color-background-card);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-border-subtle);
    padding: var(--spacing-6);
    margin-bottom: var(--spacing-8);
}

/* Tables */
table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: var(--spacing-6);
    text-align: left;
}

th, td {
    padding: var(--spacing-3);
    border-bottom: 1px solid var(--color-border-subtle);
    vertical-align: top;
}

th {
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
}

/* Utility Classes */
.flow > * + * {
    margin-top: var(--spacing-6, 1.5rem);
}

.flex {
    display: flex;
}

.grow-1 {
    flex-grow: 1;
}

.unstyled {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    text-align: inherit;
    cursor: inherit;
}
`;

// Create the shared stylesheet
const globalStyleSheet = new CSSStyleSheet();
globalStyleSheet.replaceSync(baseStyles);

/**
 * Export the stylesheet to be adopted by Shadow DOM components
 *
 * Usage in a Web Component:
 *
 * import { globalStyleSheet } from '../../styles/globalStyles.js';
 *
 * class MyComponent extends HTMLElement {
 *   constructor() {
 *     super();
 *     const shadow = this.attachShadow({ mode: 'open' });
 *     shadow.adoptedStyleSheets = [globalStyleSheet];
 *   }
 * }
 */
export { globalStyleSheet };

/**
 * Helper function to combine global styles with component-specific styles
 *
 * @param {string} componentStyles - Component-specific CSS as a string
 * @returns {CSSStyleSheet[]} Array of stylesheets ready to be adopted
 *
 * Usage:
 *
 * import { createComponentStyles } from '../../styles/globalStyles.js';
 *
 * const styles = createComponentStyles(`
 *   .my-component-class {
 *     color: var(--color-primary-500);
 *   }
 * `);
 *
 * shadow.adoptedStyleSheets = styles;
 */
export function createComponentStyles(componentStyles) {
    const componentSheet = new CSSStyleSheet();
    componentSheet.replaceSync(componentStyles);
    return [globalStyleSheet, componentSheet];
}
