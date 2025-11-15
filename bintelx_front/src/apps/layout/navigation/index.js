// /src/apps/layout/navigation/index.js

import './index.css';
import { authFlow } from '../../../bnx/auth.js';

export default function(container) {
    console.log('Navigation component initialized.');

    // Highlight active nav link
    const currentPath = window.location.pathname;
    const navLinks = container.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });

    // Initialize logout button
    const logoutButton = container.querySelector('#nav-logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            console.log('Navbar logout button clicked');
            const confirmed = confirm('¿Estás seguro que deseas cerrar sesión?');
            if (confirmed) {
                authFlow.logout();
            }
        });
    }
}