/* Colección Lucho — v4 */

const LS_KEY = "coleccion_luciano_v4";

const state = {
  data: { collections: [] },
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

/* =============================
   Crear colección
============================= */
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
