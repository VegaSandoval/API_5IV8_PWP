const API = "/api";

function moneyMXN(n) {
  const num = Number(n || 0);
  return num.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function authHeaders() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  // si token inválido
  if (res.status === 401) {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    window.location.href = "/login";
    return;
  }

  if (!res.ok) {
    const msg = data?.msg || data?.message || "Error";
    throw new Error(msg);
  }
  return data;
}

async function requireAdmin() {
  const token = localStorage.getItem("accessToken");
  if (!token) {
    window.location.href = "/login";
    return false;
  }

  // Validar rol desde API (tu authMiddleware ya mete req.user.rol)
  const data = await fetchJSON(`${API}/user/profile`, {
    headers: authHeaders(),
  });

  const rol =
    (data?.rol ||
      data?.user?.rol ||
      data?.usuario?.rol ||
      data?.profile?.rol ||
      "").toString().toLowerCase();

  if (rol !== "admin") {
    window.location.href = "/";
    return false;
  }
  return true;
}

/* Tabs */
function setTab(tab) {
  const btns = document.querySelectorAll("[data-tab]");
  btns.forEach((b) => {
    const active = b.getAttribute("data-tab") === tab;
    b.classList.toggle("is-active", active);
    b.classList.toggle("pillBtn--outline", !active);
  });

  document.getElementById("panelProducts")?.classList.toggle("hide", tab !== "products");
  document.getElementById("panelSales")?.classList.toggle("hide", tab !== "sales");
}

/* Dashboard */
async function loadDashboard() {
  const d = await fetchJSON(`${API}/admin/dashboard`, { headers: authHeaders() });

  document.getElementById("kpiVentas").textContent = moneyMXN(d?.ventas?.ingresos_totales || 0);
  document.getElementById("kpiTotalVentas").textContent = String(d?.ventas?.total || 0);
  document.getElementById("kpiProductos").textContent = String(d?.productos?.total || 0);
  document.getElementById("kpiStockBajo").textContent = String(d?.productos?.stock_bajo || 0);
}

/* Productos */
function extractProducts(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.productos)) return data.productos;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

async function loadProducts() {
  // Puedes listar desde /api/productos (público) o crear tu endpoint admin list.
  const data = await fetchJSON(`${API}/productos`);
  const products = extractProducts(data);

  const tbody = document.getElementById("productsTbody");
  if (!tbody) return;

  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="adminEmpty">No hay productos</td></tr>`;
    return;
  }

  tbody.innerHTML = products
    .map((p) => {
      const id = p.id ?? p.producto_id;
      const nombre = p.nombre ?? "Producto";
      const precio = Number(p.precio || 0).toFixed(2);
      const stock = Number(p.stock || 0);

      return `
        <tr data-prod-row="${id}">
          <td>${id}</td>
          <td>${escapeHTML(nombre)}</td>
          <td>$${escapeHTML(precio)}</td>
          <td><strong>${stock}</strong></td>

          <td>
            <div class="adminStockControls">
              <input type="number" min="0" value="1" data-stock-cant />
              <select data-stock-op>
                <option value="sumar">Sumar</option>
                <option value="restar">Restar</option>
                <option value="establecer">Establecer</option>
              </select>
              <button class="pillBtn pillBtn--outline" type="button" data-act="stock">Aplicar</button>
            </div>
          </td>

          <td style="white-space:nowrap">
            <button class="pillBtn pillBtn--outline" type="button" data-act="delete">Eliminar</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function escapeHTML(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function createProduct(form) {
  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());

  const msgEl = document.getElementById("createMsg");
  if (msgEl) msgEl.textContent = "";

  // normalizar números
  payload.precio = Number(payload.precio || 0);
  payload.stock = Number(payload.stock || 0);

  const res = await fetchJSON(`${API}/admin/productos`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (msgEl) msgEl.textContent = res?.msg || "Producto creado";
  form.reset();
  await loadProducts();
  await loadDashboard();
}

async function updateStock(productId, cantidad, operacion) {
  const res = await fetchJSON(`${API}/admin/productos/${productId}/stock`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ cantidad, operacion }),
  });

  await loadProducts();
  await loadDashboard();
  return res;
}

