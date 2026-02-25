/* =============================
   Colección Luciano - Arquitectura estable (v2.3 + patches)
   - Tap: si no tengo -> marco tengo
          si tengo -> suma repetida (rep++)
   - Long press: si rep>0 -> rep--
                 si rep==0 y tengo -> confirma y desmarca (have=false)
   - Backup: REEMPLAZAR
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

  // Dash / pickers (si existen en tu index actual)
  collectionsSelect: $("collectionsSelect"),
  btnOpenCollection: $("btnOpenCollection"),
  editPicker: $("editPicker"),
  editSelect: $("editSelect"),
  btnEditOpen: $("btnEditOpen"),

  // Create
  newName: $("newName"),
  structRadios: Array.from(document.querySelectorAll('input[name="structType"]')),
  simpleBlock: $("simpleBlock"),
  sectionsBlock: $("sectionsBlock"),
  simpleCount: $("simpleCount"),
  simpleSpecials: $("simpleSpecials"),
  numberMode: $("numberMode"),
  sectionsEditor: $("sectionsEditor"),
  btnAddSection: $("btnAddSection"),

  // Detail
  detailTitle: $("detailTitle"),
  stTotal: $("stTotal"),
  stHave: $("stHave"),
  stMissing: $("stMissing"),
  stPct: $("stPct"),
  sectionsDetail: $("sectionsDetail"),

  // Filters (si existen)
  fAll: $("fAll"),
  fHave: $("fHave"),
  fMiss: $("fMiss"),

  // Edit
  editTitle: $("editTitle"),
  editName: $("editName"),
  editSectionsArea: $("editSectionsArea"),
  editAddSection: $("editAddSection"),
  editSectionsEditor: $("editSectionsEditor"),

  // Settings
  importInput: $("importInput"),
  exportMeta: $("exportMeta"),
  importMeta: $("importMeta"),
  storageMeta: $("storageMeta"),
};

const state = {
  view: "dash",
  currentId: null,
  data: { collections: [] },
  meta: {
    lastExportAt: null,
    lastExportSize: null,
    lastImportAt: null,
    lastImportMode: "replace",
  },
  // filtro dentro de una colección (si tu UI lo usa)
  filter: "all", // all | have | miss
};

/* -----------------------------
   Helpers
----------------------------- */
function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function formatDateTime(ts) {
  if (!ts) return "—";
  try { return new Date(ts).toLocaleString(); } catch { return "—"; }
}
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const u = ["B","KB","MB","GB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < u.length - 1) { n/=1024; i++; }
  return `${n.toFixed(i===0?0:1)} ${u[i]}`;
}

function normalizePrefix(p) {
  return String(p || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function parseCodesList(input) {
  return String(input || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}
function parsePrefixList(input) {
  return String(input || "")
    .split(/[,;\n\r]+/g)
    .map(s => normalizePrefix(s))
    .filter(Boolean);
}
function normCode(s) {
  return String(s || "").trim().toUpperCase();
}

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

  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) || "{}");
    state.meta = { ...state.meta, ...m };
  } catch {}

  // migración suave
  for (const c of state.data.collections) {
    if (!c.sections) c.sections = [];
    if (!c.items) c.items = [];
    if (!c.structure) c.structure = "simple";
    if (!c.numberMode) c.numberMode = "global";

    if (c.structure === "sections") {
      for (const s of c.sections) {
        if (!s.format) s.format = "num";
        if (typeof s.prefix !== "string") s.prefix = "";
        if (typeof s.ownNumbering !== "boolean") s.ownNumbering = false;
        if (!Array.isArray(s.specials)) s.specials = [];
      }
    } else {
      if (!c.sections.length) {
        c.sections = [{ id: c.sections?.[0]?.id || uid("sec"), name: "General", format: "num", prefix: "", ownNumbering: false, specials: [] }];
      }
      if (!Array.isArray(c.sections[0].specials)) c.sections[0].specials = [];
    }

    for (const it of c.items) {
      if (typeof it.special !== "boolean") it.special = false;
      if (!it.key) it.key = `${it.sectionId}|${it.label}`;
      if (typeof it.have !== "boolean") it.have = false;
      if (!Number.isFinite(it.rep)) it.rep = 0;
    }
  }
}

function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(state.data));
  localStorage.setItem(META_KEY, JSON.stringify(state.meta));
}

