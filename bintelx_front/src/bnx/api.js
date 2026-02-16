// src/bnx/api.js
// API Smart Layer — WS-first transport, dedup, cache, abort
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
//
// Capas (GET):
//   Layer 1 (auto):    Inflight dedup — N calls misma URL = 1 request
//   Layer 2 (opt-in):  Cache TTL + stale-while-revalidate — { cache: 5000 }
//   Layer 3 (opt-in):  AbortKey — { abortKey: 'search' }
//   Layer 4 (auto):    ETag / If-None-Match — transparente si backend envía ETag
//   Layer 5 (auto):    Retry con backoff — 5xx/network, GET only, max 2 reintentos
//   Layer 6 (auto):    Circuit breaker — abre tras 5 fallos consecutivos por host
//   Layer 7 (opt-in):  Priority — { priority: 'low' } posterga al idle
//
// Capas (todas las methods):
//   Layer 8 (auto):    Navigation lifecycle — requests mueren al cambiar de ruta
//                      { persist: true } para sobrevivir (auth, profile, routes)
//                      api.abortViewRequests() cancela HTTP + WS view-scoped
//
// Transporte:
//   WS_FIRST=true  → frame WS (Swoole channel server), HTTP fallback on timeout/error
//   WS_FIRST=false → siempre HTTP, WS solo para push/subscribe
//   Throttle:        >3 WS pending → nuevos requests van por HTTP (evita head-of-line)
//   SWR:             revalidaciones background siempre por HTTP (no satura WS)
//
// Absorbe BintelxClient: auth, heartbeat, reconnect, subscribe, events, fingerprint

import { config } from '@config';
import { devlog } from './utils';

const MODE_IN = __MODE_IN__;
let mockApiHandler = null;

// ─── WS transport state ────────────────────────────────────────────
let _ws = null;
let _wsReady = false;        // WS open + auth OK → puede transportar API
let _wsConnected = false;    // WS open (sin auth) → puede recibir push/subscribe
let _wsAuthFailed = false;   // auth falló → NO usar WS para transport (sería anonymous)
let _wsCorrelationCounter = 0;
const _wsPending = new Map();     // correlation_id → { resolve, reject, timer }
let _wsReconnectTimer = null;
let _wsBackoff = 0;
const _wsMaxBackoff = 30000;
const _wsHeartbeatInterval = 30000;
let _wsHeartbeat = null;

// ─── Layer 1: Inflight dedup (GET only, automatic) ─────────────────
const _inflight = new Map();      // url → Promise

// ─── Layer 2: TTL cache (GET only, opt-in) ─────────────────────────
const _cache = new Map();         // url → { data, expiresAt, staleUntil }

// ─── Layer 3: Abort controllers (opt-in) ───────────────────────────
const _abortControllers = new Map(); // abortKey → AbortController

// ─── Layer 4: ETag store (automatic, HTTP only) ────────────────────
// Almacena etag+data por URL. Si backend envía ETag header, el próximo
// request envía If-None-Match. En 304 retorna data cacheada sin consumir body.
const _etagStore = new Map();     // url → { etag, data }

// Props custom de api.js que NO deben llegar a fetch() nativo
const _customProps = ['cache', 'abortKey', 'skipDedup', 'retry', 'priority', 'persist', 'query'];
function _stripCustomProps(options) {
    const clean = {};
    for (const k in options) {
        if (!_customProps.includes(k)) clean[k] = options[k];
    }
    return clean;
}

// ─── Layer 5: Retry config ─────────────────────────────────────────
const RETRY_MAX = 2;
const RETRY_DELAYS = [500, 1500]; // ms entre reintentos
const RETRY_STATUS = new Set([500, 502, 503, 504, 0]); // 0 = network error

// ─── Layer 6: Circuit breaker ──────────────────────────────────────
// Abre tras CIRCUIT_THRESHOLD fallos consecutivos al mismo endpoint prefix.
// Mientras abierto, requests fallan inmediatamente sin hit al server.
const _circuits = new Map();      // endpointPrefix → { failures, openUntil }
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_COOLDOWN = 30000;   // 30s abierto antes de re-intentar

// ─── Channel subscriptions ─────────────────────────────────────────
const _subscriptions = new Set();

// ─── Event system ──────────────────────────────────────────────────
const _eventHandlers = new Map(); // event → Set<handler>

// ─── Navigation lifecycle ────────────────────────────────────────
// Requests sin persist:true se cancelan al cambiar de ruta (abortViewRequests)
let _navId = 0;
const _viewAbortControllers = new Set();  // AbortControllers de requests HTTP view-scoped
const _viewWsIds = new Set();             // correlation_ids de WS view-scoped

