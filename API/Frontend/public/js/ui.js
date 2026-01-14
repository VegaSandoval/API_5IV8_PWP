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
