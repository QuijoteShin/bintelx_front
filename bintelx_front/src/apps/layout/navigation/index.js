// /src/apps/layout/navigation/index.js

import './index.css';

export default function(container) {
    console.log('Navigation component initialized.');
    const currentPath = window.location.pathname;
    const navLinks = container.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
}