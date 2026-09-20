# MEtunes

An iTunes-style music manager that runs entirely in your browser, built for people who still use feature phones ("dumbphones"). Plug the phone in, point MEtunes at its memory card, and browse, tag, organize, and build playlists from the files on it — like a desktop music app, without installing anything or uploading a single file.

No backend, no accounts, no server-side storage. Everything happens locally in the tab.

## Features

- **Connect a phone's storage** — open the phone's USB drive (or its memory card) and see its real folder structure, with a breadcrumb bar and an expandable folder tree.
- **Library sections** — Music, Audiobooks, and Videos (for video files you'd rather listen to, like motivational talks). Each top-level folder is assigned to a section; the choice is saved in a small `.metunes-library.json` on the device itself, so it follows the card between computers.
- **Import songs** — copy files onto the device with the **Import** button, **Import Folder**, or by dragging songs (or whole folders) onto the window. Choose the destination folder; folders you drop keep their structure, and a file with the same name is kept and the new one becomes `Song (2).mp3`.
- **Search the whole device** — matches title, artist, album, filename, and folder names across every section and folder, not just the one you're viewing.
- **Three ways to view songs** — List, Grid, and Albums (a grid of album covers that opens into an album page), with a toggle to show or hide album art. Your choice is remembered.
- **Organize files** — create folders, move, rename, and delete files directly on the device.
- **Albums** — turn songs into an album folder (`Artist - Album`) and fill in what's missing:
  - **Create Album** from selected songs, or start from an empty folder.
  - **Album Info** on any folder fills in missing album, artist, year, track numbers, and cover art for the songs in it.
  - **Find Albums** scans for songs that aren't inside an album folder (loose in the device root or a catch-all folder like `Music`) and groups them by their tags into suggested albums.
  - Missing info comes from MusicBrainz and can be skipped; by default only blanks are filled and your existing tags are kept.
- **Edit metadata** — title, artist, album, album artist, track number, year, genre, and cover art, written back into the file as ID3v2 tags.
- **Auto-tagging** — look up titles, artists, albums, years, and cover art from [MusicBrainz](https://musicbrainz.org) and the [Cover Art Archive](https://coverartarchive.org) (both free, no API key). Pick a match yourself for one file, or run a batch that only applies confident matches.
- **Playlists** — saved as standard `.m3u8` files at the root of the device, so the phone's own player can read them.
- **Device identification** — optionally read the phone's manufacturer and model name over WebUSB.
- **Apple-style player** — a mini player bar plus a full-screen Now Playing view with an Up Next queue.
- **Works on small screens** — the layout adapts to phones and tablets: the sidebar becomes a menu drawer, the toolbar scrolls sideways, dialogs slide up from the bottom, and tap targets are larger.
- **Demo Mode** — try everything without any hardware, against a small fake library.

Recognized formats: MP3, M4A, M4B, AAC, WAV, FLAC, OGG, Opus, WMA, AMR, 3GA, MIDI (audio) and MP4, 3GP, 3G2, AVI, MOV, MKV, WebM, M4V (video).

## Requirements

- A **Chromium-based desktop browser** (Chrome or Edge) to manage a real memory card. MEtunes relies on the File System Access API, which Firefox and Safari don't implement, and which phone and tablet browsers generally don't offer. WebUSB (device identification) is Chromium-only as well.
- A phone that exposes its storage as **USB Mass Storage** — i.e. it shows up on your computer like a flash drive. Most feature phones do this when set to "USB storage" mode.
- Internet access only for auto-tagging and album lookups; everything else works offline.

The interface itself is responsive and works on phones and tablets, but on a browser that can't open device folders the connect screen says so and only Demo Mode is available. This hasn't been tested on a real Android device.

## Getting started

```bash
git clone https://github.com/yumevsn/-MEtunes.git
cd ./-MEtunes
npm install
npm run dev
```

Open the local URL Vite prints in Chrome or Edge. (The repo name starts with a dash, hence the `./`.)

**With a phone:**

1. Connect the phone over USB and switch it to "USB storage" / "Mass storage" mode.
2. Click **Connect device storage** and choose the phone's drive (or its memory card) in the dialog. Grant read/write access when prompted.
3. Optionally click **Identify device** in the sidebar to show the phone's make and model.

**Without a phone:** click **Try Demo Mode** on the connect screen.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run Oxlint |

The production build is a static site and can be hosted anywhere over HTTPS (the File System Access API requires a secure context; `localhost` also qualifies).

## Demo Mode

Demo Mode loads a small made-up library — Coldplay and Fela Kuti tracks (some loose in `Music/`, so **Find Albums** has something to find), an audiobook, two videos, and a "Road Trip Mix" playlist — into an in-memory stand-in for the phone's storage. Browsing, importing, tagging, albums, playlists, and move/rename/delete all run through the same code they use on a real device; only the storage underneath is fake. Playback is simulated (a timer drives the progress bar), because the demo files contain no real audio. Auto-tag and album lookups in Demo Mode make real MusicBrainz requests. Importing works in Demo Mode too, so you can drag real songs in.

## Limitations

- **MP3 only for tag writing.** Other formats can be browsed and their tags read, but not edited.
- **MTP phones aren't supported.** Phones that expose storage over MTP (as Android does) rather than Mass Storage can't be opened by a browser-only app.
- **Move and rename copy the file.** The File System Access API has no reliable rename/move, so MEtunes reads the file, writes it to the new location, and deletes the original. Large files are held in memory during this. If the destination already has a file with that name, the moved file is renamed rather than overwriting it.
- **Deletes are permanent.** Files are removed from the device directly, not sent to a trash.
- **You reconnect each session.** The device folder isn't remembered across page reloads.
- **Auto-tag and album lookups can be slow on big selections.** Requests are paced at roughly one per second to respect MusicBrainz's usage limits, and browsers don't allow setting the custom `User-Agent` header MusicBrainz prefers.
- **Album tools work best on one album at a time.** They warn when the songs you pick are tagged with several different albums. Find Albums only considers songs that aren't already in a folder of their own, and leaves an album with a single loose song alone.
- **Drag-and-drop and Import Folder are for desktop browsers.** On phones use the Import button.

## Privacy

Your files never leave your computer. The only network traffic is auto-tagging and album lookups, which send the title, artist, and album text of the songs you look up to MusicBrainz, and fetch cover art from the Cover Art Archive.

## Project structure

```
src/
  components/   UI: sidebar, library (list / grid / album views), player bar,
                Now Playing view, tag editor, auto-tag, import, and album
                dialogs, icon set
  lib/          File System Access wrappers, tag reading/writing, MusicBrainz
                and Cover Art Archive clients, album grouping and matching,
                import helpers, M3U handling, WebUSB lookup, the in-memory
                virtual filesystem and demo data
  views.css     View-mode, album dialog, and responsive (mobile) styles
  store/        Zustand store holding library, playback, and view state
  types.ts      Shared types
```

## Tech stack

React 19, TypeScript, Vite, and Zustand, with [music-metadata](https://github.com/Borewit/music-metadata) for reading tags and [browser-id3-writer](https://github.com/egoroof/browser-id3-writer) for writing them.
