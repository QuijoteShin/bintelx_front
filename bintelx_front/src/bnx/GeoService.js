// src/bnx/GeoService.js
// Kernel centralizado para operaciones de GeoService (tasas, monedas, impuestos)
import { api } from './api.js';
import { devlog } from './utils.js';

class GeoServiceSingleton {
    constructor() {
        this.baseCurrency = 'CLP';
        this.country = 'CL';
        this.exchangeRates = {};   // { UF: 38500, USD: 950, UTM: 66800, ... }
        this.taxRates = {};        // { VAT19: 0.19, ... }
        this.loadedAt = null;
        this._loadPromise = null;
        this._subscribers = [];
    }

    // =========================================================================
    // CARGA Y CACHE
    // =========================================================================

    /**
     * Carga datos de geo (tasas, impuestos). Cachea automáticamente.
     * @param {string} country - Código país ISO (default: 'CL')
     * @param {boolean} force - Forzar recarga ignorando cache
     */
    async load(country = 'CL', force = false) {
        // Si ya está cargado y no forzamos, retornar
        if (!force && this.loadedAt && Object.keys(this.exchangeRates).length > 0) {
            return this;
        }

        // Si hay una carga en progreso, esperar esa
        if (this._loadPromise) {
            return this._loadPromise;
        }

        this._loadPromise = (async () => {
            try {
                const res = await api.get(`/geo/rates/${country}.json`);
                if (res?.d?.success) {
                    this.exchangeRates = res.d.exchangeRates || {};
                    this.taxRates = res.d.taxRates || {};
                    this.baseCurrency = res.d.baseCurrency || 'CLP';
                    this.country = country;
                    this.loadedAt = Date.now();
                    devlog('[GeoService] Loaded:', Object.keys(this.exchangeRates));
                    this._notifySubscribers();
                }
            } catch (err) {
                devlog('[GeoService] Error loading:', err.message);
            }
            this._loadPromise = null;
            return this;
        })();

        return this._loadPromise;
    }

    /**
     * Verifica si los datos están cargados
     */
    isLoaded() {
        return this.loadedAt !== null && Object.keys(this.exchangeRates).length > 0;
    }

    /**
     * Obtiene todos los datos cargados (para pasar a componentes)
     */
    getData() {
        return {
            baseCurrency: this.baseCurrency,
            country: this.country,
            exchangeRates: { ...this.exchangeRates },
            taxRates: { ...this.taxRates },
            loadedAt: this.loadedAt
        };
    }

    // =========================================================================
    // TASAS DE CAMBIO
    // =========================================================================

    /**
     * Obtiene tasa de cambio para una moneda
     * @param {string} currency - Código de moneda (UF, USD, etc.)
     * @returns {number|null} - Tasa o null si no existe
     */
    getRate(currency) {
        if (!currency || currency === this.baseCurrency) return 1;
        return this.exchangeRates?.[currency] || null;
    }

    /**
     * Obtiene todas las tasas disponibles
     */
    getAllRates() {
        return this.exchangeRates ? { ...this.exchangeRates } : {};
    }

    /**
     * Lista de monedas disponibles (incluye base)
     */
    getAvailableCurrencies() {
        if (!this.exchangeRates) return [this.baseCurrency];
        return [this.baseCurrency, ...Object.keys(this.exchangeRates).sort()];
    }

    // =========================================================================
    // CONVERSIÓN
    // =========================================================================

    /**
     * Convierte desde base currency a otra moneda
     * @param {number} baseAmount - Monto en base currency (CLP)
     * @param {string} toCurrency - Moneda destino
     */
    convert(baseAmount, toCurrency) {
        if (!toCurrency || toCurrency === this.baseCurrency) {
            return baseAmount;
        }
        const rate = this.getRate(toCurrency);
        if (!rate) return baseAmount;
        return baseAmount / rate;
    }

    /**
     * Convierte desde cualquier moneda a base currency
     * @param {number} amount - Monto en moneda origen
     * @param {string} fromCurrency - Moneda origen
     */
    toBase(amount, fromCurrency) {
        if (!fromCurrency || fromCurrency === this.baseCurrency) {
            return amount;
        }
        const rate = this.getRate(fromCurrency);
        if (!rate) return amount;
        return amount * rate;
    }

    // =========================================================================
    // FORMATEO
    // =========================================================================

