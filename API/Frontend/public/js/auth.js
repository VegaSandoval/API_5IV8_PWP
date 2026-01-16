const API_BASE = "/api";

function showMsg(text, type = "ok") {
  const box = document.getElementById("authMsg");
  if (!box) return;
  box.classList.remove("hide");
  box.className = `authMsg authMsg--${type}`;
  box.textContent = text;
}

// ============================================
// LOGIN
// ============================================
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const correo = document.getElementById("correo").value.trim();
  const password = document.getElementById("password").value;

  if (!correo || !password) {
    return showMsg("Completa todos los campos.", "err");
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return showMsg(data?.msg || "No se pudo iniciar sesión.", "err");
    }

    if (data.accessToken && data.refreshToken) {
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);

      if (data.usuario) localStorage.setItem("user", JSON.stringify(data.usuario));

      showMsg("Iniciando sesión...", "ok");
      setTimeout(() => (window.location.href = "/products"), 400);
      return;
    }

    showMsg("Respuesta inválida del servidor.", "err");
  } catch (err) {
    console.error("Error en login:", err);
    showMsg("Error de red. Verifica tu conexión.", "err");
  }
});

// ============================================
// REGISTRO
// ============================================
document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nombre = document.getElementById("nombre")?.value.trim();
  const telefono = document.getElementById("telefono")?.value.trim() || "";
  const correo = document.getElementById("correo").value.trim();
  const password = document.getElementById("password").value;

  if (!nombre || !correo || !password) {
    return showMsg("Completa todos los campos obligatorios.", "err");
  }

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, correo, password, telefono }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return showMsg(data?.msg || "No se pudo registrar.", "err");
    }

    if (data.accessToken && data.refreshToken) {
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      if (data.usuario) localStorage.setItem("user", JSON.stringify(data.usuario));

      showMsg("¡Cuenta creada! Redirigiendo...", "ok");
      setTimeout(() => (window.location.href = "/products"), 600);
      return;
    }

    showMsg("Cuenta creada. Inicia sesión.", "ok");
    setTimeout(() => (window.location.href = "/login"), 600);
  } catch (err) {
    console.error("Error en register:", err);
    showMsg("Error de red. Verifica tu conexión.", "err");
  }
});
