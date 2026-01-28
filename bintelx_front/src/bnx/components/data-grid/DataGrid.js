// src/bnx/components/data-grid/DataGrid.js
// DataGrid v2 - Event Delegation + Editor Overlay + HTML5 Validation
//
// REVIEW NOTES (2026-01-28)
// - Medio – Riesgo de inyección HTML si un col.format() devuelve contenido con datos de usuario.
//   - _formatValue() devuelve HTML sin escape cuando hay format o type=html/action, y _renderRow() lo inserta directo
//     en el DOM.
//   - Si algún format construye HTML con texto no sanitizado (ej: nombre del item editable), hay vector XSS.
//   - Ref: src/bnx/components/data-grid/DataGrid.js:250 y src/bnx/components/data-grid/DataGrid.js:372.
// - Medio – setData() mientras hay edición activa no re-renderiza (solo actualiza _data).
//   - El DOM puede quedar desincronizado si el state cambia (rows nuevas/eliminadas) durante edición.
//   - En grids con updates frecuentes (workunit con 3k filas), puede generar eventos sobre filas incorrectas.
//   - Ref: src/bnx/components/data-grid/DataGrid.js:39.
// - Bajo – paste usa document.execCommand('insertText') (deprecated).
//   - Si falla en el browser, el paste queda bloqueado porque se hace preventDefault().
//   - Ref: src/bnx/components/data-grid/DataGrid.js:1008.

class BnxDataGrid extends HTMLElement {
    static _stylesInjected = false;

    constructor() {
        super();
        this._data = [];
        this._columns = [];
        this._newRowTemplate = null;
        this._cardTemplate = null;
        this._detailsTemplate = null;
        this._expandedRows = new Set();

        // Editor overlay state
        this._activeEditor = null;
        this._editingCell = null;

        // Double-press detection
        this._lastArrowDown = { time: 0, count: 0 };
        this._lastCtrlDelete = { time: 0, count: 0 };
        this._lastShiftDelete = { time: 0, count: 0 };
    }

    static get observedAttributes() {
        return ['mode', 'selectable', 'row-key'];
    }

    connectedCallback() {
        this._injectStyles();
        this.render();
        this._attachDelegatedListeners();
    }

    disconnectedCallback() {
        this._removeEditor();
    }

