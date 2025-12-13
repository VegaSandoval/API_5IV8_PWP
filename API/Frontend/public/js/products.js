const API = "/api";


function getQS() {
  return new URLSearchParams(window.location.search);
}

function setQS(next) {
  const qs = getQS();
  Object.entries(next).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "") qs.delete(k);
    else qs.set(k, v);
  });
  const url = `${window.location.pathname}${qs.toString() ? "?" + qs.toString() : ""}`;
  history.pushState({}, "", url);
}

function escapeHTML(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(n) {
  const v = Number(n ?? 0);
  return v.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const msg = (data && data.error) ? data.error : `Error HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

const PRODUCT_TILE = {
  s1: ["#BFC5AD", "#8BA0B5", "#D9AD8D"], 
  s2: ["#4A4E3D", "#EEE4DF", "#45617D"],
};

function leftoverPalette(lastFullSkeletonUsed) {
  if (lastFullSkeletonUsed === 1) return [PRODUCT_TILE.s2[1], PRODUCT_TILE.s2[2]];
  return [PRODUCT_TILE.s1[0], PRODUCT_TILE.s1[1]];
}

function productTileHTML(p, bg, posClass) {
  const id = p.id ?? p.producto_id ?? p.ID ?? p.Id; 
  return `
    <article class="p-tile ${posClass}" style="--p-bg:${bg}">
      <a class="p-hit" href="/products/${encodeURIComponent(id)}" aria-label="Ver producto"></a>

      <div class="p-info">
        <div class="p-text">
          <div class="p-name">${escapeHTML(p.nombre)}</div>
          <div class="p-sub">${escapeHTML(p.categoria || "")}</div>
          <div class="p-price">${money(p.precio)}</div>
        </div>

        <button class="btn btn-primary btn-sm" type="button" data-add="${escapeHTML(id)}">
          Añadir
        </button>
      </div>
    </article>
  `;
}

function blockS1(items3) {
  return `
    <section class="pm-block sk-p1">
      ${productTileHTML(items3[0], PRODUCT_TILE.s1[0], "pos-big")}
      ${productTileHTML(items3[1], PRODUCT_TILE.s1[1], "pos-top")}
      ${productTileHTML(items3[2], PRODUCT_TILE.s1[2], "pos-bot")}
    </section>
  `;
}

function blockS2(items3) {
  return `
    <section class="pm-block sk-p2">
      ${productTileHTML(items3[0], PRODUCT_TILE.s2[0], "pos-big")}
      ${productTileHTML(items3[1], PRODUCT_TILE.s2[1], "pos-top")}
      ${productTileHTML(items3[2], PRODUCT_TILE.s2[2], "pos-bot")}
    </section>
  `;
}

function block2(items2, colors2) {
  return `
    <section class="pm-block sk-p2up">
      ${productTileHTML(items2[0], colors2[0], "pos-a")}
      ${productTileHTML(items2[1], colors2[1], "pos-b")}
    </section>
  `;
}

function block1(item1, color1) {
  return `
    <section class="pm-block sk-p1up">
      ${productTileHTML(item1, color1, "pos-only")}
    </section>
  `;
}

function buildMosaic(products) {
  let html = "";
  let i = 0;
  let next = 1;          
  let lastUsed = null;  

  while (i < products.length) {
    const rem = products.length - i;

    if (rem === 1) {
      const [c1] = leftoverPalette(lastUsed);
      html += block1(products[i], c1);
      i += 1;
      continue;
    }

    if (rem === 2) {
      const [c1, c2] = leftoverPalette(lastUsed);
      html += block2([products[i], products[i + 1]], [c1, c2]);
      i += 2;
      continue;
    }

    const chunk = products.slice(i, i + 3);
    if (next === 1) {
      html += blockS1(chunk);
      lastUsed = 1;
      next = 2;
    } else {
      html += blockS2(chunk);
      lastUsed = 2;
      next = 1;
    }
    i += 3;
  }

  return html;
}

const state = {
  meta: null,
  categoria: "",
  color: "",
  q: "",
  all: [],
  visible: 0,
};

function readStateFromURL() {
  const qs = getQS();
  state.categoria = qs.get("categoria") || "";
  state.color = qs.get("color") || "";
  state.q = qs.get("q") || "";
}

async function getMeta() {
  if (state.meta) return state.meta;
  const meta = await fetchJSON(`${API}/productos/metadata`);
  state.meta = {
    categorias: Array.isArray(meta.categorias) ? meta.categorias : [],
    colores: Array.isArray(meta.colores) ? meta.colores : [],
  };
  return state.meta;
}

function renderCategoryStrip(categorias) {
  const currentEl = document.getElementById("catCurrent");
  const scrollEl = document.getElementById("catScroll");
  if (!currentEl || !scrollEl) return;

  const currentName = state.categoria ? state.categoria : "Ver todo";
  currentEl.textContent = currentName;

  const list = ["", ...categorias].filter((c, idx, arr) => arr.indexOf(c) === idx);

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

  const uniq = colores.filter((c, idx, arr) => arr.indexOf(c) === idx);

  chipsEl.innerHTML = uniq.map((c) => {
    const active = c === state.color;
    return `
      <button class="chip ${active ? "is-active" : ""}" type="button" data-color="${escapeHTML(c)}">
        <span class="dot" style="--dot:${dotColor(c)}"></span>
        ${escapeHTML(c)}
      </button>
    `;
  }).join("");
}

async function fetchProducts() {
  const qs = new URLSearchParams();
  if (state.categoria) qs.set("categoria", state.categoria);
  if (state.color) qs.set("color", state.color);
  if (state.q) qs.set("q", state.q);

  const url = `${API}/productos${qs.toString() ? "?" + qs.toString() : ""}`;
  const data = await fetchJSON(url);

  state.all = Array.isArray(data) ? data : [];
}

function renderProducts() {
  const mount = document.getElementById("productsMount");
  if (!mount) return;

  const slice = state.all.slice(0, state.visible);
  mount.innerHTML = buildMosaic(slice);

  const btn = document.getElementById("btnMore");
  if (btn) {
    btn.style.display = state.visible >= state.all.length ? "none" : "inline-flex";
  }
}

function bindInteractions() {
  document.addEventListener("click", (e) => {
    const catBtn = e.target.closest("[data-cat]");
    if (catBtn) {
      const cat = catBtn.getAttribute("data-cat") || "";
      setQS({ categoria: cat || "" , color: state.color || "", q: state.q || "" });
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
      if (state.visible === 0) state.visible = Math.min(6, state.all.length);
      else state.visible = Math.min(state.visible + 9, state.all.length);
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
