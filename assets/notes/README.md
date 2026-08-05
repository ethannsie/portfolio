Drop a PDF here, named however you want — spaces, brackets, whatever
reads well to you (e.g. `[Incomplete] Gears + Power Transmission.pdf`)
— and commit it. That's it. The pre-commit hook runs
`scripts/build-notes.js`, which:

- renders the first page of every PDF in this folder to a thumbnail
  in `thumbs/`
- renames the PDF itself to a URL-safe slug (e.g.
  `incomplete-gears-power-transmission.pdf`) — Vercel's router treats
  `[bracket]` syntax as a dynamic-route pattern even for plain static
  files, so anything left un-slugified 404s once deployed. Your
  original filename is preserved as the note's display title, only
  the file on disk is renamed.
- (re)writes `js/notes-data.js`, the data file the Notes page
  (`notes.html`) renders from
- stages all of that alongside your commit, so the Notes page is live
  with the new PDF the moment you push

Removing a PDF from this folder and committing does the same in
reverse — its thumbnail and entry are cleaned up automatically. Notes
are sorted newest-first by file modification time.

To build manually without waiting for a commit: `npm run build:notes`.
