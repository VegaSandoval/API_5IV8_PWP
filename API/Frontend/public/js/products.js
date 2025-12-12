const API = "http://localhost:3000/api";

function getQS() {
  return new URLSearchParams(window.location.search);
}

function authHeaders() {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function colorMap(nombre) {
  const v = String(nombre || "").toUpperCase();
  if (v.includes("ROJO")) return "#d98282";
  if (v.includes("VERDE LIM")) return "#b8d36a";
  if (v.includes("AZUL MAR")) return "#45617d";
  if (v.includes("AZUL CIE")) return "#82bfd1";
  if (v.includes("MORADO")) return "#b79bd8";
  if (v.includes("ROSA")) return "#f2a2bd";
  if (v.includes("AMARIL")) return "#f5d66e";
  if (v.includes("OSCURO")) return "#4a4e3d";
  return "#c4d2df";
}

async function fetchJSON(url, opts={}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Error");
  return data;
}


function cardHTML(p) {
  const c = colorMap(p.color || p.Color || p.color_nombre || "");
  return `
    <article class="product-card">
      <a class="product-media" href="/products/${p.id}">
        <div class="product-image" style="--p-color:${c}"></div>
        <button class="fav-btn" type="button" aria-label="Favorito">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 21s-7-4.6-9.3-8.6C.8 9 2.6 5.8 6.2 5.3c1.7-.3 3.3.5 3.8 1.4.5-.9 2.1-1.7 3.8-1.4 3.6.5 5.4 3.7 3.5 7.1C19 16.4 12 21 12 21Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          </svg>
        </button>
      </a>

      <div class="product-body">
        <div>
          <div class="product-name">${p.nombre}</div>
          <div class="muted" style="font-size:13px;">${p.categoria || ""} · ${(p.color || "").toUpperCase()}</div>
          <div class="product-price">${money(p.precio)}</div>
        </div>

        <button class="btn btn-primary btn-sm" data-add="${p.id}">Añadir</button>
      </div>
    </article>
  `;
}

async function loadMetadata() {
  const meta = await fetchJSON(`${API}/productos/metadata`);
 
  const cats = meta.categorias || [];
  const cols = meta.colores || [];

  const selCat = document.getElementById("categoria");
  const selCol = document.getElementById("color");
  const chips = document.getElementById("colorChips");

  if (selCat) {
    selCat.innerHTML = `<option value="">Todas</option>` +
      cats.map(c => `<option value="${c}">${c}</option>`).join("");
  }
  if (selCol) {
    selCol.innerHTML = `<option value="">Todos</option>` +
      cols.map(c => `<option value="${c}">${c}</option>`).join("");
  }
  if (chips) {
    chips.innerHTML = cols.slice(0,8).map(c => `
      <button class="chip" type="button" data-chip-color="${c}">
        <span class="dot" style="--dot:${colorMap(c)}"></span>
        ${(String(c)).toUpperCase()}
      </button>
    `).join("");
  }
}

function currentFilters() {
  const qs = getQS();
  const q = document.getElementById("q")?.value ?? qs.get("q") ?? "";
  const categoria = document.getElementById("categoria")?.value ?? qs.get("categoria") ?? "";
  const color = document.getElementById("color")?.value ?? qs.get("color") ?? "";
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (categoria) sp.set("categoria", categoria);
  if (color) sp.set("color", color);
  return sp.toString();
}

async function loadProducts() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  const qs = currentFilters();
  const url = `${API}/productos${qs ? `?${qs}` : ""}`;

  const products = await fetchJSON(url);
  grid.innerHTML = products.map(cardHTML).join("");

  grid.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-add]");
    if (!btn) return;

    const token = localStorage.getItem("token");
    if (!token) return (window.location.href = "/login");

    const producto_id = Number(btn.getAttribute("data-add"));
    await fetchJSON(`${API}/carrito/agregar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ producto_id, cantidad: 1 })
    });

    alert("Producto agregado al carrito ✅");
  }, { once: true });
}

function bindFilters() {
  const form = document.getElementById("filtersForm");
  if (!form) return;

  const qs = getQS();
  const q = document.getElementById("q");
  if (q && qs.get("q")) q.value = qs.get("q");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const qs2 = currentFilters();
    window.location.href = `/products${qs2 ? `?${qs2}` : ""}`;
  });

  document.getElementById("btnClear")?.addEventListener("click", () => {
    window.location.href = "/products";
  });

  document.getElementById("colorChips")?.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-chip-color]");
    if (!chip) return;
    const v = chip.getAttribute("data-chip-color");
    const selCol = document.getElementById("color");
    if (selCol) selCol.value = v;
    form.requestSubmit();
  });
}


function getProductIdFromURL() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] === "products" && parts[1] ? Number(parts[1]) : null;
}

async function loadProductDetail() {
  const mount = document.getElementById("productDetail");
  if (!mount) return;

  const id = getProductIdFromURL();
  if (!id) return;

  const p = await fetchJSON(`${API}/productos/${id}`);
  const c = colorMap(p.color || "");

  mount.innerHTML = `
    <div class="product-shell">
      <div class="pd-image" style="--p-color:${c}"></div>

      <div class="stack">
        <h1 class="pd-title">${p.nombre}</h1>
        <div class="pd-price">${money(p.precio)}</div>
        <p class="muted">${p.descripcion || "Producto para tu mascota."}</p>

        <div class="row" style="flex-wrap:wrap;">
          <span class="chip" style="cursor:default;">
            <span class="dot" style="--dot:${c}"></span>${(p.color || "COLOR").toUpperCase()}
          </span>
          ${p.categoria ? `<span class="chip" style="cursor:default;">${p.categoria.toUpperCase()}</span>` : ""}
        </div>

        <div class="row" style="justify-content:space-between; align-items:center;">
          <div class="stepper">
            <button type="button" id="qtyMinus">-</button>
            <input id="qty" value="1" inputmode="numeric" />
            <button type="button" id="qtyPlus">+</button>
          </div>

          <button class="btn btn-primary" id="btnAddToCart">Agregar al carrito</button>
        </div>
      </div>
    </div>
  `;

  const qty = document.getElementById("qty");
  document.getElementById("qtyMinus").onclick = () => {
    const v = Math.max(1, Number(qty.value || 1) - 1);
    qty.value = String(v);
  };
  document.getElementById("qtyPlus").onclick = () => {
    const v = Math.min(99, Number(qty.value || 1) + 1);
    qty.value = String(v);
  };

  document.getElementById("btnAddToCart").onclick = async () => {
    const token = localStorage.getItem("token");
    if (!token) return (window.location.href = "/login");

    await fetchJSON(`${API}/carrito/agregar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ producto_id: id, cantidad: Number(qty.value || 1) })
    });

    alert("Agregado al carrito ✅");
  };

  const related = await fetchJSON(`${API}/productos/${id}/relacionados`).catch(() => []);
  const relMount = document.getElementById("relatedBlock");
  if (relMount && Array.isArray(related) && related.length) {
    relMount.innerHTML = `
      <h2 class="h2">También te puede interesar</h2>
      <div class="product-grid">${related.map(cardHTML).join("")}</div>
    `;
  }
}

(async function init(){
  try { await loadMetadata(); } catch {}
  bindFilters();
  await loadProducts().catch(() => {});
  await loadProductDetail().catch(() => {});
})();
