const API_BASE = "/api";

function showMsg(text, type = "ok") {
  const box = document.getElementById("authMsg");
  if (!box) return;
  box.className = `notice ${type}`;
  box.textContent = text;
  box.style.display = "";
}

document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const correo = document.getElementById("correo").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      return showMsg(data?.msg || "No se pudo iniciar sesión.", "err");
    }

    if (data.token) {
      localStorage.setItem("token", data.token);
      window.location.href = "/products";
      return;
    }

    showMsg("Respuesta inválida del servidor (sin token).", "err");
  } catch {
    showMsg("Error de red.", "err");
  }
});

document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nombre = document.getElementById("nombre").value.trim();
  const telefono = document.getElementById("telefono")?.value.trim() || "";
  const correo = document.getElementById("correo").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, correo, password, telefono }),
    });

    const data = await res.json();

    if (!res.ok) {
      return showMsg(data?.msg || "No se pudo registrar.", "err");
    }

    showMsg("Cuenta creada. Ahora inicia sesión.", "ok");
    setTimeout(() => (window.location.href = "/login"), 700);
  } catch {
    showMsg("Error de red.", "err");
  }
});