/* -----------------------------
   Views
----------------------------- */
function setView(view) {
  state.view = view;
  for (const v of els.views) v.classList.toggle("is-active", v.dataset.view === view);

  // título + back
  if (view === "dash") {
    els.topbarTitle && (els.topbarTitle.textContent = "Colecciones Lucho");
    els.backBtn?.classList.add("hidden");
  } else if (view === "collections") {
    els.topbarTitle && (els.topbarTitle.textContent = "Mis colecciones");
    els.backBtn?.classList.remove("hidden");
  } else if (view === "loadedit") {
    els.topbarTitle && (els.topbarTitle.textContent = "Carga / Edición");
    els.backBtn?.classList.remove("hidden");
  } else if (view === "create") {
    els.topbarTitle && (els.topbarTitle.textContent = "Nueva colección");
    els.backBtn?.classList.remove("hidden");
  } else if (view === "settings") {
    els.topbarTitle && (els.topbarTitle.textContent = "Ajustes");
    els.backBtn?.classList.remove("hidden");
  } else if (view === "edit") {
    els.topbarTitle && (els.topbarTitle.textContent = "Editar");
    els.backBtn?.classList.remove("hidden");
  } else if (view === "detail") {
    els.backBtn?.classList.remove("hidden");
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function goDash() {
  state.currentId = null;
  setView("dash");
  // refrescos
  renderCollectionsSelects?.();
}
function goCollections() {
  renderCollectionsSelects();
  setView("collections");
}
function goLoadEdit() {
  renderCollectionsSelects();
  // oculto picker si existe
  if (els.editPicker) els.editPicker.classList.add("hidden");
  setView("loadedit");
}
function goCreate() {
  resetCreateForm();
  ensureBulkBuilderUI();
  setView("create");
}
function goDetail(id) {
  state.currentId = id;
  state.filter = "all";
  renderDetail();
  const col = getCurrent();
  if (col && els.topbarTitle) els.topbarTitle.textContent = col.name;
  setView("detail");
}
function goSettings() {
  renderSettings();
  setView("settings");
}
function goEdit() {
  renderEdit();
  setView("edit");
}

/* -----------------------------
   “Mis colecciones” selector
----------------------------- */
function renderCollectionsSelects() {
  const cols = state.data.collections;

  const fill = (sel) => {
    if (!sel) return;
    sel.innerHTML = "";
    if (!cols.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "(Sin colecciones)";
      sel.appendChild(opt);
      return;
    }
    for (const c of cols) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      sel.appendChild(opt);
    }
  };

  fill(els.collectionsSelect);
  fill(els.editSelect);
}

/* -----------------------------
   Create UI
----------------------------- */
function getStructType() {
  const r = els.structRadios.find(x => x.checked);
  return r ? r.value : "simple";
}

function syncCreateBlocks() {
  const t = getStructType();
  if (t === "simple") {
    els.simpleBlock && (els.simpleBlock.style.display = "block");
    els.sectionsBlock && (els.sectionsBlock.style.display = "none");
  } else {
    els.simpleBlock && (els.simpleBlock.style.display = "none");
    els.sectionsBlock && (els.sectionsBlock.style.display = "block");
    ensureBulkBuilderUI();
  }
}
els.structRadios.forEach(r => r.addEventListener("change", syncCreateBlocks));

function resetCreateForm() {
  if (els.newName) els.newName.value = "";
  if (els.simpleCount) els.simpleCount.value = "100";
  if (els.simpleSpecials) els.simpleSpecials.value = "";
  if (els.numberMode) els.numberMode.value = "global";
  els.structRadios.forEach(r => r.checked = (r.value === "simple"));
  syncCreateBlocks();

  if (els.sectionsEditor) {
    els.sectionsEditor.innerHTML = "";
    addSectionRow(els.sectionsEditor, { name:"Equipo A", format:"alfa", prefix:"RIA", count:20, ownNumbering:true, specials:[] });
    addSectionRow(els.sectionsEditor, { name:"Equipo B", format:"alfa", prefix:"BAE", count:20, ownNumbering:true, specials:[] });
    addSectionRow(els.sectionsEditor, { name:"Especiales", format:"num", prefix:"", count:10, ownNumbering:true, specials:[] });
    enableDnD(els.sectionsEditor);
  }
}

/* -----------------------------
   Generador rápido por lista (coma)
----------------------------- */
function ensureBulkBuilderUI() {
  if (!els.sectionsBlock || !els.sectionsEditor) return;
  if ($("bulkBuilder")) return;

  const wrap = document.createElement("div");
  wrap.id = "bulkBuilder";
  wrap.className = "card";
  wrap.style.marginBottom = "14px";

  wrap.innerHTML = `
    <div class="h2" style="margin-bottom:10px;">Generador rápido por lista (con coma)</div>
    <div class="muted small" style="margin-bottom:10px;">
      Pegá prefijos separados por coma. Ej: RIA, BAE, ATL
    </div>

    <div class="field">
      <label>Prefijos (con coma)</label>
      <textarea id="bulkPrefixes" class="input" rows="3" placeholder="RIA, BAE, ATL"></textarea>
    </div>

    <div class="field">
      <label>Cantidad por equipo</label>
      <input id="bulkCount" class="input" type="number" min="1" max="5000" value="20" />
    </div>

    <label class="inline-check" style="margin-top:8px;">
      <input id="bulkAddSpecialSection" type="checkbox" checked />
      <span>Agregar sección “Especiales” (numérica con numeración propia)</span>
    </label>

    <div class="field" style="margin-top:10px;">
      <label>Cantidad en “Especiales”</label>
      <input id="bulkSpecialCount" class="input" type="number" min="1" max="5000" value="10" />
    </div>

    <div class="row gap" style="margin-top:12px;">
      <button id="btnBulkGenerate" class="btn primary" type="button">Generar secciones</button>
      <button id="btnBulkClear" class="btn" type="button">Limpiar lista</button>
    </div>

    <div class="muted small" style="margin-top:10px;">
      Nota: esto reemplaza todas las secciones actuales del editor.
    </div>
  `;

  els.sectionsBlock.insertBefore(wrap, els.sectionsEditor);

  const bulkPrefixes = $("bulkPrefixes");
  const bulkCount = $("bulkCount");
  const bulkAddSpecialSection = $("bulkAddSpecialSection");
  const bulkSpecialCount = $("bulkSpecialCount");
  const btnBulkGenerate = $("btnBulkGenerate");
  const btnBulkClear = $("btnBulkClear");

  btnBulkClear?.addEventListener("click", () => {
    if (bulkPrefixes) bulkPrefixes.value = "";
    bulkPrefixes?.focus();
  });

  btnBulkGenerate?.addEventListener("click", () => {
    const list = parsePrefixList(bulkPrefixes?.value || "");
    if (!list.length) return alert("Pegá al menos 1 prefijo (separados por coma).");

    let perTeam = parseInt(bulkCount?.value || "0", 10);
    if (!Number.isFinite(perTeam) || perTeam <= 0) return alert("Cantidad por equipo inválida.");
    perTeam = clamp(perTeam, 1, 5000);

    let specialsN = parseInt(bulkSpecialCount?.value || "0", 10);
    if (!Number.isFinite(specialsN) || specialsN <= 0) specialsN = 10;
    specialsN = clamp(specialsN, 1, 5000);

    els.sectionsEditor.innerHTML = "";

    for (const pref of list) {
      addSectionRow(els.sectionsEditor, {
        name: pref,
        format: "alfa",
        prefix: pref,
        count: perTeam,
        ownNumbering: true,
        specials: []
      });
    }

    if (bulkAddSpecialSection?.checked) {
      addSectionRow(els.sectionsEditor, {
        name: "Especiales",
        format: "num",
        prefix: "",
        count: specialsN,
        ownNumbering: true,
        specials: []
      });
    }

    enableDnD(els.sectionsEditor);
    alert("Secciones generadas ✅");
  });
}

/* -----------------------------
   Especiales prompt
----------------------------- */
function openSpecialsPrompt(currentArr, hint) {
  const current = (currentArr || []).join(", ");
  const txt = prompt(
    `Especiales (lista separada por coma)\n${hint}\n\nEj: 7, 10, 55  o  RIA1, RIA7\n\nActual:\n${current}`,
    current
  );
  if (txt === null) return null;
  const list = parseCodesList(txt).map(normCode);
  return Array.from(new Set(list));
}

/* -----------------------------
   Reordenar filas
----------------------------- */
function moveRow(container, row, dir) {
  const rows = Array.from(container.querySelectorAll("[data-section-row]"));
  const idx = rows.indexOf(row);
  if (idx < 0) return;

  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= rows.length) return;

  const ref = rows[newIdx];
  if (dir === -1) container.insertBefore(row, ref);
  else container.insertBefore(ref, row);
}

function getSectionRowValues(row) {
  const inputs = row.querySelectorAll("input, select");
  const name = (inputs[0]?.value || "").trim();
  const format = (inputs[1]?.value === "alfa") ? "alfa" : "num";
  const prefix = normalizePrefix(inputs[2]?.value || "");
  const count = parseInt(inputs[3]?.value || "0", 10);
  const ownNumbering = !!inputs[4]?.checked;

  let specials = [];
  try { specials = JSON.parse(row.dataset.specials || "[]"); } catch { specials = []; }
  specials = (Array.isArray(specials) ? specials : []).map(normCode);

  return { name, format, prefix, count: Number.isFinite(count) ? count : 1, ownNumbering, specials };
}

