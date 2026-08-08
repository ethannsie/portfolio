/* ============================================================
   viewer.js — interactive exploded-view CAD viewer.
   Mounted by app.js into a project page when that project's
   detail.cad points at a .step/.stp file (see js/data.js).
   Parses STEP directly in the browser via occt-import-js (an
   OpenCascade-in-WASM build) — no conversion step needed.

   Controls: drag to orbit, scroll to zoom, explode slider pulls
   parts apart, cutaway slices the assembly on a plane, hovering
   a part (or its row in the BOM) highlights it and shows its name.
   ============================================================ */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const OCCT_BASE = "https://cdn.jsdelivr.net/npm/occt-import-js@0.0.23/dist/";
const esc = (s) => String(s).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const PREFERS_DARK = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
const EDGE_COLOR = PREFERS_DARK ? 0xece8e3 : 0x191713;
const HIGHLIGHT_COLOR = 0x2e5c94;

/* rough densities (kg/m^3) for the mass estimate — matched against
   whatever text appears in the project's spec table, e.g. a
   ["Material", "6061-T6 aluminum"] row. First match wins. */
const MATERIAL_DENSITIES = [
  [/aluminum|aluminium|\b(6061|7075|2024)\b/i, 2700],
  [/stainless/i, 8000],
  [/\bsteel\b/i, 7850],
  [/titanium/i, 4500],
  [/brass/i, 8500],
  [/copper/i, 8960],
  [/\babs\b/i, 1040],
  [/\bpla\b/i, 1250],
  [/petg/i, 1270],
  [/nylon/i, 1140],
  [/acrylic|pmma/i, 1180],
];

function findDensity(specs) {
  if (!specs) return null;
  for (const [, value] of specs) {
    for (const [pattern, density] of MATERIAL_DENSITIES) {
      if (pattern.test(value)) return { density, label: value };
    }
  }
  return null;
}

function formatNumber(n) {
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function showMessage(container, html) {
  container.innerHTML = `<div class="cad-placeholder mono">${html}</div>`;
}

let occtPromise = null;
function getOcct() {
  if (!occtPromise) occtPromise = window.occtimportjs({ locateFile: (f) => OCCT_BASE + f });
  return occtPromise;
}

/* ---------- joint articulation ----------
   STEP carries no motion data, so a model's joints (axis, pivot,
   limits) are exported separately by scripts/fusion/export_joints_for_web.py
   into a sidecar JSON discovered by naming convention next to the
   STEP file. If it's missing or fails to load, the viewer behaves
   exactly as it does for any other model — this is purely additive.
   See scripts/fusion/README.md for the schema this reads. */
function jointsUrlFor(stepUrl) {
  return stepUrl.replace(/\.(step|stp)(\?.*)?$/i, ".joints.json$2");
}

async function fetchJoints(stepUrl) {
  try {
    const res = await fetch(jointsUrlFor(stepUrl));
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.joints)) return null;
    return data;
  } catch (e) {
    console.warn("CAD joints: couldn't load/parse joints file", e);
    return null;
  }
}

/* Matches joint definitions against this model's parts (by the same
   name used for the BOM/hover-highlight) and, for every joint that
   matches, renders a slider + play/pause row into the .cad-joints
   placeholder already present in buildViewer's toolbar markup.
   Returns the list of live joint entries so buildViewer's render loop
   can advance whichever ones are auto-playing.

   Rotation math: mesh vertices are baked into world space at parse
   time (every part's Group starts at position (0,0,0), quaternion
   identity — see buildNode/applyExplode), so rigidly rotating a part
   by angle `theta` about world axis `axis` through world pivot `pivot`
   means solving `quaternion·v + position = pivot + R(v−pivot)` for all
   v, which gives quaternion = R and position = pivot − R·pivot. This
   exact formula is unit-tested in isolation (see the plan/commit
   message for the verification script) before ever touching a real
   STEP file. */
