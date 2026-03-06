/* Colección Lucho — v4 */

const LS_KEY = "coleccion_luciano_v4";

const state = {
  data: { collections: [] },
  currentId: null,
};

const $ = (id) => document.getElementById(id);

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    state.data = raw ? JSON.parse(raw) : { collections: [] };
    if (!state.data || !Array.isArray(state.data.collections)) {
      state.data = { collections: [] };
    }
  } catch {
    state.data = { collections: [] };
  }
}

function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(state.data));
}

function uid() {
  return crypto.randomUUID();
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCurrent() {
  if (!state.currentId) return null;
  return state.data.collections.find((c) => c.id === state.currentId) || null;
}

function parseSectionsInput(raw) {
  const lines = String(raw || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const [nameRaw = "", prefixRaw = "", countRaw = ""] = line.split("|").map((s) => s.trim());
    return {
      name: nameRaw || "Sección",
      prefix: prefixRaw || "",
      count: clamp(Number(countRaw || 0), 1, 999),
    };
  }).filter((s) => s.count > 0);
}

function buildSimpleCollection(name, count) {
  const section = {
    id: uid(),
    name: "General",
    prefix: "",
    count,
  };

  const items = [];
  for (let i = 1; i <= count; i++) {
    items.push({
      id: uid(),
      sectionId: section.id,
      label: String(i),
      have: false,
      rep: 0,
      special: false,
    });
  }

  return {
    id: uid(),
    name,
    structure: "simple",
    numberMode: "global",
    sections: [section],
    items,
    createdAt: Date.now(),
  };
}

function buildSectionsCollection(name, sectionsDef, numberMode) {
  const sections = sectionsDef.map((sec) => ({
    id: uid(),
    name: sec.name,
    prefix: sec.prefix,
    count: sec.count,
  }));

  const items = [];
  let globalCounter = 1;

  for (const sec of sections) {
    for (let i = 1; i <= sec.count; i++) {
      let label = "";

      if (numberMode === "global") {
        label = String(globalCounter);
      } else {
        label = sec.prefix ? `${sec.prefix}${i}` : String(i);
      }

      items.push({
        id: uid(),
        sectionId: sec.id,
        label,
        have: false,
        rep: 0,
        special: false,
      });

      globalCounter += 1;
    }
  }

  return {
    id: uid(),
    name,
    structure: "sections",
    numberMode,
    sections,
    items,
    createdAt: Date.now(),
  };
}

function createCollection() {
  const name = ($("#newCollectionName")?.value || "").trim();
  const mode = $("#buildMode")?.value || "simple";
  const numberMode = $("#numberMode")?.value || "perSection";

  if (!name) {
    alert("Poné un nombre para la colección.");
    return;
  }

  let col = null;

  if (mode === "simple") {
    const count = clamp(Number($("#simpleCount")?.value || 0), 1, 999);
    col = buildSimpleCollection(name, count);
  } else {
    const sections = parseSectionsInput($("#sectionsInput")?.value || "");
    if (!sections.length) {
      alert("Cargá al menos una sección.");
      return;
    }
    col = buildSectionsCollection(name, sections, numberMode);
  }

  state.data.collections.push(col);
  save();
  renderCollections();

  $("#newCollectionName").value = "";
}

function renderCollections() {
  const list = $("collectionsList");
  if (!list) return;

  list.innerHTML = "";

  for (const col of state.data.collections) {
    const div = document.createElement("div");
    div.className = "card collection-card";
    div.textContent = col.name;
    div.addEventListener("click", () => openCollection(col.id));
    list.appendChild(div);
  }

  const status = $("status");
  if (status) {
    status.textContent = `v4 lista ✅ (colecciones: ${state.data.collections.length})`;
  }
}

function openCollection(id) {
  const col = state.data.collections.find((c) => c.id === id);
  if (!col) return;

  state.currentId = id;

  const list = $("collectionsList");
  const view = $("collectionView");
  if (list) list.style.display = "none";
  if (view) view.style.display = "block";

  renderCollectionView();
}

function closeCollectionView() {
  const list = $("collectionsList");
  const view = $("collectionView");
  if (view) view.style.display = "none";
  if (list) list.style.display = "block";
  state.currentId = null;
}

function renderCollectionView() {
  const col = getCurrent();
  const view = $("collectionView");
  if (!view) return;

  if (!col) {
    closeCollectionView();
    return;
  }

  view.innerHTML = `
    <div class="card">
      <button id="backBtn" class="btn" type="button">← Volver</button>
      <h2>${escapeHtml(col.name)}</h2>

      <div class="collection-stats">
        <p class="muted">Colección abierta</p>
        <p class="muted" id="repsText"></p>
        <p class="muted" id="progressText"></p>
      </div>

      <div class="row gap collection-tools">
        <button id="btnMissingBySection" class="btn" type="button">Copiar faltantes</button>
        <button id="btnRepeatedBySection" class="btn" type="button">Copiar repetidas</button>
      </div>

      <div id="sectionsContainer"></div>
    </div>
  `;

  $("backBtn")?.addEventListener("click", closeCollectionView);

  $("btnMissingBySection")?.addEventListener("click", () => {
    const current = getCurrent();
    if (!current) return;
    copyText(buildMissingTextBySection(current));
  });

  $("btnRepeatedBySection")?.addEventListener("click", () => {
    const current = getCurrent();
    if (!current) return;
    copyText(buildRepeatedTextBySection(current));
  });

  renderStickers();
}

