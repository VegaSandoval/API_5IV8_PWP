const API = "/api";

const state = {
  categoria: "",
  color: "",
  q: "",
  all: [],
  visible: 6,
};

function authHeaders() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    // sesión expirada
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
  }

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

function pickName(x) {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object") return x.categoria || x.color || x.nombre || x.name || x.value || "";
  return String(x);
}

function getQS() {
  return new URLSearchParams(window.location.search);
}

function setQS({ categoria, color, q }) {
  const qs = new URLSearchParams();
  if (categoria) qs.set("categoria", categoria);
  if (color) qs.set("color", color);
  if (q) qs.set("q", q);
  const next = `${window.location.pathname}${qs.toString() ? "?" + qs.toString() : ""}`;
  window.history.pushState({}, "", next);
}

function readStateFromURL() {
  const qs = getQS();
  state.categoria = qs.get("categoria") || "";
  state.color = qs.get("color") || "";
  state.q = qs.get("q") || "";
}

async function getMeta() {
  const meta = await fetchJSON(`${API}/productos/metadata`);
  const rawCats = Array.isArray(meta.categorias) ? meta.categorias : [];
  const rawColors = Array.isArray(meta.colores) ? meta.colores : [];

  const categorias = [...new Set(rawCats.map(pickName).map(s => String(s).trim()).filter(Boolean))];
  const colores = [...new Set(rawColors.map(pickName).map(s => String(s).trim()).filter(Boolean))];

  return { categorias, colores };
}

function renderCategoryStrip(categorias) {
  const scrollEl = document.getElementById("catScroll");
  if (!scrollEl) return;

  const list = ["", ...categorias]; // "" = Ver todo

  scrollEl.innerHTML = list.map((c) => {
    const label = c === "" ? "Ver todo" : c;
    const active = (c === "" && !state.categoria) || c === state.categoria;
    return `
      <button class="cat-pill ${active ? "is-active" : ""}" type="button"
              data-cat="${escapeHTML(c)}" aria-current="${active ? "page" : "false"}">
        ${escapeHTML(label)}
      </button>
    `;
  }).join("");
}

function dotColor(name) {
  const n = String(name || "").toUpperCase();
  if (n.includes("ROJO")) return "#D97A83";
  if (n.includes("VERDE") && n.includes("LIM")) return "#A8C46B";
  if (n.includes("VERDE")) return "#4A4E3D";
  if (n.includes("AZUL") && n.includes("MAR")) return "#45617D";
  if (n.includes("AZUL")) return "#8BA0B5";
  if (n.includes("AMARIL")) return "#F4D972";
  if (n.includes("MORAD")) return "#8E6CB5";
  if (n.includes("ROSA")) return "#E7A7C6";
  return "#CFCFCF";
}

function renderColorChips(colores) {
  const chipsEl = document.getElementById("colorChips");
  if (!chipsEl) return;

  chipsEl.innerHTML = colores.map((c) => {
    const active = c === state.color;
    return `
      <button class="chip ${active ? "is-active" : ""}" type="button" data-color="${escapeHTML(c)}">
        <span class="dot" style="--dot:${dotColor(c)}"></span>
        ${escapeHTML(c)}
      </button>
    `;
  }).join("");
}

function extractProducts(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.productos)) return data.productos;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

async function fetchProducts() {
  const qs = new URLSearchParams();
  if (state.categoria) qs.set("categoria", state.categoria);
  if (state.color) qs.set("color", state.color);
  if (state.q) qs.set("q", state.q);

  const url = `${API}/productos${qs.toString() ? "?" + qs.toString() : ""}`;
  const data = await fetchJSON(url);

  state.all = extractProducts(data);
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

function productCardHTML(pRaw) {
  const p = normalizeProduct(pRaw);
  const price = isFinite(p.precio) ? `$${p.precio.toFixed(2)}` : "$0.00";

  // fallback de imagen si tu placeholder no existe
  const safeImg = escapeHTML(p.imagen || "/images/product-placeholder.png");
  const id = encodeURIComponent(p.id);

  return `
    <article class="card" style="padding:14px; display:flex; gap:12px; align-items:center;">
      <img src="${safeImg}" alt="${escapeHTML(p.nombre)}"
           style="width:74px; height:74px; border-radius:14px; object-fit:cover;"
           onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2274%22 height=%2274%22><rect width=%2274%22 height=%2274%22 rx=%2214%22 fill=%22%23e9e3de%22/><text x=%2250%25%22 y=%2252%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%237a6f68%22 font-family=%22Arial%22 font-size=%2210%22>Sin imagen</text></svg>';">
      <div style="flex:1; min-width:0;">
        <div class="h3" style="margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${escapeHTML(p.nombre)}
        </div>
        <div class="muted" style="margin-top:4px;">
          ${escapeHTML(p.categoria)}${p.color ? " · " + escapeHTML(p.color) : ""}
        </div>
        <div class="h3" style="margin-top:8px;">${escapeHTML(price)}</div>
      </div>

      <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
        <a class="btn btn-ghost" href="/products/${id}">Ver</a>
        <button class="btn btn-primary" type="button" data-add="${escapeHTML(String(p.id))}">Añadir</button>
      </div>
    </article>
  `;
}

function renderProducts() {
  const mount = document.getElementById("productsMount");
  if (!mount) return;

  const slice = state.all.slice(0, state.visible);
  if (slice.length === 0) {
    mount.innerHTML = `<div class="card card-pad-sm">No hay productos para mostrar.</div>`;
  } else {
    mount.innerHTML = `
      <div class="stack" style="max-width:720px; margin:0 auto;">
        ${slice.map(productCardHTML).join("")}
      </div>
    `;
  }

  const btn = document.getElementById("btnMore");
  if (btn) btn.style.display = state.visible >= state.all.length ? "none" : "inline-flex";
}

function bindInteractions() {
  document.addEventListener("click", (e) => {
    const catBtn = e.target.closest("[data-cat]");
    if (catBtn) {
      const cat = catBtn.getAttribute("data-cat") || "";
      setQS({ categoria: cat || "", color: state.color || "", q: state.q || "" });
      refresh();
      return;
    }

    const chip = e.target.closest("[data-color]");
    if (chip) {
      const c = chip.getAttribute("data-color") || "";
      const nextColor = (c === state.color) ? "" : c;
      setQS({ categoria: state.categoria || "", color: nextColor, q: state.q || "" });
      refresh();
      return;
    }

    const add = e.target.closest("[data-add]");
    if (add) {
      const producto_id = add.getAttribute("data-add");
      addToCart(producto_id);
      return;
    }
  });

  const btnMore = document.getElementById("btnMore");
  if (btnMore) {
    btnMore.addEventListener("click", () => {
      state.visible = Math.min(state.visible + 6, state.all.length);
      renderProducts();
    });
  }

  window.addEventListener("popstate", () => refresh());
}

async function addToCart(producto_id) {
  try {
    await fetchJSON(`${API}/carrito/agregar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ producto_id, cantidad: 1 }),
    });
    alert("Producto agregado al carrito ✅");
  } catch (err) {
    alert(err.message || "No se pudo agregar al carrito.");
  }
}

async function refresh() {
  readStateFromURL();

  const meta = await getMeta();
  renderCategoryStrip(meta.categorias);
  renderColorChips(meta.colores);

  await fetchProducts();

  state.visible = Math.min(6, state.all.length);
  renderProducts();
}

document.addEventListener("DOMContentLoaded", async () => {
  const mount = document.getElementById("productsMount");
  if (!mount) return;

  bindInteractions();
  await refresh();
});
