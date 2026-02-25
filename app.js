/* =============================
   Colección Lucho - Arquitectura estable (v2.4.1)
   ✅ FIX CRÍTICO: recupera datos desde claves antiguas (no se pierden colecciones)
============================= */

const LS_KEY = "coleccion_lucho_v24";           // clave nueva
const META_KEY = "coleccion_lucho_meta_v24";    // meta nueva

// ✅ claves anteriores (para recuperar datos ya guardados)
const LEGACY_LS_KEYS = [
  "coleccion_luciano_v2",
  "coleccion_luciano_v2_1",
  "coleccion_luciano_v2_2",
];
const LEGACY_META_KEYS = [
  "coleccion_luciano_meta_v2",
  "coleccion_luciano_meta_v2_1",
  "coleccion_luciano_meta_v2_2",
];

const BACKUP_VERSION = 1;

const $ = (id) => document.getElementById(id);

const els = {
  backBtn: $("backBtn"),
  topbarTitle: $("topbarTitle"),
  views: Array.from(document.querySelectorAll("[data-view]")),

  collectionsSelect: $("collectionsSelect"),
  btnOpenCollection: $("btnOpenCollection"),

  editPicker: $("editPicker"),
  editSelect: $("editSelect"),
  btnEditOpen: $("btnEditOpen"),

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
  fAll: $("fAll"),
  fHave: $("fHave"),
  fMiss: $("fMiss"),

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
  view: "dash",
  currentId: null,
  detailFilter: "all", // all | have | miss
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
function normCode(s) { return String(s || "").trim().toUpperCase(); }

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
function parseCodesList(input) {
  return String(input || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(normCode);
}
function normalizePrefix(p) {
  return String(p || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
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
   Persistencia (con rescate legacy)
----------------------------- */
function readFirstExisting(keys) {
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (raw && raw.trim()) return { key: k, raw };
  }
  return null;
}

function normalizeLoadedData(obj) {
  if (!obj || typeof obj !== "object") return { collections: [] };
  if (!Array.isArray(obj.collections)) obj.collections = [];
  return obj;
}

function migrateSoft() {
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
    }
  }
}

function load() {
  // 1) Intentar leer la clave nueva
  let loaded = null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw && raw.trim()) loaded = { key: LS_KEY, raw };
  } catch {}

  // 2) Si no hay datos en la nueva, buscar en legacy (TU CASO)
  if (!loaded) loaded = readFirstExisting(LEGACY_LS_KEYS);

  // 3) Parse
  try {
    state.data = loaded ? normalizeLoadedData(JSON.parse(loaded.raw)) : { collections: [] };
  } catch {
    state.data = { collections: [] };
  }

  // META: nueva o legacy
  let metaRaw = null;
  try {
    const r = localStorage.getItem(META_KEY);
    if (r && r.trim()) metaRaw = r;
  } catch {}
  if (!metaRaw) {
    const legacyMeta = readFirstExisting(LEGACY_META_KEYS);
    metaRaw = legacyMeta?.raw || null;
  }
  try {
    const m = JSON.parse(metaRaw || "{}");
    state.meta = { ...state.meta, ...m };
  } catch {}

  migrateSoft();

  // ✅ Si venía de legacy, guardamos inmediatamente en la clave nueva (sin borrar legacy)
  save();
}

function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(state.data));
  localStorage.setItem(META_KEY, JSON.stringify(state.meta));
}

