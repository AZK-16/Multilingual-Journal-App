// All Notes: real cards from storage, favourites pinned first, search and sort.

import { getAllNotes, exportAll, importAll, validateBackup } from './db.js';
import { searchNotes, sortNotes, pluralise } from './model.js';
import {
  boot, renderNoteCard, renderEmptyState, bottomSheet, consumeFlash,
  confirmDialog, toast, showError
} from './ui.js';

const SORT_KEY = 'journal.sortOrder';

const grid = document.getElementById('noteGrid');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const sortBtn = document.getElementById('sortBtn');
const resultCount = document.getElementById('resultCount');
const overflowBtn = document.getElementById('overflowBtn');

let allNotes = [];
let order = localStorage.getItem(SORT_KEY) === 'oldest' ? 'oldest' : 'newest';
let query = '';

function syncSortButton() {
  sortBtn.textContent = order === 'newest' ? 'Newest first ↓' : 'Oldest first ↑';
}

// The editor creates the record itself, so it knows the note is new and can
// discard it again if it is left without a word in it.
function openNewNote() {
  location.href = './note.html';
}

function render() {
  const matched = searchNotes(allNotes, query);
  const sorted = sortNotes(matched, { order, pinFavourites: true });

  grid.replaceChildren();

  if (!allNotes.length) {
    resultCount.textContent = '';
    grid.append(renderEmptyState({
      mark: '📓',
      title: 'Your journal is empty',
      body: 'Write in whatever language feels right — English, العربية, français, español, or all of them in the same sentence.',
      actionLabel: '+ New Note',
      onAction: openNewNote,
      extra: 'EN · العربية · FR · ES'
    }));
    return;
  }

  if (!sorted.length) {
    resultCount.textContent = '';
    grid.append(renderEmptyState({
      title: 'No matches',
      body: `Nothing in your notes matches “${query}”.`
    }));
    return;
  }

  resultCount.textContent = query
    ? `${pluralise(sorted.length, 'match', 'matches')}`
    : pluralise(sorted.length, 'note');

  const fragment = document.createDocumentFragment();
  for (const note of sorted) fragment.append(renderNoteCard(note));
  grid.append(fragment);
}

async function refresh() {
  allNotes = await getAllNotes();
  render();
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
      items: [
        { icon: '🗑', label: 'Recycle bin', onSelect: () => { location.href = './bin.html'; } },
        { icon: '⬇', label: 'Export all notes', onSelect: onExport },
        { icon: '⬆', label: 'Import from backup', onSelect: () => fileInput.click() }
      ]
    });
  });
}

/* ---- backup ---------------------------------------------------------------- */

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'application/json,.json';
fileInput.className = 'hidden';
document.body.append(fileInput);

async function onExport() {
  try {
    const payload = await exportAll();
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `journal-backup-${stamp}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`Exported ${pluralise(payload.notes.length, 'note')}`);
  } catch (err) {
    console.error(err);
    showError('Could not build the backup file.');
  }
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());
    const counts = validateBackup(payload);
    const ok = await confirmDialog({
      title: 'Import this backup?',
      body: `It holds ${pluralise(counts.notes, 'note')} and ${pluralise(counts.folders, 'folder')}. Existing items are only replaced when the backup has a newer version of them.`,
      confirmLabel: 'Import'
    });
    if (!ok) return;

    const stats = await importAll(payload);
    await refresh();
    const added = stats.notesAdded + stats.foldersAdded;
    const updated = stats.notesUpdated + stats.foldersUpdated;
    toast(`Imported: ${added} added, ${updated} updated`);
  } catch (err) {
    console.error(err);
    showError(err?.message || 'That file could not be imported.');
  }
});

boot(async () => {
  wireControls();
  await refresh();
  consumeFlash();
});

// Coming back via the back button should show writes made in the editor.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) refresh();
});
