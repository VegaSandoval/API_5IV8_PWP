const API = "/api";

function authHeaders() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.msg || data?.message || "Error");
  return data;
}

function escapeHTML(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getProductIdFromPath() {
  // /products/:id
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[1] || "";
}

function normalizeProduct(p) {
  const id = p.id ?? p.producto_id ?? p.productoId ?? p._id;
  return {
    id,
    nombre: p.nombre ?? p.name ?? "Producto",
    descripcion: p.descripcion ?? "",
    precio: Number(p.precio ?? 0),
    categoria: p.categoria ?? "",
    color: p.color ?? "",
    stock: p.stock ?? p.existencias ?? null,
    imagen: p.imagen ?? p.image ?? "/images/product-placeholder.png",
  };
}

function renderDetail(pRaw) {
  const p = normalizeProduct(pRaw);
  const price = isFinite(p.precio) ? `$${p.precio.toFixed(2)}` : "$0.00";

  const mount = document.getElementById("productDetailMount");
  if (!mount) return;

  mount.innerHTML = `
    <div class="row" style="gap:18px; align-items:flex-start; flex-wrap:wrap;">
      <img src="${escapeHTML(p.imagen)}" alt="${escapeHTML(p.nombre)}"
           style="width:260px; height:260px; border-radius:18px; object-fit:cover;"
           onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22260%22 height=%22260%22><rect width=%22260%22 height=%22260%22 rx=%2218%22 fill=%22%23e9e3de%22/><text x=%2250%25%22 y=%2252%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%237a6f68%22 font-family=%22Arial%22 font-size=%2214%22>Sin imagen</text></svg>';">
      <div style="flex:1; min-width:280px;">
        <h1 class="h1" style="margin-top:0;">${escapeHTML(p.nombre)}</h1>
        <p class="muted" style="margin-top:-6px;">
          ${escapeHTML(p.categoria)}${p.color ? " · " + escapeHTML(p.color) : ""}
          ${p.stock != null ? " · Stock: " + escapeHTML(String(p.stock)) : ""}
        </p>

        <div class="h2" style="margin:14px 0;">${escapeHTML(price)}</div>

        <p style="line-height:1.5;">${escapeHTML(p.descripcion || "Sin descripción.")}</p>

        <div class="row" style="gap:10px; margin-top:16px; flex-wrap:wrap;">
          <button class="btn btn-primary" id="btnAdd">Añadir al carrito</button>
          <a class="btn btn-ghost" href="/cart">Ir al carrito</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btnAdd")?.addEventListener("click", async () => {
    try {
      await fetchJSON(`${API}/carrito/agregar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ producto_id: p.id, cantidad: 1 }),
      });
      alert("Agregado al carrito ✅");
    } catch (err) {
      alert(err.message || "No se pudo agregar al carrito.");
    }
  });
}

async function load() {
  const id = getProductIdFromPath();
  const mount = document.getElementById("productDetailMount");
  if (!mount) return;

  if (!id) {
    mount.innerHTML = `<div class="card card-pad-sm">ID inválido.</div>`;
    return;
  }

  mount.textContent = "Cargando…";

  const data = await fetchJSON(`${API}/productos/${encodeURIComponent(id)}`);
  const producto = data.producto ?? data; // soporta {producto:{...}} o {...}
  renderDetail(producto);
}

load().catch((e) => {
  const mount = document.getElementById("productDetailMount");
  if (mount) mount.innerHTML = `<div class="card card-pad-sm">No se pudo cargar el producto. (${escapeHTML(e.message)})</div>`;
});
