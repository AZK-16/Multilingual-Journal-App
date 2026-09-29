# Multilingual Journal App

A journalling app for writing in more than one language at once — English, العربية, français, español, and any mix of them in the same sentence.

| Folder | What it is |
| --- | --- |
| `app/` | The real, working app. Plain HTML, CSS and vanilla JavaScript — no frameworks, no build step. Notes are stored in IndexedDB on the device, and it installs to a phone home screen as a PWA. |
| `Wireframes V1/` | The original static clickable wireframes, kept as a design reference. No data, no logic. |

## What the app does

- **All Notes** — notes as cards, favourites pinned first, search across titles and body text, newest/oldest sort.
- **Folders** — create, rename and delete folders, with note counts computed live.
- **Note editor** — title and body, autosaving as you type, favourite toggle, move to folder, delete.
- **Recycle bin** — deleting a note or folder is reversible; the bin is the only place anything is destroyed for good. Deleting a folder takes its notes with it, and restoring the folder brings them back together.
- **Backup** — export every note and folder to a JSON file, and import one back. In the ⋮ menu on All Notes.
- **Offline** — everything works with no connection, and the app asks the browser to keep your journal through storage pressure.

Writing direction is detected per paragraph (`dir="auto"`), so an Arabic paragraph flips right-to-left on its own while English paragraphs in the same note stay left-to-right. No spellcheck language is forced on the editor.

Highlighting, comments and the three annotation view modes in `Wireframes V1/06-*` and `07-*` are **not built yet**. The stored note format already reserves room for them: each paragraph is a block with its own id and a `highlights` array, so annotations can be added later without changing how existing notes are stored.

## Running it locally

A plain `file://` open will not work — IndexedDB and service workers need a real origin. From the repository root:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/app/>.

## Putting it on GitHub Pages

1. **Push the repo to GitHub** (this repo is already at `AZK-16/Multilingual-Journal-App`):
   ```bash
   git push origin main
   ```
2. On GitHub, open the repository and go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Set the branch to **main** and the folder to **/ (root)**, then press **Save**.
5. Wait a minute or two for the green "Your site is live" message. Your app will be at:

   ```
   https://azk-16.github.io/Multilingual-Journal-App/app/
   ```

   The wireframes stay reachable at `.../Multilingual-Journal-App/Wireframes%20V1/index.html`.

### Pushing updates

Just push. You do **not** need to change anything in `app/sw.js` for a normal deploy.

The service worker fetches every file from the network first and falls back to its stored copy only when there is no connection, and each request revalidates with the server so GitHub Pages' own HTTP caching can't hand back a file from before your push. Every successful response replaces the stored copy, so the offline version stays in step too.

So the update path is: push → wait for Pages to finish building (usually under a minute) → reopen the app and it's the new version. If it's already open, pull down to refresh or close and reopen it.

**To check which version your phone is actually running**, open the app, tap **⋮** on All Notes, and read the small line at the bottom of the menu — it shows the app version and when the running files were last deployed:

```
Journal v1 · updated 29 Sept 2026, 18:58
```

If that timestamp matches roughly when you pushed, your phone has the new build.

**When you still need to bump the version.** The constant on the first line of `app/sw.js` (`journal-v1`) names the cache. Changing it makes every device throw its whole stored copy away on next load. That's worth doing when:

- you've renamed or deleted files and want stale ones cleared out rather than lingering in the cache;
- something looks wrong on the phone and you want to force a clean slate;
- you change the service worker's own caching logic and want a clean start.

Bump it to `journal-v2`, `journal-v3` and so on, and keep `APP_VERSION` in `app/js/version.js` in step so the label in the menu matches.

> **The tradeoff:** network-first means each screen waits for the network before it paints when you're online, so the app is a touch slower on a bad connection than a cache-first one would be. It's fully usable offline either way — this just trades a little speed for always seeing your latest push.

## Installing it on your Android phone

1. Open **Chrome** on your phone and go to `https://azk-16.github.io/Multilingual-Journal-App/app/`.
2. Wait a few seconds for the page to finish loading (the service worker needs to register).
3. Tap the **⋮** menu in the top-right of Chrome.
4. Tap **Add to Home screen** (it may say **Install app**).
5. Confirm the name and tap **Install** / **Add**.
6. Close Chrome and open **Journal** from your home screen. It opens full-screen with no browser chrome.

To check it really works offline, turn on airplane mode and open the app from the home screen — your notes should still be there and you should still be able to write.

### On iPhone (Safari)

Open the same URL, tap the **Share** button, then **Add to Home Screen**. iOS ignores some manifest settings, but the app and its offline storage work.

## Your data

Notes live only in the browser's storage on the device you wrote them on. They are not synced anywhere, and nobody else can read them.

That also means they are only as safe as that browser profile: clearing "site data" for the domain, or uninstalling the app after clearing Chrome's storage, will remove them. Use **⋮ → Export all notes** now and then and keep the JSON file somewhere safe. **⋮ → Import from backup** restores it, and is also how you move your journal to another phone.
