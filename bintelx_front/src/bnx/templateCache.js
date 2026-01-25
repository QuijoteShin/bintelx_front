// src/bnx/templateCache.js
// Template prefetch and cache system for CSR templates

const cache = new Map();
const pending = new Map();

/**
 * Prefetch a template from the backend and cache it
 * @param {string} path - Template path relative to TPL_PATH (without .tpls extension)
 * @returns {Promise<string|null>} Template content or null if not found
 * @example
 *   await prefetchTemplate('quote/preview');
 *   await prefetchTemplate('engagement/offerings/card');
 */
export async function prefetchTemplate(path) {
    if (cache.has(path)) return cache.get(path);
    if (pending.has(path)) return pending.get(path);

    const promise = fetch(`/api/tpl/${path}.tpls`)
        .then(r => {
            if (!r.ok) throw new Error(`Template ${path} not found`);
            return r.text();
        })
        .then(tpl => {
            cache.set(path, tpl);
            return tpl;
        })
        .catch(err => {
            console.error('[templateCache]', err.message);
            return null; // Allows retries
        })
        .finally(() => {
            pending.delete(path); // Always clean pending
        });

    pending.set(path, promise);
    return promise;
}

/**
 * Get a template from cache (synchronous)
 * @param {string} path - Template path
 * @returns {string|undefined} Template content or undefined if not cached
 */
export function getTemplate(path) {
    return cache.get(path);
}

/**
 * Check if a template is cached
 * @param {string} path - Template path
 * @returns {boolean}
 */
export function hasTemplate(path) {
    return cache.has(path);
}

/**
 * Clear the template cache
 * @param {string} [path] - Optional specific path to clear, if omitted clears all
 */
export function clearCache(path) {
    if (path) {
        cache.delete(path);
    } else {
        cache.clear();
    }
}

/**
 * Pre-warm multiple templates in parallel
 * @param {string[]} paths - Array of template paths
 * @returns {Promise<(string|null)[]>} Array of template contents
 * @example
 *   await prefetchTemplates(['quote/preview', 'quote/list', 'quote/detail']);
 */
export function prefetchTemplates(paths) {
    return Promise.all(paths.map(p => prefetchTemplate(p)));
}

/**
 * Get a template, fetching if not cached
 * @param {string} path - Template path
 * @returns {Promise<string|null>} Template content
 */
export async function ensureTemplate(path) {
    return getTemplate(path) ?? await prefetchTemplate(path);
}

/**
 * Get cache statistics
 * @returns {{ cached: number, pending: number }}
 */
export function getCacheStats() {
    return {
        cached: cache.size,
        pending: pending.size
    };
}
