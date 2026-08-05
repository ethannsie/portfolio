Drop a PDF here (e.g. `dynamics-midterm-review.pdf`) and commit it —
that's it. The pre-commit hook runs `scripts/build-notes.js`, which:

- renders the first page of every PDF in this folder to a thumbnail
  in `thumbs/`
- (re)writes `js/notes-data.js`, the data file the Notes page
  (`notes.html`) renders from
- stages both of those alongside your commit, so the Notes page is
  live with the new PDF the moment you push

Removing a PDF from this folder and committing does the same in
reverse — its thumbnail and entry are cleaned up automatically.

Filenames become the note's title (`circuits-hw3-notes.pdf` →
"Circuits Hw3 Notes"), so name files the way you'd want them to read
on the page. Notes are sorted newest-first by file modification time.

To build manually without waiting for a commit: `npm run build:notes`.
