const API = "http://localhost:3000/api";

function authHeaders() {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function fetchJSON(url, opts={}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Error");
  return data;
}

async function loadProfile() {
  const token = localStorage.getItem("token");
  if (!token) return (window.location.href = "/login");

  const me = await fetchJSON(`${API}/user/profile`, { headers: authHeaders() });
  document.getElementById("nombre").value = me.nombre || "";
  document.getElementById("telefono").value = me.telefono || "";
}

document.getElementById("profileForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  await fetchJSON(`${API}/user/profile`, {
    method: "PUT",
    headers: { "Content-Type":"application/json", ...authHeaders() },
    body: JSON.stringify({
      nombre: document.getElementById("nombre").value,
      telefono: document.getElementById("telefono").value
    })
  });
  alert("Perfil actualizado ✅");
});

loadProfile().catch(() => {});
