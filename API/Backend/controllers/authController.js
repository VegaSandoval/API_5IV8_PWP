const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = (req, res) => {
    const { nombre, correo, password } = req.body;

    if (!nombre || !correo || !password)
        return res.status(400).json({ msg: "Todos los campos son obligatorios" });

    const hashed = bcrypt.hashSync(password, 10);

    db.query(
        "INSERT INTO usuario (nombre, correo, password) VALUES (?, ?, ?)",
        [nombre, correo, hashed],
        (err) => {
            if (err) return res.status(500).json({ msg: "Error", err });
            res.json({ msg: "Usuario registrado" });
        }
    );
};

exports.login = (req, res) => {
    const { correo, password } = req.body;

    db.query("SELECT * FROM usuario WHERE correo = ?", [correo], (err, data) => {
        if (err) return res.status(500).json({ msg: "Error", err });
        if (data.length === 0) return res.status(404).json({ msg: "No existe el usuario" });

        const user = data[0];

        const ok = bcrypt.compareSync(password, user.password);
        if (!ok) return res.status(400).json({ msg: "Contraseña incorrecta" });

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);

        res.json({ msg: "Bienvenido", token });
    });
};
