# Bintelx Frontend Development Guide

This guide outlines the core principles and best practices for developing frontend components and applications within the Bintelx framework. Adhering to these guidelines ensures consistency, maintainability, performance, and scalability across the entire platform.

## 1. Core Development Philosophy

The Bintelx frontend framework is built upon a set of fundamental principles designed to leverage modern web standards and foster robust, predictable, and maintainable code.

*   **Standards First & Native Priority:** Always prioritize native, "vanilla" technologies and established web standards (W3C, IETF RFCs). Propose solutions that leverage the browser's built-in capabilities (e.g., native HTML5 elements like `<dialog>`, `<details>`, History API, Fetch API, Web Components, CSS Custom Properties). Avoid heavy, opinionated frameworks unless there is a compelling, explicitly justified reason.

*   **Simplicity and Robustness:** Architectures should be simple, robust, and maintainable. Prefer clear, standard code over complex or "magical" abstractions.

*   **Stateless and Secure:** Client-side applications must be stateless. All persistent application state should be managed by a backend and accessed via well-defined APIs. Authentication must be handled via tokens (e.g., Bearer Tokens).

*   **Decoupling and Source Agnosticism:** Components and functions should be designed to be agnostic of their data source. Rendering logic (which takes data and produces UI) must be separate from data-fetching logic (which gets data from a file, a REST API, or a WebSocket). This ensures components are highly reusable and testable.

## 2. HTML Guidelines: Semantics, Simplicity, and Accessibility

Our HTML code must be semantic, minimal, and accessible. Avoid creating unnecessary `<div>` elements.

### 2.1. Semantic HTML Structure

Always use the most appropriate HTML5 semantic tags for the content. This improves readability, accessibility, and SEO.

*   Use `<header>`, `<main>`, `<footer>`, `<nav>`, `<aside>`, `<section>`, `<article>` to structure your main content areas.
*   For forms, use `<form>`, `<fieldset>`, and `<legend>`.
*   For collapsible content, prefer native `<details>` and `<summary>`.
*   For dialogues, leverage the native `<dialog>` element.
*   For popovers, use the native `popover` attribute on elements, often triggered by buttons with `popovertarget`.

**Example Concepts:**

```html
<!-- Good: Semantic structure for a form with sections -->
<form>
    <aside>...</aside>
    <main>
        <section>
            <fieldset>
                <legend>Basic Information</legend>
                <label for="input">Label</label>
                <input id="input" type="text">
            </fieldset>
        </section>
        <section>
            <details>
                <summary>Collapsible Section</summary>
                <div>Content</div>
            </details>
        </section>
    </main>
</form>

<!-- Good: Native dialog example -->
<dialog id="my-dialog">...</dialog>
```

### 2.2. Minimize DOM Elements

Avoid excessive `<div>` or `<span>` elements solely for styling. Whenever possible, apply styles directly to semantic elements or use CSS layouts (like Flexbox or Grid) to achieve complex designs with minimal markup. The goal is to control appearance via CSS, not through deeply nested HTML.

**Bad Example (Excessive nesting for styling):**

```html
<div class="wrapper">
    <div class="card-container">
        <div class="title-section">
            <h1>My Title</h1>
        </div>
    </div>
</div>
```

**Good Example (CSS-driven layout):**

```html
<main class="wrapper">
    <div class="card">
        <h1>My Title</h1>
    </div>
</main>
```

*(Here, CSS properties on `.wrapper` and `.card` define the layout and appearance, minimizing extra divs.)*

### 2.3. Accessibility (A11y)

Prioritize accessibility from the ground up.

*   Use `<label>` elements explicitly associated with form controls using the `for` attribute.
*   Provide meaningful `alt` text for images.
*   Use `aria` attributes only when native HTML semantics are insufficient and always with a clear understanding of their purpose.
*   Ensure interactive elements are keyboard-operable and have clear focus states.

## 3. CSS Guidelines: Control Layout with Style

CSS is the primary tool for controlling layout and visual presentation.

### 3.1. CSS-First Layout

Design layouts primarily using CSS properties (Flexbox, Grid, etc.) rather than relying on complex nested HTML structures. This keeps your HTML clean and semantically focused.

### 3.2. CSS Custom Properties (Variables)

Utilize CSS Custom Properties (variables) for design tokens (colors, spacing, fonts, etc.) to ensure consistency and easy theming across the application. These should be defined in `global.css` and used throughout component-specific CSS.

**Example:**

```css
/* In src/assets/css/global.css */
:root {
    --color-primary: #007bff;
    --spacing-4: 1rem;
    --font-family-sans: 'Inter', sans-serif;
}

/* In component CSS (e.g., src/apps/demo/form.css or src/bnx/components/stepper/stepper.css) */
.button-primary {
    background-color: var(--color-primary);
    padding: var(--spacing-4);
    font-family: var(--font-family-sans);
}
```

### 3.3. Naming Conventions

Adopt a consistent naming convention for CSS classes (e.g., BEM - Block-Element-Modifier, or a similar utility-first approach combined with component-based naming). This improves readability and maintainability.

**Example (BEM-inspired):**

```css
/* .collapsible-item__summary-content */
.collapsible-item { /* base style for the block */ }
.collapsible-item__summary-content { /* style for an element within the block */ }
.collapsible-item--expanded { /* modifier for a specific state */ }
```

### 3.4. Styling Native Elements

