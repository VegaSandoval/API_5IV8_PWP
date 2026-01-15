const API = "/api";

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.msg || data?.message || "Error");
  return data;
}

function pickName(x) {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object") {
    return x.categoria || x.nombre || x.name || x.value || "";
  }
  return String(x);
}

function escapeHTML(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makeHref(catName) {
  if (!catName || catName === "__ALL__") return "/products";
  const qs = new URLSearchParams();
  qs.set("categoria", catName);
  return `/products?${qs.toString()}`;
}

function normalizeCats(meta) {
  const raw = Array.isArray(meta?.categorias) ? meta.categorias : [];
  return [...new Set(
    raw.map(pickName).map(s => String(s).trim()).filter(Boolean)
  )];
}

function getUsedCatsFromDOM() {
  const els = [...document.querySelectorAll("[data-cat]")];
  const used = new Set(
    els.map(el => String(el.getAttribute("data-cat") || "").trim().toLowerCase())
      .filter(Boolean)
  );
  used.delete("__all__");
  return used;
}

function bindCategoryLinks() {
  const els = document.querySelectorAll("[data-cat]");
  els.forEach((el) => {
    const cat = String(el.getAttribute("data-cat") || "").trim();
    if (!cat) return;

    // Solo anchors (a) deben tener href; si un día lo pones en button, lo ignoramos
    if (el.tagName.toLowerCase() !== "a") return;

    el.href = makeHref(cat);
  });
}

function renderExtraCats(allCats) {
  const mount = document.getElementById("homeExtraCats");
  if (!mount) return;

  const used = getUsedCatsFromDOM();
  const extra = allCats.filter(c => !used.has(String(c).toLowerCase()));

  if (extra.length === 0) {
    mount.classList.add("hide");
    mount.innerHTML = "";
    return;
  }

  mount.classList.remove("hide");
  mount.innerHTML = `
    <div class="home-extraCats__title">Más categorías</div>
    <div class="home-extraCats__list">
      ${extra.map(c => `
        <a class="home-extraCats__item" href="${makeHref(c)}">${escapeHTML(c)}</a>
      `).join("")}
    </div>
  `;
}

async function initHome() {
  // 1) amarrar links base (aunque no cargue API)
  bindCategoryLinks();

  // 2) leer metadata y pintar extras
  try {
    const meta = await fetchJSON(`${API}/productos/metadata`);
    const cats = normalizeCats(meta);
    renderExtraCats(cats);
  } catch (err) {
    // Si falla API, no rompemos la vista
    const mount = document.getElementById("homeExtraCats");
    if (mount) {
      mount.classList.add("hide");
      mount.innerHTML = "";
    }
  }
}

document.addEventListener("DOMContentLoaded", initHome);
