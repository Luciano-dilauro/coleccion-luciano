/* =============================
   Colección Lucho - Arquitectura estable (v2.3.1)
   Cambios:
   ✅ Dashboard (4 botones)
   ✅ Mis colecciones: selector desplegable
   ✅ "Nueva" sale de Mis colecciones -> queda en Carga/Edición
   ✅ "Editar" sale del detalle -> queda en Carga/Edición
   ✅ Al crear, la colección queda arriba
============================= */

const LS_KEY = "coleccion_luciano_v2";
const META_KEY = "coleccion_luciano_meta_v2";
const BACKUP_VERSION = 1;

const $ = (id) => document.getElementById(id);

const els = {
  backBtn: $("backBtn"),
  topbarTitle: $("topbarTitle"),
  views: Array.from(document.querySelectorAll("[data-view]")),

  // dashboard (no necesita ids)

  // collections
  collectionsSelect: $("collectionsSelect"),

  // manage
  editSelect: $("editSelect"),

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
  }
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
  return String(p || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function parseCodesList(input) {
  return String(input || "").split(",").map(s => s.trim()).filter(Boolean);
}
function parsePrefixList(input) {
  return String(input || "")
    .split(/[,;\n\r]+/g)
    .map(s => normalizePrefix(s))
    .filter(Boolean);
}
function normCode(s) { return String(s || "").trim().toUpperCase(); }

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
        c.sections = [{ id: uid("sec"), name: "General", format: "num", prefix: "", ownNumbering: false, specials: [] }];
      }
      if (!Array.isArray(c.sections[0].specials)) c.sections[0].specials = [];
    }

    for (const it of c.items) {
      if (typeof it.special !== "boolean") it.special = false;
      if (!it.key) it.key = `${it.sectionId}|${it.label}`;
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

  if (view === "dash") {
    els.topbarTitle.textContent = "Colecciones";
    els.backBtn.classList.add("hidden");
  } else {
    els.backBtn.classList.remove("hidden");
    if (view === "collections") els.topbarTitle.textContent = "Mis colecciones";
    if (view === "manage") els.topbarTitle.textContent = "Carga / Edición";
    if (view === "create") els.topbarTitle.textContent = "Nueva colección";
    if (view === "editPicker") els.topbarTitle.textContent = "Editar";
    if (view === "settings") els.topbarTitle.textContent = "Ajustes / Backup";
    if (view === "stats") els.topbarTitle.textContent = "Estadísticas";
    if (view === "detail") {
      const col = getCurrent();
      els.topbarTitle.textContent = col ? col.name : "Colección";
    }
    if (view === "edit") els.topbarTitle.textContent = "Editar";
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function goDash(){ state.currentId = null; setView("dash"); }
function goCollections(){ renderCollectionsSelects(); setView("collections"); }
function goManage(){ renderCollectionsSelects(); setView("manage"); }
function goCreate(){ resetCreateForm(); ensureBulkBuilderUI(); setView("create"); }
function goSettings(){ renderSettings(); setView("settings"); }
function goStats(){ setView("stats"); }

function goDetail(id){
  state.currentId = id;
  renderDetail();
  setView("detail");
}

function goEditPicker(){
  renderCollectionsSelects();
  setView("editPicker");
}

function goEdit(){
  renderEdit();
  setView("edit");
}

/* -----------------------------
   Selects: Mis colecciones / Editar
----------------------------- */
function renderCollectionsSelects() {
  const cols = [...state.data.collections];

  // más nuevas arriba (si no hay createdAt, las deja igual)
  cols.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));

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

  // si no hay currentId, selecciono la primera
  if (!state.currentId && cols.length) state.currentId = cols[0].id;

  if (els.collectionsSelect && state.currentId) els.collectionsSelect.value = state.currentId;
  if (els.editSelect && state.currentId) els.editSelect.value = state.currentId;
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
    ensureBulkBuilderUI();
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
   Bulk builder (se inyecta arriba del editor)
----------------------------- */
function ensureBulkBuilderUI() {
  if (!els.sectionsBlock || !els.sectionsEditor) return;
  if ($("bulkBuilder")) return;

  const wrap = document.createElement("div");
  wrap.id = "bulkBuilder";
  wrap.className = "card";
  wrap.style.marginBottom = "12px";

  wrap.innerHTML = `
    <div class="h2" style="margin-bottom:10px; text-align:center;">Generador rápido (coma)</div>
    <div class="muted small" style="margin-bottom:10px; text-align:center;">
      Ej: RIA, BAE, ATL
    </div>

    <div class="field">
      <label>Prefijos (coma)</label>
      <textarea id="bulkPrefixes" class="input" rows="3" placeholder="RIA, BAE, ATL"></textarea>
    </div>

    <div class="field">
      <label>Cantidad por equipo</label>
      <input id="bulkCount" class="input" type="number" min="1" max="5000" value="20" />
    </div>

    <label class="inline-check" style="margin-top:8px;">
      <input id="bulkAddSpecialSection" type="checkbox" checked />
      <span>Agregar “Especiales” (numérica con numeración propia)</span>
    </label>

    <div class="field" style="margin-top:10px;">
      <label>Cantidad en “Especiales”</label>
      <input id="bulkSpecialCount" class="input" type="number" min="1" max="5000" value="10" />
    </div>

    <div class="row gap" style="margin-top:12px;">
      <button id="btnBulkGenerate" class="btn primary full" type="button">Generar secciones</button>
    </div>

    <div class="muted small" style="margin-top:10px; text-align:center;">
      Reemplaza todas las secciones actuales.
    </div>
  `;

  els.sectionsBlock.insertBefore(wrap, els.sectionsEditor);

  const bulkPrefixes = $("bulkPrefixes");
  const bulkCount = $("bulkCount");
  const bulkAddSpecialSection = $("bulkAddSpecialSection");
  const bulkSpecialCount = $("bulkSpecialCount");
  const btnBulkGenerate = $("btnBulkGenerate");

  btnBulkGenerate?.addEventListener("click", () => {
    const list = parsePrefixList(bulkPrefixes?.value || "");
    if (!list.length) return alert("Pegá al menos 1 prefijo (coma).");

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
    `Especiales (coma)\n${hint}\n\nEj: 7, 10, 55  o  RIA1, RIA7\n\nActual:\n${current}`,
    current
  );
  if (txt === null) return null;
  const list = parseCodesList(txt).map(normCode);
  return Array.from(new Set(list));
}

/* -----------------------------
   Reordenar y filas secciones
   (igual a tu v2.3)
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
  actions.style.gap = "6px";

  const upBtn = document.createElement("button");
  upBtn.type = "button";
  upBtn.className = "icon-lite";
  upBtn.title = "Subir sección";
  upBtn.textContent = "↑";
  upBtn.addEventListener("click", (e) => { e.stopPropagation(); moveRow(container, row, -1); });

  const downBtn = document.createElement("button");
  downBtn.type = "button";
  downBtn.className = "icon-lite";
  downBtn.title = "Bajar sección";
  downBtn.textContent = "↓";
  downBtn.addEventListener("click", (e) => { e.stopPropagation(); moveRow(container, row, +1); });

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
    const hint = isAlfa ? `Sección "${secName}" (Alfa) · Prefijo: ${pref || "(sin prefijo)"}` : `Sección "${secName}" (Numérica)`;

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

  del.addEventListener("click", (e) => { e.stopPropagation(); row.remove(); });

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
   Drag & Drop opcional
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
   Leer secciones desde UI
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
      name, format, prefix,
      count: clamp(count, 1, 5000),
      ownNumbering: (format === "alfa") ? true : !!ownNumbering,
      specials
    });
  }

  if (!out.length) return { ok:false, error:"Agregá al menos 1 sección." };
  return { ok:true, sections: out, rows };
}

/* -----------------------------
   Botón agregar sección (create)
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
  const name = (els.newName.value || "").trim();
  if (!name) return alert("Escribí un nombre.");

  const structure = getStructType();

  if (structure === "simple") {
    let count = parseInt(els.simpleCount.value || "0", 10);
    if (!Number.isFinite(count) || count <= 0) return alert("Cantidad inválida.");
    count = clamp(count, 1, 5000);

    const sectionId = uid("sec");
    const specials = parseCodesList(els.simpleSpecials.value).map(normCode);
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

    // ✅ nueva arriba
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
    renderCollectionsSelects();
    setView("manage");
    alert("Colección creada ✅");
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

  // ✅ nueva arriba
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
  renderCollectionsSelects();
  setView("manage");
  alert("Colección creada ✅");
}

/* -----------------------------
   Detail
----------------------------- */
function renderDetail() {
  const col = getCurrent();
  if (!col) return goDash();

  els.detailTitle.textContent = col.name;
  els.topbarTitle.textContent = col.name;

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
    const card = document.createElement("div");
    card.className = "section-card";

    const title = document.createElement("div");
    title.className = "section-title";
    title.textContent = sec.name;

    const grid = document.createElement("div");
    grid.className = "items-grid";

    const items = bySec.get(sec.id) || [];
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

/* -----------------------------
   Edit (igual a tu v2.3)
----------------------------- */
function renderEdit() {
  const col = getCurrent();
  if (!col) return goDash();

  els.editTitle.textContent = `Editar: ${col.name}`;
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

  if (col.structure !== "sections") {
    save();
    alert("Cambios guardados ✅");
    return goDetail(col.id);
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
  alert("Cambios guardados ✅");
  goDetail(col.id);
}

/* -----------------------------
   Backup
----------------------------- */
function exportBackup() {
  const payload = { backupVersion: BACKUP_VERSION, exportedAt: Date.now(), app: "ColeccionLucho", data: state.data };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `backup-colecciones-lucho-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  state.meta.lastExportAt = Date.now();
  state.meta.lastExportSize = blob.size;
  save();
  renderSettings();
  alert("Backup exportado ✅");
}

function normalizeImportedPayload(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (obj.data && obj.data.collections) return { collections: Array.isArray(obj.data.collections) ? obj.data.collections : [] };
  if (obj.collections) return { collections: Array.isArray(obj.collections) ? obj.collections : [] };
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
          if (!c.sections.length) c.sections = [{ id: uid("sec"), name:"General", format:"num", prefix:"", ownNumbering:false, specials:[] }];
          if (!Array.isArray(c.sections[0].specials)) c.sections[0].specials = [];
        }

        for (const it of c.items) {
          if (typeof it.special !== "boolean") it.special = false;
          if (!it.key) it.key = `${it.sectionId}|${it.label}`;
        }
      }

      state.meta.lastImportAt = Date.now();
      state.meta.lastImportMode = "replace";
      save();

      renderCollectionsSelects();
      goDash();
      alert("Backup importado ✅ (Reemplazar)");
    } catch {
      alert("Error al importar el backup.");
    }
  };
  reader.readAsText(file);
}

function renderSettings() {
  if (els.exportMeta) els.exportMeta.textContent = `Último: ${formatDateTime(state.meta.lastExportAt)} · Tamaño: ${formatBytes(state.meta.lastExportSize)}`;
  if (els.importMeta) els.importMeta.textContent = `Último: ${formatDateTime(state.meta.lastImportAt)} · Modo: Reemplazar`;
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

  if (action === "go-dash") return goDash();
  if (action === "go-collections") return goCollections();
  if (action === "go-manage") return goManage();
  if (action === "go-settings") return goSettings();
  if (action === "go-stats") return goStats();

  if (action === "go-create") return goCreate();
  if (action === "create-cancel") return goManage();
  if (action === "create-save") return createCollection();

  if (action === "open-selected-collection") {
    const id = els.collectionsSelect?.value || "";
    if (!id) return alert("No hay colecciones.");
    state.currentId = id;
    return goDetail(id);
  }

  if (action === "go-edit-picker") return goEditPicker();

  if (action === "open-edit-selected") {
    const id = els.editSelect?.value || "";
    if (!id) return alert("No hay colecciones.");
    state.currentId = id;
    return goEdit();
  }

  if (action === "edit-cancel") return goManage();
  if (action === "edit-save") return applyEdit();

  if (action === "reset-collection") return resetCollection();

  if (action === "export-backup") return exportBackup();
});

els.collectionsSelect?.addEventListener("change", () => {
  state.currentId = els.collectionsSelect.value || null;
});
els.editSelect?.addEventListener("change", () => {
  state.currentId = els.editSelect.value || null;
});

els.backBtn?.addEventListener("click", () => {
  // back inteligente
  if (state.view === "detail") return goCollections();
  if (state.view === "collections") return goDash();
  if (state.view === "manage") return goDash();
  if (state.view === "create") return goManage();
  if (state.view === "editPicker") return goManage();
  if (state.view === "edit") return goManage();
  if (state.view === "settings") return goDash();
  if (state.view === "stats") return goDash();
  return goDash();
});

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
  renderSettings();
  renderCollectionsSelects();
  setView("dash");
  resetCreateForm();
  ensureBulkBuilderUI();
}

document.addEventListener("DOMContentLoaded", init);
// 🔒 Punto seguro