// ─── Push dedup ────────────────────────────────────────────────────
const _recentMsgIds = new Set();
const MSG_ID_MAX = 500;

// ─── Cache eviction (cada 60s limpia entries expirados) ────────────
const CACHE_MAX_SIZE = 200;
const ETAG_MAX_SIZE = 200;
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of _cache) {
        if (now > (entry.staleUntil || entry.expiresAt)) _cache.delete(key);
    }
    // ETag store: si excede max, limpiar las más antiguas (FIFO)
    if (_etagStore.size > ETAG_MAX_SIZE) {
        const excess = _etagStore.size - ETAG_MAX_SIZE;
        let removed = 0;
        for (const key of _etagStore.keys()) {
            if (removed >= excess) break;
            _etagStore.delete(key);
            removed++;
        }
    }
}, 60000);

// ─── Device fingerprint ────────────────────────────────────────────
let _fpCache = null;
let _serverFingerprint = null;
let _fpComponents = null;       // componentes cacheados (no recomputar)
let _fpFailed = false;          // si FP endpoint falló, no reintentar

// ═══════════════════════════════════════════════════════════════════
// Token helpers
// ═══════════════════════════════════════════════════════════════════

function _getToken() {
    const name = config.AUTH_TOKEN_NAME || 'bnxt';
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// ═══════════════════════════════════════════════════════════════════
// Event emitter (absorbe BintelxClient.on/emit)
// ═══════════════════════════════════════════════════════════════════

function _emit(event, payload) {
    if (!_eventHandlers.has(event)) {
        if (event === 'error') console.error('[API]', payload);
        return;
    }
    _eventHandlers.get(event).forEach(handler => {
        try { handler(payload); } catch (e) { console.error('[API] handler error', e); }
    });
}

// ═══════════════════════════════════════════════════════════════════
// WS transport — connection lifecycle
// ═══════════════════════════════════════════════════════════════════

function _connectWs() {
    if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) return;

    const wsUrl = config.ws?.baseUrl;
    if (!wsUrl) return;

    _ws = new WebSocket(wsUrl);

    _ws.onopen = () => {
        _wsReady = false; // not ready until auth completes
        _wsBackoff = 0;
        devlog('[API] WS connected, authenticating...');
        _startHeartbeat();
        _authenticate();
    };

    _ws.onmessage = (event) => _handleWsMessage(event);

    _ws.onclose = (event) => {
        _wsReady = false;
        _wsConnected = false;
        _ws = null;
        _stopHeartbeat();
        _rejectAllPending('WS connection closed');
        _emit('close', { code: event.code, reason: event.reason });
        _scheduleReconnect();
    };

    _ws.onerror = (err) => {
        devlog('[API] WS error', err);
        _emit('error', err);
    };
}

function _startHeartbeat() {
    _stopHeartbeat();
    _wsHeartbeat = setInterval(() => {
        if (_ws?.readyState === WebSocket.OPEN) {
            try { _ws.send(JSON.stringify({ type: 'ping', ts: Date.now() })); }
            catch (e) { devlog('[API] heartbeat error', e); }
        }
    }, _wsHeartbeatInterval);
}

function _stopHeartbeat() {
    if (_wsHeartbeat) { clearInterval(_wsHeartbeat); _wsHeartbeat = null; }
}

function _scheduleReconnect() {
    if (_wsReconnectTimer) return;
    _wsBackoff = _wsBackoff ? Math.min(_wsBackoff * 2, _wsMaxBackoff) : 1000;
    devlog(`[API] WS reconnecting in ${_wsBackoff}ms`);
    _emit('reconnecting', { in: _wsBackoff });
    _wsReconnectTimer = setTimeout(() => {
        _wsReconnectTimer = null;
        _connectWs();
    }, _wsBackoff);
}

function _rejectAllPending(reason) {
    for (const [id, pending] of _wsPending) {
        if (pending.timer) clearTimeout(pending.timer);
        pending.reject(new Error(reason));
    }
    _wsPending.clear();
}

// ═══════════════════════════════════════════════════════════════════
// WS authentication (absorbe BintelxClient.authenticate)
// ═══════════════════════════════════════════════════════════════════

