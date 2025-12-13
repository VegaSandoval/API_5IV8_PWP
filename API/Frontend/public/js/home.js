const API = "/api";

function escapeHTML(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchJSON(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.msg || "Error");
  return data;
}

function categoryCard({ title, href, badge }) {
  return `
    <article class="category-card">
      <div class="category-top">
        ${badge ? `<div class="category-badge">${escapeHTML(badge)}</div>` : ""}
        <div class="category-title">${escapeHTML(title)}</div>
      </div>

      <a class="btn btn-primary btn-sm category-btn" href="${href}">
        Mirar categoría
      </a>
    </article>
  `;
}

async function loadHome() {
  const grid = document.getElementById("categoriesGrid");
  if (!grid) return;

  grid.innerHTML = `
    <div class="card card-pad-sm">Cargando categorías...</div>
  `;

  const meta = await fetchJSON(`${API}/productos/metadata`);
  const cats = Array.isArray(meta.categorias) ? meta.categorias : [];

  const clean = cats
    .map(c => String(c).trim())
    .filter(Boolean);

  const uniq = [...new Set(clean)];

  let html = categoryCard({
    title: "Ver todo",
    href: "/products",
    badge: "Catálogo"
  });

  html += uniq.map(c => categoryCard({
    title: c,
    href: `/products?categoria=${encodeURIComponent(c)}`
  })).join("");

  grid.innerHTML = html;

  const salud = uniq.find(c => c.toLowerCase() === "salud");
  const promo = document.getElementById("saludPromo");
  const link = document.getElementById("saludLink");

  if (salud && promo && link) {
    link.href = `/products?categoria=${encodeURIComponent(salud)}`;
    promo.classList.remove("hide");
  }
}

loadHome().catch(() => {
  const grid = document.getElementById("categoriesGrid");
  if (grid) grid.innerHTML = `<div class="card card-pad-sm">No se pudieron cargar las categorías.</div>`;
});