/* -----------------------------
   Secciones: fila
----------------------------- */
function addSectionRow(container, { name="", format="num", prefix="", count=10, ownNumbering=false, specials=[] } = {}) {
  const row = document.createElement("div");
  row.className = "section-row";
  row.setAttribute("data-section-row", "1");
  row.dataset.specials = JSON.stringify(Array.isArray(specials) ? specials : []);

  row.draggable = true;
  row.style.cursor = "grab";
  row.addEventListener("dragstart", () => {
    row.classList.add("dragging");
    row.style.opacity = "0.6";
  });
  row.addEventListener("dragend", () => {
    row.classList.remove("dragging");
    row.style.opacity = "";
  });

  const inName = document.createElement("input");
  inName.className = "input";
  inName.type = "text";
  inName.placeholder = "Nombre";
  inName.value = name;

  const selFormat = document.createElement("select");
  selFormat.className = "input";
  selFormat.innerHTML = `
    <option value="num">Numérico</option>
    <option value="alfa">Alfanumérico</option>
  `;
  selFormat.value = (format === "alfa") ? "alfa" : "num";

  const inPrefix = document.createElement("input");
  inPrefix.className = "input";
  inPrefix.type = "text";
  inPrefix.placeholder = "Prefijo";
  inPrefix.value = prefix;

  const inCount = document.createElement("input");
  inCount.className = "input";
  inCount.type = "number";
  inCount.min = "1";
  inCount.max = "5000";
  inCount.value = String(count);

  const ownWrap = document.createElement("label");
  ownWrap.className = "inline-check";
  const ownChk = document.createElement("input");
  ownChk.type = "checkbox";
  ownChk.checked = !!ownNumbering;
  const ownTxt = document.createElement("span");
  ownTxt.textContent = "Numeración propia";
  ownWrap.appendChild(ownChk);
  ownWrap.appendChild(ownTxt);

  const actions = document.createElement("div");
  actions.className = "actions";
  actions.style.gap = "6px";

  const upBtn = document.createElement("button");
  upBtn.type = "button";
  upBtn.className = "icon-lite";
  upBtn.title = "Subir sección";
  upBtn.textContent = "↑";
  upBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    moveRow(container, row, -1);
  });

  const downBtn = document.createElement("button");
  downBtn.type = "button";
  downBtn.className = "icon-lite";
  downBtn.title = "Bajar sección";
  downBtn.textContent = "↓";
  downBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    moveRow(container, row, +1);
  });

  const starBtn = document.createElement("button");
  starBtn.type = "button";
  starBtn.className = "icon-lite";
  starBtn.title = "Editar especiales";
  starBtn.textContent = "⭐";

  const dupBtn = document.createElement("button");
  dupBtn.type = "button";
  dupBtn.className = "icon-lite";
  dupBtn.title = "Duplicar sección";
  dupBtn.textContent = "⎘";

  const del = document.createElement("button");
  del.type = "button";
  del.className = "icon-danger";
  del.title = "Eliminar sección";
  del.textContent = "✕";

  actions.appendChild(upBtn);
  actions.appendChild(downBtn);
  actions.appendChild(starBtn);
  actions.appendChild(dupBtn);
  actions.appendChild(del);

  const syncRow = () => {
    const isAlfa = selFormat.value === "alfa";
    inPrefix.style.display = isAlfa ? "block" : "none";
    ownWrap.style.opacity = isAlfa ? "0.5" : "1";
    ownChk.disabled = isAlfa;
    if (isAlfa) ownChk.checked = true;
    if (isAlfa) inPrefix.value = normalizePrefix(inPrefix.value);
  };

  selFormat.addEventListener("change", syncRow);
  inPrefix.addEventListener("input", () => { inPrefix.value = normalizePrefix(inPrefix.value); });

  starBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const secName = (inName.value || "Sección").trim();
    const isAlfa = selFormat.value === "alfa";
    const pref = isAlfa ? normalizePrefix(inPrefix.value) : "";
    const hint = isAlfa
      ? `Sección "${secName}" (Alfa) · Prefijo: ${pref || "(sin prefijo)"}`
      : `Sección "${secName}" (Numérica)`;

    let current = [];
    try { current = JSON.parse(row.dataset.specials || "[]"); } catch { current = []; }

    const next = openSpecialsPrompt(current, hint);
    if (next === null) return;

    row.dataset.specials = JSON.stringify(next);
  });

  dupBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const v = getSectionRowValues(row);
    const copy = { ...v, name: v.name ? `${v.name} (copia)` : "Sección (copia)" };
    const newRow = addSectionRow(container, copy);
    container.insertBefore(newRow, row.nextSibling);
    enableDnD(container);
    window.scrollTo({ top: window.scrollY + 80, behavior: "smooth" });
  });

  del.addEventListener("click", (e) => {
    e.stopPropagation();
    row.remove();
  });

  row.appendChild(inName);
  row.appendChild(selFormat);
  row.appendChild(inPrefix);
  row.appendChild(inCount);
  row.appendChild(ownWrap);
  row.appendChild(actions);

  container.appendChild(row);
  syncRow();

  return row;
}

/* -----------------------------
   Drag & Drop
----------------------------- */
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll("[data-section-row]:not(.dragging)")];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - (box.top + box.height / 2);
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

function enableDnD(container) {
  if (!container) return;
  if (container.dataset.dndEnabled === "1") return;
  container.dataset.dndEnabled = "1";

  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragging = container.querySelector(".dragging");
    if (!dragging) return;

    const afterElement = getDragAfterElement(container, e.clientY);
    if (afterElement == null) container.appendChild(dragging);
    else container.insertBefore(dragging, afterElement);
  });

  container.addEventListener("mousedown", (e) => {
    const row = e.target.closest?.("[data-section-row]");
    if (!row) return;
    if (e.target.closest("button, input, select, textarea, label")) {
      row.draggable = false;
      setTimeout(() => { row.draggable = true; }, 0);
    }
  });
}

/* -----------------------------
   Leer secciones
----------------------------- */
function readSections(container) {
  const rows = Array.from(container.querySelectorAll("[data-section-row]"));
  const out = [];

  for (const r of rows) {
    const inputs = r.querySelectorAll("input, select");
    const name = (inputs[0]?.value || "").trim();
    const format = (inputs[1]?.value === "alfa") ? "alfa" : "num";
    const prefix = normalizePrefix(inputs[2]?.value || "");
    const count = parseInt(inputs[3]?.value || "0", 10);
    const ownNumbering = !!inputs[4]?.checked;

    let specials = [];
    try { specials = JSON.parse(r.dataset.specials || "[]"); } catch { specials = []; }
    specials = (Array.isArray(specials) ? specials : []).map(normCode);

    if (!name) return { ok:false, error:"Hay una sección sin nombre." };
    if (!Number.isFinite(count) || count <= 0) return { ok:false, error:`Cantidad inválida en "${name}".` };
    if (format === "alfa" && !prefix) return { ok:false, error:`La sección "${name}" es alfanumérica pero no tiene prefijo.` };

    out.push({
      name,
      format,
      prefix,
      count: clamp(count, 1, 5000),
      ownNumbering: (format === "alfa") ? true : !!ownNumbering,
      specials
    });
  }

  if (!out.length) return { ok:false, error:"Agregá al menos 1 sección." };
  return { ok:true, sections: out, rows };
}

/* -----------------------------
   Create - botones
----------------------------- */
els.btnAddSection?.addEventListener("click", () => {
  addSectionRow(els.sectionsEditor, {
    name: `Sección ${els.sectionsEditor.querySelectorAll("[data-section-row]").length + 1}`,
    format: "num",
    prefix: "",
    count: 10,
    ownNumbering: false,
    specials: []
  });
  enableDnD(els.sectionsEditor);
});

/* -----------------------------
   Crear colección
----------------------------- */
function createCollection() {
  const name = (els.newName?.value || "").trim();
  if (!name) return alert("Escribí un nombre.");

  const structure = getStructType();

  const insertAtTop = (colObj) => {
    // ✅ nueva colección arriba
    state.data.collections.unshift(colObj);
  };

  if (structure === "simple") {
    let count = parseInt(els.simpleCount?.value || "0", 10);
    if (!Number.isFinite(count) || count <= 0) return alert("Cantidad inválida.");
    count = clamp(count, 1, 5000);

    const sectionId = uid("sec");
    const specials = parseCodesList(els.simpleSpecials?.value || "").map(normCode);
    const specialsSet = new Set(specials);

    const sections = [{
      id: sectionId,
      name: "General",
      format: "num",
      prefix: "",
      ownNumbering: false,
      specials
    }];

    const items = [];
    for (let i = 1; i <= count; i++) {
      const label = String(i);
      items.push({
        id: uid("it"),
        sectionId,
        label,
        have: false,
        rep: 0,
        special: specialsSet.has(normCode(label)),
        key: `num:${i}`
      });
    }

    insertAtTop({
      id: uid("col"),
      name,
      createdAt: Date.now(),
      structure: "simple",
      numberMode: "global",
      sections,
      items
    });

    save();
    renderCollectionsSelects();
    goCollections();
    return;
  }

  const numberMode = (els.numberMode?.value === "perSection") ? "perSection" : "global";
  const read = readSections(els.sectionsEditor);
  if (!read.ok) return alert(read.error);

  const sections = read.sections.map(s => ({
    id: uid("sec"),
    name: s.name,
    format: s.format,
    prefix: s.prefix,
    ownNumbering: !!s.ownNumbering,
    specials: s.specials
  }));

  const items = [];
  let globalCounter = 1;

  for (let idx = 0; idx < sections.length; idx++) {
    const sec = sections[idx];
    const sDef = read.sections[idx];
    const count = sDef.count;
    const specialsSet = new Set((sec.specials || []).map(normCode));

    if (sec.format === "alfa") {
      for (let i = 1; i <= count; i++) {
        const label = `${sec.prefix}${i}`;
        const key = `alfa:${sec.prefix}:${i}`;
        items.push({
          id: uid("it"),
          sectionId: sec.id,
          label,
          have: false,
          rep: 0,
          special: specialsSet.has(normCode(label)),
          key
        });
      }
      continue;
    }

    const sectionIsLocal = (numberMode === "perSection") || sec.ownNumbering;

    for (let i = 1; i <= count; i++) {
      const n = sectionIsLocal ? i : globalCounter;
      const label = String(n);
      const key = sectionIsLocal ? `numLocal:${sec.id}:${i}` : `numGlobal:${globalCounter}`;

      items.push({
        id: uid("it"),
        sectionId: sec.id,
        label,
        have: false,
        rep: 0,
        special: specialsSet.has(normCode(label)),
        key
      });

      if (!sectionIsLocal) globalCounter += 1;
    }
  }

  insertAtTop({
    id: uid("col"),
    name,
    createdAt: Date.now(),
    structure: "sections",
    numberMode,
    sections,
    items
  });

  save();
  renderCollectionsSelects();
  goCollections();
}

