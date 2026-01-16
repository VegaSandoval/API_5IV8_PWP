const CART_LS = "cartItems";

function moneyMXN(n) {
  const num = Number(n || 0);
  return num.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function loadCart() {
  return JSON.parse(localStorage.getItem(CART_LS) || "[]");
}
function saveCart(items) {
  localStorage.setItem(CART_LS, JSON.stringify(items));
  updateBadge();
}

function cartCount(items = loadCart()) {
  return items.reduce((acc, it) => acc + Number(it.qty || 0), 0);
}

function cartSubtotal(items = loadCart()) {
  return items.reduce((acc, it) => acc + Number(it.qty || 0) * Number(it.precio || 0), 0);
}

/* Drawer elements */
const drawer = document.getElementById("cartDrawer");
const overlay = document.getElementById("drawerOverlay");
const btnOpen = document.getElementById("openCartBtn");
const btnClose = document.getElementById("closeCartBtn");

function openDrawer() {
  if (!drawer || !overlay) return;
  overlay.hidden = false;
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  renderDrawer();
}

function closeDrawer() {
  if (!drawer || !overlay) return;
  overlay.hidden = true;
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
}

btnOpen?.addEventListener("click", () => openDrawer());
btnClose?.addEventListener("click", () => closeDrawer());
overlay?.addEventListener("click", () => closeDrawer());

/* Badge */
function updateBadge() {
  const badge = document.getElementById("cartBadge");
  if (!badge) return;
  const count = cartCount();
  badge.textContent = String(count);
  badge.classList.toggle("hide", count <= 0);
}

/* Render drawer */
function renderDrawer() {
  const itemsEl = document.getElementById("cartDrawerItems");
  const subEl = document.getElementById("cartDrawerSubtotal");
  if (!itemsEl || !subEl) return;

  const items = loadCart();
  subEl.textContent = moneyMXN(cartSubtotal(items));

  if (!items.length) {
    itemsEl.innerHTML = `<div class="cartEmpty">Tu carrito está vacío.</div>`;
    return;
  }

  itemsEl.innerHTML = items.map((it) => `
    <div class="cartRowItem" data-id="${it.id}">
      <div class="cartThumb" style="background-image:url('${it.imagen || ""}')"></div>

      <div class="cartInfo">
        <div class="cartName">${it.nombre || "Producto"}</div>
        <div class="cartPrice">${it.qty} <span class="x">x</span> <span class="p">${moneyMXN(it.precio)}</span></div>

        <div class="cartQty">
          <button class="qtyBtn" data-act="minus" type="button">−</button>
          <div class="qtyVal">${it.qty}</div>
          <button class="qtyBtn" data-act="plus" type="button">+</button>
        </div>
      </div>

      <button class="cartRemove" title="Quitar" data-act="remove" type="button">✕</button>
    </div>
  `).join("");
}

/* Drawer actions */
document.getElementById("cartDrawerClearBtn")?.addEventListener("click", () => {
  saveCart([]);
  renderDrawer();
  renderCartPage();
});

/* Event delegation qty/remove */
document.addEventListener("click", (e) => {
  const row = e.target.closest(".cartRowItem");
  if (!row) return;

  const id = row.getAttribute("data-id");
  const act = e.target.getAttribute("data-act");
  if (!id || !act) return;

  const items = loadCart();
  const idx = items.findIndex((x) => String(x.id) === String(id));
  if (idx < 0) return;

  if (act === "plus") items[idx].qty = Number(items[idx].qty || 0) + 1;
  if (act === "minus") items[idx].qty = Math.max(1, Number(items[idx].qty || 0) - 1);
  if (act === "remove") items.splice(idx, 1);

  saveCart(items);
  renderDrawer();
  renderCartPage();
});

/* Add to cart (GLOBAL)
   ✅ Soporta:
   - tu botón actual: [data-add-cart="ID"]
   - compat: .js-add-cart con data-id="ID"
*/
document.addEventListener("click", async (e) => {
  const btn =
    e.target.closest("[data-add-cart]") ||
    e.target.closest(".js-add-cart");

  if (!btn) return;

  const id =
    btn.getAttribute("data-add-cart") ||
    btn.getAttribute("data-id");

  if (!id) return;

  const nombre = btn.getAttribute("data-name");
  const precio = btn.getAttribute("data-price");
  const imagen = btn.getAttribute("data-img");

  let prod = null;

  if (nombre && precio) {
    prod = { id, nombre, precio: Number(precio), imagen: imagen || "" };
  } else {
    try {
      const res = await fetch(`/api/productos/${encodeURIComponent(id)}`);
      const data = await res.json().catch(() => ({}));
      const p = data.producto || data || {};
      prod = {
        id: p.id || id,
        nombre: p.nombre || "Producto",
        precio: Number(p.precio || 0),
        imagen: p.imagen || "",
      };
    } catch {
      prod = { id, nombre: "Producto", precio: 0, imagen: "" };
    }
  }

  const items = loadCart();
  const found = items.find((x) => String(x.id) === String(prod.id));
  if (found) found.qty += 1;
  else items.push({ ...prod, qty: 1 });

  saveCart(items);
  openDrawer();
});

/* Cart page ( /cart ) */
function renderCartPage() {
  const list = document.getElementById("cartPageList");
  const sub = document.getElementById("cartPageSubtotal");
  if (!list || !sub) return;

  const items = loadCart();
  sub.textContent = moneyMXN(cartSubtotal(items));

  if (!items.length) {
    list.innerHTML = `<div class="cartEmpty">Tu carrito está vacío.</div>`;
    return;
  }

  list.innerHTML = items.map((it) => `
    <div class="cartPageItem" data-id="${it.id}">
      <div class="cartThumb cartThumb--big" style="background-image:url('${it.imagen || ""}')"></div>
      <div class="cartInfo">
        <div class="cartName">${it.nombre || "Producto"}</div>
        <div class="cartPrice">${moneyMXN(it.precio)} · ${it.qty} unidad(es)</div>
        <div class="cartQty">
          <button class="qtyBtn" data-act="minus" type="button">−</button>
          <div class="qtyVal">${it.qty}</div>
          <button class="qtyBtn" data-act="plus" type="button">+</button>
          <button class="pillBtn pillBtn--outline cartRemoveLine" data-act="remove" type="button">Quitar producto</button>
        </div>
      </div>
    </div>
  `).join("");
}

document.getElementById("cartPageClearBtn")?.addEventListener("click", () => {
  saveCart([]);
  renderDrawer();
  renderCartPage();
});

document.addEventListener("DOMContentLoaded", () => {
  updateBadge();
  renderDrawer();
  renderCartPage();
});