async function _authenticate() {
    const token = _getToken();

    // Fingerprint: obtener hash server-side (best-effort, cachea resultado)
    if (!_serverFingerprint && !_fpFailed) {
        try {
            // Reutilizar componentes si ya se calcularon (heavy: Canvas, WebGL, fonts)
            if (!_fpComponents) {
                _fpComponents = await collectDeviceComponents();
            }
            const fpRes = await _sendViaWsRaw('/api/profile/fingerprint', 'POST',
                { components: _fpComponents }, {}, 'fp_auth');
            if (fpRes?.d?.hash) {
                _serverFingerprint = fpRes.d.hash;
                _fpCache = fpRes.d.hash;
            }
        } catch (e) {
            devlog('[API] FP failed (no retry on reconnect)', e);
            _fpFailed = true;
        }
    }

    if (!token) {
        devlog('[API] No token, WS connected (push only, no API transport)');
        _transitionToConnected();
        return;
    }

    try {
        const res = await _sendViaWsRaw(
            config.AUTH_TOKEN_VALIDATE_ENDPOINT || '/api/_demo/validate',
            'POST',
            { token, device_hash: _serverFingerprint || null },
            {},
            'ws_auth'
        );
        // _sendViaWsRaw pasa por _handleWsMessage que unwrappea a .d
        const authData = res?.d || {};
        if (authData.success === false) {
            throw new Error(authData.message || 'WS auth failed');
        }
        devlog('[API] WS authenticated OK', authData);
        _transitionToReady();
    } catch (e) {
        _emit('error', e);
        devlog('[API] WS auth failed — WS disabled for transport (anonymous fd)', e);
        _wsAuthFailed = true;
        _transitionToConnected();
    }
}

// WS autenticado → puede transportar API requests
// Limpia _wsAuthFailed para que reconexiones exitosas rehabiliten WS transport
function _transitionToReady() {
    _wsConnected = true;
    _wsReady = true;
    _wsAuthFailed = false;
    _emit('ready', { authenticated: true });
    _resubscribeAll();
}

// WS conectado sin auth → solo push/subscribe, API sigue por HTTP
// El fd queda anonymous en channel server — NO enviar requests autenticados
function _transitionToConnected() {
    _wsConnected = true;
    _wsReady = false;
    _emit('ready', { authenticated: false });
    _resubscribeAll();
}

function _resubscribeAll() {
    _subscriptions.forEach(channel => {
        if (_ws?.readyState === WebSocket.OPEN) {
            _ws.send(JSON.stringify({ type: 'subscribe', channel }));
        }
    });
}

// ═══════════════════════════════════════════════════════════════════
// WS message handler
// ═══════════════════════════════════════════════════════════════════

function _handleWsMessage(event) {
    let payload;
    try { payload = JSON.parse(event.data); } catch { return; }

    // Push dedup via msg_id
    if (payload.msg_id) {
        if (_recentMsgIds.has(payload.msg_id)) return;
        _recentMsgIds.add(payload.msg_id);
        if (_recentMsgIds.size > MSG_ID_MAX) {
            const first = _recentMsgIds.values().next().value;
            _recentMsgIds.delete(first);
        }
    }

    // Correlation-based API responses
    if (payload.correlation_id && _wsPending.has(payload.correlation_id)) {
        const pending = _wsPending.get(payload.correlation_id);
        _wsPending.delete(payload.correlation_id);
        if (pending.timer) clearTimeout(pending.timer);

        if (payload.type === 'api_error' || payload.status === 'error') {
            const err = new Error(payload.message || 'WS API error');
            // status 400 evita que retry/circuit-breaker insistan sobre WS roto
            const httpStatus = payload.http_status || 400;
            err.response = { d: payload.data || {}, status: httpStatus, headers: {} };
            err.status = httpStatus;
            err._wsError = true;
            pending.reject(err);
        } else {
            // Unwrap: misma lógica que HTTP
            const raw = payload.data || {};
            const unwrapped = raw.data !== undefined ? raw.data : raw;
            pending.resolve({
                d: unwrapped,
                status: 200,
                headers: {}
            });
        }
        return;
    }

    // System messages
    if (payload.type === 'system') {
        const ev = payload.event || '';
        if (ev.includes('logout')) _emit('system:logout', payload);
        if (ev.includes('permissions')) _emit('system:permissions', payload);
    }

    // Channel confirmations
    if (payload.type === 'subscribed') _emit('subscribed', payload);
    if (payload.type === 'unsubscribed') _emit('unsubscribed', payload);

    // Emit genérico para cualquier mensaje
    _emit('message', payload);
}

// ═══════════════════════════════════════════════════════════════════
// WS send — raw (para auth/FP, no pasa por capas)
// ═══════════════════════════════════════════════════════════════════

function _sendViaWsRaw(route, method, body, query, correlationId) {
    const timeout = config.ws?.apiTimeout || 5000;
    const id = correlationId || `api_${++_wsCorrelationCounter}_${Date.now()}`;
    const token = _getToken();

    return new Promise((resolve, reject) => {
        if (!_ws || _ws.readyState !== WebSocket.OPEN) {
            return reject(new Error('WS not connected'));
        }

        const timer = setTimeout(() => {
            _wsPending.delete(id);
            reject(new Error(`WS_TIMEOUT (${timeout}ms) ${method} ${route}`));
        }, timeout);

        _wsPending.set(id, { resolve, reject, timer });

        _ws.send(JSON.stringify({
            type: 'api',
            route,
            method,
            body: body || {},
            query: query || {},
            correlation_id: id,
            token,
            _l: `${method} ${route}`
        }));
    });
}

