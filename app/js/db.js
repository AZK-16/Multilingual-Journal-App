// IndexedDB layer. Every read and write to the journal goes through here.

const DB_NAME = 'journal';
const DB_VERSION = 1;
export const SCHEMA_VERSION = 1;

const SEED_FOLDERS = ['يوميات', 'Notes de voyage', 'Notas de trabajo'];

let dbPromise = null;

export function uid() {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function newBlock(text = '') {
  return { id: uid(), text, highlights: [] };
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis) || !indexedDB) {
      reject(new Error('This browser has no IndexedDB, so notes cannot be saved.'));
      return;
    }
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('notes')) {
        const notes = db.createObjectStore('notes', { keyPath: 'id' });
        notes.createIndex('by_updatedAt', 'updatedAt');
        notes.createIndex('by_folderId', 'folderId');
      }
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('The journal is open in another tab. Close it and reload.'));
  });
  return dbPromise;
}

async function readAll(storeName) {
  const db = await openDB();
  return promisify(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
}

async function readOne(storeName, key) {
  const db = await openDB();
  return promisify(db.transaction(storeName, 'readonly').objectStore(storeName).get(key));
}

async function writeOne(storeName, value) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(value);
  await txDone(tx);
  return value;
}

/* ---- storage durability --------------------------------------------------- */

// Ask the browser to keep this data through storage pressure. Never blocks the app.
export async function requestPersistence() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/* ---- notes ---------------------------------------------------------------- */

function blankNote(folderId = null) {
  const now = Date.now();
  return {
    id: uid(),
    title: '',
    blocks: [newBlock('')],
    folderId: folderId ?? null,
    favourite: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedWithFolder: null,
    comments: [],
    schemaVersion: SCHEMA_VERSION
  };
}

export async function createNote(folderId = null) {
  return writeOne('notes', blankNote(folderId));
}

export async function getNote(id) {
  return readOne('notes', id);
}

export async function getAllNotes({ includeDeleted = false } = {}) {
  const notes = await readAll('notes');
  return includeDeleted ? notes : notes.filter((n) => !n.deletedAt);
}

export async function getNotesInFolder(folderId) {
  const notes = await getAllNotes();
  return notes.filter((n) => n.folderId === folderId);
}

export async function saveNote(note) {
  return writeOne('notes', note);
}

async function mutateNote(id, mutate) {
  const db = await openDB();
  const tx = db.transaction('notes', 'readwrite');
  const store = tx.objectStore('notes');
  const note = await promisify(store.get(id));
  if (!note) {
    tx.abort();
    throw new Error('Note not found');
  }
  const next = mutate(note) || note;
  store.put(next);
  await txDone(tx);
  return next;
}

// Content edits are the only thing that bumps updatedAt, so sorting by "newest"
// reflects when the user last wrote, not when a note was filed or restored.
export async function updateNoteContent(id, { title, blocks }) {
  return mutateNote(id, (note) => {
    note.title = title;
    note.blocks = blocks;
    note.updatedAt = Date.now();
    return note;
  });
}

export async function toggleFavourite(id) {
  const note = await mutateNote(id, (n) => {
    n.favourite = !n.favourite;
    return n;
  });
  return note.favourite;
}

export async function setNoteFolder(id, folderId) {
  return mutateNote(id, (note) => {
    note.folderId = folderId ?? null;
    return note;
  });
}

export async function softDeleteNote(id) {
  return mutateNote(id, (note) => {
    note.deletedAt = Date.now();
    note.deletedWithFolder = null;
    return note;
  });
}

export async function restoreNote(id) {
  const folders = await getAllFolders({ includeDeleted: true });
  const live = new Set(folders.filter((f) => !f.deletedAt).map((f) => f.id));
  return mutateNote(id, (note) => {
    note.deletedAt = null;
    note.deletedWithFolder = null;
    // Don't restore a note into a folder that is itself still in the bin.
    if (note.folderId && !live.has(note.folderId)) note.folderId = null;
    return note;
  });
}

export async function purgeNote(id) {
  const db = await openDB();
  const tx = db.transaction('notes', 'readwrite');
  tx.objectStore('notes').delete(id);
  await txDone(tx);
}

/* ---- folders -------------------------------------------------------------- */

