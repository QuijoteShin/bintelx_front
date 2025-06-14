# bintelx_front

A modular enterprise frontend framework built with modern vanilla JavaScript (ES Modules), HTML, and a CSS Design Token system, all bundled with Webpack.

---

## Getting Started

### Prerequisites

You must have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1.  Clone the repository.
2.  Navigate to the project directory and install the dependencies:
    ```sh
    npm install
    ```

### Running the Development Server

To start the development server with Hot Module Replacement, run the following command. The application will automatically open in your default browser.

```sh
npm start
```

### Building for Production
To create an optimized production build in the dist/ directory, run:

```Bash
npm run build
```
This dist folder contains the static assets ready to be served by a web server like Nginx.

### Demo Config
```nano
// /src/config.js
export const config = {
    appName: 'Bintelx Enterprise Agnostic Front',
    defaultLocale: 'es-CL',
    defaultRoute: '/_dashboard/index',
    appContainer: { loading: '<h2>Loading...</h2>' },
    api: {
        baseUrl: '/api/v1',
        timeout: 15000
    },
    authAppPath: '_auth/login',
    AUTH_TOKEN_NAME: 'bnxt',
    AUTH_LOGIN_ENDPOINT: '/_auth/login',
    AUTH_TOKEN_VALIDATE_ENDPOINT: '/_auth/validate',
    DEV_TOOLS_OPENED_ENDPOINT: '/_security/report',
    ENDPOINT_BASE_URL: '',
};
```

---

## Architecture

This project is built as a Single-Page Application (SPA) with a modular architecture. Core functionalities like routing and authentication are decoupled from the UI components.

### Authentication Flow

The application features a **state-preserving authentication flow**, which ensures that users do not lose their work if their session expires while they are editing a form.

The flow is managed primarily by `bnx/auth.js` in coordination with `bnx/router.js`.

#### Key Scenarios:

1.  **Initial Page Load or Hard Refresh:**
    * The router calls `authFlow.validate()` to check for a valid session.
    * `auth.js` first checks for a valid timestamp in `sessionStorage` for quick validation.
    * If the timestamp is expired or missing, it checks for a session `cookie`.
    * If a cookie exists, it's validated against the `config.AUTH_TOKEN_VALIDATE_ENDPOINT` endpoint.
    * If the cookie is invalid or doesn't exist, the application displays a login overlay.

2.  **Session Expiration While Using the App:**
    * A periodic session monitor (`startSessionMonitor`) runs in the background.
    * If it detects that the token is no longer valid, it triggers the `showLoginOverlay()` function.
    * **Crucially, `showLoginOverlay()` does not destroy the main application content (`<main id="app">`). Instead, it removes the element from the DOM and stores a reference to it in memory.**
    * The login UI is then loaded into an overlay that covers the page.

3.  **Successful Re-Authentication:**
    * The user enters their credentials in the login UI (`config.authAppPath`).
    * The `login` component calls the `config.AUTH_LOGIN_ENDPOINT` endpoint to get a new token.
    * Upon receiving a valid token, it calls a `onSuccess(token)` callback provided by `auth.js`.
    * The `handleSuccessfulLogin` function in `auth.js` receives the token, saves it as a new cookie, and **restores the original application content from memory by appending it back to the DOM.**
    * The login overlay is removed.

This process ensures that the user is returned to the exact state they were in before their session expired, including any text they had typed into forms, providing a seamless user experience.

---

### Component Loading & API Mocking

The framework relies on a dynamic component loader and an API mocking system to facilitate development.

#### Component Loader (`bnx/loader.js`)

-   The `loadComponent(modulePath, targetSelector, data)` function is the core of the dynamic UI.
-   It asynchronously imports a component's template (`.tpls` file) and its logic (`.js` file) from the `src/apps/` directory.
-   It renders the template into the specified `targetSelector` and then executes the component's JavaScript logic, passing any `data` to it.
-   This allows layout elements (like the header and footer) and page content to be loaded on demand without a full page refresh.

