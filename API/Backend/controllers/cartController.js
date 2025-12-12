const db = require("../config/db");
const jwt = require("jsonwebtoken");

exports.add = (req, res) => {
    const { producto_id, cantidad } = req.body;
    const decoded = jwt.verify(req.headers.authorization, process.env.JWT_SECRET);

    db.query("SELECT * FROM carrito WHERE usuario_id = ?", [decoded.id], (err, data) => {
        if (err) return res.status(500).json({ msg: "Error", err });

        let carrito_id;

        if (data.length === 0) {
            db.query("INSERT INTO carrito (usuario_id) VALUES (?)", [decoded.id], (err, result) => {
                if (err) return res.status(500).json({ msg: "Error", err });
                carrito_id = result.insertId;
                agregarItem(carrito_id);
            });
        } else {
            carrito_id = data[0].id;
            agregarItem(carrito_id);
        }
    });

    function agregarItem(id) {
        db.query(
            "INSERT INTO carrito_item (carrito_id, producto_id, cantidad) VALUES (?, ?, ?)",
            [id, producto_id, cantidad],
            (err) => {
                if (err) return res.status(500).json({ msg: "Error", err });
                res.json({ msg: "Agregado al carrito" });
            }
        );
    }
};

exports.getCart = (req, res) => {
    const decoded = jwt.verify(req.headers.authorization, process.env.JWT_SECRET);

    db.query(
        `SELECT ci.id, p.nombre, ci.cantidad, p.precio
         FROM carrito_item ci
         JOIN carrito c ON ci.carrito_id = c.id
         JOIN producto p ON ci.producto_id = p.id
         WHERE c.usuario_id = ?`,
        [decoded.id],
        (err, data) => {
            if (err) return res.status(500).json({ msg: "Error", err });
            res.json(data);
        }
    );
};

exports.empty = (req, res) => {
    const decoded = jwt.verify(req.headers.authorization, process.env.JWT_SECRET);

    db.query(
        `DELETE carrito_item FROM carrito_item
         JOIN carrito ON carrito_item.carrito_id = carrito.id
         WHERE carrito.usuario_id = ?`,
        [decoded.id],
        (err) => {
            if (err) return res.status(500).json({ msg: "Error", err });
            res.json({ msg: "Carrito vaciado" });
        }
    );
};
