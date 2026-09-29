// Shared rendering and the small set of mobile dialogs the app needs.

import { noteDisplayTitle, isUntitled, notePreview, formatStamp } from './model.js';

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) {
    if (child) node.append(child);
  }
  return node;
}

export function renderNoteCard(note) {
  const preview = notePreview(note);
  const card = el('a', { class: 'note-card', href: `./note.html?id=${encodeURIComponent(note.id)}` }, [
    el('div', { class: 'note-card-box' }, [
      el('div', {
        class: preview ? 'note-card-preview' : 'note-card-preview is-empty',
        dir: 'auto',
        text: preview || 'Empty note'
      }),
      note.favourite ? el('span', { class: 'fav-badge', 'aria-label': 'Favourite', text: '★' }) : null
    ]),
    el('div', { class: 'note-card-caption' }, [
      el('div', { class: 'note-card-title-row' }, [
        el('span', {
          class: isUntitled(note) ? 'note-card-title untitled' : 'note-card-title',
          dir: 'auto',
          text: noteDisplayTitle(note)
        })
      ]),
      el('div', { class: 'note-card-meta', text: formatStamp(note.updatedAt) })
    ])
  ]);
  return card;
}

export function renderEmptyState({ mark, title, body, actionLabel, onAction, extra }) {
  return el('div', { class: 'empty-state' }, [
    mark ? el('div', { class: 'mark', text: mark }) : null,
    el('h2', { text: title }),
    el('p', { text: body }),
    actionLabel ? el('button', { class: 'btn-primary', type: 'button', onclick: onAction, text: actionLabel }) : null,
    extra ? el('div', { class: 'langs', text: extra }) : null
  ]);
}

/* ---- overlays -------------------------------------------------------------- */

function mountOverlay(node, { onDismiss }) {
  const scrim = el('div', { class: 'scrim' });
  document.body.append(scrim, node);
  requestAnimationFrame(() => {
    scrim.classList.add('open');
    node.classList.add('open');
  });

  const close = () => {
    scrim.classList.remove('open');
    node.classList.remove('open');
    setTimeout(() => {
      scrim.remove();
      node.remove();
    }, 180);
    document.removeEventListener('keydown', onKey);
  };

  const onKey = (e) => {
    if (e.key === 'Escape') {
      close();
      onDismiss?.();
    }
  };

  scrim.addEventListener('click', () => {
    close();
    onDismiss?.();
  });
  document.addEventListener('keydown', onKey);

  return close;
}

// Bottom sheet menu. items: [{ label, icon, danger, checked, onSelect }]
export function bottomSheet({ title, items }) {
  const sheet = el('div', { class: 'sheet', role: 'menu' }, [el('div', { class: 'sheet-grip' })]);
  if (title) sheet.append(el('div', { class: 'sheet-title', text: title }));

  let close = () => {};
  for (const item of items) {
    if (!item) continue;
    const classes = ['sheet-item'];
    if (item.danger) classes.push('danger');
    if (item.checked) classes.push('checked');
    sheet.append(
      el('button', {
        class: classes.join(' '),
        type: 'button',
        role: 'menuitem',
        onclick: () => {
          close();
          setTimeout(() => item.onSelect?.(), 120);
        }
      }, [
        el('span', { class: 'sheet-icon', 'aria-hidden': 'true', text: item.icon || '' }),
        el('span', { dir: 'auto', text: item.label })
      ])
    );
  }

  close = mountOverlay(sheet, {});
  return close;
}

export function confirmDialog({ title, body, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let close = () => {};
    const dialog = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true' }, [
      el('h2', { text: title }),
      body ? el('p', { dir: 'auto', text: body }) : null,
      el('div', { class: 'dialog-actions' }, [
        el('button', {
          class: 'btn-text', type: 'button', text: 'Cancel',
          onclick: () => { close(); resolve(false); }
        }),
        el('button', {
          class: danger ? 'btn-text danger' : 'btn-text confirm', type: 'button', text: confirmLabel,
          onclick: () => { close(); resolve(true); }
        })
      ])
    ]);
    close = mountOverlay(dialog, { onDismiss: () => resolve(false) });
  });
}

export function promptDialog({ title, body, value = '', placeholder = '', confirmLabel = 'Save' }) {
  return new Promise((resolve) => {
    let close = () => {};
    const input = el('input', { type: 'text', dir: 'auto', value, placeholder, autocomplete: 'off' });

    const submit = () => {
      const text = input.value.trim();
      if (!text) return;
      close();
      resolve(text);
    };

    const dialog = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true' }, [
      el('h2', { text: title }),
      body ? el('p', { text: body }) : null,
      input,
      el('div', { class: 'dialog-actions' }, [
        el('button', {
          class: 'btn-text', type: 'button', text: 'Cancel',
          onclick: () => { close(); resolve(null); }
        }),
        el('button', { class: 'btn-text confirm', type: 'button', text: confirmLabel, onclick: submit })
      ])
    ]);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });

    close = mountOverlay(dialog, { onDismiss: () => resolve(null) });
    setTimeout(() => { input.focus(); input.select(); }, 60);
  });
}

let toastTimer = null;
export function toast(message) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const node = el('div', { class: 'toast', role: 'status', dir: 'auto', text: message });
  document.body.append(node);
  requestAnimationFrame(() => node.classList.add('open'));
  toastTimer = setTimeout(() => {
    node.classList.remove('open');
    setTimeout(() => node.remove(), 200);
  }, 2600);
}

// A one-shot message that survives a navigation, so an action confirmed on one
// screen can be reported on the screen it lands you.
const FLASH_KEY = 'journal.flash';

export function setFlash(message) {
  try { sessionStorage.setItem(FLASH_KEY, message); } catch { /* ignore */ }
}

export function consumeFlash() {
  try {
    const message = sessionStorage.getItem(FLASH_KEY);
    if (message) {
      sessionStorage.removeItem(FLASH_KEY);
      toast(message);
    }
  } catch { /* ignore */ }
}

export function showError(message) {
  const banner = el('div', { class: 'error-banner', text: message });
  document.querySelector('.screen')?.prepend(banner);
}

// Every page boots the same way: open the database, seed on first run, and ask
// for persistent storage. Failures surface as a banner instead of a blank screen.
export async function boot(run) {
  try {
    const { seedIfFirstRun, requestPersistence } = await import('./db.js');
    await seedIfFirstRun();
    requestPersistence();
    await run();
  } catch (err) {
    console.error(err);
    showError(err?.message || 'Something went wrong opening your journal.');
  }
}