function setupJoints(container, joints, parts, explodeSlider, applyExplode) {
  const jointsEl = container.querySelector(".cad-joints");
  if (!jointsEl || !joints || !Array.isArray(joints.joints)) return [];

  function findPart(name) {
    const exact = parts.find((p) => partLabel(p) === name);
    if (exact) return exact;
    const norm = String(name).trim().toLowerCase();
    return parts.find((p) => partLabel(p).trim().toLowerCase() === norm);
  }

  const entries = [];
  for (const def of joints.joints || []) {
    if (def.type !== "revolute" && def.type !== "slider") {
      console.warn(`CAD joints: skipping "${def.name}" — unsupported type "${def.type}"`);
      continue;
    }
    if (!Array.isArray(def.axis) || def.axis.length !== 3) {
      console.warn(`CAD joints: skipping "${def.name}" — missing/invalid axis`);
      continue;
    }
    if (def.type === "revolute" && (!Array.isArray(def.origin) || def.origin.length !== 3)) {
      console.warn(`CAD joints: skipping "${def.name}" — revolute joint missing origin`);
      continue;
    }
    const wanted = Array.isArray(def.components) ? def.components : [];
    const matched = wanted.map(findPart).filter(Boolean);
    if (!matched.length) {
      console.warn(
        `CAD joints: no part matched for joint "${def.name}" (looked for ${JSON.stringify(wanted)}); ` +
        `parts in this model: ${JSON.stringify(parts.map(partLabel))}`
      );
      continue;
    }

    const axis = new THREE.Vector3(def.axis[0], def.axis[1], def.axis[2]).normalize();
    const pivot = def.type === "revolute" ? new THREE.Vector3(def.origin[0], def.origin[1], def.origin[2]) : null;
    const min = Number.isFinite(def.min) ? def.min : 0;
    const max = Number.isFinite(def.max) ? def.max : (def.type === "revolute" ? 360 : 100);
    const value = Math.min(max, Math.max(min, Number.isFinite(def.value) ? def.value : min));
    entries.push({ def, parts: matched, axis, pivot, min, max, value, playing: false, playDir: 1 });
  }

  if (!entries.length) return [];

  jointsEl.hidden = false;
  jointsEl.innerHTML = entries.map((entry, i) => `
    <div class="cad-toolbar-row cad-joint-row">
      <button type="button" class="cad-joint-play" data-i="${i}" aria-label="Play ${esc(entry.def.name || "joint")}"><i class="ti ti-player-play"></i></button>
      <label class="cad-joint-label mono" title="${esc(entry.def.name || "")}">${esc(entry.def.name || `Joint ${i + 1}`)}</label>
      <input type="range" class="cad-joint-slider" data-i="${i}" min="${entry.min}" max="${entry.max}" step="0.1" value="${entry.value}">
      <span class="cad-joint-value mono" data-i="${i}"></span>
    </div>`).join("");

  function applyPose(entry, value) {
    for (const part of entry.parts) {
      if (entry.def.type === "revolute") {
        const q = new THREE.Quaternion().setFromAxisAngle(entry.axis, THREE.MathUtils.degToRad(value));
        part.obj.quaternion.copy(q);
        part.base = entry.pivot.clone().sub(entry.pivot.clone().applyQuaternion(q));
      } else {
        part.obj.quaternion.identity();
        part.base = entry.axis.clone().multiplyScalar(value);
      }
    }
  }

  entries.forEach((entry, i) => {
    const unit = entry.def.type === "revolute" ? "°" : "mm";
    entry.sliderEl = jointsEl.querySelector(`.cad-joint-slider[data-i="${i}"]`);
    entry.valueEl = jointsEl.querySelector(`.cad-joint-value[data-i="${i}"]`);
    entry.playBtn = jointsEl.querySelector(`.cad-joint-play[data-i="${i}"]`);

    entry.set = (value, { stopPlaying = false } = {}) => {
      entry.value = Math.min(entry.max, Math.max(entry.min, value));
      applyPose(entry, entry.value);
      applyExplode(parseFloat(explodeSlider.value));
      entry.sliderEl.value = entry.value;
      entry.valueEl.textContent = `${formatNumber(entry.value)}${unit}`;
      if (stopPlaying && entry.playing) {
        entry.playing = false;
        entry.playBtn.querySelector("i").className = "ti ti-player-play";
      }
    };

    entry.advance = (dt) => {
      const speed = (entry.max - entry.min) / 2.5; // full sweep in ~2.5s
      let next = entry.value + entry.playDir * speed * dt;
      if (next >= entry.max) { next = entry.max; entry.playDir = -1; }
      if (next <= entry.min) { next = entry.min; entry.playDir = 1; }
      entry.set(next);
    };

    entry.sliderEl.addEventListener("input", () => entry.set(parseFloat(entry.sliderEl.value), { stopPlaying: true }));
    entry.playBtn.addEventListener("click", () => {
      entry.playing = !entry.playing;
      entry.playBtn.querySelector("i").className = entry.playing ? "ti ti-player-pause" : "ti ti-player-play";
    });

    entry.set(entry.value); // establish initial pose (Fusion's value at export time)
  });

  return entries;
}