/* -----------------------------
   Detail
----------------------------- */
function renderDetail() {
  const col = getCurrent();
  if (!col) return goCollections();

  els.detailTitle && (els.detailTitle.textContent = col.name);
  els.topbarTitle && (els.topbarTitle.textContent = col.name);

  const st = computeStats(col);
  els.stTotal && (els.stTotal.textContent = String(st.total));
  els.stHave && (els.stHave.textContent = String(st.have));
  els.stMissing && (els.stMissing.textContent = String(st.missing));
  els.stPct && (els.stPct.textContent = `${st.pct}%`);

  if (!els.sectionsDetail) return;
  els.sectionsDetail.innerHTML = "";

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

    // filtro
    const visibleItems = items.filter(it => {
      if (state.filter === "have") return !!it.have;
      if (state.filter === "miss") return !it.have;
      return true;
    });

    for (const it of visibleItems) grid.appendChild(buildItemCell(it));

    card.appendChild(title);
    card.appendChild(grid);
    els.sectionsDetail.appendChild(card);
  }

  // UI de filtros si existen
  if (els.fAll && els.fHave && els.fMiss) {
    els.fAll.classList.toggle("is-active", state.filter === "all");
    els.fHave.classList.toggle("is-active", state.filter === "have");
    els.fMiss.classList.toggle("is-active", state.filter === "miss");
  }
}

/* -----------------------------
   ✅ ITEM: Tap / Long-press (FIX incluido)
----------------------------- */
function buildItemCell(it) {
  const wrap = document.createElement("div");
  wrap.className = "item" + (it.have ? " have" : "") + (it.special ? " special" : "");

  const code = document.createElement("div");
  code.className = "item-code";
  code.textContent = it.label;

  const rep = document.createElement("div");
  rep.className = "item-rep";
  rep.textContent = `Rep: ${it.rep || 0}`;

  // Long-press setup
  let pressTimer = null;
  let longPressed = false;

  const clearPress = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  const doLongPress = () => {
    longPressed = true;

    // 1) Si tiene repetidas, resto una
    if ((it.rep || 0) > 0) {
      it.rep = clamp((it.rep || 0) - 1, 0, 999);
      save();
      renderDetail();
      return;
    }

    // 2) Si NO tiene repetidas pero está marcada como tengo => confirmo y desmarco
    if (it.have) {
      const ok = confirm("⚠️ Estás a punto de quitar una figurita NO repetida.\n\n¿Querés desmarcarla igualmente?");
      if (!ok) return;

      // ✅ FIX: desmarcar de verdad
      it.have = false;
      it.rep = 0;
      save();
      renderDetail();
    }
  };

  // START: tocás
  const onPressStart = (e) => {
    longPressed = false;
    clearPress();
    pressTimer = setTimeout(doLongPress, 520);
  };

  // END: levantás
  const onPressEnd = () => {
    // si fue long press, no ejecuto tap normal
    if (pressTimer) clearPress();
  };

  // Tap normal
  const onTap = () => {
    if (longPressed) return;

    // Tap: si no tengo -> marco tengo
    if (!it.have) {
      it.have = true;
      it.rep = 0;
      save();
      renderDetail();
      return;
    }

    // Tap: si ya tengo -> suma repetida
    it.rep = clamp((it.rep || 0) + 1, 0, 999);
    save();
    renderDetail();
  };

  // Pointer/touch/mouse (robusto)
  wrap.addEventListener("touchstart", onPressStart, { passive: true });
  wrap.addEventListener("touchend", (e) => { onPressEnd(); onTap(); });
  wrap.addEventListener("touchcancel", onPressEnd);

  wrap.addEventListener("mousedown", onPressStart);
  wrap.addEventListener("mouseup", () => { onPressEnd(); onTap(); });
  wrap.addEventListener("mouseleave", onPressEnd);

  wrap.appendChild(code);
  wrap.appendChild(rep);

  return wrap;
}

function resetCollection() {
  const col = getCurrent();
  if (!col) return;
  const ok = confirm(`Resetear "${col.name}"?\n\nSe borran Tengo y Rep de todos los ítems.`);
  if (!ok) return;
  for (const it of col.items) { it.have = false; it.rep = 0; }
  save();
  renderDetail();
}

/* -----------------------------
   Edit
----------------------------- */
function renderEdit() {
  const col = getCurrent();
  if (!col) return goCollections();

  els.editTitle && (els.editTitle.textContent = `Editar: ${col.name}`);
  els.editName && (els.editName.value = col.name);

  const isSections = col.structure === "sections";
  if (els.editSectionsArea) els.editSectionsArea.style.display = isSections ? "block" : "none";
  if (!els.editSectionsEditor) return;
  els.editSectionsEditor.innerHTML = "";

  if (isSections) {
    for (const sec of col.sections) {
      const count = col.items.filter(it => it.sectionId === sec.id).length;
      const row = addSectionRow(els.editSectionsEditor, {
        name: sec.name,
        format: sec.format || "num",
        prefix: sec.prefix || "",
        count,
        ownNumbering: !!sec.ownNumbering,
        specials: Array.isArray(sec.specials) ? sec.specials : []
      });
      row.dataset.secId = sec.id;
    }
    enableDnD(els.editSectionsEditor);
  }
}

els.editAddSection?.addEventListener("click", () => {
  addSectionRow(els.editSectionsEditor, {
    name: `Sección ${els.editSectionsEditor.querySelectorAll("[data-section-row]").length + 1}`,
    format: "num",
    prefix: "",
    count: 10,
    ownNumbering: false,
    specials: []
  });
  enableDnD(els.editSectionsEditor);
});

function applyEdit() {
  const col = getCurrent();
  if (!col) return goCollections();

  const newName = (els.editName?.value || "").trim();
  if (!newName) return alert("Nombre inválido.");
  col.name = newName;

  if (col.structure !== "sections") {
    save();
    goDetail(col.id);
    alert("Cambios guardados ✅");
    return;
  }

  const read = readSections(els.editSectionsEditor);
  if (!read.ok) return alert(read.error);

  const rows = read.rows;

  const oldByKey = new Map();
  for (const it of col.items) oldByKey.set(it.key || `${it.sectionId}|${it.label}`, it);

  const newSections = [];
  const newItems = [];
  let globalCounter = 1;
  const numberMode = col.numberMode === "perSection" ? "perSection" : "global";

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    const s = read.sections[idx];

    const existingId = r.dataset.secId || null;
    const secId = existingId || uid("sec");

    newSections.push({
      id: secId,
      name: s.name,
      format: s.format,
      prefix: s.prefix,
      ownNumbering: !!s.ownNumbering,
      specials: s.specials
    });

    const specialsSet = new Set((s.specials || []).map(normCode));

    if (s.format === "alfa") {
      for (let i = 1; i <= s.count; i++) {
        const label = `${s.prefix}${i}`;
        const key = `alfa:${s.prefix}:${i}`;
        const old = oldByKey.get(key);

        newItems.push({
          id: old?.id || uid("it"),
          sectionId: secId,
          label,
          have: !!old?.have,
          rep: old?.rep || 0,
          special: specialsSet.has(normCode(label)),
          key
        });
      }
      continue;
    }

    const sectionIsLocal = (numberMode === "perSection") || s.ownNumbering;

    for (let i = 1; i <= s.count; i++) {
      const n = sectionIsLocal ? i : globalCounter;
      const label = String(n);
      const key = sectionIsLocal ? `numLocal:${secId}:${i}` : `numGlobal:${globalCounter}`;
      const old = oldByKey.get(key);

      newItems.push({
        id: old?.id || uid("it"),
        sectionId: secId,
        label,
        have: !!old?.have,
        rep: old?.rep || 0,
        special: specialsSet.has(normCode(label)),
        key
      });

      if (!sectionIsLocal) globalCounter += 1;
    }
  }

  col.sections = newSections;
  col.items = newItems;

  save();
  goDetail(col.id);
  alert("Cambios guardados ✅");
}

