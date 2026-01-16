const API = "/api";

function getToken() {
  return localStorage.getItem("accessToken");
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Sesión expirada");
  }

  if (!res.ok) throw new Error(data?.msg || "Error");
  return data;
}

/* ---------------------------
   Local fake info (envío/pago)
---------------------------- */
const LS_SHIP = "shipInfo";
const LS_PAY = "payMethods";
const LS_EXTRA = "profileExtra";
const LS_HISTORY = "purchaseHistory";

function loadShip() {
  return JSON.parse(localStorage.getItem(LS_SHIP) || "null") || {
    pais: "México",
    alcaldia: "—",
    cp: "—",
  };
}
function saveShip(obj) {
  localStorage.setItem(LS_SHIP, JSON.stringify(obj));
}

function loadPay() {
  return JSON.parse(localStorage.getItem(LS_PAY) || "null") || [
    { terminacion: "921" },
    { terminacion: "921" },
    { terminacion: "921" },
  ];
}
function savePay(arr) {
  localStorage.setItem(LS_PAY, JSON.stringify(arr));
}

function loadExtra() {
  return JSON.parse(localStorage.getItem(LS_EXTRA) || "null") || {
    edad: "+18",
    genero: "—",
  };
}
function saveExtra(obj) {
  localStorage.setItem(LS_EXTRA, JSON.stringify(obj));
}

function money(n) {
  const num = Number(n || 0);
  return num.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

/* ---------------------------
   Modal
---------------------------- */
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalClose = document.getElementById("modalClose");
const modalCancel = document.getElementById("modalCancel");
const modalSave = document.getElementById("modalSave");

let modalOnSave = null;

function openModal(title, html, onSave) {
  modalTitle.textContent = title;
  modalBody.innerHTML = html;
  modalOnSave = onSave;
  modal.classList.remove("hide");
}

function closeModal() {
  modal.classList.add("hide");
  modalBody.innerHTML = "";
  modalOnSave = null;
}

modalClose?.addEventListener("click", closeModal);
modalCancel?.addEventListener("click", closeModal);
modalSave?.addEventListener("click", async () => {
  if (typeof modalOnSave === "function") await modalOnSave();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal && !modal.classList.contains("hide")) closeModal();
});

/* ---------------------------
   Render UI
---------------------------- */
function renderShip() {
  const ship = loadShip();
  document.getElementById("sPais").textContent = ship.pais || "—";
  document.getElementById("sAlcaldia").textContent = ship.alcaldia || "—";
  document.getElementById("sCP").textContent = ship.cp || "—";
}

function renderPay() {
  const list = document.getElementById("payList");
  const pay = loadPay();
  list.innerHTML = pay
    .slice(0, 3)
    .map(
      (p) => `
      <div class="payItem">
        <div class="payLabel">Terminación</div>
        <div class="payValue">${p.terminacion || "—"}</div>
      </div>
    `
    )
    .join("");
}

function renderExtra() {
  const ex = loadExtra();
  document.getElementById("pEdad").textContent = ex.edad || "—";
  document.getElementById("pGenero").textContent = ex.genero || "—";
}

function renderHistory(items = []) {
  const el = document.getElementById("historyList");
  if (!items.length) {
    el.innerHTML = `<div class="historyEmpty">Aún no tienes compras registradas.</div>`;
    return;
  }

  el.innerHTML = items.slice(0, 3).map((it) => {
    const nombre = it.producto || it.nombre || "PRODUCTO";
    const fecha = it.fecha || "—";
    const cantidad = it.cantidad ?? it.qty ?? "—";
    const total = it.total ?? it.costo_total ?? it.total_gastado ?? 0;

    return `
      <div class="historyItem">
        <div class="historyProd">${nombre}</div>
        <div class="historyMeta">Fecha: ${fecha}<br/>Cantidad: ${cantidad}<br/>Costo total: ${money(total)}</div>
      </div>
    `;
  }).join("");
}

