// Folders: live note counts, create, rename, delete (to the recycle bin).

import { getAllFolders, getAllNotes, createFolder, renameFolder, softDeleteFolder } from './db.js';
import { countNotesByFolder, pluralise } from './model.js';
import { boot, el, bottomSheet, confirmDialog, promptDialog, toast, consumeFlash } from './ui.js';

const gridEl = document.getElementById('folderGrid');

async function load() {
  const [folders, notes] = await Promise.all([getAllFolders(), getAllNotes()]);
  render(folders, countNotesByFolder(notes));
}

function render(folders, counts) {
  gridEl.replaceChildren();

  for (const folder of folders) {
    const count = counts.get(folder.id) || 0;
    gridEl.append(
      el('a', {
        class: 'folder-card',
        href: `./folder.html?id=${encodeURIComponent(folder.id)}`
      }, [
        el('button', {
          class: 'folder-menu-btn',
          type: 'button',
          'aria-label': `Options for ${folder.name}`,
          onclick: (e) => {
            e.preventDefault();
            e.stopPropagation();
            openFolderMenu(folder, count);
          },
          text: '⋮'
        }),
        el('span', { class: 'folder-icon', 'aria-hidden': 'true', text: '📁' }),
        el('span', { class: 'folder-name', dir: 'auto', text: folder.name }),
        el('span', { class: 'folder-count', text: pluralise(count, 'note') })
      ])
    );
  }

  gridEl.append(
    el('button', {
      class: 'folder-card new-folder',
      type: 'button',
      onclick: onCreateFolder
    }, [
      el('span', { class: 'folder-icon', 'aria-hidden': 'true', text: '＋' }),
      el('span', { class: 'folder-name', text: 'New folder' })
    ])
  );
}

async function onCreateFolder() {
  const name = await promptDialog({
    title: 'New folder',
    placeholder: 'Folder name',
    confirmLabel: 'Create'
  });
  if (!name) return;
  await createFolder(name);
  toast(`Created ${name}`);
  await load();
}

function openFolderMenu(folder, count) {
  bottomSheet({
    title: folder.name,
    items: [
      { icon: '✏️', label: 'Rename', onSelect: () => onRename(folder) },
      { icon: '🗑', label: 'Delete folder', danger: true, onSelect: () => onDelete(folder, count) }
    ]
  });
}

async function onRename(folder) {
  const name = await promptDialog({
    title: 'Rename folder',
    value: folder.name,
    confirmLabel: 'Rename'
  });
  if (!name || name === folder.name) return;
  await renameFolder(folder.id, name);
  toast('Folder renamed');
  await load();
}

async function onDelete(folder, count) {
  const ok = await confirmDialog({
    title: `Delete “${folder.name}”?`,
    body: count
      ? `The folder and its ${pluralise(count, 'note')} go to the recycle bin. You can restore them together from there.`
      : 'The folder goes to the recycle bin. You can restore it from there.',
    confirmLabel: 'Move to bin',
    danger: true
  });
  if (!ok) return;
  const moved = await softDeleteFolder(folder.id);
  toast(moved ? `Folder and ${pluralise(moved, 'note')} moved to bin` : 'Folder moved to bin');
  await load();
}

boot(async () => {
  await load();
  consumeFlash();
});

window.addEventListener('pageshow', (e) => { if (e.persisted) load(); });
