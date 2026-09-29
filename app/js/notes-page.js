// All Notes: real cards from storage, favourites pinned first, search and sort.

import { getAllNotes, createNote } from './db.js';
import { searchNotes, sortNotes, pluralise } from './model.js';
import { boot, renderNoteCard, renderEmptyState, bottomSheet, consumeFlash } from './ui.js';

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

async function openNewNote() {
  const note = await createNote(null);
  location.href = `./note.html?id=${encodeURIComponent(note.id)}`;
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
        { icon: '🗑', label: 'Recycle bin', onSelect: () => { location.href = './bin.html'; } }
      ]
    });
  });
}

boot(async () => {
  wireControls();
  await refresh();
  consumeFlash();
});

// Coming back via the back button should show writes made in the editor.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) refresh();
});
