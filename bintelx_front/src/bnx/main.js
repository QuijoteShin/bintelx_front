import { config } from '../config.js';
import { initRouter } from './router.js';
import { loadComponent } from './loader.js';
import '../assets/css/global.css'; // Import global CSS
import { devlog } from './utils.js';

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

    // Si BintelxClient está disponible globalmente, exponer un helper en window
    if (typeof window !== 'undefined' && window.BintelxClient) {
        window.getBintelxClient = (opts = {}) => {
            try {
                return new window.BintelxClient({
                    url: config.ws?.baseUrl || opts.url,
                    token: opts.token,
                    autoSubscribe: opts.autoSubscribe || [],
                    handshakeRoute: opts.handshakeRoute || '/api/_demo/validate'
                });
            } catch (err) {
                devlog('Error instanciando BintelxClient', 'error');
                devlog(err, 'error');
                return null;
            }
        };
    }

    // Initialize the main router after the static layout is in place
    initRouter();
}

// Start the application once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', startApp);