export async function getAllFolders({ includeDeleted = false } = {}) {
  const folders = await readAll('folders');
  const list = includeDeleted ? folders : folders.filter((f) => !f.deletedAt);
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getFolder(id) {
  return readOne('folders', id);
}

export async function createFolder(name) {
  const now = Date.now();
  return writeOne('folders', {
    id: uid(),
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    schemaVersion: SCHEMA_VERSION
  });
}

export async function renameFolder(id, name) {
  const db = await openDB();
  const tx = db.transaction('folders', 'readwrite');
  const store = tx.objectStore('folders');
  const folder = await promisify(store.get(id));
  if (!folder) {
    tx.abort();
    throw new Error('Folder not found');
  }
  folder.name = name.trim();
  folder.updatedAt = Date.now();
  store.put(folder);
  await txDone(tx);
  return folder;
}

// Deleting a folder takes its notes down with it, both marked in one transaction
// so the bin can restore them together later.
export async function softDeleteFolder(id) {
  const db = await openDB();
  const tx = db.transaction(['folders', 'notes'], 'readwrite');
  const folders = tx.objectStore('folders');
  const notes = tx.objectStore('notes');
  const now = Date.now();

  const folder = await promisify(folders.get(id));
  if (!folder) {
    tx.abort();
    throw new Error('Folder not found');
  }
  folder.deletedAt = now;
  folders.put(folder);

  const all = await promisify(notes.getAll());
  let moved = 0;
  for (const note of all) {
    if (note.folderId === id && !note.deletedAt) {
      note.deletedAt = now;
      note.deletedWithFolder = id;
      notes.put(note);
      moved += 1;
    }
  }
  await txDone(tx);
  return moved;
}

export async function restoreFolder(id) {
  const db = await openDB();
  const tx = db.transaction(['folders', 'notes'], 'readwrite');
  const folders = tx.objectStore('folders');
  const notes = tx.objectStore('notes');

  const folder = await promisify(folders.get(id));
  if (!folder) {
    tx.abort();
    throw new Error('Folder not found');
  }
  folder.deletedAt = null;
  folders.put(folder);

  const all = await promisify(notes.getAll());
  for (const note of all) {
    if (note.deletedWithFolder === id) {
      note.deletedAt = null;
      note.deletedWithFolder = null;
      notes.put(note);
    }
  }
  await txDone(tx);
  return folder;
}

export async function purgeFolder(id) {
  const db = await openDB();
  const tx = db.transaction(['folders', 'notes'], 'readwrite');
  const folders = tx.objectStore('folders');
  const notes = tx.objectStore('notes');

  folders.delete(id);
  const all = await promisify(notes.getAll());
  let removed = 0;
  for (const note of all) {
    if (note.folderId === id) {
      notes.delete(note.id);
      removed += 1;
    }
  }
  await txDone(tx);
  return removed;
}

export async function emptyBin() {
  const db = await openDB();
  const tx = db.transaction(['folders', 'notes'], 'readwrite');
  const folders = tx.objectStore('folders');
  const notes = tx.objectStore('notes');

  const deletedFolders = (await promisify(folders.getAll())).filter((f) => f.deletedAt);
  const deletedFolderIds = new Set(deletedFolders.map((f) => f.id));
  for (const folder of deletedFolders) folders.delete(folder.id);

  const all = await promisify(notes.getAll());
  for (const note of all) {
    if (note.deletedAt || (note.folderId && deletedFolderIds.has(note.folderId))) {
      notes.delete(note.id);
    }
  }
  await txDone(tx);
}

/* ---- first run ------------------------------------------------------------ */

export async function seedIfFirstRun() {
  const seeded = await readOne('meta', 'seeded');
  if (seeded) return false;
  for (const name of SEED_FOLDERS) await createFolder(name);
  await writeOne('meta', { key: 'seeded', value: true, at: Date.now() });
  return true;
}

/* ---- backup --------------------------------------------------------------- */

export async function exportAll() {
  const [notes, folders] = await Promise.all([
    getAllNotes({ includeDeleted: true }),
    getAllFolders({ includeDeleted: true })
  ]);
  return {
    app: 'multilingual-journal',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    folders,
    notes
  };
}

export function validateBackup(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('That file is not a journal backup.');
  if (payload.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`That backup is version ${payload.schemaVersion ?? '?'}, but this app reads version ${SCHEMA_VERSION}.`);
  }
  if (!Array.isArray(payload.notes) || !Array.isArray(payload.folders)) {
    throw new Error('That backup is missing its notes or folders.');
  }
  for (const note of payload.notes) {
    if (!note || typeof note.id !== 'string' || !Array.isArray(note.blocks)) {
      throw new Error('That backup contains a note in an unexpected shape.');
    }
  }
  for (const folder of payload.folders) {
    if (!folder || typeof folder.id !== 'string' || typeof folder.name !== 'string') {
      throw new Error('That backup contains a folder in an unexpected shape.');
    }
  }
  return { notes: payload.notes.length, folders: payload.folders.length };
}

// Merges by id: an incoming record only overwrites an existing one when it is
// newer, so importing an old backup can never roll back newer work.
export async function importAll(payload) {
  validateBackup(payload);
  const db = await openDB();
  const tx = db.transaction(['folders', 'notes'], 'readwrite');
  const folders = tx.objectStore('folders');
  const notes = tx.objectStore('notes');
  const stats = { notesAdded: 0, notesUpdated: 0, foldersAdded: 0, foldersUpdated: 0, skipped: 0 };

  for (const folder of payload.folders) {
    const existing = await promisify(folders.get(folder.id));
    if (!existing) {
      folders.put(folder);
      stats.foldersAdded += 1;
    } else if ((folder.updatedAt || 0) > (existing.updatedAt || 0)) {
      folders.put(folder);
      stats.foldersUpdated += 1;
    } else {
      stats.skipped += 1;
    }
  }

  for (const note of payload.notes) {
    const existing = await promisify(notes.get(note.id));
    if (!existing) {
      notes.put(note);
      stats.notesAdded += 1;
    } else if ((note.updatedAt || 0) > (existing.updatedAt || 0)) {
      notes.put(note);
      stats.notesUpdated += 1;
    } else {
      stats.skipped += 1;
    }
  }

  await txDone(tx);
  return stats;
}
