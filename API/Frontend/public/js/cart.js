const API = "http://localhost:3000/api";

function authHeaders() {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
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

async function fetchJSON(url, opts={}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Error");
  return data;
}

async function loadCart() {
  const token = localStorage.getItem("token");
  if (!token) return (window.location.href = "/login");

  const data = await fetchJSON(`${API}/carrito`, { headers: authHeaders() });

  const container = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");
  container.innerHTML = "";

  (data.items || []).forEach(item => {
    const c = colorMap(item.color || "");
    container.innerHTML += `
      <div class="cart-item">
        <div class="cart-thumb" style="--p-color:${c}"></div>
        <div class="cart-meta">
          <div class="name">${item.nombre}</div>
          <div class="sub">${money(item.precio)} · Subtotal: ${money(item.subtotal)}</div>
        </div>
        <div class="cart-right">
          <div class="stepper" data-stepper="${item.id}">
            <button type="button" data-dec>-</button>
            <input value="${item.cantidad}" />
            <button type="button" data-inc>+</button>
          </div>
          <span class="link-danger" data-remove="${item.id}">Quitar</span>
        </div>
      </div>
    `;
  });

  totalEl.textContent = `Total: ${money(data.total || 0)}`;
}

document.addEventListener("click", async (e) => {
  const rm = e.target.closest("[data-remove]");
  if (rm) {
    const itemId = rm.getAttribute("data-remove");
    await fetchJSON(`${API}/carrito/item/${itemId}`, { method:"DELETE", headers: authHeaders() });
    return loadCart();
  }

  const step = e.target.closest("[data-stepper]");
  if (!step) return;

  const itemId = step.getAttribute("data-stepper");
  const inp = step.querySelector("input");
  let v = Number(inp.value || 1);

  if (e.target.matches("[data-dec]")) v = Math.max(1, v - 1);
  if (e.target.matches("[data-inc]")) v = Math.min(99, v + 1);

  inp.value = String(v);

  await fetchJSON(`${API}/carrito/item/${itemId}`, {
    method:"PUT",
    headers: { "Content-Type":"application/json", ...authHeaders() },
    body: JSON.stringify({ cantidad: v })
  });

  loadCart();
});

document.getElementById("btnEmpty")?.addEventListener("click", async () => {
  await fetchJSON(`${API}/carrito/vaciar`, { method:"DELETE", headers: authHeaders() });
  loadCart();
});

document.getElementById("btnBuy")?.addEventListener("click", async () => {
  await fetchJSON(`${API}/venta/confirmar`, { method:"POST", headers: authHeaders() });
  alert("Compra realizada ✅");
  loadCart();
});

loadCart().catch(() => {});
