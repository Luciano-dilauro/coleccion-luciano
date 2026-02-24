/* =============================
   Colección Luciano - Arquitectura estable
   - Crear colecciones simples / por secciones
   - Soporta: num global, num por sección, secciones num con “numeración propia”
   - Soporta: alfanumérico PREFIJO+N por sección
   - Detalle: marcar tengo + repetidas (solo si tengo)
   - EDIT REAL: renombrar + editar secciones (nombre/cantidad/prefijo) sin perder progreso
   - Backup: export/import SOLO REEMPLAZAR (sin fusionar)
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

  // Create
  newName: $("newName"),
  structRadios: Array.from(document.querySelectorAll('input[name="structType"]')),
  simpleBlock: $("simpleBlock"),
  sectionsBlock: $("sectionsBlock"),
  simpleCount: $("simpleCount"),
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
      }
    } else {
      // simple
      if (!c.sections.length) {
        c.sections = [{ id: c.sections?.[0]?.id || uid("sec"), name: "General", format: "num", prefix: "", ownNumbering: false }];
      }
    }
  }
}

function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(state.data));
  localStorage.setItem(META_KEY, JSON.stringify(state.meta));
}

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

/* -----------------------------
   Views
----------------------------- */
function setView(view) {
  state.view = view;
  for (const v of els.views) v.classList.toggle("is-active", v.dataset.view === view);

  if (view === "home") {
    els.topbarTitle.textContent = "Mis Colecciones";
    els.backBtn.classList.add("hidden");
  } else if (view === "create") {
    els.topbarTitle.textContent = "Nueva colección";
    els.backBtn.classList.remove("hidden");
  } else if (view === "settings") {
    els.topbarTitle.textContent = "Ajustes / Backup";
    els.backBtn.classList.remove("hidden");
  } else if (view === "edit") {
    els.backBtn.classList.remove("hidden");
  } else {
    els.backBtn.classList.remove("hidden");
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function goHome() {
  state.currentId = null;
  renderHome();
  renderSettings();
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

function goSettings() {
  renderSettings();
  setView("settings");
}

function goEdit() {
  renderEdit();
  setView("edit");
}

/* -----------------------------
   Home
----------------------------- */
function renderHome() {
  if (!els.collectionsList) return;
  els.collectionsList.innerHTML = "";

  const cols = state.data.collections;

  if (!cols.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "Todavía no tenés colecciones. Tocá “Nueva”.";
    els.collectionsList.appendChild(empty);
    return;
  }

  for (const c of cols) {
    const st = computeStats(c);

    const row = document.createElement("button");
    row.type = "button";
    row.className = "collection-row";
    row.setAttribute("data-action", "open-collection");
    row.setAttribute("data-id", c.id);

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.flexDirection = "column";
    left.style.gap = "4px";

    const name = document.createElement("div");
    name.style.fontWeight = "950";
    name.style.fontSize = "16px";
    name.textContent = c.name;

    const meta = document.createElement("div");
    meta.className = "muted small";
    meta.textContent =
      c.structure === "sections"
        ? `Con secciones · num: ${c.numberMode === "global" ? "global" : "por sección"} · alfa: prefijos`
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
   Create
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
  els.numberMode.value = "global";
  els.structRadios.forEach(r => r.checked = (r.value === "simple"));
  syncCreateBlocks();

  els.sectionsEditor.innerHTML = "";
  // ejemplos por defecto
  addSectionRow(els.sectionsEditor, { name:"Equipo 1", format:"alfa", prefix:"EQ1", count:20, ownNumbering:true });
  addSectionRow(els.sectionsEditor, { name:"Equipo 2", format:"alfa", prefix:"EQ2", count:20, ownNumbering:true });
  addSectionRow(els.sectionsEditor, { name:"Especiales", format:"num", prefix:"", count:10, ownNumbering:true });
}

function addSectionRow(container, { name="", format="num", prefix="", count=10, ownNumbering=false } = {}) {
  const row = document.createElement("div");
  row.className = "section-row";
  row.setAttribute("data-section-row", "1");

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

  const del = document.createElement("button");
  del.type = "button";
  del.className = "icon-danger";
  del.textContent = "✕";
  del.addEventListener("click", () => row.remove());

  const syncRow = () => {
    const isAlfa = selFormat.value === "alfa";
    inPrefix.style.display = isAlfa ? "block" : "none";
    ownWrap.style.opacity = isAlfa ? "0.5" : "1";
    ownChk.disabled = isAlfa;
    if (isAlfa) ownChk.checked = true;
  };

  selFormat.addEventListener("change", syncRow);
  inPrefix.addEventListener("input", () => { inPrefix.value = normalizePrefix(inPrefix.value); });

  row.appendChild(inName);
  row.appendChild(selFormat);
  row.appendChild(inPrefix);
  row.appendChild(inCount);
  row.appendChild(ownWrap);
  row.appendChild(del);

  container.appendChild(row);
  syncRow();
}

els.btnAddSection?.addEventListener("click", () => {
  addSectionRow(els.sectionsEditor, {
    name: `Sección ${els.sectionsEditor.querySelectorAll("[data-section-row]").length + 1}`,
    format: "num",
    prefix: "",
    count: 10,
    ownNumbering: false
  });
});

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

    if (!name) return { ok:false, error:"Hay una sección sin nombre." };
    if (!Number.isFinite(count) || count <= 0) return { ok:false, error:`Cantidad inválida en "${name}".` };
    if (format === "alfa" && !prefix) return { ok:false, error:`La sección "${name}" es alfanumérica pero no tiene prefijo.` };

    out.push({
      name,
      format,
      prefix,
      count: clamp(count, 1, 5000),
      ownNumbering: (format === "alfa") ? true : !!ownNumbering
    });
  }

  if (!out.length) return { ok:false, error:"Agregá al menos 1 sección." };
  return { ok:true, sections: out };
}

function createCollection() {
  const name = (els.newName.value || "").trim();
  if (!name) return alert("Escribí un nombre.");

  const structure = getStructType();

  if (structure === "simple") {
    let count = parseInt(els.simpleCount.value || "0", 10);
    if (!Number.isFinite(count) || count <= 0) return alert("Cantidad inválida.");
    count = clamp(count, 1, 5000);

    const sectionId = uid("sec");
    const sections = [{ id: sectionId, name: "General", format: "num", prefix: "", ownNumbering: false }];

    const items = [];
    for (let i = 1; i <= count; i++) {
      items.push({
        id: uid("it"),
        sectionId,
        label: String(i),
        have: false,
        rep: 0,
        key: `num:${i}` // clave estable para editar sin perder progreso
      });
    }

    state.data.collections.push({
      id: uid("col"),
      name,
      createdAt: Date.now(),
      structure: "simple",
      numberMode: "global",
      sections,
      items
    });

    save();
    goHome();
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
    ownNumbering: !!s.ownNumbering
  }));

  const items = [];
  let globalCounter = 1;

  for (const sec of sections) {
    const sDef = read.sections.find(x => x.name === sec.name && x.prefix === sec.prefix && x.format === sec.format) || null;
    const count = sDef ? sDef.count : 1;

    if (sec.format === "alfa") {
      for (let i = 1; i <= count; i++) {
        const label = `${sec.prefix}${i}`;
        items.push({
          id: uid("it"),
          sectionId: sec.id,
          label,
          have: false,
          rep: 0,
          key: `alfa:${sec.prefix}:${i}`
        });
      }
      continue;
    }

    const sectionIsLocal = (numberMode === "perSection") || sec.ownNumbering;

    for (let i = 1; i <= count; i++) {
      const n = sectionIsLocal ? i : globalCounter;
      items.push({
        id: uid("it"),
        sectionId: sec.id,
        label: String(n),
        have: false,
        rep: 0,
        key: sectionIsLocal ? `numLocal:${sec.id}:${i}` : `numGlobal:${globalCounter}`
      });
      if (!sectionIsLocal) globalCounter += 1;
    }
  }

  state.data.collections.push({
    id: uid("col"),
    name,
    createdAt: Date.now(),
    structure: "sections",
    numberMode,
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
  wrap.className = "item" + (it.have ? " have" : "");

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
   EDIT REAL
----------------------------- */
function renderEdit() {
  const col = getCurrent();
  if (!col) return goHome();

  els.editTitle.textContent = `Editar: ${col.name}`;
  els.topbarTitle.textContent = "Editar";

  els.editName.value = col.name;

  // solo muestro editor de secciones si el álbum tiene secciones
  const isSections = col.structure === "sections";
  els.editSectionsArea.style.display = isSections ? "block" : "none";

  els.editSectionsEditor.innerHTML = "";

  if (isSections) {
    // reconstruyo filas con el “count real” por sección (lo calculo desde items)
    for (const sec of col.sections) {
      const count = col.items.filter(it => it.sectionId === sec.id).length;
      addSectionRow(els.editSectionsEditor, {
        name: sec.name,
        format: sec.format || "num",
        prefix: sec.prefix || "",
        count,
        ownNumbering: !!sec.ownNumbering
      });
      // guardo el id original en el row para mapear
      els.editSectionsEditor.lastElementChild.dataset.secId = sec.id;
    }
  }
}

els.editAddSection?.addEventListener("click", () => {
  addSectionRow(els.editSectionsEditor, {
    name: `Sección ${els.editSectionsEditor.querySelectorAll("[data-section-row]").length + 1}`,
    format: "num",
    prefix: "",
    count: 10,
    ownNumbering: false
  });
});

function applyEdit() {
  const col = getCurrent();
  if (!col) return goHome();

  const newName = (els.editName.value || "").trim();
  if (!newName) return alert("Nombre inválido.");
  col.name = newName;

  if (col.structure !== "sections") {
    save();
    renderHome();
    goDetail(col.id);
    alert("Cambios guardados ✅");
    return;
  }

  // leer secciones nuevas
  const read = readSections(els.editSectionsEditor);
  if (!read.ok) return alert(read.error);

  // Mapeo: intento conservar IDs existentes por fila si vienen con data-sec-id
  const rows = Array.from(els.editSectionsEditor.querySelectorAll("[data-section-row]"));

  // índice de items por key para conservar progreso
  const oldByKey = new Map();
  for (const it of col.items) oldByKey.set(it.key || `${it.sectionId}|${it.label}`, it);

  const newSections = [];
  const newItems = [];
  let globalCounter = 1;

  // para detectar si estamos usando global o perSection
  const numberMode = col.numberMode === "perSection" ? "perSection" : "global";

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    const inputs = r.querySelectorAll("input, select");
    const secName = (inputs[0]?.value || "").trim();
    const format = (inputs[1]?.value === "alfa") ? "alfa" : "num";
    const prefix = normalizePrefix(inputs[2]?.value || "");
    const count = clamp(parseInt(inputs[3]?.value || "0", 10), 1, 5000);
    const ownNumbering = (format === "alfa") ? true : !!inputs[4]?.checked;

    const existingId = r.dataset.secId || null;
    const secId = existingId || uid("sec");

    newSections.push({ id: secId, name: secName, format, prefix, ownNumbering });

    if (format === "alfa") {
      for (let i = 1; i <= count; i++) {
        const key = `alfa:${prefix}:${i}`;
        const label = `${prefix}${i}`;
        const old = oldByKey.get(key);

        newItems.push({
          id: old?.id || uid("it"),
          sectionId: secId,
          label,
          have: !!old?.have,
          rep: old?.rep || 0,
          key
        });
      }
      continue;
    }

    const sectionIsLocal = (numberMode === "perSection") || ownNumbering;

    for (let i = 1; i <= count; i++) {
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
        key
      });

      if (!sectionIsLocal) globalCounter += 1;
    }
  }

  col.sections = newSections;
  col.items = newItems;

  save();
  renderHome();
  goDetail(col.id);
  alert("Cambios guardados ✅");
}