function buildNode(node, meshes, materials) {
  const obj = new THREE.Group();
  obj.name = node.name || "";
  for (const meshIndex of node.meshes || []) {
    const meshData = meshes[meshIndex];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(meshData.attributes.position.array, 3));
    if (meshData.attributes.normal) {
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(meshData.attributes.normal.array, 3));
    }
    geometry.setIndex(meshData.index.array);
    if (!meshData.attributes.normal) geometry.computeVertexNormals();

    const color = meshData.color
      ? new THREE.Color(meshData.color[0], meshData.color[1], meshData.color[2])
      : new THREE.Color(0x9aa4ad);
    const material = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.35, side: THREE.DoubleSide });
    materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = meshData.name || "";
    obj.add(mesh);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 20),
      new THREE.LineBasicMaterial({ color: EDGE_COLOR, transparent: true, opacity: 0.55 })
    );
    edges.userData.isEdgeOverlay = true;
    obj.add(edges);
  }
  for (const child of node.children || []) obj.add(buildNode(child, meshes, materials));
  return obj;
}

/* STEP assemblies often nest real parts several levels below the
   root (assembly -> sub-assembly -> part), unlike a typical glTF
   export. Find the nodes that actually carry geometry — wherever
   they sit in the tree — and treat those as the explodable /
   highlightable / BOM-countable "parts". */
function collectPartGroups(root) {
  const groups = [];
  root.traverse((obj) => {
    if (obj.children.some((c) => c.isMesh)) groups.push(obj);
  });
  return groups.length ? groups : [root];
}

function partLabel(part) {
  return part.obj.name && part.obj.name.trim() ? part.obj.name.trim() : "unnamed part";
}

function meshVolumeAndArea(geometry) {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  let volume = 0;
  let area = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), cross = new THREE.Vector3();
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(pos, index.getX(i));
    b.fromBufferAttribute(pos, index.getX(i + 1));
    c.fromBufferAttribute(pos, index.getX(i + 2));
    volume += a.dot(cross.copy(b).cross(c)) / 6;
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    area += cross.crossVectors(ab, ac).length() / 2;
  }
  return { volume: Math.abs(volume), area };
}

/* Loads one STEP file into one slot (existence already confirmed by
   the caller — see mountStrip). Resolves to:
     "error"   — file failed to download or parse (caller keeps the
                 visible error message in place)
     { pause, resume } — loaded successfully; caller uses this to
                 pause/resume the render loop when scrolled off-screen */
async function mountSlot(slotEl, url, specs, label) {
  slotEl.innerHTML = `
    <div class="cad-loading mono">
      <div class="cad-loading-label">downloading model…</div>
      <div class="cad-loading-track"><div class="cad-loading-fill"></div></div>
    </div>`;
  const loadingLabel = slotEl.querySelector(".cad-loading-label");
  const loadingTrack = slotEl.querySelector(".cad-loading-track");
  const loadingFill = slotEl.querySelector(".cad-loading-fill");

  let buffer;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("not found");

    const total = Number(response.headers.get("content-length")) || 0;
    if (!total) loadingTrack.classList.add("indeterminate");
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total) loadingFill.style.width = `${Math.min(100, (received / total) * 100)}%`;
    }
    buffer = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  } catch (e) {
    showMessage(slotEl, `Couldn't download that STEP file.<br>${esc(e && e.message ? e.message : e)}`);
    return "error";
  }

  loadingLabel.textContent = "preparing 3D engine…";
  loadingTrack.classList.add("indeterminate");
  let occt;
  try {
    occt = await getOcct();
  } catch (e) {
    showMessage(slotEl, `Couldn't load the CAD engine.<br>${esc(e && e.message ? e.message : e)}`);
    return "error";
  }

  loadingLabel.textContent = "tessellating geometry…";
  await new Promise((r) => requestAnimationFrame(r)); // let the label paint before the blocking parse

  let result;
  try {
    result = occt.ReadStepFile(buffer, null);
  } catch (e) {
    showMessage(slotEl, `Couldn't parse that STEP file.<br>${esc(e && e.message ? e.message : e)}`);
    return "error";
  }
  if (!result || !result.success) {
    showMessage(slotEl, `Couldn't parse that STEP file — make sure it's a valid .step/.stp export.`);
    return "error";
  }

  const joints = await fetchJoints(url);
  return buildViewer(slotEl, url, specs, result, label, joints);
}

