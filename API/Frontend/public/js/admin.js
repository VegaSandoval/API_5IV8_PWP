const API = "/api";

function getToken() {
  return localStorage.getItem("accessToken");
}
function getUserLS() {
  return JSON.parse(localStorage.getItem("user") || "null") || {};
}
function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    window.location.href = "/login?next=/admin";
    throw new Error("401");
  }

  if (res.status === 403) {
    window.location.href = "/products";
    throw new Error("403");
  }

  if (!res.ok) throw new Error(data?.msg || "Error");
  return data;
}

function isAdmin(u) {
  const rol = String(u?.rol || u?.role || "").toLowerCase();
  return rol === "admin";
}

/* ---------------------------
   Tabs (admin.ejs usa onclick inline)
---------------------------- */
function showTab(name) {
  const tabs = ["productos", "ventas", "usuarios", "stock"];
  tabs.forEach((t) => {
    const el = document.getElementById(`tab-${t}`);
    if (!el) return;
    el.classList.toggle("hide", t !== name);
  });

  // botones
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    const active = btn.getAttribute("data-tab") === name;
    btn.classList.toggle("btn-primary", active);
    btn.classList.toggle("btn-ghost", !active);
  });
}
window.showTab = showTab;

/* ---------------------------
   Modal (crear/editar producto)
---------------------------- */
function openProductModal() {
  document.getElementById("productModal")?.classList.remove("hide");
}
function closeProductModal() {
  document.getElementById("productModal")?.classList.add("hide");
  document.getElementById("productForm")?.reset();
  const id = document.getElementById("productId");
  if (id) id.value = "";
  const title = document.getElementById("modalTitle");
  if (title) title.textContent = "Crear Producto";
}
window.closeProductModal = closeProductModal;

function fillProductForm(p) {
  document.getElementById("productId").value = p.id ?? "";
  document.getElementById("prod_nombre").value = p.nombre ?? "";
  document.getElementById("prod_descripcion").value = p.descripcion ?? "";
  document.getElementById("prod_precio").value = p.precio ?? 0;
  document.getElementById("prod_stock").value = p.stock ?? 0;
  document.getElementById("prod_categoria").value = p.categoria ?? "";
  document.getElementById("prod_color").value = p.color ?? "";
  document.getElementById("prod_imagen").value = p.imagen ?? "";
}

function showCreateProductModal() {
  closeProductModal();
  document.getElementById("modalTitle").textContent = "Crear Producto";
  openProductModal();
}
window.showCreateProductModal = showCreateProductModal;

async function showEditProductModal(id) {
  // obtenemos el producto desde /api/productos/:id (público)
  const data = await fetchJSON(`${API}/productos/${encodeURIComponent(id)}`);
  const p = data.producto || data;

  document.getElementById("modalTitle").textContent = "Editar Producto";
  fillProductForm(p);
  openProductModal();
}
window.showEditProductModal = showEditProductModal;

