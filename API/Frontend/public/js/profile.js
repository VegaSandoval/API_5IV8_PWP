const API = "/api";

function authHeaders() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
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
    throw new Error(data?.msg || "Error");
  }
  
  return data;
}

async function loadProfile() {
  const token = localStorage.getItem("accessToken");
  if (!token) {
    window.location.href = "/login";
    return;
  }

  try {
    const data = await fetchJSON(`${API}/user/profile`, { 
      headers: authHeaders() 
    });

    // Llenar campos del formulario
    const nombreInput = document.getElementById("nombre");
    const telefonoInput = document.getElementById("telefono");
    const correoInput = document.getElementById("correo");

    if (nombreInput) nombreInput.value = data.usuario?.nombre || "";
    if (telefonoInput) telefonoInput.value = data.usuario?.telefono || "";
    if (correoInput) correoInput.value = data.usuario?.correo || "";

    // Mostrar estadísticas (si existen en el DOM)
    const statsEl = document.getElementById("profileStats");
    if (statsEl && data.estadisticas) {
      statsEl.innerHTML = `
        <div class="card card-pad-sm">
          <h3 class="h3">Resumen</h3>
          <p class="muted">
            Compras: ${data.estadisticas.total_compras || 0} · 
            Total gastado: $${parseFloat(data.estadisticas.total_gastado || 0).toFixed(2)} · 
            En carrito: ${data.estadisticas.items_en_carrito || 0} items
          </p>
        </div>
      `;
    }

    // Mostrar rol si es admin
    const rolBadge = document.getElementById("rolBadge");
    if (rolBadge && data.usuario?.rol === 'admin') {
      rolBadge.innerHTML = `
        <span style="background: var(--primary); color: #fff; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700;">
          ADMIN
        </span>
      `;
    }

  } catch (err) {
    console.error("Error al cargar perfil:", err);
  }
}

// ============================================
// ACTUALIZAR PERFIL
// ============================================
document.getElementById("profileForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nombre = document.getElementById("nombre")?.value.trim();
  const telefono = document.getElementById("telefono")?.value.trim();
  const correo = document.getElementById("correo")?.value.trim();

  if (!nombre) {
    alert("El nombre es obligatorio");
    return;
  }

  try {
    const body = { nombre };
    if (telefono) body.telefono = telefono;
    if (correo) body.correo = correo;

    await fetchJSON(`${API}/user/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body)
    });

    alert("✅ Perfil actualizado correctamente");
    await loadProfile(); // Recargar datos

  } catch (err) {
    alert(err.message || "No se pudo actualizar el perfil");
  }
});

// ============================================
// CAMBIAR CONTRASEÑA (opcional)
// ============================================
document.getElementById("changePasswordForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const password_actual = document.getElementById("password_actual")?.value;
  const password_nueva = document.getElementById("password_nueva")?.value;

  if (!password_actual || !password_nueva) {
    alert("Completa ambos campos");
    return;
  }

  try {
    await fetchJSON(`${API}/user/cambiar-password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ password_actual, password_nueva })
    });

    alert("✅ Contraseña actualizada. Inicia sesión nuevamente.");
    
    // Limpiar sesión y redirigir
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    
    setTimeout(() => {
      window.location.href = "/login";
    }, 1000);

  } catch (err) {
    alert(err.message || "No se pudo cambiar la contraseña");
  }
});

// Cargar perfil al iniciar
loadProfile().catch(() => {
  console.error("Error inicial al cargar perfil");
});