// ═══════════════════════════════════════════════════════════════════
// WS transport — API requests
// ═══════════════════════════════════════════════════════════════════

function _sendViaWs(endpoint, method, body, query, viewScoped = false) {
    const timeout = config.ws?.apiTimeout || 5000;
    const id = `api_${++_wsCorrelationCounter}_${Date.now()}`;
    const route = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
    const token = _getToken();

    if (viewScoped) _viewWsIds.add(id);

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            _wsPending.delete(id);
            _viewWsIds.delete(id);
            reject(new Error(`WS_TIMEOUT (${timeout}ms) ${method} ${route}`));
        }, timeout);

        _wsPending.set(id, { resolve, reject, timer });

        _ws.send(JSON.stringify({
            type: 'api',
            route,
            method,
            body: body || {},
            query: query || {},
            correlation_id: id,
            token,
            _l: `${method} ${route}`
        }));
    });
}

// ═══════════════════════════════════════════════════════════════════
// Layer 6: Circuit breaker
// Primer segmento del endpoint como key (ej: '/engagement/' → 'engagement')
// ═══════════════════════════════════════════════════════════════════

function _circuitKey(endpoint) {
    const match = endpoint.match(/^\/([^/?]+)/);
    return match ? match[1] : '_root';
}

function _isCircuitOpen(endpoint) {
    const key = _circuitKey(endpoint);
    const circuit = _circuits.get(key);
    if (!circuit) return false;
    if (circuit.failures < CIRCUIT_THRESHOLD) return false;
    if (Date.now() > circuit.openUntil) {
        // Half-open: permitir un request de prueba
        circuit.failures = CIRCUIT_THRESHOLD - 1;
        return false;
    }
    return true;
}

function _circuitRecord(endpoint, success) {
    const key = _circuitKey(endpoint);
    if (success) {
        _circuits.delete(key);
        return;
    }
    const circuit = _circuits.get(key) || { failures: 0, openUntil: 0 };
    circuit.failures++;
    if (circuit.failures >= CIRCUIT_THRESHOLD) {
        circuit.openUntil = Date.now() + CIRCUIT_COOLDOWN;
        devlog(`[API] Circuit OPEN for /${key}/ (${CIRCUIT_COOLDOWN}ms cooldown)`);
    }
    _circuits.set(key, circuit);
}

// ═══════════════════════════════════════════════════════════════════
// HTTP transport con ETag (Layer 4) y retry (Layer 5)
// ═══════════════════════════════════════════════════════════════════

async function _httpFetch(url, options, endpoint) {
    const headers = { ...options.headers };
    let body = options.body;

    if (!(body instanceof FormData) && body && typeof body === 'object') {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
    }

    // Layer 4: ETag — enviar If-None-Match si tenemos etag almacenado
    const method = (options.method || 'GET').toUpperCase();
    if (method === 'GET') {
        const stored = _etagStore.get(url);
        if (stored?.etag) {
            headers['If-None-Match'] = stored.etag;
        }
    }

    try {
        devlog(`[API] HTTP ${method} ${url}`);
        const response = await fetch(url, { ...options, headers, body });

        // Layer 4: ETag — 304 Not Modified → retornar data cacheada
        if (response.status === 304) {
            const stored = _etagStore.get(url);
            if (stored?.data) {
                devlog(`[API] 304 Not Modified: ${url}`);
                return stored.data;
            }
            // 304 sin store local → limpiar etag y re-fetch sin If-None-Match
            _etagStore.delete(url);
            delete headers['If-None-Match'];
            const retry = await fetch(url, { ...options, headers, body });
            if (!retry.ok) {
                const errData = await retry.text().then(t => t ? JSON.parse(t) : {}).catch(() => ({}));
                const err = new Error(errData.message || `HTTP error! Status: ${retry.status}`);
                err.status = retry.status;
                err.response = { d: errData, status: retry.status, headers: retry.headers };
                throw err;
            }
            const retryText = await retry.text();
            const retryData = retryText ? JSON.parse(retryText) : {};
            return { d: retryData.data !== undefined ? retryData.data : retryData, status: retry.status, headers: retry.headers };
        }

        const text = await response.text();
        const data = text ? JSON.parse(text) : {};

        if (!response.ok) {
            const error = new Error(data.message || `HTTP error! Status: ${response.status}`);
            error.response = {
                d: data.data !== undefined ? data.data : data,
                status: response.status,
                headers: response.headers
            };
            error.status = response.status;
            throw error;
        }

        const result = {
            d: data.data !== undefined ? data.data : data,
            status: response.status,
            headers: response.headers
        };

        // Layer 4: ETag — almacenar etag + data para futuro 304
        const etag = response.headers.get('etag');
        if (etag) {
            _etagStore.set(url, { etag, data: result });
        }

        return result;
    } catch (error) {
        if (error.name === 'AbortError') {
            devlog('[API] Request canceled');
        } else {
            console.error('[API] Request failed:', error);
        }
        throw error;
    }
}