async function deleteProduct(productId) {
  const res = await fetchJSON(`${API}/admin/productos/${productId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  await loadProducts();
  await loadDashboard();
  return res;
}

/* Ventas */
let salesState = { page: 1, limit: 20, estado: "", desde: "", hasta: "" };

function salesQS() {
  const qs = new URLSearchParams();
  qs.set("page", String(salesState.page));
  qs.set("limit", String(salesState.limit));
  if (salesState.estado) qs.set("estado", salesState.estado);
  if (salesState.desde) qs.set("fecha_desde", salesState.desde);
  if (salesState.hasta) qs.set("fecha_hasta", salesState.hasta);
  return qs.toString();
}

async function loadSales() {
  const tbody = document.getElementById("salesTbody");
  if (!tbody) return;

  const data = await fetchJSON(`${API}/admin/ventas?${salesQS()}`, {
    headers: authHeaders(),
  });

  const ventas = Array.isArray(data?.ventas) ? data.ventas : [];
  const pag = data?.paginacion || {};

  document.getElementById("salesPageInfo").textContent =
    `Página ${pag.pagina_actual || salesState.page} de ${pag.total_paginas || 1}`;

  if (!ventas.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="adminEmpty">No hay ventas</td></tr>`;
    return;
  }

  tbody.innerHTML = ventas
    .map((v) => {
      const cliente = v?.cliente?.nombre || "Usuario";
      const correo = v?.cliente?.correo ? ` (${v.cliente.correo})` : "";
      const fecha = v?.fecha ? new Date(v.fecha).toLocaleString("es-MX") : "";

      return `
        <tr>
          <td>${v.id}</td>
          <td>${escapeHTML(cliente + correo)}</td>
          <td>${moneyMXN(v.total)}</td>
          <td>${escapeHTML(v.metodo_pago || "")}</td>
          <td>${escapeHTML(v.estado || "")}</td>
          <td>${escapeHTML(fecha)}</td>
        </tr>
      `;
    })
    .join("");

  // botones pager
  const totalPages = Number(pag.total_paginas || 1);
  document.getElementById("btnPrevSales").disabled = salesState.page <= 1;
  document.getElementById("btnNextSales").disabled = salesState.page >= totalPages;
}

/* Logout */
function logout() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  window.location.href = "/login";
}

document.addEventListener("DOMContentLoaded", async () => {
  // proteger admin
  const ok = await requireAdmin();
  if (!ok) return;

  // tabs
  document.addEventListener("click", (e) => {
    const tabBtn = e.target.closest("[data-tab]");
    if (tabBtn) setTab(tabBtn.getAttribute("data-tab"));

    // acciones en tabla productos
    const actBtn = e.target.closest("[data-act]");
    if (actBtn) {
      const act = actBtn.getAttribute("data-act");
      const row = actBtn.closest("[data-prod-row]");
      if (!row) return;
      const productId = row.getAttribute("data-prod-row");

      if (act === "stock") {
        const cant = Number(row.querySelector("[data-stock-cant]")?.value || 0);
        const op = row.querySelector("[data-stock-op]")?.value || "sumar";
        updateStock(productId, cant, op).catch((err) => alert(err.message));
      }

      if (act === "delete") {
        if (!confirm("¿Eliminar producto? (si está en carritos no te dejará)")) return;
        deleteProduct(productId).catch((err) => alert(err.message));
      }
    }
  });

  // forms
  document.getElementById("formCreateProduct")?.addEventListener("submit", (e) => {
    e.preventDefault();
    createProduct(e.currentTarget).catch((err) => alert(err.message));
  });

  document.getElementById("btnRefreshProducts")?.addEventListener("click", () => {
    loadProducts().catch((err) => alert(err.message));
  });

  // ventas
  document.getElementById("btnRefreshSales")?.addEventListener("click", () => {
    loadSales().catch((err) => alert(err.message));
  });

  document.getElementById("btnApplySalesFilters")?.addEventListener("click", () => {
    salesState.estado = document.getElementById("saleEstado")?.value || "";
    salesState.desde = document.getElementById("saleDesde")?.value || "";
    salesState.hasta = document.getElementById("saleHasta")?.value || "";
    salesState.page = 1;
    loadSales().catch((err) => alert(err.message));
  });

  document.getElementById("btnPrevSales")?.addEventListener("click", () => {
    salesState.page = Math.max(1, salesState.page - 1);
    loadSales().catch((err) => alert(err.message));
  });

  document.getElementById("btnNextSales")?.addEventListener("click", () => {
    salesState.page += 1;
    loadSales().catch((err) => alert(err.message));
  });

  document.getElementById("adminLogoutBtn")?.addEventListener("click", logout);

  // default tab
  setTab("products");

  // load
  await loadDashboard();
  await loadProducts();
  await loadSales();
});
