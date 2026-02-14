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

// Device fingerprint: recolecta componentes y obtiene xxh128 del server
// Cacheado por sesión (mismo dispositivo = mismo hash)
let _fpCache = null;

async function collectDeviceComponents() {
  const c = {};
  // Canvas
  try {
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    ctx.textBaseline = 'alphabetic';
    ctx.font = "16px 'Arial'";
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Bintelx-FP', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Bintelx-FP', 4, 17);
    c.canvas = cv.toDataURL();
  } catch { c.canvas = 'canvas-unavailable'; }

  // WebGL
  try {
    const cv = document.createElement('canvas');
    const gl = cv.getContext('webgl') || cv.getContext('experimental-webgl');
    if (!gl) { c.webgl = 'webgl-unavailable'; }
    else {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const v = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : 'unknown';
      const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
      c.webgl = `${v}::${r}`;
    }
  } catch { c.webgl = 'webgl-error'; }

  // Hardware
  c.hardware = [navigator.hardwareConcurrency || 0, navigator.deviceMemory || 0, navigator.language || 'unknown'].join('|');

  // Screen
  const s = window.screen || {};
  c.screen = [s.width || 0, s.height || 0, s.colorDepth || 0, window.devicePixelRatio || 1, navigator.maxTouchPoints || 0].join('|');

  // Math
  const mr = [];
  [Math.PI, Math.E, Math.LN2, Math.SQRT2].forEach((v, i) => {
    mr.push(Math.sin(v + i).toFixed(15));
    mr.push(Math.cos(v * i + 0.123).toFixed(15));
    mr.push(Math.tan(v / (i + 1)).toFixed(15));
  });
  c.math = mr.join('|');

  // Fonts
  try {
    const bases = ['monospace', 'sans-serif', 'serif'];
    const tests = ['Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia', 'Impact', 'Lucida Console', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
    const span = document.createElement('span');
    span.style.cssText = 'position:absolute;left:-9999px;font-size:72px';
    span.innerHTML = 'mmmmmmmmmmlli';
    document.body.appendChild(span);
    const dw = {};
    bases.forEach(f => { span.style.fontFamily = f; dw[f] = span.offsetWidth; });
    const fr = [];
    tests.forEach(f => bases.forEach(b => {
      span.style.fontFamily = `${f},${b}`;
      if (span.offsetWidth !== dw[b]) fr.push(`${f}:${b}:${span.offsetWidth}`);
    }));
    document.body.removeChild(span);
    c.fonts = fr.join('|') || 'fonts-none';
  } catch { c.fonts = 'fonts-unavailable'; }

  // Media devices
  try {
    if (navigator.mediaDevices?.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const md = {};
      devices.forEach(d => md[d.kind] = (md[d.kind] || 0) + 1);
      c.media = JSON.stringify(md);
    } else { c.media = 'media-unavailable'; }
  } catch { c.media = 'media-error'; }

  // Audio
  try {
    const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!AC) { c.audio = 'audio-unavailable'; }
    else {
      const ctx = new AC(1, 44100, 44100);
      const osc = ctx.createOscillator();
      osc.type = 'triangle'; osc.frequency.value = 10000;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -50; comp.knee.value = 40;
      comp.ratio.value = 12; comp.attack.value = 0; comp.release.value = 0.25;
      osc.connect(comp); comp.connect(ctx.destination); osc.start(0);
      const buf = await ctx.startRendering();
      const data = buf.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += Math.abs(data[i]);
      c.audio = `audio-${sum}`;
    }
  } catch { c.audio = 'audio-error'; }

  return c;
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

  /**
   * Obtiene el device fingerprint (xxh128, 32 hex) del servidor.
   * Recolecta componentes del dispositivo y los envía a /ws/fingerprint.
   * Cacheado por sesión — mismo dispositivo = mismo hash.
   * @returns {Promise<string|null>} xxh128 hash o null si falla
   */
  fingerprint: async () => {
    if (_fpCache) return _fpCache;
    try {
      const components = await collectDeviceComponents();
      const res = await request('/ws/fingerprint', {
        method: 'POST',
        body: { components }
      });
      if (res?.d?.hash) {
        _fpCache = res.d.hash;
        return _fpCache;
      }
    } catch (e) {
      devlog('[API] Fingerprint failed:', e);
    }
    return null;
  },
};
