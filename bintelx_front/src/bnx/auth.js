// src/bnx/auth.js
import { config } from '../config.js';
import { api } from './api.js';
import { devlog } from "./utils.js";
import { loadContentIntoElement  } from './loader.js';

const MODE_IN = __MODE_IN__;
let storedAppNode = null;
let appOriginalParent = null;
let sessionCheckInterval = null;

const SESSION_TIMESTAMP_KEY = 'auth_validated_at';
const SESSION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const SESSION_MONITOR_DURATION = 1 * 60 * 1000; // 1 minute

// --- Cookie Functions (unchanged) ---
function setCookie(name, value, days = 7) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    let cookieString = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
    if (MODE_IN === 'production') {
        cookieString += "; Secure";
    }
    document.cookie = cookieString;
}
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
function removeCookie(name) {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}


/**
 * CORRECTED: Called when the login UI returns a token.
 * It no longer re-routes, which preserves the application state.
 * @param {string} [token] - The session token from the login API.
 */
function handleSuccessfulLogin(token) {
    devlog(`Login successful. Received token from UI.`);
    if (token) {
        // 1. Save the session credentials
        setCookie(config.AUTH_TOKEN_NAME, token);
        sessionStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now());
        // 2. Start the background monitor to check for expiration
        startSessionMonitor();
        // 3. Simply hide the overlay. This restores the previous DOM state,
        // including the text the user was typing in the form
        hideLoginOverlay();
        devlog('Overlay removed. App state is preserved.');
    } else {
        alert("Login failed. Please check your credentials.");
    }
}

function hideLoginOverlay() {
    const overlay = document.getElementById('login-overlay');
    if (overlay) {
        overlay.remove();
    }
    if (appOriginalParent && storedAppNode) {
        appOriginalParent.appendChild(storedAppNode);
    }
    storedAppNode = null;
    appOriginalParent = null;
}

function showLoginOverlay() {
    stopSessionMonitor();
    if (document.getElementById('login-overlay')) return;
    const mainApp = document.getElementById('app');
    if (mainApp) {
        appOriginalParent = mainApp.parentElement;
        storedAppNode = mainApp.parentElement.removeChild(mainApp);
    }
    // overlay ui
    const overlay = document.createElement('div');
    overlay.id = 'login-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:white; z-index:9999; display:flex; align-items:center; justify-content:center;';
    const formContainer = document.createElement('div');
    formContainer.id = 'login-form-container';
    overlay.appendChild(formContainer);
    document.body.appendChild(overlay);
    loadContentIntoElement(
       {
           templatePath: config.AUTH_APP_TEMPLATE_PATH,
           scriptPath: config.AUTH_APP_SCRIPT_PATH
       },
       formContainer,
       { onSuccess: handleSuccessfulLogin }
    );
}

function stopSessionMonitor() {
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
        devlog("Session monitor stopped.");
    }
}

function startSessionMonitor() {
    stopSessionMonitor();
    devlog(`Session monitor started. Checking every ${SESSION_MONITOR_DURATION / 1000}s.`);
    sessionCheckInterval = setInterval(async () => {
        const token = getCookie(config.AUTH_TOKEN_NAME);
        const isValid = await validateTokenAPI(token);
        if (!isValid) {
            devlog("Session expired or became invalid. Showing login overlay.");
            showLoginOverlay();
        }
    }, SESSION_MONITOR_DURATION);
}

// --- Main Validation Flow ---
async function validateTokenAPI(token) {
    if (!token) return false;
    try {
        const response = await api.post(config.AUTH_TOKEN_VALIDATE_ENDPOINT, { token });
        // ensure your mock returns 'success' for this validation.
        return response && response.status === 'success';
    } catch (error) {
        removeCookie(config.AUTH_TOKEN_NAME);
        return false;
    }
}

/**
 * The main function called by the router to check session status.
 */
async function validateAndShowOverlayIfNeeded() {
    // 1. check for a cached session in the current tab.
    const lastValidation = sessionStorage.getItem(SESSION_TIMESTAMP_KEY);
    if (lastValidation && (Date.now() - lastValidation < SESSION_CACHE_DURATION)) {
        startSessionMonitor();
        return true;
    }
    // 2. if no cache, check for a persistent cookie.
    const token = getCookie(config.AUTH_TOKEN_NAME);
    if (!token) {
        showLoginOverlay();
        return false;
    }
    // 3. if a cookie exists, validate it with the API.
    const isValid = await validateTokenAPI(token);
    if (isValid) {
        sessionStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now());
        startSessionMonitor();
        return true;
    } else {
        showLoginOverlay();
        return false;
    }
}
export const authFlow = {
    validate: validateAndShowOverlayIfNeeded,
};
