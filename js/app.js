/* ============================================================
   app.js — renders everything from data.js.
   You should not need to edit this file to add projects;
   edit js/data.js instead.
   ============================================================ */

const DISCIPLINES = ["mechanical", "electronics", "firmware", "software", "math"];
const esc = (s) => String(s).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function initials(name) {
  const parts = name.trim().split(/\s+/);
  return parts.length < 2 ? name.toUpperCase() : `${parts[0][0]}. ${parts[parts.length - 1].toUpperCase()}`;
}

/* ---------- shared header + footer ---------- */
function renderChrome() {
  const brand = document.getElementById("brand");
  if (brand) {
    brand.innerHTML =
      `<h1 class="brand-name"><a href="index.html">${esc(PROFILE.name)}</a></h1>` +
      `<div class="brand-sub mono">${esc(PROFILE.role)}<span class="dot">/</span>${esc(PROFILE.school)}</div>`;
  }
  const nav = document.getElementById("nav");
  if (nav) {
    nav.innerHTML =
      `<a href="index.html">work</a>` +
      `<a href="notes.html">notes</a>` +
      `<a href="about.html">about</a>` +
      (PROFILE.resume ? `<a href="${esc(PROFILE.resume)}" target="_blank" rel="noopener">resume</a>` : "") +
      (PROFILE.github ? `<a class="icon" href="${esc(PROFILE.github)}" target="_blank" rel="noopener" aria-label="GitHub"><i class="ti ti-brand-github"></i></a>` : "");
  }
  const footer = document.getElementById("footer");
  if (footer) {
    footer.innerHTML = `
      <div class="titleblock">
        <div class="tb-row tb-row--wide">
          <div class="tb-cell tb-title">
            <span class="tb-label">Title</span>
            <span class="tb-value">${esc(PROFILE.name)} — ${esc(PROFILE.role)}</span>
          </div>
          <div class="tb-cell">
            <span class="tb-label">Contact</span>
            <span class="tb-value"><a href="mailto:${esc(PROFILE.email)}" target="_blank" rel="noopener">${esc(PROFILE.email)}</a></span>
          </div>
          <div class="tb-cell">
            <span class="tb-label">Elsewhere</span>
            <span class="tb-value">
              ${PROFILE.github ? `<a href="${esc(PROFILE.github)}" target="_blank" rel="noopener">GitHub</a>` : ""}
              ${PROFILE.linkedin ? ` · <a href="${esc(PROFILE.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>` : ""}
            </span>
          </div>
        </div>
        <div class="tb-row tb-row--meta">
          <div class="tb-cell"><span class="tb-label">Drawn</span><span class="tb-value">${esc(initials(PROFILE.name))}</span></div>
          <div class="tb-cell"><span class="tb-label">Date</span><span class="tb-value">${new Date().getFullYear()}</span></div>
          <div class="tb-cell"><span class="tb-label">Scale</span><span class="tb-value">N.T.S.</span></div>
          <div class="tb-cell"><span class="tb-label">Size</span><span class="tb-value">A</span></div>
          <div class="tb-cell"><span class="tb-label">Sheet</span><span class="tb-value">1 OF 1</span></div>
          <div class="tb-cell"><span class="tb-label">Rev</span><span class="tb-value">A</span></div>
        </div>
      </div>`;
  }
}

/* ---------- home grid + filtering ---------- */
function renderGrid() {
  const grid = document.getElementById("grid");
  if (!grid) return;

  const countEl = document.getElementById("count");
  const filterBar = document.getElementById("filters");

  // which discipline tags actually appear, in canonical order
  const present = DISCIPLINES.filter(d => PROJECTS.some(p => p.tags.includes(d)));
  const options = ["all", ...present];
  let active = "all";
  let query = "";

  // flatten each project's key info (title, blurb, tags, year, overview,
  // specs, links) into one lowercase blob so search can match any of it
  const searchIndex = new Map(PROJECTS.map(p => {
    const d = p.detail || {};
    const text = [
      p.title, p.blurb, p.year, ...p.tags,
      ...(d.overview || []),
      ...(d.specs || []).flat(),
      ...(d.links || []).map(l => l.label),
    ].join(" ").toLowerCase();
    return [p.slug, text];
  }));

  filterBar.innerHTML = `
    <label class="search-box">
      <i class="ti ti-search"></i>
      <input type="search" id="project-search" placeholder="Search projects…" aria-label="Search projects" autocomplete="off">
    </label>
    ${options.map(o => `<button class="filter" data-f="${o}" aria-pressed="${o === "all"}">${o}</button>`).join("")}
  `;

  function card(p, i) {
    return `
      <a class="card" href="project.html?p=${encodeURIComponent(p.slug)}" data-slug="${esc(p.slug)}" style="animation-delay:${Math.min(i, 8) * 45}ms">
        <img class="thumb" src="${esc(p.thumb)}" alt="${esc(p.title)}" loading="lazy">
        <div class="card-body">
          <div class="card-meta mono">
            <span>${esc(p.year)}</span>
          </div>
          <h2 class="card-title">${esc(p.title)}</h2>
          <p class="card-blurb">${esc(p.blurb)}</p>
          <div class="tags">
            ${p.tags.map(t => `<span class="tag tag-${esc(t)}">${esc(t)}</span>`).join("")}
          </div>
        </div>
      </a>`;
  }

  function draw(animate = true) {
    let list = active === "all" ? PROJECTS : PROJECTS.filter(p => p.tags.includes(active));
    if (query) list = list.filter(p => searchIndex.get(p.slug).includes(query));
    grid.classList.toggle("no-anim", !animate);
    grid.innerHTML = list.length
      ? list.map(card).join("")
      : `<p class="empty">${query ? `No projects match “${esc(query)}”.` : `No projects tagged “${esc(active)}” yet.`}</p>`;
    if (countEl) countEl.textContent = String(list.length).padStart(2, "0");
  }

  filterBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter");
    if (!btn) return;
    active = btn.dataset.f;
    filterBar.querySelectorAll(".filter").forEach(b =>
      b.setAttribute("aria-pressed", String(b.dataset.f === active)));
    draw();
  });

  filterBar.querySelector("#project-search").addEventListener("input", (e) => {
    query = e.target.value.trim().toLowerCase();
    draw(false);
  });

  draw();
}

/* ---------- notes gallery ----------
   Renders from NOTES (js/notes-data.js), auto-generated by
   scripts/build-notes.js from whatever image folders sit in
   assets/notes/. Each card opens note.html?n=<slug>, an in-site
   reader for that note's pages — nothing downloads or leaves the tab. */
function renderNotes() {
  const grid = document.getElementById("notes-grid");
  if (!grid) return;

  const countEl = document.getElementById("notes-count");
  const list = typeof NOTES !== "undefined" ? NOTES : [];

  function card(n, i) {
    const pageWord = `${n.pages} page${n.pages === 1 ? "" : "s"}`;
    return `
      <a class="card note-card" href="note.html?n=${encodeURIComponent(n.slug)}" style="animation-delay:${Math.min(i, 8) * 45}ms">
        <div class="note-thumb-wrap">
          <img class="note-thumb" src="${esc(n.thumb)}" alt="First page of ${esc(n.title)}" loading="lazy">
          <span class="note-badge mono">${n.pages}</span>
        </div>
        <div class="card-body">
          <h2 class="card-title">${esc(n.title)}</h2>
          <div class="card-meta mono"><span>${esc(pageWord)}</span></div>
        </div>
      </a>`;
  }

  grid.innerHTML = list.length
    ? list.map(card).join("")
    : `<p class="empty">No notes yet — drop a folder of numbered JPEG pages into <span class="mono">assets/notes/</span> and commit; it shows up here automatically.</p>`;

  if (countEl) countEl.textContent = String(list.length).padStart(2, "0");
}

/* ---------- single note reader ---------- */
function renderNoteDetail() {
  const root = document.getElementById("note-detail");
  if (!root) return;

  const slug = new URLSearchParams(location.search).get("n");
  const list = typeof NOTES !== "undefined" ? NOTES : [];
  const note = list.find((n) => n.slug === slug);

  if (!note) {
    root.innerHTML = `<a class="back" href="notes.html"><i class="ti ti-arrow-left"></i> notes</a><p class="empty">Note not found. <a href="notes.html">Back to notes</a></p>`;
    return;
  }

  document.title = `${note.title} — Ethan Sie`;

  root.innerHTML = `
    <a class="back" href="notes.html"><i class="ti ti-arrow-left"></i> notes</a>
    <div class="detail-head">
      <h1 class="detail-title">${esc(note.title)}</h1>
      <div class="detail-tags"><span class="detail-year mono">${note.pages} page${note.pages === 1 ? "" : "s"}</span></div>
    </div>
    <div class="note-pages">
      ${note.images.map((src, i) => `
        <figure class="note-page">
          <button type="button" class="zoomable"><img src="${esc(src)}" alt="${esc(note.title)} — page ${i + 1}" loading="${i === 0 ? "eager" : "lazy"}"></button>
          <figcaption class="mono">Page ${i + 1} of ${note.pages}</figcaption>
        </figure>`).join("")}
    </div>`;
}

/* ---------- project detail ---------- */
function renderDetail() {
  const root = document.getElementById("detail");
  if (!root) return;

  const slug = new URLSearchParams(location.search).get("p");
  const p = PROJECTS.find(x => x.slug === slug);

  if (!p) {
    root.innerHTML = `<p class="empty">Project not found. <a href="index.html">Back to work</a></p>`;
    return;
  }

  document.title = `${p.title} — ${PROFILE.name}`;
  const d = p.detail || {};
  root.classList.toggle("detail--eecs", p.tags.some(t => ["electronics", "firmware", "software"].includes(t)));
  const isPreview = new URLSearchParams(location.search).get("preview") === "1";

  const overview = (d.overview || []).length
    ? `<div class="prose-block"><h3>Overview</h3><div class="prose">${d.overview.map(t => `<p>${esc(t)}</p>`).join("")}</div></div>`
    : `<div class="prose-block"><div class="prose"><p>${esc(p.blurb)}</p></div></div>`;

  const specs = (d.specs || []).length
    ? `<div><h3>Specs</h3><table class="specs">${d.specs.map(
        ([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table></div>`
    : "";

  const links = (d.links || []).length
    ? `<div><h3>Links</h3><div class="links">${d.links.map(l =>
        `<a class="link-btn" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}<i class="ti ti-arrow-up-right"></i></a>`
      ).join("")}</div></div>`
    : "";

  const gallery = (d.gallery || []).length
    ? `<div class="prose-block hero-gallery">
        <div class="gallery" role="region" aria-label="Project gallery, scroll for more" tabindex="0">${d.gallery.map(src =>
          `<button type="button" class="zoomable"><img src="${esc(src)}" alt="${esc(p.title)}" loading="lazy"></button>`).join("")}</div>
      </div>`
    : "";

  const media = (d.media || []).length
    ? `<div class="prose-block media-section">
        <h3>Process</h3>
        <div class="media-grid" role="region" aria-label="Process photos and video, scroll for more" tabindex="0">${d.media.map(m => {
          const caption = m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : "";
          return m.type === "video"
            ? `<figure class="media-item">
                <video controls playsinline${m.poster ? ` poster="${esc(m.poster)}"` : ""}>
                  <source src="${esc(m.src)}">
                </video>${caption}</figure>`
            : `<figure class="media-item"><button type="button" class="zoomable"><img src="${esc(m.src)}" alt="${esc(m.caption || p.title)}" loading="lazy"></button>${caption}</figure>`;
        }).join("")}</div>
      </div>`
    : "";

  const embed = d.embed && !isPreview
    ? `<div class="prose-block embed-section"><h3>${esc(d.embed.label || "Interactive demo")}</h3><div class="embed-frame" style="height:${esc(d.embed.height || 950)}px"><iframe src="${esc(d.embed.url)}" loading="lazy" allowfullscreen></iframe></div></div>`
    : "";

  const cadFiles = isPreview ? [] : (Array.isArray(d.cad) ? d.cad : (d.cad ? [d.cad] : []));
  const cad = cadFiles.length
    ? `<div class="prose-block cad-block" style="display:none">
        <h3>CAD — exploded view <span class="cad-count mono" hidden></span></h3>
        <div class="cad-strip-wrap">
          <div class="cad-strip" id="cad-strip" role="region" aria-label="CAD models, scroll for more"></div>
          <button type="button" class="cad-nav cad-nav-prev" aria-label="Previous model" hidden><i class="ti ti-chevron-left"></i></button>
          <button type="button" class="cad-nav cad-nav-next" aria-label="Next model" hidden><i class="ti ti-chevron-right"></i></button>
        </div>
      </div>`
    : "";

  root.innerHTML = `
    <a class="back" href="index.html"><i class="ti ti-arrow-left"></i> all work</a>
    <div class="detail-head">
      <h1 class="detail-title">${esc(p.title)}</h1>
      <div class="detail-tags">
        <span class="detail-year mono">${esc(p.year)}</span>
        ${p.tags.map(t => `<span class="tag tag-${esc(t)}">${esc(t)}</span>`).join("")}
      </div>
    </div>
    ${gallery}
    <div class="detail-cols">
      <div>${overview}</div>
      <aside class="side">${specs}${specs && links ? '<div style="height:32px"></div>' : ''}${links}</aside>
    </div>
    ${embed}
    ${media}
    ${cad}`;

  if (cadFiles.length && window.CadViewer) {
    window.CadViewer.mount(document.getElementById("cad-strip"), cadFiles, d.specs);
  }
}

/* ---------- click-to-enlarge lightbox for hero/gallery/media images ---------- */
function initLightbox() {
  let overlay, imgEl, closeBtn, lastFocused;

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Image preview");
    overlay.innerHTML =
      `<button type="button" class="lightbox-close" aria-label="Close preview"><i class="ti ti-x"></i></button>
       <img class="lightbox-img" alt="">`;
    document.body.appendChild(overlay);
    imgEl = overlay.querySelector(".lightbox-img");
    closeBtn = overlay.querySelector(".lightbox-close");
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    closeBtn.addEventListener("click", close);
  }

  function open(src, alt, trigger) {
    ensureOverlay();
    lastFocused = trigger;
    imgEl.src = src;
    imgEl.alt = alt || "";
    overlay.classList.add("is-open");
    document.documentElement.classList.add("lightbox-lock");
    closeBtn.focus();
  }

  function close() {
    if (!overlay || !overlay.classList.contains("is-open")) return;
    overlay.classList.remove("is-open");
    document.documentElement.classList.remove("lightbox-lock");
    if (lastFocused) lastFocused.focus();
  }

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest(".zoomable");
    if (!trigger) return;
    const img = trigger.querySelector("img");
    if (!img) return;
    open(img.currentSrc || img.src, img.alt, trigger);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

/* ---------- hover preview of a project's page, on the home grid ----------
   Loads the real project page in a scaled-down iframe (with ?preview=1,
   which tells renderDetail to skip mounting the CAD viewer / embed so a
   quick hover doesn't trigger a full WASM/three.js load). Only wired up
   on devices that have real hover (skips touch entirely). */
function initCardPreview() {
  if (!window.matchMedia("(hover: hover)").matches) return;

  const FRAME_W = 1280, FRAME_H = 900, PANEL_W = 340, PANEL_H = 239;
  const SCALE = PANEL_W / FRAME_W;

  let panel, iframe, showTimer, hideTimer, activeSlug;

  function ensurePanel() {
    if (panel) return;
    panel = document.createElement("div");
    panel.className = "card-preview";
    panel.innerHTML = `<iframe tabindex="-1" aria-hidden="true"></iframe>`;
    document.body.appendChild(panel);
    iframe = panel.querySelector("iframe");
    iframe.style.width = `${FRAME_W}px`;
    iframe.style.height = `${FRAME_H}px`;
    iframe.style.transform = `scale(${SCALE})`;
  }

  function position(cardEl) {
    const rect = cardEl.getBoundingClientRect();
    let left = rect.right + 16;
    if (left + PANEL_W > window.innerWidth - 12) left = rect.left - PANEL_W - 16;
    left = Math.min(Math.max(left, 12), window.innerWidth - PANEL_W - 12);
    const top = Math.min(Math.max(rect.top, 12), window.innerHeight - PANEL_H - 12);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function show(cardEl, slug) {
    ensurePanel();
    if (activeSlug !== slug) {
      activeSlug = slug;
      iframe.src = `project.html?p=${encodeURIComponent(slug)}&preview=1`;
    }
    position(cardEl);
    panel.classList.add("is-visible");
  }

  function hide() {
    if (panel) panel.classList.remove("is-visible");
  }

  document.addEventListener("pointerover", (e) => {
    const card = e.target.closest(".card");
    if (!card || !card.dataset.slug) return;
    clearTimeout(hideTimer);
    clearTimeout(showTimer);
    showTimer = setTimeout(() => show(card, card.dataset.slug), 350);
  });

  document.addEventListener("pointerout", (e) => {
    const card = e.target.closest(".card");
    if (!card || card.contains(e.relatedTarget)) return;
    clearTimeout(showTimer);
    hideTimer = setTimeout(hide, 80);
  });

  window.addEventListener("scroll", hide, { passive: true, capture: true });
}

document.addEventListener("DOMContentLoaded", () => {
  renderChrome();
  renderGrid();
  renderNotes();
  renderNoteDetail();
  renderDetail();
  initLightbox();
  initCardPreview();
});
