const app = document.getElementById("app");

/* =========================
   ESTADO SIMPLE DE LA APP
========================= */

let state = {
  view: "home"
};

/* =========================
   RENDER PRINCIPAL
========================= */

function render() {
  app.innerHTML = "";

  if (state.view === "home") {
    renderHome();
  }

  if (state.view === "colecciones") {
    renderColecciones();
  }
}

/* =========================
   PANTALLA HOME
========================= */

function renderHome() {
  const card = document.createElement("div");
  card.className = "card";

  const title = document.createElement("h2");
  title.textContent = "Bienvenido";
  title.style.marginTop = "0";

  const button = document.createElement("button");
  button.className = "btn";
  button.textContent = "Mis Colecciones";

  button.onclick = () => {
    state.view = "colecciones";
    render();
  };

  card.appendChild(title);
  card.appendChild(button);

  app.appendChild(card);
}

/* =========================
   PANTALLA COLECCIONES
========================= */

function renderColecciones() {
  const card = document.createElement("div");
  card.className = "card";

  const title = document.createElement("h2");
  title.textContent = "Mis Colecciones";
  title.style.marginTop = "0";

  const back = document.createElement("button");
  back.className = "btn";
  back.textContent = "Volver";

  back.onclick = () => {
    state.view = "home";
    render();
  };

  card.appendChild(title);
  card.appendChild(back);

  app.appendChild(card);
}

/* =========================
   INICIO
========================= */

render();
