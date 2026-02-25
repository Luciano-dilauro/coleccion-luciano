/* ===========================
   Colección Luciano — app.js (Arquitectura estable)
   Compatible con index.html con data-view="home/create/detail/edit/settings"
   - Home: lista + crear + duplicar + eliminar
   - Crear: simple 1..N (por ahora)
   - Detalle: stats + filtros (Todas / Faltantes / Tengo) + grid items
   - Editar: renombrar (base)
   - Ajustes: export/import (reemplazar)
=========================== */

(() => {
  "use strict";

  /* ---------- Helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const uid = () => (crypto?.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(16).slice(2)}`);

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const fmtPct = (n) => `${Math.round(n)}%`;

  /* ---------- Storage ---------- */
  const LS_KEY = "coleccion_luciano_arch_v3";

  const state = {
    view: "home",                // home | create | detail | edit | settings
    filter: "all",               // all | missing | have
    currentId: null,             // colección actual
    collections: [],             // [{id,name,createdAt,updatedAt,items:[{key,label,have,rep}]}]
    lastExportAt: null,
    lastExportSize: null,
    lastImportAt: null,
  };

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);

      if (Array.isArray(data.collections)) state.collections = data.collections;
      if (data.currentId) state.currentId = data.currentId;
      if (data.view) state.view = data.view;
      if (data.filter) state.filter = data.filter;

      state.lastExportAt = data.lastExportAt ?? null;
      state.lastExportSize = data.lastExportSize ?? null;
      state.lastImportAt = data.lastImportAt ?? null;
    } catch {}
  }

  function save() {
    localStorage.setItem(LS_KEY, JSON.stringify({
      collections: state.collections,
      currentId: state.currentId,
      view: state.view,
      filter: state.filter,
      lastExportAt: state.lastExportAt,
      lastExportSize: state.lastExportSize,
      lastImportAt: state.lastImportAt,
    }));
  }

  /* ---------- DOM (según tu index) ---------- */
  const topbarTitle = $("#topbarTitle");
  const backBtn = $("#backBtn");

  const views = {
    home: document.querySelector('[data-view="home"]'),
    create: document.querySelector('[data-view="create"]'),
    detail: document.querySelector('[data-view="detail"]'),
    edit: document.querySelector('[data-view="edit"]'),
    settings: document.querySelector('[data-view="settings"]'),
  };

  // HOME
  const collectionsList = $("#collectionsList");

  // CREATE
  const newName = $("#newName");
  const simpleCount = $("#simpleCount");
  const btnAddSection = $("#btnAddSection"); // (por ahora no usamos, pero queda)

  // DETAIL
  const detailTitle = $("#detailTitle");
  const stTotal = $("#stTotal");
  const stHave = $("#stHave");
  const stMissing = $("#stMissing");
  const stPct = $("#stPct");
  const sectionsDetail = $("#sectionsDetail");

  // EDIT
  const editTitle = $("#editTitle");
  const editName = $("#editName");
  const editSectionsArea = $("#editSectionsArea");

  // SETTINGS
  const importInput = $("#importInput");
  const exportMeta = $("#exportMeta");
  const importMeta = $("#importMeta");
  const storageMeta = $("#storageMeta");

  /* ---------- View system ---------- */
  function setTopbar(title, showBack) {
    if (topbarTitle) topbarTitle.textContent = title;
    if (backBtn) backBtn.classList.toggle("hidden", !showBack);
  }

  function showView(name) {
    state.view = name;
    Object.entries(views).forEach(([k, el]) => {
      if (!el) return;
      el.classList.toggle("is-active", k === name);
    });
    save();
  }

  function goHome() {
    setTopbar("Mis Colecciones", false);
    renderHome();
    showView("home");
  }

  function goCreate() {
    setTopbar("Nueva colección", true);
    renderCreate();
    showView("create");
  }

  function goSettings() {
    setTopbar("Ajustes / Backup", true);
    renderSettings();
    showView("settings");
  }

  function goDetail(id) {
    state.currentId = id;
    setTopbar("Colección", true);
    renderDetail();
    showView("detail");
  }

  function goEdit() {
    setTopbar("Editar", true);
    renderEdit();
    showView("edit");
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      // volver simple: desde detail/edit/create/settings => home
      goHome();
    });
  }

  /* ---------- Data helpers ---------- */
  function getCurrent() {
    return state.collections.find(c => c.id === state.currentId) || null;
  }

  function computeStats(col) {
    const total = col.items.length;
    const have = col.items.reduce((a, it) => a + (it.have ? 1 : 0), 0);
    const missing = total - have;
    const pct = total ? (have / total) * 100 : 0;
    return { total, have, missing, pct };
  }

  function sortNewestFirst() {
    state.collections.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  /* =========================================================
     HOME
  ========================================================= */
  function renderHome() {
    sortNewestFirst();

    if (!collectionsList) return;

    if (!state.collections.length) {
      collectionsList.innerHTML = `
        <div class="muted">Todavía no tenés colecciones.</div>
        <div class="muted">Tocá “Nueva” para crear una.</div>
      `;
    } else {
      collectionsList.innerHTML = state.collections.map(c => {
        const st = computeStats(c);
        return `
          <div class="collection-row" data-open="${esc(c.id)}">
            <div style="min-width:0;">
              <div style="font-weight:950; font-size:16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${esc(c.name)}
              </div>
              <div class="muted small">
                Total: <b>${st.total}</b> · Tengo: <b>${st.have}</b> · Faltan: <b>${st.missing}</b> · ${fmtPct(st.pct)}
              </div>
            </div>

            <div class="row gap" style="flex-shrink:0;">
              <button class="icon-lite" type="button" data-dup="${esc(c.id)}" title="Duplicar">⎘</button>
              <button class="icon-danger" type="button" data-del="${esc(c.id)}" title="Eliminar">🗑</button>
            </div>
          </div>
        `;
      }).join("");
    }

    // acciones home (delegación)
    collectionsList.onclick = (e) => {
      const open = e.target.closest("[data-open]")?.getAttribute("data-open");
      const dup = e.target.closest("[data-dup]")?.getAttribute("data-dup");
      const del = e.target.closest("[data-del]")?.getAttribute("data-del");

      if (dup) {
        e.stopPropagation();
        duplicateCollection(dup);
        renderHome();
        return;
      }

      if (del) {
        e.stopPropagation();
        const col = state.collections.find(x => x.id === del);
        const ok = confirm(`¿Eliminar "${col?.name || "colección"}"?\n\nEsta acción NO se puede deshacer.`);
        if (!ok) return;
        state.collections = state.collections.filter(x => x.id !== del);
        if (state.currentId === del) state.currentId = null;
        save();
        renderHome();
        return;
      }

      if (open) {
        goDetail(open);
      }
    };

    // Botones principales (según tu index: data-action)
    document.querySelector('[data-action="go-create"]')?.addEventListener("click", goCreate);
    document.querySelector('[data-action="go-settings"]')?.addEventListener("click", goSettings);
  }

  function duplicateCollection(id) {
    const original = state.collections.find(c => c.id === id);
    if (!original) return;

    const copy = structuredClone(original);
    copy.id = uid();
    copy.name = `${copy.name} (copia)`;
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();

    // ✅ copia arriba
    state.collections.unshift(copy);
    save();
  }

  /* =========================================================
     CREATE (simple 1..N)
  ========================================================= */
  function renderCreate() {
    // reset inputs
    if (newName) newName.value = "";
    if (simpleCount) simpleCount.value = "100";

    // botones create
    document.querySelector('[data-action="create-cancel"]')?.addEventListener("click", goHome);

    document.querySelector('[data-action="create-save"]')?.addEventListener("click", () => {
      const name = (newName?.value || "").trim();
      const count = clamp(parseInt(simpleCount?.value || "100", 10) || 100, 1, 5000);

      if (!name) {
        alert("Escribí un nombre para la colección 🙂");
        return;
      }

      const col = {
        id: uid(),
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        items: Array.from({ length: count }, (_, i) => {
          const n = i + 1;
          return { key: String(n), label: String(n), have: false, rep: 0 };
        }),
      };

      // ✅ nueva arriba
      state.collections.unshift(col);
      state.currentId = col.id;
      save();

      goDetail(col.id);
    });

    // (por ahora no implementamos secciones aquí, queda para la próxima etapa)
    if (btnAddSection) btnAddSection.onclick = () => {
      alert("Secciones avanzadas: lo agregamos en el próximo upgrade 🙂");
    };
  }

  /* =========================================================
     DETAIL (filtros + items)
  ========================================================= */
  function renderDetail() {
    const col = getCurrent();
    if (!col) {
      goHome();
      return;
    }

    if (detailTitle) detailTitle.textContent = col.name;

    const st = computeStats(col);
    if (stTotal) stTotal.textContent = String(st.total);
    if (stHave) stHave.textContent = String(st.have);
    if (stMissing) stMissing.textContent = String(st.missing);
    if (stPct) stPct.textContent = fmtPct(st.pct);

    // ✅ IMPORTANTE: acá creamos/mostramos SIEMPRE los filtros
    // Los ponemos arriba del grid de items (dentro de sectionsDetail)
    if (!sectionsDetail) return;

    const filtersHtml = `
      <div class="tabs" style="margin-bottom:12px;">
        <button class="tab ${state.filter === "all" ? "active" : ""}" type="button" data-filter="all">Todas</button>
        <button class="tab ${state.filter === "missing" ? "active" : ""}" type="button" data-filter="missing">Faltantes</button>
        <button class="tab ${state.filter === "have" ? "active" : ""}" type="button" data-filter="have">Tengo</button>
      </div>
    `;

    // filtrado
    const items = col.items.filter(it => {
      if (state.filter === "have") return it.have === true;
      if (state.filter === "missing") return it.have !== true;
      return true;
    });

    const gridHtml = `
      <div class="section-card">
        <div class="section-title">Figuritas</div>
        <div class="items-grid">
          ${items.map(it => `
            <div class="item ${it.have ? "have" : ""}" data-item="${esc(it.key)}">
              <div class="item-code">${esc(it.label)}</div>
              <div class="item-rep">Rep: <b>${it.rep || 0}</b></div>
              <div class="item-actions">
                <button class="mini" type="button" data-minus="${esc(it.key)}">−</button>
                <button class="mini" type="button" data-toggle="${esc(it.key)}">${it.have ? "✓" : "○"}</button>
                <button class="mini" type="button" data-plus="${esc(it.key)}">+</button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    sectionsDetail.innerHTML = filtersHtml + gridHtml;

    // botones header (editar/reset)
    document.querySelector('[data-action="open-edit"]')?.addEventListener("click", goEdit);

    document.querySelector('[data-action="reset-collection"]')?.addEventListener("click", () => {
      const ok = confirm(`¿Resetear TODO "${col.name}"?\n\nSe desmarcan "Tengo" y se ponen repeticiones en 0.`);
      if (!ok) return;
      col.items.forEach(it => { it.have = false; it.rep = 0; });
      col.updatedAt = Date.now();
      save();
      renderDetail();
    });

    // Delegación clicks: filtros + items
    sectionsDetail.onclick = (e) => {
      const f = e.target.closest("[data-filter]")?.getAttribute("data-filter");
      if (f) {
        state.filter = f;
        save();
        renderDetail();
        return;
      }

      const keyToggle = e.target.closest("[data-toggle]")?.getAttribute("data-toggle");
      if (keyToggle) {
        const it = col.items.find(x => x.key === keyToggle);
        if (!it) return;
        it.have = !it.have;
        if (!it.have) it.rep = 0; // simple: si ya no lo tengo, rep=0
        col.updatedAt = Date.now();
        save();
        renderDetail();
        return;
      }

      const keyPlus = e.target.closest("[data-plus]")?.getAttribute("data-plus");
      if (keyPlus) {
        const it = col.items.find(x => x.key === keyPlus);
        if (!it) return;
        if (!it.have) {
          alert("Primero marcá esta figurita como 'Tengo'.");
          return;
        }
        it.rep = clamp((it.rep || 0) + 1, 0, 999);
        col.updatedAt = Date.now();
        save();
        renderDetail();
        return;
      }

      const keyMinus = e.target.closest("[data-minus]")?.getAttribute("data-minus");
      if (keyMinus) {
        const it = col.items.find(x => x.key === keyMinus);
        if (!it) return;
        it.rep = clamp((it.rep || 0) - 1, 0, 999);
        col.updatedAt = Date.now();
        save();
        renderDetail();
        return;
      }
    };
  }

  /* =========================================================
     EDIT (base: renombrar)
  ========================================================= */
  function renderEdit() {
    const col = getCurrent();
    if (!col) { goHome(); return; }

    if (editTitle) editTitle.textContent = `Editar: ${col.name}`;
    if (editName) editName.value = col.name;

    // por ahora ocultamos edición de secciones
    if (editSectionsArea) editSectionsArea.style.display = "none";

    document.querySelector('[data-action="edit-cancel"]')?.addEventListener("click", () => goDetail(col.id));

    document.querySelector('[data-action="edit-save"]')?.addEventListener("click", () => {
      const newN = (editName?.value || "").trim();
      if (!newN) return alert("Nombre inválido.");
      col.name = newN;
      col.updatedAt = Date.now();
      save();
      goDetail(col.id);
    });
  }

  /* =========================================================
     SETTINGS (export / import reemplazar)
  ========================================================= */
  function renderSettings() {
    // Meta datos
    if (exportMeta) {
      exportMeta.textContent =
        `Último: ${state.lastExportAt ? new Date(state.lastExportAt).toLocaleString() : "—"} · Tamaño: ${state.lastExportSize || "—"}`;
    }
    if (importMeta) {
      importMeta.textContent =
        `Último: ${state.lastImportAt ? new Date(state.lastImportAt).toLocaleString() : "—"} · Modo: Reemplazar`;
    }
    if (storageMeta) {
      // tamaño aproximado del json en KB
      const bytes = new Blob([JSON.stringify(state.collections)]).size;
      const kb = Math.round(bytes / 1024);
      storageMeta.textContent = `Datos actuales en el dispositivo: ~${kb} KB`;
    }

    document.querySelector('[data-action="go-home"]')?.addEventListener("click", goHome);

    document.querySelector('[data-action="export-backup"]')?.addEventListener("click", exportBackup);

    // importInput ya está en el index
    if (importInput) {
      importInput.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result);

            // modo REEMPLAZAR (sin fusionar)
            const cols = Array.isArray(data.collections) ? data.collections
              : Array.isArray(data.albums) ? data.albums
              : Array.isArray(data.data) ? data.data
              : [];

            if (!Array.isArray(cols)) throw new Error("Formato inválido");

            state.collections = cols;
            sortNewestFirst();
            state.lastImportAt = Date.now();

            // si hay algo, elijo el primero
            state.currentId = state.collections[0]?.id || null;

            save();
            alert("Backup importado ✅");
            renderSettings();
          } catch {
            alert("Error al importar backup.");
          }
        };
        reader.readAsText(file);
      };
    }
  }

  function exportBackup() {
    const payload = {
      version: 1,
      exportedAt: Date.now(),
      collections: state.collections,
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "backup-coleccion-luciano.json";
    a.click();
    URL.revokeObjectURL(url);

    state.lastExportAt = Date.now();
    state.lastExportSize = `${Math.round(blob.size / 1024)} KB`;
    save();
    renderSettings();
  }

  /* =========================================================
     Init
  ========================================================= */
  function init() {
    load();

    // Conectores globales de botones del index
    document.querySelector('[data-action="go-create"]')?.addEventListener("click", goCreate);
    document.querySelector('[data-action="go-settings"]')?.addEventListener("click", goSettings);

    // arranque
    if (state.view === "detail" && state.currentId) {
      goDetail(state.currentId);
    } else {
      goHome();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
