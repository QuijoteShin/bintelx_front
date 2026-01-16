// src/bnx/components/list-popover/ListPopover.js
// Enhancer para inputs con list="*" - reemplaza datalist nativo por dialog modal con supercharged-list
import './ListPopover.css';

// Normaliza texto removiendo acentos para búsqueda latin-friendly
const normalizeText = (str) => {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

class ListPopover {
    constructor(input, options = {}) {
        this.input = input;
        this.options = {
            multiple: options.multiple ?? input.hasAttribute('multiple'),
            searchable: options.searchable ?? true,
            ...options
        };

        this._items = [];
        this._filteredItems = [];
        this._selectedValues = new Set();
        this._highlightedIndex = -1;
        this._isOpen = false;
        this._dialog = null;
        this._datalist = null;

        this._init();
    }

    _init() {
        // Obtener datalist asociado
        const listId = this.input.getAttribute('list');
        if (listId) {
            this._datalist = document.getElementById(listId);
            if (this._datalist) {
                this._extractOptionsFromDatalist();
            }
        }

        // Prevenir datalist nativo
        this.input.removeAttribute('list');
        this.input.setAttribute('data-list-popover', listId || 'true');
        this.input.setAttribute('autocomplete', 'off');

        // Agregar chevron
        this._wrapInput();

        // Crear dialog modal (tiene focus trap nativo)
        this._createDialog();

        // Event listeners
        this._setupEventListeners();

        // Valor inicial
        if (this.input.value) {
            this._setInitialValue(this.input.value);
        }
    }

    _extractOptionsFromDatalist() {
        if (!this._datalist) return;

        const options = this._datalist.querySelectorAll('option');
        this._items = Array.from(options).map(opt => ({
            value: opt.value,
            label: opt.textContent || opt.value,
            html: opt.dataset.html || null
        }));
        this._filteredItems = [...this._items];
    }

    _wrapInput() {
        if (this.input.parentElement?.classList.contains('list-popover-trigger')) {
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'list-popover-trigger';

        this.input.parentNode.insertBefore(wrapper, this.input);
        wrapper.appendChild(this.input);

        const chevron = document.createElement('span');
        chevron.className = 'list-popover-chevron';
        chevron.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
        wrapper.appendChild(chevron);

        this._wrapper = wrapper;
        this._chevron = chevron;
    }

    _createDialog() {
        // Usar <dialog> nativo - tiene focus trap con showModal()
        this._dialog = document.createElement('dialog');
        this._dialog.className = 'list-popover-dialog';

        this._dialog.innerHTML = `
            <div class="list-popover-content">
                <div class="list-popover-header">
                    <input type="search"
                           class="list-popover-search"
                           placeholder="Buscar..."
                           autocomplete="off"
                           ${!this.options.searchable ? 'style="display:none"' : ''}>
                    <button type="button" class="list-popover-close" aria-label="Cerrar">&times;</button>
                </div>
                <div class="list-popover-body">
                    <div class="supercharged-list list-popover-list"></div>
                    <div class="list-popover-empty">Sin resultados</div>
                </div>
                ${this.options.multiple ? `
                <div class="list-popover-footer">
                    <button type="button" class="button-secondary list-popover-clear">Limpiar</button>
                    <button type="button" class="button-primary list-popover-confirm">Confirmar</button>
                </div>` : ''}
            </div>
        `;

        document.body.appendChild(this._dialog);

        this._searchInput = this._dialog.querySelector('.list-popover-search');
        this._listEl = this._dialog.querySelector('.list-popover-list');
        this._emptyEl = this._dialog.querySelector('.list-popover-empty');
        this._closeBtn = this._dialog.querySelector('.list-popover-close');
        this._clearBtn = this._dialog.querySelector('.list-popover-clear');
        this._confirmBtn = this._dialog.querySelector('.list-popover-confirm');
    }

    _setupEventListeners() {
        // Click en wrapper abre dialog
        this._wrapper.addEventListener('click', (e) => {
            if (e.target !== this._searchInput) {
                this._open();
            }
        });

        // Teclas en input principal
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                e.preventDefault();
                this._open();
            }
        });

        // Búsqueda
        this._searchInput?.addEventListener('input', (e) => {
            this._filter(e.target.value);
        });

        // Teclas en búsqueda
        this._searchInput?.addEventListener('keydown', (e) => {
            this._handleKeydown(e);
        });

        // Cerrar botón
        this._closeBtn?.addEventListener('click', () => this._close());

        // Multiple: confirmar/limpiar
        if (this.options.multiple) {
            this._confirmBtn?.addEventListener('click', () => {
                this._applySelection();
                this._close();
            });
            this._clearBtn?.addEventListener('click', () => {
                this._selectedValues.clear();
                this._renderList();
            });
        }

        // Click en backdrop cierra (dialog nativo)
        this._dialog.addEventListener('click', (e) => {
            if (e.target === this._dialog) {
                this._close();
            }
        });

        // Escape cierra (dialog nativo ya maneja esto, pero agregamos para consistencia)
        this._dialog.addEventListener('cancel', (e) => {
            e.preventDefault();
            this._close();
        });
    }

    _handleKeydown(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this._highlightNext();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this._highlightPrev();
                break;
            case 'Enter':
                e.preventDefault();
                if (this._highlightedIndex >= 0) {
                    this._toggleItem(this._filteredItems[this._highlightedIndex]);
                }
                break;
            case 'Tab':
                // Mantener foco dentro del dialog - el dialog nativo ya hace esto con showModal()
                break;
        }
    }

    _open() {
        if (this._isOpen) return;

        this._filter('');
        if (this._searchInput) {
            this._searchInput.value = '';
        }
        this._renderList();

        // showModal() tiene focus trap nativo
        this._dialog.showModal();
        this._isOpen = true;
        this._wrapper.classList.add('is-open');

        // Focus en búsqueda
        setTimeout(() => {
            this._searchInput?.focus();
        }, 50);
    }

    _close() {
        if (!this._isOpen) return;

        this._dialog.close();
        this._isOpen = false;
        this._wrapper.classList.remove('is-open');
        this._highlightedIndex = -1;
        this.input.focus();
    }

    _filter(query) {
        const normalizedQuery = normalizeText(query);

        if (!normalizedQuery) {
            this._filteredItems = [...this._items];
        } else {
            this._filteredItems = this._items.filter(item => {
                const normalizedLabel = normalizeText(item.label);
                const normalizedValue = normalizeText(item.value);
                return normalizedLabel.includes(normalizedQuery) ||
                       normalizedValue.includes(normalizedQuery);
            });
        }

        this._highlightedIndex = -1;
        this._renderList();
    }

    _renderList() {
        if (this._filteredItems.length === 0) {
            this._listEl.innerHTML = '';
            this._emptyEl.style.display = 'block';
            return;
        }

        this._emptyEl.style.display = 'none';

        const inputType = this.options.multiple ? 'checkbox' : 'radio';
        const inputName = `list-popover-${this.input.id || Math.random().toString(36).substr(2, 9)}`;

        this._listEl.innerHTML = this._filteredItems.map((item, idx) => {
            const isChecked = this._selectedValues.has(item.value);
            const isHighlighted = idx === this._highlightedIndex;

            return `
                <label class="list-item ${isHighlighted ? 'is-highlighted' : ''}" data-index="${idx}" data-value="${this._escapeHtml(item.value)}">
                    <input type="${inputType}"
                           name="${inputName}"
                           value="${this._escapeHtml(item.value)}"
                           ${isChecked ? 'checked' : ''}>
                    <span class="checkbox-icon-placeholder"></span>
                    <span class="list-item-label">${item.html || this._escapeHtml(item.label)}</span>
                </label>
            `;
        }).join('');

        // Event listeners para items
        this._listEl.querySelectorAll('.list-item').forEach(label => {
            label.addEventListener('click', (e) => {
                const idx = parseInt(label.dataset.index);
                const item = this._filteredItems[idx];

                if (!this.options.multiple) {
                    e.preventDefault();
                    this._selectSingle(item);
                } else {
                    e.preventDefault();
                    this._toggleItem(item);
                }
            });

            label.addEventListener('mouseenter', () => {
                const idx = parseInt(label.dataset.index);
                this._setHighlight(idx);
            });
        });
    }

    _selectSingle(item) {
        this._selectedValues.clear();
        this._selectedValues.add(item.value);
        this.input.value = item.label;

        this.input.dispatchEvent(new Event('change', { bubbles: true }));
        this.input.dispatchEvent(new CustomEvent('list-popover-change', {
            bubbles: true,
            detail: { value: item.value, label: item.label, item }
        }));

        this._close();
    }

    _toggleItem(item) {
        if (this._selectedValues.has(item.value)) {
            this._selectedValues.delete(item.value);
        } else {
            this._selectedValues.add(item.value);
        }
        this._renderList();
    }

    _applySelection() {
        const values = Array.from(this._selectedValues);
        const labels = values.map(v => {
            const item = this._items.find(i => i.value === v);
            return item?.label || v;
        });

        this.input.value = labels.join(', ');

        this.input.dispatchEvent(new Event('change', { bubbles: true }));
        this.input.dispatchEvent(new CustomEvent('list-popover-change', {
            bubbles: true,
            detail: {
                values,
                labels,
                items: values.map(v => this._items.find(i => i.value === v))
            }
        }));
    }

    _highlightNext() {
        const maxIndex = this._filteredItems.length - 1;
        if (maxIndex < 0) return;
        const newIndex = this._highlightedIndex < maxIndex ? this._highlightedIndex + 1 : 0;
        this._setHighlight(newIndex);
    }

    _highlightPrev() {
        const maxIndex = this._filteredItems.length - 1;
        if (maxIndex < 0) return;
        const newIndex = this._highlightedIndex > 0 ? this._highlightedIndex - 1 : maxIndex;
        this._setHighlight(newIndex);
    }

    _setHighlight(index) {
        const prev = this._listEl.querySelector('.is-highlighted');
        if (prev) prev.classList.remove('is-highlighted');

        this._highlightedIndex = index;

        const label = this._listEl.querySelector(`[data-index="${index}"]`);
        if (label) {
            label.classList.add('is-highlighted');
            label.scrollIntoView({ block: 'nearest' });
        }
    }

    _setInitialValue(value) {
        if (!this.options.multiple) {
            const item = this._items.find(i => i.value === value || i.label === value);
            if (item) {
                this._selectedValues.add(item.value);
                this.input.value = item.label;
            }
        } else {
            const values = value.split(',').map(v => v.trim());
            values.forEach(v => {
                const item = this._items.find(i => i.value === v || i.label === v);
                if (item) {
                    this._selectedValues.add(item.value);
                }
            });
        }
    }

    _escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // API pública

    setItems(items) {
        this._items = items.map(item => {
            if (typeof item === 'string') {
                return { value: item, label: item, html: null };
            }
            return {
                value: item.value ?? item,
                label: item.label ?? item.name ?? item.value ?? item,
                html: item.html || null
            };
        });
        this._filteredItems = [...this._items];

        if (this.input.value) {
            this._setInitialValue(this.input.value);
        }
    }

    getSelectedValues() {
        return Array.from(this._selectedValues);
    }

    getValue() {
        return this.options.multiple
            ? this.getSelectedValues()
            : (this.getSelectedValues()[0] || '');
    }

    setValue(value) {
        this._selectedValues.clear();

        if (this.options.multiple && Array.isArray(value)) {
            value.forEach(v => this._selectedValues.add(v));
            const labels = value.map(v => {
                const item = this._items.find(i => i.value === v);
                return item?.label || v;
            });
            this.input.value = labels.join(', ');
        } else {
            const item = this._items.find(i => i.value === value);
            if (item) {
                this._selectedValues.add(item.value);
                this.input.value = item.label;
            }
        }
    }

    open() {
        this._open();
    }

    close() {
        this._close();
    }

    destroy() {
        this._dialog?.remove();
        if (this._wrapper && this._wrapper.parentNode) {
            this._wrapper.parentNode.insertBefore(this.input, this._wrapper);
            this._wrapper.remove();
        }
        const listId = this.input.getAttribute('data-list-popover');
        if (listId && listId !== 'true') {
            this.input.setAttribute('list', listId);
        }
        this.input.removeAttribute('data-list-popover');
    }
}

// Auto-init para inputs con list="*"
function initListPopovers(container = document) {
    const inputs = container.querySelectorAll('input[list]:not([data-list-popover])');
    const instances = [];

    inputs.forEach(input => {
        instances.push(new ListPopover(input));
    });

    return instances;
}

if (typeof window !== 'undefined') {
    window.ListPopover = ListPopover;
    window.initListPopovers = initListPopovers;
}

export { ListPopover, initListPopovers };
export default ListPopover;
