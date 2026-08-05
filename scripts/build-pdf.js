/* ============================================================
   Builds a print-ready PDF version of the portfolio from the
   same js/data.js that drives the site, so the PDF always
   matches whatever's currently live.

   Run manually with `npm run build:pdf`, or automatically via
   the .githooks/pre-commit hook whenever a commit touches
   js/data.js, assets/img/, or assets/papers/ — the hook stages
   the rebuilt PDF into that same commit.

   Output: assets/Ethan-Sie-Portfolio.pdf (tracked in git, so it
   lives in the repo alongside the content it's built from) and
   a convenience copy on the Desktop.
   ============================================================ */

const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const BUILD_DIR = path.join(ROOT, ".pdf-build");
const IMG_OUT_DIR = path.join(BUILD_DIR, "img");
const OUTPUT_PDF = path.join(ROOT, "assets", "Ethan-Sie-Portfolio.pdf");
const DESKTOP_COPY = path.join(os.homedir(), "Desktop", "Ethan-Sie-Portfolio.pdf");
const SITE = "https://ethansie.vercel.app/";

fs.mkdirSync(IMG_OUT_DIR, { recursive: true });

// ---- load PROJECTS / PROFILE straight out of js/data.js ----
const dataSrc = fs.readFileSync(path.join(ROOT, "js", "data.js"), "utf8");
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(dataSrc + "\nthis.PROJECTS = PROJECTS; this.PROFILE = PROFILE;", sandbox);
const { PROJECTS, PROFILE } = sandbox;

const disciplineColor = {
  mechanical: { c: "#A6501C", bg: "#FBEEE3" },
  electronics: { c: "#1F3A5F", bg: "#EEF1F5" },
  firmware: { c: "#2F6B4F", bg: "#E9F3EE" },
  software: { c: "#5B4B93", bg: "#F0EEF8" },
  math: { c: "#7A3B5E", bg: "#F6EBF1" },
};

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tagPill(t) {
  const col = disciplineColor[t] || { c: "#444", bg: "#eee" };
  return `<span class="tag" style="color:${col.c};background:${col.bg};border-color:${col.c}33">${esc(t)}</span>`;
}

function specsTable(specs) {
  if (!specs || !specs.length) return "";
  return `<table class="specs">${specs.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join("")}</table>`;
}

function linksLine(links) {
  if (!links || !links.length) return "";
  return `<div class="links">${links.map(l => {
    const href = l.url.startsWith("http") ? l.url : SITE + l.url;
    return `<span class="link-item">${esc(l.label)} — <a class="url" href="${esc(href)}">${esc(href)}</a></span>`;
  }).join("  ·  ")}</div>`;
}

// downscale a project's thumb with macOS's built-in `sips` (no extra deps)
// so a stray 10MB source photo doesn't balloon the PDF.
function preparedImage(thumbRelPath) {
  const src = path.join(ROOT, thumbRelPath);
  if (!fs.existsSync(src)) return null;
  const outName = thumbRelPath.replace(/[\\/]/g, "_").replace(/\.\w+$/, "") + ".jpg";
  const out = path.join(IMG_OUT_DIR, outName);
  execFileSync("sips", [
    "-s", "format", "jpeg",
    "-s", "formatOptions", "80",
    "-Z", "1100",
    src,
    "--out", out,
  ], { stdio: "pipe" });
  return out;
}

const today = new Date();
const dateStr = today.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

const coverPage = `
<section class="page cover">
  <div class="cover-eyebrow mono">PORTFOLIO — SELECTED WORK</div>
  <h1 class="cover-name">${esc(PROFILE.name)}</h1>
  <div class="cover-role">${esc(PROFILE.role)} · ${esc(PROFILE.school)}</div>
  <p class="cover-blurb">
    A running catalog of things I've designed and built across mechanical engineering and EECS —
    from embedded firmware and circuit-level simulation to CAD-driven fabrication and applied
    mathematical modeling. Each project below includes the approach, the specs, and where to find
    the source or write-up.
  </p>
  <div class="cover-contact mono">
    <div><span class="k">Email</span> <a href="mailto:${esc(PROFILE.email)}">${esc(PROFILE.email)}</a></div>
    <div><span class="k">GitHub</span> <a href="${esc(PROFILE.github)}">${esc(PROFILE.github.replace(/^https?:\/\//, ""))}</a></div>
    <div><span class="k">LinkedIn</span> <a href="${esc(PROFILE.linkedin)}">${esc(PROFILE.linkedin.replace(/^https?:\/\//, ""))}</a></div>
    <div><span class="k">Web</span> <a href="${esc(SITE)}">${esc(SITE.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a></div>
  </div>
  <p class="cover-note">Interactive versions of every project below — exploded-view CAD viewers, live embeds, full photo galleries — are on the site at the link above.</p>

  <div class="cover-toc">
    <div class="toc-label mono">CONTENTS</div>
    ${PROJECTS.map(p => `
      <div class="toc-row">
        <span class="toc-title">${esc(p.title)}</span>
        <span class="toc-tags">${p.tags.map(tagPill).join(" ")}</span>
        <span class="toc-year mono">${esc(p.year)}</span>
      </div>`).join("")}
  </div>
</section>`;

