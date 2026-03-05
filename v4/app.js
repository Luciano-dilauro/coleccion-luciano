/* Colección Lucho — v4 (sandbox) */

const LS_KEY = "coleccion_luciano_v4";

/* -----------------------------
   Estado
----------------------------- */
const state = {
  data: { collections: [] },
  currentId: null,
};

const $ = (id) => document.getElementById(id);

/* -----------------------------
   Persistencia
----------------------------- */
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    state.data = raw ? JSON.parse(raw) : { collections: [] };
    if (!state.data || !Array.isArray(state.data.collections)) state.data = { collections: [] };
  } catch {
    state.data = { collections: [] };
  }
}

function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(state.data));
}

/* -----------------------------
   Helpers de modelo (modo "B-ready")
----------------------------- */
function makePrefixCollection(name) {
  // Default fácil: una sola sección A con 24 figuritas (A1..A24)
  const sections = [
    { id: crypto.randomUUID(), name: "Sección A", format: "alfa", prefix: "A", count: 24 }
  ];

  const items = [];
  for (let i = 1; i <= 24; i++) {
    items.push({
      id: crypto.randomUUID(),
      sectionId: sections[0].id,
      label: `A${i}`,
      have: false,
      rep: 0,
      special: false,
    });
  }

  return {
    id: crypto.randomUUID(),
    name,
    structure: "sections",
    numberMode: "perSection",
    sections,
    items,
    cover: null,
    createdAt: Date.now(),
  };
}

function getCurrent() {
  if (!state.currentId) return null;
  return state.data.collections.find(c => c.id === state.currentId) || null;
}

/* -----------------------------
   UI: lista de colecciones
----------------------------- */
function renderCollections() {
  const list = $("collectionsList");
  if (!list) return;

  list.innerHTML = "";

  for (const col of state.data.collections) {
    const div = document.createElement("div");
    div.className = "card";
    div.textContent = col.name;

    div.addEventListener("click", () => openCollection(col.id));

    list.appendChild(div);
  }

  const status = $("status");
  if (status) {
    status.textContent = `v4 lista ✅ (colecciones: ${state.data.collections.length})`;
  }
}

/* -----------------------------
   Abrir colección (vista simple)
----------------------------- */
function openCollection(id) {
  const col = state.data.collections.find(c => c.id === id);
  if (!col) return;

  state.currentId = id;

  const list = $("collectionsList");
  const view = $("collectionView");

  if (list) list.style.display = "none";
  if (view) view.style.display = "block";

  renderCollectionView();
}

function renderCollectionView() {
  const col = getCurrent();
  const view = $("collectionView");
  if (!view) return;

  if (!col) {
    view.style.display = "none";
    const list = $("collectionsList");
    if (list) list.style.display = "block";
    return;
  }

  view.innerHTML = `
    <div class="card">
      <button id="backBtn" class="btn">← Volver</button>
      <h2>${escapeHtml(col.name)}</h2>
      <p class="muted">Colección abierta</p>
      <p class="muted" id="repsText"></p>
      <div id="stickersGrid" class="items-grid"></div>
      <p class="muted" id="progressText"></p>
    </div>
  `;

  $("backBtn")?.addEventListener("click", () => {
    const list = $("collectionsList");
    const view = $("collectionView");
    if (view) view.style.display = "none";
    if (list) list.style.display = "block";
    state.currentId = null;
  });

  renderStickers();
}

/* -----------------------------
   Render figuritas (tap = tengo sí/no)
----------------------------- */
function renderStickers() {
  const col = getCurrent();
  const grid = $("stickersGrid");
  if (!grid || !col) return;

  grid.innerHTML = "";

  for (const it of (col.items || [])) {
    const cell = document.createElement("div");
    cell.className = "item" + (it.have ? " have" : "");
    cell.textContent = it.label;

if (it.rep > 0) {
  const badge = document.createElement("div");
badge.className = "rep-badge";
badge.textContent = it.rep;

if (it.rep === 1) {
  badge.classList.add("pop");
}

cell.appendChild(badge);
}

cell.addEventListener("click", () => {
// TAP: marcar y sumar repetidas
if (!it.have) {
  it.have = true;
  it.rep = 0;
} else {
  it.rep = (it.rep || 0) + 1;
}
  save();
  renderStickers();
});

    grid.appendChild(cell);
  }
   const owned = col.items.filter(i => i.have).length;
const total = col.items.length;

const progress = $("progressText");
if(progress){
  const percent = Math.round((owned/total)*100);
  progress.textContent = `Progreso: ${owned} / ${total} (${percent}%) • Faltan: ${total-owned}`;
}
   const reps = col.items.reduce((sum, i) => sum + (i.rep || 0), 0);

const repsEl = $("repsText");
if (repsEl) {
  repsEl.textContent = `Repetidas: ${reps}`;
}
}

/* -----------------------------
   Crear colección (modo prefijos)
----------------------------- */
function createCollection() {
  const input = $("newCollectionName");
  const name = (input?.value || "").trim();
  if (!name) return;

  const col = makePrefixCollection(name);

  state.data.collections.push(col);
  save();
  renderCollections();

  if (input) input.value = "";
}

/* -----------------------------
   Utils
----------------------------- */
function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* -----------------------------
   Init
----------------------------- */
function init() {
  load();
  renderCollections();

  const btn = $("createCollectionBtn");
  btn?.addEventListener("click", createCollection);
}

document.addEventListener("DOMContentLoaded", init);
