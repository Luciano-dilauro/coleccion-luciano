/* =============================
   Colección Luciano - Arquitectura estable (v2.3.1)
   - Especiales por lista
   - Crear / Editar secciones sin perder progreso
   - Backup: solo REEMPLAZAR
   - Reordenar secciones
   - Generador rápido por lista
   - NUEVO:
     ✅ Colecciones nuevas aparecen arriba
============================= */

const LS_KEY = "coleccion_luciano_v2";
const META_KEY = "coleccion_luciano_meta_v2";
const BACKUP_VERSION = 1;

const $ = (id) => document.getElementById(id);

const els = {
  backBtn: $("backBtn"),
  topbarTitle: $("topbarTitle"),
  views: Array.from(document.querySelectorAll("[data-view]")),
  collectionsList: $("collectionsList"),

  newName: $("newName"),
  structRadios: Array.from(document.querySelectorAll('input[name="structType"]')),
  simpleBlock: $("simpleBlock"),
  sectionsBlock: $("sectionsBlock"),
  simpleCount: $("simpleCount"),
  simpleSpecials: $("simpleSpecials"),
  numberMode: $("numberMode"),
  sectionsEditor: $("sectionsEditor"),
  btnAddSection: $("btnAddSection"),

  detailTitle: $("detailTitle"),
  stTotal: $("stTotal"),
  stHave: $("stHave"),
  stMissing: $("stMissing"),
  stPct: $("stPct"),
  sectionsDetail: $("sectionsDetail"),

  editTitle: $("editTitle"),
  editName: $("editName"),
  editSectionsArea: $("editSectionsArea"),
  editAddSection: $("editAddSection"),
  editSectionsEditor: $("editSectionsEditor"),

  importInput: $("importInput"),
  exportMeta: $("exportMeta"),
  importMeta: $("importMeta"),
  storageMeta: $("storageMeta"),
};

const state = {
  view: "home",
  currentId: null,
  data: { collections: [] },
  meta: {
    lastExportAt: null,
    lastExportSize: null,
    lastImportAt: null,
    lastImportMode: "replace",
  }
};

/* -----------------------------
   Helpers
----------------------------- */

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function getCurrent() {
  if (!state.currentId) return null;
  return state.data.collections.find(c => c.id === state.currentId) || null;
}

function computeStats(col) {
  const total = col.items.length;
  let have = 0;
  for (const it of col.items) if (it.have) have++;
  const missing = total - have;
  const pct = total ? Math.round((have / total) * 100) : 0;
  return { total, have, missing, pct };
}

/* -----------------------------
   Persistencia
----------------------------- */

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

/* -----------------------------
   Views
----------------------------- */

function setView(view) {
  state.view = view;
  for (const v of els.views)
    v.classList.toggle("is-active", v.dataset.view === view);

  if (view === "home") {
    els.topbarTitle.textContent = "Mis Colecciones";
    els.backBtn.classList.add("hidden");
  } else {
    els.backBtn.classList.remove("hidden");
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function goHome() {
  state.currentId = null;
  renderHome();
  setView("home");
}

function goCreate() {
  resetCreateForm();
  setView("create");
}

function goDetail(id) {
  state.currentId = id;
  renderDetail();
  const col = getCurrent();
  if (col) els.topbarTitle.textContent = col.name;
  setView("detail");
}

/* -----------------------------
   Home (ACTUALIZADO)
----------------------------- */

function renderHome() {
  els.collectionsList.innerHTML = "";

  // ✅ ORDEN NUEVAS ARRIBA (cambio aplicado)
  const cols = [...state.data.collections]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (!cols.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "Todavía no tenés colecciones. Tocá “Nueva”.";
    els.collectionsList.appendChild(empty);
    return;
  }

  for (const c of cols) {
    const st = computeStats(c);

    const row = document.createElement("div");
    row.className = "collection-row";

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.flexDirection = "column";
    left.style.gap = "4px";

    const name = document.createElement("div");
    name.style.fontWeight = "950";
    name.style.fontSize = "16px";
    name.textContent = c.name;

    left.appendChild(name);

    const right = document.createElement("div");
    right.className = "muted small";
    right.style.textAlign = "right";
    right.innerHTML = `Completo <b>${st.pct}%</b><br>Total ${st.total} · Tengo ${st.have}`;

    row.appendChild(left);
    row.appendChild(right);

    row.addEventListener("click", () => goDetail(c.id));
    els.collectionsList.appendChild(row);
  }
}

/* -----------------------------
   Crear colección
----------------------------- */

function resetCreateForm() {
  els.newName.value = "";
  els.simpleCount.value = "100";
  els.simpleSpecials.value = "";
}

function createCollection() {
  const name = (els.newName.value || "").trim();
  if (!name) return alert("Escribí un nombre.");

  let count = parseInt(els.simpleCount.value || "0", 10);
  if (!Number.isFinite(count) || count <= 0) return alert("Cantidad inválida.");

  const sectionId = uid("sec");

  const sections = [{
    id: sectionId,
    name: "General"
  }];

  const items = [];
  for (let i = 1; i <= count; i++) {
    items.push({
      id: uid("it"),
      sectionId,
      label: String(i),
      have: false,
      rep: 0
    });
  }

  state.data.collections.push({
    id: uid("col"),
    name,
    createdAt: Date.now(), // clave para ordenar
    sections,
    items
  });

  save();
  goHome();
}

/* -----------------------------
   Detail
----------------------------- */

function renderDetail() {
  const col = getCurrent();
  if (!col) return goHome();

  els.detailTitle.textContent = col.name;
  els.topbarTitle.textContent = col.name;

  const st = computeStats(col);
  els.stTotal.textContent = st.total;
  els.stHave.textContent = st.have;
  els.stMissing.textContent = st.missing;
  els.stPct.textContent = `${st.pct}%`;
}

/* -----------------------------
   Eventos
----------------------------- */

document.addEventListener("click", (e) => {
  const btn = e.target?.closest?.("[data-action]");
  if (!btn) return;

  const action = btn.getAttribute("data-action");

  if (action === "go-home") return goHome();
  if (action === "go-create") return goCreate();
  if (action === "create-save") return createCollection();
});

els.backBtn?.addEventListener("click", () => goHome());

/* -----------------------------
   Init
----------------------------- */

function init() {
  load();
  renderHome();
  setView("home");
}

document.addEventListener("DOMContentLoaded", init);
