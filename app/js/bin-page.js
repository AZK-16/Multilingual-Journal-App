// Recycle bin: restore or permanently delete folders and notes.

import {
  getAllNotes, getAllFolders, restoreNote, restoreFolder,
  purgeNote, purgeFolder, emptyBin
} from './db.js';
import { noteDisplayTitle, isUntitled, formatStamp, pluralise, notePreview } from './model.js';
import { boot, el, confirmDialog, toast, renderEmptyState } from './ui.js';

const listEl = document.getElementById('binList');
const emptyBtn = document.getElementById('emptyBinBtn');

async function load() {
  const [notes, folders] = await Promise.all([
    getAllNotes({ includeDeleted: true }),
    getAllFolders({ includeDeleted: true })
  ]);

  const deletedFolders = folders.filter((f) => f.deletedAt);
  const deletedFolderIds = new Set(deletedFolders.map((f) => f.id));
  const deletedNotes = notes.filter((n) => n.deletedAt);
  // Notes that went down with a folder are restored via that folder, so they
  // are listed under it rather than as loose items.
  const looseNotes = deletedNotes.filter((n) => !n.deletedWithFolder || !deletedFolderIds.has(n.deletedWithFolder));

  render(deletedFolders, looseNotes, deletedNotes);
}

function render(folders, looseNotes, allDeletedNotes) {
  listEl.replaceChildren();
  emptyBtn.classList.toggle('hidden', !folders.length && !allDeletedNotes.length);

  if (!folders.length && !allDeletedNotes.length) {
    listEl.append(renderEmptyState({
      mark: '🗑',
      title: 'The bin is empty',
      body: 'Notes and folders you delete land here until you remove them for good.'
    }));
    return;
  }

  if (folders.length) {
    listEl.append(el('div', { class: 'bin-section-title', text: 'Folders' }));
    for (const folder of folders) {
      const count = allDeletedNotes.filter((n) => n.deletedWithFolder === folder.id).length;
      listEl.append(binRow({
        title: folder.name,
        untitled: false,
        meta: `${count ? pluralise(count, 'note') + ' · ' : ''}Deleted ${formatStamp(folder.deletedAt)}`,
        onRestore: async () => {
          await restoreFolder(folder.id);
          toast(count ? `Restored ${folder.name} and its notes` : `Restored ${folder.name}`);
          load();
        },
        onPurge: async () => {
          const ok = await confirmDialog({
            title: `Permanently delete “${folder.name}”?`,
            body: count
              ? `This removes the folder and its ${pluralise(count, 'note')} for good. This cannot be undone.`
              : 'This removes the folder for good. This cannot be undone.',
            confirmLabel: 'Delete for good',
            danger: true
          });
          if (!ok) return;
          await purgeFolder(folder.id);
          toast('Deleted permanently');
          load();
        }
      }));
    }
  }

  if (looseNotes.length) {
    listEl.append(el('div', { class: 'bin-section-title', text: 'Notes' }));
    for (const note of looseNotes) {
      listEl.append(binRow({
        title: noteDisplayTitle(note),
        untitled: isUntitled(note),
        meta: notePreview(note, 60).split('\n')[0] || `Deleted ${formatStamp(note.deletedAt)}`,
        onRestore: async () => {
          await restoreNote(note.id);
          toast('Note restored');
          load();
        },
        onPurge: async () => {
          const ok = await confirmDialog({
            title: `Permanently delete “${noteDisplayTitle(note)}”?`,
            body: 'This removes the note for good. This cannot be undone.',
            confirmLabel: 'Delete for good',
            danger: true
          });
          if (!ok) return;
          await purgeNote(note.id);
          toast('Deleted permanently');
          load();
        }
      }));
    }
  }
}

function binRow({ title, untitled, meta, onRestore, onPurge }) {
  return el('div', { class: 'bin-row' }, [
    el('div', { class: 'bin-row-main' }, [
      el('div', { class: untitled ? 'bin-row-title untitled' : 'bin-row-title', dir: 'auto', text: title }),
      el('div', { class: 'bin-row-meta', dir: 'auto', text: meta })
    ]),
    el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Restore ${title}`, onclick: onRestore, text: '↩' }),
    el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Permanently delete ${title}`, onclick: onPurge, text: '✕' })
  ]);
}

boot(async () => {
  emptyBtn.addEventListener('click', async () => {
    const [notes, folders] = await Promise.all([
      getAllNotes({ includeDeleted: true }),
      getAllFolders({ includeDeleted: true })
    ]);
    const noteCount = notes.filter((n) => n.deletedAt).length;
    const folderCount = folders.filter((f) => f.deletedAt).length;
    if (!noteCount && !folderCount) return;

    const parts = [];
    if (folderCount) parts.push(pluralise(folderCount, 'folder'));
    if (noteCount) parts.push(pluralise(noteCount, 'note'));

    const ok = await confirmDialog({
      title: 'Empty the recycle bin?',
      body: `This permanently deletes ${parts.join(' and ')}. This cannot be undone.`,
      confirmLabel: 'Delete all',
      danger: true
    });
    if (!ok) return;
    await emptyBin();
    toast('Recycle bin emptied');
    load();
  });

  await load();
});
