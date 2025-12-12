const db = require("../config/db");
const jwt = require("jsonwebtoken");

exports.buy = (req, res) => {
    const decoded = jwt.verify(req.headers.authorization, process.env.JWT_SECRET);

    db.query(
        `SELECT ci.producto_id, ci.cantidad, p.precio 
         FROM carrito_item ci
         JOIN carrito c ON ci.carrito_id = c.id
         JOIN producto p ON ci.producto_id = p.id
         WHERE c.usuario_id = ?`,
        [decoded.id],
        (err, cart) => {
            if (err) return res.status(500).json({ msg: "Error", err });

            if (cart.length === 0)
                return res.status(400).json({ msg: "Carrito vacío" });

            const total = cart.reduce((acc, item) => acc + (item.cantidad * item.precio), 0);

            db.query(
                "INSERT INTO venta (usuario_id, total) VALUES (?, ?)",
                [decoded.id, total],
                (err, result) => {
                    if (err) return res.status(500).json({ msg: "Error", err });

                    const venta_id = result.insertId;

                    cart.forEach(item => {
                        db.query(
                            "INSERT INTO venta_detalle (venta_id, producto_id, cantidad, subtotal) VALUES (?, ?, ?, ?)",
                            [venta_id, item.producto_id, item.cantidad, item.cantidad * item.precio]
                        );
                    });

                    db.query(
                        `DELETE carrito_item 
                         FROM carrito_item 
                         JOIN carrito ON carrito_item.carrito_id = carrito.id
                         WHERE carrito.usuario_id = ?`,
                        [decoded.id]
                    );

                    res.json({ msg: "Compra realizada con éxito", total });
                }
            )
        }
    );
};
