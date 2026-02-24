/* =============================
   Colección Luciano - V2
   - Colecciones simples o con secciones
   - Numeración global o por sección
   - Persistencia en localStorage
============================= */

const LS_KEY = "coleccion_luciano_v2";

const els = {
  backBtn: document.getElementById("backBtn"),
  topbarTitle: document.getElementById("topbarTitle"),

  views: Array.from(document.querySelectorAll("[data-view]")),

  collectionsList: document.getElementById("collectionsList"),

  // Create
  newName: document.getElementById("newName"),
  structRadios: Array.from(document.querySelectorAll('input[name="structType"]')),
  simpleBlock: document.getElementById("simpleBlock"),
  sectionsBlock: document.getElementById("sectionsBlock"),
  simpleCount: document.getElementById("simpleCount"),
  numberMode: document.getElementById("numberMode"),
  sectionsEditor: document.getElementById("sectionsEditor"),
  btnAddSection: document.getElementById("btnAddSection"),

  // Detail
  detailTitle: document.getElementById("detailTitle"),
  stTotal: document.getElementById("stTotal"),
  stHave: document.getElementById("stHave"),
  stMissing: document.getElementById("stMissing"),
  stPct: document.getElementById("stPct"),
  sectionsDetail: document.getElementById("sectionsDetail"),
};

const state = {
  view: "home",     // home | create | detail
  currentId: null,  // id colección
  data: { collections: [] },
};

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
   Helpers
----------------------------- */
function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function getCurrent() {
  if (!state.currentId) return null;
  return state.data.collections.find(c => c.id === state.currentId) || null;
}

function computeStats(col) {
  const all = col.items || [];
  const total = all.length;
  let have = 0;
  let missing = 0;

  for (const it of all) {
    if (it.have) have += 1;
    else missing += 1;
  }

  const pct = total ? Math.round((have / total) * 100) : 0;
  return { total, have, missing, pct };
}

