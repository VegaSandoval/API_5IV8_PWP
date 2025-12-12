const db = require("../config/db");
const jwt = require("jsonwebtoken");

function getUserId(req) {
  const header = req.headers.authorization;
  if (!header) return null;

  const token = header.startsWith("Bearer ") ? header.slice(7) : header;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id;
  } catch (_) {
    return null;
  }
}

exports.getProfile = (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ msg: "Falta token" });

  db.query(
    "SELECT id, nombre, correo, telefono FROM usuario WHERE id = ?",
    [userId],
    (err, data) => {
      if (err) return res.status(500).json({ msg: "Error", err });
      if (!data || data.length === 0) return res.status(404).json({ msg: "Usuario no encontrado" });
      return res.json(data[0]);
    }
  );
};

exports.updateProfile = (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ msg: "Falta token" });

  const { nombre, telefono } = req.body;
  if (!nombre) return res.status(400).json({ msg: "nombre requerido" });

  db.query(
    "UPDATE usuario SET nombre = ?, telefono = ? WHERE id = ?",
    [nombre, telefono || null, userId],
    (err) => {
      if (err) return res.status(500).json({ msg: "Error", err });
      return res.json({ msg: "Perfil actualizado" });
    }
  );
};
