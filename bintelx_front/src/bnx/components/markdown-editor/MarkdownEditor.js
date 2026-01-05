// src/bnx/components/markdown-editor/MarkdownEditor.js
// Componente Web para edición de Markdown con preview
import '../shadow/Shadow.js';

// Estilos del editor (van dentro de bnx-shadow)
const EDITOR_STYLES = `
:host {
  display: block;
  flex: 1;
  min-width: 0;
  position: relative;
}
.editor-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
}
.mirror,
.editor {
  position: absolute;
  inset: 0;
  padding: 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13.5px;
  line-height: 1.55;
  tab-size: 2;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: auto;
}
.mirror {
  z-index: 2;
  color: #e7ecff;
  pointer-events: none;
  overflow: hidden;
  margin: 0;
}
.editor {
  z-index: 1;
  resize: none;
  border: 0;
  outline: none;
  background: #0b1020;
  color: #fff;
  caret-color: #e7ecff;
}
.editor::selection {
  background: rgba(122,162,255,0.25);
}
.editor::placeholder {
  color: #9aa6d6;
  opacity: 0.6;
}
/* Highlight tokens - explicit colors for shadow DOM */
.mirror span { color: #e7ecff; }
.tok-h { color: #c7d2ff !important; font-weight: 800; }
.tok-q { color: #b8c6ff !important; }
.tok-l { color: #89b4ff !important; }
.tok-k { color: #ffcc66 !important; }
.tok-c { color: #7ee787 !important; }
.tok-s { color: #ffd1d1 !important; }
.tok-d { color: #8bd5ff !important; }
.tok-t { color: #f2a2ff !important; }
.tok-x { color: #a7b6ff !important; }
.tok-base { color: #e7ecff !important; }
`;

// Estilos del contenedor (light DOM)
const CONTAINER_STYLES = `
bnx-markdown-editor {
  display: block;
  --md-bg: var(--color-surface-100, #0b1020);
  --md-panel: var(--color-surface-200, #0f1730);
  --md-text: var(--color-text-primary, #e7ecff);
  --md-muted: var(--color-text-secondary, #9aa6d6);
  --md-border: var(--color-border, #23305c);
  --md-accent: var(--color-primary-500, #7aa2ff);
  --md-radius: var(--radius-lg, 12px);
}
bnx-markdown-editor .md-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 200px;
  border: 1px solid var(--md-border);
  border-radius: var(--md-radius);
  overflow: hidden;
}
bnx-markdown-editor .md-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--md-border);
  background: var(--md-panel);
  align-items: center;
  flex-wrap: wrap;
}
bnx-markdown-editor .md-toolbar-group {
  display: flex;
  gap: 4px;
  border: 1px solid var(--md-border);
  border-radius: 8px;
  overflow: hidden;
}
bnx-markdown-editor .md-toolbar button {
  appearance: none;
  border: none;
  background: transparent;
  color: #9aa6d6;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
bnx-markdown-editor .md-toolbar button:hover {
  background: rgba(122,162,255,0.1);
  color: #e7ecff;
}
bnx-markdown-editor .md-toolbar button.active {
  background: rgba(122,162,255,0.2);
  color: var(--md-accent);
}
bnx-markdown-editor .md-toolbar-spacer { flex: 1; }
bnx-markdown-editor .md-content {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
bnx-markdown-editor .md-editor-shadow {
  flex: 1;
  min-width: 0;
  position: relative;
}
bnx-markdown-editor .md-editor-shadow.hidden { display: none; }
bnx-markdown-editor .md-divider {
  width: 1px;
  background: var(--md-border);
}
bnx-markdown-editor .md-divider.hidden { display: none; }
bnx-markdown-editor .md-preview-wrap {
  flex: 1;
  min-width: 0;
  overflow: auto;
}
bnx-markdown-editor .md-preview-wrap.hidden { display: none; }
bnx-markdown-editor .md-statusbar {
  display: flex;
  justify-content: space-between;
  padding: 6px 12px;
  border-top: 1px solid var(--md-border);
  background: var(--md-panel);
  color: #9aa6d6;
  font-size: 11px;
}
/* YouTube embeds mínimo */
bnx-markdown-editor .yt-embed { margin: 12px 0; border-radius: 12px; overflow: hidden; }
bnx-markdown-editor .yt-frame { position: relative; width: 100%; padding-top: 56.25%; }
bnx-markdown-editor .yt-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
`;

