function hasSession() {
  return !!localStorage.getItem("accessToken");
}

function syncAuthUI() {
  const isLogged = hasSession();
  const guest = document.querySelectorAll('[data-auth="guest"]');
  const user = document.querySelectorAll('[data-auth="user"]');

  guest.forEach(el => el.classList.toggle("hide", isLogged));
  user.forEach(el => el.classList.toggle("hide", !isLogged));
}

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  const refreshToken = localStorage.getItem("refreshToken");

  if (refreshToken) {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
  }

  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");

  syncAuthUI();
  window.location.href = "/";
});

window.addEventListener("storage", syncAuthUI);
syncAuthUI();


// ===============================
// MINI-CARRITO (Drawer) + Add to cart
// ===============================
(() => {
  const API = "/api";

  function token() {
    return localStorage.getItem("accessToken");
  }

  function authHeaders() {
    const t = token();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  function money(n) {
    const x = Number(n || 0);
    return x.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
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

  function countItems(items) {
    return (items || []).reduce((acc, it) => acc + Number(it.cantidad || 0), 0);
  }

  function setBadge(count) {
    const badge = document.getElementById("cartBadge");
    if (!badge) return;

    if (!count) {
      badge.classList.add("hide");
      badge.textContent = "";
      return;
    }

    badge.classList.remove("hide");
    badge.textContent = String(count > 99 ? "99+" : count);
  }

  async function refreshBadge() {
    if (!token()) {
      setBadge(0);
      return;
    }
    try {
      const data = await fetchJSON(`${API}/carrito`, { headers: authHeaders() });
      setBadge(countItems(data.items));
    } catch (_) {}
  }

  function drawerEls() {
    return {
      drawer: document.getElementById("cartDrawer"),
      body: document.getElementById("cartDrawerBody"),
      subtotal: document.getElementById("cartDrawerSubtotal"),
    };
  }

  function openDrawer() {
    const { drawer } = drawerEls();
    if (!drawer) return;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    const { drawer } = drawerEls();
    if (!drawer) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function renderDrawer(data) {
    const { body, subtotal } = drawerEls();
    if (!body || !subtotal) return;

    const items = data?.items || [];
    subtotal.textContent = money(data?.total || 0);

    if (!items.length) {
      body.innerHTML = `
        <div class="cartDrawer__empty">
          <div class="cartDrawer__emptyTitle">Tu carrito está vacío.</div>
          <div class="muted cartDrawer__emptyText">Agrega productos para verlos aquí.</div>
          <div style="height:12px"></div>
          <a class="btn btn-primary" href="/products">Ver productos</a>
        </div>
      `;
      return;
    }

    body.innerHTML = items.map((it) => {
      const img = it.imagen ? String(it.imagen) : "";
      const name = String(it.nombre || "Producto");
      const qty = Number(it.cantidad || 1);
      const price = money(it.precio || 0);
      const sub = money(it.subtotal || 0);

      return `
        <div class="cartMiniItem" data-item="${it.id}">
          <div class="cartMiniThumb">
            ${img ? `<img src="${img}" alt="${name}" loading="lazy" onerror="this.remove()">` : ``}
          </div>

          <div>
            <div class="cartMiniName" title="${name.replaceAll('"', "&quot;")}">${name}</div>
            <div class="cartMiniSub">
              <span>${qty}</span><span>x</span><span>${price}</span>
              <span class="cartMiniDot">•</span>
              <strong>${sub}</strong>
            </div>
          </div>

          <div class="cartMiniRight">
            <div class="stepper stepper--mini" data-stepper="${it.id}">
              <button type="button" data-dec>-</button>
              <input value="${qty}" readonly />
              <button type="button" data-inc>+</button>
            </div>
            <span class="cartMiniRemove" data-remove="${it.id}">Quitar</span>
          </div>
        </div>
      `;
    }).join("");
  }

  async function loadDrawer() {
    const { body, subtotal } = drawerEls();
    if (!body || !subtotal) return;

    if (!token()) {
      subtotal.textContent = money(0);
      body.innerHTML = `
        <div class="cartDrawer__empty">
          <div class="cartDrawer__emptyTitle">Inicia sesión para ver tu carrito.</div>
          <div class="muted cartDrawer__emptyText">Tu carrito está ligado a tu cuenta.</div>
          <div style="height:12px"></div>
          <a class="btn btn-primary" href="/login">Iniciar sesión</a>
        </div>
      `;
      setBadge(0);
      return;
    }

    const data = await fetchJSON(`${API}/carrito`, { headers: authHeaders() });
    renderDrawer(data);
    setBadge(countItems(data.items));
  }

  async function addToCart(productoId, cantidad = 1) {
    if (!token()) {
      window.location.href = "/login";
      return;
    }

    const raw = productoId;
    const pid = Number.isFinite(Number(raw)) ? Number(raw) : raw;

    await fetchJSON(`${API}/carrito/agregar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ producto_id: pid, cantidad: Number(cantidad) }),
    });

    await refreshBadge();
  }

  // ---- eventos globales ----
  document.addEventListener("click", async (e) => {
    // abrir drawer desde ícono nav
    const openBtn = e.target.closest("[data-cart-open]");
    if (openBtn) {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return; // abre /cart normal
      e.preventDefault();
      openDrawer();
      try { await loadDrawer(); } catch (err) { console.error(err); }
      return;
    }

    // cerrar drawer
    const closeBtn = e.target.closest("[data-cart-close]");
    if (closeBtn) {
      closeDrawer();
      return;
    }

    // agregar al carrito desde cards (products)
    const addBtn = e.target.closest("[data-add-cart]");
    if (addBtn) {
      const pid = addBtn.getAttribute("data-add-cart");
      try {
        addBtn.disabled = true;
        await addToCart(pid, 1);
        openDrawer();
        await loadDrawer();
      } catch (err) {
        alert(err.message || "No se pudo agregar al carrito");
      } finally {
        addBtn.disabled = false;
      }
      return;
    }

    // acciones dentro del drawer (quitar / stepper)
    const drawer = document.getElementById("cartDrawer");
    if (!drawer || !drawer.classList.contains("is-open")) return;

    const rm = e.target.closest("[data-remove]");
    if (rm) {
      const itemId = rm.getAttribute("data-remove");
      try {
        await fetchJSON(`${API}/carrito/item/${itemId}`, { method: "DELETE", headers: authHeaders() });
        await loadDrawer();
      } catch (err) {
        alert(err.message || "No se pudo quitar");
      }
      return;
    }

    const step = e.target.closest("[data-stepper]");
    if (!step) return;

    const itemId = step.getAttribute("data-stepper");
    const inp = step.querySelector("input");
    let v = Number(inp.value || 1);

    if (e.target.matches("[data-dec]")) v = Math.max(1, v - 1);
    if (e.target.matches("[data-inc]")) v = Math.min(999, v + 1);

    inp.value = String(v);

    try {
      await fetchJSON(`${API}/carrito/item/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ cantidad: v }),
      });
      await loadDrawer();
    } catch (err) {
      alert(err.message || "No se pudo actualizar");
      await loadDrawer();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  // para que /cart actualice el badge
  window.addEventListener("cart:changed", (ev) => {
    if (ev?.detail?.count != null) setBadge(ev.detail.count);
    else refreshBadge();
  });

  document.addEventListener("DOMContentLoaded", () => {
    refreshBadge().catch(() => {});
  });
})();
