// Note editor: contenteditable body, autosave, favourite, move to folder, bin.

import {
  getNote, createNote, updateNoteContent, toggleFavourite,
  setNoteFolder, softDeleteNote, getAllFolders, getFolder, purgeNote, uid
} from './db.js';
import { formatFullStamp, noteText } from './model.js';
import { boot, bottomSheet, confirmDialog, toast, setFlash, showError } from './ui.js';

const titleInput = document.getElementById('editorTitle');
const bodyEl = document.getElementById('editorBody');
const metaEl = document.getElementById('editorMeta');
const favBtn = document.getElementById('favBtn');
const overflowBtn = document.getElementById('overflowBtn');
const saveState = document.getElementById('saveState');

let note = null;
let createdHere = false;
let dirty = false;
let saveTimer = null;
let writeChain = Promise.resolve();

/* ---- rendering ------------------------------------------------------------- */

function blockElement(block) {
  const p = document.createElement('p');
  p.dir = 'auto';
  p.dataset.blockId = block.id;
  if (block.text) p.textContent = block.text;
  else p.append(document.createElement('br'));
  return p;
}

function renderBody() {
  const blocks = note.blocks?.length ? note.blocks : [{ id: uid(), text: '', highlights: [] }];
  bodyEl.replaceChildren(...blocks.map(blockElement));
  syncPlaceholder();
}

function syncPlaceholder() {
  const empty = !bodyEl.textContent.trim();
  bodyEl.dataset.empty = empty ? 'true' : 'false';
}

function renderMeta() {
  const parts = [formatFullStamp(note.updatedAt)];
  parts.push(note.folderName || 'No folder');
  metaEl.textContent = parts.join(' · ');
  metaEl.dir = 'auto';
}

function renderFavourite() {
  favBtn.textContent = note.favourite ? '★' : '☆';
  favBtn.classList.toggle('is-fav', !!note.favourite);
  favBtn.setAttribute('aria-pressed', note.favourite ? 'true' : 'false');
}

/* ---- serialisation --------------------------------------------------------- */

// Block ids live on the elements as data-block-id and are read back off them —
// never matched by position — so ids survive paragraphs being inserted or
// removed above them, keeping future highlight anchors attached to their text.
// A paragraph with no id is newly typed or pasted; a paragraph repeating an id
// already seen in this pass is the second half of an Enter-split (the browser
// copies the attribute), so the copy gets a fresh id and the original keeps its.
function serialiseBlocks() {
  const previous = new Map((note.blocks || []).map((b) => [b.id, b]));
  const seen = new Set();
  const blocks = [];

  const pushBlock = (text, element) => {
    let id = element?.dataset?.blockId;
    if (!id || seen.has(id)) {
      id = uid();
      if (element) element.dataset.blockId = id;
    }
    seen.add(id);
    const prior = previous.get(id);
    blocks.push({
      id,
      text,
      // Highlights aren't written yet; carry any existing ones through untouched.
      highlights: prior?.highlights ? prior.highlights : []
    });
  };

  for (const child of Array.from(bodyEl.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      if (child.tagName === 'BR') continue;
      pushBlock(child.textContent.replace(/ /g, ' '), child);
    } else if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent.replace(/ /g, ' ');
      if (text.trim()) pushBlock(text, null);
    }
  }

  if (!blocks.length) blocks.push({ id: uid(), text: '', highlights: [] });
  return blocks;
}

// Attribute-only repairs, safe to run while typing because they never replace
// nodes and so never move the caret.
function tidyParagraphs() {
  for (const child of bodyEl.children) {
    if (!child.dataset.blockId) child.dataset.blockId = uid();
    if (child.getAttribute('dir') !== 'auto') child.setAttribute('dir', 'auto');
  }
}

/* ---- saving ---------------------------------------------------------------- */

function setSaveState(text) {
  saveState.textContent = text;
}

