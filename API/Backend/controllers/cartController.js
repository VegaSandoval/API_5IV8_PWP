const db = require("../config/db");
const dbp = db.promise();

// Límites y configuración
const MAX_CANTIDAD_POR_PRODUCTO = 999;
const MIN_CANTIDAD = 1;

// ============================================
// AGREGAR AL CARRITO
// ============================================

exports.add = async (req, res) => {
  const connection = await dbp.getConnection();
  
  try {
    const userId = req.user.id; // Viene del middleware de autenticación

    let { producto_id, cantidad } = req.body;
    producto_id = parseInt(producto_id, 10);
    cantidad = parseInt(cantidad, 10);

    // 1. Validar parámetros
    if (!producto_id || !Number.isInteger(producto_id) || producto_id <= 0) {
      return res.status(400).json({ msg: "producto_id inválido" });
    }
    
    if (!cantidad || !Number.isInteger(cantidad) || cantidad < MIN_CANTIDAD) {
      return res.status(400).json({ 
        msg: `La cantidad debe ser al menos ${MIN_CANTIDAD}` 
      });
    }

    if (cantidad > MAX_CANTIDAD_POR_PRODUCTO) {
      return res.status(400).json({ 
        msg: `La cantidad máxima por producto es ${MAX_CANTIDAD_POR_PRODUCTO}` 
      });
    }

    // 2. Iniciar transacción
    await connection.beginTransaction();

    // 3. Verificar que el producto exista y obtener stock (con bloqueo)
    const [prodRows] = await connection.query(
      "SELECT id, nombre, precio, stock FROM producto WHERE id = ? FOR UPDATE",
      [producto_id]
    );

    if (prodRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ msg: "Producto no encontrado" });
    }

    const producto = prodRows[0];
    const stockDisponible = parseInt(producto.stock, 10);

    // 4. Obtener o crear carrito
    const [cartRows] = await connection.query(
      "SELECT id FROM carrito WHERE usuario_id = ? LIMIT 1",
      [userId]
    );

    let carritoId;
    if (cartRows.length === 0) {
      const [insertCart] = await connection.query(
        "INSERT INTO carrito (usuario_id) VALUES (?)",
        [userId]
      );
      carritoId = insertCart.insertId;
    } else {
      carritoId = cartRows[0].id;
    }

    // 5. Verificar si el producto ya está en el carrito
    const [itemRows] = await connection.query(
      "SELECT id, cantidad FROM carrito_item WHERE carrito_id = ? AND producto_id = ? LIMIT 1",
      [carritoId, producto_id]
    );

    let cantidadFinal;
    let itemId;
    let esActualizacion = false;

    if (itemRows.length > 0) {
      // Producto ya existe, actualizar cantidad
      esActualizacion = true;
      itemId = itemRows[0].id;
      const cantidadActual = parseInt(itemRows[0].cantidad, 10);
      cantidadFinal = cantidadActual + cantidad;

      // Validar límite máximo
      if (cantidadFinal > MAX_CANTIDAD_POR_PRODUCTO) {
        await connection.rollback();
        return res.status(400).json({
          msg: `La cantidad total no puede superar ${MAX_CANTIDAD_POR_PRODUCTO} unidades`,
          cantidad_actual: cantidadActual,
          cantidad_solicitada: cantidad,
          cantidad_maxima: MAX_CANTIDAD_POR_PRODUCTO
        });
      }

      // Validar stock disponible
      if (cantidadFinal > stockDisponible) {
        await connection.rollback();
        return res.status(409).json({
          msg: "No hay stock suficiente",
          stock_disponible: stockDisponible,
          cantidad_actual_en_carrito: cantidadActual,
          cantidad_solicitada: cantidad,
          cantidad_resultante: cantidadFinal
        });
      }

      await connection.query(
        "UPDATE carrito_item SET cantidad = ?, actualizado = NOW() WHERE id = ?",
        [cantidadFinal, itemId]
      );

    } else {
      // Producto nuevo, validar stock
      cantidadFinal = cantidad;

      if (cantidadFinal > stockDisponible) {
        await connection.rollback();
        return res.status(409).json({
          msg: "No hay stock suficiente",
          stock_disponible: stockDisponible,
          cantidad_solicitada: cantidad
        });
      }

      const [insertItem] = await connection.query(
        "INSERT INTO carrito_item (carrito_id, producto_id, cantidad) VALUES (?, ?, ?)",
        [carritoId, producto_id, cantidadFinal]
      );
      itemId = insertItem.insertId;
    }

    // 6. Commit de la transacción
    await connection.commit();

    // 7. Calcular subtotal
    const subtotal = parseFloat(producto.precio) * cantidadFinal;

    return res.json({ 
      msg: esActualizacion ? "Cantidad actualizada en el carrito" : "Producto agregado al carrito",
      item: {
        id: itemId,
        producto_id: producto_id,
        nombre: producto.nombre,
        cantidad: cantidadFinal,
        precio: parseFloat(producto.precio),
        subtotal: subtotal.toFixed(2)
      }
    });

  } catch (err) {
    try {
      await connection.rollback();
    } catch (rollbackErr) {
      console.error("Error al hacer rollback:", rollbackErr);
    }
    
    console.error("Error en add:", err);
    
    // Manejar error de token JWT
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: "Token inválido o expirado" });
    }
    
    return res.status(500).json({ 
      msg: "Error al agregar al carrito",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    connection.release();
  }
};

