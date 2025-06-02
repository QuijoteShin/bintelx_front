# bintelx_front
ENTERPRISE BOILERPLATE  UI WITH UX IN MIND

This guide outlines a series of initial and iterative prompts to build your mobile-first Clinical Data Capture web application, keeping in mind the capabilities and interaction model of a design AI like Stitch or Canvas.

## I. Overarching Guiding Principles (For You, the Prompter)

Before you start prompting the design AI, internalize these core principles derived from your requirements and the Stitch guide:

1.  **One Major Change at a Time:** Each prompt should focus on a single, clear objective (e.g., define base layout, add a specific component, style one element type). Avoid bundling multiple distinct requests.
2.  **Be Explicit and Specific:** Clearly state *what* you want and *how* it should look or behave. Use UI/UX keywords (e.g., "navigation bar," "data table," "input field").
3.  **Mobile-First Always:** Continuously reinforce the mobile-first design philosophy in your prompts, especially when defining layouts or components.
4.  **Native Priority:** Remind the AI to prioritize native HTML elements, especially for inputs, and to avoid unnecessary `<div>` wrappers.
5.  **Iterate and Save:** After each successful prompt that yields a good result, consider it a checkpoint. If the AI has a "save" or "versioning" feature, use it. Mentally (or with screenshots), track your progress.
6.  **Reference Existing Elements:** When modifying, be precise (e.g., "the primary button on the patient entry form," "the header of the main data table").

## II. Initial Sequence of Prompts for the Design AI

This sequence aims to establish the foundational elements of your application.

### Phase 1: Core Foundation & Global Styles

* **Prompt 1: Project Initialization & Core Technology**
    ```
    Initialize a new web application project for 'Clinical Data Capture.'
    The application must be mobile-first.
    The frontend technology will be [Choose one: 'Vanilla JavaScript using ES6+ features and template strings for rendering' OR 'SvelteKit'].
    Tailwind CSS will be used for styling.
    Explicitly AVOID React, Vue.js, and Angular.
    ```

* **Prompt 2: Base Typography & Color Palette Intent**
    ```
    Set a clean and highly readable default sans-serif font for the entire application.
    For the color palette, aim for a professional, trustworthy, and accessible theme suitable for a clinical environment. Start with a predominantly neutral palette (e.g., whites, light grays) with a clear accent color for primary actions (e.g., a muted blue or green). Ensure high contrast for text and UI elements for accessibility.
    ```

* **Prompt 3: Native Input Styling Philosophy**
    ```
    Establish a global style for native HTML form inputs (<input>, <select>, <textarea>).
    The styling should be minimal, clean, and enhance usability.
    IMPORTANT: Do NOT wrap these native input elements in extra <div>s or other custom elements for styling. Style the native elements directly as much as possible using Tailwind CSS.
    ```

### Phase 2: Basic Structure & Navigation

* **Prompt 4: Main Application Layout Shell (Mobile-First)**
    ```
    Design the basic application shell for mobile screens.
    It should include a clear area for a page title/header, a main content area, and potentially a simple navigation element (e.g., a bottom navigation bar or a hamburger menu icon placeholder in the header for mobile).
    The main content area is where different data views will be rendered.
    ```

* **Prompt 5: Client-Side Navigation & Data Loading Intent**
    ```
    The application will function as a Single Page Application (SPA).
    Navigation between views must use the browser's History API (pushState, replaceState) and update the URI accordingly, without full page reloads.
    Data for views will be fetched dynamically from JSON files. URIs for these JSON files should simulate real API endpoints (e.g., '/api/v1/studies/{studyId}/patients').
    ```

### Phase 3: Key Data Display & Interaction Patterns

* **Prompt 6: Default Table Styling for Data Lists**
    ```
    For displaying lists of data (e.g., patient lists, visit schedules), the primary method will be HTML <table> elements.
    Define a default style for tables using Tailwind CSS. The style should be clean, with clear separation between rows and distinct headers. Ensure tables are responsive for mobile viewing (e.g., allowing horizontal scroll if necessary for wider tables on small screens, but prioritize a mobile-friendly column layout where feasible).
    ```