function buildViewer(container, url, specs, result, label, joints) {
  container.innerHTML = `
    <div class="cad-layout">
      <div class="cad-main">
        ${label ? `<div class="cad-slot-label mono">${esc(label)}</div>` : ""}
        <div class="cad-toolbar">
          <div class="cad-toolbar-row">
            <label class="cad-explode-label mono">explode</label>
            <input type="range" class="cad-explode" min="0" max="1" step="0.001" value="0">
            <button type="button" class="cad-reset mono">reset view</button>
          </div>
          <div class="cad-toolbar-row">
            <label class="cad-toggle mono"><input type="checkbox" class="cad-edges-toggle" checked> edges</label>
            <label class="cad-toggle mono"><input type="checkbox" class="cad-cutaway-toggle"> cutaway</label>
            <input type="range" class="cad-cutaway-slider" min="0" max="1" step="0.001" value="0.5" disabled>
          </div>
          <div class="cad-joints" hidden></div>
        </div>
        <div class="cad-canvas-wrap">
          <canvas class="cad-canvas"></canvas>
          <div class="cad-tooltip mono" hidden></div>
        </div>
        <div class="cad-stats mono"></div>
      </div>
      <aside class="cad-side">
        <h4>Bill of materials</h4>
        <table class="cad-bom"><tbody></tbody></table>
        <a class="link-btn cad-download" href="${esc(url)}" download>Download STEP<i class="ti ti-download"></i></a>
      </aside>
    </div>`;

  const canvasWrap = container.querySelector(".cad-canvas-wrap");
  const canvas = container.querySelector(".cad-canvas");
  const tooltip = container.querySelector(".cad-tooltip");
  const slider = container.querySelector(".cad-explode");
  const resetBtn = container.querySelector(".cad-reset");
  const edgesToggle = container.querySelector(".cad-edges-toggle");
  const cutawayToggle = container.querySelector(".cad-cutaway-toggle");
  const cutawaySlider = container.querySelector(".cad-cutaway-slider");
  const statsEl = container.querySelector(".cad-stats");
  const bomBody = container.querySelector(".cad-bom tbody");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 6, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-5, -2, -4);
  scene.add(fill);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);

  let parts = [];
  let explodeScale = 0;
  let hovered = null;
  const materials = [];

  function resize() {
    const w = canvasWrap.clientWidth;
    const h = canvasWrap.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  new ResizeObserver(resize).observe(canvasWrap);

  function frameCamera(sphere) {
    const dist = (sphere.radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.4;
    camera.position.copy(sphere.center).add(new THREE.Vector3(dist * 0.6, dist * 0.45, dist * 0.75));
    camera.near = Math.max(sphere.radius / 100, 0.001);
    camera.far = dist * 20;
    camera.updateProjectionMatrix();
    controls.target.copy(sphere.center);
    controls.update();
    controls.saveState();
  }

  function applyExplode(t) {
    for (const part of parts) {
      part.obj.position.copy(part.base).addScaledVector(part.dir, t * explodeScale);
    }
  }

  function setHighlighted(name) {
    if (hovered === name) return;
    hovered = name;
    for (const part of parts) {
      const on = name !== null && partLabel(part) === name;
      part.obj.traverse((o) => {
        if (o.isMesh) o.material.emissive.setHex(on ? HIGHLIGHT_COLOR : 0x000000);
      });
    }
    bomBody.querySelectorAll("tr").forEach((row) => {
      row.classList.toggle("is-hovered", row.dataset.name === name);
    });
  }

  slider.addEventListener("input", () => applyExplode(parseFloat(slider.value)));
  resetBtn.addEventListener("click", () => {
    slider.value = "0";
    applyExplode(0);
    controls.reset();
  });

  edgesToggle.addEventListener("change", () => {
    scene.traverse((o) => { if (o.userData.isEdgeOverlay) o.visible = edgesToggle.checked; });
  });

  cutawayToggle.addEventListener("change", () => {
    cutawaySlider.disabled = !cutawayToggle.checked;
    renderer.clippingPlanes = cutawayToggle.checked ? [clipPlane] : [];
  });
  cutawaySlider.addEventListener("input", () => {
    const t = parseFloat(cutawaySlider.value);
    clipPlane.constant = cutawayCenterY + cutawayRadius - t * 2 * cutawayRadius;
  });

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let allMeshes = [];
  canvasWrap.addEventListener("pointermove", (e) => {
    const rect = canvasWrap.getBoundingClientRect();
    pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster.intersectObjects(allMeshes, false)[0];
    if (hit) {
      const part = parts.find((p) => hit.object.parent === p.obj);
      const name = part ? partLabel(part) : null;
      setHighlighted(name);
      tooltip.hidden = false;
      tooltip.textContent = name || "";
      tooltip.style.left = `${e.clientX - rect.left + 14}px`;
      tooltip.style.top = `${e.clientY - rect.top + 14}px`;
    } else {
      setHighlighted(null);
      tooltip.hidden = true;
    }
  });
  canvasWrap.addEventListener("pointerleave", () => {
    setHighlighted(null);
    tooltip.hidden = true;
  });

  let cutawayCenterY = 0;
  let cutawayRadius = 1;

  const model = buildNode(result.root, result.meshes, materials);
  scene.add(model);

  const overall = new THREE.Box3().setFromObject(model);
  const center = overall.getCenter(new THREE.Vector3());
  const size = overall.getSize(new THREE.Vector3());
  const sphere = overall.getBoundingSphere(new THREE.Sphere());
  explodeScale = sphere.radius * 1.1;
  cutawayCenterY = center.y;
  cutawayRadius = sphere.radius;
  clipPlane.constant = cutawayCenterY + cutawayRadius - 0.5 * 2 * cutawayRadius;

  const candidates = collectPartGroups(model);
  parts = candidates.map((obj) => {
    const box = new THREE.Box3().setFromObject(obj);
    const objCenter = box.getCenter(new THREE.Vector3());
    const dir = objCenter.clone().sub(center);
    if (dir.lengthSq() < 1e-9) dir.set(0, 1, 0); else dir.normalize();
    return { obj, base: obj.position.clone(), dir };
  });

  model.traverse((o) => { if (o.isMesh) allMeshes.push(o); });

  const jointEntries = setupJoints(container, joints, parts, slider, applyExplode);

  /* physical properties, computed from the tessellated mesh itself
     (occt-import-js reports in millimeters by default) */
  let totalVolume = 0, totalArea = 0;
  for (const mesh of allMeshes) {
    const { volume, area } = meshVolumeAndArea(mesh.geometry);
    totalVolume += volume;
    totalArea += area;
  }
  const statLines = [
    `Volume &nbsp;${formatNumber(totalVolume / 1000)} cm³`,
    `Surface area &nbsp;${formatNumber(totalArea / 100)} cm²`,
    `Bounding box &nbsp;${formatNumber(size.x)} × ${formatNumber(size.y)} × ${formatNumber(size.z)} mm`,
  ];
  const materialMatch = findDensity(specs);
  if (materialMatch) {
    const massKg = (totalVolume / 1e9) * materialMatch.density;
    const massText = massKg < 1 ? `${formatNumber(massKg * 1000)} g` : `${formatNumber(massKg)} kg`;
    statLines.push(`Est. mass &nbsp;${massText} <span class="cad-stat-hint">(${esc(materialMatch.label)}, ${materialMatch.density} kg/m³)</span>`);
  }
  statsEl.innerHTML = statLines.map((l) => `<div>${l}</div>`).join("");

  const counts = new Map();
  for (const part of parts) {
    const name = partLabel(part);
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const bomRows = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  bomBody.innerHTML = bomRows.map(([name, qty]) =>
    `<tr data-name="${esc(name)}"><td>${esc(name)}</td><td>${qty}</td></tr>`
  ).join("");
  bomBody.querySelectorAll("tr").forEach((row) => {
    row.addEventListener("pointerenter", () => setHighlighted(row.dataset.name));
    row.addEventListener("pointerleave", () => setHighlighted(null));
  });

  frameCamera(sphere);
  applyExplode(0);
  resize();

  let lastFrameTime = performance.now();
  function loop() {
    const now = performance.now();
    const dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    for (const entry of jointEntries) {
      if (entry.playing) entry.advance(dt);
    }
    controls.update();
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(loop);

  return {
    pause() { renderer.setAnimationLoop(null); },
    resume() { renderer.setAnimationLoop(loop); },
  };
}

function filenameLabel(url) {
  return decodeURIComponent(url.split("/").pop() || url);
}

/* Mounts one or more STEP files into a horizontally scrollable strip
   (one full viewer per model). The first model loads immediately;
   the rest load lazily as they scroll into view. Each already-loaded
   model's render loop pauses while scrolled off-screen and resumes
   when it's back, so having several models on one page doesn't run
   several idle WebGL contexts at once.

   Existence is checked for every file up front with a cheap HEAD
   request before any slot is created. This has to happen before the
   block is revealed (rather than lazily, per slot, on scroll) because
   IntersectionObserver never fires on descendants of a display:none
   element — if it were lazy, a missing first file would permanently
   hide the whole strip, so a real model later in the list could never
   be discovered. */
async function mountStrip(stripEl, files, specs) {
  const block = stripEl.closest(".cad-block") || stripEl;

  const exists = await Promise.all(files.map(async (url) => {
    try {
      const res = await fetch(url, { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  }));
  const available = files.filter((_, i) => exists[i]);
  if (!available.length) { block.remove(); return; }

  block.style.display = "";
  const showLabels = available.length > 1;

  const slots = available.map((url) => {
    const slot = document.createElement("div");
    slot.className = "cad-slot cad-viewer";
    stripEl.appendChild(slot);
    return { url, slot, started: false, api: null };
  });

  function start(entry) {
    if (entry.started) return;
    entry.started = true;
    const label = showLabels ? filenameLabel(entry.url) : null;
    mountSlot(entry.slot, entry.url, specs, label).then((outcome) => {
      if (outcome && typeof outcome === "object") entry.api = outcome;
    });
  }

  start(slots[0]);

  if (slots.length > 1) {
    const loadObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const entry = slots.find((s) => s.slot === e.target);
        if (entry) start(entry);
      }
    }, { root: stripEl, threshold: 0.2 });
    slots.slice(1).forEach((s) => loadObserver.observe(s.slot));

    const activityObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const entry = slots.find((s) => s.slot === e.target);
        if (!entry || !entry.api) continue;
        if (e.isIntersecting) entry.api.resume(); else entry.api.pause();
      }
    }, { root: stripEl, threshold: 0.1 });
    slots.forEach((s) => activityObserver.observe(s.slot));

    setupNav(block, stripEl, slots.length);
  }
}