// ============================================
// OBTENER CARRITO
// ============================================

exports.getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await dbp.query(
      `SELECT
          ci.id,
          ci.producto_id,
          p.nombre,
          p.imagen,
          p.precio,
          p.stock,
          ci.cantidad,
          (ci.cantidad * p.precio) AS subtotal
       FROM carrito_item ci
       JOIN carrito c ON ci.carrito_id = c.id
       JOIN producto p ON ci.producto_id = p.id
       WHERE c.usuario_id = ?
       ORDER BY ci.actualizado DESC, ci.id DESC`,
      [userId]
    );

    if (rows.length === 0) {
      return res.json({ 
        msg: "Carrito vacío", 
        items: [], 
        total: 0,
        cantidad_items: 0
      });
    }

    // Calcular totales y validar stock
    let total = 0;
    const items = rows.map(item => {
      const cantidad = parseInt(item.cantidad, 10);
      const precio = parseFloat(item.precio);
      const stock = parseInt(item.stock, 10);
      const subtotal = cantidad * precio;
      
      total += subtotal;

      return {
        id: item.id,
        producto_id: item.producto_id,
        nombre: item.nombre,
        imagen: item.imagen,
        precio: precio.toFixed(2),
        cantidad: cantidad,
        stock_disponible: stock,
        subtotal: subtotal.toFixed(2),
        stock_suficiente: cantidad <= stock
      };
    });

    return res.json({ 
      items,
      total: total.toFixed(2),
      cantidad_items: items.length,
      productos_sin_stock: items.filter(i => !i.stock_suficiente).length
    });

  } catch (err) {
    console.error("Error en getCart:", err);
    
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: "Token inválido o expirado" });
    }
    
    return res.status(500).json({ 
      msg: "Error al obtener carrito",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// ACTUALIZAR CANTIDAD
// ============================================

exports.updateQty = async (req, res) => {
  const connection = await dbp.getConnection();
  
  try {
    const userId = req.user.id;
    const itemId = parseInt(req.params.itemId, 10);
    let { cantidad } = req.body;
    cantidad = parseInt(cantidad, 10);

    // 1. Validar parámetros
    if (!itemId || !Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ msg: "itemId inválido" });
    }
    
    if (!Number.isInteger(cantidad) || cantidad < 0) {
      return res.status(400).json({ msg: "cantidad inválida" });
    }

    // 2. Si cantidad es 0, eliminar el item
    if (cantidad === 0) {
      return await exports.removeItem(req, res);
    }

    // 3. Validar límite máximo
    if (cantidad > MAX_CANTIDAD_POR_PRODUCTO) {
      return res.status(400).json({ 
        msg: `La cantidad máxima por producto es ${MAX_CANTIDAD_POR_PRODUCTO}` 
      });
    }

    // 4. Iniciar transacción
    await connection.beginTransaction();

    // 5. Verificar que el item pertenezca al usuario y obtener datos
    const [rows] = await connection.query(
      `SELECT
          ci.id,
          ci.producto_id,
          p.nombre,
          p.precio,
          p.stock
       FROM carrito_item ci
       JOIN carrito c ON ci.carrito_id = c.id
       JOIN producto p ON ci.producto_id = p.id
       WHERE ci.id = ? AND c.usuario_id = ?
       LIMIT 1
       FOR UPDATE`,
      [itemId, userId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ msg: "Producto no encontrado en tu carrito" });
    }

    const item = rows[0];
    const stockDisponible = parseInt(item.stock, 10);
    let cantidadFinal = cantidad;
    let ajustado = false;

    // 6. Validar stock y ajustar si es necesario
    if (cantidadFinal > stockDisponible) {
      cantidadFinal = stockDisponible;
      ajustado = true;
      
      if (cantidadFinal === 0) {
        // No hay stock, eliminar el item
        await connection.query(
          "DELETE FROM carrito_item WHERE id = ?",
          [itemId]
        );
        await connection.commit();
        
        return res.json({
          msg: "Producto eliminado del carrito (sin stock disponible)",
          item_eliminado: true,
          stock_disponible: 0
        });
      }
    }

    // 7. Actualizar cantidad
    await connection.query(
      "UPDATE carrito_item SET cantidad = ?, actualizado = NOW() WHERE id = ?",
      [cantidadFinal, itemId]
    );

    await connection.commit();

    // 8. Calcular subtotal
    const subtotal = parseFloat(item.precio) * cantidadFinal;

    return res.json({
      msg: ajustado ? "Cantidad ajustada al stock disponible" : "Cantidad actualizada",
      item: {
        id: itemId,
        producto_id: item.producto_id,
        nombre: item.nombre,
        cantidad: cantidadFinal,
        precio: parseFloat(item.precio).toFixed(2),
        subtotal: subtotal.toFixed(2),
        stock_disponible: stockDisponible
      },
      ajustado
    });

  } catch (err) {
    try {
      await connection.rollback();
    } catch (rollbackErr) {
      console.error("Error al hacer rollback:", rollbackErr);
    }
    
    console.error("Error en updateQty:", err);
    
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: "Token inválido o expirado" });
    }
    
    return res.status(500).json({ 
      msg: "Error al actualizar cantidad",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    connection.release();
  }
};