#### API and Mocking (`bnx/api.js` & `bnx/api_mock.js`)

-   All backend communication is centralized through `bnx/api.js`, which provides simple `get()` and `post()` methods that wrap the native `fetch` API.
-   **In development mode**, `api.js` first attempts to dynamically import `bnx/api_mock.js`.
-   If the import is successful, it passes every API request to the `handleMockRequest` function in the mock file.
-   `handleMockRequest` uses a `switch` statement to check if the requested endpoint (e.g., `POST /form/data/post`) has a defined mock.
    -   If a mock is found, it returns a `Promise` that resolves with fake data, simulating a real API response.
    -   If no mock is found for the endpoint, it returns `null`, and `api.js` proceeds to make the actual network request.
-   This system allows for rapid frontend development and testing of different API response scenarios without depending on a live backend.

---

## `bnx-stepper` Web Component

The `bnx-stepper` is a custom web component designed to create multi-step user flows or wizards. It dynamically loads content for each step and manages navigation between steps.

### Purpose
To provide a reusable and encapsulated way to guide users through a sequence of actions or information gathering stages.

### Usage as Web Component
Simply include the `<bnx-stepper>` tag in your HTML where you want the stepper to appear:
```html
<bnx-stepper id="myStepper"></bnx-stepper>
```
The component is then configured and controlled via JavaScript.

### Configuration
Steps are defined by setting the `steps` property on the `bnx-stepper` element. This property takes an array of step configuration objects.

**Step Configuration Object Example:**
```javascript
const stepperElement = document.getElementById('myStepper');
stepperElement.steps = [
  {
    id: 'uniqueStepId1', // Optional: A unique ID for the step
    templatePath: 'path/to/step1.tpls', // Path to the HTML template for this step
    scriptPath: 'path/to/step1.js',     // Path to the JavaScript module for this step's logic
    // validate: (stepData) => { return true; } // Optional: A validation function directly in config
  },
  {
    id: 'uniqueStepId2',
    templatePath: 'path/to/step2.tpls',
    scriptPath: 'path/to/step2.js'
  }
  // ... more steps
];
```
* `id`: An optional unique identifier for the step. If not provided, the step's index is used internally.
* `templatePath`: The URL to an HTML file that will be fetched and used as the content for this step. These paths should be relative to the web server root (e.g., `/src/apps/_auth/login/step1.tpls`). The `Stepper.js` component prepends a `/` if it's not there.
* `scriptPath`: The URL to a JavaScript module (ESM) that controls the logic for this step. Path considerations are similar to `templatePath`.
* `validate`: An optional function `(stepData) => boolean` that can be provided directly in the step configuration. If this exists, it's called before navigating to the next step (and before the step element's own `validate` function).

### Step Structure
*   **`templatePath`**: Points to an HTML file. Its content will be injected into the step's container.
*   **`scriptPath`**: Points to a JavaScript ES module. This module must export a default function with the signature:
    ```javascript
    export default function(stepElement, stepData, updateStepDataCallback) {
      // stepElement: The DOM element container for this step's template.
      // stepData: Any data previously saved for this step.
      // updateStepDataCallback: A function to call to save or update data for this step.
      //                       Example: updateStepDataCallback({ fieldName: 'value' });

      // Optionally, expose a validate method on the stepElement:
      stepElement.validate = () => {
        // Perform validation logic for this step.
        // Return true if valid, false otherwise.
        // This is called by the stepper when trying to navigate next.
        return true;
      };

      // Optionally, expose other methods needed by the main flow orchestration script,
      // for example, a submission handler for the final step:
      // stepElement.submit = async (allStepperData) => { /* ... */ };
    }
    ```
    The `stepElement.validate()` convention is the primary way for a step to indicate if it's valid to proceed. If both `stepConfig.validate` and `stepElement.validate` exist, `stepConfig.validate` is called first.

### Events
The `bnx-stepper` dispatches the following custom events on the stepper element itself:

*   **`stepChange`**: Fired when the current step changes successfully (after content is loaded and transitions, if any, are complete).
    *   `event.detail`: `{ currentStepIndex: number, stepId: string, previousStepIndex: number }`
*   **`flowComplete`**: Fired when `next()` is called on the last step and validation (if any) passes.
    *   `event.detail`: `{ data: object }` (where `data` is the object returned by `getData()`)
*   **`flowCancel`**: Fired when `prev()` is called on the first step.
    *   `event.detail`: `{ data: object }` (where `data` is the object returned by `getData()`)

### Methods
The following public methods can be called on a `bnx-stepper` element instance:

*   **`next()`**: Attempts to navigate to the next step. Performs validation on the current step (both `stepConfig.validate` and `stepElement.validate()` if they exist). If on the last step, triggers the `flowComplete` event.
*   **`prev()`**: Navigates to the previous step. If on the first step, triggers the `flowCancel` event.
*   **`goTo(stepIdOrIndex: string | number)`**: Navigates to a specific step identified by its ID or index. This does not currently trigger validation on the outgoing step.
*   **`getData()`**: Returns a deep copy of all data collected by the stepper, keyed by step ID (or index if ID is not provided).

### Styling
*   The `bnx-stepper` uses Shadow DOM for style encapsulation. Its internal structure and basic styles are defined in `stepper.tpls` (inline styles for host and container) and `stepper.css` (for individual steps and transitions).
*   Step transitions (sliding effects) are CSS-based, utilizing classes like `slide-to-left`, `slide-from-right`, etc. These are defined in `stepper.css`.
*   The component itself is a block-level element (`display: block`). Its dimensions can be controlled by external CSS.

### Example
A working example of the `bnx-stepper` is implemented for a two-step login flow. You can find this example in the `bintelx_front/src/apps/_auth/` directory, specifically:
*   `two-step-login.tpls` (HTML structure hosting the stepper)
*   `two-step-login.js` (Orchestration logic, defines steps and handles events)
*   `login/step1.tpls`, `login/step1.js`, `login/step2.tpls`, `login/step2.js` (Individual step templates and scripts)
    Make sure the paths provided in `templatePath` and `scriptPath` are correctly resolved by your development server (e.g., paths starting from the root like `/src/apps/...`).


---

# Lore - Core Features & Architecture

This project is built as a Single-Page Application (SPA) Micro Service. With a modular architecture. Core functionalities are decoupled from the UI components to create a scalable and maintainable codebase.

### - Multi-App Compilation
- **What it is:** The framework is designed to compile multiple independent applications that all share the same core `bnx` codebase within a single project. This promotes code reuse and consistency across different parts of a larger enterprise system.

```bash
  npm run build:apps -- --env apps=auth,profile
```

### - Dynamic Component Loader
- **What it is:** The `loadComponent` function in `loader.js` allows for on-demand loading of UI parts (both HTML templates and their corresponding JavaScript logic). This improves initial load times and application efficiency by only fetching resources when they are needed.

### - State-Preserving Authentication
- **What it is:** This is a key feature of the framework. If a user's session expires while they are editing a form, the system displays a login overlay **without destroying the underlying page state**. Upon successful re-authentication, the overlay is removed, and the user can continue their work exactly where they left off, without any data loss.

### - Decoupled Architecture
- **What it is:** Responsibilities are clearly separated into independent modules. `auth.js` handles the authentication logic, `router.js` handles routing, `api.js` manages backend communication, and UI components reside in their own `apps/` directories. This separation of concerns makes the application easier to understand, scale, and maintain.

### - Configuration-Driven
- **What it is:** Key values such as API endpoints, application routes, and app names are managed from a central `config.js` file. This makes configuration and deployment to different environments straightforward and less error-prone.

### - Single-Page Application (SPA) Router
- **What it is:** The `router.js` module manages application navigation without full page reloads. It uses the browser's History API to dynamically change the URL and render the appropriate view, providing a seamless user experience.

---

