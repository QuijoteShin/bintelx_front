// src/bnx/components/FileHandler.js
import './file-handler.css';
import { api } from '@bnx/api.js';
import { devlog } from '@bnx/utils.js';

const SIMPLE_UPLOAD_THRESHOLD = 5 * 1024 * 1024;
const FILE_ICONS = {
    image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`,
    pdf: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6M9 11h6"/></svg>`,
    doc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    spreadsheet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
    archive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>`,
    video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3V9z"/></svg>`,
    audio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    default: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
};
const STATUS_ICONS = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    dedup: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>`,
    view: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`
};
const INSTANCES = new WeakMap();

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function computeSHA256(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getFileIcon(file) {
    const type = file.type || '';
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (type.startsWith('image/')) return { icon: FILE_ICONS.image, class: 'fh-icon-image' };
    if (type === 'application/pdf' || ext === 'pdf') return { icon: FILE_ICONS.pdf, class: 'fh-icon-pdf' };
    if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return { icon: FILE_ICONS.doc, class: 'fh-icon-doc' };
    if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return { icon: FILE_ICONS.spreadsheet, class: 'fh-icon-spreadsheet' };
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { icon: FILE_ICONS.archive, class: 'fh-icon-archive' };
    if (type.startsWith('video/') || ['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) return { icon: FILE_ICONS.video, class: 'fh-icon-video' };
    if (type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return { icon: FILE_ICONS.audio, class: 'fh-icon-audio' };
    if (['js', 'ts', 'py', 'php', 'html', 'css', 'json', 'xml', 'sql'].includes(ext)) return { icon: FILE_ICONS.code, class: 'fh-icon-code' };
    return { icon: FILE_ICONS.default, class: 'fh-icon-default' };
}

function generateId() {
    return Math.random().toString(36).substring(2, 15);
}

function serializeItem(item) {
    return {
        document_id: item.documentId,
        hash: item.hash,
        size_bytes: item.file.size,
        original_name: item.file.name,
        mime_type: item.file.type || 'application/octet-stream',
        deduplicated: !!item.deduplicated
    };
}

function dispatchUploadEvent(root, name, detail) {
    root.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
}

function mimeToExtension(type) {
    const map = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'application/pdf': 'pdf'
    };
    return map[type] || 'bin';
}

function extractFilesFromClipboard(event) {
    const files = [];
    const clipboard = event?.clipboardData;
    if (!clipboard) return files;

    if (clipboard.files && clipboard.files.length) {
        files.push(...Array.from(clipboard.files));
        return files;
    }

    if (clipboard.items && clipboard.items.length) {
        Array.from(clipboard.items).forEach((item) => {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) files.push(file);
            }
        });
    }

    return files;
}

async function readClipboardFiles() {
    // Requiere permiso clipboard-read y ejecutarse en un gesto de usuario.
    if (!navigator.clipboard?.read) return [];
    const items = await navigator.clipboard.read();
    const files = [];
    let idx = 1;

    for (const item of items) {
        if (!item.types || !item.types.length) continue;
        for (const type of item.types) {
            if (!type || type.startsWith('text/')) continue;
            const blob = await item.getType(type);
            if (!blob) continue;
            if (blob instanceof File) {
                files.push(blob);
                idx += 1;
                break;
            }
            const ext = mimeToExtension(blob.type || type);
            const name = `clipboard-${Date.now()}-${idx}.${ext}`;
            files.push(new File([blob], name, { type: blob.type || type }));
            idx += 1;
            break;
        }
    }

    return files;
}

export function initFileHandler(root) {
    if (!root || INSTANCES.has(root)) return;

    const dropArea = root.querySelector('[data-fh-scope]') || root.querySelector('.fh-drop-area');
    const filesInput = root.querySelector('[data-fh-files]') || root.querySelector('#fh-files');
    const directoryInput = root.querySelector('[data-fh-directory]') || root.querySelector('#fh-directory');
    const browseFiles = root.querySelector('[data-fh-browse-files]') || root.querySelector('#fh-browse-files');
    const browseFolder = root.querySelector('[data-fh-browse-folder]') || root.querySelector('#fh-browse-folder');
    const uploadBtn = root.querySelector('[data-fh-upload]') || root.querySelector('#fh-upload-btn');
    const clearBtn = root.querySelector('[data-fh-clear]') || root.querySelector('#fh-clear-btn');
    const actionBar = root.querySelector('[data-fh-action]') || root.querySelector('#fh-action-bar');
    const fileList = root.querySelector('[data-fh-file-list]') || root.querySelector('#fh-file-list');
    const countEl = root.querySelector('[data-fh-count]') || root.querySelector('#fh-count');
    const totalSizeEl = root.querySelector('[data-fh-total-size]') || root.querySelector('#fh-total-size');
    const resultsCard = root.querySelector('[data-fh-results]') || root.querySelector('#fh-results-card');
    const resultsContent = root.querySelector('[data-fh-results-content]') || root.querySelector('#fh-results-content');
    const pasteBtn = root.querySelector('[data-fh-paste]');

    if (!dropArea || !filesInput || !actionBar || !fileList || !countEl || !totalSizeEl || !uploadBtn || !clearBtn) return;

    const state = { fileQueue: new Map() };
    INSTANCES.set(root, state);
    if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '0');

    function updateActionBar() {
        const count = state.fileQueue.size;
        let totalSize = 0;
        state.fileQueue.forEach(item => totalSize += item.file.size);
        countEl.textContent = count;
        totalSizeEl.textContent = count > 0 ? `(${formatBytes(totalSize)})` : '';
        actionBar.style.display = count > 0 ? 'flex' : 'none';
    }

    function createFileCard(item) {
        const card = document.createElement('div');
        card.className = 'fh-file-card';
        card.dataset.fhId = item.id;

        const iconData = getFileIcon(item.file);
        const isImage = item.file.type.startsWith('image/');

        card.innerHTML = `
            <div class="fh-file-preview ${iconData.class}">
                ${isImage ? `<img src="" alt="" class="fh-file-thumb">` : iconData.icon}
            </div>
            <div class="fh-file-info">
                <div class="fh-file-header">
                    <span class="fh-file-name" title="${item.file.name}">${item.file.name}</span>
                    <span class="fh-file-size">${formatBytes(item.file.size)}</span>
                </div>
                <div class="fh-file-progress">
                    <div class="fh-progress-bar">
                        <div class="fh-progress-fill" style="width: 0%"></div>
                    </div>
                    <span class="fh-file-status">Esperando...</span>
                </div>
            </div>
            <div class="fh-file-actions">
                <button type="button" class="fh-file-remove" title="Eliminar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <div class="fh-file-result"></div>
            </div>
        `;

        if (isImage) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = card.querySelector('.fh-file-thumb');
                if (img) img.src = e.target.result;
            };
            reader.readAsDataURL(item.file);
        }

        card.querySelector('.fh-file-remove').addEventListener('click', () => removeFile(item.id));
        return card;
    }

    function updateFileCard(item) {
        const card = root.querySelector(`[data-fh-id="${item.id}"]`);
        if (!card) return;

        const progressFill = card.querySelector('.fh-progress-fill');
        const statusEl = card.querySelector('.fh-file-status');
        const resultEl = card.querySelector('.fh-file-result');
        const removeBtn = card.querySelector('.fh-file-remove');

        card.className = `fh-file-card fh-status-${item.status}`;

        const statusTexts = {
            pending: 'Esperando...',
            hashing: 'Calculando hash...',
            checking: 'Verificando...',
            uploading: `Subiendo ${item.progress}%`,
            completed: 'Completado',
            deduplicated: 'Ya existe (deduplicado)',
            error: item.errorMsg || 'Error'
        };

        statusEl.textContent = statusTexts[item.status] || item.status;
        progressFill.style.width = `${item.progress}%`;

        if (item.status === 'completed' || item.status === 'deduplicated') {
            const isDedup = item.status === 'deduplicated';
            resultEl.innerHTML = `
                <span class="fh-status-icon ${isDedup ? 'fh-result-dedup' : 'fh-result-success'}">${isDedup ? STATUS_ICONS.dedup : STATUS_ICONS.success}</span>
                <button type="button" class="fh-btn-view" title="Ver en navegador">${STATUS_ICONS.view}</button>
                <button type="button" class="fh-btn-download" title="Descargar">${STATUS_ICONS.download}</button>
            `;
            resultEl.className = 'fh-file-result fh-file-actions-complete';
            removeBtn.style.display = 'none';

            const viewBtn = resultEl.querySelector('.fh-btn-view');
            const downloadBtn = resultEl.querySelector('.fh-btn-download');

            viewBtn?.addEventListener('click', () => {
                if (item.documentId) {
                    window.open(`/api/files/documents/${item.documentId}/download?inline`, '_blank');
                }
            });
            downloadBtn?.addEventListener('click', () => {
                if (item.documentId) {
                    window.location.href = `/api/files/documents/${item.documentId}/download`;
                }
            });

            if (!item.emitted) {
                item.emitted = true;
                dispatchUploadEvent(root, 'filehandler-file-complete', serializeItem(item));
            }
        } else if (item.status === 'error') {
            resultEl.innerHTML = STATUS_ICONS.error;
            resultEl.className = 'fh-file-result fh-result-error';
        } else if (item.status === 'uploading') {
            removeBtn.style.display = 'none';
        }
    }

    async function addFilesToQueue(files) {
        for (const file of files) {
            const isDuplicate = Array.from(state.fileQueue.values()).some(
                item => item.file.name === file.name && item.file.size === file.size
            );
            if (isDuplicate) continue;

            const item = {
                id: generateId(),
                file,
                hash: null,
                status: 'pending',
                progress: 0,
                deduplicated: false,
                documentId: null,
                errorMsg: null,
                emitted: false
            };

            state.fileQueue.set(item.id, item);
            fileList.appendChild(createFileCard(item));
        }

        updateActionBar();

        for (const item of state.fileQueue.values()) {
            if (!item.hash && item.status === 'pending') {
                item.status = 'hashing';
                updateFileCard(item);
                try {
                    item.hash = await computeSHA256(item.file);
                    item.status = 'pending';
                } catch (err) {
                    devlog('Error calculando hash:', err);
                    item.status = 'error';
                    item.errorMsg = 'Hash failed';
                }
                updateFileCard(item);
            }
        }
    }

    function removeFile(id) {
        const card = root.querySelector(`[data-fh-id="${id}"]`);
        if (card) {
            card.classList.add('fh-removing');
            setTimeout(() => card.remove(), 300);
        }
        state.fileQueue.delete(id);
        updateActionBar();
    }

    function clearQueue() {
        state.fileQueue.clear();
        fileList.innerHTML = '';
        filesInput.value = '';
        directoryInput.value = '';
        if (resultsCard) resultsCard.style.display = 'none';
        updateActionBar();
    }

    async function checkDeduplication(item) {
        item.status = 'checking';
        updateFileCard(item);

        try {
            const res = await api.post('/files/check', {
                hash: item.hash,
                mime_type: item.file.type || 'application/octet-stream',
                original_name: item.file.name
            });
            if (res?.d?.exists) {
                item.deduplicated = true;
                item.status = 'deduplicated';
                item.progress = 100;
                item.documentId = res.d.document_id;
            } else {
                item.status = 'pending';
            }
        } catch (err) {
            devlog('Error checking dedup:', err);
            item.status = 'pending';
        }
        updateFileCard(item);
        return item.deduplicated;
    }

    async function uploadSimple(item) {
        item.status = 'uploading';
        item.progress = 10;
        updateFileCard(item);

        try {
            const formData = new FormData();
            formData.append('file', item.file);

            item.progress = 50;
            updateFileCard(item);

            const res = await api.post('/files/upload-simple', formData);
            if (res?.d?.success) {
                item.status = 'completed';
                item.progress = 100;
                item.documentId = res.d.document_id;
                item.deduplicated = res.d.deduplicated || false;
                if (item.deduplicated) item.status = 'deduplicated';
            } else {
                throw new Error(res?.d?.message || 'Upload failed');
            }
        } catch (err) {
            devlog('Error upload simple:', err);
            item.status = 'error';
            item.errorMsg = err.message || 'Upload failed';
        }
        updateFileCard(item);
    }

    async function uploadChunked(item) {
        item.status = 'uploading';
        item.progress = 0;
        updateFileCard(item);

        try {
            const initRes = await api.post('/files/upload/init', {
                hash: item.hash,
                size_bytes: item.file.size,
                original_name: item.file.name,
                mime_type: item.file.type || 'application/octet-stream'
            });

            if (!initRes?.d?.success) {
                if (initRes?.d?.exists) {
                    item.status = 'deduplicated';
                    item.deduplicated = true;
                    item.progress = 100;
                    item.documentId = initRes.d.document_id;
                    updateFileCard(item);
                    return;
                }
                throw new Error(initRes?.d?.message || 'Init failed');
            }

            const uploadId = initRes.d.upload_id;
            const chunkSize = initRes.d.chunk_size;
            const totalChunks = initRes.d.total_chunks;

            for (let i = 0; i < totalChunks; i++) {
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, item.file.size);
                const chunk = item.file.slice(start, end);
                const chunkBuffer = await chunk.arrayBuffer();

                const chunkRes = await fetch(`/api/files/upload/${uploadId}/chunk?chunk_index=${i}`, {
                    method: 'PUT',
                    body: chunkBuffer,
                    headers: { 'Content-Type': 'application/octet-stream' }
                });

                if (!chunkRes.ok) throw new Error(`Chunk ${i} failed`);

                item.progress = Math.round(((i + 1) / totalChunks) * 100);
                updateFileCard(item);
            }

            const completeRes = await api.post(`/files/upload/${uploadId}/complete`, {});
            if (completeRes?.d?.success) {
                item.status = 'completed';
                item.documentId = completeRes.d.document_id;
            } else {
                throw new Error(completeRes?.d?.message || 'Complete failed');
            }
        } catch (err) {
            devlog('Error upload chunked:', err);
            item.status = 'error';
            item.errorMsg = err.message || 'Upload failed';
        }
        updateFileCard(item);
    }

    async function uploadAll() {
        uploadBtn.disabled = true;
        uploadBtn.classList.add('loading');

        const results = { uploaded: 0, deduplicated: 0, failed: 0 };

        for (const item of state.fileQueue.values()) {
            if (item.status === 'completed' || item.status === 'deduplicated') {
                results.deduplicated++;
                continue;
            }

            const isDup = await checkDeduplication(item);
            if (isDup) {
                results.deduplicated++;
                continue;
            }

            if (item.file.size <= SIMPLE_UPLOAD_THRESHOLD) {
                await uploadSimple(item);
            } else {
                await uploadChunked(item);
            }

            if (item.status === 'completed') results.uploaded++;
            else if (item.status === 'deduplicated') results.deduplicated++;
            else results.failed++;
        }

        if (resultsCard && resultsContent) {
            resultsCard.style.display = 'block';
            resultsContent.innerHTML = `
                <div class="fh-result-item fh-result-uploaded">
                    <span class="fh-result-value">${results.uploaded}</span>
                    <span class="fh-result-label">Subidos</span>
                </div>
                <div class="fh-result-item fh-result-deduplicated">
                    <span class="fh-result-value">${results.deduplicated}</span>
                    <span class="fh-result-label">Deduplicados</span>
                </div>
                <div class="fh-result-item fh-result-failed">
                    <span class="fh-result-value">${results.failed}</span>
                    <span class="fh-result-label">Fallidos</span>
                </div>
            `;
        }

        const uploadedFiles = Array.from(state.fileQueue.values())
            .filter(item => item.documentId)
            .map(item => serializeItem(item));
        dispatchUploadEvent(root, 'filehandler-upload-complete', { files: uploadedFiles });

        uploadBtn.disabled = false;
        uploadBtn.classList.remove('loading');
    }

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        dropArea.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    ['dragenter', 'dragover'].forEach(evt => {
        dropArea.addEventListener(evt, () => dropArea.classList.add('fh-drop-active'));
    });

    ['dragleave', 'drop'].forEach(evt => {
        dropArea.addEventListener(evt, () => dropArea.classList.remove('fh-drop-active'));
    });

    dropArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer?.files;
        if (files?.length) addFilesToQueue(Array.from(files));
    });

    root.addEventListener('pointerdown', (e) => {
        if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        root.focus();
    });

    root.addEventListener('paste', (e) => {
        const files = extractFilesFromClipboard(e);
        if (files.length) {
            e.preventDefault();
            addFilesToQueue(files);
        }
    });

    browseFiles?.addEventListener('click', () => filesInput?.click());
    browseFolder?.addEventListener('click', () => directoryInput?.click());
    filesInput.addEventListener('change', (e) => addFilesToQueue(Array.from(e.target.files)));
    directoryInput.addEventListener('change', (e) => addFilesToQueue(Array.from(e.target.files)));
    uploadBtn.addEventListener('click', uploadAll);
    clearBtn.addEventListener('click', clearQueue);
    pasteBtn?.addEventListener('click', async () => {
        try {
            const files = await readClipboardFiles();
            if (files.length) addFilesToQueue(files);
        } catch (err) {
            devlog('Clipboard read failed:', err);
        }
    });
}

export function initFileHandlers(container) {
    if (!container) return;
    container.querySelectorAll('[data-fh-root]').forEach((root) => initFileHandler(root));
}
