Drop a folder of numbered JPEG pages here — `1.jpg`, `2.jpg`, `3.jpg`,
and so on — named however reads well to you (e.g.
`[Incomplete] Gears + Power Transmission/`), and commit it. That's it.
The pre-commit hook runs `scripts/build-notes.js`, which:

- renames the folder to a URL-safe slug (e.g.
  `incomplete-gears-power-transmission/`) — Vercel's router treats
  `[bracket]` syntax as a dynamic-route pattern even for plain static
  files, so anything left un-slugified 404s once deployed. Your
  original folder name is preserved as the note's display title, only
  the folder on disk is renamed.
- generates a small thumbnail from page 1 (for the notes grid) and a
  web-sized copy of every page (for the reader view), all in
  `thumbs/` — the raw camera-resolution originals stay untouched in
  your note's folder, but nothing that large ever gets shipped to a
  browser
- (re)writes `js/notes-data.js`, the data file `notes.html` and
  `note.html` render from
- stages all of that alongside your commit, so the note is live the
  moment you push

Removing a note folder and committing does the same in reverse — its
generated thumbnail/pages are cleaned up automatically. Notes are
sorted newest-first by the file date of page 1.

To build manually without waiting for a commit: `npm run build:notes`.
