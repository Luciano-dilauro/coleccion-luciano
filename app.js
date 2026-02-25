/* app.js — Colección Luciano (base estable)
   - Listado de colecciones
   - Crear colección 1..N (simple)
   - Vista detalle con items + repeticiones + stats
   - Filtros: Todas / Faltantes / Tengo
   - Nuevas colecciones arriba
*/

(() => {
  "use strict";

  /**********************
   * Utils
   **********************/
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const uid = () =>
    (crypto?.randomUUID?.() || `id_${Math.random().toString(16).slice(2)}_${Date.now()}`);

  const clampInt = (n, min, max) => {
    const v = Number.parseInt(n, 10);
    if (Number.isNaN(v)) return min;
    return Math.max(min, Math.min(max, v));
  };

  const fmtPct = (n) => `${Math.round(n)}%`;

  /**********************
   * Storage
   **********************/
  const STORAGE_KEY = "coleccionLuciano_v1";
  const DEFAULT_STATE = {
    version: 1,
    collections: [], // newest first
    lastOpenCollectionId: null,
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      // soft-merge
      return {
        ...structuredClone(DEFAULT_STATE),
        ...parsed,
        collections: Array.isArray(parsed.collections) ? parsed.collections : [],
      };
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  let state = loadState();

  /**********************
   * App Root + Base Layout (si el index no lo trae)
   **********************/
  const root =
    $("#app") ||
    $("main.app") ||
    $("main") ||
    (() => {
      const d = document.createElement("div");
      d.id = "app";
      document.body.appendChild(d);
      return d;
    })();

  // Si ya existe un topbar en tu HTML, NO lo tocamos.
  // Si no existe, creamos uno simple para que siempre funcione.
  let topbar = $(".topbar");
  if (!topbar) {
    topbar = document.createElement("header");
    topbar.className = "topbar";
    topbar.innerHTML = `
      <button id="backBtn" class="icon-btn hidden" type="button" aria-label="Volver">←</button>
      <div class="topbar-title" id="screenTitle">Mis Colecciones</div>
      <div class="topbar-spacer"></div>
    `;
    document.body.insertBefore(topbar, document.body.firstChild);
  }

  const backBtn = $("#backBtn") || $(".topbar #backBtn");
  const screenTitle = $("#screenTitle") || $(".topbar #screenTitle");

  // Vistas (las generamos si no existen)
  let viewHome = $("#viewHome");
  let viewNew = $("#viewNew");
  let viewDetail = $("#viewDetail");

  if (!viewHome || !viewNew || !viewDetail) {
    root.innerHTML = `
      <section id="viewHome" class="view is-active"></section>
      <section id="viewNew" class="view"></section>
      <section id="viewDetail" class="view"></section>
    `;
    viewHome = $("#viewHome");
    viewNew = $("#viewNew");
    viewDetail = $("#viewDetail");
  }

  const VIEWS = {
    home: viewHome,
    new: viewNew,
    detail: viewDetail,
  };

  let currentView = "home";

  function setTitle(text) {
    if (screenTitle) screenTitle.textContent = text;
    document.title = text;
  }

  function setBackVisible(on) {
    if (!backBtn) return;
    backBtn.classList.toggle("hidden", !on);
  }

  function showView(name) {
    currentView = name;
    Object.entries(VIEWS).forEach(([k, el]) => {
      if (!el) return;
      el.classList.toggle("is-active", k === name);
    });
    setBackVisible(name !== "home");
  }

  function goHome() {
    state.lastOpenCollectionId = null;
    saveState();
    renderHome();
    showView("home");
    setTitle("Mis Colecciones");
  }

  function goNew() {
    renderNew();
    showView("new");
    setTitle("Nueva colección");
  }

  function goDetail(collectionId) {
    state.lastOpenCollectionId = collectionId;
    saveState();
    renderDetail(collectionId);
    showView("detail");
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      // volver simple
      if (currentView === "detail" || currentView === "new") goHome();
      else goHome();
    });
  }

  /**********************
   * Rendering: HOME (listado)
   **********************/
  function renderHome() {
    const cols = state.collections;

    viewHome.innerHTML = `
      <h1 class="h1">Mis Colecciones</h1>

      <div class="card">
        <div class="row-between" style="gap:12px; align-items:center;">
          <h2 class="h2" style="margin:0;">Colecciones</h2>
          <button id="btnNew" class="btn primary" type="button">+ Nueva</button>
        </div>

        ${
          cols.length === 0
            ? `
              <p class="muted" style="margin:10px 0 0;">
                Todavía no tenés colecciones. Tocá “+ Nueva”.
              </p>
              <p class="muted" style="margin:10px 0 0;">
                Tip: tocá una colección para entrar.
              </p>
            `
            : `
              <div class="stack" style="margin-top:12px;">
                ${cols
                  .map((c) => {
                    const stats = computeStats(c);
                    return `
                      <button class="list-item" data-open="${c.id}" type="button">
                        <div class="list-item-main">
                          <div class="list-item-title">${escapeHtml(c.name)}</div>
                          <div class="list-item-sub muted">
                            Total: <b>${stats.total}</b> · Tengo: <b>${stats.have}</b> · Faltan: <b>${stats.missing}</b> · ${fmtPct(stats.pct)}
                          </div>
                        </div>
                        <div class="list-item-actions">
                          <button class="btn-mini" data-dup="${c.id}" type="button" aria-label="Duplicar">⎘</button>
                          <button class="btn-mini danger" data-del="${c.id}" type="button" aria-label="Eliminar">🗑</button>
                        </div>
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            `
        }
      </div>
    `;

    // handlers
    const btnNew = $("#btnNew", viewHome);
    btnNew?.addEventListener("click", goNew);

    viewHome.addEventListener("click", onHomeClick);
  }

  function onHomeClick(e) {
    const openBtn = e.target.closest("[data-open]");
    if (openBtn) {
      const id = openBtn.getAttribute("data-open");
      if (id) goDetail(id);
      return;
    }

    const dupBtn = e.target.closest("[data-dup]");
    if (dupBtn) {
      e.stopPropagation();
      const id = dupBtn.getAttribute("data-dup");
      if (!id) return;
      duplicateCollection(id);
      renderHome();
      return;
    }

    const delBtn = e.target.closest("[data-del]");
    if (delBtn) {
      e.stopPropagation();
      const id = delBtn.getAttribute("data-del");
      if (!id) return;
      const col = state.collections.find((c) => c.id === id);
      const ok = confirm(`¿Eliminar "${col?.name || "colección"}"? Esto no se puede deshacer.`);
      if (!ok) return;
      state.collections = state.collections.filter((c) => c.id !== id);
      saveState();
      renderHome();
      return;
    }
  }

  function duplicateCollection(id) {
    const original = state.collections.find((c) => c.id === id);
    if (!original) return;

    const copy = structuredClone(original);
    copy.id = uid();
    copy.name = `${copy.name} (copia)`;
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();

    // NUEVA ARRIBA
    state.collections.unshift(copy);
    saveState();
  }

  /**********************
   * Rendering: NEW (crear)
   **********************/
  function renderNew() {
    viewNew.innerHTML = `
      <h1 class="h1">Nueva colección</h1>

      <div class="card">
        <div class="field">
          <label>Nombre</label>
          <input id="newName" class="input" type="text" placeholder="Ej: Adrenalyn WC 2026" />
        </div>

        <div class="field">
          <label>Cantidad de ítems (números 1..N)</label>
          <input id="newCount" class="input" type="number" min="1" max="5000" value="100" />
        </div>

        <div class="row gap">
          <button id="btnCreate" class="btn primary" type="button">Crear</button>
          <button id="btnCancel" class="btn" type="button">Cancelar</button>
        </div>

        <p class="muted" style="margin-top:12px;">
          Esta versión crea ítems 1..N (simple y estable). Después sumamos secciones, letras (A1), importaciones, etc.
        </p>
      </div>
    `;

    $("#btnCancel", viewNew)?.addEventListener("click", goHome);

    $("#btnCreate", viewNew)?.addEventListener("click", () => {
      const name = ($("#newName", viewNew)?.value || "").trim();
      const count = clampInt($("#newCount", viewNew)?.value ?? 100, 1, 5000);

      if (!name) {
        alert("Poné un nombre para la colección 🙂");
        return;
      }

      const col = createCollectionSimple(name, count);

      // NUEVA ARRIBA (sin scroll)
      state.collections.unshift(col);
      saveState();

      goDetail(col.id);
    });
  }

  function createCollectionSimple(name, count) {
    const items = Array.from({ length: count }, (_, i) => {
      const num = i + 1;
      return {
        key: String(num), // clave interna
        label: String(num), // lo que se muestra
        have: false,
        rep: 0,
      };
    });

    return {
      id: uid(),
      name,
      type: "simple_1_to_n",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      items,
      // futuro: sections, patterns, etc.
    };
  }

  /**********************
   * Rendering: DETAIL (items + filtros)
   **********************/
  const detailUI = {
    filter: "all", // all | missing | have
  };

  function renderDetail(collectionId) {
    const col = state.collections.find((c) => c.id === collectionId);
    if (!col) {
      goHome();
      return;
    }

    const stats = computeStats(col);

    viewDetail.innerHTML = `
      <h1 class="h1">${escapeHtml(col.name)}</h1>

      <div class="card">
        <div class="row-between" style="align-items:center; gap:12px;">
          <h2 class="h2" style="margin:0;">${escapeHtml(col.name)}</h2>

          <div class="row gap" style="justify-content:flex-end;">
            <button class="btn" id="btnEditName" type="button">Editar</button>
            <button class="btn danger" id="btnReset" type="button">Reset</button>
          </div>
        </div>

        <div class="stats-row" style="margin-top:12px;">
          <div class="stat-box"><div class="muted">Total</div><div class="stat-num">${stats.total}</div></div>
          <div class="stat-box"><div class="muted">Tengo</div><div class="stat-num">${stats.have}</div></div>
          <div class="stat-box"><div class="muted">Faltan</div><div class="stat-num">${stats.missing}</div></div>
          <div class="stat-box"><div class="muted">%</div><div class="stat-num">${fmtPct(stats.pct)}</div></div>
        </div>

        <div class="pill big center" style="margin-top:12px;">Completo: <b>${fmtPct(stats.pct)}</b></div>

        <!-- FILTROS -->
        <div class="tabs" style="margin-top:14px;">
          <button class="tab ${detailUI.filter === "all" ? "active" : ""}" data-filter="all" type="button">Todas</button>
          <button class="tab ${detailUI.filter === "missing" ? "active" : ""}" data-filter="missing" type="button">Faltantes</button>
          <button class="tab ${detailUI.filter === "have" ? "active" : ""}" data-filter="have" type="button">Tengo</button>
        </div>

        <div class="divider" style="margin:14px 0;"></div>

        <div class="row-between" style="align-items:center; gap:12px;">
          <h3 class="h3" style="margin:0;">Ítems</h3>
          <button class="btn danger" id="btnResetReps" type="button">Reset reps</button>
        </div>

        <div id="itemsGrid" class="items-grid" style="margin-top:12px;"></div>
      </div>
    `;

    $("#btnEditName", viewDetail)?.addEventListener("click", () => {
      const newName = prompt("Nuevo nombre:", col.name);
      if (!newName) return;
      col.name = newName.trim() || col.name;
      col.updatedAt = Date.now();
      saveState();
      renderDetail(col.id);
      setTitle(col.name);
    });

    $("#btnReset", viewDetail)?.addEventListener("click", () => {
      const ok = confirm(`¿Resetear TODO en "${col.name}"? (Tengo y repeticiones)`);
      if (!ok) return;
      col.items.forEach((it) => {
        it.have = false;
        it.rep = 0;
      });
      col.updatedAt = Date.now();
      saveState();
      renderDetail(col.id);
    });

    $("#btnResetReps", viewDetail)?.addEventListener("click", () => {
      const ok = confirm("¿Resetear repeticiones a 0? (No toca 'Tengo')");
      if (!ok) return;
      col.items.forEach((it) => (it.rep = 0));
      col.updatedAt = Date.now();
      saveState();
      renderDetail(col.id);
    });

    // filtros
    viewDetail.addEventListener("click", (e) => {
      const f = e.target.closest("[data-filter]");
      if (f) {
        const v = f.getAttribute("data-filter");
        if (v === "all" || v === "missing" || v === "have") {
          detailUI.filter = v;
          renderDetail(col.id);
        }
        return;
      }
    });

    renderItemsGrid(col);
  }

  function renderItemsGrid(col) {
    const grid = $("#itemsGrid", viewDetail);
    if (!grid) return;

    const items = getFilteredItems(col, detailUI.filter);

    grid.innerHTML = items
      .map((it) => {
        const isHave = !!it.have;
        const rep = it.rep || 0;
        return `
          <div class="item-card ${isHave ? "is-have" : ""}" data-item="${escapeAttr(it.key)}">
            <div class="item-top">
              <div class="item-code">${escapeHtml(it.label)}</div>
              <button class="item-toggle ${isHave ? "on" : ""}" type="button" data-toggle="${escapeAttr(
          it.key
        )}">
                ${isHave ? "Tengo" : "Falta"}
              </button>
            </div>

            <div class="item-mid muted">Rep: <b>${rep}</b></div>

            <div class="item-controls">
              <button class="btn-mini" type="button" data-minus="${escapeAttr(it.key)}">−</button>
              <button class="btn-mini" type="button" data-plus="${escapeAttr(it.key)}">+</button>
            </div>
          </div>
        `;
      })
      .join("");

    // Delegación de eventos
    grid.onclick = (e) => {
      const keyToggle = e.target.closest("[data-toggle]")?.getAttribute("data-toggle");
      if (keyToggle) {
        toggleHave(col, keyToggle);
        saveState();
        renderDetail(col.id);
        return;
      }

      const keyPlus = e.target.closest("[data-plus]")?.getAttribute("data-plus");
      if (keyPlus) {
        changeRep(col, keyPlus, +1);
        saveState();
        renderDetail(col.id);
        return;
      }

      const keyMinus = e.target.closest("[data-minus]")?.getAttribute("data-minus");
      if (keyMinus) {
        changeRep(col, keyMinus, -1);
        saveState();
        renderDetail(col.id);
        return;
      }
    };
  }

  function toggleHave(col, key) {
    const it = col.items.find((x) => x.key === key);
    if (!it) return;
    it.have = !it.have;
    if (!it.have) it.rep = 0; // si dejás de tenerlo, reps a 0 (simple)
    col.updatedAt = Date.now();
  }

  function changeRep(col, key, delta) {
    const it = col.items.find((x) => x.key === key);
    if (!it) return;

    // Regla: para sumar rep, primero debe estar marcado como "Tengo"
    if (!it.have) {
      alert("Primero marcá este ítem como 'Tengo' tocándolo.");
      return;
    }

    const next = clampInt((it.rep || 0) + delta, 0, 999);
    it.rep = next;
    col.updatedAt = Date.now();
  }

  function getFilteredItems(col, filter) {
    if (filter === "missing") return col.items.filter((it) => !it.have);
    if (filter === "have") return col.items.filter((it) => it.have);
    return col.items;
  }

  /**********************
   * Stats
   **********************/
  function computeStats(col) {
    const total = col.items.length;
    const have = col.items.reduce((acc, it) => acc + (it.have ? 1 : 0), 0);
    const missing = total - have;
    const pct = total === 0 ? 0 : (have / total) * 100;
    return { total, have, missing, pct };
  }

  /**********************
   * Small helpers: escape
   **********************/
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function escapeAttr(str) {
    return escapeHtml(str).replaceAll(" ", "");
  }

  /**********************
   * Init
   **********************/
  function init() {
    // Si hay una colección abierta guardada, vuelvo ahí
    if (state.lastOpenCollectionId) {
      const exists = state.collections.some((c) => c.id === state.lastOpenCollectionId);
      if (exists) {
        goDetail(state.lastOpenCollectionId);
        return;
      }
    }

    renderHome();
    showView("home");
    setTitle("Mis Colecciones");
  }

  init();
})();
