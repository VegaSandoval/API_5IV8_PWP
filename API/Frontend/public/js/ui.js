// Verificar si hay token (ahora se llama accessToken)
const token = localStorage.getItem("accessToken");

function syncAuthUI() {
  const guest = document.querySelectorAll('[data-auth="guest"]');
  const user = document.querySelectorAll('[data-auth="user"]');

  if (token) {
    guest.forEach(el => el.classList.add("hide"));
    user.forEach(el => el.classList.remove("hide"));
  } else {
    guest.forEach(el => el.classList.remove("hide"));
    user.forEach(el => el.classList.add("hide"));
  }
}

// Logout
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  const refreshToken = localStorage.getItem("refreshToken");
  
  // Llamar al endpoint de logout si hay refresh token
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

  // Limpiar localStorage
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  
  window.location.href = "/";
});

// Sincronizar UI al cargar
syncAuthUI();