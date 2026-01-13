const API = "/api";

function authHeaders() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function money(n) {
  return Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  
  if (res.status === 401 || res.status === 403) {
    alert("No tienes permisos de administrador");
    window.location.href = "/";
    throw new Error("Sin permisos");
  }
  
  if (!res.ok) throw new Error(data?.msg || "Error");
  return data;
}

// ============================================
// TABS
// ============================================
function showTab(tabName) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hide"));
  document.getElementById(`tab-${tabName}`)?.classList.remove("hide");
  
  document.querySelectorAll("[data-tab]").forEach(btn => {
    btn.className = btn.getAttribute("data-tab") === tabName ? "btn btn-primary" : "btn btn-ghost";
  });

  if (tabName === "productos") loadProducts();
  if (tabName === "ventas") loadSales();
  if (tabName === "usuarios") loadUsers();
  if (tabName === "stock") loadLowStock();
}

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
  const container = document.getElementById("dashboardStats");
  
  try {
    const data = await fetchJSON(`${API}/admin/dashboard`, { headers: authHeaders() });

    container.innerHTML = `
      <h2 class="h2">Resumen General</h2>
      <div style="height: 12px;"></div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 18px;">
        <div class="card card-pad-sm" style="background: rgba(69, 97, 125, 0.1);">
          <div class="muted" style="font-size: 12px; font-weight: 700;">PRODUCTOS</div>
          <div class="h2" style="margin-top: 6px;">${data.productos.total}</div>
          <div class="muted" style="font-size: 13px;">
            ${data.productos.disponibles} disponibles · ${data.productos.agotados} agotados
          </div>
        </div>

        <div class="card card-pad-sm" style="background: rgba(46, 155, 79, 0.1);">
          <div class="muted" style="font-size: 12px; font-weight: 700;">VENTAS</div>
          <div class="h2" style="margin-top: 6px;">${data.ventas.total}</div>
          <div class="muted" style="font-size: 13px;">
            Ingresos: ${money(data.ventas.ingresos_totales)}
          </div>
        </div>

        <div class="card card-pad-sm" style="background: rgba(213, 155, 45, 0.1);">
          <div class="muted" style="font-size: 12px; font-weight: 700;">HOY</div>
          <div class="h2" style="margin-top: 6px;">${data.ventas.hoy.ventas}</div>
          <div class="muted" style="font-size: 13px;">
            ${money(data.ventas.hoy.ingresos)}
          </div>
        </div>

        <div class="card card-pad-sm" style="background: rgba(145, 150, 126, 0.1);">
          <div class="muted" style="font-size: 12px; font-weight: 700;">USUARIOS</div>
          <div class="h2" style="margin-top: 6px;">${data.usuarios.total}</div>
          <div class="muted" style="font-size: 13px;">
            ${data.usuarios.clientes} clientes · ${data.usuarios.administradores} admins
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="muted">Error al cargar dashboard</p>`;
  }
}

// ============================================
// PRODUCTOS
// ============================================
async function loadProducts() {
  const container = document.getElementById("productsTable");
  container.innerHTML = "<p class='muted'>Cargando productos...</p>";

  try {
    const data = await fetchJSON(`${API}/productos?limit=100`, { headers: authHeaders() });
    const productos = data.productos || data || [];

    if (productos.length === 0) {
      container.innerHTML = "<p class='muted'>No hay productos.</p>";
      return;
    }

    container.innerHTML = productos.map(p => `
      <div class="product-row">
        <div class="row-info">
          <div style="font-weight: 700;">${p.nombre}</div>
          <div class="muted" style="font-size: 13px;">
            ${p.categoria || 'Sin categoría'} · Stock: ${p.stock} · ${money(p.precio)}
          </div>
        </div>
        <div class="row-actions">
          <button class="btn btn-sm btn-ghost" onclick="editProduct(${p.id})">Editar</button>
          <button class="btn btn-sm btn-ghost" onclick="updateStock(${p.id})">Stock</button>
          <button class="btn btn-sm" style="background: var(--danger); color: #fff;" onclick="deleteProduct(${p.id})">Eliminar</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p class="muted">Error: ${err.message}</p>`;
  }
}

function showCreateProductModal() {
  document.getElementById("modalTitle").textContent = "Crear Producto";
  document.getElementById("productId").value = "";
  document.getElementById("productForm").reset();
  document.getElementById("productModal").classList.remove("hide");
}

function closeProductModal() {
  document.getElementById("productModal").classList.add("hide");
}

async function editProduct(id) {
  try {
    const p = await fetchJSON(`${API}/productos/${id}`, { headers: authHeaders() });
    
    document.getElementById("modalTitle").textContent = "Editar Producto";
    document.getElementById("productId").value = p.id;
    document.getElementById("prod_nombre").value = p.nombre;
    document.getElementById("prod_descripcion").value = p.descripcion || "";
    document.getElementById("prod_precio").value = p.precio;
    document.getElementById("prod_stock").value = p.stock;
    document.getElementById("prod_categoria").value = p.categoria || "";
    document.getElementById("prod_color").value = p.color || "";
    document.getElementById("prod_imagen").value = p.imagen || "";
    
    document.getElementById("productModal").classList.remove("hide");
  } catch (err) {
    alert("Error al cargar producto");
  }
}

document.getElementById("productForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("productId").value;
  const body = {
    nombre: document.getElementById("prod_nombre").value,
    descripcion: document.getElementById("prod_descripcion").value,
    precio: parseFloat(document.getElementById("prod_precio").value),
    stock: parseInt(document.getElementById("prod_stock").value, 10),
    categoria: document.getElementById("prod_categoria").value || null,
    color: document.getElementById("prod_color").value || null,
    imagen: document.getElementById("prod_imagen").value || null,
  };

  try {
    if (id) {
      await fetchJSON(`${API}/admin/productos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body)
      });
      alert("✅ Producto actualizado");
    } else {
      await fetchJSON(`${API}/admin/productos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body)
      });
      alert("✅ Producto creado");
    }

    closeProductModal();
    loadProducts();
  } catch (err) {
    alert(err.message || "Error al guardar producto");
  }
});

