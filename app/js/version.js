// Identifies which copy of the app a device is actually running.

// Keep this in step with CACHE in sw.js on the rare occasions you bump it.
export const APP_VERSION = 'v1';

const CACHE = `journal-${APP_VERSION}`;
// Any always-deployed file works; the stylesheet is small and always current.
const PROBE = './css/app.css';

function readStamp(response) {
  if (!response) return null;
  const header = response.headers.get('Last-Modified') || response.headers.get('Date');
  if (!header) return null;
  const date = new Date(header);
  return Number.isNaN(date.getTime()) ? null : date;
}

// When the service worker is running, the stored copy is whatever the last
// successful network fetch returned — so its Last-Modified describes the files
// this device is really running, with no extra request and no network needed.
export async function getAppStamp() {
  try {
    if ('caches' in self) {
      const cache = await caches.open(CACHE);
      const stamp = readStamp(await cache.match(PROBE));
      if (stamp) return stamp;
    }
  } catch { /* fall through to the network */ }

  try {
    return readStamp(await fetch(PROBE, { cache: 'no-cache' }));
  } catch {
    return null;
  }
}

export async function getVersionLabel() {
  const stamp = await getAppStamp();
  if (!stamp) return `Journal ${APP_VERSION}`;
  const date = stamp.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  const time = stamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `Journal ${APP_VERSION} · updated ${date}, ${time}`;
}
