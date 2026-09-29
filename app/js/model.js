// Pure helpers: no DOM, no database. Search, sort, preview and date formatting.

export function noteText(note) {
  return (note.blocks || []).map((b) => b.text).join('\n');
}

export function noteDisplayTitle(note) {
  const title = (note.title || '').trim();
  return title || 'Untitled';
}

export function isUntitled(note) {
  return !(note.title || '').trim();
}

export function notePreview(note, max = 320) {
  const text = noteText(note).replace(/\n{3,}/g, '\n\n').trim();
  return text.length > max ? text.slice(0, max) : text;
}

// Lowercase and strip combining marks, so a search for "reunion" matches
// "reunión" and Arabic text matches with or without tashkeel.
function normalise(str) {
  return str.normalize('NFD').replace(/[̀-ًͯ-ْ]/g, '').toLowerCase();
}

export function searchNotes(notes, query) {
  const q = normalise(query.trim());
  if (!q) return notes;
  return notes.filter((note) => normalise(note.title + '\n' + noteText(note)).includes(q));
}

export function sortNotes(notes, { order = 'newest', pinFavourites = true } = {}) {
  const direction = order === 'oldest' ? 1 : -1;
  return [...notes].sort((a, b) => {
    if (pinFavourites && a.favourite !== b.favourite) return a.favourite ? -1 : 1;
    return (a.updatedAt - b.updatedAt) * direction;
  });
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

// Time if it was written today, otherwise the date — the convention the
// wireframes settled on.
export function formatStamp(ts) {
  const date = new Date(ts);
  const now = new Date();
  if (sameDay(date, now)) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const opts = { month: 'short', day: 'numeric' };
  if (date.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return date.toLocaleDateString([], opts);
}

export function formatFullStamp(ts) {
  const date = new Date(ts);
  const datePart = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

export function countNotesByFolder(notes) {
  const counts = new Map();
  for (const note of notes) {
    if (!note.folderId) continue;
    counts.set(note.folderId, (counts.get(note.folderId) || 0) + 1);
  }
  return counts;
}

export function pluralise(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