    /**
     * Formatea en base currency (CLP)
     * @param {number} amount - Monto a formatear
     */
    formatBase(amount) {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            maximumFractionDigits: 0
        }).format(amount || 0);
    }

    /**
     * Formatea en cualquier moneda
     * @param {number} baseAmount - Monto en base currency
     * @param {string} currency - Moneda para mostrar (null = base)
     */
    format(baseAmount, currency = null) {
        currency = currency || this.baseCurrency;
        if (currency === this.baseCurrency) {
            return this.formatBase(baseAmount);
        }
        const converted = this.convert(baseAmount, currency);
        return `${currency} ${converted.toFixed(2)}`;
    }

    /**
     * Formatea con moneda alternativa (para mostrar equivalencia)
     * @param {number} baseAmount - Monto en base currency
     * @param {string} mainCurrency - Moneda principal de display
     * @returns {string} - "≈ UF 2.50" o "≈ $96.250"
     */
    formatAlt(baseAmount, mainCurrency) {
        // Guard si exchangeRates no está cargado
        if (!this.exchangeRates || Object.keys(this.exchangeRates).length === 0) {
            return '';
        }
        if (mainCurrency === this.baseCurrency) {
            // Mostrar en UF si existe, sino primera disponible
            const altCurrency = this.exchangeRates['UF'] ? 'UF' : Object.keys(this.exchangeRates)[0];
            if (altCurrency && this.exchangeRates[altCurrency]) {
                const converted = baseAmount / this.exchangeRates[altCurrency];
                return `≈ ${altCurrency} ${converted.toFixed(2)}`;
            }
            return '';
        }
        // Cuando mostramos en moneda alternativa, mostrar base como alt
        return `≈ ${this.formatBase(baseAmount)}`;
    }

    /**
     * Formatea tasa de cambio para display
     * @param {string} currency - Moneda
     * @returns {string} - "1 UF = $38.500" o ""
     */
    formatRateDisplay(currency) {
        if (!currency || currency === this.baseCurrency) return '';
        const rate = this.getRate(currency);
        if (!rate) return '';
        return `1 ${currency} = ${this.formatBase(rate)}`;
    }

    // =========================================================================
    // UI HELPERS
    // =========================================================================

    /**
     * Poblar un <select> con las monedas disponibles
     * @param {HTMLSelectElement} selectEl - Elemento select
     * @param {string} currentValue - Valor actual a seleccionar
     */
    populateSelector(selectEl, currentValue = null) {
        if (!selectEl) return;

        selectEl.innerHTML = `<option value="${this.baseCurrency}">${this.baseCurrency}</option>`;

        if (this.exchangeRates) {
            Object.keys(this.exchangeRates).sort().forEach(code => {
                const option = document.createElement('option');
                option.value = code;
                option.textContent = code;
                selectEl.appendChild(option);
            });
        }

        if (currentValue && (currentValue === this.baseCurrency || this.exchangeRates?.[currentValue])) {
            selectEl.value = currentValue;
        }
    }

    /**
     * Crear HTML de selector de moneda (para templates)
     * @param {string} id - ID del select
     * @param {string} currentValue - Valor seleccionado
     * @param {string} className - Clases CSS
     */
    selectorHTML(id = 'currency-selector', currentValue = null, className = '') {
        const current = currentValue || this.baseCurrency;
        let html = `<select id="${id}" class="${className}">`;
        html += `<option value="${this.baseCurrency}" ${current === this.baseCurrency ? 'selected' : ''}>${this.baseCurrency}</option>`;

        if (this.exchangeRates) {
            Object.keys(this.exchangeRates).sort().forEach(code => {
                html += `<option value="${code}" ${current === code ? 'selected' : ''}>${code}</option>`;
            });
        }

        html += '</select>';
        return html;
    }

    // =========================================================================
    // IMPUESTOS
    // =========================================================================

    /**
     * Obtiene tasa de IVA/VAT
     * @param {string} rateKey - Clave del impuesto (default: 'VAT19')
     */
    getVatRate(rateKey = 'VAT19') {
        const rate = this.taxRates[rateKey];
        if (rate) return parseFloat(rate) / 100;
        return 0.19; // Default Chile
    }

    /**
     * Obtiene todas las tasas de impuestos
     */
    getAllTaxRates() {
        return { ...this.taxRates };
    }

    /**
     * Calcula base imponible (sin IVA)
     * @param {number} grossAmount - Monto con IVA
     * @param {string} rateKey - Clave del impuesto
     */
    toNetAmount(grossAmount, rateKey = 'VAT19') {
        const vatRate = this.getVatRate(rateKey);
        return grossAmount / (1 + vatRate);
    }

    /**
     * Calcula monto con IVA
     * @param {number} netAmount - Monto sin IVA
     * @param {string} rateKey - Clave del impuesto
     */
    toGrossAmount(netAmount, rateKey = 'VAT19') {
        const vatRate = this.getVatRate(rateKey);
        return netAmount * (1 + vatRate);
    }

    // =========================================================================
    // SUSCRIPCIONES (para reactivo)
    // =========================================================================

    /**
     * Suscribirse a cambios en los datos
     * @param {Function} callback - Función a llamar cuando hay cambios
     * @returns {Function} - Función para desuscribirse
     */
    subscribe(callback) {
        this._subscribers.push(callback);
        return () => {
            this._subscribers = this._subscribers.filter(cb => cb !== callback);
        };
    }

    _notifySubscribers() {
        const data = this.getData();
        this._subscribers.forEach(cb => {
            try {
                cb(data);
            } catch (err) {
                devlog('[GeoService] Subscriber error:', err);
            }
        });
    }
}

// Singleton exportado
export const GeoService = new GeoServiceSingleton();
export default GeoService;
