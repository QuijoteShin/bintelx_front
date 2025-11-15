import { config } from '../config.js';
import { initRouter } from './router.js';
import { loadComponent } from './loader.js';

document.title = config.appName;
// Initialize the application router
async function startApp() {
    console.log('Starting Bintelx Frontend Application...');
    // document.title = config.appName;
    // Load persistent layout components into their slots
    try {
        await Promise.all([
            loadComponent('layout/navigation', '#pre-app'),
            loadComponent('layout/footer', '#post-app')
        ]);
        console.log('Layout components loaded successfully.');
    } catch (error) {
        console.error('A critical error occurred while loading layout components.', error);
    }

    // Initialize the main router after the static layout is in place
    initRouter();
}

// Start the application once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', startApp);