/* ---------------------------
   Load profile (API)
---------------------------- */
async function loadProfile() {
  const token = getToken();
  if (!token) {
    window.location.href = "/login";
    return;
  }

  try {
    const data = await fetchJSON(`${API}/user/profile`, { headers: authHeaders() });

    const u = data.usuario || JSON.parse(localStorage.getItem("user") || "null") || {};

    document.getElementById("pNombre").textContent = u.nombre || "—";
    document.getElementById("pCorreo").textContent = u.correo || "—";
    document.getElementById("pTelefono").textContent = u.telefono || "—";

  } catch (e) {
    // fallback local
    const u = JSON.parse(localStorage.getItem("user") || "null") || {};
    document.getElementById("pNombre").textContent = u.nombre || "—";
    document.getElementById("pCorreo").textContent = u.correo || "—";
    document.getElementById("pTelefono").textContent = u.telefono || "—";
  }
}

/* ---------------------------
   Load purchase history (API try, fallback local)
---------------------------- */
async function loadHistory() {
  const token = getToken();
  if (!token) return renderHistory([]);

  try {
    // Intento típico: /api/venta/mis-compras
    const data = await fetchJSON(`${API}/venta/mis-compras`, { headers: authHeaders() });

    const items = data.compras || data.historial || data.items || (Array.isArray(data) ? data : []);
    renderHistory(items);

  } catch (e) {
    // fallback local
    const local = JSON.parse(localStorage.getItem(LS_HISTORY) || "[]");
    renderHistory(local);
  }
}

/* ---------------------------
   Buttons actions
---------------------------- */
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  window.location.href = "/";
});

document.getElementById("btnEditProfile")?.addEventListener("click", async () => {
  const currentUser = JSON.parse(localStorage.getItem("user") || "null") || {};
  const ex = loadExtra();

  openModal(
    "Editar perfil",
    `
      <div class="mForm">
        <label>Nombre</label>
        <input id="m_nombre" value="${currentUser.nombre || ""}" />
        <label>Teléfono</label>
        <input id="m_tel" value="${currentUser.telefono || ""}" />
        <label>Edad</label>
        <input id="m_edad" value="${ex.edad || ""}" />
        <label>Género</label>
        <input id="m_genero" value="${ex.genero || ""}" />
      </div>
    `,
    async () => {
      const nombre = document.getElementById("m_nombre").value.trim();
      const telefono = document.getElementById("m_tel").value.trim();
      const edad = document.getElementById("m_edad").value.trim();
      const genero = document.getElementById("m_genero").value.trim();

      if (!nombre) return alert("El nombre es obligatorio.");

      // Guardar extra local
      saveExtra({ edad: edad || "—", genero: genero || "—" });

      // Intentar guardar en API
      try {
        await fetchJSON(`${API}/user/profile`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ nombre, telefono }),
        });

      } catch (e) {
        // fallback local
        currentUser.nombre = nombre;
        currentUser.telefono = telefono;
        localStorage.setItem("user", JSON.stringify(currentUser));
      }

      await loadProfile();
      renderExtra();
      closeModal();
    }
  );
});

document.getElementById("btnEditShipping")?.addEventListener("click", () => {
  const ship = loadShip();

  openModal(
    "Editar envío",
    `
      <div class="mForm">
        <label>País</label>
        <input id="m_pais" value="${ship.pais || ""}" />
        <label>Alcaldía</label>
        <input id="m_alc" value="${ship.alcaldia || ""}" />
        <label>Código Postal</label>
        <input id="m_cp" value="${ship.cp || ""}" />
      </div>
    `,
    async () => {
      const pais = document.getElementById("m_pais").value.trim();
      const alcaldia = document.getElementById("m_alc").value.trim();
      const cp = document.getElementById("m_cp").value.trim();

      saveShip({ pais: pais || "—", alcaldia: alcaldia || "—", cp: cp || "—" });
      renderShip();
      closeModal();
    }
  );
});

document.getElementById("btnEditPayment")?.addEventListener("click", () => {
  const pay = loadPay();

  openModal(
    "Editar método de pago",
    `
      <div class="mForm">
        <label>Terminación 1</label>
        <input id="m_t1" value="${pay[0]?.terminacion || ""}" maxlength="4" />
        <label>Terminación 2</label>
        <input id="m_t2" value="${pay[1]?.terminacion || ""}" maxlength="4" />
        <label>Terminación 3</label>
        <input id="m_t3" value="${pay[2]?.terminacion || ""}" maxlength="4" />
        <div class="mHint">*Solo es visual (práctica). Puedes poner últimos 3–4 dígitos.</div>
      </div>
    `,
    async () => {
      const t1 = document.getElementById("m_t1").value.trim();
      const t2 = document.getElementById("m_t2").value.trim();
      const t3 = document.getElementById("m_t3").value.trim();

      savePay([
        { terminacion: t1 || "—" },
        { terminacion: t2 || "—" },
        { terminacion: t3 || "—" },
      ]);

      renderPay();
      closeModal();
    }
  );
});

