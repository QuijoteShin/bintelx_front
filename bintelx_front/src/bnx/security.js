// src/bnx/security.js
import { config } from '@config';
import {devlog} from "./utils";

let devToolsDetected = false;

/**
 * Initializes a loop to check if DevTools is opened.
 * If detected, it sends a one-time notification to the backend.
 * NOTE: This is not foolproof and should be used for development/logging only.
 */
export function initDevToolsDetector() {
    const detectionInterval = 1000;
    const timeThreshold = 100;

    setInterval(() => {
        const startTime = new Date();
        debugger;
        const endTime = new Date();

        if (endTime - startTime > timeThreshold) {
            if (!devToolsDetected) {
                devToolsDetected = true; // Ensure we only send this once per session
                devlog('DevTools detected. Notifying endpoint.','warn');
                
                // Inform the backend
                fetch(config.DEV_TOOLS_OPENED_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        timestamp: new Date().toISOString(),
                        userAgent: navigator.userAgent
                    })
                }).catch(err => console.error("Failed to notify DevTools endpoint:", err));
            }
        }
    }, detectionInterval);
}