* **Prompt 7: Structure for Horizontally Grouped Content Blocks**
    ```
    I will need a layout pattern for content sections that display multiple information blocks (containers) side-by-side in a horizontal row on larger screens (they would stack vertically on mobile).
    These horizontally-arranged sibling containers within the same 'row' must visually grow in height together to match the tallest container in that row.
    Use Flexbox or CSS Grid to achieve this synchronized vertical growth.
    ```

* **Prompt 8: Custom Scrollbar Appearance**
    ```
    For any container elements that require internal scrolling (e.g., overflowing text areas, tall lists within a constrained height), style the scrollbars to be subtle and modern. They should be less obtrusive than default browser scrollbars but still clearly indicate scrollability. Apply this consistently.
    ```

## III. Iterative Refinement & Feature Addition (Examples)

Once the foundation is set, you will iterate screen by screen, component by component.

* **Example Prompt (Adding a specific screen):**
    ```
    Create a new view for 'Patient Listing'.
    This view should display a list of patients using the default table style defined earlier.
    The table should have columns for: 'Patient ID', 'Full Name', 'Date of Birth', and 'Status'.
    Fetch mock data for this table from '/api/mock/patients.json'.
    Include a page title 'Patient List'.
    ```

* **Example Prompt (Adding filters to the Patient Listing screen):**
    ```
    On the 'Patient Listing' view, above the patient table, add a horizontal row of filter elements.
    Include a dropdown filter for 'Status' and a text input filter for 'Full Name'.
    Style these filters minimally and ensure they are well-spaced.
    ```

* **Example Prompt (Refining a specific input on a specific form):**
    ```
    On the 'New Patient Form' screen, make the 'Date of Birth' input field use a native date picker.
    Ensure its styling is consistent with other native inputs.
    ```

* **Example Prompt (Defining a data structure for JSON):**
    ```
    The mock JSON data for '/api/mock/patients.json' should be an object containing a key 'patients', which is an array of objects. Each patient object should have: 'id' (string), 'fullName' (string), 'dateOfBirth' (string, YYYY-MM-DD), and 'status' (string, e.g., 'Active', 'Inactive', 'Completed').
    Example:
    {
      "patients": [
        { "id": "P001", "fullName": "John Doe", "dateOfBirth": "1980-05-15", "status": "Active" },
        { "id": "P002", "fullName": "Jane Smith", "dateOfBirth": "1992-11-20", "status": "Inactive" }
      ]
    }
    ```

## IV. Key Reminders from Your Experience & Stitch Guide

* **Do not mix layout changes and UI component additions in the same prompt.**
* **The AI might not "remember" previous states perfectly.** Be prepared to re-specify context if needed, or iterate from a last known good state.
* **Use precise UI/UX keywords.**

---

## V. Parámetros de Diseño Preferidos de "Refactoring UI"

Estos son valores y técnicas que el libro recomienda para mejorar la estética y claridad de tus diseños.

1.  **Perfilar Imágenes de Usuario (Alternativas Preferidas a Bordes Sólidos):**
    * **Sombra de cuadro interna sutil:**
        * `box-shadow: inset 0 2px 4px 0 hsla(0, 0%, 0%, .2);` [cite: 7]
    * **Borde interno semitransparente:**
        * `box-shadow: inset 0 0 0 1px hsla(0, 0%, 0%, .1);` [cite: 13]

2.  **Separación y Profundidad con Sombras de Cuadro Externas (Preferidas sobre Bordes):**
    * **Sombra sutil para delinear elementos:**
        * `box-shadow: 0 5px 15px 0 hsla(0, 0%, 0%, .15);` [cite: 78]
    * **Múltiples sombras para un efecto más rico:**
        * `box-shadow: 0 4px 6px hsla(0,0%,0%,.07), 0 5px 15px hsla(0,0%,0%,.1);` (Interpretación de `hsla(0,0%,.7)` y `hsla(0,0%,.1)` en la imagen de la pág. 30 del PDF[cite: 118], usando alfas comunes para sombras. El original muestra `hsla(0,0%,.7)` y `hsla(0,0%,.1)`).

