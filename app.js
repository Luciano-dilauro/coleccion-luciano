/* =============================
   Colección Luciano - V2.3 (Arquitectura)
   - Colecciones simples y con secciones
   - Secciones numéricas (global/perSection + numeración propia)
   - Secciones alfanuméricas con prefijo (PREFIJO+N)
   - Backup Pro (export/import) con versión + reemplazar/fusionar
============================= */

const LS_KEY = "coleccion_luciano_v2";
const META_KEY = "coleccion_luciano_meta_v2";

const BACKUP_VERSION = 1;

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

  // Settings / Backup
  importInput: document.getElementById("importInput"),
  exportMeta: document.getElementById("exportMeta"),
  importMeta: document.getElementById("importMeta"),
  storageMeta: document.getElementById("storageMeta"),
};

const state = {
  view: "home",
  currentId: null,
  data: { collections: [] },
  meta: {
    lastExportAt: null,
    lastExportSize: null,
    lastImportAt: null,
    lastImportMode: null, // "replace" | "merge"
  }
};

/* -----------------------------
   Persistencia + migración suave
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

  // migración suave de secciones
  for (const c of state.data.collections) {
    if (c.structure === "sections" && Array.isArray(c.sections)) {
      for (const s of c.sections) {
        if (!s.format) s.format = "num"; // num | alfa
        if (typeof s.prefix !== "string") s.prefix = "";
        if (typeof s.ownNumbering !== "boolean") s.ownNumbering = false;
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

function formatDateTime(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "—";
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B","KB","MB","GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
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
  } else if (view === "settings") {
    els.topbarTitle.textContent = "Ajustes / Backup";
    els.backBtn.classList.remove("hidden");
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
  setView("detail");
  const col = getCurrent();
  if (col) els.topbarTitle.textContent = col.name;
}

function goSettings() {
  renderSettings();
  setView("settings");
}

/* -----------------------------
   Home render
----------------------------- */
function renderHome() {
  if (!els.collectionsList) return;
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
    if (c.structure === "sections") {
      meta.textContent = `Con secciones · num: ${c.numberMode === "global" ? "global" : "por sección"} · + prefijos`;
    } else {
      meta.textContent = "Simple";
    }

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
   Create form
----------------------------- */
function getStructType() {
  const r = els.structRadios.find(x => x.checked);
  return r ? r.value : "simple";
}

function resetCreateForm() {
  if (els.newName) els.newName.value = "";
  if (els.simpleCount) els.simpleCount.value = "100";
  if (els.numberMode) els.numberMode.value = "global";

  els.structRadios.forEach(r => r.checked = (r.value === "simple"));
  syncCreateBlocks();

  if (els.sectionsEditor) {
    els.sectionsEditor.innerHTML = "";
    // ejemplo inicial útil
    addSectionRow({ name: "Equipo 1", format: "alfa", prefix: "EQ1", count: 20, ownNumbering: true });
    addSectionRow({ name: "Equipo 2", format: "alfa", prefix: "EQ2", count: 20, ownNumbering: true });
    addSectionRow({ name: "Especiales", format: "num", prefix: "", count: 10, ownNumbering: true });
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

function normalizePrefix(p) {
  return String(p || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function addSectionRow({ name = "", format = "num", prefix = "", count = 10, ownNumbering = false } = {}) {
  const row = document.createElement("div");
  row.className = "section-row";
  row.setAttribute("data-section-row", "1");

  const inName = document.createElement("input");
  inName.className = "input";
  inName.type = "text";
  inName.placeholder = "Nombre (Ej: River / Boca / Especiales)";
  inName.value = name;

  const selFormat = document.createElement("select");
  selFormat.className = "input";
  selFormat.innerHTML = `
    <option value="num">Numérico (1..N)</option>
    <option value="alfa">Alfanumérico (PREFIJO+N)</option>
  `;
  selFormat.value = (format === "alfa") ? "alfa" : "num";

  const inPrefix = document.createElement("input");
  inPrefix.className = "input";
  inPrefix.type = "text";
  inPrefix.placeholder = "Prefijo (Ej: RIA)";
  inPrefix.value = prefix;

  const inCount = document.createElement("input");
  inCount.className = "input";
  inCount.type = "number";
  inCount.min = "1";
  inCount.max = "5000";
  inCount.value = String(count);

  const ownWrap = document.createElement("label");
  ownWrap.className = "inline-check";
  ownWrap.title = "Si activás esto, esta sección numérica reinicia aunque el modo principal sea global.";
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

  const syncRowUI = () => {
    const isAlfa = selFormat.value === "alfa";
    inPrefix.style.display = isAlfa ? "block" : "none";

    // alfa => siempre local, numeración propia no aplica (pero conceptualmente sí)
    ownWrap.style.opacity = isAlfa ? "0.5" : "1";
    ownChk.disabled = isAlfa;
    if (isAlfa) ownChk.checked = true;
  };

  selFormat.addEventListener("change", syncRowUI);
  inPrefix.addEventListener("input", () => { inPrefix.value = normalizePrefix(inPrefix.value); });

  row.appendChild(inName);
  row.appendChild(selFormat);
  row.appendChild(inPrefix);
  row.appendChild(inCount);
  row.appendChild(ownWrap);
  row.appendChild(del);

  els.sectionsEditor.appendChild(row);
  syncRowUI();
}

els.btnAddSection?.addEventListener("click", () => {
  addSectionRow({
    name: `Sección ${els.sectionsEditor.querySelectorAll("[data-section-row]").length + 1}`,
    format: "num",
    prefix: "",
    count: 10,
    ownNumbering: false
  });
});

function readSectionsFromEditor() {
  const rows = Array.from(els.sectionsEditor.querySelectorAll("[data-section-row]"));
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

    if (format === "alfa" && !prefix) {
      return { ok:false, error:`La sección "${name}" es alfanumérica pero no tiene prefijo.` };
    }

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
  const name = (els.newName?.value || "").trim();
  if (!name) return alert("Escribí un nombre.");

  const structure = getStructType();

  if (structure === "simple") {
    let count = parseInt(els.simpleCount?.value || "0", 10);
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
        globalNo: i,
        localNo: null,
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
    renderHome();
    goHome();
    return;
  }

  const numberMode = (els.numberMode?.value === "perSection") ? "perSection" : "global";

  const read = readSectionsFromEditor();
  if (!read.ok) return alert(read.error);

  const sections = read.sections.map(s => ({
    id: uid("sec"),
    name: s.name,
    count: s.count,
    format: s.format,
    prefix: s.prefix,
    ownNumbering: s.ownNumbering
  }));

  const items = [];
  let globalCounter = 1;

  for (const sec of sections) {
    if (sec.format === "alfa") {
      for (let i = 1; i <= sec.count; i++) {
        items.push({
          id: uid("it"),
          sectionId: sec.id,
          label: `${sec.prefix}${i}`,
          have: false,
          rep: 0,
          globalNo: null,
          localNo: i
        });
      }
      continue;
    }

    const sectionIsLocal = (numberMode === "perSection") || sec.ownNumbering;

    for (let i = 1; i <= sec.count; i++) {
      const label = sectionIsLocal ? String(i) : String(globalCounter);

      items.push({
        id: uid("it"),
        sectionId: sec.id,
        label,
        have: false,
        rep: 0,
        globalNo: sectionIsLocal ? null : globalCounter,
        localNo: sectionIsLocal ? i : null
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
    sections: sections.map(s => ({
      id: s.id,
      name: s.name,
      format: s.format,
      prefix: s.prefix,
      ownNumbering: !!s.ownNumbering
    })),
    items
  });

  save();
  renderHome();
  goHome();
}

/* -----------------------------
   Detail render
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

/* -----------------------------
   Reset
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
   Backup Pro
----------------------------- */
function exportBackup() {
  // payload versionado
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
  // Permite importar:
  // - formato nuevo: {backupVersion, data:{collections:[]}}
  // - formato “directo”: {collections:[]}
  if (!obj || typeof obj !== "object") return null;

  if (obj.data && obj.data.collections) {
    return { collections: Array.isArray(obj.data.collections) ? obj.data.collections : [] };
  }

  if (obj.collections) {
    return { collections: Array.isArray(obj.collections) ? obj.collections : [] };
  }

  return null;
}

function mergeCollections(current, incoming) {
  const cur = Array.isArray(current) ? current : [];
  const inc = Array.isArray(incoming) ? incoming : [];

  const ids = new Set(cur.map(c => c.id));
  const out = cur.slice();

  for (const c of inc) {
    // si no tiene id, le genero uno (protección)
    if (!c.id) c.id = uid("col");

    if (ids.has(c.id)) {
      // conflicto: creo un id nuevo para no pisar
      const copy = structuredCloneSafe(c);
      copy.id = uid("col");
      copy.name = `${copy.name || "Colección"} (import)`;
      out.push(copy);
      ids.add(copy.id);
    } else {
      out.push(c);
      ids.add(c.id);
    }
  }

  return out;
}

function structuredCloneSafe(obj) {
  try { return structuredClone(obj); } catch { return JSON.parse(JSON.stringify(obj)); }
}

function handleImportFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = JSON.parse(reader.result);
      const normalized = normalizeImportedPayload(raw);
      if (!normalized) {
        alert("Este archivo no parece un backup válido.");
        return;
      }

      const incomingCols = normalized.collections || [];
      const hasAnything = state.data.collections.length > 0;

      let mode = "replace";
      if (hasAnything) {
        const pick = prompt(
          "Importar backup:\n\n1 = Reemplazar TODO (borra lo actual)\n2 = Fusionar (agrega sin borrar)\n\nEscribí 1 o 2",
          "2"
        );
        mode = (String(pick || "2").trim() === "1") ? "replace" : "merge";
      }

      if (mode === "replace") {
        const ok = confirm("¿Seguro que querés REEMPLAZAR todo? Esto borra lo que tenés ahora.");
        if (!ok) return;

        state.data.collections = incomingCols;
      } else {
        state.data.collections = mergeCollections(state.data.collections, incomingCols);
      }

      // migración suave de secciones
      for (const c of state.data.collections) {
        if (!c.items) c.items = [];
        if (!c.sections) c.sections = [];
        if (!c.structure) c.structure = "simple";

        if (c.structure === "sections") {
          for (const s of c.sections) {
            if (!s.format) s.format = "num";
            if (typeof s.prefix !== "string") s.prefix = "";
            if (typeof s.ownNumbering !== "boolean") s.ownNumbering = false;
          }
        }
      }

      state.meta.lastImportAt = Date.now();
      state.meta.lastImportMode = mode;
      save();

      renderHome();
      renderSettings();
      alert(`Backup importado ✅ (${mode === "replace" ? "Reemplazar" : "Fusionar"})`);
    } catch (err) {
      alert("Error al importar el backup.");
    }
  };
  reader.readAsText(file);
}

/* -----------------------------
   Settings render
----------------------------- */
function renderSettings() {
  if (els.exportMeta) {
    els.exportMeta.textContent =
      `Último: ${formatDateTime(state.meta.lastExportAt)} · Tamaño: ${formatBytes(state.meta.lastExportSize)}`;
  }

  if (els.importMeta) {
    const modeTxt = state.meta.lastImportMode
      ? (state.meta.lastImportMode === "replace" ? "Reemplazar" : "Fusionar")
      : "—";
    els.importMeta.textContent =
      `Último: ${formatDateTime(state.meta.lastImportAt)} · Modo: ${modeTxt}`;
  }

  if (els.storageMeta) {
    // tamaño aproximado del JSON en storage (para que veas “peso”)
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

  if (action === "go-create") return goCreate();
  if (action === "create-cancel") return goHome();
  if (action === "create-save") return createCollection();

  if (action === "go-settings") return goSettings();

  if (action === "open-collection") {
    const id = btn.getAttribute("data-id");
    if (id) return goDetail(id);
  }

  if (action === "reset-collection") return resetCollection();

  if (action === "export-backup") return exportBackup();
});

els.backBtn?.addEventListener("click", () => {
  // vuelve a home desde cualquier pantalla
  goHome();
});

els.importInput?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  handleImportFile(file);
  // reset para poder importar el mismo archivo otra vez si hace falta
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
