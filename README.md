# Portfolio

A static, no-build portfolio site. Plain HTML/CSS/JS — nothing to compile.
Everything on the site is generated from one data file.

## Run it locally

Because it loads a few files, open it through a tiny local server rather than
double-clicking `index.html`:

```bash
cd portfolio
python3 -m http.server 8000
```

Then visit http://localhost:8000

## Add or edit a project

Open `js/data.js` and add an entry to the `PROJECTS` array. Every field is
documented at the top of that file. A minimal entry:

```js
{
  id: "ME·04",
  slug: "my-new-project",              // unique, lowercase, no spaces
  title: "My new project",
  year: "2025",
  blurb: "One-line summary for the card.",
  tags: ["mechanical", "software"],    // any of: mechanical, electronics, firmware, software
  thumb: "assets/img/my-new-project.svg",
  icon: "ti-tool",
  detail: {
    overview: ["A paragraph about it.", "Another paragraph."],
    specs: [["Mass", "2 kg"], ["Material", "Aluminum"]],
    gallery: ["assets/img/my-new-project.svg"],
    links: [{ label: "GitHub", url: "https://github.com/you/repo" }]
  }
}
```

The `tags` you use automatically become filter buttons on the home page.
Anything inside `detail` is optional — delete a block to hide that section.

### Swapping images

Drop your own images into `assets/img/` (JPG, PNG, or SVG) and point `thumb`
and `gallery` at them. The starter files are blueprint-style placeholders.

### Your info

Edit the `PROFILE` object at the bottom of `js/data.js` (name, email, GitHub,
LinkedIn, resume path). It updates the header, footer, and about page.
Replace `assets/resume.pdf` with your real resume.

## Deploy (pick one — all free)

**GitHub Pages**
1. Push this folder to a GitHub repo.
2. Settings → Pages → Source: `main` branch, `/root`.
3. Your site is live at `https://<username>.github.io/<repo>/`.
   (The included `.nojekyll` file makes sure everything serves correctly.)

**Netlify** — drag this folder onto https://app.netlify.com/drop

**Vercel** — `npx vercel` from inside this folder, or import the repo at vercel.com

## Files

```
index.html      home — the project grid
project.html    project detail (reads ?p=slug from the url)
about.html      about + contact
css/style.css   all styling
js/data.js      >>> YOUR CONTENT — edit this <<<
js/app.js        rendering logic (no need to touch)
assets/img/     thumbnails and project images
assets/resume.pdf
```
