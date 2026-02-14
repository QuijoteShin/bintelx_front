// src/bnx/auth.js
import { config } from '@config';
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
 * Called when the login UI returns a token.
 * Checks if user has multiple scopes and redirects to selector if needed.
 * @param {string} [token] - The session token from the login API.
 */
async function handleSuccessfulLogin(token) {
    devlog(`Login successful. Received token from UI.`);
    if (token) {
        // 1. Save the session credentials
        setCookie(config.AUTH_TOKEN_NAME, token);
        sessionStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now());

        // 2. Check if user has multiple scopes
        try {
            const scopesRes = await api.get('/profile/scopes.json');
            devlog('Scopes check:', scopesRes);

            if (scopesRes?.d?.success && scopesRes.d.scopes?.length > 1) {
                // Multiple scopes - redirect to selector, preserving original URL
                devlog('Multiple scopes detected. Redirecting to selector...');
                hideLoginOverlay();
                const returnUrl = window.location.pathname + window.location.search;
                const selectorUrl = returnUrl && returnUrl !== '/'
                    ? `/profile/selector?returnUrl=${encodeURIComponent(returnUrl)}`
                    : '/profile/selector';
                window.location.href = selectorUrl;
                return;
            }
        } catch (err) {
            devlog('Error checking scopes, continuing with default:', err);
        }

        // 3. Single scope or error - continue normally
        finishLogin();
    } else {
        alert("Login failed. Please check your credentials.");
    }
}

/**
 * Completes the login process
 */
function finishLogin() {
    startSessionMonitor();
    hideLoginOverlay();
    devlog('Login complete. Reloading application.');
    window.location.reload();
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
        // Accept 2xx status codes (200-299)
        return !!(response && response.status >= 200 && response.status < 300 && response.d && response.d.success); // true|false
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

/**
 * Request a token from the API using username and password
 * This centralizes the token request logic for both login and registration flows
 * @param {string} username - The username
 * @param {string} password - The password
 * @returns {Promise<string|null>} The token if successful, null otherwise
 */
async function requestToken(username, password) {
    devlog(`Requesting token for user: ${username}`);

    try {
        // Obtener device fingerprint (best-effort, no bloquea login si falla)
        const device_hash = await api.fingerprint().catch(() => null);

        const payload = { username, password };
        if (device_hash) payload.device_hash = device_hash;

        const response = await api.post(config.AUTH_LOGIN_ENDPOINT, payload);

        // Accept 2xx status codes (200-299)
        if (response && response.status >= 200 && response.status < 300 && response.d && response.d.token) {
            devlog('Token obtained successfully');
            return response.d.token;
        } else {
            devlog('Token request failed: Invalid response structure or no token');
            console.log('Token request response:', response);
            return null;
        }
    } catch (error) {
        console.error('Token request failed:', error);
        return null;
    }
}

/**
 * Logout function - Clears session and shows login overlay
 * Can be called from any part of the application
 */
function logout() {
    devlog('User logging out. Clearing session...');

    // 1. Stop the session monitor
    stopSessionMonitor();

    // 2. Clear the authentication token cookie
    removeCookie(config.AUTH_TOKEN_NAME);

    // 3. Clear session storage
    sessionStorage.removeItem(SESSION_TIMESTAMP_KEY);

    // 4. Show the login overlay
    showLoginOverlay();

    devlog('Logout complete. User must re-authenticate.');
}

/**
 * Sets the auth token and updates session timestamp
 * @param {string} token - The JWT token
 */
function setToken(token) {
    if (!token) return false;
    setCookie(config.AUTH_TOKEN_NAME, token);
    sessionStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now());
    return true;
}

export const authFlow = {
    validate: validateAndShowOverlayIfNeeded,
    logout: logout,
    requestToken: requestToken,
    setToken: setToken,
};
