/* Colección Lucho — v4 (sandbox) */

const LS_KEY = "coleccion_luciano_v4";

const state = {
  data: { collections: [] },
};

const $ = (id) => document.getElementById(id);

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

function init() {
  load();

  const status = $("status");
  const btn = $("btnTest");

  if (status) {
    status.textContent = `v4 lista ✅ (colecciones: ${state.data.collections.length})`;
  }

  if (btn) {
    btn.addEventListener("click", () => {
      alert("Botón v4 funcionando 🚀");
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
