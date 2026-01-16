function requireAdmin(req, res, next) {
  const rol = String(req.user?.rol || req.user?.role || "").toLowerCase();
  if (rol !== "admin") {
    return res.status(403).json({ msg: "Acceso restringido: se requiere admin" });
  }
  return next();
}

module.exports = { requireAdmin };