3.  **Uso del Color:**
    * **Gradientes Armoniosos:** Usar dos tonalidades que no estén separadas por más de 30° en la rueda de color[cite: 48].
    * **Color de fondo para separación:**
        * Ejemplo: `background-color: hsl(200, 10%, 94%);` [cite: 83]

4.  **Espaciado para Separación:**
    * Ejemplo: `margin-bottom: 6px;` [cite: 87]

5.  **Refinamientos Tipográficos para un Aspecto Pulido:**
    * **Altura de línea reducida para encabezados:**
        * `line-height: 1.2;` [cite: 115]
    * **Espaciado entre letras para texto en mayúsculas:**
        * `letter-spacing: 0.08rem;` [cite: 118]

6.  **Control de Contenido:**
    * **Recorte de imágenes:**
        * `overflow: hidden;` [cite: 116]

---

## VI. Justificaciones de los Parámetros Preferidos (Según "Refactoring UI")

Estas son las razones por las cuales el libro "Refactoring UI" recomienda ciertas técnicas de diseño sobre otras para lograr interfaces más pulidas y efectivas.

* **Perfilar Imágenes de Usuario con Sombras/Bordes Internos:**
    * Se prefiere usar una sutil sombra de cuadro interna o un borde interno semitransparente en lugar de un borde sólido para imágenes de usuario[cite: 7, 11]. Esto es porque los bordes sólidos a menudo chocan con los colores de la imagen, mientras que las sombras internas o bordes internos sutiles definen la forma de la imagen sin crear conflictos visuales, especialmente cuando el fondo de la imagen es similar al de la UI[cite: 1, 11].

* **Usar Sombras de Cuadro Externas para Separación y Profundidad:**
    * Las sombras de cuadro son preferibles a los bordes para delinear elementos porque pueden ser más sutiles y logran el mismo objetivo de separación sin hacer que el diseño se sienta "ocupado" o "molesto"[cite: 79].
    * Combinar múltiples sombras es una técnica observada en diseños de alta calidad para añadir una rica profundidad y un aspecto más "diseñado"[cite: 115, 118].

* **Uso Estratégico del Color:**
    * **Gradientes Armoniosos:** Para que los gradientes se vean mejor y más suaves, se recomienda usar dos tonalidades que no estén muy separadas en la rueda de color (no más de 30°)[cite: 48].
    * **Color de Fondo para Separación:** Utilizar colores de fondo ligeramente diferentes para elementos adyacentes es a menudo todo lo que se necesita para crear una distinción clara[cite: 82]. Esto puede eliminar la necesidad de usar bordes, resultando en un diseño más limpio y menos recargado[cite: 84].

* **Añadir Espacio Extra para Separación:**
    * Incrementar el espacio entre elementos o grupos de elementos es una manera efectiva y "limpia" de crear separación visual[cite: 86]. Introduce distinción sin añadir nuevos elementos de UI (como líneas o bordes), lo que ayuda a que el diseño se sienta menos abarrotado[cite: 88].

* **Refinamientos Tipográficos Clave:**
    * **Altura de Línea Reducida para Encabezados:** Aplicar una altura de línea más ajustada (ej. `1.2`) a los encabezados es un "truco" que ayuda a que se vean más compactos, integrados y profesionalmente diseñados[cite: 115].
    * **Espaciado entre Letras para Texto en Mayúsculas:** Añadir un ligero espaciado entre letras (ej. `0.08rem`) al texto en mayúsculas mejora su legibilidad y le da una apariencia más refinada y pulida[cite: 118].

* **Control de Desbordamiento de Contenido:**
    * **Recorte de Imágenes (`overflow: hidden;`):** Esta propiedad es útil para asegurar que las imágenes (u otro contenido) no se desborden de sus contenedores designados, manteniendo el diseño ordenado y predecible. Es una técnica común observada al reconstruir interfaces pulidas[cite: 116].