async function updateStock(id) {
  const cantidad = prompt("Cantidad a agregar (usar número negativo para restar):");
  if (!cantidad) return;

  const num = parseInt(cantidad, 10);
  const operacion = num >= 0 ? "sumar" : "restar";
  const cantidadAbs = Math.abs(num);

  try {
    await fetchJSON(`${API}/admin/productos/${id}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ cantidad: cantidadAbs, operacion })
    });
    alert("✅ Stock actualizado");
    loadProducts();
  } catch (err) {
    alert(err.message || "Error al actualizar stock");
  }
}

async function deleteProduct(id) {
  if (!confirm("¿Seguro que deseas eliminar este producto?")) return;

  try {
    await fetchJSON(`${API}/admin/productos/${id}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    alert("✅ Producto eliminado");
    loadProducts();
  } catch (err) {
    alert(err.message || "Error al eliminar producto");
  }
}

// ============================================
// VENTAS
// ============================================
async function loadSales() {
  const container = document.getElementById("salesTable");
  container.innerHTML = "<p class='muted'>Cargando ventas...</p>";

  try {
    const data = await fetchJSON(`${API}/admin/ventas?limit=50`, { headers: authHeaders() });

    if (data.ventas.length === 0) {
      container.innerHTML = "<p class='muted'>No hay ventas registradas.</p>";
      return;
    }

    container.innerHTML = data.ventas.map(v => `
      <div class="sale-row">
        <div class="row-info">
          <div style="font-weight: 700;">Venta #${v.id}</div>
          <div class="muted" style="font-size: 13px;">
            ${v.cliente.nombre || 'Usuario eliminado'} · ${money(v.total)} · ${v.metodo_pago} · ${v.estado}
          </div>
          <div class="muted" style="font-size: 12px;">
            ${new Date(v.fecha).toLocaleString('es-MX')}
          </div>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p class="muted">Error: ${err.message}</p>`;
  }
}

// ============================================
// USUARIOS
// ============================================
async function loadUsers() {
  const container = document.getElementById("usersTable");
  container.innerHTML = "<p class='muted'>Cargando usuarios...</p>";

  try {
    const data = await fetchJSON(`${API}/admin/usuarios?limit=100`, { headers: authHeaders() });

    if (data.usuarios.length === 0) {
      container.innerHTML = "<p class='muted'>No hay usuarios.</p>";
      return;
    }

    container.innerHTML = data.usuarios.map(u => `
      <div class="user-row">
        <div class="row-info">
          <div style="font-weight: 700;">${u.nombre}</div>
          <div class="muted" style="font-size: 13px;">
            ${u.correo} · ${u.telefono || 'Sin teléfono'} · Rol: ${u.rol}
          </div>
          <div class="muted" style="font-size: 12px;">
            Registrado: ${new Date(u.fecha_registro).toLocaleDateString('es-MX')}
          </div>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p class="muted">Error: ${err.message}</p>`;
  }
}

// ============================================
// STOCK BAJO
// ============================================
async function loadLowStock() {
  const container = document.getElementById("lowStockTable");
  container.innerHTML = "<p class='muted'>Cargando productos con stock bajo...</p>";

  try {
    const data = await fetchJSON(`${API}/admin/productos/stock-bajo?umbral=10`, { headers: authHeaders() });

    if (data.productos.length === 0) {
      container.innerHTML = "<p class='muted'>✅ No hay productos con stock bajo.</p>";
      return;
    }

    container.innerHTML = data.productos.map(p => `
      <div class="product-row" style="border-color: rgba(214, 74, 74, 0.3);">
        <div class="row-info">
          <div style="font-weight: 700;">${p.nombre}</div>
          <div class="muted" style="font-size: 13px;">
            ${p.categoria || 'Sin categoría'} · Stock: <strong style="color: var(--danger);">${p.stock}</strong> · ${money(p.precio)}
          </div>
        </div>
        <div class="row-actions">
          <button class="btn btn-sm btn-primary" onclick="updateStock(${p.id})">Agregar Stock</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p class="muted">Error: ${err.message}</p>`;
  }
}

// ============================================
// INIT
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("accessToken");
  if (!token) {
    window.location.href = "/login";
    return;
  }

  loadDashboard();
  loadProducts();
});