(() => {
  "use strict";

  const API_BASE = "/api";
  const CART_LS = "cartItems"; // fallback si no hay sesión
  const CART_SYNC_KEY = "cartSyncedUserId"; // para sincronizar carrito local -> BD

  /* =========================
     Helpers auth + fetch
  ========================= */
  function getToken() {
    return localStorage.getItem("accessToken");
  }

  function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function clearSession() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
  }

  async function requestJSON(url, opts = {}) {
    const res = await fetch(url, opts);
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (res.status === 401) {
      clearSession();
    }

    return { ok: res.ok, status: res.status, data };
  }

  function moneyMXN(n) {
    const num = Number(n || 0);
    return num.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
  }

  /* =========================
     Local fallback cart
  ========================= */
  function loadLocalCart() {
    return JSON.parse(localStorage.getItem(CART_LS) || "[]");
  }

  function saveLocalCart(items) {
    localStorage.setItem(CART_LS, JSON.stringify(items));
  }

  function localCount(items) {
    return items.reduce((acc, it) => acc + Number(it.qty || 0), 0);
  }

  function localSubtotal(items) {
    return items.reduce((acc, it) => acc + Number(it.qty || 0) * Number(it.precio || 0), 0);
  }

  /* =========================
     Cart state (API o Local)
  ========================= */
  const cartState = {
    mode: "local", // "api" | "local"
    items: [], // normalizado: { itemId, producto_id, nombre, imagen, precio, qty, stock? }
  };

  function detectMode() {
    cartState.mode = getToken() ? "api" : "local";
    return cartState.mode;
  }

  function normalizeFromAPI(apiItems = []) {
    return apiItems.map((it) => ({
      itemId: it.id, // carrito_item.id
      producto_id: it.producto_id,
      nombre: it.nombre || "Producto",
      imagen: it.imagen || "",
      precio: Number(it.precio || 0),
      qty: Number(it.cantidad || 0),
      stock: Number(it.stock_disponible ?? it.stock ?? 0),
    }));
  }

  function normalizeFromLocal(localItems = []) {
    return localItems.map((it) => ({
      // en local el "itemId" será el id del producto
      itemId: it.id,
      producto_id: it.id,
      nombre: it.nombre || "Producto",
      imagen: it.imagen || "",
      precio: Number(it.precio || 0),
      qty: Number(it.qty || 0),
    }));
  }

  /* =========================
     Badge
  ========================= */
  function updateBadge() {
    const badge = document.getElementById("cartBadge");
    if (!badge) return;

    const count =
      cartState.mode === "api"
        ? cartState.items.reduce((acc, it) => acc + Number(it.qty || 0), 0)
        : localCount(loadLocalCart());

    badge.textContent = String(count);
    badge.classList.toggle("hide", count <= 0);
  }

  /* =========================
     Drawer open/close
  ========================= */
  const drawer = document.getElementById("cartDrawer");
  const overlay = document.getElementById("drawerOverlay");
  const btnOpen = document.getElementById("openCartBtn");
  const btnClose = document.getElementById("closeCartBtn");

  async function openDrawer() {
    if (!drawer || !overlay) return;
    overlay.hidden = false;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    await refreshCart({ render: true });
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

  /* =========================
     Render drawer + /cart
  ========================= */
  function renderDrawer() {
    const itemsEl = document.getElementById("cartDrawerItems");
    const subEl = document.getElementById("cartDrawerSubtotal");
    if (!itemsEl || !subEl) return;

    const items = cartState.items;

    const subtotal = items.reduce((acc, it) => acc + Number(it.qty || 0) * Number(it.precio || 0), 0);
    subEl.textContent = moneyMXN(subtotal);

    if (!items.length) {
      itemsEl.innerHTML = `<div class="cartEmpty">Tu carrito está vacío.</div>`;
      return;
    }

    itemsEl.innerHTML = items
      .map(
        (it) => `
        <div class="cartRowItem" data-item-id="${String(it.itemId)}">
          <div class="cartThumb" style="background-image:url('${it.imagen || ""}')"></div>

          <div class="cartInfo">
            <div class="cartName">${escapeHTML(it.nombre || "Producto")}</div>
            <div class="cartPrice">${it.qty} <span class="x">x</span>
              <span class="p">${moneyMXN(it.precio)}</span>
            </div>

            <div class="cartQty">
              <button class="qtyBtn" data-act="minus" type="button">−</button>
              <div class="qtyVal">${it.qty}</div>
              <button class="qtyBtn" data-act="plus" type="button">+</button>
            </div>
          </div>

          <button class="cartRemove" title="Quitar" data-act="remove" type="button">✕</button>
        </div>
      `
      )
      .join("");
  }

  function renderCartPage() {
    const list = document.getElementById("cartPageList");
    const sub = document.getElementById("cartPageSubtotal");
    if (!list || !sub) return;

    const items = cartState.items;
    const subtotal = items.reduce((acc, it) => acc + Number(it.qty || 0) * Number(it.precio || 0), 0);
    sub.textContent = moneyMXN(subtotal);

    if (!items.length) {
      list.innerHTML = `<div class="cartEmpty">Tu carrito está vacío.</div>`;
      return;
    }

    list.innerHTML = items
      .map(
        (it) => `
        <div class="cartPageItem" data-item-id="${String(it.itemId)}">
          <div class="cartThumb cartThumb--big" style="background-image:url('${it.imagen || ""}')"></div>
          <div class="cartInfo">
            <div class="cartName">${escapeHTML(it.nombre || "Producto")}</div>
            <div class="cartPrice">${moneyMXN(it.precio)} · ${it.qty} unidad(es)</div>
            <div class="cartQty">
              <button class="qtyBtn" data-act="minus" type="button">−</button>
              <div class="qtyVal">${it.qty}</div>
              <button class="qtyBtn" data-act="plus" type="button">+</button>
              <button class="pillBtn pillBtn--outline cartRemoveLine" data-act="remove" type="button">Quitar producto</button>
            </div>
          </div>
        </div>
      `
      )
      .join("");
  }

  function escapeHTML(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /* =========================
     Sync local -> API (solo 1 vez por user)
  ========================= */
  function readUserIdFromLS() {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "null");
      return u?.id ?? u?.usuario?.id ?? null;
    } catch {
      return null;
    }
  }

  async function syncLocalToAPIOnce() {
    if (!getToken()) return;

    const userId = readUserIdFromLS();
    if (!userId) return;

    const lastSynced = localStorage.getItem(CART_SYNC_KEY);
    if (String(lastSynced) === String(userId)) return;

    const localItems = loadLocalCart();
    if (!localItems.length) {
      localStorage.setItem(CART_SYNC_KEY, String(userId));
      return;
    }

    // intenta pasar items a BD
    for (const it of localItems) {
      const pid = parseInt(it.id, 10);
      const qty = parseInt(it.qty, 10) || 1;
      if (!pid || qty <= 0) continue;

      await requestJSON(`${API_BASE}/carrito/agregar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ producto_id: pid, cantidad: qty }),
      });
    }

    // limpia local y marca synced
    saveLocalCart([]);
    localStorage.setItem(CART_SYNC_KEY, String(userId));
  }

  /* =========================
     Load / Refresh cart
  ========================= */
  async function refreshCart({ render = true } = {}) {
    detectMode();

    // Si hay token, preferimos API; si falla, caemos a local sin romper la página.
    if (cartState.mode === "api") {
      await syncLocalToAPIOnce();

      const r = await requestJSON(`${API_BASE}/carrito`, { headers: { ...authHeaders() } });
      if (r.ok) {
        const apiItems = Array.isArray(r.data?.items) ? r.data.items : Array.isArray(r.data) ? r.data : [];
        cartState.items = normalizeFromAPI(apiItems);
      } else {
        // si token expiró o error, fallback local
        detectMode(); // puede volverse "local" si fue 401 y limpiamos sesión
        cartState.mode = getToken() ? "api" : "local";
        cartState.items = normalizeFromLocal(loadLocalCart());
      }
    } else {
      cartState.items = normalizeFromLocal(loadLocalCart());
    }

    updateBadge();
    if (render) {
      renderDrawer();
      renderCartPage();
    }
  }

  /* =========================
     Mutations (add/qty/remove/clear)
  ========================= */
  async function addToCart(productId, cantidad = 1, meta = null) {
    detectMode();

    // API mode
    if (cartState.mode === "api") {
      if (!getToken()) {
        alert("Inicia sesión para agregar al carrito.");
        window.location.href = "/login";
        return;
      }

      const r = await requestJSON(`${API_BASE}/carrito/agregar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ producto_id: Number(productId), cantidad: Number(cantidad) }),
      });

      if (!r.ok) {
        alert(r.data?.msg || "No se pudo agregar al carrito");
        return;
      }

      await refreshCart({ render: true });
      return;
    }

    // Local mode
    const items = loadLocalCart();
    const id = String(productId);

    const found = items.find((x) => String(x.id) === id);
    if (found) found.qty = Number(found.qty || 0) + Number(cantidad || 1);
    else {
      items.push({
        id,
        nombre: meta?.nombre || "Producto",
        precio: Number(meta?.precio || 0),
        imagen: meta?.imagen || "",
        qty: Number(cantidad || 1),
      });
    }

    saveLocalCart(items);
    cartState.items = normalizeFromLocal(items);
    updateBadge();
    renderDrawer();
    renderCartPage();
  }

  async function setQty(itemId, nextQty) {
    detectMode();

    if (cartState.mode === "api") {
      const r = await requestJSON(`${API_BASE}/carrito/item/${encodeURIComponent(itemId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ cantidad: Number(nextQty) }),
      });

      if (!r.ok) {
        alert(r.data?.msg || "No se pudo actualizar la cantidad");
        return;
      }

      await refreshCart({ render: true });
      return;
    }

    // local: itemId = productId
    const items = loadLocalCart();
    const idx = items.findIndex((x) => String(x.id) === String(itemId));
    if (idx < 0) return;

    if (nextQty <= 0) items.splice(idx, 1);
    else items[idx].qty = Number(nextQty);

    saveLocalCart(items);
    cartState.items = normalizeFromLocal(items);
    updateBadge();
    renderDrawer();
    renderCartPage();
  }

  async function removeLine(itemId) {
    detectMode();

    if (cartState.mode === "api") {
      const r = await requestJSON(`${API_BASE}/carrito/item/${encodeURIComponent(itemId)}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });

      if (!r.ok) {
        alert(r.data?.msg || "No se pudo quitar el producto");
        return;
      }

      await refreshCart({ render: true });
      return;
    }

    const items = loadLocalCart().filter((x) => String(x.id) !== String(itemId));
    saveLocalCart(items);
    cartState.items = normalizeFromLocal(items);
    updateBadge();
    renderDrawer();
    renderCartPage();
  }

  async function clearCart() {
    detectMode();

    if (cartState.mode === "api") {
      const r = await requestJSON(`${API_BASE}/carrito/vaciar`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });

      if (!r.ok) {
        alert(r.data?.msg || "No se pudo vaciar el carrito");
        return;
      }

      await refreshCart({ render: true });
      return;
    }

    saveLocalCart([]);
    cartState.items = [];
    updateBadge();
    renderDrawer();
    renderCartPage();
  }

  /* =========================
     Validate profile/envío/pago (API)
     (robusto: intenta varios endpoints)
  ========================= */
  function pick(obj, keys) {
    for (const k of keys) {
      if (obj && obj[k] != null && String(obj[k]).trim() !== "") return obj[k];
    }
    return "";
  }

  async function getCheckoutInfo() {
    // Intenta:
    // 1) GET /api/user/profile (y que devuelva envio/pago)
    // 2) GET /api/user/envio
    // 3) GET /api/user/pago
    const headers = { ...authHeaders() };

    let usuario = null;
    let envio = null;
    let pago = null;

    const p1 = await requestJSON(`${API_BASE}/user/profile`, { headers });
    if (p1.ok) {
      usuario = p1.data?.usuario || p1.data?.user || p1.data || null;
      envio = p1.data?.envio || p1.data?.shipping || null;
      pago = p1.data?.pago || p1.data?.payment || null;
    }

    if (!envio) {
      const p2 = await requestJSON(`${API_BASE}/user/envio`, { headers });
      if (p2.ok) envio = p2.data?.envio || p2.data || null;
    }

    if (!pago) {
      const p3 = await requestJSON(`${API_BASE}/user/pago`, { headers });
      if (p3.ok) pago = p3.data?.pago || p3.data || null;
    }

    return { usuario, envio, pago };
  }

  async function validateReadyToBuy() {
    if (!getToken()) {
      return { ok: false, msg: "Inicia sesión para comprar.", go: "/login" };
    }

    // carrito válido (stock + no vacío)
    const v = await requestJSON(`${API_BASE}/carrito/validar`, { headers: { ...authHeaders() } });
    if (!v.ok) {
      const msg = v.data?.msg || "Tu carrito no es válido para comprar.";
      return { ok: false, msg, go: "/cart", extra: v.data };
    }

    // validar perfil/envío/pago
    const info = await getCheckoutInfo();
    const faltantes = [];

    const nombre = pick(info.usuario, ["nombre", "name"]);
    const correo = pick(info.usuario, ["correo", "email"]);
    if (!nombre) faltantes.push("Nombre");
    if (!correo) faltantes.push("Correo");

    const alcaldia = pick(info.envio, ["alcaldia", "municipio", "ciudad", "city"]);
    const cp = pick(info.envio, ["cp", "codigo_postal", "postal_code"]);
    if (!alcaldia) faltantes.push("Alcaldía/Ciudad (envío)");
    if (!cp) faltantes.push("Código Postal (envío)");

    // pago: aceptamos cualquier “terminación” o método guardado
    const metodo = pick(info.pago, ["metodo", "metodo_pago", "tipo"]);
    const t1 = pick(info.pago, ["terminacion", "terminacion1", "t1"]);
    const t2 = pick(info.pago, ["terminacion2", "t2"]);
    const t3 = pick(info.pago, ["terminacion3", "t3"]);
    const hasPay = Boolean(metodo || t1 || t2 || t3);

    if (!hasPay) faltantes.push("Método de pago");

    if (faltantes.length) {
      return {
        ok: false,
        msg: `Completa tu información antes de comprar:\n• ${faltantes.join("\n• ")}`,
        go: "/profile",
      };
    }

    // método de pago final para /venta/confirmar
    const metodoFinal = metodo || "tarjeta";
    return { ok: true, metodo_pago: metodoFinal };
  }

  async function buyNow() {
    const check = await validateReadyToBuy();

    if (!check.ok) {
      alert(check.msg);
      if (check.go) window.location.href = check.go;
      return;
    }

    const r = await requestJSON(`${API_BASE}/venta/confirmar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ metodo_pago: check.metodo_pago }),
    });

    if (!r.ok) {
      alert(r.data?.msg || "No se pudo completar la compra");
      return;
    }

    alert("✅ Compra realizada correctamente");
    await refreshCart({ render: true });
    window.location.href = "/profile";
  }

  /* =========================
     UI bindings
  ========================= */
  // Vaciar desde drawer
  document.getElementById("cartDrawerClearBtn")?.addEventListener("click", () => {
    clearCart();
  });

  // Vaciar desde /cart
  document.getElementById("cartPageClearBtn")?.addEventListener("click", () => {
    clearCart();
  });

  // Delegación: + / - / remove (drawer + cart page)
  document.addEventListener("click", (e) => {
    const row = e.target.closest(".cartRowItem, .cartPageItem");
    if (!row) return;

    const act = e.target.getAttribute("data-act");
    if (!act) return;

    const itemId = row.getAttribute("data-item-id");
    if (!itemId) return;

    const current = cartState.items.find((x) => String(x.itemId) === String(itemId));
    const qty = Number(current?.qty || 0);

    if (act === "plus") setQty(itemId, qty + 1);
    if (act === "minus") setQty(itemId, Math.max(1, qty - 1));
    if (act === "remove") removeLine(itemId);
  });

  // Add to cart (GLOBAL)
  // ✅ Soporta:
  // - [data-add-cart="ID"]
  // - .js-add-cart con data-id="ID"
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-add-cart]") || e.target.closest(".js-add-cart");
    if (!btn) return;

    const id = btn.getAttribute("data-add-cart") || btn.getAttribute("data-id");
    if (!id) return;

    // meta opcional (para modo local)
    const nombre = btn.getAttribute("data-name");
    const precio = btn.getAttribute("data-price");
    const imagen = btn.getAttribute("data-img");

    const meta = {
      nombre: nombre || "Producto",
      precio: Number(precio || 0),
      imagen: imagen || "",
    };

    await addToCart(id, 1, meta);
    await openDrawer();
  });

  /* =========================
     Hook Comprar en /cart
     (quita onclick inline de tu EJS)
  ========================= */
  function bindBuyButton() {
    const buyBtn = document.querySelector(".cartPage .cartSummary button.pillBtn--outline");
    if (!buyBtn) return;

    // Quita el alert inline si existe
    buyBtn.onclick = null;
    buyBtn.removeAttribute("onclick");

    buyBtn.addEventListener("click", (e) => {
      e.preventDefault();
      buyNow();
    });
  }

  /* =========================
     Init
  ========================= */
  document.addEventListener("DOMContentLoaded", async () => {
    // Nunca debe romper páginas si algo falla
    try {
      await refreshCart({ render: true });
      bindBuyButton();
    } catch (err) {
      console.error("cart.js init error:", err);
      // fallback ultra seguro a local
      cartState.mode = "local";
      cartState.items = normalizeFromLocal(loadLocalCart());
      updateBadge();
      renderDrawer();
      renderCartPage();
    }
  });
})();
