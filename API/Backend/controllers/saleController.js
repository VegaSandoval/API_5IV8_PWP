const db = require("../config/db");
const jwt = require("jsonwebtoken");

const dbp = db.promise();

function getUserId(req) {
  const header = req.headers.authorization;
  if (!header) {
    const e = new Error("Falta token");
    e.status = 401;
    throw e;
  }
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded.id;
}

exports.buy = async (req, res) => {
  let userId;
  try {
    userId = getUserId(req);

    await dbp.beginTransaction();

    const [cart] = await dbp.query(
      `SELECT
          ci.producto_id,
          ci.cantidad,
          p.precio,
          p.stock
       FROM carrito_item ci
       JOIN carrito c ON ci.carrito_id = c.id
       JOIN producto p ON ci.producto_id = p.id
       WHERE c.usuario_id = ?
       FOR UPDATE`,
      [userId]
    );

    if (cart.length === 0) {
      await dbp.rollback();
      return res.status(400).json({ msg: "Carrito vacío" });
    }

    const sinStock = cart.find((it) => parseInt(it.stock, 10) < parseInt(it.cantidad, 10));
    if (sinStock) {
      await dbp.rollback();
      return res.status(409).json({
        msg: "Stock agotado durante proceso",
        producto_id: sinStock.producto_id,
        stock_disponible: parseInt(sinStock.stock, 10),
        cantidad_en_carrito: parseInt(sinStock.cantidad, 10),
      });
    }

    const total = cart.reduce(
      (acc, it) => acc + (Number(it.precio) * Number(it.cantidad)),
      0
    );

    const [ventaRes] = await dbp.query(
      "INSERT INTO venta (usuario_id, total) VALUES (?, ?)",
      [userId, total]
    );
    const venta_id = ventaRes.insertId;

    const values = cart.map((it) => [
      venta_id,
      it.producto_id,
      it.cantidad,
      Number(it.precio) * Number(it.cantidad),
    ]);

    await dbp.query(
      "INSERT INTO venta_detalle (venta_id, producto_id, cantidad, subtotal) VALUES ?",
      [values]
    );

    const ids = cart.map((it) => it.producto_id);
    const caseSql = cart.map(() => "WHEN ? THEN ?").join(" ");
    const params = [];

    cart.forEach((it) => {
      params.push(it.producto_id, it.cantidad);
    });

    const inSql = ids.map(() => "?").join(",");
    params.push(...ids);

    await dbp.query(
      `UPDATE producto
       SET stock = stock - (CASE id ${caseSql} ELSE 0 END)
       WHERE id IN (${inSql})`,
      params
    );

    await dbp.query(
      `DELETE carrito_item
       FROM carrito_item
       JOIN carrito ON carrito_item.carrito_id = carrito.id
       WHERE carrito.usuario_id = ?`,
      [userId]
    );

    await dbp.commit();

    return res.json({ msg: "Compra realizada con éxito.", venta_id, total });
  } catch (err) {
    try {
      await dbp.rollback();
    } catch (_) {}
    const status = err.status || 500;
    return res.status(status).json({ msg: err.message || "Error", err });
  }
};