// Layer 5: Retry wrapper — solo GET, solo errores retryable
async function _httpWithRetry(url, options, endpoint) {
    const method = (options.method || 'GET').toUpperCase();
    const retryEnabled = options.retry !== false && method === 'GET';
    const maxRetries = retryEnabled ? RETRY_MAX : 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await _httpFetch(url, options, endpoint);
            _circuitRecord(endpoint, true);
            return result;
        } catch (error) {
            const status = error.status || 0;
            const isRetryable = RETRY_STATUS.has(status) || error.name === 'TypeError'; // TypeError = network

            if (attempt < maxRetries && isRetryable && error.name !== 'AbortError') {
                const delay = RETRY_DELAYS[attempt] || 1500;
                devlog(`[API] Retry ${attempt + 1}/${maxRetries} in ${delay}ms: ${url}`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }

            // Fallo definitivo — registrar en circuit breaker
            if (isRetryable) _circuitRecord(endpoint, false);
            throw error;
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// Transport selection — WS-first, HTTP fallback
// ═══════════════════════════════════════════════════════════════════

async function _transport(endpoint, url, options, method, viewScoped = false, hasUserSignal = false) {
    const isAbsolute = endpoint.startsWith('http://') || endpoint.startsWith('https://');
    const isFormData = options.body instanceof FormData;

    // WS: si WS_FIRST + conectado + no FormData + no signal del usuario + no URL absoluta
    // Throttle: si hay muchos requests WS pending, derivar a HTTP para evitar head-of-line blocking
    const wsFirst = config.ws?.first !== false;
    // >3 pending WS → derivar a HTTP. Un WS = 1 pipe, HTTP = 6+ paralelas del browser
    const wsOverloaded = _wsPending.size > 3;
    // hasUserSignal: solo signals de abortKey fuerzan HTTP. viewAc.signal no cuenta (WS cancela via _viewWsIds)
    if (wsFirst && _wsReady && !_wsAuthFailed && !wsOverloaded && _ws?.readyState === WebSocket.OPEN && !isAbsolute && !isFormData && !hasUserSignal) {
        try {
            const result = await _sendViaWs(endpoint, method, options.body, options.query, viewScoped);
            _circuitRecord(endpoint, true);
            return result;
        } catch (wsErr) {
            // 4xx/5xx del server = error lógico, no reintentar por HTTP
            if (wsErr.status || wsErr._wsError) throw wsErr;
            // POST/PUT/DELETE no fallback: podría duplicar escritura en el server
            if (method !== 'GET') throw wsErr;
            devlog('[API] WS transport failed, fallback HTTP:', wsErr.message);
        }
    }

    // HTTP con retry automático
    if (wsOverloaded) devlog(`[API] WS overloaded (${_wsPending.size} pending), routing HTTP: ${endpoint}`);
    return _httpWithRetry(url, options, endpoint);
}

// ═══════════════════════════════════════════════════════════════════
// Layer 7: Priority — postpone low-priority requests al idle
// ═══════════════════════════════════════════════════════════════════

function _waitForIdle() {
    return new Promise(resolve => {
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(resolve, { timeout: 2000 });
        } else {
            setTimeout(resolve, 50);
        }
    });
}

// ═══════════════════════════════════════════════════════════════════
// request() — capas 1-7 + transport
// ═══════════════════════════════════════════════════════════════════

/**
 * Smart request wrapper. Transporte WS-first con HTTP fallback.
 * Capas automáticas (GET): inflight dedup, ETag, retry, circuit breaker.
 * Opt-in: cache TTL con stale-while-revalidate, abortKey, priority.
 * @param {string} endpoint - Endpoint relativo ('/users.json') o URL absoluta.
 * @param {object} options - fetch options + extensiones:
 *   @param {number|boolean} [options.cache] - TTL en ms (GET only). true = 30s.
 *   @param {string} [options.abortKey] - Cancela request anterior con misma key.
 *   @param {boolean} [options.skipDedup] - Fuerza request aunque haya inflight.
 *   @param {boolean} [options.retry] - false para desactivar retry (default: true para GET).
 *   @param {string} [options.priority] - 'low' posterga al idle. Default: normal.
 *   @param {object} [options.query] - Query params para transporte WS.
 * @returns {Promise<{d: any, status: number, headers: Headers|object}>}
 */
async function request(endpoint, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
        ? endpoint
        : `${config.api.baseUrl}${endpoint}`;

    // Mock handler (dev only)
    if (MODE_IN === 'development' && mockApiHandler === null) {
        if (!mockApiHandler) {
            try {
                const { default: handler } = await import('./api_mock.js');
                mockApiHandler = handler;
            } catch (error) {
                devlog("¿ Do 'mock' exists ?", error);
                mockApiHandler = () => null;
            }
        }
    }
    if (MODE_IN === 'development' && mockApiHandler) {
        const mockResponse = await mockApiHandler(endpoint, options);
        if (mockResponse !== null) return mockResponse;
    }

    // ─── Layer 7: Priority (opt-in) ────────────────────────────
    if (options.priority === 'low') {
        await _waitForIdle();
    }

    // ─── Layer 3: AbortKey (opt-in) ────────────────────────────
    if (options.abortKey) {
        if (_abortControllers.has(options.abortKey)) {
            _abortControllers.get(options.abortKey).abort();
        }
        const ac = new AbortController();
        _abortControllers.set(options.abortKey, ac);
        options = { ...options, signal: ac.signal };
    }

    // ─── Layer 6: Circuit breaker (automatic) ──────────────────
    if (_isCircuitOpen(endpoint)) {
        // Circuito abierto — devolver stale cache si hay, sino error
        const stale = _cache.get(url);
        if (stale?.data) {
            devlog(`[API] Circuit open, serving stale: ${endpoint}`);
            return stale.data;
        }
        const etagStale = _etagStore.get(url);
        if (etagStale?.data) {
            devlog(`[API] Circuit open, serving etag cache: ${endpoint}`);
            return etagStale.data;
        }
        throw new Error(`Circuit breaker open for ${_circuitKey(endpoint)} — too many failures`);
    }

    // Cache/dedup key: incluir query para evitar colisiones entre requests con distinto query
    const cacheKey = options.query ? `${url}?${JSON.stringify(options.query)}` : url;

    // ─── Layer 2: Cache hit + stale-while-revalidate (GET only) ─
    if (method === 'GET' && options.cache) {
        const cached = _cache.get(cacheKey);
        if (cached) {
            // Fresh: retornar directo
            if (Date.now() < cached.expiresAt) {
                return cached.data;
            }
            // Stale pero dentro de ventana SWR: retornar stale + revalidar en background
            if (cached.staleUntil && Date.now() < cached.staleUntil) {
                devlog(`[API] SWR: serving stale, revalidating: ${endpoint}`);
                _revalidateInBackground(endpoint, url, options, method, cacheKey);
                return cached.data;
            }
        }
    }

    // ─── Layer 1: Inflight dedup (GET only, automatic) ─────────
    if (method === 'GET' && !options.skipDedup) {
        if (_inflight.has(cacheKey)) {
            return _inflight.get(cacheKey);
        }
    }

    // ─── Navigation lifecycle: view-scoped abort ──────────────
    // Default: request muere al navegar. persist:true = sobrevive (auth, profile, routes)
    const viewScoped = !options.persist;
    const requestNavId = _navId;
    // Capturar si el usuario puso signal (abortKey) ANTES de inyectar viewAc
    const hasUserSignal = !!options.signal;
    let viewAc = null;

    if (viewScoped) {
        viewAc = new AbortController();
        _viewAbortControllers.add(viewAc);
        // Encadenar: si abortKey ya creó un signal, propagarlo al viewAc
        if (options.signal) {
            options.signal.addEventListener('abort', () => viewAc.abort());
        }
        options = { ...options, signal: viewAc.signal };
    }

    // ─── Transport ─────────────────────────────────────────────
    // fetch() rechaza props custom (ej: cache:60000 vs RequestCache enum)
    const fetchOptions = _stripCustomProps(options);
    fetchOptions.query = options.query; // query se usa en WS transport, no en fetch()
    // hasUserSignal (no hasSignal): viewAc.signal no debe forzar HTTP, WS se cancela via _viewWsIds
    const promise = _transport(endpoint, url, fetchOptions, method, viewScoped, hasUserSignal);

    // Limpiar controllers cuando el request termina
    if (options.abortKey) {
        const key = options.abortKey;
        promise.finally(() => _abortControllers.delete(key));
    }
    if (viewAc) {
        promise.finally(() => _viewAbortControllers.delete(viewAc));
    }

    // Track inflight for GET
    if (method === 'GET' && !options.skipDedup) {
        const tracked = promise.then(res => {
            _inflight.delete(cacheKey);
            // Cache si opt-in
            if (options.cache) {
                const ttl = typeof options.cache === 'number' ? options.cache : 30000;
                // SWR window: 3x el TTL (ej: cache 30s → stale aceptable hasta 90s)
                _cache.set(cacheKey, {
                    data: res,
                    expiresAt: Date.now() + ttl,
                    staleUntil: Date.now() + ttl * 3
                });
            }
            return res;
        }).catch(err => {
            _inflight.delete(cacheKey);
            throw err;
        });
        _inflight.set(cacheKey, tracked);
        return tracked;
    }

    return promise;
}

// Stale-while-revalidate: refetch en background sin bloquear al caller
// Siempre por HTTP para no saturar WS con tráfico background
function _revalidateInBackground(endpoint, url, options, method, cacheKey) {
    // Evitar múltiples revalidaciones simultáneas
    const revalKey = `_reval:${cacheKey}`;
    if (_inflight.has(revalKey)) return;

    // SWR va directo a HTTP (sin pasar por request()), limpiar props custom
    const promise = _httpWithRetry(url, { ..._stripCustomProps(options), skipDedup: true }, endpoint)
        .then(res => {
            if (options.cache) {
                const ttl = typeof options.cache === 'number' ? options.cache : 30000;
                _cache.set(cacheKey, {
                    data: res,
                    expiresAt: Date.now() + ttl,
                    staleUntil: Date.now() + ttl * 3
                });
            }
            devlog(`[API] SWR revalidated: ${endpoint}`);
        })
        .catch(err => devlog('[API] SWR revalidation failed:', err.message))
        .finally(() => _inflight.delete(revalKey));

    _inflight.set(revalKey, promise);
}

// ═══════════════════════════════════════════════════════════════════
// Device fingerprint: recolecta componentes y obtiene xxh128 del server
// Cacheado por sesión (mismo dispositivo = mismo hash)
// ═══════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════
// Export público
// ═══════════════════════════════════════════════════════════════════

export const api = {
    /**
     * GET request. Dedup automático (misma URL en vuelo = 1 request).
     * ETag transparente. Retry automático en 5xx/network (max 2).
     * @param {string} endpoint - Endpoint a llamar.
     * @param {object} options - fetch options + { cache, abortKey, skipDedup, retry, priority }.
     */
    get: (endpoint, options = {}) => request(endpoint, { method: 'GET', ...options }),

    /**
     * POST request.
     * @param {string} endpoint - Endpoint a llamar.
     * @param {object} body - Body del request (auto-serializado a JSON).
     * @param {object} options - fetch options.
     */
    post: (endpoint, body, options = {}) => request(endpoint, { method: 'POST', body, ...options }),

    /**
     * PUT request.
     * @param {string} endpoint - Endpoint a llamar.
     * @param {object} body - Body del request.
     * @param {object} options - fetch options.
     */
    put: (endpoint, body, options = {}) => request(endpoint, { method: 'PUT', body, ...options }),

    /**
     * PATCH request.
     * @param {string} endpoint - Endpoint a llamar.
     * @param {object} body - Body del request.
     * @param {object} options - fetch options.
     */
    patch: (endpoint, body, options = {}) => request(endpoint, { method: 'PATCH', body, ...options }),

    /**
     * DELETE request.
     * @param {string} endpoint - Endpoint a llamar.
     * @param {object} options - fetch options.
     */
    del: (endpoint, options = {}) => request(endpoint, { method: 'DELETE', ...options }),

    /**
     * Prefetch: GET en background con prioridad baja + cache.
     * El response se almacena en cache para que el próximo api.get() lo sirva instant.
     * @param {string} endpoint - Endpoint a precargar.
     * @param {number} [cacheTtl=60000] - TTL del cache en ms (default 60s).
     */
    prefetch: (endpoint, cacheTtl = 60000) => {
        request(endpoint, { method: 'GET', cache: cacheTtl, priority: 'low', skipDedup: false })
            .catch(e => devlog('[API] Prefetch failed:', e.message));
    },

    /**
     * Cancela requests view-scoped (HTTP + WS). Incrementa navId.
     * Llamar al inicio de cada navegación (router.js).
     * Requests con persist:true sobreviven.
     */
    abortViewRequests: () => {
        _navId++;
        // HTTP: abortar controllers view-scoped
        for (const ac of _viewAbortControllers) {
            ac.abort();
        }
        _viewAbortControllers.clear();
        // WS: rechazar pending view-scoped como AbortError (no infla circuit breaker)
        for (const id of _viewWsIds) {
            if (_wsPending.has(id)) {
                const pending = _wsPending.get(id);
                if (pending.timer) clearTimeout(pending.timer);
                const err = new Error('NavigationAborted');
                err.name = 'AbortError';
                pending.reject(err);
                _wsPending.delete(id);
            }
        }
        _viewWsIds.clear();
        // Dedup: limpiar para que la nueva vista pueda re-fetch las mismas URLs
        _inflight.clear();
        devlog(`[API] View requests aborted (navId=${_navId})`);
    },

    /**
     * Cancela TODO: view-scoped + persist. Para logout o error fatal.
     */
    abortAll: () => {
        api.abortViewRequests();
        // Rechazar todo WS pending restante (persist requests)
        for (const [id, pending] of _wsPending) {
            if (pending.timer) clearTimeout(pending.timer);
            pending.reject(new Error('AbortAll'));
        }
        _wsPending.clear();
        // Abortar abortKey controllers
        for (const [, ac] of _abortControllers) {
            ac.abort();
        }
        _abortControllers.clear();
    },

    /**
     * Inicia conexión WS al channel server. Auth automática via cookie bnxt.
     * Heartbeat cada 30s. Reconnect con exponential backoff (1s → 30s max).
     * WS_FIRST=false en .env → WS solo para push/subscribe, API requests por HTTP.
     */
    connect: () => _connectWs(),

    /**
     * Cierra WS manualmente. No auto-reconnect.
     */
    disconnect: (code = 1000, reason = 'client closed') => {
        if (_wsReconnectTimer) { clearTimeout(_wsReconnectTimer); _wsReconnectTimer = null; }
        _stopHeartbeat();
        if (_ws) {
            _ws.onclose = null;
            _ws.close(code, reason);
            _ws = null;
        }
        _wsReady = false;
        _wsConnected = false;
        _emit('close', { code, reason, manual: true });
    },

    /** @returns {boolean} true si WS autenticado y listo para transportar API */
    get wsConnected() { return _wsReady; },

    /** @returns {boolean} true si WS abierto (puede ser sin auth — solo push/subscribe) */
    get wsOpen() { return _wsConnected; },

    /**
     * Invalida cache por prefijo. Sin args = flush total.
     * @param {string} [prefix] - Prefijo de endpoint (ej: '/engagement/')
     */
    invalidate: (prefix) => {
        if (!prefix) { _cache.clear(); _etagStore.clear(); return; }
        const fullPrefix = `${config.api.baseUrl}${prefix}`;
        for (const key of _cache.keys()) {
            if (key.startsWith(fullPrefix)) _cache.delete(key);
        }
        for (const key of _etagStore.keys()) {
            if (key.startsWith(fullPrefix)) _etagStore.delete(key);
        }
    },

    /**
     * Suscribe a un canal WS. Persiste entre reconexiones (auto-resubscribe).
     * @param {string} channel - Nombre del canal (ej: 'chat:engagement:456')
     */
    subscribe: (channel) => {
        if (!channel) return;
        _subscriptions.add(channel);
        if (_ws?.readyState === WebSocket.OPEN) {
            _ws.send(JSON.stringify({ type: 'subscribe', channel }));
        }
    },

    /**
     * Desuscribe de un canal WS.
     * @param {string} channel - Nombre del canal
     */
    unsubscribe: (channel) => {
        if (!channel) return;
        _subscriptions.delete(channel);
        if (_ws?.readyState === WebSocket.OPEN) {
            _ws.send(JSON.stringify({ type: 'unsubscribe', channel }));
        }
    },

    /**
     * Registra handler para eventos WS. Retorna función de unsub.
     * Eventos: 'ready', 'close', 'message', 'error', 'reconnecting',
     *          'system:logout', 'system:permissions', 'subscribed', 'unsubscribed'
     * @param {string} event - Nombre del evento
     * @param {function} handler - Callback
     * @returns {function} unsubscribe — llamar para dejar de escuchar
     */
    on: (event, handler) => {
        if (!_eventHandlers.has(event)) _eventHandlers.set(event, new Set());
        _eventHandlers.get(event).add(handler);
        return () => _eventHandlers.get(event)?.delete(handler);
    },

    /**
     * Obtiene el device fingerprint (xxh128, 32 hex) del servidor.
     * Recolecta componentes del dispositivo y los envía a /profile/fingerprint.
     * Cacheado por sesión — mismo dispositivo = mismo hash.
     * @returns {Promise<string|null>} xxh128 hash o null si falla
     */
    fingerprint: async () => {
        if (_fpCache) return _fpCache;
        try {
            const components = await collectDeviceComponents();
            const res = await request('/profile/fingerprint', {
                method: 'POST',
                body: { components },
                persist: true
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