/* With every slot the full width of the strip, it's easy to miss that
   scrolling reveals more than one model — so when there's more than
   one, show a "1 / 3"-style counter and click-to-advance arrows. */
function setupNav(block, stripEl, count) {
  const countEl = block.querySelector(".cad-count");
  const prevBtn = block.querySelector(".cad-nav-prev");
  const nextBtn = block.querySelector(".cad-nav-next");
  if (!countEl || !prevBtn || !nextBtn) return;

  countEl.hidden = false;
  prevBtn.hidden = false;
  nextBtn.hidden = false;

  function currentIndex() {
    const w = stripEl.clientWidth;
    return w ? Math.round(stripEl.scrollLeft / w) : 0;
  }

  function update() {
    const i = Math.min(count - 1, Math.max(0, currentIndex()));
    countEl.textContent = `${i + 1} / ${count}`;
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === count - 1;
  }

  function go(delta) {
    const i = Math.min(count - 1, Math.max(0, currentIndex() + delta));
    stripEl.scrollTo({ left: i * stripEl.clientWidth, behavior: "smooth" });
  }

  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));
  stripEl.addEventListener("scroll", () => requestAnimationFrame(update));
  new ResizeObserver(update).observe(stripEl);
  update();
}

window.CadViewer = {
  mount(stripEl, filesInput, specs) {
    if (!stripEl) return;
    const files = Array.isArray(filesInput) ? filesInput : (filesInput ? [filesInput] : []);
    if (!files.length) return;
    mountStrip(stripEl, files, specs);
  },
};
