// src/bnx/components/data-grid/DataGrid.js

class BnxDataGrid extends HTMLElement {
    static _stylesInjected = false;

    constructor() {
        super();
        this._data = [];
        this._columns = [];
        this._cardTemplate = null;
        this._editableColumns = new Set();
        this._newRowTemplate = null;
        this._pendingArrowDowns = 0;
        this._lastArrowDownTime = 0;
        this._pendingCtrlDeletes = 0;
        this._lastCtrlDeleteTime = 0;
        this._isEditing = false;
    }

    static get observedAttributes() {
        return ['mode', 'selectable', 'row-key'];
    }

    connectedCallback() {
        this._injectStyles();
        this.render();
        this._setupKeyboardNavigation();
    }

    attributeChangedCallback() {
        if (this.innerHTML) {
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

    // --- Public API ---

    // Focus management para popovers
    saveFocus() {
        const active = this.querySelector('td:focus');
        if (active) {
            this._savedFocus = {
                row: parseInt(active.dataset.row),
                col: parseInt(active.dataset.col)
            };
        }
        return this._savedFocus;
    }

    restoreFocus() {
        if (!this._savedFocus) return false;
        const { row, col } = this._savedFocus;
        return this.focusCell(row, col);
    }

    focusCell(rowIdx, colIdx) {
        const cell = this.querySelector(`td[data-row="${rowIdx}"][data-col="${colIdx}"]`);
        if (cell) {
            cell.focus();
            return true;
        }
        return false;
    }

    getActiveCell() {
        const active = this.querySelector('td:focus');
        if (!active) return null;
        return {
            row: parseInt(active.dataset.row),
            col: parseInt(active.dataset.col),
            key: active.dataset.key,
            element: active
        };
    }

    setColumns(columns) {
        // columns: [{ key, label, type, editable, width, align, format, badge }]
        this._columns = columns;
        this._editableColumns = new Set(
            columns.filter(c => c.editable).map(c => c.key)
        );
        this.render();
    }

    setData(data, options = {}) {
        const activeCell = this.getActiveCell();
        const wasEditing = this._isEditing;

        this._data = Array.isArray(data) ? data : [];

        // Skip render if actively editing and preserveFocus not explicitly false
        if (wasEditing && options.preserveFocus !== false) {
            // Just update internal data, don't re-render
            return;
        }

        this.render();

        // Restore focus if there was an active cell
        if (activeCell && options.preserveFocus !== false) {
            requestAnimationFrame(() => {
                this.focusCell(activeCell.row, activeCell.col);
            });
        }
    }

    getData() {
        return this._data;
    }

    setCardTemplate(templateFn) {
        // templateFn: (item, index) => HTML string
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

    setNewRowTemplate(templateFn) {
        // templateFn: () => { id: 'new_123', name: '', ... }
        this._newRowTemplate = templateFn;
    }

    createNewRow(focusFirstEditable = true) {
        let newRow;
        if (this._newRowTemplate) {
            newRow = this._newRowTemplate();
        } else {
            // Default: empty row with generated id
            newRow = { [this.rowKey]: `_new_${Date.now()}` };
            this._columns.forEach(col => {
                if (col.key !== this.rowKey) {
                    newRow[col.key] = col.type === 'number' || col.type === 'currency' ? 0 : '';
                }
            });
        }

        // Mark as new (created by grid, not from backend)
        newRow._isNew = true;
        newRow._createdAt = new Date().toISOString();

        this._data.push(newRow);
        this.render();

        // Dispatch event
        this.dispatchEvent(new CustomEvent('row-created', {
            bubbles: true,
            detail: {
                row: newRow,
                rowIndex: this._data.length - 1
            }
        }));

        // Focus first editable cell in new row
        if (focusFirstEditable) {
            requestAnimationFrame(() => {
                const newRowIdx = this._data.length - 1;
                const firstEditableCol = this._columns.findIndex(c => c.editable);
                if (firstEditableCol !== -1) {
                    this.focusCell(newRowIdx, firstEditableCol);
                }
            });
        }

        return newRow;
    }

    // --- Styles Injection (once per document) ---

    _injectStyles() {
        if (BnxDataGrid._stylesInjected) return;

        const style = document.createElement('style');
        style.id = 'bnx-data-grid-styles';
        style.textContent = this._getStyles();
        document.head.appendChild(style);
        BnxDataGrid._stylesInjected = true;
    }

    // --- Rendering ---

    render() {
        const content = this.mode === 'cards'
            ? this._renderCards()
            : this._renderSpreadsheet();

        this.innerHTML = `
            <div class="bnx-data-grid bnx-data-grid--${this.mode}">
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
            return '<div class="bnx-dg-empty-state">No columns defined</div>';
        }

        const headerCells = this._columns.map(col => {
            const align = col.align || (col.type === 'number' ? 'right' : 'left');
            const editableClass = col.editable ? 'bnx-dg-col-editable' : '';
            const width = col.width ? `width: ${col.width};` : '';
            return `<th class="${editableClass}" style="text-align: ${align}; ${width}">${col.label}</th>`;
        }).join('');

        const rows = this._data.map((row, rowIdx) => {
            const cells = this._columns.map((col, colIdx) => {
                const value = row[col.key] ?? '';
                const align = col.align || (col.type === 'number' ? 'right' : 'left');
                const editable = col.editable ? 'contenteditable="true"' : '';
                const editableClass = col.editable ? 'bnx-dg-cell-editable' : '';
                const formatted = this._formatValue(value, col);

                return `<td
                    class="${editableClass} bnx-dg-cell-${col.type || 'text'}"
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
            <div class="bnx-dg-spreadsheet-container">
                <table class="bnx-dg-spreadsheet">
                    <thead>
                        <tr>${headerCells}</tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="' + this._columns.length + '" class="bnx-dg-empty-row">Sin datos</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    _renderCards() {
        if (!this._data.length) {
            return '<div class="bnx-dg-empty-state">Sin datos</div>';
        }

        const cards = this._data.map((item, idx) => {
            if (this._cardTemplate) {
                return `<div class="bnx-dg-card" data-card-idx="${idx}" data-card-key="${item[this.rowKey] || idx}">
                    ${this._cardTemplate(item, idx)}
                </div>`;
            }
            return this._renderDefaultCard(item, idx);
        }).join('');

        return `<div class="bnx-dg-cards-grid">${cards}</div>`;
    }

    _renderDefaultCard(item, idx) {
        const title = this._columns[0] ? item[this._columns[0].key] : 'Item';
        const fields = this._columns.slice(1).map(col => {
            const value = this._formatValue(item[col.key], col);
            return `<div class="bnx-dg-card-field">
                <span class="bnx-dg-card-field-label">${col.label}</span>
                <span class="bnx-dg-card-field-value">${value}</span>
            </div>`;
        }).join('');

        return `<div class="bnx-dg-card" data-card-idx="${idx}" data-card-key="${item[this.rowKey] || idx}">
            <div class="bnx-dg-card-header">
                <h4 class="bnx-dg-card-title">${title}</h4>
            </div>
            <div class="bnx-dg-card-body">${fields}</div>
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
        return `<span class="bnx-dg-badge bnx-dg-badge-${color}">${value}</span>`;
    }

    // --- Event Listeners ---

    _attachSpreadsheetListeners() {
        const cells = this.querySelectorAll('td[contenteditable="true"]');

        cells.forEach(cell => {
            cell.addEventListener('input', (e) => this._handleCellInput(e));
            cell.addEventListener('blur', (e) => this._handleCellBlur(e));
            cell.addEventListener('focus', (e) => this._handleCellFocus(e));
        });

        // Cell click event for all cells (editable or not)
        const allCells = this.querySelectorAll('tbody td');
        allCells.forEach(cell => {
            cell.addEventListener('click', (e) => this._handleCellClick(e, cell));
        });

        const rows = this.querySelectorAll('tbody tr');
        rows.forEach(row => {
            row.addEventListener('click', (e) => {
                if (!e.target.hasAttribute('contenteditable')) {
                    this._handleRowClick(e, row);
                }
            });
        });
    }

    _handleCellClick(e, cell) {
        const rowIdx = parseInt(cell.dataset.row);
        const colIdx = parseInt(cell.dataset.col);
        const key = cell.dataset.key;

        this.dispatchEvent(new CustomEvent('cell-click', {
            bubbles: true,
            detail: {
                rowIndex: rowIdx,
                colIndex: colIdx,
                column: key,
                row: this._data[rowIdx],
                cellElement: cell,
                originalEvent: e
            }
        }));
    }

    _attachCardListeners() {
        const cards = this.querySelectorAll('.bnx-dg-card');
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

        // Parse number types
        if (col?.type === 'number' || col?.type === 'currency') {
            value = parseFloat(value.replace(/[$,\.]/g, '').replace(',', '.')) || 0;
        }

        // Update internal data
        if (this._data[rowIdx]) {
            this._data[rowIdx][key] = value;
        }

        // Dispatch event
        this.dispatchEvent(new CustomEvent('cell-change', {
            bubbles: true,
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
        this._isEditing = false;
        e.target.classList.remove('bnx-dg-cell-focused');

        const cell = e.target;
        const rowIdx = parseInt(cell.dataset.row);
        const key = cell.dataset.key;

        // Delay blur event to check if focus moved to another cell in same grid
        // This prevents recalc during keyboard navigation
        setTimeout(() => {
            const newFocus = document.activeElement;
            const stillInGrid = this.contains(newFocus) && newFocus.matches('td[contenteditable="true"]');

            // Only dispatch blur if focus left the grid entirely
            if (!stillInGrid) {
                this.dispatchEvent(new CustomEvent('cell-blur', {
                    bubbles: true,
                    detail: {
                        rowIndex: rowIdx,
                        rowKey: this._data[rowIdx]?.[this.rowKey],
                        column: key,
                        row: this._data[rowIdx]
                    }
                }));
            }
        }, 10);
    }

    _handleCellFocus(e) {
        this._isEditing = true;
        const cell = e.target;
        cell.classList.add('bnx-dg-cell-focused');

        // Select all text on focus
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
            detail: {
                index: idx,
                key: key,
                item: this._data[idx]
            }
        }));
    }

    // --- Keyboard Navigation ---

    _setupKeyboardNavigation() {
        this.addEventListener('keydown', (e) => {
            if (this.mode !== 'spreadsheet') return;

            const cell = e.target.closest('td[contenteditable="true"]');
            if (!cell) return;

            // Handle Ctrl+Delete for row deletion (double press)
            if (e.key === 'Delete' && e.ctrlKey) {
                e.preventDefault();
                this._handleCtrlDelete(cell);
                return;
            }

            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key)) return;

            const selection = window.getSelection();
            if (selection.rangeCount === 0) return;
            const range = selection.getRangeAt(0);

            // Allow normal text navigation when text is selected
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

    _handleCtrlDelete(cell) {
        const now = Date.now();
        const timeSinceLastCtrlDel = now - this._lastCtrlDeleteTime;

        // Reset counter if more than 500ms since last Ctrl+Delete
        if (timeSinceLastCtrlDel > 500) {
            this._pendingCtrlDeletes = 0;
        }

        this._pendingCtrlDeletes++;
        this._lastCtrlDeleteTime = now;

        // On second Ctrl+Delete within 500ms, delete the row
        if (this._pendingCtrlDeletes >= 2) {
            this._pendingCtrlDeletes = 0;
            const rowIdx = parseInt(cell.dataset.row);
            this._deleteRowAtIndex(rowIdx);
        }
    }

    _deleteRowAtIndex(rowIdx) {
        if (rowIdx < 0 || rowIdx >= this._data.length) return;

        const deletedRow = this._data[rowIdx];
        const rowKey = deletedRow[this.rowKey];

        // Remove from data
        this._data.splice(rowIdx, 1);

        // Dispatch event before re-render
        this.dispatchEvent(new CustomEvent('row-deleted', {
            bubbles: true,
            detail: {
                row: deletedRow,
                rowIndex: rowIdx,
                rowKey: rowKey
            }
        }));

        this._isEditing = false;
        this.render();

        // Focus previous row or first row
        requestAnimationFrame(() => {
            const newFocusRow = Math.max(0, rowIdx - 1);
            if (this._data.length > 0) {
                const firstEditableCol = this._columns.findIndex(c => c.editable);
                if (firstEditableCol !== -1) {
                    this.focusCell(newFocusRow, firstEditableCol);
                }
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
            // Reset arrow down counter when navigating successfully
            this._pendingArrowDowns = 0;
        } else if (direction === 1) {
            // We're on the last row trying to go down
            const now = Date.now();
            const timeSinceLastArrow = now - this._lastArrowDownTime;

            // Reset counter if more than 500ms since last arrow down
            if (timeSinceLastArrow > 500) {
                this._pendingArrowDowns = 0;
            }

            this._pendingArrowDowns++;
            this._lastArrowDownTime = now;

            // On second arrow down within 500ms, create new row
            if (this._pendingArrowDowns >= 2) {
                event.preventDefault();
                this._pendingArrowDowns = 0;
                this.createNewRow(true);
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
                const nextRow = currentRow.nextElementSibling;
                if (nextRow && nextRow.closest('tbody')) {
                    const nextCell = nextRow.querySelector('td[contenteditable="true"]');
                    if (nextCell) {
                        event.preventDefault();
                        nextCell.focus();
                        return;
                    }
                }
                nextIndex = 0;
            }
        } else {
            nextIndex = currentIndex - 1;
            if (nextIndex < 0) {
                const prevRow = currentRow.previousElementSibling;
                if (prevRow && prevRow.closest('tbody')) {
                    const prevCells = prevRow.querySelectorAll('td[contenteditable="true"]');
                    if (prevCells.length) {
                        event.preventDefault();
                        prevCells[prevCells.length - 1].focus();
                        return;
                    }
                }
                nextIndex = editableCells.length - 1;
            }
        }

        const targetCell = editableCells[nextIndex];
        if (targetCell) {
            event.preventDefault();
            targetCell.focus();
        }
    }

    // --- Styles ---

    _getStyles() {
        return `
            /* ========== BNX DATA GRID - Light DOM ========== */
            bnx-data-grid {
                display: block;
                --grid-border-color: var(--color-border-subtle, #e5e7eb);
                --grid-header-bg: var(--color-gray-50, #f9fafb);
                --grid-row-hover: var(--color-gray-50, #f9fafb);
                --grid-cell-editable-bg: hsl(48, 96%, 95%);
                --grid-cell-focus-ring: var(--color-brand-primary, #2563eb);
            }

            .bnx-data-grid {
                width: 100%;
            }

            /* ========== SPREADSHEET MODE ========== */
            .bnx-dg-spreadsheet-container {
                overflow-x: auto;
                border: 1px solid var(--grid-border-color);
                border-radius: var(--radius-lg, 0.5rem);
                background: var(--color-white, #fff);
            }

            .bnx-dg-spreadsheet {
                width: 100%;
                border-collapse: collapse;
                font-size: var(--text-size-sm, 0.875rem);
                min-width: 600px;
            }

            .bnx-dg-spreadsheet thead {
                position: sticky;
                top: 0;
                z-index: 10;
            }

            .bnx-dg-spreadsheet th {
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

            .bnx-dg-spreadsheet th.bnx-dg-col-editable {
                background: var(--grid-cell-editable-bg);
                color: hsl(45, 80%, 35%);
            }

            .bnx-dg-spreadsheet td {
                padding: var(--spacing-3, 0.75rem) var(--spacing-4, 1rem);
                border-bottom: 1px solid var(--grid-border-color);
                color: var(--color-text-primary, #111827);
                transition: background-color 0.15s;
            }

            .bnx-dg-spreadsheet tbody tr:hover td {
                background: var(--grid-row-hover);
            }

            .bnx-dg-spreadsheet td.bnx-dg-cell-editable {
                background: hsl(48, 96%, 98%);
                cursor: text;
            }

            .bnx-dg-spreadsheet td.bnx-dg-cell-editable:hover {
                background: hsl(48, 96%, 95%);
            }

            .bnx-dg-spreadsheet td.bnx-dg-cell-editable:focus {
                outline: 2px solid var(--grid-cell-focus-ring);
                outline-offset: -2px;
                background: hsl(217, 91%, 97%);
                position: relative;
                z-index: 20;
            }

            .bnx-dg-spreadsheet td.bnx-dg-cell-number,
            .bnx-dg-spreadsheet td.bnx-dg-cell-currency {
                font-family: 'JetBrains Mono', ui-monospace, monospace;
                font-variant-numeric: tabular-nums;
            }

            .bnx-dg-empty-row {
                text-align: center;
                color: var(--color-text-tertiary, #9ca3af);
                font-style: italic;
                padding: var(--spacing-8, 2rem) !important;
            }

            /* ========== CARDS MODE ========== */
            .bnx-dg-cards-grid {
                display: grid;
                grid-template-columns: repeat(1, 1fr);
                gap: var(--spacing-4, 1rem);
            }

            @media (min-width: 640px) {
                .bnx-dg-cards-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
            }

            @media (min-width: 1024px) {
                .bnx-dg-cards-grid {
                    grid-template-columns: repeat(3, 1fr);
                }
            }

            @media (min-width: 1280px) {
                .bnx-dg-cards-grid {
                    grid-template-columns: repeat(4, 1fr);
                }
            }

            .bnx-dg-card {
                background: var(--color-white, #fff);
                border: 1px solid var(--grid-border-color);
                border-radius: var(--radius-lg, 0.5rem);
                padding: var(--spacing-5, 1.25rem);
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
            }

            .bnx-dg-card:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1));
                border-color: var(--color-brand-primary, #2563eb);
            }

            .bnx-dg-card-header {
                margin-bottom: var(--spacing-3, 0.75rem);
            }

            .bnx-dg-card-title {
                font-size: var(--text-size-sm, 0.875rem);
                font-weight: var(--font-weight-bold, 700);
                color: var(--color-text-primary, #111827);
                margin: 0 0 var(--spacing-3, 0.75rem) 0;
                line-height: 1.4;
            }

            .bnx-dg-card-body {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-2, 0.5rem);
            }

            .bnx-dg-card-field {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: var(--text-size-sm, 0.875rem);
            }

            .bnx-dg-card-field-label {
                color: var(--color-text-tertiary, #9ca3af);
            }

            .bnx-dg-card-field-value {
                color: var(--color-text-secondary, #6b7280);
                font-family: ui-monospace, monospace;
            }

            .bnx-dg-card-notes {
                margin: var(--spacing-3, 0.75rem) 0 0 0;
                padding-top: var(--spacing-3, 0.75rem);
                border-top: 1px solid var(--grid-border-color);
                font-size: var(--text-size-xs, 0.75rem);
                color: var(--color-text-tertiary, #9ca3af);
                font-style: italic;
            }

            /* ========== CATEGORY BADGES ========== */
            .bnx-dg-category-badge {
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

            .bnx-dg-category-badge-cogs {
                background: hsl(217, 91%, 95%);
                color: hsl(217, 91%, 45%);
            }

            .bnx-dg-category-badge-capex {
                background: hsl(160, 84%, 92%);
                color: hsl(160, 84%, 30%);
            }

            .bnx-dg-category-badge-stock {
                background: hsl(270, 76%, 94%);
                color: hsl(270, 71%, 45%);
            }

            /* ========== BADGES ========== */
            .bnx-dg-badge {
                display: inline-block;
                padding: var(--spacing-1, 0.25rem) var(--spacing-2, 0.5rem);
                font-size: var(--text-size-xs, 0.75rem);
                font-weight: var(--font-weight-semibold, 600);
                border-radius: var(--radius-full, 9999px);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .bnx-dg-badge-default {
                background: var(--color-gray-100, #f3f4f6);
                color: var(--color-gray-700, #374151);
            }

            .bnx-dg-badge-blue {
                background: hsl(217, 91%, 95%);
                color: hsl(217, 91%, 45%);
            }

            .bnx-dg-badge-green {
                background: hsl(142, 76%, 94%);
                color: hsl(142, 71%, 29%);
            }

            .bnx-dg-badge-amber {
                background: hsl(45, 93%, 94%);
                color: hsl(45, 93%, 35%);
            }

            .bnx-dg-badge-red {
                background: hsl(0, 84%, 95%);
                color: hsl(0, 84%, 40%);
            }

            .bnx-dg-badge-purple {
                background: hsl(270, 76%, 94%);
                color: hsl(270, 71%, 45%);
            }

            .bnx-dg-badge-emerald {
                background: hsl(160, 84%, 92%);
                color: hsl(160, 84%, 30%);
            }

            /* ========== EMPTY STATE ========== */
            .bnx-dg-empty-state {
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
