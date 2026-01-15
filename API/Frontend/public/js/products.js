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

function renderTitle() {
  const el = document.getElementById("productsTitle");
  if (!el) return;
  el.textContent = state.categoria ? state.categoria : "Ver todo";
}

function renderCategoryStrip(categorias) {
  const scrollEl = document.getElementById("catScroll");
  if (!scrollEl) return;

  const list = ["", ...categorias]; // "" = Ver todo

  scrollEl.innerHTML = list
    .map((c) => {
      const label = c === "" ? "Ver todo" : c;
      const active = (c === "" && !state.categoria) || c === state.categoria;
      return `
        <button class="pill ${active ? "is-active" : ""}" type="button"
                data-cat="${escapeHTML(c)}" aria-current="${active ? "page" : "false"}">
          ${escapeHTML(label)}
        </button>
      `;
    })
    .join("");
}

function dotColor(name) {
  let raw = String(name || "").trim();
  if (!raw) return "#BFC5AD";

  // quitar acentos para que "CAFÉ" funcione como "CAFE"
  const n = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  // si ya viene en HEX, úsalo directo
  if (/^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(raw)) return raw;

  // mapeos principales (tu estilo Figma)
  if (n.includes("ROJO")) return "#E25F5F";
  if (n.includes("ROSA")) return "#F44E8A";
  if (n.includes("MORAD")) return "#B54EF4";
  if (n.includes("AMARIL")) return "#F4CF4E";

  if (n.includes("AZUL") && n.includes("MAR")) return "#233C6B";
  if (n.includes("AZUL")) return "#5FABE2";

  if (n.includes("VERDE") && (n.includes("LIM") || n.includes("LIMA"))) return "#B8E25F";
  if (n.includes("VERDE")) return "#44936D";

  // ✅ extras que te faltan
  if (n.includes("BLANCO")) return "#F5F5F5";
  if (n.includes("GRIS") || n.includes("GRAY")) return "#B9B9B9";
  if (n.includes("NEGRO") || n.includes("BLACK")) return "#121212";
  if (n.includes("CAFE") || n.includes("MARRON") || n.includes("BROWN")) return "#84553C";
  if (n.includes("BEIGE") || n.includes("CREMA") || n.includes("CREAM")) return "#EAD8CD";

  // ✅ cualquier color desconocido -> color consistente por hash (para que "sea un color" siempre)
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 35% 70%)`;
}


function renderColorChips(colores) {
  const chipsEl = document.getElementById("colorChips");
  if (!chipsEl) return;

  chipsEl.innerHTML = colores
    .map((c) => {
      const active = c === state.color;
      return `
        <button class="chip ${active ? "is-active" : ""}" type="button" data-color="${escapeHTML(c)}">
          <span class="dot" style="--dot:${dotColor(c)}"></span>
          ${escapeHTML(c)}
        </button>
      `;
    })
    .join("");
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
    precio: Number(p.precio ?? 0),
    imagen: p.imagen ?? p.image ?? "",
    color: p.color ?? p.colour ?? "", // para el fondo cuando no hay imagen
  };
}

function mediaBg(p, index) {
  // si el producto trae color -> úsalo SIEMPRE
  if (p?.color) return dotColor(p.color);

  // si no trae color -> paleta tipo figma
  const palette = ["#BFC5AD", "#8BA0B5", "#D9AD8D", "#4A4E3D", "#F3D9C8", "#45617D"];
  return palette[index % palette.length];
}


function productCardHTML(pRaw, index) {
  const p = normalizeProduct(pRaw);
  const id = encodeURIComponent(p.id);
  const name = escapeHTML(p.nombre);
  const price = isFinite(p.precio) ? `$${p.precio.toFixed(2)}` : "$0.00";

  // Layout tipo Figma: 3-3-6 / 6-3-3
  const spans = ["span-3", "span-3", "span-6", "span-6", "span-3", "span-3"];
  const spanClass = spans[index % spans.length] || "span-3";

  const bg = mediaBg(p, index);
  const img = p.imagen ? escapeHTML(p.imagen) : "";
  const missingClass = img ? "" : "is-missing";

  return `
    <article class="productCard ${spanClass}">
      <a class="productCard__media ${missingClass}" href="/products/${id}" style="--bg:${escapeHTML(bg)}">
        ${
          img
            ? `<img src="${img}" alt="${name}" loading="lazy" decoding="async"
                 onerror="this.remove(); this.parentElement.classList.add('is-missing');">`
            : ``
        }
        <span class="productCard__ghost">Sin imagen</span>
      </a>

      <div>
        <div class="productCard__name">${name}</div>
        <div class="productCard__price">${escapeHTML(price)}</div>
      </div>

      <!-- ✅ aparece al hover, dentro del card -->
      <div class="productCard__addWrap">
        <button class="btn btn-ghost btn-sm productCard__addBtn"
                type="button"
                data-add-cart="${escapeHTML(p.id)}">
          Agregar al carrito
        </button>
      </div>
    </article>
  `;
}


function renderProducts() {
  const mount = document.getElementById("productsMount");
  if (!mount) return;

  const slice = state.all.slice(0, state.visible);

  // ✅ Mensaje EXACTO cuando no hay productos (por categoría o filtros)
  if (slice.length === 0) {
    mount.innerHTML = `
      <div class="products-empty">
        <div class="products-empty__msg">No hay productos disponibles por el momento</div>
      </div>
    `;
  } else {
    mount.innerHTML = slice.map(productCardHTML).join("");
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
      const nextColor = c === state.color ? "" : c;
      setQS({ categoria: state.categoria || "", color: nextColor, q: state.q || "" });
      refresh();
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

async function refresh() {
  readStateFromURL();
  renderTitle();

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
