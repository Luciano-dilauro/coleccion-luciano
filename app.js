/* =============================
   Colección Luciano - Base sólida
   - SPA simple (sin frameworks)
   - LocalStorage
   - Topbar fijo (CSS)
============================= */

const LS_KEY = "coleccion_luciano_v1";

const els = {
  backBtn: document.getElementById("backBtn"),
  topbarTitle: document.getElementById("topbarTitle"),

  views: Array.from(document.querySelectorAll("[data-view]")),

  list: document.getElementById("collectionsList"),

  newName: document.getElementById("newName"),
  newCount: document.getElementById("newCount"),

  detailTitle: document.getElementById("detailTitle"),
  stTotal: document.getElementById("stTotal"),
  stHave: document.getElementById("stHave"),
  stMissing: document.getElementById("stMissing"),
  stPct: document.getElementById("stPct"),
  itemsGrid: document.getElementById("itemsGrid"),
};

const state = {
  view: "home",          // home | create | detail
  currentId: null,       // id de colección seleccionada
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
function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function getCurrent() {
  if (!state.currentId) return null;
  return state.data.collections.find(c => c.id === state.currentId) || null;
}

function computeStats(col) {
  const total = col.items.length;
  let have = 0;
  let missing = 0;

  for (const it of col.items) {
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

  // Topbar
  if (view === "home") {
    els.topbarTitle.textContent = "Mis Colecciones";
    els.backBtn.classList.add("hidden");
  } else {
    els.backBtn.classList.remove("hidden");
    els.topbarTitle.textContent = view === "create" ? "Nueva colección" : "Detalle";
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function goHome() {
  state.currentId = null;
  renderHome();
  setView("home");
}

function goCreate() {
  // reset form
  if (els.newName) els.newName.value = "";
  if (els.newCount) els.newCount.value = "100";
  setView("create");
}

function goDetail(id) {
  state.currentId = id;
  renderDetail();
  setView("detail");
}

/* -----------------------------
   Render HOME
----------------------------- */
function renderHome() {
  els.list.innerHTML = "";

  const cols = state.data.collections;

  if (!cols.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "Todavía no tenés colecciones. Tocá “+ Nueva”.";
    els.list.appendChild(empty);
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
    const name = document.createElement("div");
    name.className = "collection-name";
    name.textContent = c.name;

    const sub = document.createElement("div");
    sub.className = "collection-meta";
    sub.textContent = `Completo ${st.pct}%`;

    left.appendChild(name);

    const right = document.createElement("div");
    right.className = "collection-meta";
    right.innerHTML = `Total ${st.total}<br>Tengo ${st.have}`;

    row.appendChild(left);
    row.appendChild(right);

    els.list.appendChild(row);
  }
}

/* -----------------------------
   Crear colección (1..N)
----------------------------- */
function createCollection() {
  const name = (els.newName?.value || "").trim();
  let count = parseInt(els.newCount?.value || "0", 10);

  if (!name) return alert("Escribí un nombre.");
  if (!Number.isFinite(count) || count <= 0) return alert("Cantidad inválida.");
  count = clamp(count, 1, 5000);

  const items = [];
  for (let i = 1; i <= count; i++) {
    items.push({ code: String(i), have: false, rep: 0 });
  }

  state.data.collections.push({
    id: uid(),
    name,
    createdAt: Date.now(),
    items,
  });

  save();
  renderHome();
  goHome();
}

/* -----------------------------
   Render DETALLE
----------------------------- */
function renderDetail() {
  const col = getCurrent();
  if (!col) {
    goHome();
    return;
  }

  els.detailTitle.textContent = col.name;
  els.topbarTitle.textContent = col.name;

  const st = computeStats(col);
  els.stTotal.textContent = String(st.total);
  els.stHave.textContent = String(st.have);
  els.stMissing.textContent = String(st.missing);
  els.stPct.textContent = `${st.pct}%`;

  els.itemsGrid.innerHTML = "";

  for (let idx = 0; idx < col.items.length; idx++) {
    const it = col.items[idx];

    const wrap = document.createElement("div");
    wrap.className = "item" + (it.have ? " have" : "");
    wrap.setAttribute("data-idx", String(idx));

    const code = document.createElement("div");
    code.className = "item-code";
    code.textContent = it.code;

    const rep = document.createElement("div");
    rep.className = "item-rep";
    rep.textContent = `Rep: ${it.rep || 0}`;

    // click principal: toggle have
    wrap.addEventListener("click", (e) => {
      // si clickeo en botones mini, no togglear
      if (e.target && e.target.closest && e.target.closest("button")) return;

      it.have = !it.have;
      // si la desmarco, también bajo rep a 0 (evita incoherencias)
      if (!it.have) it.rep = 0;

      save();
      renderDetail();
    });

    // mini acciones
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
      // regla: no permitir repetidas si no la tengo
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

    els.itemsGrid.appendChild(wrap);
  }
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
   Eventos globales (delegación)
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
  // Back simple: si estoy en detail o create vuelvo a home
  goHome();
});

/* -----------------------------
   Init
----------------------------- */
function init() {
  load();
  renderHome();
  setView("home");
}

document.addEventListener("DOMContentLoaded", init);