/* -----------------------------
   Navegación
----------------------------- */
function setView(view) {
  state.view = view;

  for (const v of els.views) {
    v.classList.toggle("is-active", v.dataset.view === view);
  }

  if (view === "home") {
    els.topbarTitle.textContent = "Mis Colecciones";
    els.backBtn.classList.add("hidden");
  } else if (view === "create") {
    els.topbarTitle.textContent = "Nueva colección";
    els.backBtn.classList.remove("hidden");
  } else {
    // detail
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
  setView("detail");
  const col = getCurrent();
  if (col) els.topbarTitle.textContent = col.name;
}

/* -----------------------------
   Home render
----------------------------- */
function renderHome() {
  els.collectionsList.innerHTML = "";

  const cols = state.data.collections;

  if (!cols.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "Todavía no tenés colecciones. Tocá “+ Nueva”.";
    els.collectionsList.appendChild(empty);
    return;
  }

  for (const c of cols) {
    const st = computeStats(c);

    const row = document.createElement("button");
    row.type = "button";
    row.className = "collection-row";
    row.style.width = "100%";
    row.style.cursor = "pointer";
    row.setAttribute("data-action", "open-collection");
    row.setAttribute("data-id", c.id);

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.flexDirection = "column";
    left.style.gap = "4px";

    const name = document.createElement("div");
    name.style.fontWeight = "950";
    name.style.fontSize = "18px";
    name.textContent = c.name;

    const meta = document.createElement("div");
    meta.className = "muted small";
    meta.textContent = c.structure === "sections"
      ? `Con secciones · ${c.numberMode === "global" ? "Num global" : "Num por sección"}`
      : "Simple";

    left.appendChild(name);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.className = "muted small";
    right.style.textAlign = "right";
    right.innerHTML = `Completo <b>${st.pct}%</b><br>Total ${st.total} · Tengo ${st.have}`;

    row.appendChild(left);
    row.appendChild(right);

    els.collectionsList.appendChild(row);
  }
}

/* -----------------------------
   Create form (V2)
----------------------------- */
function getStructType() {
  const r = els.structRadios.find(x => x.checked);
  return r ? r.value : "simple";
}

function resetCreateForm() {
  if (els.newName) els.newName.value = "";
  if (els.simpleCount) els.simpleCount.value = "100";
  if (els.numberMode) els.numberMode.value = "global";

  // default: simple
  els.structRadios.forEach(r => r.checked = (r.value === "simple"));
  syncCreateBlocks();

  // secciones: 2 por defecto
  if (els.sectionsEditor) {
    els.sectionsEditor.innerHTML = "";
    addSectionRow("Sección 1", 50);
    addSectionRow("Sección 2", 50);
  }
}

function syncCreateBlocks() {
  const t = getStructType();
  if (!els.simpleBlock || !els.sectionsBlock) return;

  if (t === "simple") {
    els.simpleBlock.style.display = "block";
    els.sectionsBlock.style.display = "none";
  } else {
    els.simpleBlock.style.display = "none";
    els.sectionsBlock.style.display = "block";
  }
}

els.structRadios.forEach(r => {
  r.addEventListener("change", syncCreateBlocks);
});

function addSectionRow(name = "", count = 10) {
  const row = document.createElement("div");
  row.className = "section-row";
  row.setAttribute("data-section-row", "1");

  const inName = document.createElement("input");
  inName.className = "input";
  inName.type = "text";
  inName.placeholder = "Nombre (Ej: Argentina / Arsenal / etc)";
  inName.value = name;

  const inCount = document.createElement("input");
  inCount.className = "input";
  inCount.type = "number";
  inCount.min = "1";
  inCount.max = "5000";
  inCount.value = String(count);

  const del = document.createElement("button");
  del.type = "button";
  del.className = "icon-danger";
  del.textContent = "✕";
  del.addEventListener("click", () => {
    row.remove();
  });

  row.appendChild(inName);
  row.appendChild(inCount);
  row.appendChild(del);

  els.sectionsEditor.appendChild(row);
}

els.btnAddSection?.addEventListener("click", () => {
  addSectionRow(`Sección ${els.sectionsEditor.querySelectorAll("[data-section-row]").length + 1}`, 10);
});

function readSectionsFromEditor() {
  const rows = Array.from(els.sectionsEditor.querySelectorAll("[data-section-row]"));
  const out = [];

  for (const r of rows) {
    const inputs = r.querySelectorAll("input");
    const name = (inputs[0]?.value || "").trim();
    const count = parseInt(inputs[1]?.value || "0", 10);

    if (!name) return { ok:false, error:"Hay una sección sin nombre." };
    if (!Number.isFinite(count) || count <= 0) return { ok:false, error:`Cantidad inválida en "${name}".` };

    out.push({ name, count: clamp(count, 1, 5000) });
  }

  if (!out.length) return { ok:false, error:"Agregá al menos 1 sección." };

  return { ok:true, sections: out };
}

function createCollection() {
  const name = (els.newName?.value || "").trim();
  if (!name) return alert("Escribí un nombre.");

  const structure = getStructType();

  if (structure === "simple") {
    let count = parseInt(els.simpleCount?.value || "0", 10);
    if (!Number.isFinite(count) || count <= 0) return alert("Cantidad inválida.");
    count = clamp(count, 1, 5000);

    const sectionId = uid("sec");
    const sections = [{ id: sectionId, name: "General" }];

    const items = [];
    for (let i = 1; i <= count; i++) {
      items.push({
        id: uid("it"),
        sectionId,
        label: String(i),
        have: false,
        rep: 0,
        globalNo: i
      });
    }

    const col = {
      id: uid("col"),
      name,
      createdAt: Date.now(),
      structure: "simple",
      numberMode: "global",
      sections,
      items
    };

    state.data.collections.push(col);
    save();
    renderHome();
    goHome();
    return;
  }

  // structure === "sections"
  const numberMode = els.numberMode?.value === "perSection" ? "perSection" : "global";

  const read = readSectionsFromEditor();
  if (!read.ok) return alert(read.error);

  const sections = read.sections.map(s => ({
    id: uid("sec"),
    name: s.name,
    count: s.count
  }));

  const items = [];
  let globalCounter = 1;

  for (const sec of sections) {
    for (let i = 1; i <= sec.count; i++) {
      const label = (numberMode === "global") ? String(globalCounter) : String(i);

      items.push({
        id: uid("it"),
        sectionId: sec.id,
        label,
        have: false,
        rep: 0,
        globalNo: (numberMode === "global") ? globalCounter : null,
        localNo: (numberMode === "perSection") ? i : null
      });

      if (numberMode === "global") globalCounter += 1;
    }
  }

  const col = {
    id: uid("col"),
    name,
    createdAt: Date.now(),
    structure: "sections",
    numberMode,
    sections: sections.map(s => ({ id: s.id, name: s.name })),
    items
  };

  state.data.collections.push(col);
  save();
  renderHome();
  goHome();
}

/* -----------------------------
   Detail render (por secciones)
----------------------------- */
function renderDetail() {
  const col = getCurrent();
  if (!col) return goHome();

  els.detailTitle.textContent = col.name;
  els.topbarTitle.textContent = col.name;

  const st = computeStats(col);
  els.stTotal.textContent = String(st.total);
  els.stHave.textContent = String(st.have);
  els.stMissing.textContent = String(st.missing);
  els.stPct.textContent = `${st.pct}%`;

  els.sectionsDetail.innerHTML = "";

  // agrupamos items por sección
  const bySec = new Map();
  for (const sec of col.sections) bySec.set(sec.id, []);
  for (const it of col.items) {
    if (!bySec.has(it.sectionId)) bySec.set(it.sectionId, []);
    bySec.get(it.sectionId).push(it);
  }

  for (const sec of col.sections) {
    const card = document.createElement("div");
    card.className = "section-card";

    const title = document.createElement("div");
    title.className = "section-title";
    title.textContent = sec.name;

    const grid = document.createElement("div");
    grid.className = "items-grid";

    const items = bySec.get(sec.id) || [];
    for (const it of items) {
      const cell = buildItemCell(col, it);
      grid.appendChild(cell);
    }

    card.appendChild(title);
    card.appendChild(grid);
    els.sectionsDetail.appendChild(card);
  }
}

function buildItemCell(col, it) {
  const wrap = document.createElement("div");
  wrap.className = "item" + (it.have ? " have" : "");
  wrap.setAttribute("data-item-id", it.id);

  const code = document.createElement("div");
  code.className = "item-code";
  code.textContent = it.label;

  const rep = document.createElement("div");
  rep.className = "item-rep";
  rep.textContent = `Rep: ${it.rep || 0}`;

  wrap.addEventListener("click", (e) => {
    if (e.target && e.target.closest && e.target.closest("button")) return;

    it.have = !it.have;
    if (!it.have) it.rep = 0;

    save();
    renderDetail();
  });

  const actions = document.createElement("div");
  actions.className = "item-actions";

  const minus = document.createElement("button");
  minus.type = "button";
  minus.className = "mini";
  minus.textContent = "−";
  minus.addEventListener("click", (e) => {
    e.stopPropagation();
    it.rep = clamp((it.rep || 0) - 1, 0, 999);
    save();
    renderDetail();
  });

  const plus = document.createElement("button");
  plus.type = "button";
  plus.className = "mini";
  plus.textContent = "+";
  plus.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!it.have) {
      alert("Primero marcá este ítem como 'Tengo' tocándolo.");
      return;
    }
    it.rep = clamp((it.rep || 0) + 1, 0, 999);
    save();
    renderDetail();
  });

  actions.appendChild(minus);
  actions.appendChild(plus);

  wrap.appendChild(code);
  wrap.appendChild(rep);
  wrap.appendChild(actions);

  return wrap;
}

/* -----------------------------
   Reset colección
----------------------------- */
function resetCollection() {
  const col = getCurrent();
  if (!col) return;

  const ok = confirm(`Resetear "${col.name}"?\n\nSe borran Tengo y Rep de todos los ítems.`);
  if (!ok) return;

  for (const it of col.items) {
    it.have = false;
    it.rep = 0;
  }

  save();
  renderDetail();
}

/* -----------------------------
   Eventos globales
----------------------------- */
document.addEventListener("click", (e) => {
  const btn = e.target?.closest?.("[data-action]");
  if (!btn) return;

  const action = btn.getAttribute("data-action");

  if (action === "go-create") return goCreate();
  if (action === "create-cancel") return goHome();
  if (action === "create-save") return createCollection();

  if (action === "open-collection") {
    const id = btn.getAttribute("data-id");
    if (id) return goDetail(id);
  }

  if (action === "reset-collection") return resetCollection();
});

els.backBtn?.addEventListener("click", () => {
  goHome();
});

/* -----------------------------
   Init
----------------------------- */
function init() {
  load();
  renderHome();
  setView("home");
  resetCreateForm();
}

document.addEventListener("DOMContentLoaded", init);