/* -----------------------------
   Views / navegación
----------------------------- */
function setView(view) {
  state.view = view;
  for (const v of els.views) v.classList.toggle("is-active", v.dataset.view === view);

  if (view === "dash") {
    els.topbarTitle.textContent = "Colecciones Lucho";
    els.backBtn.classList.add("hidden");
  } else if (view === "collections") {
    els.topbarTitle.textContent = "Mis colecciones";
    els.backBtn.classList.remove("hidden");
  } else if (view === "loadedit") {
    els.topbarTitle.textContent = "Carga / Edición";
    els.backBtn.classList.remove("hidden");
  } else if (view === "create") {
    els.topbarTitle.textContent = "Nueva colección";
    els.backBtn.classList.remove("hidden");
  } else if (view === "detail") {
    const col = getCurrent();
    els.topbarTitle.textContent = col ? col.name : "Colección";
    els.backBtn.classList.remove("hidden");
  } else if (view === "edit") {
    els.topbarTitle.textContent = "Editar";
    els.backBtn.classList.remove("hidden");
  } else if (view === "settings") {
    els.topbarTitle.textContent = "Ajustes";
    els.backBtn.classList.remove("hidden");
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function goDash() { state.currentId = null; setView("dash"); }
function goCollections() { renderCollectionsSelects(); setView("collections"); }
function goLoadEdit() { renderCollectionsSelects(); els.editPicker?.classList.add("hidden"); setView("loadedit"); }
function goSettings() { renderSettings(); setView("settings"); }
function goCreate() { resetCreateForm(); setView("create"); }
function goDetail(id) { state.currentId = id; state.detailFilter = "all"; syncFilterButtons(); renderDetail(); setView("detail"); }
function goEdit(id = null) { if (id) state.currentId = id; renderEdit(); setView("edit"); }

function goBack() {
  if (state.view === "detail") return goCollections();
  if (state.view === "create" || state.view === "edit" || state.view === "settings") return goDash();
  if (state.view === "collections" || state.view === "loadedit") return goDash();
  return goDash();
}

/* -----------------------------
   Selects
----------------------------- */
function renderCollectionsSelects() {
  const cols = state.data.collections.slice().sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));

  const fill = (sel) => {
    if (!sel) return;
    sel.innerHTML = "";
    if (!cols.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "— No hay colecciones —";
      sel.appendChild(opt);
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
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
    els.simpleBlock.style.display = "block";
    els.sectionsBlock.style.display = "none";
  } else {
    els.simpleBlock.style.display = "none";
    els.sectionsBlock.style.display = "block";
  }
}
els.structRadios.forEach(r => r.addEventListener("change", syncCreateBlocks));

function resetCreateForm() {
  els.newName.value = "";
  els.simpleCount.value = "100";
  els.simpleSpecials.value = "";
  els.numberMode.value = "global";
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
   Secciones UI (igual que antes)
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

function openSpecialsPrompt(currentArr, hint) {
  const current = (currentArr || []).join(", ");
  const txt = prompt(
    `Especiales (lista separada por coma)\n${hint}\n\nEj: 7, 10, 55  o  RIA1, RIA7\n\nActual:\n${current}`,
    current
  );
  if (txt === null) return null;
  const list = parseCodesList(txt);
  return Array.from(new Set(list));
}

function addSectionRow(container, { name="", format="num", prefix="", count=10, ownNumbering=false, specials=[] } = {}) {
  const row = document.createElement("div");
  row.className = "section-row";
  row.setAttribute("data-section-row", "1");
  row.dataset.specials = JSON.stringify(Array.isArray(specials) ? specials : []);

  row.draggable = true;
  row.style.cursor = "grab";
  row.addEventListener("dragstart", () => { row.classList.add("dragging"); row.style.opacity = "0.6"; });
  row.addEventListener("dragend", () => { row.classList.remove("dragging"); row.style.opacity = ""; });

  const inName = document.createElement("input");
  inName.className = "input";
  inName.type = "text";
  inName.placeholder = "Nombre";
  inName.value = name;

  const selFormat = document.createElement("select");
  selFormat.className = "input";
  selFormat.innerHTML = `<option value="num">Numérico</option><option value="alfa">Alfanumérico</option>`;
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
  actions.style.display = "flex";
  actions.style.gap = "6px";
  actions.style.alignItems = "center";

  const mkBtn = (txt, title) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.style.padding = "10px 12px";
    b.style.borderRadius = "14px";
    b.textContent = txt;
    b.title = title;
    return b;
  };

  const upBtn = mkBtn("↑","Subir sección");
  upBtn.addEventListener("click",(e)=>{e.stopPropagation(); moveRow(container,row,-1);});

  const downBtn = mkBtn("↓","Bajar sección");
  downBtn.addEventListener("click",(e)=>{e.stopPropagation(); moveRow(container,row,+1);});

  const starBtn = mkBtn("⭐","Editar especiales");
  starBtn.addEventListener("click",(e)=>{
    e.stopPropagation();
    const secName = (inName.value || "Sección").trim();
    const isAlfa = selFormat.value === "alfa";
    const pref = isAlfa ? normalizePrefix(inPrefix.value) : "";
    const hint = isAlfa ? `Sección "${secName}" (Alfa) · Prefijo: ${pref || "(sin prefijo)"}` : `Sección "${secName}" (Numérica)`;
    let current = [];
    try { current = JSON.parse(row.dataset.specials || "[]"); } catch { current = []; }
    const next = openSpecialsPrompt(current, hint);
    if (next === null) return;
    row.dataset.specials = JSON.stringify(next);
  });

  const delBtn = mkBtn("✕","Eliminar sección");
  delBtn.style.borderColor = "rgba(239,68,68,.35)";
  delBtn.style.background = "rgba(239,68,68,.10)";
  delBtn.style.color = "#b91c1c";
  delBtn.addEventListener("click",(e)=>{e.stopPropagation(); row.remove();});

  actions.appendChild(upBtn);
  actions.appendChild(downBtn);
  actions.appendChild(starBtn);
  actions.appendChild(delBtn);

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

/* DnD */
function getDragAfterElement(container, y) {
  const els = [...container.querySelectorAll("[data-section-row]:not(.dragging)")];
  return els.reduce((closest, child) => {
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
    const after = getDragAfterElement(container, e.clientY);
    if (!after) container.appendChild(dragging);
    else container.insertBefore(dragging, after);
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

/* leer secciones */
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

/* Create add section */
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

/* Crear colección */
function createCollection() {
  const name = (els.newName.value || "").trim();
  if (!name) return alert("Escribí un nombre.");

  const structure = getStructType();

  if (structure === "simple") {
    let count = parseInt(els.simpleCount.value || "0", 10);
    if (!Number.isFinite(count) || count <= 0) return alert("Cantidad inválida.");
    count = clamp(count, 1, 5000);

    const sectionId = uid("sec");
    const specials = parseCodesList(els.simpleSpecials.value);
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

    state.data.collections.unshift({
      id: uid("col"),
      name,
      createdAt: Date.now(),
      structure: "simple",
      numberMode: "global",
      sections,
      items
    });

    save();
    goDash();
    return;
  }

  const numberMode = (els.numberMode.value === "perSection") ? "perSection" : "global";
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

  state.data.collections.unshift({
    id: uid("col"),
    name,
    createdAt: Date.now(),
    structure: "sections",
    numberMode,
    sections,
    items
  });

  save();
  goDash();
}

/* Filtros */
function syncFilterButtons() {
  if (!els.fAll) return;
  els.fAll.classList.toggle("is-active", state.detailFilter === "all");
  els.fHave.classList.toggle("is-active", state.detailFilter === "have");
  els.fMiss.classList.toggle("is-active", state.detailFilter === "miss");
}
function passesFilter(it) {
  if (state.detailFilter === "all") return true;
  if (state.detailFilter === "have") return !!it.have;
  if (state.detailFilter === "miss") return !it.have;
  return true;
}

function renderDetail() {
  const col = getCurrent();
  if (!col) return goDash();

  els.detailTitle.textContent = col.name;

  const st = computeStats(col);
  els.stTotal.textContent = String(st.total);
  els.stHave.textContent = String(st.have);
  els.stMissing.textContent = String(st.missing);
  els.stPct.textContent = `${st.pct}%`;

  els.sectionsDetail.innerHTML = "";

  const bySec = new Map();
  for (const sec of col.sections) bySec.set(sec.id, []);
  for (const it of col.items) {
    if (!bySec.has(it.sectionId)) bySec.set(it.sectionId, []);
    bySec.get(it.sectionId).push(it);
  }

  for (const sec of col.sections) {
    const items = (bySec.get(sec.id) || []).filter(passesFilter);
    if (!items.length) continue;

    const card = document.createElement("div");
    card.className = "section-card";

    const title = document.createElement("div");
    title.className = "section-title";
    title.textContent = sec.name;

    const grid = document.createElement("div");
    grid.className = "items-grid";

    for (const it of items) grid.appendChild(buildItemCell(it));

    card.appendChild(title);
    card.appendChild(grid);
    els.sectionsDetail.appendChild(card);
  }
}

function buildItemCell(it) {
  const wrap = document.createElement("div");
  wrap.className = "item" + (it.have ? " have" : "") + (it.special ? " special" : "");

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

function resetCollection() {
  const col = getCurrent();
  if (!col) return;
  const ok = confirm(`Resetear "${col.name}"?\n\nSe borran Tengo y Rep de todos los ítems.`);
  if (!ok) return;
  for (const it of col.items) { it.have = false; it.rep = 0; }
  save();
  renderDetail();
}

/* Edit */
function renderEdit() {
  const col = getCurrent();
  if (!col) return goDash();

  els.editTitle.textContent = `Editar`;
  els.editName.value = col.name;

  const isSections = col.structure === "sections";
  els.editSectionsArea.style.display = isSections ? "block" : "none";
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
  if (!col) return goDash();

  const newName = (els.editName.value || "").trim();
  if (!newName) return alert("Nombre inválido.");
  col.name = newName;

  save();
  alert("Cambios guardados ✅");
  goDetail(col.id);
}

/* Backup UI meta */
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
   Eventos
----------------------------- */
document.addEventListener("click", (e) => {
  const btn = e.target?.closest?.("[data-action]");
  if (!btn) return;
  const action = btn.getAttribute("data-action");

  if (action === "dash-collections") return goCollections();
  if (action === "dash-loadedit") return goLoadEdit();
  if (action === "dash-settings") return goSettings();
  if (action === "dash-stats") return alert("Estadísticas: próximamente 😉");

  if (action === "go-create") return goCreate();
  if (action === "create-cancel") return goDash();
  if (action === "create-save") return createCollection();

  if (action === "open-edit") return goEdit();
  if (action === "reset-collection") return resetCollection();

  if (action === "filter-all") { state.detailFilter = "all"; syncFilterButtons(); return renderDetail(); }
  if (action === "filter-have") { state.detailFilter = "have"; syncFilterButtons(); return renderDetail(); }
  if (action === "filter-miss") { state.detailFilter = "miss"; syncFilterButtons(); return renderDetail(); }

  if (action === "edit-cancel") return goDetail(state.currentId);
  if (action === "edit-save") return applyEdit();

  if (action === "open-edit-picker") {
    els.editPicker?.classList.toggle("hidden");
    return;
  }
});

els.backBtn?.addEventListener("click", goBack);

els.btnOpenCollection?.addEventListener("click", () => {
  const id = els.collectionsSelect?.value;
  if (!id) return alert("No hay colección para abrir.");
  goDetail(id);
});

els.btnEditOpen?.addEventListener("click", () => {
  const id = els.editSelect?.value;
  if (!id) return alert("No hay colección para editar.");
  goEdit(id);
});

/* -----------------------------
   Init
----------------------------- */
function init() {
  load();                 // ✅ acá se recuperan tus datos
  renderCollectionsSelects();
  renderSettings();
  setView("dash");
  resetCreateForm();
  syncFilterButtons();
}

document.addEventListener("DOMContentLoaded", init);
/* =============================
   FIX iOS Incógnito: localStorage puede fallar
   - Evita que import/export "no haga nada"
   - Si storage está bloqueado, igual permite usar la app en memoria
============================= */

(() => {
  let warned = false;

  function canUseStorage() {
    try {
      const k = "__test__" + Date.now();
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  function warnIfNeeded() {
    if (warned) return;
    warned = true;
    alert(
      "⚠️ Estás en modo incógnito o el navegador bloquea el almacenamiento.\n\n" +
      "El backup se puede cargar, pero NO quedará guardado si cerrás la pestaña.\n" +
      "Para que se guarde, abrí la app en modo normal."
    );
  }

  // Re-definimos load/save de forma segura (sin tirar error)
  const _storageOK = canUseStorage();

  window.__storageOK = _storageOK;

  // Sobrescribe load()
  window.load = function load() {
    // Data
    try {
      const raw = _storageOK ? localStorage.getItem(LS_KEY) : null;
      state.data = raw ? JSON.parse(raw) : { collections: [] };
      if (!state.data.collections) state.data.collections = [];
    } catch {
      state.data = { collections: [] };
      if (!_storageOK) warnIfNeeded();
    }

    // Meta
    try {
      const mraw = _storageOK ? localStorage.getItem(META_KEY) : null;
      const m = JSON.parse(mraw || "{}");
      state.meta = { ...state.meta, ...m };
    } catch {
      if (!_storageOK) warnIfNeeded();
    }

    // migración suave (igual que antes)
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
      }
    }
  };

  // Sobrescribe save()
  window.save = function save() {
    if (!_storageOK) {
      warnIfNeeded();
      return; // seguimos en memoria sin romper
    }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state.data));
      localStorage.setItem(META_KEY, JSON.stringify(state.meta));
    } catch {
      warnIfNeeded();
    }
  };
})();
/* =============================
   FIX Import iOS: usar file.text() + errores visibles
   (no reemplaza nada: agrega un listener nuevo)
============================= */
(() => {
  const input = document.getElementById("importInput");
  if (!input) return;

  async function readFileAsText(file) {
    // iOS moderno: file.text() es lo más confiable
    if (file && typeof file.text === "function") {
      return await file.text();
    }
    // Fallback FileReader
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error("No se pudo leer el archivo (FileReader error)."));
      r.onabort = () => reject(new Error("Lectura cancelada."));
      r.onload = () => resolve(String(r.result || ""));
      r.readAsText(file);
    });
  }

  function migrateLoadedCollections() {
    // misma “migración suave” que ya usás en load/import
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
      }
    }
  }

  // Listener NUEVO (captura) para que funcione aunque el otro falle
  input.addEventListener("change", async (e) => {
    try {
      const file = e.target?.files?.[0];
      if (!file) return;

      const text = await readFileAsText(file);

      let raw;
      try {
        raw = JSON.parse(text);
      } catch (err) {
        alert("❌ El archivo no es JSON válido.\n\nTip: asegurate de elegir un .json exportado por la app.");
        return;
      }

      const normalized = (typeof normalizeImportedPayload === "function")
        ? normalizeImportedPayload(raw)
        : (raw?.data?.collections ? { collections: raw.data.collections } : raw?.collections ? { collections: raw.collections } : null);

      if (!normalized) {
        alert("❌ Este archivo no parece un backup válido de la app.");
        return;
      }

      const ok = confirm(
        "Importar backup (REEMPLAZAR):\n\n" +
        "Esto borrará TODO lo actual y cargará el contenido del backup.\n\n" +
        "¿Continuar?"
      );
      if (!ok) return;

      state.data.collections = Array.isArray(normalized.collections) ? normalized.collections : [];
      migrateLoadedCollections();

      // meta
      state.meta.lastImportAt = Date.now();
      state.meta.lastImportMode = "replace";

      // guardar + refrescar UI
      save();
      goHome();
      alert("✅ Backup importado correctamente.");
    } catch (err) {
      alert("❌ Error al importar el backup.\n\n" + (err?.message || String(err)));
    } finally {
      // importantísimo en iOS: si elegís el mismo archivo otra vez, si no lo reseteás no dispara change
      try { input.value = ""; } catch {}
    }
  }, true);
})();
