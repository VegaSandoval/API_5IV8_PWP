const API = "/api";

function authHeaders() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function colorMap(nombre) {
  const v = String(nombre || "").toUpperCase();
  if (v.includes("ROJO")) return "#d98282";
  if (v.includes("VERDE LIM")) return "#b8d36a";
  if (v.includes("AZUL MAR")) return "#45617d";
  if (v.includes("AZUL CIE")) return "#82bfd1";
  if (v.includes("MORADO")) return "#b79bd8";
  if (v.includes("ROSA")) return "#f2a2bd";
  if (v.includes("AMARIL")) return "#f5d66e";
  if (v.includes("OSCURO")) return "#4a4e3d";
  return "#c4d2df";
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));

  // Manejar token expirado
  if (res.status === 401) {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Sesión expirada");
  }

  if (!res.ok) {
    throw new Error(data?.msg || "Error en la petición");
  }

  return data;
}

async function loadCart() {
  const token = localStorage.getItem("accessToken");
  if (!token) {
    window.location.href = "/login";
    return;
  }

  try {
    const data = await fetchJSON(`${API}/carrito`, {
      headers: authHeaders()
    });

    // ✅ actualizar badge del navbar (mini-carrito)
    try {
      const count = (data.items || []).reduce((acc, it) => acc + Number(it.cantidad || 0), 0);
      window.dispatchEvent(new CustomEvent("cart:changed", { detail: { count } }));
    } catch (_) {}

    const container = document.getElementById("cartItems");
    const totalEl = document.getElementById("cartTotal");

    if (!container || !totalEl) return;

    container.innerHTML = "";

    if (!data.items || data.items.length === 0) {
      container.innerHTML = `
        <div class="card card-pad-sm">
          <p class="muted">Tu carrito está vacío.</p>
          <a href="/products" class="btn btn-primary" style="margin-top: 12px;">Ver productos</a>
        </div>
      `;
      totalEl.textContent = "Total: $0.00";
      return;
    }

    data.items.forEach(item => {
      const c = colorMap(item.color || "");
      const stockSuficiente = item.stock_suficiente !== false;

      container.innerHTML += `
        <div class="cart-item ${!stockSuficiente ? 'out-of-stock' : ''}">
          <div class="cart-thumb" style="--p-color:${c}"></div>
          <div class="cart-meta">
            <div class="name">${item.nombre}</div>
            <div class="sub">
              ${money(item.precio)} · Subtotal: ${money(item.subtotal)}
              ${!stockSuficiente ? '<br><span style="color: var(--danger); font-weight: 700;">⚠️ Sin stock suficiente</span>' : ''}
            </div>
          </div>
          <div class="cart-right">
            <div class="stepper" data-stepper="${item.id}">
              <button type="button" data-dec>-</button>
              <input value="${item.cantidad}" readonly />
              <button type="button" data-inc>+</button>
            </div>
            <span class="link-danger" data-remove="${item.id}">Quitar</span>
          </div>
        </div>
      `;
    });

    totalEl.textContent = `Total: ${money(data.total || 0)}`;

    const btnBuy = document.getElementById("btnBuy");
    if (btnBuy && data.productos_sin_stock > 0) {
      btnBuy.disabled = true;
      btnBuy.textContent = "Productos sin stock";
      btnBuy.style.opacity = "0.5";
    } else if (btnBuy) {
      btnBuy.disabled = false;
      btnBuy.textContent = "Comprar";
      btnBuy.style.opacity = "1";
    }

  } catch (err) {
    console.error("Error al cargar carrito:", err);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("click", async (e) => {
  // Eliminar item
  const rm = e.target.closest("[data-remove]");
  if (rm) {
    const itemId = rm.getAttribute("data-remove");
    try {
      await fetchJSON(`${API}/carrito/item/${itemId}`, {
        method: "DELETE",
        headers: authHeaders()
      });
      await loadCart();
    } catch (err) {
      alert(err.message || "No se pudo eliminar el producto");
    }
    return;
  }

  // Actualizar cantidad
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
      body: JSON.stringify({ cantidad: v })
    });
    await loadCart();
  } catch (err) {
    alert(err.message || "No se pudo actualizar la cantidad");
    await loadCart();
  }
});

// Vaciar carrito
document.getElementById("btnEmpty")?.addEventListener("click", async () => {
  if (!confirm("¿Seguro que deseas vaciar tu carrito?")) return;

  try {
    await fetchJSON(`${API}/carrito/vaciar`, {
      method: "DELETE",
      headers: authHeaders()
    });
    await loadCart();
  } catch (err) {
    alert(err.message || "No se pudo vaciar el carrito");
  }
});

// Comprar
document.getElementById("btnBuy")?.addEventListener("click", async () => {
  const metodo = prompt(
    "Selecciona método de pago:\n1 = Efectivo\n2 = Tarjeta\n3 = Transferencia\n4 = PayPal",
    "2"
  );

  const metodos = {
    "1": "efectivo",
    "2": "tarjeta",
    "3": "transferencia",
    "4": "paypal"
  };

  const metodo_pago = metodos[metodo];

  if (!metodo_pago) {
    alert("Método de pago no válido");
    return;
  }

  try {
    const result = await fetchJSON(`${API}/venta/confirmar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ metodo_pago })
    });

    alert(`✅ ${result.msg || 'Compra realizada con éxito'}\n\nTotal: ${money(result.venta?.total || 0)}\nMétodo: ${metodo_pago.toUpperCase()}`);
    await loadCart();
  } catch (err) {
    alert(err.message || "No se pudo completar la compra");
  }
});

loadCart().catch(() => {
  console.error("Error inicial al cargar carrito");
});
