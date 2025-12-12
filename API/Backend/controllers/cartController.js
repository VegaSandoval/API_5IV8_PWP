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

exports.add = async (req, res) => {
  try {
    const userId = getUserId(req);

    let { producto_id, cantidad } = req.body;
    producto_id = parseInt(producto_id, 10);
    cantidad = parseInt(cantidad, 10);

    if (!producto_id || !Number.isInteger(producto_id)) {
      return res.status(400).json({ msg: "producto_id inválido" });
    }
    if (!cantidad || !Number.isInteger(cantidad) || cantidad <= 0) {
      return res.status(400).json({ msg: "cantidad inválida" });
    }

    const [prodRows] = await dbp.query(
      "SELECT id, stock FROM producto WHERE id = ?",
      [producto_id]
    );

    if (prodRows.length === 0) {
      return res.status(404).json({ msg: "Producto no encontrado" });
    }

    const stock = parseInt(prodRows[0].stock, 10);
    if (stock < cantidad) {
      return res.status(409).json({
        msg: "No hay stock suficiente",
        stock_disponible: stock,
        cantidad_solicitada: cantidad,
      });
    }

    const [cartRows] = await dbp.query(
      "SELECT id FROM carrito WHERE usuario_id = ? LIMIT 1",
      [userId]
    );

    let carritoId;
    if (cartRows.length === 0) {
      const [insertCart] = await dbp.query(
        "INSERT INTO carrito (usuario_id) VALUES (?)",
        [userId]
      );
      carritoId = insertCart.insertId;
    } else {
      carritoId = cartRows[0].id;
    }

    const [itemRows] = await dbp.query(
      "SELECT id, cantidad FROM carrito_item WHERE carrito_id = ? AND producto_id = ? LIMIT 1",
      [carritoId, producto_id]
    );

    if (itemRows.length > 0) {
      const itemId = itemRows[0].id;
      const actual = parseInt(itemRows[0].cantidad, 10);
      const nueva = actual + cantidad;

      if (nueva > stock) {
        return res.status(409).json({
          msg: "No hay stock suficiente",
          stock_disponible: stock,
          cantidad_actual_en_carrito: actual,
          cantidad_solicitada: cantidad,
          cantidad_resultante: nueva,
        });
      }

      await dbp.query("UPDATE carrito_item SET cantidad = ? WHERE id = ?", [
        nueva,
        itemId,
      ]);

      return res.json({ msg: "Cantidad actualizada en carrito", item_id: itemId, cantidad: nueva });
    }

    const [insertItem] = await dbp.query(
      "INSERT INTO carrito_item (carrito_id, producto_id, cantidad) VALUES (?, ?, ?)",
      [carritoId, producto_id, cantidad]
    );

    return res.json({ msg: "Agregado al carrito", item_id: insertItem.insertId, cantidad });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ msg: err.message || "Error", err });
  }
};

exports.getCart = async (req, res) => {
  try {
    const userId = getUserId(req);

    const [rows] = await dbp.query(
      `SELECT
          ci.id,
          p.id AS producto_id,
          p.nombre,
          p.imagen,
          ci.cantidad,
          p.precio,
          (ci.cantidad * p.precio) AS subtotal
       FROM carrito_item ci
       JOIN carrito c ON ci.carrito_id = c.id
       JOIN producto p ON ci.producto_id = p.id
       WHERE c.usuario_id = ?
       ORDER BY ci.id DESC`,
      [userId]
    );

    if (rows.length === 0) {
      return res.json({ msg: "Carrito vacío", items: [], total: 0 });
    }

    const total = rows.reduce((acc, it) => acc + Number(it.subtotal), 0);

    return res.json({ items: rows, total });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ msg: err.message || "Error", err });
  }
};

exports.updateQty = async (req, res) => {
  try {
    const userId = getUserId(req);

    const itemId = parseInt(req.params.itemId, 10);
    let { cantidad } = req.body;
    cantidad = parseInt(cantidad, 10);

    if (!itemId || !Number.isInteger(itemId)) {
      return res.status(400).json({ msg: "itemId inválido" });
    }
    if (!Number.isInteger(cantidad) || cantidad < 0) {
      return res.status(400).json({ msg: "cantidad inválida" });
    }

    if (cantidad === 0) {
      await exports.removeItem(req, res);
      return;
    }

    const [rows] = await dbp.query(
      `SELECT
          ci.id,
          ci.producto_id,
          p.stock
       FROM carrito_item ci
       JOIN carrito c ON ci.carrito_id = c.id
       JOIN producto p ON ci.producto_id = p.id
       WHERE ci.id = ? AND c.usuario_id = ?
       LIMIT 1`,
      [itemId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ msg: "Item no encontrado en tu carrito" });
    }

    const stock = parseInt(rows[0].stock, 10);

    let finalQty = cantidad;
    let ajustado = false;

    if (finalQty > stock) {
      finalQty = stock;
      ajustado = true;
    }

    await dbp.query("UPDATE carrito_item SET cantidad = ? WHERE id = ?", [
      finalQty,
      itemId,
    ]);

    return res.json({
      msg: ajustado ? "Cantidad ajustada al stock disponible" : "Cantidad actualizada",
      item_id: itemId,
      cantidad: finalQty,
      stock_disponible: stock,
      ajustado,
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ msg: err.message || "Error", err });
  }
};

exports.removeItem = async (req, res) => {
  try {
    const userId = getUserId(req);
    const itemId = parseInt(req.params.itemId, 10);

    if (!itemId || !Number.isInteger(itemId)) {
      return res.status(400).json({ msg: "itemId inválido" });
    }

    const [result] = await dbp.query(
      `DELETE ci FROM carrito_item ci
       JOIN carrito c ON ci.carrito_id = c.id
       WHERE ci.id = ? AND c.usuario_id = ?`,
      [itemId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ msg: "Item no encontrado en tu carrito" });
    }

    return res.json({ msg: "Producto eliminado del carrito" });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ msg: err.message || "Error", err });
  }
};


exports.empty = async (req, res) => {
  try {
    const userId = getUserId(req);

    await dbp.query(
      `DELETE carrito_item FROM carrito_item
       JOIN carrito ON carrito_item.carrito_id = carrito.id
       WHERE carrito.usuario_id = ?`,
      [userId]
    );

    return res.json({ msg: "Carrito vaciado" });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ msg: err.message || "Error", err });
  }
};