/* -----------------------------
   Backup (SOLO REEMPLAZAR)
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

      // migración suave post-import
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
          }
        } else {
          if (!c.sections.length) {
            c.sections = [{ id: uid("sec"), name:"General", format:"num", prefix:"", ownNumbering:false }];
          }
        }
      }

      state.meta.lastImportAt = Date.now();
      state.meta.lastImportMode = "replace";
      save();

      goHome();
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
   Eventos globales
----------------------------- */
document.addEventListener("click", (e) => {
  const btn = e.target?.closest?.("[data-action]");
  if (!btn) return;

  const action = btn.getAttribute("data-action");

  if (action === "go-home") return goHome();
  if (action === "go-create") return goCreate();
  if (action === "create-cancel") return goHome();
  if (action === "create-save") return createCollection();

  if (action === "go-settings") return goSettings();

  if (action === "open-collection") {
    const id = btn.getAttribute("data-id");
    if (id) return goDetail(id);
  }

  if (action === "open-edit") return goEdit();
  if (action === "edit-cancel") return goDetail(state.currentId);
  if (action === "edit-save") return applyEdit();

  if (action === "reset-collection") return resetCollection();

  if (action === "export-backup") return exportBackup();
});

els.backBtn?.addEventListener("click", () => goHome());

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
  renderHome();
  renderSettings();
  setView("home");
  resetCreateForm();
}

document.addEventListener("DOMContentLoaded", init);
