// Folder contents: the same card grid as All Notes, scoped to one folder.

import {
  getFolder, getNotesInFolder, renameFolder, softDeleteFolder
} from './db.js';
import { searchNotes, sortNotes, pluralise } from './model.js';
import {
  boot, renderNoteCard, renderEmptyState, bottomSheet, confirmDialog,
  promptDialog, toast, setFlash, showError, consumeFlash
} from './ui.js';

const SORT_KEY = 'journal.sortOrder';

const grid = document.getElementById('noteGrid');
const nameEl = document.getElementById('folderName');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const sortBtn = document.getElementById('sortBtn');
const resultCount = document.getElementById('resultCount');
const overflowBtn = document.getElementById('overflowBtn');
const newNoteBtn = document.getElementById('newNoteBtn');

let folder = null;
let notes = [];
let order = localStorage.getItem(SORT_KEY) === 'oldest' ? 'oldest' : 'newest';
let query = '';

function syncSortButton() {
  sortBtn.textContent = order === 'newest' ? 'Newest first ↓' : 'Oldest first ↑';
}

function render() {
  const matched = searchNotes(notes, query);
  const sorted = sortNotes(matched, { order, pinFavourites: true });

  grid.replaceChildren();

  if (!notes.length) {
    resultCount.textContent = '';
    grid.append(renderEmptyState({
      mark: '📁',
      title: 'Nothing in here yet',
      body: `Notes you move into ${folder.name} will show up here.`,
      actionLabel: '+ New Note',
      onAction: newNote
    }));
    return;
  }

  if (!sorted.length) {
    resultCount.textContent = '';
    grid.append(renderEmptyState({
      title: 'No matches',
      body: `Nothing in this folder matches “${query}”.`
    }));
    return;
  }

  resultCount.textContent = query
    ? pluralise(sorted.length, 'match', 'matches')
    : pluralise(sorted.length, 'note');

  const fragment = document.createDocumentFragment();
  for (const note of sorted) fragment.append(renderNoteCard(note));
  grid.append(fragment);
}

async function refresh() {
  notes = await getNotesInFolder(folder.id);
  render();
}

// The editor creates the record itself, filed into this folder, so it can
// discard the note again if it is left empty.
function newNote() {
  location.href = `./note.html?folder=${encodeURIComponent(folder.id)}`;
}

async function onRename() {
  const name = await promptDialog({
    title: 'Rename folder',
    value: folder.name,
    confirmLabel: 'Rename'
  });
  if (!name || name === folder.name) return;
  folder = await renameFolder(folder.id, name);
  nameEl.textContent = folder.name;
  document.title = `${folder.name} — Journal`;
  render();
  toast('Folder renamed');
}

async function onDelete() {
  const ok = await confirmDialog({
    title: `Delete “${folder.name}”?`,
    body: notes.length
      ? `The folder and its ${pluralise(notes.length, 'note')} go to the recycle bin. You can restore them together from there.`
      : 'The folder goes to the recycle bin. You can restore it from there.',
    confirmLabel: 'Move to bin',
    danger: true
  });
  if (!ok) return;
  const moved = await softDeleteFolder(folder.id);
  setFlash(moved ? `Folder and ${pluralise(moved, 'note')} moved to bin` : 'Folder moved to bin');
  location.href = './folders.html';
}

function wireControls() {
  syncSortButton();

  let debounce;
  searchInput.addEventListener('input', () => {
    query = searchInput.value;
    searchClear.classList.toggle('hidden', !query);
    clearTimeout(debounce);
    debounce = setTimeout(render, 140);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    query = '';
    searchClear.classList.add('hidden');
    render();
    searchInput.focus();
  });

  sortBtn.addEventListener('click', () => {
    order = order === 'newest' ? 'oldest' : 'newest';
    localStorage.setItem(SORT_KEY, order);
    syncSortButton();
    render();
  });

  overflowBtn.addEventListener('click', () => {
    bottomSheet({
      title: folder.name,
      items: [
        { icon: '✏️', label: 'Rename folder', onSelect: onRename },
        { icon: '🗑', label: 'Delete folder', danger: true, onSelect: onDelete }
      ]
    });
  });

  newNoteBtn.addEventListener('click', newNote);
}

boot(async () => {
  const id = new URLSearchParams(location.search).get('id');
  folder = id ? await getFolder(id) : null;

  if (!folder || folder.deletedAt) {
    showError('That folder is no longer here. It may have been moved to the bin.');
    return;
  }

  nameEl.textContent = folder.name;
  document.title = `${folder.name} — Journal`;
  wireControls();
  await refresh();
  consumeFlash();
});

window.addEventListener('pageshow', (e) => { if (e.persisted && folder) refresh(); });