function projectPage(p, index, total) {
  const d = p.detail || {};
  const imgPath = preparedImage(p.thumb);
  const imgTag = imgPath ? `<img class="proj-img" src="${imgPath}" alt="${esc(p.title)}">` : "";
  const overview = (d.overview || []).map(t => `<p>${esc(t)}</p>`).join("");
  return `
<section class="page project">
  <div class="proj-head">
    <h2 class="proj-title">${esc(p.title)}</h2>
    <div class="proj-meta">
      <span class="proj-year mono">${esc(p.year)}</span>
      ${p.tags.map(tagPill).join(" ")}
    </div>
    <p class="proj-blurb">${esc(p.blurb)}</p>
  </div>

  <div class="proj-body">
    <div class="proj-col-main">
      <div class="prose">${overview}</div>
      ${linksLine(d.links)}
    </div>
    <div class="proj-col-side">
      ${imgTag}
      ${specsTable(d.specs)}
    </div>
  </div>

  <div class="titleblock mono">
    <span>${esc(PROFILE.name)}</span>
    <span>${dateStr}</span>
    <span>SHEET ${index + 1} OF ${total}</span>
  </div>
</section>`;
}

const projectPages = PROJECTS.map((p, i) => projectPage(p, i, PROJECTS.length)).join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(PROFILE.name)} — Portfolio</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  @page { size: Letter; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Space Grotesk', sans-serif;
    color: #191713;
    font-size: 12.5px;
    line-height: 1.55;
  }
  .mono { font-family: 'JetBrains Mono', monospace; }
  a { color: inherit; text-decoration: none; }
  .page {
    width: 8.5in;
    min-height: 11in;
    padding: 0.65in 0.7in;
    page-break-after: always;
    position: relative;
  }
  .page:last-child { page-break-after: auto; }

  /* ---- cover ---- */
  .cover-eyebrow { font-size: 11px; letter-spacing: .12em; color: #6C6A63; margin-bottom: 26px; }
  .cover-name { font-size: 44px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 8px; }
  .cover-role { font-size: 15px; color: #6C6A63; margin-bottom: 26px; }
  .cover-blurb { font-size: 13.5px; max-width: 5.6in; color: #35332d; margin-bottom: 26px; }
  .cover-contact { display: flex; gap: 28px; font-size: 11.5px; border-top: 1px solid #E5E3DB; border-bottom: 1px solid #E5E3DB; padding: 14px 0; }
  .cover-contact .k { color: #9B988F; margin-right: 6px; }
  .cover-note { font-size: 10.5px; color: #9B988F; max-width: 5.4in; margin: 12px 0 34px; font-style: italic; }
  .toc-label { font-size: 10.5px; letter-spacing: .12em; color: #9B988F; margin-bottom: 14px; }
  .toc-row { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 1px solid #E5E3DB; }
  .toc-title { flex: 1; font-size: 14px; font-weight: 500; }
  .toc-tags { flex: none; }
  .toc-year { width: 40px; flex: none; text-align: right; font-size: 11px; color: #9B988F; }

  /* ---- tags ---- */
  .tag { display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; padding: 2px 7px; border-radius: 999px; border: 1px solid; margin-right: 4px; }

  /* ---- project page ---- */
  .proj-head { border-bottom: 2px solid #191713; padding-bottom: 14px; margin-bottom: 22px; }
  .proj-title { font-size: 24px; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 8px; }
  .proj-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .proj-year { font-size: 11px; color: #9B988F; margin-right: 4px; }
  .proj-blurb { font-size: 13px; color: #35332d; margin: 0; font-style: italic; }

  .proj-body { display: grid; grid-template-columns: 1.55fr 1fr; gap: 30px; }
  .prose p { margin: 0 0 12px; font-size: 12.3px; }
  .prose p:last-child { margin-bottom: 0; }

  .proj-img { width: 100%; border-radius: 6px; border: 1px solid #E5E3DB; display: block; margin-bottom: 14px; object-fit: cover; max-height: 190px; }

  table.specs { width: 100%; border-collapse: collapse; font-size: 10.8px; }
  table.specs tr { border-bottom: 1px solid #E5E3DB; }
  table.specs tr:last-child { border-bottom: none; }
  table.specs td { padding: 7px 0; vertical-align: top; }
  table.specs td.k { color: #9B988F; width: 34%; padding-right: 10px; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; }
  table.specs td.v { color: #191713; }

  .links { margin-top: 14px; font-size: 10.8px; color: #35332d; }
  .link-item .url { font-family: 'JetBrains Mono', monospace; color: #2E5C94; font-size: 10px; }

  .titleblock { position: absolute; bottom: 0.45in; left: 0.7in; right: 0.7in; display: flex; justify-content: space-between; font-size: 9px; color: #9B988F; border-top: 1px solid #E5E3DB; padding-top: 8px; letter-spacing: .04em; }
</style>
</head>
<body>
${coverPage}
${projectPages}
</body>
</html>`;

const htmlPath = path.join(BUILD_DIR, "portfolio.html");
fs.writeFileSync(htmlPath, html);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("file://" + htmlPath, { waitUntil: "networkidle" });
  fs.mkdirSync(path.dirname(OUTPUT_PDF), { recursive: true });
  await page.pdf({
    path: OUTPUT_PDF,
    format: "Letter",
    printBackground: true,
    margin: { top: "0", bottom: "0", left: "0", right: "0" },
  });
  await browser.close();

  try {
    fs.copyFileSync(OUTPUT_PDF, DESKTOP_COPY);
  } catch {
    // no Desktop directory (e.g. CI) — the repo copy is still there
  }

  console.log(`Portfolio PDF built → ${path.relative(ROOT, OUTPUT_PDF)}`);
})();