---

## VII. CSS Base (Tokens de Diseño)

Este es un ejemplo de cómo podrías estructurar tus variables CSS (tokens de diseño) inspirándote en las recomendaciones de "Refactoring UI" y la estructura que proveen herramientas como Tailwind CSS / Headless UI. Puedes guardar esto en un archivo (ej. `design-tokens.css`) e importarlo en tu proyecto.

```css
/* styles/design-tokens.css o como prefieras llamarlo */

:root {
    /* -------------------------------------------------------------------------- */
    /* FUENTES (Fonts)                              */
    /* -------------------------------------------------------------------------- */
    --font-family-sans: Inter var, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
    --font-family-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;

    --font-weight-normal: 400;
    --font-weight-medium: 500;
    --font-weight-semibold: 600;
    --font-weight-bold: 700;

    --text-size-xs: 0.75rem;    /* 12px */
    --text-size-sm: 0.875rem;   /* 14px */
    --text-size-base: 1rem;     /* 16px */
    --text-size-lg: 1.125rem;   /* 18px */
    --text-size-xl: 1.25rem;    /* 20px */
    --text-size-2xl: 1.5rem;    /* 24px */

    --line-height-none: 1;
    --line-height-tight: 1.25;
    --line-height-snug: 1.375;
    --line-height-normal: 1.5;
    --line-height-relaxed: 1.625;
    --line-height-loose: 2;
    --line-height-heading: 1.2; /* Refactoring UI: line-height: 1.2; [cite: 115] */

    --letter-spacing-tight: -0.025em;
    --letter-spacing-normal: 0em;
    --letter-spacing-wide: 0.025em;
    --letter-spacing-caps: 0.08rem; /* Refactoring UI: letter-spacing: 0.08rem; [cite: 118] */

    /* -------------------------------------------------------------------------- */
    /* COLORES (Colors)                              */
    /* -------------------------------------------------------------------------- */
    /* Primarios - Ejemplo (ajusta a tu marca) */
    --color-primary-500: oklch(68.5% .169 237.323); /* Inspirado en Sky-500 */
    --color-primary-600: oklch(58.8% .158 241.966); /* Inspirado en Sky-600 */

    /* Neutrales / Grises */
    --color-gray-50: #f9fafb;
    --color-gray-100: #f5f5f5;
    --color-gray-200: #e5e5e5;
    --color-gray-300: #d4d4d8;
    --color-gray-400: #a3a3a3;
    --color-gray-500: #737373;
    --color-gray-600: #525252;
    --color-gray-700: #404040;
    --color-gray-800: #262626;
    --color-gray-900: #171717;
    --color-gray-950: #0a0a0a;

    --color-text-primary: var(--color-gray-900);
    --color-text-secondary: var(--color-gray-700);
    --color-text-subtle: var(--color-gray-500);
    --color-text-on-primary: var(--color-white);

    --color-background-body: var(--color-white);
    --color-background-subtle: var(--color-gray-100);
    --color-background-subtle-separator: hsl(200, 10%, 94%); /* Refactoring UI: background-color: hsl(200, 10%, 94%); [cite: 83] */

    --color-border-default: var(--color-gray-300);
    --color-border-subtle: var(--color-gray-200);

    --color-black: #000;
    --color-white: #fff;
    --color-transparent: transparent;

    /* -------------------------------------------------------------------------- */
    /* ESPACIADO (Spacing)                            */
    /* -------------------------------------------------------------------------- */
    --spacing-px: 1px;
    --spacing-0: 0;
    --spacing-1: 0.25rem;    /* 4px */
    --spacing-2: 0.5rem;     /* 8px */
    --spacing-3: 0.75rem;    /* 12px */
    --spacing-4: 1rem;       /* 16px */
    --spacing-5: 1.25rem;    /* 20px */
    --spacing-6: 1.5rem;     /* 24px */
    --spacing-8: 2rem;       /* 32px */
    --spacing-6px-refUI: 6px; /* Refactoring UI: margin-bottom: 6px; [cite: 87] */

    /* -------------------------------------------------------------------------- */
    /* RADIOS DE BORDE (Border Radius)                        */
    /* -------------------------------------------------------------------------- */
    --radius-none: 0px;
    --radius-sm: 0.25rem;
    --radius-md: 0.375rem;
    --radius-lg: 0.5rem;
    --radius-xl: 0.75rem;
    --radius-2xl: 1rem;
    --radius-full: 9999px;

    /* -------------------------------------------------------------------------- */
    /* SOMBRAS (Shadows) - Preferidas de Refactoring UI  */
    /* -------------------------------------------------------------------------- */
    --shadow-inner-profile: inset 0 2px 4px 0 hsla(0, 0%, 0%, .2); /* [cite: 7] */
    --shadow-inner-profile-alt: inset 0 0 0 1px hsla(0, 0%, 0%, .1); /* [cite: 13] */
    --shadow-card-lifted: 0 5px 15px 0 hsla(0, 0%, 0%, .15); /* [cite: 78] */
    /* Interpretación de la imagen de pág. 30 del PDF [cite: 118] */
    --shadow-card-rich: 0 4px 6px hsla(0,0%,0%,.07), 0 5px 15px hsla(0,0%,0%,.1);
    --shadow-none: 0 0 #0000;

    /* -------------------------------------------------------------------------- */
    /* TRANSICIONES Y ANIMACIONES                       */
    /* -------------------------------------------------------------------------- */
    --transition-duration-default: 150ms;
    --transition-timing-function-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
    --transition-property-common: background-color, border-color, color, fill, stroke, opacity, box-shadow, transform;

    /* -------------------------------------------------------------------------- */
    /* MISCELÁNEOS                                 */
    /* -------------------------------------------------------------------------- */
    --overflow-hidden-refUI: hidden; /* Refactoring UI: overflow: hidden; [cite: 116] */
}

/* Aplicar algunos valores por defecto al body para empezar */
body {
    font-family: var(--font-family-sans);
    color: var(--color-text-primary);
    background-color: var(--color-background-body);
    line-height: var(--line-height-normal);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

/* Un ejemplo de cómo podrías usar estas variables para un componente de tarjeta */
.card {
    background-color: var(--color-white);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card-lifted);
    padding: var(--spacing-6);
    margin-bottom: var(--spacing-4);
}

.card-title {
    font-size: var(--text-xl);
    font-weight: var(--font-weight-semibold);
    line-height: var(--line-height-heading);
    margin-bottom: var(--spacing-2);
}

.button-primary {
    background-color: var(--color-primary-500);
    color: var(--color-text-on-primary);
    padding: var(--spacing-2) var(--spacing-4);
    border-radius: var(--radius-md);
    font-weight: var(--font-weight-medium);
    text-decoration: none;
    display: inline-block;
    transition: background-color var(--transition-duration-default) var(--transition-timing-function-ease-in-out);
}

.button-primary:hover {
    background-color: var(--color-primary-600);
}

/* Inputs (recordando la preferencia por inputs nativos) */
input[type="text"],
input[type="email"],
input[type="password"],
input[type="date"],
textarea,
select {
    display: block;
    width: 100%;
    padding: var(--spacing-2) var(--spacing-3);
    font-size: var(--text-base);
    line-height: var(--line-height-normal);
    color: var(--color-text-primary);
    background-color: var(--color-white);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-none);
    transition: border-color var(--transition-duration-default) var(--transition-timing-function-ease-in-out), box-shadow var(--transition-duration-default) var(--transition-timing-function-ease-in-out);
}

input[type="text"]:focus,
input[type="email"]:focus,
input[type="password"]:focus,
input[type="date"]:focus,
textarea:focus,
select:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 2px var(--color-primary-500);
}

.avatar-image {
    border-radius: var(--radius-full);
    object-fit: cover;
    display: block;
}
.avatar-image--needs-definition {
    box-shadow: var(--shadow-inner-profile); /* o var(--shadow-inner-profile-alt); */
}