// ============================================
// ELIMINAR ITEM
// ============================================

exports.removeItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const itemId = parseInt(req.params.itemId, 10);

    if (!itemId || !Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ msg: "itemId inválido" });
    }

    const [result] = await dbp.query(
      `DELETE ci FROM carrito_item ci
       JOIN carrito c ON ci.carrito_id = c.id
       WHERE ci.id = ? AND c.usuario_id = ?`,
      [itemId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ msg: "Producto no encontrado en tu carrito" });
    }

    return res.json({ 
      msg: "Producto eliminado del carrito",
      item_id: itemId
    });

  } catch (err) {
    console.error("Error en removeItem:", err);
    
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: "Token inválido o expirado" });
    }
    
    return res.status(500).json({ 
      msg: "Error al eliminar producto",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// VACIAR CARRITO
// ============================================

exports.empty = async (req, res) => {
  try {
    const userId = req.user.id;

    const [result] = await dbp.query(
      `DELETE carrito_item FROM carrito_item
       JOIN carrito ON carrito_item.carrito_id = carrito.id
       WHERE carrito.usuario_id = ?`,
      [userId]
    );

    return res.json({ 
      msg: "Carrito vaciado",
      items_eliminados: result.affectedRows
    });

  } catch (err) {
    console.error("Error en empty:", err);
    
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: "Token inválido o expirado" });
    }
    
    return res.status(500).json({ 
      msg: "Error al vaciar carrito",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// VALIDAR CARRITO ANTES DE COMPRA
// ============================================

exports.validate = async (req, res) => {
  try {
    const userId = req.user.id;

    const [items] = await dbp.query(
      `SELECT
          ci.id,
          ci.producto_id,
          p.nombre,
          ci.cantidad,
          p.stock,
          p.precio
       FROM carrito_item ci
       JOIN carrito c ON ci.carrito_id = c.id
       JOIN producto p ON ci.producto_id = p.id
       WHERE c.usuario_id = ?`,
      [userId]
    );

    if (items.length === 0) {
      return res.status(400).json({ 
        msg: "Carrito vacío",
        valido: false
      });
    }

    const problemas = [];
    let total = 0;

    items.forEach(item => {
      const cantidad = parseInt(item.cantidad, 10);
      const stock = parseInt(item.stock, 10);
      const precio = parseFloat(item.precio);

      if (cantidad > stock) {
        problemas.push({
          producto_id: item.producto_id,
          nombre: item.nombre,
          cantidad_solicitada: cantidad,
          stock_disponible: stock,
          diferencia: cantidad - stock
        });
      }

      total += cantidad * precio;
    });

    if (problemas.length > 0) {
      return res.status(409).json({
        msg: "Algunos productos no tienen stock suficiente",
        valido: false,
        problemas
      });
    }

    return res.json({
      msg: "Carrito válido para compra",
      valido: true,
      total: total.toFixed(2),
      cantidad_items: items.length
    });

  } catch (err) {
    console.error("Error en validate:", err);
    
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: "Token inválido o expirado" });
    }
    
    return res.status(500).json({ 
      msg: "Error al validar carrito",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};