    attributeChangedCallback() {
        if (this.isConnected) {
            this.render();
            this._attachDelegatedListeners();
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

    // === Public API ===

    setColumns(columns) {
        this._columns = columns.map(col => ({
            ...col,
            editable: col.editable ?? false,
            type: col.type || 'text',
            align: col.align || (col.type === 'number' || col.type === 'currency' ? 'right' : 'left')
        }));
        this.render();
        this._attachDelegatedListeners();
    }

    setData(data, options = {}) {
        const wasEditing = !!this._activeEditor;

        // Si estamos editando y no se fuerza refresh, solo actualizar datos internos
        if (wasEditing && options.preserveFocus !== false) {
            this._data = Array.isArray(data) ? [...data] : [];
            this._cleanupExpandedRows();
            return;
        }

        this._removeEditor();
        this._data = Array.isArray(data) ? [...data] : [];
        this._cleanupExpandedRows();
        this.render();
        this._attachDelegatedListeners();
    }

    getData() {
        return this._data;
    }

    setNewRowTemplate(templateFn) {
        this._newRowTemplate = templateFn;
    }

    setCardTemplate(templateFn) {
        this._cardTemplate = templateFn;
        if (this.mode === 'cards') {
            this.render();
        }
    }

    setDetailsTemplate(templateFn) {
        if (typeof templateFn === 'function') {
            this._detailsTemplate = templateFn;
            return;
        }

        if (templateFn instanceof HTMLElement) {
            this._detailsTemplate = () => templateFn.cloneNode(true);
            return;
        }

        if (typeof templateFn === 'string') {
            this._detailsTemplate = () => templateFn;
            return;
        }

        this._detailsTemplate = null;
    }

    toggleRowDetails(rowKey) {
        if (!this._detailsTemplate) return false;

        const key = String(rowKey);
        if (this._expandedRows.has(key)) {
            this._expandedRows.delete(key);
            this._removeDetailsRow(key);
            return false;
        }

        this._expandedRows.add(key);
        this._insertDetailsRow(key);
        return true;
    }

    addRow(row) {
        this._data.push(row);
        const tbody = this.querySelector('tbody');
        if (tbody && this.mode === 'spreadsheet') {
            const tr = this._createRowElement(row, this._data.length - 1);
            tbody.appendChild(tr);
            this._removeEmptyState();
        } else {
            this.render();
        }
    }

    updateRow(key, updates) {
        const idx = this._data.findIndex(r => r[this.rowKey] === key);
        if (idx === -1) return;

        this._data[idx] = { ...this._data[idx], ...updates };

        // Render incremental: actualizar solo las celdas afectadas
        const tr = this.querySelector(`tr[data-row-key="${key}"]`);
        if (tr) {
            Object.keys(updates).forEach(colKey => {
                const td = tr.querySelector(`td[data-key="${colKey}"]`);
                if (td) {
                    const col = this._columns.find(c => c.key === colKey);
                    const formatted = this._formatValue(updates[colKey], col);
                    if (this._isHtmlColumn(col)) {
                        td.innerHTML = formatted;
                    } else {
                        td.textContent = formatted;
                    }
                }
            });
        }

        if (this._detailsTemplate && this._expandedRows.has(String(key))) {
            this._refreshDetailsRow(String(key), idx);
        }
    }

    deleteRow(key) {
        const idx = this._data.findIndex(r => r[this.rowKey] === key);
        if (idx === -1) return;

        this._data.splice(idx, 1);
        this._expandedRows.delete(String(key));
        this._removeDetailsRow(String(key));

        // Render incremental: remover solo la fila
        const tr = this.querySelector(`tr[data-row-key="${key}"]`);
        if (tr) {
            tr.remove();
            this._reindexRows();
            if (this._data.length === 0) this._showEmptyState();
        }
    }

    createNewRow(focusFirstEditable = true) {
        const newRow = this._newRowTemplate
            ? this._newRowTemplate()
            : this._createDefaultRow();

        newRow._isNew = true;
        newRow._createdAt = new Date().toISOString();

        this._data.push(newRow);

        const tbody = this.querySelector('tbody');
        if (tbody && this.mode === 'spreadsheet') {
            const tr = this._createRowElement(newRow, this._data.length - 1);
            tbody.appendChild(tr);
            this._removeEmptyState();
        } else {
            this.render();
        }

        this.dispatchEvent(new CustomEvent('row-created', {
            bubbles: true,
            detail: { row: newRow, rowIndex: this._data.length - 1 }
        }));

        if (focusFirstEditable) {
            requestAnimationFrame(() => {
                const firstEditableCol = this._columns.findIndex(c => c.editable);
                if (firstEditableCol !== -1) {
                    this.focusCell(this._data.length - 1, firstEditableCol);
                }
            });
        }

        return newRow;
    }

    focusCell(rowIdx, colIdx, openEditor = true) {
        const cell = this.querySelector(`td[data-row="${rowIdx}"][data-col="${colIdx}"]`);
        if (cell) {
            // Quitar selección previa
            this.querySelectorAll('td.bnx-dg-cell-selected').forEach(c => {
                c.classList.remove('bnx-dg-cell-selected');
            });
            cell.classList.add('bnx-dg-cell-selected');
            cell.focus();

            if (openEditor) {
                const col = this._columns[colIdx];
                if (col?.editable) {
                    this._showEditor(cell, rowIdx, colIdx);
                }
            }
            return true;
        }
        return false;
    }

    getActiveCell() {
        if (!this._editingCell) return null;
        return {
            row: parseInt(this._editingCell.dataset.row),
            col: parseInt(this._editingCell.dataset.col),
            key: this._editingCell.dataset.key,
            element: this._editingCell
        };
    }

    saveFocus() {
        const active = this.getActiveCell();
        if (active) {
            this._savedFocus = { row: active.row, col: active.col };
        }
        return this._savedFocus;
    }

    restoreFocus() {
        if (!this._savedFocus) return false;
        return this.focusCell(this._savedFocus.row, this._savedFocus.col);
    }

    // === Rendering ===

    render() {
        if (this.mode === 'cards') {
            this.innerHTML = this._renderCards();
            return;
        }

        this.innerHTML = `
            <div class="bnx-data-grid">
                <div class="bnx-dg-spreadsheet-container">
                    <table class="bnx-dg-spreadsheet">
                        <thead><tr>${this._renderHeaders()}</tr></thead>
                        <tbody>${this._renderRows()}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    _renderHeaders() {
        return this._columns.map(col => {
            const style = `text-align:${col.align};${col.width ? `width:${col.width};` : ''}`;
            const cls = col.editable ? 'bnx-dg-col-editable' : '';
            return `<th class="${cls}" style="${style}">${col.label}</th>`;
        }).join('');
    }

    _renderRows() {
        if (!this._data.length) {
            return `<tr class="bnx-dg-empty-row"><td colspan="${this._columns.length}">Sin datos</td></tr>`;
        }
        return this._data.map((row, idx) => {
            const rowKey = this._getRowKey(row, idx);
            const key = String(rowKey);
            const mainRow = this._renderRow(row, idx);
            if (this._detailsTemplate && this._expandedRows.has(key)) {
                return mainRow + this._renderDetailsRow(row, idx, key);
            }
            return mainRow;
        }).join('');
    }

    _renderRow(row, rowIdx) {
        const rowKey = this._getRowKey(row, rowIdx);
        const cells = this._columns.map((col, colIdx) => {
            const value = row[col.key] ?? '';
            const formatted = this._formatValue(value, col);
            const cls = [
                `bnx-dg-cell-${col.type}`,
                col.editable ? 'bnx-dg-cell-editable' : ''
            ].filter(Boolean).join(' ');

            return `<td class="${cls}"
                       style="text-align:${col.align};"
                       data-row="${rowIdx}"
                       data-col="${colIdx}"
                       data-key="${col.key}"
                       tabindex="${col.editable ? 0 : -1}">${formatted}</td>`;
        }).join('');

        return `<tr data-row-idx="${rowIdx}" data-row-key="${rowKey}">${cells}</tr>`;
    }

    _createRowElement(row, rowIdx) {
        const tr = document.createElement('tr');
        tr.dataset.rowIdx = rowIdx;
        tr.dataset.rowKey = this._getRowKey(row, rowIdx);

        this._columns.forEach((col, colIdx) => {
            const td = document.createElement('td');
            td.className = `bnx-dg-cell-${col.type}${col.editable ? ' bnx-dg-cell-editable' : ''}`;
            td.style.textAlign = col.align;
            td.dataset.row = rowIdx;
            td.dataset.col = colIdx;
            td.dataset.key = col.key;
            td.tabIndex = col.editable ? 0 : -1;

            const formatted = this._formatValue(row[col.key] ?? '', col);
            if (this._isHtmlColumn(col)) {
                td.innerHTML = formatted;
            } else {
                td.textContent = formatted;
            }
            tr.appendChild(td);
        });

        return tr;
    }

    _createDefaultRow() {
        const row = { [this.rowKey]: `_new_${Date.now()}` };
        this._columns.forEach(col => {
            if (col.key !== this.rowKey) {
                row[col.key] = (col.type === 'number' || col.type === 'currency') ? 0 : '';
            }
        });
        return row;
    }

    _reindexRows() {
        this.querySelectorAll('tbody tr[data-row-key]').forEach((tr, idx) => {
            tr.dataset.rowIdx = idx;
            tr.querySelectorAll('td').forEach(td => {
                td.dataset.row = idx;
            });
        });
    }

    _showEmptyState() {
        const tbody = this.querySelector('tbody');
        if (tbody && !tbody.querySelector('.bnx-dg-empty-row')) {
            tbody.innerHTML = `<tr class="bnx-dg-empty-row"><td colspan="${this._columns.length}">Sin datos</td></tr>`;
        }
    }

    _removeEmptyState() {
        const empty = this.querySelector('.bnx-dg-empty-row');
        if (empty) empty.remove();
    }

    // === Cards Mode ===

    _renderCards() {
        if (!this._data.length) {
            return '<div class="bnx-dg-empty-state">Sin datos</div>';
        }

        const cards = this._data.map((item, idx) => {
            const content = this._cardTemplate
                ? this._cardTemplate(item, idx)
                : this._renderDefaultCard(item);
            return `<div class="bnx-dg-card" data-card-idx="${idx}" data-card-key="${item[this.rowKey] || idx}">${content}</div>`;
        }).join('');

        return `<div class="bnx-dg-cards-grid">${cards}</div>`;
    }

    _renderDefaultCard(item) {
        const title = this._columns[0] ? item[this._columns[0].key] : 'Item';
        const fields = this._columns.slice(1).map(col => `
            <div class="bnx-dg-card-field">
                <span class="bnx-dg-card-field-label">${col.label}</span>
                <span class="bnx-dg-card-field-value">${this._formatValue(item[col.key], col)}</span>
            </div>
        `).join('');

        return `
            <div class="bnx-dg-card-header"><h4 class="bnx-dg-card-title">${title}</h4></div>
            <div class="bnx-dg-card-body">${fields}</div>
        `;
    }

    _getRowKey(row, rowIdx) {
        return row?.[this.rowKey] || rowIdx;
    }

    _renderDetailsRow(row, rowIdx, key) {
        const html = this._detailsToHtml(this._detailsTemplate?.(row, rowIdx));
        return `<tr class="bnx-dg-details-row" data-details-for="${key}">
                    <td colspan="${this._columns.length}">
                        <div class="bnx-dg-details-content">${html}</div>
                    </td>
                </tr>`;
    }

    _detailsToHtml(content) {
        if (content === null || content === undefined) return '';
        if (typeof content === 'string') return content;
        if (content instanceof HTMLElement) return content.outerHTML;
        return String(content);
    }

    _cleanupExpandedRows() {
        if (!this._expandedRows.size) return;
        const existing = new Set();
        this._data.forEach((row, idx) => {
            existing.add(String(this._getRowKey(row, idx)));
        });
        this._expandedRows.forEach(key => {
            if (!existing.has(key)) this._expandedRows.delete(key);
        });
    }

    _findRowByKey(key) {
        const target = String(key);
        const rows = this.querySelectorAll('tbody tr[data-row-key]');
        for (const tr of rows) {
            if (String(tr.dataset.rowKey) === target) return tr;
        }
        return null;
    }

    _findDetailsRow(key) {
        const target = String(key);
        const rows = this.querySelectorAll('tbody tr.bnx-dg-details-row');
        for (const tr of rows) {
            if (String(tr.dataset.detailsFor) === target) return tr;
        }
        return null;
    }

    _insertDetailsRow(key) {
        const rowTr = this._findRowByKey(key);
        if (!rowTr || this._findDetailsRow(key)) return;

        const rowIdx = parseInt(rowTr.dataset.rowIdx);
        const dataIdx = Number.isNaN(rowIdx)
            ? this._data.findIndex((r, i) => String(this._getRowKey(r, i)) === String(key))
            : rowIdx;
        const row = this._data[dataIdx];
        if (!row) return;

        const detailsTr = document.createElement('tr');
        detailsTr.className = 'bnx-dg-details-row';
        detailsTr.dataset.detailsFor = String(key);

        const td = document.createElement('td');
        td.colSpan = this._columns.length;

        const wrapper = document.createElement('div');
        wrapper.className = 'bnx-dg-details-content';

        const content = this._detailsTemplate?.(row, dataIdx);
        if (content instanceof HTMLElement) {
            wrapper.appendChild(content);
        } else {
            wrapper.innerHTML = this._detailsToHtml(content);
        }

        td.appendChild(wrapper);
        detailsTr.appendChild(td);
        rowTr.insertAdjacentElement('afterend', detailsTr);
    }

    _removeDetailsRow(key) {
        const detailsTr = this._findDetailsRow(key);
        if (detailsTr) detailsTr.remove();
    }

    _refreshDetailsRow(key, rowIdx = null) {
        const detailsTr = this._findDetailsRow(key);
        if (!detailsTr || !this._detailsTemplate) return;

        const idx = rowIdx != null
            ? rowIdx
            : this._data.findIndex((r, i) => String(this._getRowKey(r, i)) === String(key));
        const row = this._data[idx];
        if (!row) return;

        const wrapper = detailsTr.querySelector('.bnx-dg-details-content');
        if (!wrapper) return;

        const content = this._detailsTemplate(row, idx);
        if (content instanceof HTMLElement) {
            wrapper.innerHTML = '';
            wrapper.appendChild(content);
        } else {
            wrapper.innerHTML = this._detailsToHtml(content);
        }
    }

    // === Formatting ===

    _formatValue(value, col) {
        if (value === null || value === undefined) return '';
        if (col?.format) return col.format(value);

        switch (col?.type) {
            case 'number':
                return this._formatNumber(value);
            case 'currency':
                return this._formatCurrency(value);
            case 'date':
                return this._formatDate(value);
            case 'badge':
                return this._formatBadge(value, col.badge);
            case 'action':
            case 'html':
                // No escapar - renderiza HTML directo
                return String(value);
            default:
                return this._escapeHtml(String(value));
        }
    }

    _isHtmlColumn(col) {
        return col?.type === 'action' || col?.type === 'html' || !!col?.format;
    }

    _formatNumber(value) {
        const num = parseFloat(value);
        return isNaN(num) ? value : num.toLocaleString('es-CL');
    }

    _formatCurrency(value) {
        const num = parseFloat(value);
        return isNaN(num) ? value : '$' + num.toLocaleString('es-CL');
    }

    _formatDate(value) {
        try {
            const date = new Date(value);
            if (isNaN(date.getTime())) return value;
            return date.toLocaleDateString('es-CL');
        } catch {
            return value;
        }
    }

    _formatBadge(value, config = {}) {
        const color = config.colors?.[value] || 'default';
        return `<span class="bnx-dg-badge bnx-dg-badge-${color}">${this._escapeHtml(String(value))}</span>`;
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // === Event Delegation ===

    _attachDelegatedListeners() {
        const table = this.querySelector('table');
        if (!table) return;

        // Remover listeners previos
        if (this._boundHandlers) {
            table.removeEventListener('click', this._boundHandlers.click);
            table.removeEventListener('dblclick', this._boundHandlers.dblclick);
            table.removeEventListener('keydown', this._boundHandlers.keydown);
            table.removeEventListener('focusin', this._boundHandlers.focusin);
        }

        // Crear handlers bound
        this._boundHandlers = {
            click: this._handleTableClick.bind(this),
            dblclick: this._handleTableDblClick.bind(this),
            keydown: this._handleTableKeydown.bind(this),
            focusin: this._handleTableFocusin.bind(this)
        };

        table.addEventListener('click', this._boundHandlers.click);
        table.addEventListener('dblclick', this._boundHandlers.dblclick);
        table.addEventListener('keydown', this._boundHandlers.keydown);
        table.addEventListener('focusin', this._boundHandlers.focusin);
    }

    _handleTableClick(e) {
        const cell = e.target.closest('td');
        if (!cell) return;
        if (Number.isNaN(parseInt(cell.dataset.row)) || Number.isNaN(parseInt(cell.dataset.col))) return;

        const rowIdx = parseInt(cell.dataset.row);
        const colIdx = parseInt(cell.dataset.col);
        if (Number.isNaN(rowIdx) || Number.isNaN(colIdx)) return;
        const col = this._columns[colIdx];

        // Dispatch cell-click para todos
        this.dispatchEvent(new CustomEvent('cell-click', {
            bubbles: true,
            detail: {
                rowIndex: rowIdx,
                colIndex: colIdx,
                column: col?.key,
                row: this._data[rowIdx],
                cellElement: cell,
                originalEvent: e
            }
        }));

        // Row select si no es editable
        if (!col?.editable && this.selectable) {
            const tr = cell.closest('tr');
            this.dispatchEvent(new CustomEvent('row-select', {
                bubbles: true,
                detail: {
                    rowIndex: rowIdx,
                    rowKey: tr?.dataset.rowKey,
                    row: this._data[rowIdx]
                }
            }));
        }
    }

    _handleTableDblClick(e) {
        const cell = e.target.closest('td');
        if (!cell) return;

        const colIdx = parseInt(cell.dataset.col);
        if (Number.isNaN(colIdx)) return;
        const col = this._columns[colIdx];

        if (col?.editable) {
            const rowIdx = parseInt(cell.dataset.row);
            this._showEditor(cell, rowIdx, colIdx);
        }
    }

    _handleTableFocusin(e) {
        const cell = e.target.closest('td');
        if (!cell) return;

        // Solo marcar como seleccionada, NO abrir editor
        // Editor se abre solo con double-click o Enter
        this.querySelectorAll('td.bnx-dg-cell-selected').forEach(c => {
            c.classList.remove('bnx-dg-cell-selected');
        });
        cell.classList.add('bnx-dg-cell-selected');
    }

    _handleTableKeydown(e) {
        const cell = e.target.closest('td');
        if (!cell) return;

        const rowIdx = parseInt(cell.dataset.row);
        const colIdx = parseInt(cell.dataset.col);
        if (Number.isNaN(rowIdx) || Number.isNaN(colIdx)) return;

        // Ctrl+Delete: eliminar fila (doble press)
        if (e.key === 'Delete' && e.ctrlKey) {
            e.preventDefault();
            this._handleDoublePress(this._lastCtrlDelete, () => {
                this._deleteRowAtIndex(rowIdx);
            });
            return;
        }

        // Shift+Delete: eliminar fila (doble press) - alternativa
        if (e.key === 'Delete' && e.shiftKey && !e.ctrlKey) {
            e.preventDefault();
            this._handleDoublePress(this._lastShiftDelete, () => {
                this._deleteRowAtIndex(rowIdx);
            });
            return;
        }

        // Navegación
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                this._navigateVertical(rowIdx, colIdx, -1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this._handleArrowDown(rowIdx, colIdx);
                break;
            case 'ArrowLeft':
                if (!this._activeEditor) {
                    e.preventDefault();
                    this._navigateHorizontal(rowIdx, colIdx, -1, true);
                }
                break;
            case 'ArrowRight':
                if (!this._activeEditor) {
                    e.preventDefault();
                    this._navigateHorizontal(rowIdx, colIdx, 1, true);
                }
                break;
            case 'Tab':
                e.preventDefault();
                this._navigateHorizontal(rowIdx, colIdx, e.shiftKey ? -1 : 1);
                break;
            case 'Enter':
                if (!e.shiftKey) {
                    e.preventDefault();
                    if (this._activeEditor) {
                        this._commitEditor();
                        this._navigateVertical(rowIdx, colIdx, 1);
                    } else {
                        // Enter sin editor activo = abrir editor
                        const col = this._columns[colIdx];
                        if (col?.editable) {
                            this._showEditor(cell, rowIdx, colIdx);
                        }
                    }
                }
                break;
            case 'Escape':
                if (this._activeEditor) {
                    e.preventDefault();
                    this._cancelEditor();
                }
                break;
        }
    }

    _handleArrowDown(rowIdx, colIdx) {
        const isLastRow = rowIdx === this._data.length - 1;

        if (isLastRow) {
            // Doble flecha abajo en última fila = crear nueva
            this._handleDoublePress(this._lastArrowDown, () => {
                this.createNewRow(true);
            });
        } else {
            this._navigateVertical(rowIdx, colIdx, 1);
            this._lastArrowDown = { time: 0, count: 0 };
        }
    }

    _handleDoublePress(tracker, callback) {
        const now = Date.now();
        if (now - tracker.time < 500) {
            tracker.count++;
            if (tracker.count >= 2) {
                callback();
                tracker.time = 0;
                tracker.count = 0;
            }
        } else {
            tracker.time = now;
            tracker.count = 1;
        }
    }

    _navigateVertical(rowIdx, colIdx, direction) {
        const newRow = rowIdx + direction;
        if (newRow >= 0 && newRow < this._data.length) {
            this._commitEditor();
            // requestAnimationFrame para esperar posible re-render de cell-blur
            requestAnimationFrame(() => {
                this.focusCell(newRow, colIdx, false);
            });
        }
    }

    _navigateHorizontal(rowIdx, colIdx, direction, wrapInRow = false) {
        const editableCols = this._columns
            .map((col, idx) => col.editable ? idx : -1)
            .filter(idx => idx !== -1);

        if (!editableCols.length) return;

        const currentEditableIdx = editableCols.indexOf(colIdx);
        let newEditableIdx = currentEditableIdx + direction;
        let newRowIdx = rowIdx;

        if (wrapInRow) {
            // Loop infinito dentro de la misma fila
            if (newEditableIdx < 0) {
                newEditableIdx = editableCols.length - 1;
            } else if (newEditableIdx >= editableCols.length) {
                newEditableIdx = 0;
            }
        } else {
            // Tab/Shift+Tab: Wrap al siguiente/anterior fila
            if (newEditableIdx < 0) {
                if (rowIdx > 0) {
                    newRowIdx = rowIdx - 1;
                    newEditableIdx = editableCols.length - 1;
                } else {
                    newEditableIdx = 0;
                }
            } else if (newEditableIdx >= editableCols.length) {
                if (rowIdx < this._data.length - 1) {
                    newRowIdx = rowIdx + 1;
                    newEditableIdx = 0;
                } else {
                    newEditableIdx = editableCols.length - 1;
                }
            }
        }

        this._commitEditor();
        // requestAnimationFrame para esperar posible re-render de cell-blur
        const targetRow = newRowIdx;
        const targetCol = editableCols[newEditableIdx];
        requestAnimationFrame(() => {
            this.focusCell(targetRow, targetCol, false);
        });
    }

    _deleteRowAtIndex(rowIdx) {
        if (rowIdx < 0 || rowIdx >= this._data.length) return;

        const deletedRow = this._data[rowIdx];
        const rowKey = this._getRowKey(deletedRow, rowIdx);

        this._removeEditor();
        this._data.splice(rowIdx, 1);
        this._expandedRows.delete(String(rowKey));
        this._removeDetailsRow(String(rowKey));

        this.dispatchEvent(new CustomEvent('row-deleted', {
            bubbles: true,
            detail: { row: deletedRow, rowIndex: rowIdx, rowKey }
        }));

        const tr = this.querySelector(`tr[data-row-key="${rowKey}"]`);
        if (tr) tr.remove();

        this._reindexRows();

        if (this._data.length === 0) {
            this._showEmptyState();
        } else {
            // Focus en fila anterior o primera (sin abrir editor)
            const newFocusRow = Math.max(0, rowIdx - 1);
            const firstEditableCol = this._columns.findIndex(c => c.editable);
            if (firstEditableCol !== -1) {
                requestAnimationFrame(() => this.focusCell(newFocusRow, firstEditableCol, false));
            }
        }
    }

    // === Editor Overlay ===

    _showEditor(cell, rowIdx, colIdx) {
        // Si ya hay editor en esta celda, no hacer nada
        if (this._editingCell === cell) return;

        // Commit editor anterior si existe
        this._commitEditor();

        const col = this._columns[colIdx];
        const row = this._data[rowIdx];
        const rawValue = row[col.key];

        // Usar textarea para texto, input para otros tipos
        const useTextarea = col.type === 'text' || col.type === undefined || col.multiline;
        const editor = document.createElement(useTextarea ? 'textarea' : 'input');
        editor.className = 'bnx-dg-editor-input';

        if (!useTextarea) {
            editor.type = this._getInputType(col);
            editor.inputMode = this._getInputMode(col);
        } else {
            editor.rows = 1;
        }

        // Valor raw (sin formato)
        editor.value = rawValue ?? '';

        // Validación HTML5 desde config de columna
        if (col.validation) {
            if (col.validation.required) editor.required = true;
            if (col.validation.min != null) editor.min = col.validation.min;
            if (col.validation.max != null) editor.max = col.validation.max;
            if (col.validation.minLength != null) editor.minLength = col.validation.minLength;
            if (col.validation.maxLength != null) editor.maxLength = col.validation.maxLength;
            if (col.validation.pattern) editor.pattern = col.validation.pattern;
            if (col.validation.step) editor.step = col.validation.step;
        }

        // Posicionar sobre la celda
        const rect = cell.getBoundingClientRect();
        const containerRect = this.getBoundingClientRect();

        editor.style.cssText = `
            position: absolute;
            left: ${rect.left - containerRect.left}px;
            top: ${rect.top - containerRect.top}px;
            width: ${rect.width}px;
            min-height: ${rect.height}px;
            text-align: ${col.align};
            z-index: 100;
            resize: none;
            overflow: hidden;
        `;

        // Marcar celda como editando
        cell.classList.add('bnx-dg-cell-editing');

        // Agregar al container
        const container = this.querySelector('.bnx-dg-spreadsheet-container');
        if (container) {
            container.style.position = 'relative';
            container.appendChild(editor);
        }

        this._activeEditor = editor;
        this._editingCell = cell;
        this._originalValue = rawValue;

        // Event listeners del editor
        editor.addEventListener('blur', () => this._onEditorBlur());
        editor.addEventListener('input', () => this._onEditorInput());
        editor.addEventListener('keydown', (e) => this._onEditorKeydown(e));
        editor.addEventListener('paste', (e) => this._onEditorPaste(e));

        // Focus y seleccionar
        editor.focus();
        editor.select();
    }

    _getInputType(col) {
        switch (col.type) {
            case 'number':
            case 'currency':
                return 'text'; // Usamos text para permitir formateo flexible
            case 'date':
                return 'date';
            case 'email':
                return 'email';
            case 'url':
                return 'url';
            case 'tel':
                return 'tel';
            default:
                return 'text';
        }
    }

    _getInputMode(col) {
        switch (col.type) {
            case 'number':
            case 'currency':
                return 'decimal';
            case 'tel':
                return 'tel';
            case 'email':
                return 'email';
            case 'url':
                return 'url';
            default:
                return 'text';
        }
    }

    _onEditorInput() {
        if (!this._activeEditor || !this._editingCell) return;

        // Auto-resize para textarea
        if (this._activeEditor.tagName === 'TEXTAREA') {
            this._activeEditor.style.height = 'auto';
            this._activeEditor.style.height = this._activeEditor.scrollHeight + 'px';
        }

        const rowIdx = parseInt(this._editingCell.dataset.row);
        const colIdx = parseInt(this._editingCell.dataset.col);
        const col = this._columns[colIdx];

        let value = this._activeEditor.value;

        // Parsear números
        if (col.type === 'number' || col.type === 'currency') {
            value = this._parseNumericValue(value);
        }

        // Actualizar data interna
        if (this._data[rowIdx]) {
            this._data[rowIdx][col.key] = value;
        }

        // Dispatch cell-change
        this.dispatchEvent(new CustomEvent('cell-change', {
            bubbles: true,
            detail: {
                rowIndex: rowIdx,
                rowKey: this._data[rowIdx]?.[this.rowKey],
                column: col.key,
                value,
                row: this._data[rowIdx]
            }
        }));
    }

    _onEditorBlur() {
        // Pequeño delay para permitir click en otra celda
        setTimeout(() => {
            if (this._activeEditor && !this._activeEditor.matches(':focus')) {
                this._commitEditor();
            }
        }, 10);
    }

    _getCursorPosition() {
        if (!this._activeEditor) return { atStart: false, atEnd: false };
        const input = this._activeEditor;
        return {
            atStart: input.selectionStart === 0 && input.selectionEnd === 0,
            atEnd: input.selectionStart === input.value.length && input.selectionEnd === input.value.length
        };
    }

    _onEditorKeydown(e) {
        if (!this._editingCell) return;

        const rowIdx = parseInt(this._editingCell.dataset.row);
        const colIdx = parseInt(this._editingCell.dataset.col);
        const cursor = this._getCursorPosition();

        // Shift+Delete: eliminar fila (doble press)
        if (e.key === 'Delete' && e.shiftKey && !e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();
            this._handleDoublePress(this._lastShiftDelete, () => {
                this._commitEditor();
                this._deleteRowAtIndex(rowIdx);
            });
            return;
        }

        switch (e.key) {
            case 'Tab':
                e.preventDefault();
                e.stopPropagation();
                this._commitEditor();
                this._navigateHorizontal(rowIdx, colIdx, e.shiftKey ? -1 : 1);
                break;

            case 'Enter':
                if (e.shiftKey) {
                    // Shift+Enter: nueva línea (solo funciona en textarea)
                    if (this._activeEditor.tagName === 'TEXTAREA') {
                        return;
                    }
                } else {
                    // Enter: guardar y quedarse en la celda actual
                    e.preventDefault();
                    e.stopPropagation();
                    // Guardar índices ANTES de commit (cell-blur puede re-renderizar)
                    const savedRow = rowIdx;
                    const savedCol = colIdx;
                    this._commitEditor();
                    // Re-encontrar celda fresca después del posible re-render
                    requestAnimationFrame(() => {
                        this.focusCell(savedRow, savedCol, false);
                    });
                }
                break;

            case 'Escape':
                e.preventDefault();
                e.stopPropagation();
                // Guardar índices antes de cancelar
                const escRow = rowIdx;
                const escCol = colIdx;
                this._cancelEditor();
                requestAnimationFrame(() => {
                    this.focusCell(escRow, escCol, false);
                });
                break;

            case 'ArrowUp':
                if (cursor.atStart) {
                    // Cursor ya al inicio: navegar arriba
                    e.preventDefault();
                    e.stopPropagation();
                    this._commitEditor();
                    this._navigateVertical(rowIdx, colIdx, -1);
                } else {
                    // Mover cursor al inicio (comportamiento default se cancela)
                    e.preventDefault();
                    e.stopPropagation();
                    this._activeEditor.setSelectionRange(0, 0);
                }
                break;

            case 'ArrowDown':
                if (cursor.atEnd) {
                    // Cursor ya al final: navegar abajo o crear fila
                    e.preventDefault();
                    e.stopPropagation();
                    const isLastRow = rowIdx === this._data.length - 1;
                    if (isLastRow) {
                        this._handleDoublePress(this._lastArrowDown, () => {
                            this._commitEditor();
                            this.createNewRow(true);
                        });
                    } else {
                        this._commitEditor();
                        this._navigateVertical(rowIdx, colIdx, 1);
                    }
                } else {
                    // Mover cursor al final
                    e.preventDefault();
                    e.stopPropagation();
                    const len = this._activeEditor.value.length;
                    this._activeEditor.setSelectionRange(len, len);
                }
                break;

            case 'ArrowLeft':
                if (cursor.atStart) {
                    // Cursor al inicio: navegar a celda anterior (loop en misma fila)
                    e.preventDefault();
                    e.stopPropagation();
                    this._commitEditor();
                    this._navigateHorizontal(rowIdx, colIdx, -1, true);
                }
                // Si no está al inicio, permitir movimiento normal del cursor
                break;

            case 'ArrowRight':
                if (cursor.atEnd) {
                    // Cursor al final: navegar a celda siguiente (loop en misma fila)
                    e.preventDefault();
                    e.stopPropagation();
                    this._commitEditor();
                    this._navigateHorizontal(rowIdx, colIdx, 1, true);
                }
                // Si no está al final, permitir movimiento normal del cursor
                break;
        }
    }

    _onEditorPaste(e) {
        // Forzar text/plain
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
        const clean = text.trim().replace(/[\r\n]+/g, ' ');
        document.execCommand('insertText', false, clean);
    }

    _commitEditor() {
        if (!this._activeEditor || !this._editingCell) return;

        const rowIdx = parseInt(this._editingCell.dataset.row);
        const colIdx = parseInt(this._editingCell.dataset.col);
        const col = this._columns[colIdx];
        const currentValue = this._activeEditor.value;

        // Validación HTML5
        if (!this._activeEditor.checkValidity()) {
            this._activeEditor.reportValidity();
            this._activeEditor.focus();
            return;
        }

        // Parsear valor final
        let finalValue = currentValue;
        if (col.type === 'number' || col.type === 'currency') {
            finalValue = this._parseNumericValue(currentValue);
        }

        // Actualizar celda con valor formateado
        this._editingCell.textContent = this._formatValue(finalValue, col);

        // Actualizar data
        if (this._data[rowIdx]) {
            this._data[rowIdx][col.key] = finalValue;
        }

        // Detectar cambio real
        const hasChanged = this._originalValue !== finalValue;

        // Limpiar estado
        this._editingCell.classList.remove('bnx-dg-cell-editing');
        this._activeEditor.remove();
        this._activeEditor = null;
        this._editingCell = null;

        // Dispatch cell-blur solo si hubo cambio
        if (hasChanged) {
            this.dispatchEvent(new CustomEvent('cell-blur', {
                bubbles: true,
                detail: {
                    rowIndex: rowIdx,
                    rowKey: this._data[rowIdx]?.[this.rowKey],
                    column: col.key,
                    value: finalValue,
                    row: this._data[rowIdx]
                }
            }));
        }
    }

    _cancelEditor() {
        if (!this._activeEditor || !this._editingCell) return null;

        const cell = this._editingCell;

        // Restaurar valor original
        const col = this._columns[parseInt(cell.dataset.col)];
        cell.textContent = this._formatValue(this._originalValue, col);

        cell.classList.remove('bnx-dg-cell-editing');
        this._activeEditor.remove();
        this._activeEditor = null;
        this._editingCell = null;

        return cell;
    }

    _removeEditor() {
        if (this._activeEditor) {
            this._commitEditor();
        }
    }

    _parseNumericValue(str) {
        if (typeof str === 'number') return str;
        if (!str || str === '') return 0;

        str = str.replace(/[$\s]/g, '').trim();

        const hasComma = str.includes(',');
        const hasDot = str.includes('.');

        if (hasComma && hasDot) {
            if (/,\d{1,2}$/.test(str)) {
                str = str.replace(/\./g, '').replace(',', '.');
            } else {
                str = str.replace(/,/g, '');
            }
        } else if (hasComma) {
            str = str.replace(',', '.');
        }

        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    }

    // === Styles ===

    _injectStyles() {
        if (BnxDataGrid._stylesInjected) return;

        const style = document.createElement('style');
        style.id = 'bnx-data-grid-styles';
        style.textContent = `
            bnx-data-grid {
                display: block;
                --grid-border-color: var(--color-border-subtle, #e5e7eb);
                --grid-header-bg: var(--color-gray-50, #f9fafb);
                --grid-row-hover: var(--color-gray-50, #f9fafb);
                --grid-cell-editable-bg: hsl(48, 96%, 98%);
                --grid-cell-focus-ring: var(--color-brand-primary, #2563eb);
            }

            .bnx-data-grid { width: 100%; }

            .bnx-dg-spreadsheet-container {
                overflow-x: auto;
                border: 1px solid var(--grid-border-color);
                border-radius: var(--radius-lg, 0.5rem);
                background: var(--color-white, #fff);
                position: relative;
            }

            .bnx-dg-spreadsheet {
                width: 100%;
                border-collapse: collapse;
                font-size: var(--text-size-sm, 0.875rem);
            }

            .bnx-dg-spreadsheet thead {
                position: sticky;
                top: 0;
                z-index: 10;
            }

            .bnx-dg-spreadsheet th {
                background: var(--grid-header-bg);
                padding: 0.75rem 1rem;
                font-weight: 600;
                color: var(--color-text-secondary, #6b7280);
                text-transform: uppercase;
                font-size: 0.75rem;
                letter-spacing: 0.05em;
                border-bottom: 1px solid var(--grid-border-color);
                white-space: nowrap;
            }

            .bnx-dg-spreadsheet th.bnx-dg-col-editable {
                background: var(--grid-cell-editable-bg);
                color: hsl(45, 80%, 35%);
            }

            .bnx-dg-spreadsheet td {
                padding: 0.75rem 1rem;
                border-bottom: 1px solid var(--grid-border-color);
                color: var(--color-text-primary, #111827);
                position: relative;
            }

            .bnx-dg-spreadsheet tbody tr:hover td {
                background: var(--grid-row-hover);
            }

            .bnx-dg-spreadsheet td.bnx-dg-cell-editable {
                background: var(--grid-cell-editable-bg);
                cursor: text;
            }

            .bnx-dg-spreadsheet td.bnx-dg-cell-editable:hover {
                background: hsl(48, 96%, 95%);
            }

            .bnx-dg-spreadsheet td.bnx-dg-cell-editable:focus,
            .bnx-dg-spreadsheet td.bnx-dg-cell-selected {
                outline: 2px solid var(--grid-cell-focus-ring);
                outline-offset: -2px;
                background: hsl(217, 91%, 97%);
            }

            .bnx-dg-spreadsheet td.bnx-dg-cell-editing {
                background: transparent !important;
                outline: none !important;
            }

            .bnx-dg-details-row td {
                padding: 0;
                background: var(--grid-details-bg, #f8fafc);
            }

            .bnx-dg-details-content {
                padding: 0.75rem 1rem;
            }

            .bnx-dg-spreadsheet td.bnx-dg-cell-number,
            .bnx-dg-spreadsheet td.bnx-dg-cell-currency {
                font-family: 'JetBrains Mono', ui-monospace, monospace;
                font-variant-numeric: tabular-nums;
            }

            .bnx-dg-empty-row td {
                text-align: center;
                color: var(--color-text-tertiary, #9ca3af);
                font-style: italic;
                padding: 2rem !important;
            }

            /* Editor Overlay */
            .bnx-dg-editor-input {
                box-sizing: border-box;
                border: 2px solid var(--grid-cell-focus-ring);
                border-radius: 0;
                padding: 0.6rem 0.9rem;
                font-family: inherit;
                font-size: inherit;
                background: white;
                outline: none;
            }

            .bnx-dg-editor-input:invalid {
                border-color: hsl(0, 84%, 60%);
                background: hsl(0, 84%, 98%);
            }

            .bnx-dg-editor-input:focus {
                box-shadow: 0 0 0 3px hsla(217, 91%, 60%, 0.2);
            }

            /* Cards Mode */
            .bnx-dg-cards-grid {
                display: grid;
                grid-template-columns: repeat(1, 1fr);
                gap: 1rem;
            }

            @media (min-width: 640px) { .bnx-dg-cards-grid { grid-template-columns: repeat(2, 1fr); } }
            @media (min-width: 1024px) { .bnx-dg-cards-grid { grid-template-columns: repeat(3, 1fr); } }
            @media (min-width: 1280px) { .bnx-dg-cards-grid { grid-template-columns: repeat(4, 1fr); } }

            .bnx-dg-card {
                background: white;
                border: 1px solid var(--grid-border-color);
                border-radius: 0.5rem;
                padding: 1.25rem;
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
            }

            .bnx-dg-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            }

            .bnx-dg-card-title {
                font-weight: 700;
                margin: 0 0 0.75rem 0;
            }

            .bnx-dg-card-field {
                display: flex;
                justify-content: space-between;
                font-size: 0.875rem;
                margin-bottom: 0.5rem;
            }

            .bnx-dg-card-field-label { color: #9ca3af; }
            .bnx-dg-card-field-value { color: #6b7280; font-family: monospace; }

            /* Badges */
            .bnx-dg-badge {
                display: inline-block;
                padding: 0.25rem 0.5rem;
                font-size: 0.75rem;
                font-weight: 600;
                border-radius: 9999px;
                text-transform: uppercase;
            }

            .bnx-dg-badge-default { background: #f3f4f6; color: #374151; }
            .bnx-dg-badge-blue { background: hsl(217, 91%, 95%); color: hsl(217, 91%, 45%); }
            .bnx-dg-badge-green { background: hsl(142, 76%, 94%); color: hsl(142, 71%, 29%); }
            .bnx-dg-badge-amber { background: hsl(45, 93%, 94%); color: hsl(45, 93%, 35%); }
            .bnx-dg-badge-red { background: hsl(0, 84%, 95%); color: hsl(0, 84%, 40%); }

            /* Empty State */
            .bnx-dg-empty-state {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 2rem;
                text-align: center;
                color: #9ca3af;
                background: white;
                border: 2px dashed var(--grid-border-color);
                border-radius: 0.5rem;
                min-height: 200px;
            }
        `;
        document.head.appendChild(style);
        BnxDataGrid._stylesInjected = true;
    }
}

customElements.define('bnx-data-grid', BnxDataGrid);

export default BnxDataGrid;
