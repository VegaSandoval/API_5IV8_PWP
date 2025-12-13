const API = "/api";

const SLOT_STYLES = [
  // 1..3  (Esqueleto 1: 1 grande + 2 apiladas)
  { bg: "#bfc5ad", fg: "#1b2733", cta: "primary" }, // 1
  { bg: "#8ba0b5", fg: "#1b2733", cta: "primary" }, // 2
  { bg: "#4a4e3d", fg: "#ffffff", cta: "ghost"    }, // 3

  // 4..6 (Esqueleto 2: fila de 3)
  { bg: "#f3d9c8", fg: "#1b2733", cta: "accent"  }, // 4
  { bg: "#dccdc3", fg: "#1b2733", cta: "ghost"   }, // 5
  { bg: "#dcdcc3", fg: "#1b2733", cta: "primary" }, // 6

  // 7..10 (Esqueleto 3: “arcos” 4)
  { bg: "#8ba0b5", fg: "#1b2733", cta: "primary" }, // 7
  { bg: "#45617d", fg: "#ffffff", cta: "ghost"   }, // 8
  { bg: "#d9ad8d", fg: "#1b2733", cta: "ghost"   }, // 9
  { bg: "#eee4df", fg: "#1b2733", cta: "primary" }, // 10

  // 11..13 (Esqueleto 4: fila 3)
  { bg: "#4a4e3d", fg: "#ffffff", cta: "ghost"   }, // 11
  { bg: "#8ba0b5", fg: "#1b2733", cta: "primary" }, // 12
  { bg: "#45617d", fg: "#ffffff", cta: "ghost"   }, // 13

  // 14 (Esqueleto 5: 1 categoría ocupando toda la fila)
  { bg: "#eee4df", fg: "#1b2733", cta: "primary" }, // 14
];

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

function slotStyle(slotIndexZeroBased) {
  const s = SLOT_STYLES[slotIndexZeroBased % SLOT_STYLES.length];
  return s;
}

function makeHref(name) {
  if (name === "__ALL__") return "/products";
  return `/products?categoria=${encodeURIComponent(name)}`;
}

function splitTitleForHero(title) {
  const w = String(title).trim().split(/\s+/).filter(Boolean);
  if (w.length <= 2) return escapeHTML(title);
  // 3+ palabras: apiladas tipo “Croque / tas / Pre / mium”
  return w.map(escapeHTML).join("<br/>");
}

function tileHTML(item, slot, variant = "default") {
  const st = slotStyle(slot);
  const title = item.name === "__ALL__" ? "Ver todo" : item.name;

  const isHero = variant === "hero";
  const isArch = variant === "arch";
  const showArrow = variant === "arrow";

  const ctaClass =
    st.cta === "accent" ? "cat-action cat-action-accent" :
    st.cta === "ghost"  ? "cat-action cat-action-ghost"  :
                          "cat-action cat-action-primary";

  const ctaText =
    item.name === "__ALL__" ? "VER CATÁLOGO" :
    isHero ? "MIRAR CATEGORÍA" :
    variant === "wide" ? `MIRAR ${escapeHTML(title).toUpperCase()}` :
    "MIRAR CATEGORÍA";

  const desc = isHero
    ? "Los mejores productos para tu mascota: filtra por categorías y compra fácil."
    : "";

  return `
    <a class="cat-tile ${isHero ? "tile-hero" : ""} ${isArch ? "tile-arch" : ""}"
       href="${makeHref(item.name)}"
       style="--tile-bg:${st.bg}; --tile-fg:${st.fg};">
      <div class="cat-inner">
        <div class="cat-title ${isHero ? "cat-title-hero" : ""}">
          ${isHero ? splitTitleForHero(title) : escapeHTML(title)}
        </div>

        ${desc ? `<div class="cat-desc">${escapeHTML(desc)}</div>` : ""}

        ${isHero || variant === "wide" || item.name === "__ALL__"
          ? `<div class="${ctaClass}">${ctaText}</div>`
          : `<div class="cat-mini">${ctaText}</div>`
        }
      </div>

      ${showArrow ? `<span class="cat-arrow" aria-hidden="true">↗</span>` : ""}
    </a>
  `;
}

/** Esqueleto 1 (3): 1 grande izquierda + 2 apiladas derecha */
function blockS1(items3, slotStart) {
  return `
    <section class="mosaic-block sk-1">
      <div class="sk1-a">
        ${tileHTML(items3[0], slotStart + 0, "hero")}
      </div>
      <div class="sk1-b">
        ${tileHTML(items3[1], slotStart + 1, "default")}
      </div>
      <div class="sk1-c">
        ${tileHTML(items3[2], slotStart + 2, "default")}
      </div>
    </section>
  `;
}

/** Esqueleto 2 (3): fila de 3 (1 ancha + 2 normales) */
function blockS2(items3, slotStart) {
  return `
    <section class="mosaic-block sk-2">
      <div class="sk2-a">
        ${tileHTML(items3[0], slotStart + 0, "wide")}
      </div>
      <div class="sk2-b">
        ${tileHTML(items3[1], slotStart + 1, "arrow")}
      </div>
      <div class="sk2-c">
        ${tileHTML(items3[2], slotStart + 2, "arrow")}
      </div>
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
      <div class="sk4-a">
        ${tileHTML(items3[0], slotStart + 0, "arrow")}
      </div>
      <div class="sk4-b">
        ${tileHTML(items3[1], slotStart + 1, "arrow")}
      </div>
      <div class="sk4-c">
        ${tileHTML(items3[2], slotStart + 2, "wide")}
      </div>
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
  const cats = Array.isArray(meta.categorias) ? meta.categorias : [];

  const clean = cats.map(c => String(c).trim()).filter(Boolean);
  const uniq = [...new Set(clean)];

  let items = [{ name: "__ALL__" }, ...uniq.map(name => ({ name }))];

  const saludName = items.find(it => it.name.toLowerCase?.() === "salud")?.name;
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
    { take: 3, fn: (arr, s) => blockS1(arr, s) }, // 1
    { take: 3, fn: (arr, s) => blockS2(arr, s) }, // 2
    { take: 4, fn: (arr, s) => blockS3(arr, s) }, // 3
    { take: 3, fn: (arr, s) => blockS4(arr, s) }, // 4
    { take: 1, fn: (arr, s) => blockS5(arr[0], s) }, // 5
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
    if (remaining === 4) {
      html += blockS1([items[i], items[i + 1], items[i + 2]], slot);
      i += 3; slot += 3;
      continue; 
    }
    if (remaining === 5) {
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
