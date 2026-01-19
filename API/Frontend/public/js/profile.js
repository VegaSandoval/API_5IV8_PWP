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

  if (!res.ok) {
    // si el backend manda {msg, faltantes}, lo respetamos
    const msg = data?.msg || "Error";
    const extra = Array.isArray(data?.faltantes) ? `\nFaltantes: ${data.faltantes.join(", ")}` : "";
    throw new Error(msg + extra);
  }
  return data;
}

/* ---------------------------
   Extra local (edad/género) - no existe en BD
---------------------------- */
const LS_EXTRA = "profileExtra";

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

function cap(s) {
  if (!s) return "—";
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

/* ---------------------------
   Estado en memoria (envío/pago)
---------------------------- */
let currentEnvio = null;
let currentPago = null;

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
function renderExtra() {
  const ex = loadExtra();
  document.getElementById("pEdad").textContent = ex.edad || "—";
  document.getElementById("pGenero").textContent = ex.genero || "—";
}

function renderShip() {
  // Tu UI solo muestra 3 campos: País, Alcaldía, CP
  // Mapeo simple a tu BD:
  // - País: fijo "México" (no lo guardamos)
  // - Alcaldía: usamos "ciudad"
  // - CP: usamos "cp"
  const envio = currentEnvio;

  document.getElementById("sPais").textContent = "México";
  document.getElementById("sAlcaldia").textContent = envio?.ciudad || "—";
  document.getElementById("sCP").textContent = envio?.cp || "—";
}

function renderPay() {
  const list = document.getElementById("payList");
  const p = currentPago;

  if (!p) {
    list.innerHTML = `
      <div class="payItem">
        <div class="payLabel">Método</div>
        <div class="payValue">—</div>
      </div>
      <div class="payItem">
        <div class="payLabel">Terminación</div>
        <div class="payValue">—</div>
      </div>
      <div class="payItem">
        <div class="payLabel">Expira</div>
        <div class="payValue">—</div>
      </div>
    `;
    return;
  }

  const metodo = p.metodo || "—";
  const last4 = metodo === "tarjeta" ? (p.last4 || "—") : "—";
  const expira =
    metodo === "tarjeta" && p.exp_mes && p.exp_anio
      ? `${String(p.exp_mes).padStart(2, "0")}/${String(p.exp_anio).slice(-2)}`
      : "—";

  list.innerHTML = `
    <div class="payItem">
      <div class="payLabel">Método</div>
      <div class="payValue">${cap(metodo)}</div>
    </div>

    <div class="payItem">
      <div class="payLabel">Terminación</div>
      <div class="payValue">${last4}</div>
    </div>

    <div class="payItem">
      <div class="payLabel">Expira</div>
      <div class="payValue">${expira}</div>
    </div>
  `;
}

function renderHistory(compras = []) {
  const el = document.getElementById("historyList");
  if (!compras.length) {
    el.innerHTML = `<div class="historyEmpty">Aún no tienes compras registradas.</div>`;
    return;
  }

  el.innerHTML = compras.slice(0, 3).map((c) => {
    const fecha = c.fecha ? new Date(c.fecha).toLocaleDateString("es-MX") : "—";
    const total = money(c.total);
    const items = Array.isArray(c.items) ? c.items : [];
    const totalProductos = items.reduce((sum, it) => sum + (Number(it.cantidad) || 0), 0);

    const nombres = items.length
      ? items
          .slice(0, 2)
          .map((it) => it.nombre || "Producto")
          .join(", ") + (items.length > 2 ? "..." : "")
      : `Compra #${c.id}`;

    return `
      <div class="historyItem">
        <div class="historyProd">${nombres}</div>
        <div class="historyMeta">
          Fecha: ${fecha}<br/>
          Productos: ${totalProductos || "—"}<br/>
          Total: ${total}<br/>
          Pago: ${cap(c.metodo_pago || "—")}
        </div>
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

  const data = await fetchJSON(`${API}/user/profile`, { headers: authHeaders() });
  const u = data.usuario || JSON.parse(localStorage.getItem("user") || "null") || {};

  document.getElementById("pNombre").textContent = u.nombre || "—";
  document.getElementById("pCorreo").textContent = u.correo || "—";
  document.getElementById("pTelefono").textContent = u.telefono || "—";
}

/* ---------------------------
   Load envio/pago (API)
---------------------------- */
async function loadEnvio() {
  const token = getToken();
  if (!token) return;

  const data = await fetchJSON(`${API}/user/envio`, { headers: authHeaders() });
  currentEnvio = data.envio || null;
  renderShip();
}

async function loadPago() {
  const token = getToken();
  if (!token) return;

  const data = await fetchJSON(`${API}/user/pago`, { headers: authHeaders() });
  currentPago = data.pago || null;
  renderPay();
}

/* ---------------------------
   Load purchase history (API)
---------------------------- */
async function loadHistory() {
  const token = getToken();
  if (!token) return renderHistory([]);

  // Tu saleRoutes.js tiene GET "/historial"
  const data = await fetchJSON(`${API}/venta/historial?limit=10&page=1`, { headers: authHeaders() });
  renderHistory(data.compras || []);
}

/* ---------------------------
   Helpers inputs (pago)
---------------------------- */
function toggleTarjetaFields(selectId, wrapId) {
  const sel = document.getElementById(selectId);
  const wrap = document.getElementById(wrapId);
  if (!sel || !wrap) return;

  const isTarjeta = sel.value === "tarjeta";
  wrap.style.display = isTarjeta ? "block" : "none";
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
  const u = JSON.parse(localStorage.getItem("user") || "null") || {};
  const ex = loadExtra();

  openModal(
    "Editar perfil",
    `
      <div class="mForm">
        <label>Nombre</label>
        <input id="m_nombre" value="${u.nombre || ""}" />

        <label>Teléfono</label>
        <input id="m_tel" value="${u.telefono || ""}" />

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

      // Extra local
      saveExtra({ edad: edad || "—", genero: genero || "—" });

      // API perfil
      await fetchJSON(`${API}/user/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ nombre, telefono }),
      });

      await loadProfile();
      renderExtra();
      closeModal();
    }
  );
});

/* -------- ENVIO (API) -------- */
document.getElementById("btnEditShipping")?.addEventListener("click", () => {
  const e = currentEnvio || {};

  openModal(
    "Editar envío",
    `
      <div class="mForm">
        <label>Nombre (recibe)</label>
        <input id="m_e_nombre" value="${e.nombre || ""}" />

        <label>Teléfono</label>
        <input id="m_e_tel" value="${e.telefono || ""}" />

        <label>Calle</label>
        <input id="m_e_calle" value="${e.calle || ""}" />

        <label>Número exterior</label>
        <input id="m_e_ext" value="${e.num_ext || ""}" />

        <label>Número interior (opcional)</label>
        <input id="m_e_int" value="${e.num_int || ""}" />

        <label>Colonia</label>
        <input id="m_e_col" value="${e.colonia || ""}" />

        <label>Alcaldía / Ciudad</label>
        <input id="m_e_ciu" value="${e.ciudad || ""}" />

        <label>Estado</label>
        <input id="m_e_est" value="${e.estado || ""}" />

        <label>Código Postal</label>
        <input id="m_e_cp" value="${e.cp || ""}" />

        <label>Referencias (opcional)</label>
        <input id="m_e_ref" value="${e.referencias || ""}" />
      </div>
    `,
    async () => {
      const payload = {
        nombre: document.getElementById("m_e_nombre").value.trim(),
        telefono: document.getElementById("m_e_tel").value.trim(),
        calle: document.getElementById("m_e_calle").value.trim(),
        num_ext: document.getElementById("m_e_ext").value.trim(),
        num_int: document.getElementById("m_e_int").value.trim(),
        colonia: document.getElementById("m_e_col").value.trim(),
        ciudad: document.getElementById("m_e_ciu").value.trim(),
        estado: document.getElementById("m_e_est").value.trim(),
        cp: document.getElementById("m_e_cp").value.trim(),
        referencias: document.getElementById("m_e_ref").value.trim(),
      };

      await fetchJSON(`${API}/user/envio`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });

      await loadEnvio();
      closeModal();
    }
  );
});

/* -------- PAGO (API) -------- */
document.getElementById("btnEditPayment")?.addEventListener("click", () => {
  const p = currentPago || {};
  const metodo = p.metodo || "efectivo";

  openModal(
    "Editar método de pago",
    `
      <div class="mForm">
        <label>Método</label>
        <select id="m_p_metodo" class="mSelect">
          <option value="efectivo" ${metodo === "efectivo" ? "selected" : ""}>Efectivo</option>
          <option value="tarjeta" ${metodo === "tarjeta" ? "selected" : ""}>Tarjeta</option>
          <option value="transferencia" ${metodo === "transferencia" ? "selected" : ""}>Transferencia</option>
          <option value="paypal" ${metodo === "paypal" ? "selected" : ""}>PayPal</option>
        </select>

        <label>Titular (opcional)</label>
        <input id="m_p_titular" value="${p.titular || ""}" />

        <div id="tarjetaWrap" style="margin-top:6px;">
          <label>Marca (opcional)</label>
          <input id="m_p_marca" value="${p.marca || ""}" />

          <label>Últimos 4 dígitos</label>
          <input id="m_p_last4" value="${p.last4 || ""}" maxlength="4" />

          <label>Expira (mes)</label>
          <input id="m_p_mes" value="${p.exp_mes || ""}" placeholder="MM" />

          <label>Expira (año)</label>
          <input id="m_p_anio" value="${p.exp_anio || ""}" placeholder="YYYY" />

          <div class="mHint">*No guardes tarjeta completa ni CVV (solo práctica: last4 + expiración).</div>
        </div>
      </div>
    `,
    async () => {
      const metodoSel = document.getElementById("m_p_metodo").value;
      const payload = {
        metodo: metodoSel,
        titular: document.getElementById("m_p_titular").value.trim(),
        marca: document.getElementById("m_p_marca")?.value.trim() || null,
        last4: document.getElementById("m_p_last4")?.value.trim() || null,
        exp_mes: document.getElementById("m_p_mes")?.value.trim() || null,
        exp_anio: document.getElementById("m_p_anio")?.value.trim() || null,
      };

      // Limpieza simple si NO es tarjeta
      if (metodoSel !== "tarjeta") {
        payload.marca = null;
        payload.last4 = null;
        payload.exp_mes = null;
        payload.exp_anio = null;
      }

      await fetchJSON(`${API}/user/pago`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });

      await loadPago();
      closeModal();
    }
  );

  // comportamiento mostrar/ocultar campos de tarjeta
  toggleTarjetaFields("m_p_metodo", "tarjetaWrap");
  document.getElementById("m_p_metodo")?.addEventListener("change", () => {
    toggleTarjetaFields("m_p_metodo", "tarjetaWrap");
  });
});

/* -------- EDITAR TODO (API) -------- */
document.getElementById("btnEditAll")?.addEventListener("click", () => {
  const u = JSON.parse(localStorage.getItem("user") || "null") || {};
  const ex = loadExtra();
  const e = currentEnvio || {};
  const p = currentPago || {};
  const metodo = p.metodo || "efectivo";

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
        <label>Nombre (recibe)</label>
        <input id="m_e_nombre" value="${e.nombre || ""}" />

        <label>Teléfono</label>
        <input id="m_e_tel" value="${e.telefono || ""}" />

        <label>Calle</label>
        <input id="m_e_calle" value="${e.calle || ""}" />

        <label>Número exterior</label>
        <input id="m_e_ext" value="${e.num_ext || ""}" />

        <label>Número interior (opcional)</label>
        <input id="m_e_int" value="${e.num_int || ""}" />

        <label>Colonia</label>
        <input id="m_e_col" value="${e.colonia || ""}" />

        <label>Alcaldía / Ciudad</label>
        <input id="m_e_ciu" value="${e.ciudad || ""}" />

        <label>Estado</label>
        <input id="m_e_est" value="${e.estado || ""}" />

        <label>Código Postal</label>
        <input id="m_e_cp" value="${e.cp || ""}" />

        <label>Referencias (opcional)</label>
        <input id="m_e_ref" value="${e.referencias || ""}" />

        <h4>Pago</h4>
        <label>Método</label>
        <select id="m_p_metodo" class="mSelect">
          <option value="efectivo" ${metodo === "efectivo" ? "selected" : ""}>Efectivo</option>
          <option value="tarjeta" ${metodo === "tarjeta" ? "selected" : ""}>Tarjeta</option>
          <option value="transferencia" ${metodo === "transferencia" ? "selected" : ""}>Transferencia</option>
          <option value="paypal" ${metodo === "paypal" ? "selected" : ""}>PayPal</option>
        </select>

        <label>Titular (opcional)</label>
        <input id="m_p_titular" value="${p.titular || ""}" />

        <div id="tarjetaWrap" style="margin-top:6px;">
          <label>Marca (opcional)</label>
          <input id="m_p_marca" value="${p.marca || ""}" />

          <label>Últimos 4 dígitos</label>
          <input id="m_p_last4" value="${p.last4 || ""}" maxlength="4" />

          <label>Expira (mes)</label>
          <input id="m_p_mes" value="${p.exp_mes || ""}" placeholder="MM" />

          <label>Expira (año)</label>
          <input id="m_p_anio" value="${p.exp_anio || ""}" placeholder="YYYY" />
        </div>
      </div>
    `,
    async () => {
      // Extra local
      saveExtra({
        edad: document.getElementById("m_edad").value.trim() || "—",
        genero: document.getElementById("m_genero").value.trim() || "—",
      });

      // Perfil (API)
      const nombre = document.getElementById("m_nombre").value.trim();
      const telefono = document.getElementById("m_tel").value.trim();

      await fetchJSON(`${API}/user/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ nombre, telefono }),
      });

      // Envío (API)
      const envioPayload = {
        nombre: document.getElementById("m_e_nombre").value.trim(),
        telefono: document.getElementById("m_e_tel").value.trim(),
        calle: document.getElementById("m_e_calle").value.trim(),
        num_ext: document.getElementById("m_e_ext").value.trim(),
        num_int: document.getElementById("m_e_int").value.trim(),
        colonia: document.getElementById("m_e_col").value.trim(),
        ciudad: document.getElementById("m_e_ciu").value.trim(),
        estado: document.getElementById("m_e_est").value.trim(),
        cp: document.getElementById("m_e_cp").value.trim(),
        referencias: document.getElementById("m_e_ref").value.trim(),
      };

      await fetchJSON(`${API}/user/envio`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(envioPayload),
      });

      // Pago (API)
      const metodoSel = document.getElementById("m_p_metodo").value;
      const pagoPayload = {
        metodo: metodoSel,
        titular: document.getElementById("m_p_titular").value.trim(),
        marca: document.getElementById("m_p_marca")?.value.trim() || null,
        last4: document.getElementById("m_p_last4")?.value.trim() || null,
        exp_mes: document.getElementById("m_p_mes")?.value.trim() || null,
        exp_anio: document.getElementById("m_p_anio")?.value.trim() || null,
      };

      if (metodoSel !== "tarjeta") {
        pagoPayload.marca = null;
        pagoPayload.last4 = null;
        pagoPayload.exp_mes = null;
        pagoPayload.exp_anio = null;
      }

      await fetchJSON(`${API}/user/pago`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(pagoPayload),
      });

      // Reload UI
      await loadProfile();
      renderExtra();
      await loadEnvio();
      await loadPago();
      closeModal();
    }
  );

  toggleTarjetaFields("m_p_metodo", "tarjetaWrap");
  document.getElementById("m_p_metodo")?.addEventListener("change", () => {
    toggleTarjetaFields("m_p_metodo", "tarjetaWrap");
  });
});

/* -------- DELETE ACCOUNT (API) -------- */
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
  const token = getToken();
  if (!token) {
    window.location.href = "/login";
    return;
  }

  try {
    await loadProfile();
  } catch (e) {
    // si falla, fetchJSON ya redirige en 401
  }

  renderExtra();
  await loadEnvio();
  await loadPago();
  await loadHistory();
})();