class BnxMarkdownEditor extends HTMLElement {
  static get observedAttributes() {
    return ['mode', 'placeholder', 'readonly', 'toolbar'];
  }

  constructor() {
    super();
    this._value = '';
    this._mode = 'split'; // 'editor' | 'preview' | 'split'

    this.ready = new Promise(resolve => {
      this._resolveReady = resolve;
    });
  }

  connectedCallback() {
    if (!this._rendered) {
      this._render();
      this._bindEvents();
      this._rendered = true;
    }
    this._resolveReady(this);
  }

  disconnectedCallback() {
    // Cleanup si es necesario
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;

    switch (name) {
      case 'mode':
        this._mode = newVal || 'split';
        this._updateMode();
        break;
      case 'placeholder':
        if (this._editor) this._editor.placeholder = newVal || '';
        break;
      case 'readonly':
        if (this._editor) this._editor.readOnly = newVal !== null;
        break;
      case 'toolbar':
        this._updateToolbarVisibility();
        break;
    }
  }

  // =====================
  // Public API
  // =====================

  get value() {
    return this._editor?.value || this._value;
  }

  set value(val) {
    this._value = val || '';
    if (this._editor) {
      this._editor.value = this._value;
      this._onInput();
    }
  }

  getValue() {
    return this.value;
  }

  setValue(val) {
    this.value = val;
  }

  getHtml() {
    return this._markdownToHtml(this.value);
  }

  clear() {
    this.value = '';
  }

  focus() {
    this._editor?.focus();
  }

  get mode() {
    return this._mode;
  }

  set mode(val) {
    this._mode = val || 'split';
    this.setAttribute('mode', this._mode);
  }

  setMode(mode) {
    this.mode = mode;
  }

  insertAtCursor(text) {
    if (!this._editor) return;
    const start = this._editor.selectionStart;
    const end = this._editor.selectionEnd;
    const before = this._editor.value.slice(0, start);
    const after = this._editor.value.slice(end);
    this._editor.value = before + text + after;
    const pos = start + text.length;
    this._editor.setSelectionRange(pos, pos);
    this._onInput();
  }

  // =====================
  // Rendering
  // =====================

  _render() {
    const placeholder = this.getAttribute('placeholder') || 'Escribe markdown aquí...';
    const readonly = this.hasAttribute('readonly');
    const showToolbar = this.getAttribute('toolbar') !== 'false';

    this.innerHTML = `
      <style>${CONTAINER_STYLES}</style>
      <div class="md-container">
        ${showToolbar ? `
        <div class="md-toolbar">
          <div class="md-toolbar-group">
            <button type="button" data-mode="editor" title="Solo editor">Editor</button>
            <button type="button" data-mode="split" title="Editor + Preview">Split</button>
            <button type="button" data-mode="preview" title="Solo preview">Preview</button>
          </div>
          <div class="md-toolbar-spacer"></div>
        </div>
        ` : ''}
        <div class="md-content">
          <bnx-shadow class="md-editor-shadow">
            <div class="editor-wrap">
              <pre class="mirror" aria-hidden="true"></pre>
              <textarea
                class="editor"
                placeholder="${placeholder}"
                ${readonly ? 'readonly' : ''}
                spellcheck="true"
                autocomplete="off"
                autocapitalize="sentences"
              ></textarea>
            </div>
          </bnx-shadow>
          <div class="md-divider"></div>
          <div class="md-preview-wrap">
            <div class="md-preview"></div>
          </div>
        </div>
        <div class="md-statusbar">
          <span class="md-status-left"></span>
          <span class="md-status-right">
            <span class="lines">0</span> líneas · <span class="chars">0</span> chars
          </span>
        </div>
      </div>
    `;

    // Inyectar estilos en el shadow del editor
    this._editorShadow = this.querySelector('.md-editor-shadow');
    this._editorShadow.injectCSS(EDITOR_STYLES);

    // Referencias dentro del shadow
    this._editor = this._editorShadow.content.querySelector('.editor');
    this._mirror = this._editorShadow.content.querySelector('.mirror');

    // Referencias en light DOM
    this._preview = this.querySelector('.md-preview');
    this._editorWrap = this._editorShadow;
    this._previewWrap = this.querySelector('.md-preview-wrap');
    this._divider = this.querySelector('.md-divider');
    this._linesEl = this.querySelector('.lines');
    this._charsEl = this.querySelector('.chars');

    if (this._value) {
      this._editor.value = this._value;
    }

    this._updateMode();
    this._onInput();
  }

