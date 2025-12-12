const db = require("../config/db");
const jwt = require("jsonwebtoken");

exports.getProfile = (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ msg: "Falta token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    db.query(
        "SELECT id, nombre, correo, telefono FROM usuario WHERE id = ?",
        [decoded.id],
        (err, data) => {
            if (err) return res.status(500).json({ msg: "Error", err });
            res.json(data[0]);
        }
    );
};

exports.updateProfile = (req, res) => {
    const token = req.headers.authorization;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { nombre, telefono } = req.body;

    db.query(
        "UPDATE usuario SET nombre = ?, telefono = ? WHERE id = ?",
        [nombre, telefono, decoded.id],
        (err) => {
            if (err) return res.status(500).json({ msg: "Error", err });
            res.json({ msg: "Perfil actualizado" });
        }
    );
};