/* -----------------------------
   Backup (REEMPLAZAR)
----------------------------- */
function exportBackup() {
  const payload = {
    backupVersion: BACKUP_VERSION,
    exportedAt: Date.now(),
    app: "ColeccionLuciano",
    data: state.data
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `backup-coleccion-luciano-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);

  state.meta.lastExportAt = Date.now();
  state.meta.lastExportSize = blob.size;
  save();

  renderSettings();
  alert("Backup exportado ✅");
}

function normalizeImportedPayload(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (obj.data && obj.data.collections) {
    return { collections: Array.isArray(obj.data.collections) ? obj.data.collections : [] };
  }
  if (obj.collections) {
    return { collections: Array.isArray(obj.collections) ? obj.collections : [] };
  }
  return null;
}

function handleImportFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = JSON.parse(reader.result);
      const normalized = normalizeImportedPayload(raw);
      if (!normalized) return alert("Este archivo no parece un backup válido.");

      const ok = confirm(
        "Importar backup (REEMPLAZAR):\n\n" +
        "Esto borrará TODO lo actual y cargará el contenido del backup.\n\n" +
        "¿Continuar?"
      );
      if (!ok) return;

      state.data.collections = normalized.collections || [];

      // saneo
      for (const c of state.data.collections) {
        if (!c.items) c.items = [];
        if (!c.sections) c.sections = [];
        if (!c.structure) c.structure = "simple";
        if (!c.numberMode) c.numberMode = "global";

        if (c.structure === "sections") {
          for (const s of c.sections) {
            if (!s.format) s.format = "num";
            if (typeof s.prefix !== "string") s.prefix = "";
            if (typeof s.ownNumbering !== "boolean") s.ownNumbering = false;
            if (!Array.isArray(s.specials)) s.specials = [];
          }
        } else {
          if (!c.sections.length) {
            c.sections = [{ id: uid("sec"), name:"General", format:"num", prefix:"", ownNumbering:false, specials:[] }];
          }
          if (!Array.isArray(c.sections[0].specials)) c.sections[0].specials = [];
        }

        for (const it of c.items) {
          if (typeof it.special !== "boolean") it.special = false;
          if (!it.key) it.key = `${it.sectionId}|${it.label}`;
          if (typeof it.have !== "boolean") it.have = false;
          if (!Number.isFinite(it.rep)) it.rep = 0;
        }
      }

      state.meta.lastImportAt = Date.now();
      state.meta.lastImportMode = "replace";
      save();

      renderCollectionsSelects();
      goCollections();
      alert("Backup importado ✅ (Reemplazar)");
    } catch {
      alert("Error al importar el backup.");
    }
  };
  reader.readAsText(file);
}

function renderSettings() {
  if (els.exportMeta) {
    els.exportMeta.textContent =
      `Último: ${formatDateTime(state.meta.lastExportAt)} · Tamaño: ${formatBytes(state.meta.lastExportSize)}`;
  }
  if (els.importMeta) {
    els.importMeta.textContent =
      `Último: ${formatDateTime(state.meta.lastImportAt)} · Modo: Reemplazar`;
  }
  if (els.storageMeta) {
    const raw = localStorage.getItem(LS_KEY) || "";
    els.storageMeta.textContent = `Datos actuales en el dispositivo: ${formatBytes(raw.length)}`;
  }
}

/* -----------------------------
   Eventos (delegados)
----------------------------- */
document.addEventListener("click", (e) => {
  const btn = e.target?.closest?.("[data-action]");
  if (!btn) return;
  const action = btn.getAttribute("data-action");

  // dashboard
  if (action === "dash-collections") return goCollections();
  if (action === "dash-loadedit") return goLoadEdit();
  if (action === "dash-settings") return goSettings();
  if (action === "dash-stats") return alert("Estadísticas: próximamente 😉");

  // create
  if (action === "go-create") return goCreate();
  if (action === "create-cancel") return goLoadEdit();
  if (action === "create-save") return createCollection();

  // edit
  if (action === "open-edit") return goEdit();
  if (action === "edit-cancel") return goDetail(state.currentId);
  if (action === "edit-save") return applyEdit();

  // reset
  if (action === "reset-collection") return resetCollection();

  // backup
  if (action === "export-backup") return exportBackup();

  // filtros
  if (action === "filter-all") { state.filter = "all"; return renderDetail(); }
  if (action === "filter-have") { state.filter = "have"; return renderDetail(); }
  if (action === "filter-miss") { state.filter = "miss"; return renderDetail(); }

  // load/edit picker
  if (action === "open-edit-picker") {
    if (els.editPicker) els.editPicker.classList.toggle("hidden");
    renderCollectionsSelects();
    return;
  }
});

els.backBtn?.addEventListener("click", () => {
  // regla simple de back
  if (state.view === "detail") return goCollections();
  if (state.view === "collections") return setView("dash");
  if (state.view === "loadedit") return setView("dash");
  if (state.view === "settings") return setView("dash");
  if (state.view === "create") return goLoadEdit();
  if (state.view === "edit") return goDetail(state.currentId);
  return setView("dash");
});

// abrir colección desde selector
els.btnOpenCollection?.addEventListener("click", () => {
  const id = els.collectionsSelect?.value;
  if (!id) return;
  goDetail(id);
});

// abrir editor desde picker
els.btnEditOpen?.addEventListener("click", () => {
  const id = els.editSelect?.value;
  if (!id) return;
  state.currentId = id;
  goEdit();
});

// import input
els.importInput?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  handleImportFile(file);
  e.target.value = "";
});

/* -----------------------------
   Init
----------------------------- */
function init() {
  load();
  renderCollectionsSelects();
  renderSettings();
  setView("dash");
  resetCreateForm();
  ensureBulkBuilderUI();
}

document.addEventListener("DOMContentLoaded", init);
/* ===== PATCH Badge Repetidas v1 ===== */

(function enhanceRepBadges(){

  const originalRenderDetail = renderDetail;

  renderDetail = function(){
    originalRenderDetail();

    document.querySelectorAll(".item").forEach(itemEl => {

      const repText = itemEl.querySelector(".item-rep");
      if(!repText) return;

      const match = repText.textContent.match(/\d+/);
      if(!match) return;

      const repValue = parseInt(match[0], 10);
      if(repValue <= 0) return;

      // evitar duplicar badge
      if(itemEl.querySelector(".rep-badge")) return;

      const badge = document.createElement("div");
      badge.className = "rep-badge";
      badge.textContent = repValue > 99 ? "99+" : repValue;

      itemEl.appendChild(badge);
    });
  };

})();
/* =============================
   PATCH v1.0.x — Auto-abrir colección + UI badge/rep cleanup
   (pegar al FINAL de app.js)
============================= */
(function () {
  // helper seguro
  const $id = (id) => document.getElementById(id);

  function tryOpenCollectionById(colId) {
    if (!colId) return;

    // Intentos (según cómo esté tu app.js hoy)
    try {
      if (typeof window.goDetail === "function") return window.goDetail(colId);
    } catch {}

    try {
      if (typeof window.openCollection === "function") return window.openCollection(colId);
    } catch {}

    // Fallback best-effort
    try {
      if (window.state) window.state.currentId = colId;
      if (typeof window.renderDetail === "function") window.renderDetail();
      if (typeof window.setView === "function") window.setView("detail");
    } catch {}
  }

  function wireCollectionsAutoOpen() {
    const sel = $id("collectionsSelect");
    if (!sel) return;

    // Ocultar botón "Abrir" si existe
    const btn = $id("btnOpenCollection");
    if (btn) {
      btn.style.display = "none";
      btn.classList?.add("hidden");
    }

    if (sel.dataset.autoOpenWired === "1") return;
    sel.dataset.autoOpenWired = "1";

    // Abrir apenas selecciona
    sel.addEventListener("change", () => {
      const colId = sel.value;
      // pequeño delay para dejar que cierre el select en iOS
      setTimeout(() => tryOpenCollectionById(colId), 80);
    });

    // Por si alguien toca el botón igual (o queda un handler viejo)
    if (btn) btn.onclick = () => tryOpenCollectionById(sel.value);
  }

  // Mantenerlo “vivo” aunque la vista se re-renderice
  function keepAlive() {
    wireCollectionsAutoOpen();
    // reintenta un par de veces por si la UI carga luego
    setTimeout(wireCollectionsAutoOpen, 300);
    setTimeout(wireCollectionsAutoOpen, 900);
  }

  // Al cargar
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", keepAlive);
  } else {
    keepAlive();
  }

  // Si cambian vistas dinámicamente, lo volvemos a enganchar
  const obs = new MutationObserver(() => wireCollectionsAutoOpen());
  obs.observe(document.body, { childList: true, subtree: true });
})();
/* =============================
   PATCH — Badge esquina + eliminar "Rep: x" + centrar código
   (pegar al FINAL de app.js)
============================= */
(function () {
  const BADGE_CLASS = "repBadgeCorner";
  const CENTER_CLASS = "tileCentered";

  // Busca un texto tipo "Rep: 2" en algún nodo hijo y devuelve {node, n}
  function findRepNode(root) {
    // Recorremos elementos que tengan texto (rápido y seguro)
    const els = root.querySelectorAll("*");
    for (const el of els) {
      const t = (el.textContent || "").trim();
      const m = t.match(/^Rep:\s*(\d+)\s*$/i);
      if (m) return { node: el, n: parseInt(m[1], 10) || 0 };
    }
    return null;
  }

  // A veces el "Rep:" viene pegado en el mismo elemento con más texto.
  // Buscamos el patrón dentro del texto y lo limpiamos.
  function stripInlineRep(root) {
    const els = root.querySelectorAll("*");
    for (const el of els) {
      const t = (el.textContent || "");
      if (/Rep:\s*\d+/i.test(t) && t.length > 8) {
        // solo limpiamos si hay más texto además de "Rep: N"
        el.textContent = t.replace(/Rep:\s*\d+/gi, "").replace(/\s{2,}/g, " ").trim();
        // no retornamos, porque podría haber varios
      }
    }
  }

  function upsertBadge(tile, n) {
    // quitar badge si no corresponde
    let badge = tile.querySelector("." + BADGE_CLASS);

    if (!n || n <= 0) {
      if (badge) badge.remove();
      return;
    }

    if (!badge) {
      badge = document.createElement("div");
      badge.className = BADGE_CLASS;
      tile.appendChild(badge);
    }
    badge.textContent = String(n);
  }

  function centerCode(tile) {
    tile.classList.add(CENTER_CLASS);
  }

  function patchTile(tile) {
    if (!tile || tile.nodeType !== 1) return;

    // 1) centrar contenido
    centerCode(tile);

    // 2) encontrar "Rep: N" como elemento SOLO "Rep: N"
    const found = findRepNode(tile);
    if (found) {
      const n = found.n;
      found.node.remove();      // elimina el "Rep: x"
      upsertBadge(tile, n);     // crea/actualiza el badge
      return;
    }

    // 3) si no lo encontramos como elemento aislado, limpiamos inline (por si viene mezclado)
    stripInlineRep(tile);

    // 4) si existe un badge viejo (por versiones anteriores), lo convertimos a nuestro estilo
    // (si ya hay algún badge con número, lo dejamos y aplicamos clase nueva)
    const anyBadge = tile.querySelector(".rep-badge,.repBadge,.badge-rep,.badgeRep,.item-badge,.itemBadge");
    if (anyBadge && !tile.querySelector("." + BADGE_CLASS)) {
      const num = parseInt((anyBadge.textContent || "").trim(), 10);
      anyBadge.remove();
      upsertBadge(tile, isNaN(num) ? 0 : num);
    }
  }

  function patchAllVisible() {
    // cubrimos varios nombres posibles de “caja” sin depender del HTML exacto
    const tiles = document.querySelectorAll(
      ".item, .tile, .fig, .sticker, .stickerItem, .sticker-box, .card-item, [data-sticker], [data-item]"
    );
    tiles.forEach(patchTile);
  }

  // Ejecutar al cargar + cada vez que se renderiza algo nuevo
  function boot() {
    patchAllVisible();

    const target = document.getElementById("sectionsDetail") || document.body;
    const mo = new MutationObserver(() => {
      // pequeño debounce
      clearTimeout(window.__repPatchT);
      window.__repPatchT = setTimeout(patchAllVisible, 50);
    });
    mo.observe(target, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
/* =============================
   PATCH vFilters: Repetidas
   - Cambia “Tengo” -> “Repetidas”
   - Repetidas = muestra solo cajas con badge
   - No rompe “Todas” ni “Faltan”
============================= */
(function () {
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

  function getFilterButtons() {
    const fAll = $("#fAll");
    const fMiss = $("#fMiss");
    const fHave = $("#fHave"); // lo usamos como Repetidas
    return { fAll, fMiss, fHave };
  }

  function getTiles() {
    // Seleccionamos “cajas” de forma amplia (por si cambian clases internas)
    return $all(".item, .tile, .sticker, .stickerItem, .sticker-box").filter(el => el.closest("#sectionsDetail"));
  }

  function setActive(btn) {
    const { fAll, fMiss, fHave } = getFilterButtons();
    [fAll, fMiss, fHave].forEach(b => b && b.classList.remove("is-active"));
    btn && btn.classList.add("is-active");
  }

  function applyRepFilter() {
    const tiles = getTiles();
    tiles.forEach(t => {
      const hasBadge = !!t.querySelector(".repBadgeCorner, .rep-badge");
      t.style.display = hasBadge ? "" : "none";
    });
  }

  function clearCustomFilter() {
    const tiles = getTiles();
    tiles.forEach(t => (t.style.display = ""));
  }

  function wireRepetidas() {
    const { fAll, fMiss, fHave } = getFilterButtons();
    if (!fHave) return;

    // 1) etiqueta
    fHave.textContent = "Repetidas";

    // 2) rewire: clonamos para borrar listeners anteriores sin tocar tu código
    const newBtn = fHave.cloneNode(true);
    fHave.parentNode.replaceChild(newBtn, fHave);

    newBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // activamos repetidas
      setActive(newBtn);
      clearCustomFilter();
      applyRepFilter();

      // guardamos estado para re-aplicar si se re-renderiza
      window.__filterMode = "rep";
    }, true);

    // “Todas” y “Faltan” vuelven a mostrar todo y dejan que tu lógica haga lo suyo
    if (fAll) fAll.addEventListener("click", () => {
      window.__filterMode = "all";
      clearCustomFilter();
    }, true);

    if (fMiss) fMiss.addEventListener("click", () => {
      window.__filterMode = "miss";
      clearCustomFilter();
    }, true);
  }

  function observeRerenders() {
    const host = document.getElementById("sectionsDetail");
    if (!host) return;

    const obs = new MutationObserver(() => {
      if (window.__filterMode === "rep") {
        // si está en repetidas y se re-renderizó, reaplicamos
        applyRepFilter();
      }
    });

    obs.observe(host, { childList: true, subtree: true });
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireRepetidas();
    observeRerenders();
  });
})();
/* =============================
   FIX FINAL Badge + Pintado Especial
============================= */
(function(){

  function cleanOldBadges(tile){
    const old = tile.querySelectorAll(
      ".repBadgeCorner, .rep-badge, .badge-rep, .badgeRep, .item-badge, .itemBadge"
    );
    old.forEach(b => b.remove());
  }

  function applyBadgeSystem(){
    const tiles = document.querySelectorAll(
      ".item, .tile, .sticker, .stickerItem, .sticker-box"
    );

    tiles.forEach(tile => {

      // restaurar pintado celeste si tiene clase have
      if(tile.classList.contains("have")){
        tile.style.background = "";
        tile.style.borderColor = "";
      }

      // buscar número repetidas desde dataset o atributo interno
      const repText = tile.textContent.match(/Rep:\s*(\d+)/i);
      const repValue = repText ? parseInt(repText[1],10) : 0;

      // eliminar cualquier badge previo
      cleanOldBadges(tile);

      if(repValue > 0){
        const badge = document.createElement("div");
        badge.className = "repBadgeCorner";
        badge.textContent = repValue;
        tile.appendChild(badge);
      }
    });
  }

  // Ejecutar al cargar
  document.addEventListener("DOMContentLoaded", () => {
    applyBadgeSystem();
  });

  // Reaplicar cuando se re-renderiza detalle
  const obs = new MutationObserver(() => {
    clearTimeout(window.__badgeFixT);
    window.__badgeFixT = setTimeout(applyBadgeSystem, 50);
  });

  obs.observe(document.body, {childList:true, subtree:true});

})();
/* =============================
   PATCH vX — Badge estable + sin duplicados (global)
   - Elimina todos los badges existentes (de cualquier parche anterior)
   - Fuerza 1 badge por caja
   - Evita re-entradas (no se vuelve loco con renders/observers)
============================= */
(function () {
  let running = false;

  function removeAllBadges() {
    document.querySelectorAll(".repBadgeCorner").forEach(el => el.remove());
  }

  function getRepCount(tile) {
    // 1) Si alguna parte del código ya dejó un dato, lo usamos
    const ds = tile.dataset && (tile.dataset.rep || tile.dataset.reps || tile.dataset.dup || tile.dataset.dups);
    if (ds != null && ds !== "") {
      const n = parseInt(ds, 10);
      return Number.isFinite(n) ? n : 0;
    }

    // 2) Si existe algún elemento "rep" en el DOM, lo leemos (aunque esté oculto)
    const repEl =
      tile.querySelector("[data-rep],[data-reps],.rep,.reps,.dup,.dups,.repetidas,.repetidasCount") ||
      null;

    if (repEl) {
      const m = (repEl.textContent || "").match(/(\d+)/);
      if (m) return parseInt(m[1], 10) || 0;
    }

    // 3) Último recurso: buscar "Rep:" en el texto (NO toma números de RIA12)
    const t = (tile.textContent || "");
    const m = t.match(/Rep:\s*(\d+)/i);
    return m ? (parseInt(m[1], 10) || 0) : 0;
  }

  function ensureBadge(tile, rep) {
    // borrar badge previo SOLO dentro de la caja (por si quedó alguno)
    tile.querySelectorAll(".repBadgeCorner").forEach(el => el.remove());

    if (rep > 0) {
      const b = document.createElement("div");
      b.className = "repBadgeCorner";
      b.textContent = String(rep);
      tile.appendChild(b);
    }
  }

  function applyBadges() {
    if (running) return;
    running = true;

    try {
      // limpieza global: evita "11111"
      removeAllBadges();

      // seleccionar cajas (amplio, pero seguro)
      const tiles = document.querySelectorAll(".item, .tile, .sticker, .stickerItem, .sticker-box");

      tiles.forEach(tile => {
        const rep = getRepCount(tile);
        ensureBadge(tile, rep);
      });
    } finally {
      running = false;
    }
  }

  // 1) al cargar
  document.addEventListener("DOMContentLoaded", () => {
    applyBadges();
    // segundo pase por si renderiza después
    setTimeout(applyBadges, 120);
  });

  // 2) cuando se vuelve a renderizar (detalle / filtros / taps)
  const obs = new MutationObserver(() => {
    clearTimeout(window.__badgeStableT);
    window.__badgeStableT = setTimeout(applyBadges, 60);
  });

  obs.observe(document.body, { childList: true, subtree: true });
})();
/* =========================
   PATCH v1.0 – Badge Rep + filtro Repetidas estable
   Pegar al FINAL de app.js
========================= */

(function () {
  // --- Helpers: encontrar "celdas" de figuritas de forma tolerante ---
  const CELL_SELECTORS = [
    ".sticker", ".fig", ".tile", ".slot", ".card-sticker",
    ".sticker-cell", ".fig-cell", ".tile-cell",
    "[data-sticker]", "[data-fig]", "[data-code]"
  ];

  function getCells() {
    const root = document.getElementById("sectionsDetail") || document;
    const set = new Set();
    CELL_SELECTORS.forEach(sel => root.querySelectorAll(sel).forEach(n => set.add(n)));
    // Filtramos cosas que claramente no son celdas (por si matchea de más)
    return [...set].filter(el => el && el.nodeType === 1 && el.offsetParent !== null);
  }

  function readRepCount(cell) {
    // 1) Badge nuevo
    const b = cell.querySelector(".rep-badge, .repBadge");
    if (b) {
      const n = parseInt((b.textContent || "").trim(), 10);
      return Number.isFinite(n) ? n : 0;
    }

    // 2) Si quedó “Rep: X” en algún lado
    const txt = (cell.textContent || "");
    const m = txt.match(/Rep:\s*(\d+)/i);
    if (m) return parseInt(m[1], 10) || 0;

    // 3) Dataset
    const d = cell.getAttribute("data-rep");
    if (d != null) return parseInt(d, 10) || 0;

    return 0;
  }

  function isHave(cell) {
    // Intentamos detectar “tengo” con varias pistas típicas
    if (cell.getAttribute("data-have") === "1") return true;
    if (cell.getAttribute("aria-pressed") === "true") return true;

    const cls = cell.classList;
    return (
      cls.contains("is-have") ||
      cls.contains("have") ||
      cls.contains("owned") ||
      cls.contains("done") ||
      cls.contains("is-done") ||
      cls.contains("is-checked") ||
      cls.contains("checked")
    );
  }

  function isMissing(cell) {
    return !isHave(cell);
  }

  // --- Badge: evita duplicados y lo crea solo si rep > 0 ---
  function normalizeBadges() {
    const cells = getCells();
    cells.forEach(cell => {
      const rep = readRepCount(cell);

      // eliminar duplicados: si hay 2 badges, dejamos el primero
      const badges = cell.querySelectorAll(".rep-badge, .repBadge");
      if (badges.length > 1) {
        for (let i = 1; i < badges.length; i++) badges[i].remove();
      }

      // si rep <= 0: borrar badge si existe
      if (!rep || rep <= 0) {
        const ex = cell.querySelector(".rep-badge, .repBadge");
        if (ex) ex.remove();
        return;
      }

      // crear badge si no existe
      let badge = cell.querySelector(".rep-badge, .repBadge");
      if (!badge) {
        badge = document.createElement("div");
        badge.className = "rep-badge";
        // Asegura posicionamiento
        if (getComputedStyle(cell).position === "static") {
          cell.style.position = "relative";
        }
        cell.appendChild(badge);
      }

      // texto
      badge.textContent = String(rep);
    });
  }

  // --- Filtros: Todas / Faltan / Repetidas ---
  let currentFilter = "all";

  function setActiveFilterUI(mode) {
    // soporta ids viejos/nuevos
    const btnAll = document.getElementById("fAll");
    const btnMiss = document.getElementById("fMiss");
    const btnHave = document.getElementById("fHave"); // a veces existe
    const btnRep =
      document.getElementById("fRep") ||
      document.getElementById("fReps") ||
      document.getElementById("fRepeat") ||
      document.querySelector('[data-action="filter-rep"]') ||
      document.querySelector('[data-action="filter-reps"]');

    [btnAll, btnMiss, btnHave, btnRep].forEach(b => {
      if (b) b.classList.remove("is-active");
    });

    if (mode === "all" && btnAll) btnAll.classList.add("is-active");
    if (mode === "miss" && btnMiss) btnMiss.classList.add("is-active");
    if (mode === "rep" && btnRep) btnRep.classList.add("is-active");
    // si existe “Tengo” pero no lo usamos, lo dejamos apagado siempre
  }

  function applyFilter(mode) {
    currentFilter = mode || "all";
    setActiveFilterUI(currentFilter);

    const cells = getCells();
    cells.forEach(cell => {
      let show = true;
      if (currentFilter === "miss") show = isMissing(cell);
      if (currentFilter === "rep") show = readRepCount(cell) > 0;

      cell.style.display = show ? "" : "none";
    });
  }

  // --- Click handlers (delegación) ---
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const a = btn.getAttribute("data-action");
    if (a === "filter-all") applyFilter("all");
    if (a === "filter-miss") applyFilter("miss");

    // soportamos ambos nombres por si quedó uno u otro
    if (a === "filter-rep" || a === "filter-reps" || a === "filter-repeat") {
      applyFilter("rep");
    }
  }, true);

  // --- Reaplicar cuando se re-renderiza el detalle ---
  function patchNow() {
    normalizeBadges();
    applyFilter(currentFilter);
  }

  // Observa cambios en el detalle para “pegarse” a cualquier render del app
  const detail = document.getElementById("sectionsDetail");
  if (detail) {
    const mo = new MutationObserver(() => {
      // pequeño debounce
      clearTimeout(window.__repPatchT);
      window.__repPatchT = setTimeout(patchNow, 30);
    });
    mo.observe(detail, { childList: true, subtree: true });
  }

  // Primera corrida
  setTimeout(patchNow, 50);
})();
/* =========================
   HOTFIX – Badge “loco” + filtro Repetidas real
   Pegar AL FINAL de app.js (debajo de todo)
========================= */

(function () {
  // --- Selectores tolerantes para “celdas” ---
  const CELL_SELECTORS = [
    ".sticker", ".fig", ".tile", ".slot", ".card-sticker",
    ".sticker-cell", ".fig-cell", ".tile-cell",
    "[data-sticker]", "[data-fig]", "[data-code]"
  ];

  function getCells() {
    const root = document.getElementById("sectionsDetail") || document;
    const set = new Set();
    CELL_SELECTORS.forEach(sel => root.querySelectorAll(sel).forEach(n => set.add(n)));
    return [...set].filter(el => el && el.nodeType === 1);
  }

  // Elimina badges existentes (de cualquier versión) para que no contaminen lecturas
  function removeAllBadges(cell) {
    cell.querySelectorAll(".rep-badge, .repBadge, .badge-rep, .rep-bubble, .repBubble").forEach(n => n.remove());
  }

  // Lee repeticiones desde “fuente limpia”:
  // 1) data-rep si existe
  // 2) texto oculto "Rep: X" (aunque esté display:none igual vive en el DOM)
  function readRepClean(cell) {
    const d = cell.getAttribute("data-rep");
    if (d != null && d !== "") {
      const n = parseInt(d, 10);
      return Number.isFinite(n) ? n : 0;
    }

    // Clonamos y sacamos badges/ruido antes de leer texto
    const clone = cell.cloneNode(true);
    clone.querySelectorAll(".rep-badge, .repBadge, .badge-rep, .rep-bubble, .repBubble").forEach(n => n.remove());
    const txt = (clone.textContent || "").replace(/\s+/g, " ").trim();

    const m = txt.match(/Rep:\s*(\d+)/i);
    if (m) return parseInt(m[1], 10) || 0;

    return 0;
  }

  function isHave(cell) {
    if (cell.getAttribute("data-have") === "1") return true;
    if (cell.getAttribute("aria-pressed") === "true") return true;
    const c = cell.classList;
    return c.contains("is-have") || c.contains("have") || c.contains("owned") || c.contains("done") || c.contains("checked");
  }

  // Crea/actualiza 1 solo badge por celda, con número correcto
  function normalizeBadges() {
    const cells = getCells();

    cells.forEach(cell => {
      // Primero borramos cualquier badge previo (de cualquier parche)
      removeAllBadges(cell);

      const rep = readRepClean(cell);

      // Si no hay repetidas, no mostramos badge
      if (!rep || rep <= 0) return;

      // Creamos badge “oficial”
      const badge = document.createElement("div");
      badge.className = "rep-badge";
      badge.textContent = String(rep);

      // Asegurar stacking/posicion
      const pos = getComputedStyle(cell).position;
      if (pos === "static") cell.style.position = "relative";
      cell.appendChild(badge);
    });
  }

  // --- Filtros robustos ---
  let currentFilter = "all";

  function setActiveFilterUI(mode) {
    const wrap = document.querySelector(".seg-filters") || document;
    const buttons = wrap.querySelectorAll(".seg-btn, [data-action^='filter-']");
    buttons.forEach(b => b.classList.remove("is-active"));

    const map = {
      all: wrap.querySelector("[data-action='filter-all']") || document.getElementById("fAll"),
      miss: wrap.querySelector("[data-action='filter-miss']") || document.getElementById("fMiss"),
      rep: wrap.querySelector("[data-action='filter-rep']") ||
           wrap.querySelector("[data-action='filter-reps']") ||
           document.getElementById("fRep") ||
           document.getElementById("fReps")
    };

    const btn = map[mode];
    if (btn) btn.classList.add("is-active");
  }

  function applyFilter(mode) {
    currentFilter = mode || "all";
    setActiveFilterUI(currentFilter);

    const cells = getCells();

    cells.forEach(cell => {
      let show = true;
      if (currentFilter === "miss") show = !isHave(cell);
      if (currentFilter === "rep") show = readRepClean(cell) > 0;
      cell.style.display = show ? "" : "none";
    });
  }

  // Captura clicks primero y frena handlers viejos que estén rompiendo estado/pintado
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const a = btn.getAttribute("data-action");
    const isFilter = (a === "filter-all" || a === "filter-miss" || a === "filter-rep" || a === "filter-reps" || a === "filter-repeat");
    if (!isFilter) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Antes de filtrar, normalizamos badges (para que rep sea correcto)
    normalizeBadges();

    if (a === "filter-all") applyFilter("all");
    if (a === "filter-miss") applyFilter("miss");
    if (a === "filter-rep" || a === "filter-reps" || a === "filter-repeat") applyFilter("rep");
  }, true); // capture=true

  // Re-enganche: si el detalle se re-renderiza, rearmamos badges y re-aplicamos filtro
  function patchNow() {
    normalizeBadges();
    applyFilter(currentFilter);
  }

  const detail = document.getElementById("sectionsDetail");
  if (detail) {
    const mo = new MutationObserver(() => {
      clearTimeout(window.__hotfixRepT);
      window.__hotfixRepT = setTimeout(patchNow, 40);
    });
    mo.observe(detail, { childList: true, subtree: true });
  }

  setTimeout(patchNow, 60);
})();
/* === DIAG: ¿cuántas cajas detecto? (pegar al final) === */
(function () {
  const root = document.getElementById("sectionsDetail");
  if (!root) return;

  // heurística: candidatos = elementos dentro del grid que parecen “caja”
  const candidates = [...root.querySelectorAll("*")].filter(el => {
    if (!(el instanceof HTMLElement)) return false;
    const t = (el.innerText || "").trim();
    if (!t) return false;
    // si contiene algo como RIA1 / BAE12 / etc
    return /^[A-Z]{2,}\d{1,4}\b/.test(t);
  });

  // reducimos a “caja” probable (padre más cercano con borde/radius)
  const boxes = candidates.map(el => el.closest("div,button,article,li,span")).filter(Boolean);
  const unique = [...new Set(boxes)];

  alert("DIAG: sectionsDetail OK ✅\nCajas detectadas: " + unique.length);

  // marco las primeras 3 para ver si son las correctas
  unique.slice(0, 3).forEach(b => {
    b.style.outline = "3px solid #ff3b30";
  });
})();
/* === DIAG REAL – detectar clases de las cajas === */
setTimeout(() => {
  const possible = document.querySelectorAll("div");
  const matches = [];

  possible.forEach(el => {
    const t = (el.innerText || "").trim();
    if (/^RIA\d+/.test(t)) {
      matches.push({
        className: el.className,
        tag: el.tagName
      });
      el.style.outline = "3px solid red";
    }
  });

  alert("Candidatos encontrados: " + matches.length + 
        "\nPrimera clase detectada:\n" + 
        (matches[0] ? matches[0].className : "NINGUNA"));
}, 800);
