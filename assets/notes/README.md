Drop a folder of numbered JPEG pages here — `1.jpg`, `2.jpg`, `3.jpg`,
and so on — named however reads well to you (e.g.
`[Incomplete] Gears + Power Transmission/`), and commit it. That's it.
The pre-commit hook runs `scripts/build-notes.js`, which:

- renames the folder to a URL-safe slug (e.g.
  `incomplete-gears-power-transmission/`) — Vercel's router treats
  `[bracket]` syntax as a dynamic-route pattern even for plain static
  files, so anything left un-slugified 404s once deployed. Your
  original folder name is captured once into a `.title` dotfile inside
  the note's folder and used as the display title from then on — the
  rename only affects the folder on disk, not what shows on the page.
- generates a single thumbnail from page 1 for the notes grid, in
  `thumbs/`. The reader view links directly to your original page
  images — nothing else is duplicated.
- (re)writes `js/notes-data.js`, the data file `notes.html` and
  `note.html` render from
- stages all of that alongside your commit, so the note is live the
  moment you push

Removing a note folder and committing does the same in reverse — its
thumbnail and entry are cleaned up automatically. Notes are sorted
newest-first by the file date of page 1.

To rename a note later, edit its `.title` file rather than the folder
name — the folder name is just a URL slug at that point.

To build manually without waiting for a commit: `npm run build:notes`.
