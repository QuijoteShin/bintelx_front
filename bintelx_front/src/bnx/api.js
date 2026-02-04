// src/bnx/api.js
// Cliente API con auto-unwrap de respuestas
//
// USO:
//   import { api } from '../../bnx/api.js';
//   const res = await api.get('/endpoint.json');
//   if (res?.d?.success) { ... }
//
// Auto-unwrap: Si el backend retorna {data: {...}}, se sube de nivel a response.d
// Esto permite encapsular payloads en "data" por convencion y el frontend accede directo.
// Ej: Backend retorna {success: true, data: {user: ...}}
//     Frontend recibe response.d = {user: ...} (sin el wrapper)
// Si NO hay .data, response.d es el objeto completo.
import { config } from '@config';
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
  // Support both relative and absolute URLs
  const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
    ? endpoint
    : `${config.api.baseUrl}${endpoint}`;

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

  // Automatically stringify body if it's an object and not FormData.
  if (!(body instanceof FormData) && body && typeof body === 'object') {
    headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
  }

  try {
    devlog(`[API] Calling: ${options.method.toUpperCase()} ${url}`);
    const response = await fetch(url, { ...options, headers, body});
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const error = new Error(data.message || `HTTP error! Status: ${response.status}`);
      error.response = {
        d: data.data ? data.data : data,
        status: response.status,
        headers: response.headers
      };
      throw error;
    }

    return {
      d: data.data ? data.data : data,
      status: response.status,
      headers: response.headers
    };

  } catch (error) {
    if (error.name === 'AbortError') {
      devlog('[API] Request was canceled by the user.');
    } else {
      console.error('[API] Request failed:', error);
    }
    throw error;
  }
}

export const api = {
  /**
   * Performs a GET request.
   * @param {string} endpoint - The endpoint to call.
   * @param {object} options - Optional fetch options, like a `signal`.
   */
  get: (endpoint, options = {}) => request(endpoint, { method: 'GET', ...options }),

  /**
   * Performs a POST request.
   * @param {string} endpoint - The endpoint to call.
   * @param {object} body - The body of the request.
   * @param {object} options - Optional fetch options, like a `signal`.
   */
  post: (endpoint, body, options = {}) => request(endpoint, { method: 'POST', body: body, ...options }),

  /**
   * Performs a PUT request.
   * @param {string} endpoint - The endpoint to call.
   * @param {object} body - The body of the request.
   * @param {object} options - Optional fetch options, like a `signal`.
   */
  put: (endpoint, body, options = {}) => request(endpoint, { method: 'PUT', body: body, ...options }),

  /**
   * Performs a PATCH request.
   * @param {string} endpoint - The endpoint to call.
   * @param {object} body - The body of the request.
   * @param {object} options - Optional fetch options, like a `signal`.
   */
  patch: (endpoint, body, options = {}) => request(endpoint, { method: 'PATCH', body: body, ...options }),

  /**
   * Performs a DELETE request.
   * @param {string} endpoint - The endpoint to call.
   * @param {object} options - Optional fetch options, like a `signal`.
   */
  del: (endpoint, options = {}) => request(endpoint, { method: 'DELETE', ...options }),
};
