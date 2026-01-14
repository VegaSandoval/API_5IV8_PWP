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

function tileHTML(item, slot, variant = "wide") {
  const isAll = item?.name === "__ALL__";
  const label = isAll ? "Ver todo" : item?.name;

  return `
    <article class="tile tile-${variant}">
      <div class="tile-title">${escapeHTML(label)}</div>
      <a class="btn btn-primary tile-btn" href="${makeHref(isAll ? "" : item.name)}">
        ${isAll ? "Ver catálogo" : `Mirar ${escapeHTML(label)}`}
      </a>
    </article>
  `;
}

/** Esqueleto 1 (3): fila de 3 equitativos */
function blockS1(items3, slotStart) {
  return `
    <section class="mosaic-block sk-1">
      ${items3.map((it, i) => tileHTML(it, slotStart + i, "wide")).join("")}
    </section>
  `;
}

/** Esqueleto 2 (3): fila de 3 (1 ancha + 2 normales) */
function blockS2(items3, slotStart) {
  return `
    <section class="mosaic-block sk-2">
      <div class="sk2-a">${tileHTML(items3[0], slotStart + 0, "wide")}</div>
      <div class="sk2-b">${tileHTML(items3[1], slotStart + 1, "arrow")}</div>
      <div class="sk2-c">${tileHTML(items3[2], slotStart + 2, "arrow")}</div>
    </section>
  `;
}

/** Esqueleto 3 (4): “arcos” */
function blockS3(items4, slotStart) {
  return `
    <section class="mosaic-block sk-3">
      ${items4.map((it, i) => tileHTML(it, slotStart + i, "arch")).join("")}
    </section>
  `;
}

/** Esqueleto 4 (3): fila 3 (izq, centro, der más grande) */
function blockS4(items3, slotStart) {
  return `
    <section class="mosaic-block sk-4">
      <div class="sk4-a">${tileHTML(items3[0], slotStart + 0, "arrow")}</div>
      <div class="sk4-b">${tileHTML(items3[1], slotStart + 1, "arrow")}</div>
      <div class="sk4-c">${tileHTML(items3[2], slotStart + 2, "wide")}</div>
    </section>
  `;
}

/** Esqueleto 5 (1): 1 categoría ocupa toda la fila */
function blockS5(item, slotStart) {
  return `
    <section class="mosaic-block sk-5">
      ${tileHTML(item, slotStart, "wide")}
    </section>
  `;
}

/** Esqueleto 6 (2): dos paneles equitativos */
function blockS6(items2, slotStart) {
  return `
    <section class="mosaic-block sk-6">
      ${tileHTML(items2[0], slotStart + 0, "wide")}
      ${tileHTML(items2[1], slotStart + 1, "wide")}
    </section>
  `;
}

async function loadHome() {
  const mount = document.getElementById("homeMosaic");
  const saludSection = document.getElementById("saludSection");
  const saludLink = document.getElementById("saludLink");

  if (!mount) return;

  mount.innerHTML = `<div class="card card-pad-sm">Cargando…</div>`;

  const meta = await fetchJSON(`${API}/productos/metadata`);

  const rawCats = Array.isArray(meta.categorias) ? meta.categorias : [];
  const clean = rawCats
    .map(pickName)
    .map(s => String(s).trim())
    .filter(Boolean);

  const uniq = [...new Set(clean)];

  let items = [{ name: "__ALL__" }, ...uniq.map(name => ({ name }))];

  const saludName = items.find(it => String(it.name).toLowerCase() === "salud")?.name;
  if (saludName) {
    items = items.filter(it => it.name !== saludName);
    if (saludSection && saludLink) {
      saludLink.href = makeHref(saludName);
      saludSection.classList.remove("hide");
    }
  } else {
    saludSection?.classList.add("hide");
  }

  if (items.length === 0) {
    mount.innerHTML = `<div class="card card-pad-sm">No hay categorías.</div>`;
    return;
  }

  let html = "";
  let i = 0;
  let slot = 0;

  const cycle = [
    { take: 3, fn: (arr, s) => blockS1(arr, s) },
    { take: 3, fn: (arr, s) => blockS2(arr, s) },
    { take: 4, fn: (arr, s) => blockS3(arr, s) },
    { take: 3, fn: (arr, s) => blockS4(arr, s) },
    { take: 1, fn: (arr, s) => blockS5(arr[0], s) },
  ];
  let cycleIdx = 0;

  while (i < items.length) {
    const remaining = items.length - i;

    if (remaining === 1) {
      html += blockS5(items[i], slot);
      i += 1; slot += 1;
      continue;
    }
    if (remaining === 2) {
      html += blockS6([items[i], items[i + 1]], slot);
      i += 2; slot += 2;
      continue;
    }
    if (remaining === 3) {
      html += blockS1([items[i], items[i + 1], items[i + 2]], slot);
      i += 3; slot += 3;
      continue;
    }

    const sk = cycle[cycleIdx];
    const slice = items.slice(i, i + sk.take);
    html += sk.fn(slice, slot);

    i += sk.take;
    slot += sk.take;
    cycleIdx = (cycleIdx + 1) % cycle.length;
  }

  mount.innerHTML = html;
}

loadHome().catch(() => {
  const mount = document.getElementById("homeMosaic");
  if (mount) mount.innerHTML = `<div class="card card-pad-sm">No se pudo cargar el inicio.</div>`;
});
