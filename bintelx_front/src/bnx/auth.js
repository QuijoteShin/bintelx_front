// src/bnx/auth.js

import { config } from '../config.js';
import { api } from './api.js';
const MODE_IN = __MODE_IN__;

/**
 * Sets a cookie. In a dev environment (non-https), the 'secure' flag is omitted.
 * @param {string} name - The name of the cookie.
 * @param {string} value - The value of the cookie.
 * @param {number} days - The number of days until the cookie expires.
 */
function setCookie(name, value, days = 7) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }

    let cookieString = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
    if(MODE_IN === 'production') {
        cookieString += "; Secure";
    } else {
        devlog("Running in Development mode, 'Secure' flag omitted.");
    }
    document.cookie = cookieString;
}

/**
 * Gets a cookie by name.
 * @param {string} name - The name of the cookie.
 * @returns {string|null} The cookie value or null if not found.
 */
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

/**
 * Removes a cookie by name.
 * @param {string} name - The name of the cookie to remove.
 */
function removeCookie(name) {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}


// --- Login UI and State Management ---

let loginCheckInterval = null;

/**
 * Hides the main app content and displays a full-screen login form.
 */
function showLoginOverlay() {
    // If overlay already exists, do nothing
    if (document.getElementById('login-overlay')) return;

    // Hide main content
    const mainApp = document.getElementById('app');
    if (mainApp) mainApp.style.display = 'none';

    // Create and inject the overlay
    const overlay = document.createElement('div');
    overlay.id = 'login-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:white; z-index:9999; display:flex; align-items:center; justify-content:center;';
    overlay.innerHTML = `
        <div class="card" style="width: 320px;">
            <h3 class="card-title">Authentication Required</h3>
            <form id="login-form">
                <div class="form-group" style="display:block;">
                    <label for="username">Username</label>
                    <input type="text" id="username" name="username" required />
                </div>
                <div class="form-group" style="display:block; margin-top: 1rem;">
                     <label for="password">Password</label>
                    <input type="password" id="password" name="password" required />
                </div>
                <button type="submit" class="button-primary" style="width:100%; margin-top: 1.5rem;">Login</button>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);

    // Add logic to handle the form submission (this is a mock)
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        alert('Mock Login Successful!');
        // In a real app, you would call an API, get a token, and then...
        setCookie(config.AUTH_TOKEN_NAME, 'mock-dev-token-is-now-valid');
        hideLoginOverlay();
        window.location.reload(); // Easiest way to re-trigger validation
    });

    // Continuously check if the login page is visible
    loginCheckInterval = setInterval(() => {
        if (!document.getElementById('login-overlay')) {
            devlog("Login overlay was removed. Re-creating it.");
            showLoginOverlay();
        }
    }, 2000);
}

/**
 * Removes the login overlay and re-enables the main app view.
 */
function hideLoginOverlay() {
    const overlay = document.getElementById('login-overlay');
    if (overlay) {
        overlay.remove();
    }
    if (loginCheckInterval) {
        clearInterval(loginCheckInterval);
        loginCheckInterval = null;
    }
    const mainApp = document.getElementById('app');
    if (mainApp) mainApp.style.display = 'block';
}


// --- Main Validation Logic ---

const SESSION_TIMESTAMP_KEY = 'auth_validated_at';
const SESSION_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Checks if the user's session is valid.
 * 1. Checks for a recent validation timestamp in sessionStorage.
 * 2. If not found or expired, checks for a token in cookies.
 * 3. If a token exists, validates it with the backend API.
 * @returns {Promise<boolean>} - True if authenticated, false otherwise.
 */
export async function validateSession() {
    // 1. Check for a cached session validation
    const lastValidation = sessionStorage.getItem(SESSION_TIMESTAMP_KEY);
    if (lastValidation && (Date.now() - lastValidation < SESSION_CACHE_DURATION)) {
        devlog("Auth: Validation cached in session. Access granted.");
        return true;
    }

    // 2. Check for the auth token in cookies
    const token = getCookie(config.AUTH_TOKEN_NAME);
    if (!token) {
        devlog("Auth: No token cookie found. Access denied.");
        return false;
    }

    // 3. Validate the token with the backend
    try {
        devlog("Auth: Validating token with API...");
        await api.post(config.AUTH_TOKEN_VALIDATE_ENDPOINT, { token });
        // If the API call succeeds, the token is valid
        devlog("Auth: Token is valid. Access granted.");
        sessionStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now());
        return true;
    } catch (error) {
        console.error("Auth: Token validation failed.", error);
        removeCookie(config.AUTH_TOKEN_NAME); // The token is bad, remove it
        return false;
    }
}

// Export the function that will be called by the router
export const authFlow = {
    validate: validateSession,
    showLogin: showLoginOverlay,
};