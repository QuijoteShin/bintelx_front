// src/bnx/api.js
import { config } from '../config.js';
import {devlog} from "./utils";
const MODE_IN = __MODE_IN__;
let mockApiHandler = null;

/**
 * A wrapper for the fetch API.
 * @param {string} endpoint - The API endpoint to call (e.g., '/users').
 * @param {object} options - The options for the fetch call.
 * @returns {Promise<any>}
 */
async function request(endpoint, options = {}) {
  const url = `${config.api.baseUrl}${endpoint}`;

  // moved inside to prevent force async all
  if(MODE_IN === 'development' && mockApiHandler === null) {
    if (!mockApiHandler) {
      try {
        const { default: handler } = await import('./api_mock.js');
        mockApiHandler = handler;
      } catch (error) {
        devlog("¿ Do 'mock' exists ?", error);
        mockApiHandler = () => null; // :dont try again
      }
    }
  }

  if(MODE_IN === 'development' && mockApiHandler) {
    const mockResponse = await mockApiHandler(endpoint, options);

    if (mockResponse !== null) {
      return mockResponse;
    }
  }

  const headers = { ...options.headers};
  let body = options.body;

  if (!(body instanceof FormData)) {
    if (body && typeof body === 'object') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
  }

  try {
    devlog(`[API] Calling: ${options.method.toUpperCase()} ${url}`);
    const response = await fetch(url, { ...options, headers, body});
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Error with no JSON body' }));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    // If the response has no content (e.g., a 204 No Content), return an empty object.
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch (error) {
    console.error('[API] request failed:', error);
    throw error;
  }
}

export const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: body }),
  // Add put, delete, etc. as needed
};