Embrace and style native HTML elements (`<button>`, `<input>`, `<select>`, `<dialog>`, `<details>`) directly. Avoid replacing them with custom `<div>`-based elements that try to mimic their behavior. Style them to match the Bintelx design system.

## 4. JavaScript Guidelines: Vanilla, Modular, and Asynchronous

Our JavaScript code should be lean, efficient, and built with modern browser APIs.

### 4.1. Vanilla JS & Browser APIs

Avoid introducing heavy third-party frameworks or libraries unless absolutely necessary and justified. Prioritize native browser APIs (`fetch`, `Custom Elements`, `History API`, etc.).

### 4.2. Web Components for Reusability

For reusable UI components, leverage Web Components (Custom Elements and Shadow DOM). This provides true encapsulation of HTML, CSS, and JavaScript, preventing style conflicts and promoting component reusability across the application. The `<bnx-stepper>` component is a prime example of this approach.

### 4.3. Asynchronous Operations

Modern web development is inherently asynchronous. Design your JavaScript code to handle asynchronous operations gracefully using `Promises` and `async/await`. This applies to API calls (`api.js`), dynamic module loading (`loader.js`), and component lifecycle events.

### 4.4. Decoupling Logic

Separate your concerns:
*   **UI Logic:** How components interact with the DOM and user input.
*   **Data Fetching Logic:** How data is retrieved from APIs or other sources.
*   **Business Logic:** Core application rules.

This separation enhances testability and maintainability.

### 4.5. State Management

Client-side state should be kept minimal and transient. For persistent application state, rely on the backend APIs. For transient UI state within a component (e.g., current step in a stepper, form input values), manage it within the component instance.

### 4.6. Defensive Programming

*   **Error Handling:** Implement robust `try...catch` blocks for all asynchronous operations and potential failure points.
*   **Input Validation:** Validate user input on the client-side for immediate feedback, but always re-validate on the server.
*   **Internal Naming:** Prefix internal properties and methods with an underscore (`_`) to avoid conflicts with native `HTMLElement` properties (e.g., `this._componentPrefix`).

### 4.7. Module Structure and Data Flow

All application and component JavaScript modules should follow a consistent structure for receiving their context and data.

*   **Default Export Function:** Each module should export `default function(container, data) { ... }`.
*   **`container`**: This is the `HTMLElement` into which the module's associated template has been rendered. All `querySelector` calls within the module should be scoped to this `container` to ensure modularity and prevent unintended side effects on other parts of the DOM.
*   **`data`**: This object holds any contextual information or callbacks passed from the calling module.

**Example (Conceptual):**

```javascript
// A typical module structure
export default function(containerElement, dataFromParent) {
    // All DOM queries should be scoped to containerElement
    const myButton = containerElement.querySelector('.my-button');

    myButton.addEventListener('click', () => {
        // Use data from parent, e.g., trigger a callback
        if (dataFromParent.someCallback) {
            dataFromParent.someCallback('hello');
        }
    });

    // Example of a data update callback for a nested component
    if (dataFromParent.updateStepDataCallback) {
        dataFromParent.updateStepDataCallback({ myInputValue: 'some value' });
    }
}
```

## 5. Module Loading Strategy (`loader.js`)

The framework provides a centralized `loader.js` for dynamic module and content injection, promoting consistency and reducing boilerplate.

### 5.1. `loadComponent(modulePath, targetSelector, data)`

*   **Purpose:** Designed for loading higher-level "app" modules or significant UI sections into a target element within the Light DOM (the main document body).
*   **Conventions:** Expects `modulePath` to point to a directory that contains `index.tpls` and `index.js`.
*   **Usage:** Used by the router (`router.js`) to load primary application views, or by core services (`auth.js`) to load main overlay components.

### 5.2. `loadContentIntoElement(config, targetElement, data)`

*   **Purpose:** A more flexible utility for loading specific HTML templates (`.tpls`) and their associated JavaScript (`.js`) into any specified `HTMLElement`. This includes elements within a Shadow DOM.
*   **Conventions:** Expects `config.templatePath` and `config.scriptPath` to be full, explicit paths from the project `apps`. It does not assume an `index` file convention.
*   **Usage:** Ideal for components that manage their own internal content dynamically, such as the Stepper Web Component loading its individual steps. The `targetElement` is directly provided, allowing injection into isolated DOM trees like Shadow DOMs.

**Example (Conceptual use in `auth.js`):**

```javascript
// auth.js loading the login app into an overlay
loadContentIntoElement(
    {
        templatePath: 'src/apps/_auth/two-step-login.tpls',
        scriptPath: 'src/apps/_auth/two-step-login.js'
    },
    formContainerElement, // A div element in the overlay
    { onSuccess: handleSuccessfulLogin } // Data passed to the login app's script
);
```

## 6. File Structure and Naming Conventions

Maintain a consistent and logical file structure to promote discoverability and organization.

*   **Modular Organization:** Group related files for a component or application feature within their own directories (e.g., `src/apps/_auth/two-step-login/`, `src/bnx/components/stepper/`).
*   **Standard Extensions:**
    *   `.tpls` for HTML templates.
    *   `.js` for JavaScript logic.
    *   `.css` for component-specific styles.
*   **`index` Files:** Use `index.js`, `index.tpls`, `index.css` as entry points for modules or components where applicable (e.g., `src/apps/layout/navigation/index.js`). Otherwise, use descriptive names matching the module (e.g., `two-step-login.tpls`).