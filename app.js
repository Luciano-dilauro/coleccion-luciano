/* app.js — Colección Luciano (Arquitectura blindada)
   - Migración automática desde claves viejas de localStorage
   - Persistencia estable con schema version
   - Backup export/import (REEMPLAZAR)
   - UI simple y robusta (SPA)
*/

(() => {
  "use strict";

  /********************
   * CONFIG / STORAGE *
   ********************/
  const APP_NAME = "Colección Luciano";
  const SCHEMA_VERSION = 1;

  // Clave nueva (estable). No la cambies más.
  const LS_KEY_NEW = "coleccion-luciano:data:v1";

  // Claves posibles viejas (probables). Agregá acá si recordás alguna.
  const LS_KEYS_OLD = [
    "coleccion_luciano_arch_v3",
    "coleccion_luciano",
    "coleccionLuciano",
    "mis_colecciones",
    "app_colecciones",
    "albums_app",
    "colecciones_data",
    "data",
  ];

  const now = () => Date.now();
  const uid = () => Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);

  function safeJSONParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  function readLS(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = safeJSONParse(raw);
    return data;
  }

  function writeLS(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function isValidState(obj) {
    if (!obj || typeof obj !== "object") return false;
    if (!Array.isArray(obj.collections)) return false;
    return true;
  }

  function normalizeState(state) {
    // Estado mínimo y estable
    const out = {
      schema: SCHEMA_VERSION,
      updatedAt: now(),
      collections: [],
    };

    if (isValidState(state)) {
      out.schema = Number.isFinite(state.schema) ? state.schema : SCHEMA_VERSION;
      out.updatedAt = Number.isFinite(state.updatedAt) ? state.updatedAt : now();
      out.collections = Array.isArray(state.collections) ? state.collections : [];
    } else if (Array.isArray(state)) {
      // por si alguna vez guardamos el array directo
      out.collections = state;
    }

    // Normalizar colecciones
    out.collections = out.collections
      .filter(Boolean)
      .map((c) => normalizeCollection(c))
      .filter((c) => c && c.id && c.name);

    // Orden: más nueva arriba (createdAt/updatedAt)
    out.collections.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

    return out;
  }

  function normalizeCollection(c) {
    if (!c || typeof c !== "object") return null;
    const createdAt = Number.isFinite(c.createdAt) ? c.createdAt : now();
    const updatedAt = Number.isFinite(c.updatedAt) ? c.updatedAt : createdAt;

    const col = {
      id: c.id || uid(),
      name: String(c.name || "").trim(),
      createdAt,
      updatedAt,
      // modelo simple: 1 sección default con items 1..N
      sections: Array.isArray(c.sections) && c.sections.length ? c.sections.map(normalizeSection) : [],
    };

    // compatibilidad: si existía "items" suelto
    if (!col.sections.length && Array.isArray(c.items)) {
      col.sections = [normalizeSection({ id: uid(), name: "Items", items: c.items })];
    }

    // si sigue vacío, creamos sección default vacía (no rompe)
    if (!col.sections.length) {
      col.sections = [normalizeSection({ id: uid(), name: "Items", items: [] })];
    }

    return col;
  }

  function normalizeSection(s) {
    const sec = {
      id: (s && s.id) || uid(),
      name: String((s && s.name) || "Items"),
      items: Array.isArray(s && s.items) ? s.items.map(normalizeItem).filter(Boolean) : [],
    };
    return sec;
  }

  function normalizeItem(it) {
    if (!it) return null;

    // soporta varios formatos viejos
    const code = String(it.code ?? it.id ?? it.n ?? it.num ?? "").trim();
    if (!code) return null;

    const have = Boolean(it.have ?? it.tengo ?? it.has ?? false);
    const rep = clampInt(it.rep ?? it.reps ?? it.repetidas ?? 0, 0, 999);

    return { code, have, rep };
  }

  function clampInt(v, min, max) {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function mergeCollectionsUnique(listA, listB) {
    // Merge por id (prioridad: más nuevo). Si no hay ids coherentes, fallback por name.
    const map = new Map();

    function put(c) {
      const key = c.id || ("name:" + c.name.toLowerCase());
      const prev = map.get(key);
      if (!prev) {
        map.set(key, c);
        return;
      }
      const prevTs = prev.updatedAt || prev.createdAt || 0;
      const curTs = c.updatedAt || c.createdAt || 0;
      if (curTs >= prevTs) map.set(key, c);
    }

    [...listA, ...listB].forEach(put);
    return Array.from(map.values());
  }

  function migrateIfNeeded() {
    // 1) Si ya existe la nueva, la usamos.
    const current = readLS(LS_KEY_NEW);
    if (isValidState(current)) return normalizeState(current);

    // 2) Buscar en claves viejas (y también en la nueva aunque inválida).
    const candidates = [];

    const tryKeys = [LS_KEY_NEW, ...LS_KEYS_OLD];
    for (const k of tryKeys) {
      const d = readLS(k);
      if (!d) continue;
      const normalized = normalizeState(d);
      if (normalized.collections.length) {
        candidates.push({ key: k, state: normalized });
      }
    }

    // 3) Si no hay nada, crear vacío.
    if (!candidates.length) {
      const empty = normalizeState({ collections: [] });
      writeLS(LS_KEY_NEW, empty);
      return empty;
    }

    // 4) Si hay varios, merge conservador (únicos) sin borrar nada.
    let merged = candidates[0].state;
    for (let i = 1; i < candidates.length; i++) {
      merged = {
        schema: SCHEMA_VERSION,
        updatedAt: now(),
        collections: mergeCollectionsUnique(merged.collections, candidates[i].state.collections),
      };
    }

    merged = normalizeState(merged);
    writeLS(LS_KEY_NEW, merged);

    return merged;
  }

  let STATE = migrateIfNeeded();

  function saveState() {
    STATE.updatedAt = now();
    // ordenar: más reciente arriba
    STATE.collections.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    writeLS(LS_KEY_NEW, STATE);
  }

  /*************
   * UI / SPA  *
   *************/
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function h(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, String(v));
    }
    for (const ch of (children || [])) {
      if (ch == null) continue;
      el.appendChild(typeof ch === "string" ? document.createTextNode(ch) : ch);
    }
    return el;
  }

  function ensureBaseShell() {
    // Si tu index ya tiene estructura, igual esto no rompe: solo crea un contenedor principal.
    document.title = APP_NAME;

    let app = $("#app");
    if (!app) {
      app = h("div", { id: "app" });
      document.body.appendChild(app);
    }

    // Topbar fijo (simple). Si tu CSS ya tiene topbar, esto convive.
    let top = $("#topbar");
    if (!top) {
      top = h("header", { id: "topbar", class: "topbar" }, [
        h("button", { id: "backBtn", class: "icon-btn hidden", type: "button", "aria-label": "Volver", text: "←" }),
        h("div", { id: "topTitle", class: "topbar-title", text: APP_NAME }),
        h("div", { class: "topbar-spacer" }),
      ]);
      document.body.insertBefore(top, document.body.firstChild);
    }

    // hook back
    $("#backBtn").addEventListener("click", () => goBack());
  }

  function setTop(title, canBack) {
    $("#topTitle").textContent = title;
    $("#backBtn").classList.toggle("hidden", !canBack);
  }

  // Router simple con historial
  const ROUTE_STACK = [];
  function nav(route) {
    ROUTE_STACK.push(route);
    render();
    // scroll to top (evita “cosas raras”)
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function goBack() {
    if (ROUTE_STACK.length > 1) ROUTE_STACK.pop();
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function currentRoute() {
    if (!ROUTE_STACK.length) return { name: "home" };
    return ROUTE_STACK[ROUTE_STACK.length - 1];
  }

  /****************
   * BUSINESS LOGIC
   ****************/
  function createCollection(name, nItems) {
    const cleanName = String(name || "").trim();
    if (!cleanName) throw new Error("Nombre inválido");

    const N = clampInt(nItems, 1, 5000);

    const items = [];
    for (let i = 1; i <= N; i++) {
      items.push({ code: String(i), have: false, rep: 0 });
    }

    const col = {
      id: uid(),
      name: cleanName,
      createdAt: now(),
      updatedAt: now(),
      sections: [
        {
          id: uid(),
          name: "Items",
          items,
        },
      ],
    };

    STATE.collections.unshift(col); // nueva arriba
    saveState();
    return col;
  }

  function getCollection(id) {
    return STATE.collections.find((c) => c.id === id) || null;
  }

  function updateCollection(col) {
    col.updatedAt = now();
    saveState();
  }

  function deleteCollection(id) {
    STATE.collections = STATE.collections.filter((c) => c.id !== id);
    saveState();
  }

  function resetCollection(col) {
    for (const sec of col.sections) {
      for (const it of sec.items) {
        it.have = false;
        it.rep = 0;
      }
    }
    updateCollection(col);
  }

  function statsForCollection(col) {
    let total = 0, have = 0, missing = 0;
    for (const sec of col.sections) {
      for (const it of sec.items) {
        total++;
        if (it.have) have++;
      }
    }
    missing = total - have;
    const pct = total ? Math.round((have * 100) / total) : 0;
    return { total, have, missing, pct };
  }

  /*************
   * BACKUP I/O *
   *************/
  function exportBackup() {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: APP_NAME,
      schema: SCHEMA_VERSION,
      data: STATE,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = h("a", { href: url, download: "coleccion-luciano-backup.json" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importBackupReplace(file) {
    const text = await file.text();
    const parsed = safeJSONParse(text);

    // formatos aceptados
    let incoming = null;
    if (parsed && parsed.data && isValidState(parsed.data)) incoming = parsed.data;
    else if (isValidState(parsed)) incoming = parsed;
    else if (parsed && Array.isArray(parsed.collections)) incoming = parsed;

    if (!incoming) throw new Error("Backup inválido");

    const normalized = normalizeState(incoming);

    // REEMPLAZAR (sin merge)
    STATE = normalized;
    saveState();
  }

  /*************
   * RENDERING  *
   *************/
  function clearApp() {
    const app = $("#app");
    app.innerHTML = "";
    return app;
  }

  function render() {
    ensureBaseShell();

    const route = currentRoute();
    const app = clearApp();

    if (route.name === "home") {
      setTop("Mis Colecciones", false);
      app.appendChild(renderHome());
      return;
    }

    if (route.name === "new") {
      setTop("Nueva colección", true);
      app.appendChild(renderNewCollection());
      return;
    }

    if (route.name === "settings") {
      setTop("Ajustes / Backup", true);
      app.appendChild(renderSettings());
      return;
    }

    if (route.name === "collection") {
      const col = getCollection(route.id);
      if (!col) {
        alert("No encontré esa colección (quizá fue eliminada).");
        ROUTE_STACK.length = 0;
        nav({ name: "home" });
        return;
      }
      setTop(col.name, true);
      app.appendChild(renderCollection(col));
      return;
    }

    // fallback
    ROUTE_STACK.length = 0;
    nav({ name: "home" });
  }

  function card(children = [], extraClass = "") {
    return h("div", { class: `card ${extraClass}`.trim() }, children);
  }

  function btn(text, onClick, cls = "btn") {
    return h("button", { type: "button", class: cls, onClick, text });
  }

  function renderHome() {
    const wrap = h("div", { class: "container" });

    const headerCard = card([
      h("div", { class: "row-between" }, [
        h("h2", { class: "h2", text: "Mis Colecciones" }),
        btn("Nueva", () => nav({ name: "new" }), "btn primary"),
      ]),
      h("p", { class: "muted", text: STATE.collections.length ? "Tocá una colección para entrar." : "Todavía no tenés colecciones. Tocá “Nueva” para crear una." }),
      h("div", { class: "divider" }),
      btn("Ajustes / Backup", () => nav({ name: "settings" }), "btn"),
    ]);

    wrap.appendChild(headerCard);

    if (STATE.collections.length) {
      const list = h("div", { class: "stack" });
      for (const col of STATE.collections) {
        const st = statsForCollection(col);
        const item = card([
          h("div", { class: "row-between" }, [
            h("div", {}, [
              h("div", { class: "title-lg", text: col.name }),
              h("div", { class: "muted", text: `Total ${st.total} • Tengo ${st.have} • Faltan ${st.missing} • ${st.pct}%` }),
            ]),
            btn("Abrir", () => nav({ name: "collection", id: col.id }), "btn primary"),
          ]),
        ], "list-item");
        list.appendChild(item);
      }
      wrap.appendChild(list);
    }

    return wrap;
  }

  function renderNewCollection() {
    const wrap = h("div", { class: "container" });

    const nameInput = h("input", { class: "input", type: "text", placeholder: "Ej: Adrenalyn WC 2026" });
    const nInput = h("input", { class: "input", type: "number", min: "1", max: "5000", value: "100" });

    const form = card([
      h("h2", { class: "h2", text: "Nueva colección" }),
      h("label", { class: "label", text: "Nombre" }),
      nameInput,
      h("div", { style: "height:12px" }),
      h("label", { class: "label", text: "Cantidad de ítems (números 1..N)" }),
      nInput,
      h("div", { style: "height:14px" }),
      h("div", { class: "row gap" }, [
        btn("Crear", () => {
          const name = nameInput.value;
          const n = nInput.value;
          try {
            const col = createCollection(name, n);
            nav({ name: "collection", id: col.id });
          } catch (e) {
            alert(e.message || "No se pudo crear.");
          }
        }, "btn primary"),
        btn("Cancelar", () => goBack(), "btn"),
      ]),
      h("p", { class: "muted", text: "Esta versión crea ítems 1..N (simple y estable). Luego sumamos secciones, alfanuméricos, importaciones, etc." }),
    ]);

    wrap.appendChild(form);
    return wrap;
  }

  function renderSettings() {
    const wrap = h("div", { class: "container" });

    const fileInput = h("input", { type: "file", accept: "application/json", class: "input" });

    const c = card([
      h("h2", { class: "h2", text: "Ajustes / Backup" }),
      h("div", { class: "row gap" }, [
        btn("Exportar backup", () => exportBackup(), "btn primary"),
        btn("Importar (reemplazar)", async () => {
          const f = fileInput.files && fileInput.files[0];
          if (!f) return alert("Elegí un archivo .json primero.");
          const ok = confirm("Esto REEMPLAZA tus datos actuales por el backup. ¿Continuar?");
          if (!ok) return;
          try {
            await importBackupReplace(f);
            alert("Backup importado correctamente.");
            nav({ name: "home" });
          } catch (e) {
            alert(e.message || "No se pudo importar.");
          }
        }, "btn"),
      ]),
      h("div", { style: "height:10px" }),
      fileInput,
      h("div", { class: "divider" }),
      btn("Volver", () => goBack(), "btn"),
      h("p", { class: "muted", text: "Nota: quitamos “fusionar” para evitar duplicaciones y confusión." }),
    ]);

    wrap.appendChild(c);
    return wrap;
  }

  function renderCollection(col) {
    const wrap = h("div", { class: "container" });
    const st = statsForCollection(col);

    // Header card
    const header = card([
      h("div", { class: "row-between" }, [
        h("div", { class: "title-xl", text: col.name }),
        h("div", { class: "row gap" }, [
          btn("Editar", () => {
            const nuevo = prompt("Nuevo nombre:", col.name);
            if (nuevo == null) return;
            const n = String(nuevo).trim();
            if (!n) return alert("Nombre inválido.");
            col.name = n;
            updateCollection(col);
            render();
          }, "btn"),
          btn("Reset", () => {
            const ok = confirm("¿Resetear (Tengo=OFF, Rep=0) toda la colección?");
            if (!ok) return;
            resetCollection(col);
            render();
          }, "btn danger"),
        ]),
      ]),
      h("div", { class: "stats-row" }, [
        statBox("Total", st.total),
        statBox("Tengo", st.have),
        statBox("Faltan", st.missing),
        statBox("%", st.pct + "%"),
      ]),
      h("div", { class: "divider" }),
      h("div", { class: "row-between" }, [
        btn("Eliminar", () => {
          const ok = confirm("Eliminar colección definitivamente. ¿Seguro?");
          if (!ok) return;
          deleteCollection(col.id);
          nav({ name: "home" });
        }, "btn danger"),
        btn("Duplicar", () => {
          const clone = deepClone(col);
          clone.id = uid();
          clone.name = col.name + " (copia)";
          clone.createdAt = now();
          clone.updatedAt = now();
          STATE.collections.unshift(clone);
          saveState();
          nav({ name: "collection", id: clone.id });
        }, "btn primary"),
      ]),
    ]);

    wrap.appendChild(header);

    // Items (simple: sección única o múltiples)
    for (const sec of col.sections) {
      const secCard = card([
        h("div", { class: "row-between" }, [
          h("div", { class: "title-lg", text: sec.name }),
          h("div", { class: "muted", text: `Ítems: ${sec.items.length}` }),
        ]),
        h("div", { class: "grid-items" }, sec.items.map((it) => itemCard(col, it))),
      ]);

      wrap.appendChild(secCard);
    }

    return wrap;
  }

  function statBox(label, value) {
    return h("div", { class: "statbox" }, [
      h("div", { class: "statlabel", text: label }),
      h("div", { class: "statvalue", text: String(value) }),
    ]);
  }

  function itemCard(col, it) {
    const isHave = it.have;
    const rep = it.rep;

    const cardEl = h("div", { class: `item ${isHave ? "have" : ""}`.trim() }, [
      h("div", { class: "itemcode", text: it.code }),
      h("div", { class: "itemrep", text: `Rep: ${rep}` }),
      h("div", { class: "itemcontrols" }, [
        h("button", {
          type: "button",
          class: "mini",
          text: "−",
          onClick: () => {
            if (!it.have) return alert("Primero marcá este ítem como 'Tengo' tocándolo.");
            it.rep = clampInt(it.rep - 1, 0, 999);
            updateCollection(col);
            render();
          },
        }),
        h("button", {
          type: "button",
          class: "mini",
          text: "+",
          onClick: () => {
            if (!it.have) return alert("Primero marcá este ítem como 'Tengo' tocándolo.");
            it.rep = clampInt(it.rep + 1, 0, 999);
            updateCollection(col);
            render();
          },
        }),
      ]),
    ]);

    // Tap para alternar "Tengo"
    cardEl.addEventListener("click", (e) => {
      // evitar que el click en botones dispare toggle
      const t = e.target;
      if (t && t.closest && t.closest("button")) return;

      it.have = !it.have;
      if (!it.have) it.rep = 0; // coherencia
      updateCollection(col);
      render();
    });

    return cardEl;
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /******************
   * MIN CSS FALLBACK
   ******************/
  function injectFallbackCSS() {
    // Si ya tenés style.css, esto solo ayuda a que el app.js sea usable igual.
    if ($("#_fallback_css")) return;

    const css = `
      :root{--bg:#F4F5F7;--panel:#fff;--stroke:rgba(0,0,0,.08);--shadow:0 10px 30px rgba(0,0,0,.08);--accent:#2D7DF6;}
      body{margin:0;background:var(--bg);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:rgba(0,0,0,.88)}
      .topbar{position:sticky;top:0;z-index:100;background:var(--bg);border-bottom:1px solid var(--stroke);height:86px;display:flex;align-items:flex-end;padding:10px 18px 12px;gap:12px}
      .topbar-title{flex:1;text-align:center;font-size:38px;line-height:1.05;font-weight:900;letter-spacing:-.02em}
      .topbar-spacer{width:44px;height:44px}
      .icon-btn{width:44px;height:44px;border-radius:999px;border:1px solid var(--stroke);background:var(--panel);box-shadow:0 6px 16px rgba(0,0,0,.06);font-size:20px;font-weight:900}
      .hidden{display:none !important}
      .container{padding:18px 18px 30px}
      .card{background:var(--panel);border:1px solid var(--stroke);border-radius:26px;box-shadow:var(--shadow);padding:18px;margin-bottom:14px}
      .h2{margin:0 0 10px;font-size:34px;font-weight:900;letter-spacing:-.02em}
      .muted{color:rgba(0,0,0,.55);font-weight:800}
      .row{display:flex;align-items:center}
      .row-between{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .gap{gap:10px}
      .divider{height:1px;background:rgba(0,0,0,.08);margin:14px 0}
      .btn{border:1px solid var(--stroke);background:var(--panel);border-radius:999px;padding:12px 16px;font-weight:900;font-size:18px}
      .btn.primary{background:rgba(45,125,246,.16);border-color:rgba(45,125,246,.35);color:var(--accent)}
      .btn.danger{background:rgba(231,76,60,.16);border-color:rgba(231,76,60,.35);color:#c0392b}
      .input{width:100%;border:1px solid var(--stroke);border-radius:16px;padding:12px 14px;font-size:18px;outline:none;background:var(--panel)}
      .stack{display:flex;flex-direction:column;gap:12px;margin-top:12px}
      .title-xl{font-size:44px;font-weight:950;letter-spacing:-.02em}
      .title-lg{font-size:30px;font-weight:950;letter-spacing:-.02em}
      .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}
      .statbox{border:1px solid rgba(0,0,0,.06);background:rgba(0,0,0,.02);border-radius:20px;padding:14px;text-align:center}
      .statlabel{font-weight:900;color:rgba(0,0,0,.55)}
      .statvalue{font-weight:950;font-size:28px}
      .grid-items{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px}
      .item{border:1px solid rgba(0,0,0,.06);background:rgba(0,0,0,.02);border-radius:22px;padding:14px;box-shadow:none}
      .item.have{background:rgba(45,125,246,.10);border-color:rgba(45,125,246,.30)}
      .itemcode{font-size:26px;font-weight:950}
      .itemrep{margin-top:6px;color:rgba(0,0,0,.55);font-weight:900}
      .itemcontrols{display:flex;gap:10px;margin-top:10px}
      .mini{width:46px;height:46px;border-radius:999px;border:1px solid var(--stroke);background:var(--panel);font-size:26px;font-weight:950;color:var(--accent)}
      @media (max-width:420px){.grid-items{grid-template-columns:repeat(2,1fr)}}
    `;

    const style = document.createElement("style");
    style.id = "_fallback_css";
    style.textContent = css;
    document.head.appendChild(style);
  }

  /************
   * STARTUP  *
   ************/
  function start() {
    injectFallbackCSS();
    // ruta inicial
    if (!ROUTE_STACK.length) ROUTE_STACK.push({ name: "home" });
    render();
  }

  // Boot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
