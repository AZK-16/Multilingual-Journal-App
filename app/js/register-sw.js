// Registers the service worker that makes the app installable and offline-capable.
// The relative path keeps the scope correct under a GitHub Pages subpath.

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });

  // A new version taking over mid-session would leave the page running old
  // scripts against new cached assets, so reload once when control changes.
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}
