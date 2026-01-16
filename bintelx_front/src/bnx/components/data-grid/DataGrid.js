// src/bnx/components/data-grid/DataGrid.js

class BnxDataGrid extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._data = [];
        this._columns = [];
        this._cardTemplate = null;
        this._editableColumns = new Set();
    }

    static get observedAttributes() {
        return ['mode', 'selectable', 'row-key'];
    }

    connectedCallback() {
        this.render();
        this._setupKeyboardNavigation();
    }

    attributeChangedCallback() {
        if (this.shadowRoot.innerHTML) {
            this.render();
        }
    }

    get mode() {
        return this.getAttribute('mode') || 'spreadsheet';
    }

    get selectable() {
        return this.hasAttribute('selectable');
    }

    get rowKey() {
        return this.getAttribute('row-key') || 'id';
    }

    # --- Public API ---

    setColumns(columns) {
        # columns: [{ key, label, type, editable, width, align, format, badge }]
        this._columns = columns;
        this._editableColumns = new Set(
            columns.filter(c => c.editable).map(c => c.key)
        );
        this.render();
    }

    setData(data) {
        this._data = Array.isArray(data) ? data : [];
        this.render();
    }

    getData() {
        return this._data;
    }

    setCardTemplate(templateFn) {
        # templateFn: (item, index) => HTML string
        this._cardTemplate = templateFn;
        if (this.mode === 'cards') {
            this.render();
        }
    }

    addRow(row) {
        this._data.push(row);
        this.render();
    }

    updateRow(key, updates) {
        const idx = this._data.findIndex(r => r[this.rowKey] === key);
        if (idx !== -1) {
            this._data[idx] = { ...this._data[idx], ...updates };
            this.render();
        }
    }

    deleteRow(key) {
        this._data = this._data.filter(r => r[this.rowKey] !== key);
        this.render();
    }

    # --- Rendering ---

    render() {
        const styles = this._getStyles();
        const content = this.mode === 'cards'
            ? this._renderCards()
            : this._renderSpreadsheet();

        this.shadowRoot.innerHTML = `
            <style>${styles}</style>
            <div class="data-grid data-grid--${this.mode}">
                ${content}
            </div>
        `;

        if (this.mode === 'spreadsheet') {
            this._attachSpreadsheetListeners();
        } else {
            this._attachCardListeners();
        }
    }

    _renderSpreadsheet() {
        if (!this._columns.length) {
            return '<div class="empty-state">No columns defined</div>';
        }

        const headerCells = this._columns.map(col => {
            const align = col.align || (col.type === 'number' ? 'right' : 'left');
            const editableClass = col.editable ? 'col-editable' : '';
            const width = col.width ? `width: ${col.width};` : '';
            return `<th class="${editableClass}" style="text-align: ${align}; ${width}">${col.label}</th>`;
        }).join('');

        const rows = this._data.map((row, rowIdx) => {
            const cells = this._columns.map((col, colIdx) => {
                const value = row[col.key] ?? '';
                const align = col.align || (col.type === 'number' ? 'right' : 'left');
                const editable = col.editable ? 'contenteditable="true"' : '';
                const editableClass = col.editable ? 'cell-editable' : '';
                const formatted = this._formatValue(value, col);

                return `<td
                    class="${editableClass} cell-${col.type || 'text'}"
                    style="text-align: ${align};"
                    data-row="${rowIdx}"
                    data-col="${colIdx}"
                    data-key="${col.key}"
                    ${editable}
                >${formatted}</td>`;
            }).join('');

            return `<tr data-row-idx="${rowIdx}" data-row-key="${row[this.rowKey] || rowIdx}">${cells}</tr>`;
        }).join('');

        return `
            <div class="spreadsheet-container">
                <table class="spreadsheet">
                    <thead>
                        <tr>${headerCells}</tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="' + this._columns.length + '" class="empty-row">Sin datos</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    _renderCards() {
        if (!this._data.length) {
            return '<div class="empty-state"><slot name="empty">Sin datos</slot></div>';
        }

        const cards = this._data.map((item, idx) => {
            if (this._cardTemplate) {
                return `<div class="card" data-card-idx="${idx}" data-card-key="${item[this.rowKey] || idx}">
                    ${this._cardTemplate(item, idx)}
                </div>`;
            }
            # Default card rendering from columns
            return this._renderDefaultCard(item, idx);
        }).join('');

        return `<div class="cards-grid">${cards}</div>`;
    }

    _renderDefaultCard(item, idx) {
        const title = this._columns[0] ? item[this._columns[0].key] : 'Item';
        const fields = this._columns.slice(1).map(col => {
            const value = this._formatValue(item[col.key], col);
            return `<div class="card-field">
                <span class="card-field-label">${col.label}</span>
                <span class="card-field-value">${value}</span>
            </div>`;
        }).join('');

        return `<div class="card" data-card-idx="${idx}" data-card-key="${item[this.rowKey] || idx}">
            <div class="card-header">
                <h4 class="card-title">${title}</h4>
            </div>
            <div class="card-body">${fields}</div>
        </div>`;
    }

    _formatValue(value, col) {
        if (value === null || value === undefined) return '';

        if (col.format && typeof col.format === 'function') {
            return col.format(value);
        }

        switch (col.type) {
            case 'number':
                return this._formatNumber(value);
            case 'currency':
                return this._formatCurrency(value);
            case 'date':
                return this._formatDate(value);
            case 'badge':
                return this._formatBadge(value, col.badge);
            default:
                return value;
        }
    }

    _formatNumber(value) {
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        return num.toLocaleString('es-CL');
    }

    _formatCurrency(value) {
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        return '$' + num.toLocaleString('es-CL');
    }

    _formatDate(value) {
        try {
            const date = new Date(value);
            return date.toLocaleDateString('es-CL');
        } catch {
            return value;
        }
    }

    _formatBadge(value, badgeConfig = {}) {
        const colorMap = badgeConfig.colors || {};
        const color = colorMap[value] || 'default';
        return `<span class="badge badge-${color}">${value}</span>`;
    }

    # --- Event Listeners ---

    _attachSpreadsheetListeners() {
        const cells = this.shadowRoot.querySelectorAll('td[contenteditable="true"]');

        cells.forEach(cell => {
            cell.addEventListener('input', (e) => this._handleCellInput(e));
            cell.addEventListener('blur', (e) => this._handleCellBlur(e));
            cell.addEventListener('focus', (e) => this._handleCellFocus(e));
        });

        const rows = this.shadowRoot.querySelectorAll('tbody tr');
        rows.forEach(row => {
            row.addEventListener('click', (e) => {
                if (!e.target.hasAttribute('contenteditable')) {
                    this._handleRowClick(e, row);
                }
            });
        });
    }

    _attachCardListeners() {
        const cards = this.shadowRoot.querySelectorAll('.card');
        cards.forEach(card => {
            card.addEventListener('click', (e) => this._handleCardClick(e, card));
        });
    }

    _handleCellInput(e) {
        const cell = e.target;
        const rowIdx = parseInt(cell.dataset.row);
        const key = cell.dataset.key;
        const col = this._columns.find(c => c.key === key);
        let value = cell.innerText.trim();

        # Parse number types
        if (col?.type === 'number' || col?.type === 'currency') {
            value = parseFloat(value.replace(/[$,]/g, '').replace(',', '.')) || 0;
        }

        # Update internal data
        if (this._data[rowIdx]) {
            this._data[rowIdx][key] = value;
        }

        # Dispatch event
        this.dispatchEvent(new CustomEvent('cell-change', {
            bubbles: true,
            composed: true,
            detail: {
                rowIndex: rowIdx,
                rowKey: this._data[rowIdx]?.[this.rowKey],
                column: key,
                value: value,
                row: this._data[rowIdx]
            }
        }));
    }

    _handleCellBlur(e) {
        const cell = e.target;
        cell.classList.remove('cell-focused');
    }

    _handleCellFocus(e) {
        const cell = e.target;
        cell.classList.add('cell-focused');

        # Select all text on focus
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(cell);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    _handleRowClick(e, row) {
        if (!this.selectable) return;

        const rowIdx = parseInt(row.dataset.rowIdx);
        const rowKey = row.dataset.rowKey;

        this.dispatchEvent(new CustomEvent('row-select', {
            bubbles: true,
            composed: true,
            detail: {
                rowIndex: rowIdx,
                rowKey: rowKey,
                row: this._data[rowIdx]
            }
        }));
    }

    _handleCardClick(e, card) {
        const idx = parseInt(card.dataset.cardIdx);
        const key = card.dataset.cardKey;

        this.dispatchEvent(new CustomEvent('card-click', {
            bubbles: true,
            composed: true,
            detail: {
                index: idx,
                key: key,
                item: this._data[idx]
            }
        }));
    }

    # --- Keyboard Navigation ---

    _setupKeyboardNavigation() {
        this.shadowRoot.addEventListener('keydown', (e) => {
            if (this.mode !== 'spreadsheet') return;
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key)) return;

            const cell = e.target.closest('td[contenteditable="true"]');
            if (!cell) return;

            const selection = window.getSelection();
            if (selection.rangeCount === 0) return;
            const range = selection.getRangeAt(0);

            # Allow normal text navigation when text is selected or cursor is mid-text
            if (!range.collapsed) return;

            const isAtStart = this._isCursorAtStart(cell, range);
            const isAtEnd = this._isCursorAtEnd(cell, range);

            if (e.key === 'ArrowUp' && isAtStart) {
                this._navigateVertical(cell, -1, e);
            } else if (e.key === 'ArrowDown' && isAtEnd) {
                this._navigateVertical(cell, 1, e);
            } else if (e.key === 'ArrowLeft' && isAtStart) {
                this._navigateHorizontal(cell, -1, e);
            } else if (e.key === 'ArrowRight' && isAtEnd) {
                this._navigateHorizontal(cell, 1, e);
            } else if (e.key === 'Tab') {
                this._navigateHorizontal(cell, e.shiftKey ? -1 : 1, e);
            } else if (e.key === 'Enter' && !e.shiftKey) {
                this._navigateVertical(cell, 1, e);
            }
        });
    }

    _isCursorAtStart(cell, range) {
        if (range.startContainer === cell && range.startOffset === 0) return true;
        if (range.startContainer.nodeType === Node.TEXT_NODE &&
            range.startContainer === cell.firstChild &&
            range.startOffset === 0) return true;
        if (cell.innerText.trim() === '') return true;
        return false;
    }

    _isCursorAtEnd(cell, range) {
        if (cell.innerText.trim() === '') return true;
        if (range.startContainer === cell && range.startOffset === cell.childNodes.length) return true;
        if (range.startContainer.nodeType === Node.TEXT_NODE) {
            const lastTextNode = this._getLastTextNode(cell);
            if (range.startContainer === lastTextNode && range.startOffset === lastTextNode.length) return true;
        }
        return false;
    }

    _getLastTextNode(el) {
        let n = el.lastChild;
        while (n && n.nodeType !== Node.TEXT_NODE) {
            n = n.lastChild || n.previousSibling;
        }
        return n;
    }

    _navigateVertical(cell, direction, event) {
        const currentRow = cell.closest('tr');
        if (!currentRow) return;

        const targetRow = direction === -1
            ? currentRow.previousElementSibling
            : currentRow.nextElementSibling;

        if (targetRow && targetRow.closest('tbody')) {
            const colIdx = parseInt(cell.dataset.col);
            const cells = targetRow.querySelectorAll('td');
            const targetCell = cells[colIdx];

            if (targetCell && targetCell.getAttribute('contenteditable') === 'true') {
                event.preventDefault();
                targetCell.focus();
            }
        }
    }

    _navigateHorizontal(cell, direction, event) {
        const currentRow = cell.closest('tr');
        const editableCells = Array.from(currentRow.querySelectorAll('td[contenteditable="true"]'));

        if (editableCells.length === 0) return;

        const currentIndex = editableCells.indexOf(cell);
        let nextIndex;

        if (direction === 1) {
            nextIndex = currentIndex + 1;
            if (nextIndex >= editableCells.length) {
                # Move to next row first editable cell
                const nextRow = currentRow.nextElementSibling;
                if (nextRow && nextRow.closest('tbody')) {
                    const nextCell = nextRow.querySelector('td[contenteditable="true"]');
                    if (nextCell) {
                        event.preventDefault();
                        nextCell.focus();
                        return;
                    }
                }
                nextIndex = 0; # Loop to start of current row
            }
        } else {
            nextIndex = currentIndex - 1;
            if (nextIndex < 0) {
                # Move to previous row last editable cell
                const prevRow = currentRow.previousElementSibling;
                if (prevRow && prevRow.closest('tbody')) {
                    const prevCells = prevRow.querySelectorAll('td[contenteditable="true"]');
                    if (prevCells.length) {
                        event.preventDefault();
                        prevCells[prevCells.length - 1].focus();
                        return;
                    }
                }
                nextIndex = editableCells.length - 1; # Loop to end
            }
        }

        const targetCell = editableCells[nextIndex];
        if (targetCell) {
            event.preventDefault();
            targetCell.focus();
        }
    }

    # --- Styles ---

    _getStyles() {
        return `
            :host {
                display: block;
                --grid-border-color: var(--color-border-subtle, #e5e7eb);
                --grid-header-bg: var(--color-gray-50, #f9fafb);
                --grid-row-hover: var(--color-gray-50, #f9fafb);
                --grid-cell-editable-bg: hsl(48, 96%, 95%);
                --grid-cell-focus-ring: var(--color-brand-primary, #2563eb);
            }

            .data-grid {
                width: 100%;
            }

            /* ========== SPREADSHEET MODE ========== */
            .spreadsheet-container {
                overflow-x: auto;
                border: 1px solid var(--grid-border-color);
                border-radius: var(--radius-lg, 0.5rem);
                background: var(--color-white, #fff);
            }

            .spreadsheet {
                width: 100%;
                border-collapse: collapse;
                font-size: var(--text-size-sm, 0.875rem);
                min-width: 600px;
            }

            .spreadsheet thead {
                position: sticky;
                top: 0;
                z-index: 10;
            }

            .spreadsheet th {
                background: var(--grid-header-bg);
                padding: var(--spacing-3, 0.75rem) var(--spacing-4, 1rem);
                font-weight: var(--font-weight-semibold, 600);
                color: var(--color-text-secondary, #6b7280);
                text-transform: uppercase;
                font-size: var(--text-size-xs, 0.75rem);
                letter-spacing: 0.05em;
                border-bottom: 1px solid var(--grid-border-color);
                white-space: nowrap;
            }

            .spreadsheet th.col-editable {
                background: var(--grid-cell-editable-bg);
                color: hsl(45, 80%, 35%);
            }

            .spreadsheet td {
                padding: var(--spacing-3, 0.75rem) var(--spacing-4, 1rem);
                border-bottom: 1px solid var(--grid-border-color);
                color: var(--color-text-primary, #111827);
                transition: background-color 0.15s;
            }

            .spreadsheet tbody tr:hover td {
                background: var(--grid-row-hover);
            }

            .spreadsheet td.cell-editable {
                background: hsl(48, 96%, 98%);
                cursor: text;
            }

            .spreadsheet td.cell-editable:hover {
                background: hsl(48, 96%, 95%);
            }

            .spreadsheet td.cell-editable:focus {
                outline: 2px solid var(--grid-cell-focus-ring);
                outline-offset: -2px;
                background: hsl(217, 91%, 97%);
                position: relative;
                z-index: 20;
            }

            .spreadsheet td.cell-number,
            .spreadsheet td.cell-currency {
                font-family: 'JetBrains Mono', ui-monospace, monospace;
                font-variant-numeric: tabular-nums;
            }

            .empty-row {
                text-align: center;
                color: var(--color-text-tertiary, #9ca3af);
                font-style: italic;
                padding: var(--spacing-8, 2rem) !important;
            }

            /* ========== CARDS MODE ========== */
            .cards-grid {
                display: grid;
                grid-template-columns: repeat(1, 1fr);
                gap: var(--spacing-4, 1rem);
            }

            @media (min-width: 640px) {
                .cards-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
            }

            @media (min-width: 1024px) {
                .cards-grid {
                    grid-template-columns: repeat(3, 1fr);
                }
            }

            @media (min-width: 1280px) {
                .cards-grid {
                    grid-template-columns: repeat(4, 1fr);
                }
            }

            .card {
                background: var(--color-white, #fff);
                border: 1px solid var(--grid-border-color);
                border-radius: var(--radius-lg, 0.5rem);
                padding: var(--spacing-5, 1.25rem);
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
            }

            .card:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1));
                border-color: var(--color-brand-primary, #2563eb);
            }

            .card-header {
                margin-bottom: var(--spacing-3, 0.75rem);
            }

            .card-title {
                font-size: var(--text-size-sm, 0.875rem);
                font-weight: var(--font-weight-bold, 700);
                color: var(--color-text-primary, #111827);
                margin: 0 0 var(--spacing-3, 0.75rem) 0;
                line-height: 1.4;
            }

            .card-body {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-2, 0.5rem);
            }

            .card-field {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: var(--text-size-sm, 0.875rem);
            }

            .card-field-label {
                color: var(--color-text-tertiary, #9ca3af);
            }

            .card-field-value {
                color: var(--color-text-secondary, #6b7280);
                font-family: ui-monospace, monospace;
            }

            .card-notes {
                margin: var(--spacing-3, 0.75rem) 0 0 0;
                padding-top: var(--spacing-3, 0.75rem);
                border-top: 1px solid var(--grid-border-color);
                font-size: var(--text-size-xs, 0.75rem);
                color: var(--color-text-tertiary, #9ca3af);
                font-style: italic;
            }

            /* ========== CATEGORY BADGES ========== */
            .category-badge {
                display: inline-flex;
                align-items: center;
                gap: var(--spacing-1, 0.25rem);
                padding: var(--spacing-1, 0.25rem) var(--spacing-2, 0.5rem);
                font-size: var(--text-size-xs, 0.75rem);
                font-weight: var(--font-weight-semibold, 600);
                border-radius: var(--radius-full, 9999px);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .category-badge-cogs {
                background: hsl(217, 91%, 95%);
                color: hsl(217, 91%, 45%);
            }

            .category-badge-capex {
                background: hsl(160, 84%, 92%);
                color: hsl(160, 84%, 30%);
            }

            .category-badge-stock {
                background: hsl(270, 76%, 94%);
                color: hsl(270, 71%, 45%);
            }

            /* ========== BADGES ========== */
            .badge {
                display: inline-block;
                padding: var(--spacing-1, 0.25rem) var(--spacing-2, 0.5rem);
                font-size: var(--text-size-xs, 0.75rem);
                font-weight: var(--font-weight-semibold, 600);
                border-radius: var(--radius-full, 9999px);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .badge-default {
                background: var(--color-gray-100, #f3f4f6);
                color: var(--color-gray-700, #374151);
            }

            .badge-blue {
                background: hsl(217, 91%, 95%);
                color: hsl(217, 91%, 45%);
            }

            .badge-green {
                background: hsl(142, 76%, 94%);
                color: hsl(142, 71%, 29%);
            }

            .badge-amber {
                background: hsl(45, 93%, 94%);
                color: hsl(45, 93%, 35%);
            }

            .badge-red {
                background: hsl(0, 84%, 95%);
                color: hsl(0, 84%, 40%);
            }

            .badge-purple {
                background: hsl(270, 76%, 94%);
                color: hsl(270, 71%, 45%);
            }

            .badge-emerald {
                background: hsl(160, 84%, 92%);
                color: hsl(160, 84%, 30%);
            }

            /* ========== EMPTY STATE ========== */
            .empty-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: var(--spacing-8, 2rem);
                text-align: center;
                color: var(--color-text-tertiary, #9ca3af);
                background: var(--color-white, #fff);
                border: 2px dashed var(--grid-border-color);
                border-radius: var(--radius-lg, 0.5rem);
                min-height: 200px;
            }
        `;
    }
}

customElements.define('bnx-data-grid', BnxDataGrid);

export default BnxDataGrid;
