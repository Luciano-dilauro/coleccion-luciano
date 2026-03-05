/* Colección Lucho — v4 */

const LS_KEY = "coleccion_luciano_v4";

const state = {
  data: { collections: [] },
  currentCollection: null
};

const $ = (id) => document.getElementById(id);

/* =============================
   Persistencia
============================= */
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    state.data = raw ? JSON.parse(raw) : { collections: [] };
    if (!state.data.collections) state.data.collections = [];
  } catch {
    state.data = { collections: [] };
  }
}

function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(state.data));
}
function openCollection(id) {

  const col = state.data.collections.find(c => c.id === id);
  if (!col) return;

  state.currentCollection = col;

  const list = $("collectionsList");
  const view = $("collectionView");

  if (list) list.style.display = "none";
  if (view) view.style.display = "block";

  view.innerHTML = `
    <div class="card">
    <button id="backBtn" class="btn">← Volver</button>
    <h2>${col.name}</h2>
    <p class="muted">Colección abierta</p>
    <div id="stickersGrid"></div>
    </div>
  `;
renderStickers();
  $("backBtn")?.addEventListener("click", () => {

    if (view) view.style.display = "none";
    if (list) list.style.display = "block";

    state.currentCollection = null;

  });

}
 
function renderStickers(){

  const grid = $("stickersGrid");
  if(!grid) return;

  grid.innerHTML = "";
    for(let i=1;i<=24;i++){
    const sticker = document.createElement("div");
    sticker.className = "card";
    sticker.textContent = "A" + i;

    grid.appendChild(sticker);
  }
}

/* =========================
   Crear colección
========================= */
function createCollection() {
  const input = $("newCollectionName");
  const name = (input?.value || "").trim();
  if (!name) return;

  const col = {
    id: crypto.randomUUID(),
    name,
    items: []
  };

  state.data.collections.push(col);
  save();
  renderCollections();

  input.value = "";
}

/* =============================
   Render colecciones
============================= */
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

/* =============================
   Init
============================= */
function init() {
  load();
  renderCollections();

  const btn = $("createCollectionBtn");
  btn?.addEventListener("click", createCollection);
}

document.addEventListener("DOMContentLoaded", init);
