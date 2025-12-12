const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const dbp = db.promise();

function passwordValida(pass) {
 
  return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(pass);
}

exports.register = async (req, res) => {
  try {
    const { nombre, correo, password, telefono } = req.body;

    if (!nombre || !correo || !password) {
      return res.status(400).json({ msg: "Todos los campos son obligatorios" }); 
    }

    if (!passwordValida(password)) {
      return res.status(400).json({
        msg: "Contraseña no válida. Debe tener mínimo 8 caracteres e incluir letras, números y símbolos.",
      });
    }

    const [exists] = await dbp.query(
      "SELECT id FROM usuario WHERE correo = ? LIMIT 1",
      [correo]
    );
    if (exists.length > 0) {
      return res.status(409).json({ msg: "Correo ya registrado" });
    }

    const hashed = bcrypt.hashSync(password, 10);

    if (telefono) {
      await dbp.query(
        "INSERT INTO usuario (nombre, correo, password, telefono) VALUES (?, ?, ?, ?)",
        [nombre, correo, hashed, telefono]
      );
    } else {
      await dbp.query(
        "INSERT INTO usuario (nombre, correo, password) VALUES (?, ?, ?)",
        [nombre, correo, hashed]
      );
    }

    return res.json({ msg: "Usuario registrado" });
  } catch (err) {
    return res.status(500).json({ msg: "Error", err });
  }
};

exports.login = async (req, res) => {
  try {
    const { correo, password } = req.body;

    const [data] = await dbp.query("SELECT * FROM usuario WHERE correo = ? LIMIT 1", [correo]);
    if (data.length === 0) return res.status(404).json({ msg: "Correo no registrado" }); 

    const user = data[0];
    const ok = bcrypt.compareSync(password, user.password);
    if (!ok) return res.status(400).json({ msg: "Contraseña incorrecta" });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);

    return res.json({ msg: "Bienvenido", token });
  } catch (err) {
    return res.status(500).json({ msg: "Error", err });
  }
};