function renderStickers() {
  const col = getCurrent();
  const container = $("sectionsContainer");
  if (!container || !col) return;

  container.innerHTML = "";

  const sections = col.sections || [];
  const items = col.items || [];

  for (const sec of sections) {
    const block = document.createElement("div");
    block.className = "section-block";

    if (col.structure === "sections") {
      const title = document.createElement("div");
      title.className = "section-title";
      title.textContent = sec.name;
      block.appendChild(title);
    }

    const grid = document.createElement("div");
    grid.className = "items-grid";

    const secItems = items.filter((it) => it.sectionId === sec.id);

    for (const it of secItems) {
      const cell = document.createElement("div");
      cell.className = "item" + (it.have ? " have" : "") + (it.special ? " special" : "");
      cell.textContent = it.label;

      if ((it.rep || 0) > 0) {
        const badge = document.createElement("div");
        badge.className = "rep-badge";
        badge.textContent = String(it.rep);
        cell.appendChild(badge);
      }

      let pressTimer = null;
      let longPressTriggered = false;
      let touchStarted = false;

      const startLongPress = () => {
        longPressTriggered = false;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
          longPressTriggered = true;
          handleLongTap(it);
        }, 500);
      };

      const clearLongPress = () => {
        clearTimeout(pressTimer);
        pressTimer = null;
      };

      cell.addEventListener("click", (e) => {
        if (longPressTriggered) {
          longPressTriggered = false;
          return;
        }
        handleTap(it);
      });

      cell.addEventListener("touchstart", () => {
        touchStarted = true;
        startLongPress();
      }, { passive: true });

      cell.addEventListener("touchend", () => {
        clearLongPress();
        setTimeout(() => { touchStarted = false; }, 0);
      });

      cell.addEventListener("touchcancel", () => {
        clearLongPress();
        touchStarted = false;
      });

      cell.addEventListener("mousedown", () => {
        if (touchStarted) return;
        startLongPress();
      });

      cell.addEventListener("mouseup", clearLongPress);
      cell.addEventListener("mouseleave", clearLongPress);

      grid.appendChild(cell);
    }

    block.appendChild(grid);
    container.appendChild(block);
  }

  const owned = items.filter((i) => i.have).length;
  const total = items.length;
  const percent = total ? Math.round((owned / total) * 100) : 0;
  const reps = items.reduce((sum, i) => sum + (i.rep || 0), 0);

  const progress = $("progressText");
  if (progress) {
    progress.textContent = `Progreso: ${owned} / ${total} (${percent}%) • Faltan: ${total - owned}`;
  }

  const repsEl = $("repsText");
  if (repsEl) {
    repsEl.textContent = `Repetidas: ${reps}`;
  }
}

function handleTap(it) {
  if (!it.have) {
    it.have = true;
    it.rep = 0;
  } else {
    it.rep = (it.rep || 0) + 1;
  }
  save();
  renderStickers();
}

function handleLongTap(it) {
  if (!it.have) return;

  if ((it.rep || 0) > 0) {
    it.rep = Math.max(0, (it.rep || 0) - 1);
    save();
    renderStickers();
    return;
  }

  const ok = confirm("No tiene repetidas.\n\n¿Querés quitarla de la colección?");
  if (!ok) return;

  it.have = false;
  it.rep = 0;
  save();
  renderStickers();
}

function buildMissingTextBySection(col) {
  const lines = [];
  lines.push(`*${col.name}*`);
  lines.push("");
  lines.push(`*Me faltan*`);
  lines.push("");

  const sections = col.sections || [];
  const items = col.items || [];

  for (const sec of sections) {
    const missing = items
      .filter((it) => it.sectionId === sec.id && !it.have)
      .map((it) => it.label);

    if (missing.length) {
      lines.push(`${sec.name}: ${missing.join(", ")}`);
    }
  }

  return lines.join("\n");
}

function buildRepeatedTextBySection(col) {
  const lines = [];
  lines.push(`*${col.name}*`);
  lines.push("");
  lines.push(`*Repetidas*`);
  lines.push("");

  const sections = col.sections || [];
  const items = col.items || [];

  for (const sec of sections) {
    const repeated = items
      .filter((it) => it.sectionId === sec.id && (it.rep || 0) > 0)
      .map((it) => `${it.label} (${it.rep})`);

    if (repeated.length) {
      lines.push(`${sec.name}: ${repeated.join(", ")}`);
    }
  }

  return lines.join("\n");
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      alert("Lista copiada 📋");
      return;
    }
  } catch {}

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);

    if (ok) {
      alert("Lista copiada 📋");
      return;
    }
  } catch {}

  prompt("Copiá el texto:", text);
}

function refreshBuilderUI() {
  const mode = $("buildMode")?.value || "simple";
  const simple = $("simpleBuilder");
  const sections = $("sectionsBuilder");

  if (simple) simple.classList.toggle("hidden", mode !== "simple");
  if (sections) sections.classList.toggle("hidden", mode !== "sections");
}

function init() {
  load();
  renderCollections();
  refreshBuilderUI();

  $("createCollectionBtn")?.addEventListener("click", createCollection);
  $("buildMode")?.addEventListener("change", refreshBuilderUI);
}

document.addEventListener("DOMContentLoaded", init);
