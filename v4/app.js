(() => {

  const $ = (id) => document.getElementById(id);

  function init() {

    const status = $("status");
    const btn = $("btnTest");

    if (status) {
      status.textContent = "v4 lista ✅";
    }

    if (btn) {
      btn.addEventListener("click", () => {
        alert("Botón v4 funcionando 🚀");
      });
    }

  }

  document.addEventListener("DOMContentLoaded", init);

})();
