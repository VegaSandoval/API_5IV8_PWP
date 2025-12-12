const token = localStorage.getItem("token");

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

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.removeItem("token");
  window.location.href = "/";
});

syncAuthUI();