  _bindEvents() {
    // Editor events
    this._editor.addEventListener('input', () => this._onInput());
    this._editor.addEventListener('scroll', () => this._syncScroll());
    this._editor.addEventListener('keydown', () => setTimeout(() => this._syncScroll(), 0));

    // Mode buttons
    this.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.mode = btn.dataset.mode;
      });
    });

    // Paste HTML → Markdown
    this._editor.addEventListener('paste', (e) => this._onPaste(e));
  }

  _updateMode() {
    if (!this._editorWrap) return;

    const mode = this._mode;

    // Update button states
    this.querySelectorAll('[data-mode]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Update visibility
    if (mode === 'editor') {
      this._editorWrap.classList.remove('hidden');
      this._previewWrap.classList.add('hidden');
      this._divider.classList.add('hidden');
    } else if (mode === 'preview') {
      this._editorWrap.classList.add('hidden');
      this._previewWrap.classList.remove('hidden');
      this._divider.classList.add('hidden');
    } else { // split
      this._editorWrap.classList.remove('hidden');
      this._previewWrap.classList.remove('hidden');
      this._divider.classList.remove('hidden');
    }

    this.dispatchEvent(new CustomEvent('modechange', {
      detail: { mode },
      bubbles: true
    }));
  }

  _updateToolbarVisibility() {
    // Re-render si cambia el atributo toolbar
    if (this.isConnected) {
      this._render();
      this._bindEvents();
    }
  }

  _onInput() {
    const md = this._editor.value;
    this._value = md;

    // Update mirror highlight
    const highlighted = this._highlightMarkdown(md);
    console.log('Highlighted HTML (first 2000 chars):', highlighted.substring(0, 2000));
    this._mirror.innerHTML = highlighted;

    // Update preview
    this._preview.innerHTML = this._markdownToHtml(md);

    // Update stats
    const lines = md ? md.split('\n').length : 0;
    if (this._linesEl) this._linesEl.textContent = lines;
    if (this._charsEl) this._charsEl.textContent = md.length;

    // Emit change event
    this.dispatchEvent(new CustomEvent('input', {
      detail: { value: md },
      bubbles: true
    }));

    this.dispatchEvent(new CustomEvent('change', {
      detail: { value: md, html: this._preview.innerHTML },
      bubbles: true
    }));
  }

  _syncScroll() {
    this._mirror.style.transform = `translate(${-this._editor.scrollLeft}px, ${-this._editor.scrollTop}px)`;
  }

  _onPaste(e) {
    const cd = e.clipboardData;
    if (!cd) return;

    const html = cd.getData('text/html');
    const text = cd.getData('text/plain');

    const looksHtml = !!html && /<\w[\s\S]*>/.test(html);
    const looksHtmlInPlain = !!text && /<\w[\s\S]*>/.test(text);

    if (!looksHtml && !looksHtmlInPlain) return;

    e.preventDefault();
    try {
      const src = looksHtml ? html : text;
      const md = this._htmlToMarkdown(src);
      this.insertAtCursor(md);
    } catch (err) {
      console.error('Paste conversion failed:', err);
      this.insertAtCursor(text);
    }
  }

  // =====================
  // Markdown Processing
  // =====================

  _escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  _youtubeEmbedUrl(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace('www.', '');
      let id = '';

      if (host === 'youtu.be') {
        id = u.pathname.split('/').filter(Boolean)[0] || '';
      } else if (host.endsWith('youtube.com')) {
        if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
        else if (u.pathname.startsWith('/embed/')) id = u.pathname.split('/').filter(Boolean)[1] || '';
        else if (u.pathname.startsWith('/shorts/')) id = u.pathname.split('/').filter(Boolean)[1] || '';
      }

      id = (id || '').trim();
      if (!id || !/^[A-Za-z0-9_-]{6,}$/.test(id)) return null;
      return 'https://www.youtube-nocookie.com/embed/' + id;
    } catch {
      return null;
    }
  }

  _renderYoutubeEmbed(embedUrl, label) {
    return `
      <div class="yt-embed">
        ${label ? `<div class="yt-title">${this._escapeHtml(label)}</div>` : ''}
        <div class="yt-frame">
          <iframe src="${embedUrl}" title="YouTube video" loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen></iframe>
        </div>
      </div>
    `;
  }

  _highlightMarkdown(md) {
    const esc = this._escapeHtml(md);
    const lines = esc.split('\n');
    const out = [];
    let inFence = false;

    for (const line of lines) {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        out.push(`<span class="tok-k">${line}</span>`);
        continue;
      }

      if (inFence) {
        out.push(`<span class="tok-c">${line}</span>`);
        continue;
      }

      if (/^\s*#{1,6}\s+/.test(line)) {
        out.push(`<span class="tok-h">${line}</span>`);
        continue;
      }

      if (/^\s*&gt;/.test(line)) {
        out.push(`<span class="tok-q">${line}</span>`);
        continue;
      }

      if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
        out.push(`<span class="tok-d">${line}</span>`);
        continue;
      }

      if (/^\s*(-\s+|\d+\.\s+)/.test(line)) {
        out.push(`<span class="tok-l">${line}</span>`);
        continue;
      }

      if (/\|/.test(line)) {
        out.push(`<span class="tok-t">${line}</span>`);
        continue;
      }

      let s = line;
      s = s.replace(/`([^`]+)`/g, '<span class="tok-c">`$1`</span>');
      s = s.replace(/\*\*([^*]+)\*\*/g, '<span class="tok-s">**$1**</span>');
      s = s.replace(/\*([^*]+)\*/g, '<span class="tok-x">*$1*</span>');
      s = s.replace(/~~([^~]+)~~/g, '<span class="tok-d">~~$1~~</span>');
      s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="tok-k">[$1]</span><span class="tok-l">($2)</span>');

      out.push(`<span class="tok-base">${s}</span>`);
    }

    return out.join('\n');
  }

  _markdownToHtml(md) {
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    let html = '';
    let i = 0;
    let inCode = false;
    let codeLang = '';

    const inline = (s) => {
      let t = this._escapeHtml(s);
      t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>');
      t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />');
      t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
        const embed = this._youtubeEmbedUrl(url);
        if (embed) return this._renderYoutubeEmbed(embed, label);
        return `<a href="${url}" target="_blank" rel="noreferrer">${label}</a>`;
      });
      return t;
    };

    while (i < lines.length) {
      const line = lines[i];

      // Code fence
      const fence = line.match(/^\s*```(.*)$/);
      if (fence) {
        if (!inCode) {
          inCode = true;
          codeLang = fence[1].trim();
          html += `<pre><code${codeLang ? ` class="language-${this._escapeHtml(codeLang)}"` : ''}>`;
        } else {
          inCode = false;
          html += '</code></pre>';
        }
        i++;
        continue;
      }

      if (inCode) {
        html += this._escapeHtml(line) + '\n';
        i++;
        continue;
      }

      if (!line.trim()) {
        i++;
        continue;
      }

      // YouTube directive
      const ytDirective = line.trim().match(/^@\[youtube\]\(([^)]+)\)$/i);
      if (ytDirective) {
        const embed = this._youtubeEmbedUrl(ytDirective[1]);
        if (embed) html += this._renderYoutubeEmbed(embed, null);
        i++;
        continue;
      }

      // YouTube link as block
      const ytLink = line.trim().match(/^\[([^\]]+)\]\((https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[\w-]+[^\s)]*)\)$/);
      if (ytLink) {
        const embed = this._youtubeEmbedUrl(ytLink[2]);
        if (embed) {
          html += this._renderYoutubeEmbed(embed, ytLink[1]);
          i++;
          continue;
        }
      }

      // Heading
      const h = line.match(/^(#{1,6})\s+(.+)$/);
      if (h) {
        const level = h[1].length;
        html += `<h${level}>${inline(h[2].trim())}</h${level}>`;
        i++;
        continue;
      }

      // HR
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        html += '<hr/>';
        i++;
        continue;
      }

      // Blockquote
      if (/^\s*>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          buf.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        html += `<blockquote>${buf.map(l => inline(l)).join('<br/>')}</blockquote>`;
        continue;
      }

      // Table
      if (/\|/.test(line) && lines[i + 1] && /^\s*\|?[\s:-]+\|/.test(lines[i + 1])) {
        const rows = [];
        while (i < lines.length && /\|/.test(lines[i])) {
          rows.push(lines[i]);
          i++;
        }
        if (rows.length >= 2) {
          const splitRow = (r) => {
            let s = r.trim();
            if (s.startsWith('|')) s = s.slice(1);
            if (s.endsWith('|')) s = s.slice(0, -1);
            return s.split('|').map(c => c.trim());
          };
          const header = splitRow(rows[0]).map(inline);
          const body = rows.slice(2).map(r => splitRow(r).map(inline));
          html += '<table><thead><tr>';
          header.forEach(c => html += `<th>${c}</th>`);
          html += '</tr></thead><tbody>';
          body.forEach(row => {
            html += '<tr>';
            row.forEach(c => html += `<td>${c}</td>`);
            html += '</tr>';
          });
          html += '</tbody></table>';
        }
        continue;
      }

      // List
      if (/^\s*(-\s+|\d+\.\s+)/.test(line)) {
        const isOrdered = /^\s*\d+\./.test(line);
        const tag = isOrdered ? 'ol' : 'ul';
        html += `<${tag}>`;
        while (i < lines.length && /^\s*(-\s+|\d+\.\s+)/.test(lines[i])) {
          const content = lines[i].replace(/^\s*(-\s+|\d+\.\s+)/, '');
          // Task list
          const task = content.match(/^\[( |x|X)\]\s+(.*)$/);
          if (task) {
            const checked = task[1].toLowerCase() === 'x';
            html += `<li><label><input type="checkbox" disabled ${checked ? 'checked' : ''}/> ${inline(task[2])}</label></li>`;
          } else {
            html += `<li>${inline(content)}</li>`;
          }
          i++;
        }
        html += `</${tag}>`;
        continue;
      }

      // Paragraph
      const buf = [line];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^\s*```/.test(lines[i]) &&
        !/^#{1,6}\s+/.test(lines[i]) &&
        !/^\s*(-\s+|\d+\.\s+)/.test(lines[i]) &&
        !/^\s*>\s?/.test(lines[i]) &&
        !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
      ) {
        buf.push(lines[i]);
        i++;
      }
      html += `<p>${inline(buf.join(' ').trim())}</p>`;
    }

    return html;
  }

  _htmlToMarkdown(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const trimLines = (s) => String(s).replace(/\n{3,}/g, '\n\n').trim();
    const textOf = (node) => node?.textContent ?? '';

    const convert = (node, ctx = { listDepth: 0 }) => {
      if (!node) return '';
      if (node.nodeType === Node.TEXT_NODE) {
        return (node.nodeValue ?? '').replace(/\s+/g, ' ');
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const el = node;
      const tag = el.tagName.toLowerCase();
      const children = () => Array.from(el.childNodes).map(ch => convert(ch, ctx)).join('');

      switch (tag) {
        case 'h1': return `# ${trimLines(children())}\n\n`;
        case 'h2': return `## ${trimLines(children())}\n\n`;
        case 'h3': return `### ${trimLines(children())}\n\n`;
        case 'h4': return `#### ${trimLines(children())}\n\n`;
        case 'h5': return `##### ${trimLines(children())}\n\n`;
        case 'h6': return `###### ${trimLines(children())}\n\n`;
        case 'p': return `${trimLines(children())}\n\n`;
        case 'br': return '\n';
        case 'hr': return '---\n\n';
        case 'strong':
        case 'b': return `**${trimLines(children())}**`;
        case 'em':
        case 'i': return `*${trimLines(children())}*`;
        case 'del':
        case 's': return `~~${trimLines(children())}~~`;
        case 'code': return `\`${textOf(el)}\``;
        case 'pre': {
          const codeEl = el.querySelector('code');
          const raw = codeEl ? textOf(codeEl) : textOf(el);
          const lang = (codeEl?.className || '').match(/language-([\w-]+)/)?.[1] || '';
          return `\n\n\`\`\`${lang}\n${raw.replace(/\n+$/, '')}\n\`\`\`\n\n`;
        }
        case 'a': {
          const href = el.getAttribute('href') || '';
          const label = trimLines(children()) || href;
          return `[${label}](${href})`;
        }
        case 'img': {
          const alt = el.getAttribute('alt') || '';
          const src = el.getAttribute('src') || '';
          return `![${alt}](${src})`;
        }
        case 'blockquote': {
          const inner = trimLines(children());
          return inner.split('\n').map(l => `> ${l}`).join('\n') + '\n\n';
        }
        case 'ul':
        case 'ol': {
          const ordered = tag === 'ol';
          const items = Array.from(el.children).filter(c => c.tagName.toLowerCase() === 'li');
          let out = '';
          items.forEach((li, idx) => {
            const prefix = ordered ? `${idx + 1}. ` : '- ';
            const indent = '  '.repeat(ctx.listDepth);
            const inner = trimLines(Array.from(li.childNodes).map(ch => convert(ch, { listDepth: ctx.listDepth + 1 })).join(''));
            out += `${indent}${prefix}${inner}\n`;
          });
          return out + '\n';
        }
        case 'table': {
          const rows = Array.from(el.querySelectorAll('tr'));
          if (!rows.length) return '';
          const matrix = rows.map(r =>
            Array.from(r.children)
              .filter(c => ['th', 'td'].includes(c.tagName.toLowerCase()))
              .map(c => trimLines(Array.from(c.childNodes).map(ch => convert(ch, ctx)).join('')))
          );
          if (!matrix.length) return '';
          const header = matrix[0];
          const cols = header.length;
          const rowLine = (r) => `| ${r.map(c => c.replace(/\|/g, '\\|')).join(' | ')} |`;
          let out = rowLine(header) + '\n';
          out += rowLine(Array(cols).fill('---')) + '\n';
          matrix.slice(1).forEach(r => out += rowLine(r) + '\n');
          return out + '\n';
        }
        default:
          return children();
      }
    };

    const md = Array.from(doc.body.childNodes).map(n => convert(n)).join('');
    return trimLines(md) + '\n';
  }
}

customElements.define('bnx-markdown-editor', BnxMarkdownEditor);

export default BnxMarkdownEditor;
