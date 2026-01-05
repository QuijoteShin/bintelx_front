// src/bnx/components/shadow/Shadow.js
// Componente wrapper que encapsula cualquier contenido en Shadow DOM

class BnxShadow extends HTMLElement {
  static get observedAttributes() {
    return ['css', 'mode'];
  }

  constructor() {
    super();
    const mode = this.getAttribute('mode') === 'closed' ? 'closed' : 'open';
    this.attachShadow({ mode });
    this._initialized = false;
  }

  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    this._render();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal || !this._initialized) return;
    if (name === 'css') {
      this._updateStyles();
    }
  }

  _render() {
    const cssAttr = this.getAttribute('css');

    // Construir estilos
    let styles = '';
    if (cssAttr) {
      // Puede ser URL o selector de <style>/<link>
      if (cssAttr.startsWith('http') || cssAttr.startsWith('/') || cssAttr.endsWith('.css')) {
        styles = `<link rel="stylesheet" href="${cssAttr}">`;
      } else {
        // Intentar copiar estilos de un elemento existente
        const styleEl = document.querySelector(cssAttr);
        if (styleEl) {
          styles = `<style>${styleEl.textContent || ''}</style>`;
        }
      }
    }

    // Mover contenido light DOM al shadow DOM
    const content = this.innerHTML;
    this.innerHTML = '';

    this.shadowRoot.innerHTML = `${styles}<div class="bnx-shadow-content">${content}</div>`;
  }

  _updateStyles() {
    const cssAttr = this.getAttribute('css');
    if (!cssAttr) return;

    // Remover estilos existentes
    const existing = this.shadowRoot.querySelector('link, style:first-child');
    if (existing) existing.remove();

    // Agregar nuevos
    let styleEl;
    if (cssAttr.startsWith('http') || cssAttr.startsWith('/') || cssAttr.endsWith('.css')) {
      styleEl = document.createElement('link');
      styleEl.rel = 'stylesheet';
      styleEl.href = cssAttr;
    } else {
      const source = document.querySelector(cssAttr);
      if (source) {
        styleEl = document.createElement('style');
        styleEl.textContent = source.textContent || '';
      }
    }

    if (styleEl) {
      this.shadowRoot.insertBefore(styleEl, this.shadowRoot.firstChild);
    }
  }

  // API pública para inyectar CSS dinámicamente
  injectCSS(css) {
    const style = document.createElement('style');
    style.textContent = css;
    this.shadowRoot.appendChild(style);
  }

  injectStylesheet(url) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    this.shadowRoot.appendChild(link);
  }

  // Acceso al contenido
  get content() {
    return this.shadowRoot.querySelector('.bnx-shadow-content');
  }
}

customElements.define('bnx-shadow', BnxShadow);

export { BnxShadow };
