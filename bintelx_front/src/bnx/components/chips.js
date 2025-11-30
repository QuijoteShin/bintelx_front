import './chips.css';

/**
 * Renders a set of chips into a container.
 * @param {HTMLElement} container
 * @param {Array} items
 * @param {Object} options { onRemove, onClick, getClass, getLabel, closable }
 */
export function renderChips(container, items = [], options = {}) {
  if (!container) return;
  container.innerHTML = '';
  const {
    onRemove,
    onClick,
    getClass,
    getLabel,
    closable = true
  } = options;

  const frag = document.createDocumentFragment();
  items.forEach(item => {
    const chip = document.createElement('span');
    const labelText = typeof getLabel === 'function' ? getLabel(item) : item;
    const chipCls = typeof getClass === 'function' ? getClass(item) : 'bx-chip--primary';
    chip.className = `bx-chip ${chipCls}`;

    const label = document.createElement('span');
    label.textContent = labelText;
    chip.appendChild(label);

    if (closable && typeof onRemove === 'function') {
      const close = document.createElement('span');
      close.className = 'bx-chip__close';
      close.textContent = '×';
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        onRemove(item, chip);
      });
      chip.appendChild(close);
    }

    if (typeof onClick === 'function') {
      chip.addEventListener('click', (e) => {
        // avoid triggering when clicking close
        if (e.target === chip.querySelector('.bx-chip__close')) return;
        onClick(item, chip);
      });
    }

    frag.appendChild(chip);
  });
  container.appendChild(frag);
}

export function chipClassDefault() {
  return 'bx-chip--primary';
}