function scheduleSave() {
  dirty = true;
  setSaveState('Saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { flush(); }, 400);
}

function flush() {
  if (!dirty || !note) return writeChain;
  clearTimeout(saveTimer);
  dirty = false;

  const title = titleInput.value;
  const blocks = serialiseBlocks();

  // Writes are chained so a slow save can never land after a newer one.
  writeChain = writeChain
    .then(() => updateNoteContent(note.id, { title, blocks }))
    .then((saved) => {
      const folderName = note.folderName;
      note = saved;
      note.folderName = folderName;
      renderMeta();
      setSaveState('Saved');
      setTimeout(() => { if (!dirty) setSaveState(''); }, 1200);
    })
    .catch((err) => {
      console.error(err);
      setSaveState('Not saved');
      showError('Your last change could not be saved.');
    });

  return writeChain;
}

function isEmptyNote() {
  return !titleInput.value.trim() && !noteText({ blocks: serialiseBlocks() }).trim();
}

// A note created by tapping + and then abandoned without a word in it is
// discarded rather than left as an empty card in the grid.
async function flushAndTidy() {
  await flush();
  await writeChain;
  if (createdHere && isEmptyNote()) {
    await purgeNote(note.id);
    createdHere = false;
  }
}

/* ---- actions --------------------------------------------------------------- */

async function onToggleFavourite() {
  await flush();
  note.favourite = await toggleFavourite(note.id);
  renderFavourite();
  toast(note.favourite ? 'Added to favourites' : 'Removed from favourites');
}

async function onMoveToFolder() {
  await flush();
  const folders = await getAllFolders();
  bottomSheet({
    title: 'Move to folder',
    items: [
      {
        icon: note.folderId ? '' : '✓',
        label: 'No folder',
        checked: !note.folderId,
        onSelect: () => applyFolder(null, null)
      },
      ...folders.map((folder) => ({
        icon: folder.id === note.folderId ? '✓' : '📁',
        label: folder.name,
        checked: folder.id === note.folderId,
        onSelect: () => applyFolder(folder.id, folder.name)
      }))
    ]
  });
}

async function applyFolder(folderId, folderName) {
  await setNoteFolder(note.id, folderId);
  note.folderId = folderId;
  note.folderName = folderName;
  renderMeta();
  toast(folderName ? `Moved to ${folderName}` : 'Removed from folder');
}

async function onDelete() {
  await flush();
  const ok = await confirmDialog({
    title: 'Move this note to the bin?',
    body: 'You can restore it from the recycle bin later.',
    confirmLabel: 'Move to bin',
    danger: true
  });
  if (!ok) return;
  await softDeleteNote(note.id);
  createdHere = false;
  dirty = false;
  setFlash('Note moved to bin');
  location.href = './index.html';
}

function openOverflow() {
  bottomSheet({
    items: [
      { icon: '📁', label: 'Move to folder', onSelect: onMoveToFolder },
      { icon: '🗑', label: 'Move to bin', danger: true, onSelect: onDelete }
    ]
  });
}

/* ---- boot ------------------------------------------------------------------ */

boot(async () => {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const folderId = params.get('folder');

  if (id) {
    note = await getNote(id);
    if (!note || note.deletedAt) {
      showError('That note is no longer here. It may have been moved to the bin.');
      return;
    }
  } else {
    note = await createNote(folderId || null);
    createdHere = true;
    history.replaceState(null, '', `./note.html?id=${encodeURIComponent(note.id)}`);
  }

  if (note.folderId) {
    const folder = await getFolder(note.folderId);
    note.folderName = folder && !folder.deletedAt ? folder.name : null;
  }

  titleInput.value = note.title || '';
  renderBody();
  renderMeta();
  renderFavourite();

  // Ask browsers for <p> on Enter rather than <div>, so the DOM matches the
  // paragraph-per-block data model. Serialisation tolerates either.
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* not supported */ }

  titleInput.addEventListener('input', scheduleSave);
  bodyEl.addEventListener('input', () => {
    tidyParagraphs();
    syncPlaceholder();
    scheduleSave();
  });

  // Paste arrives as plain text: the stored model holds text, not markup.
  bodyEl.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });

  favBtn.addEventListener('click', onToggleFavourite);
  overflowBtn.addEventListener('click', openOverflow);

  if (createdHere) setTimeout(() => bodyEl.focus(), 80);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', () => { flush(); });
  document.getElementById('backBtn').addEventListener('click', (e) => {
    e.preventDefault();
    flushAndTidy().finally(() => { location.href = './index.html'; });
  });
});
