// Wireframes V1 — vanilla JS only. Purely presentational: no storage, no logic.

// Folder Contents screen: which folder's row-set + heading to show,
// picked from the ?folder= query param set by the Folders screen links.
function initFolderContents() {
  var panels = document.querySelectorAll('[data-folder-panel]');
  if (!panels.length) return;

  var params = new URLSearchParams(window.location.search);
  var folder = params.get('folder') || 'arabic';

  panels.forEach(function (panel) {
    panel.classList.toggle('active', panel.getAttribute('data-folder-panel') === folder);
  });
}

// Note Editor screen: show the blank-note placeholder when opened via
// "+ New Note" (?mode=new), otherwise show the filled-in demo note.
function initEditorMode() {
  var panels = document.querySelectorAll('[data-editor-panel]');
  if (!panels.length) return;

  var params = new URLSearchParams(window.location.search);
  var mode = params.get('mode') === 'new' ? 'new' : 'existing';

  panels.forEach(function (panel) {
    panel.classList.toggle('active', panel.getAttribute('data-editor-panel') === mode);
  });
}

// View Modes screen: toggle between the three annotation-rendering panels.
function initViewModeTabs() {
  var tabs = document.querySelectorAll('[data-viewmode-tab]');
  if (!tabs.length) return;

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var mode = tab.getAttribute('data-viewmode-tab');

      tabs.forEach(function (t) {
        t.classList.toggle('active', t === tab);
      });

      document.querySelectorAll('[data-viewmode-panel]').forEach(function (panel) {
        panel.classList.toggle('active', panel.getAttribute('data-viewmode-panel') === mode);
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  initFolderContents();
  initEditorMode();
  initViewModeTabs();
});