/* ---------------------------
   Render helpers
---------------------------- */
function moneyMXN(n) {
  const num = Number(n || 0);
  return num.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function safeArr(x) {
  return Array.isArray(x) ? x : [];
}

/* ---------------------------
   Loads
---------------------------- */
async function loadDashboard() {
  const el = document.getElementById("dashboardStats");
  if (!el) return;

  el.innerHTML = `<h2 class="h2">Cargando estadísticas...</h2>`;

  const data = await fetchJSON(`${API}/admin/dashboard`, { headers: authHeaders() });
  const s = data.stats || data.dashboard || data || {};

  // nombres flexibles
  const totalVentas = s.totalVentas ?? s.ventas ?? s.total_ventas ?? "—";
  const totalUsuarios = s.totalUsuarios ?? s.usuarios ?? s.total_usuarios ?? "—";
  const totalProductos = s.totalProductos ?? s.productos ?? s.total_productos ?? "—";
  const ingresos = s.ingresos ?? s.totalIngresos ?? s.total_ingresos ?? 0;

  el.innerHTML = `
    <h2 class="h2">Resumen</h2>
    <div class="row" style="gap:12px; flex-wrap:wrap; margin-top:12px;">
      <div class="card card-pad-sm" style="min-width:180px;">
        <div class="label">Productos</div>
        <div style="font-size:22px; font-weight:700;">${totalProductos}</div>
      </div>
      <div class="card card-pad-sm" style="min-width:180px;">
        <div class="label">Usuarios</div>
        <div style="font-size:22px; font-weight:700;">${totalUsuarios}</div>
      </div>
      <div class="card card-pad-sm" style="min-width:180px;">
        <div class="label">Ventas</div>
        <div style="font-size:22px; font-weight:700;">${totalVentas}</div>
      </div>
      <div class="card card-pad-sm" style="min-width:220px;">
        <div class="label">Ingresos</div>
        <div style="font-size:22px; font-weight:700;">${moneyMXN(ingresos)}</div>
      </div>
    </div>
  `;
}

async function loadProducts() {
  const mount = document.getElementById("productsTable");
  if (!mount) return;

  mount.innerHTML = `<div class="card card-pad-sm">Cargando productos...</div>`;

  const data = await fetchJSON(`${API}/productos`);
  const items = safeArr(data.productos || data.items || data);

  if (!items.length) {
    mount.innerHTML = `<div class="card card-pad-sm">No hay productos.</div>`;
    return;
  }

  mount.innerHTML = items.map((p) => `
    <div class="product-row">
      <div class="row-info">
        <div style="font-weight:700;">${p.nombre || "Producto"}</div>
        <div style="opacity:.85;">
          ID: ${p.id} · ${moneyMXN(p.precio)} · Stock: ${p.stock ?? "—"} · ${p.categoria || "—"}
        </div>
      </div>
      <div class="row-actions">
        <button class="btn btn-ghost" type="button" onclick="showEditProductModal('${p.id}')">Editar</button>
        <button class="btn btn-ghost" type="button" onclick="deleteProduct('${p.id}')">Eliminar</button>
      </div>
    </div>
  `).join("");
}

async function loadSales() {
  const mount = document.getElementById("salesTable");
  if (!mount) return;

  mount.innerHTML = `<div class="card card-pad-sm">Cargando ventas...</div>`;

  const data = await fetchJSON(`${API}/admin/ventas`, { headers: authHeaders() });
  const items = safeArr(data.ventas || data.sales || data.items || data);

  if (!items.length) {
    mount.innerHTML = `<div class="card card-pad-sm">No hay ventas.</div>`;
    return;
  }

  mount.innerHTML = items.map((v) => {
    const id = v.id ?? v.venta_id ?? "—";
    const fecha = v.fecha ?? v.created_at ?? "—";
    const total = v.total ?? v.costo_total ?? v.total_gastado ?? 0;
    const user = v.usuario ?? v.user ?? v.correo ?? "—";

    return `
      <div class="sale-row">
        <div class="row-info">
          <div style="font-weight:700;">Venta #${id}</div>
          <div style="opacity:.85;">Usuario: ${user} · Fecha: ${fecha} · Total: ${moneyMXN(total)}</div>
        </div>
      </div>
    `;
  }).join("");
}

async function loadUsers() {
  const mount = document.getElementById("usersTable");
  if (!mount) return;

  mount.innerHTML = `<div class="card card-pad-sm">Cargando usuarios...</div>`;

  const data = await fetchJSON(`${API}/admin/usuarios`, { headers: authHeaders() });
  const items = safeArr(data.usuarios || data.users || data.items || data);

  if (!items.length) {
    mount.innerHTML = `<div class="card card-pad-sm">No hay usuarios.</div>`;
    return;
  }

  mount.innerHTML = items.map((u) => `
    <div class="user-row">
      <div class="row-info">
        <div style="font-weight:700;">${u.nombre || "Usuario"}</div>
        <div style="opacity:.85;">${u.correo || "—"} · Tel: ${u.telefono || "—"} · Rol: ${u.rol || u.role || "user"}</div>
      </div>
    </div>
  `).join("");
}

async function loadLowStock() {
  const mount = document.getElementById("lowStockTable");
  if (!mount) return;

  mount.innerHTML = `<div class="card card-pad-sm">Cargando...</div>`;

  const data = await fetchJSON(`${API}/admin/productos/stock-bajo`, { headers: authHeaders() });
  const items = safeArr(data.productos || data.items || data);

  if (!items.length) {
    mount.innerHTML = `<div class="card card-pad-sm">No hay productos con stock bajo.</div>`;
    return;
  }

  mount.innerHTML = items.map((p) => `
    <div class="product-row">
      <div class="row-info">
        <div style="font-weight:700;">${p.nombre || "Producto"}</div>
        <div style="opacity:.85;">ID: ${p.id} · Stock: ${p.stock ?? "—"} · ${p.categoria || "—"}</div>
      </div>
      <div class="row-actions">
        <button class="btn btn-ghost" type="button" onclick="showEditProductModal('${p.id}')">Editar</button>
      </div>
    </div>
  `).join("");
}

/* ---------------------------
   CRUD productos (Admin API)
---------------------------- */
async function deleteProduct(id) {
  if (!confirm("¿Eliminar producto?")) return;

  await fetchJSON(`${API}/admin/productos/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  await loadProducts();
}
window.deleteProduct = deleteProduct;

document.getElementById("productForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("productId").value.trim();
  const body = {
    nombre: document.getElementById("prod_nombre").value.trim(),
    descripcion: document.getElementById("prod_descripcion").value.trim(),
    precio: Number(document.getElementById("prod_precio").value || 0),
    stock: Number(document.getElementById("prod_stock").value || 0),
    categoria: document.getElementById("prod_categoria").value.trim(),
    color: document.getElementById("prod_color").value.trim(),
    imagen: document.getElementById("prod_imagen").value.trim(),
  };

  if (!body.nombre) return alert("Nombre requerido");

  if (id) {
    await fetchJSON(`${API}/admin/productos/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
  } else {
    await fetchJSON(`${API}/admin/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
  }

  closeProductModal();
  await loadProducts();
});

/* ---------------------------
   Boot
---------------------------- */
async function ensureAdminSession() {
  const token = getToken();
  if (!token) {
    window.location.href = "/login?next=/admin";
    return false;
  }

  // 1) intenta desde LS
  const uLS = getUserLS();
  if (isAdmin(uLS)) return true;

  // 2) si LS no trae rol, consulta perfil
  try {
    const data = await fetchJSON(`${API}/user/profile`, { headers: authHeaders() });
    const u = data.usuario || data.user || {};
    localStorage.setItem("user", JSON.stringify(u));
    if (isAdmin(u)) return true;
  } catch (_) {}

  // no es admin
  window.location.href = "/products";
  return false;
}

(async function init() {
  const ok = await ensureAdminSession();
  if (!ok) return;

  showTab("productos");
  await loadDashboard();
  await loadProducts();
  await loadSales();
  await loadUsers();
  await loadLowStock();
})();