document.getElementById("btnEditAll")?.addEventListener("click", () => {
  // abre el mismo modal pero con todo junto
  const u = JSON.parse(localStorage.getItem("user") || "null") || {};
  const ship = loadShip();
  const pay = loadPay();
  const ex = loadExtra();

  openModal(
    "Editar toda la información",
    `
      <div class="mForm">
        <h4>Cuenta</h4>
        <label>Nombre</label>
        <input id="m_nombre" value="${u.nombre || ""}" />
        <label>Teléfono</label>
        <input id="m_tel" value="${u.telefono || ""}" />
        <label>Edad</label>
        <input id="m_edad" value="${ex.edad || ""}" />
        <label>Género</label>
        <input id="m_genero" value="${ex.genero || ""}" />

        <h4>Envío</h4>
        <label>País</label>
        <input id="m_pais" value="${ship.pais || ""}" />
        <label>Alcaldía</label>
        <input id="m_alc" value="${ship.alcaldia || ""}" />
        <label>Código Postal</label>
        <input id="m_cp" value="${ship.cp || ""}" />

        <h4>Pago</h4>
        <label>Terminación 1</label>
        <input id="m_t1" value="${pay[0]?.terminacion || ""}" maxlength="4" />
        <label>Terminación 2</label>
        <input id="m_t2" value="${pay[1]?.terminacion || ""}" maxlength="4" />
        <label>Terminación 3</label>
        <input id="m_t3" value="${pay[2]?.terminacion || ""}" maxlength="4" />
      </div>
    `,
    async () => {
      // Guardar local
      saveExtra({
        edad: document.getElementById("m_edad").value.trim() || "—",
        genero: document.getElementById("m_genero").value.trim() || "—",
      });

      saveShip({
        pais: document.getElementById("m_pais").value.trim() || "—",
        alcaldia: document.getElementById("m_alc").value.trim() || "—",
        cp: document.getElementById("m_cp").value.trim() || "—",
      });

      savePay([
        { terminacion: document.getElementById("m_t1").value.trim() || "—" },
        { terminacion: document.getElementById("m_t2").value.trim() || "—" },
        { terminacion: document.getElementById("m_t3").value.trim() || "—" },
      ]);

      // Intentar API para nombre/tel
      const nombre = document.getElementById("m_nombre").value.trim();
      const telefono = document.getElementById("m_tel").value.trim();
      if (nombre) {
        try {
          await fetchJSON(`${API}/user/profile`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ nombre, telefono }),
          });
        } catch (e) {
          u.nombre = nombre;
          u.telefono = telefono;
          localStorage.setItem("user", JSON.stringify(u));
        }
      }

      await loadProfile();
      renderExtra();
      renderShip();
      renderPay();
      closeModal();
    }
  );
});

document.getElementById("btnDeleteAccount")?.addEventListener("click", async () => {
  const password = prompt("Escribe tu contraseña para confirmar:");
  if (!password) return;

  const confirmacion = prompt('Escribe "ELIMINAR" (en mayúsculas) para confirmar:');
  if (confirmacion !== "ELIMINAR") {
    alert("Cancelado");
    return;
  }

  try {
    await fetchJSON(`${API}/user/eliminar-cuenta`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ password, confirmacion }),
    });

    alert("✅ Cuenta eliminada correctamente");
    localStorage.clear();
    window.location.href = "/";
  } catch (e) {
    alert(e.message || "No se pudo eliminar la cuenta");
  }
});

document.getElementById("btnHistoryMore")?.addEventListener("click", () => {
  alert("En esta práctica solo mostramos un resumen (3 compras).");
});

/* init */
(async function init() {
  await loadProfile();
  renderExtra();
  renderShip();
  renderPay();
  await loadHistory();
})();
