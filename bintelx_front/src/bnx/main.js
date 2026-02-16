// src/bnx/main.js
import { config } from '@config';
import { initRouter } from './router.js';
import { loadComponent } from './loader.js';
import { api } from './api.js';
import '../assets/css/global.css';
import { devlog } from './utils.js';

document.title = config.appName;

async function startApp() {
    console.log('Starting Bintelx Frontend Application...');

    try {
        await Promise.all([
            loadComponent('layout/navigation', '#pre-app'),
            loadComponent('layout/footer', '#post-app')
        ]);
        console.log('Layout components loaded successfully.');
    } catch (error) {
        console.error('A critical error occurred while loading layout components.', error);
    }

    // WS transport — reemplaza BintelxClient
    api.connect();

    initRouter();
}

document.addEventListener('DOMContentLoaded', startApp);
