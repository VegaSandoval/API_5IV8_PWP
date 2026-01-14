const { promisePool: dbp } = require("../config/db");


// Métodos de pago válidos
const METODOS_PAGO = ['efectivo', 'tarjeta', 'transferencia', 'paypal'];

// Estados de venta
const ESTADO_VENTA = {
  COMPLETADA: 'completada',
  CANCELADA: 'cancelada',
  PENDIENTE: 'pendiente'
};

// ============================================
// REALIZAR COMPRA
// ============================================

exports.buy = async (req, res) => {
  const connection = await dbp.getConnection();
  
  try {
    const userId = req.user.id; // Viene del middleware
    const { metodo_pago } = req.body;

    // 1. Validar método de pago
    if (!metodo_pago || !METODOS_PAGO.includes(metodo_pago.toLowerCase())) {
      return res.status(400).json({ 
        msg: "Método de pago inválido",
        metodos_validos: METODOS_PAGO
      });
    }

    // 2. Iniciar transacción
    await connection.beginTransaction();

    // 3. Obtener items del carrito con bloqueo (FOR UPDATE)
    const [cart] = await connection.query(
      `SELECT
          ci.id as item_id,
          ci.producto_id,
          ci.cantidad,
          p.nombre,
          p.precio,
          p.stock
       FROM carrito_item ci
       JOIN carrito c ON ci.carrito_id = c.id
       JOIN producto p ON ci.producto_id = p.id
       WHERE c.usuario_id = ?
       FOR UPDATE`,
      [userId]
    );

    // 4. Validar que el carrito no esté vacío
    if (cart.length === 0) {
      await connection.rollback();
      return res.status(400).json({ msg: "Tu carrito está vacío" });
    }

    // 5. Validar stock de todos los productos
    const productosProblema = [];
    
    for (const item of cart) {
      const stock = parseInt(item.stock, 10);
      const cantidad = parseInt(item.cantidad, 10);
      
      if (stock < cantidad) {
        productosProblema.push({
          producto_id: item.producto_id,
          nombre: item.nombre,
          stock_disponible: stock,
          cantidad_solicitada: cantidad,
          diferencia: cantidad - stock
        });
      }
    }

    if (productosProblema.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        msg: "Algunos productos no tienen stock suficiente",
        productos_sin_stock: productosProblema
      });
    }

    // 6. Calcular total
    let total = 0;
    const itemsCompra = [];

    for (const item of cart) {
      const precio = parseFloat(item.precio);
      const cantidad = parseInt(item.cantidad, 10);
      const subtotal = precio * cantidad;
      
      total += subtotal;
      
      itemsCompra.push({
        producto_id: item.producto_id,
        nombre: item.nombre,
        cantidad: cantidad,
        precio_unitario: precio,
        subtotal: subtotal
      });
    }

    // 7. Crear registro de venta
    const [ventaRes] = await connection.query(
      `INSERT INTO venta (usuario_id, total, metodo_pago, estado) 
       VALUES (?, ?, ?, ?)`,
      [userId, total, metodo_pago.toLowerCase(), ESTADO_VENTA.COMPLETADA]
    );
    
    const ventaId = ventaRes.insertId;

    // 8. Insertar detalles de la venta
    const detallesValues = cart.map(item => [
      ventaId,
      item.producto_id,
      parseInt(item.cantidad, 10),
      parseFloat(item.precio),
      parseFloat(item.precio) * parseInt(item.cantidad, 10)
    ]);

    await connection.query(
      `INSERT INTO venta_detalle 
       (venta_id, producto_id, cantidad, precio_unitario, subtotal) 
       VALUES ?`,
      [detallesValues]
    );

    // 9. Actualizar stock de productos (forma segura)
    for (const item of cart) {
      await connection.query(
        `UPDATE producto 
         SET stock = stock - ? 
         WHERE id = ? AND stock >= ?`,
        [item.cantidad, item.producto_id, item.cantidad]
      );
    }

    // 10. Vaciar el carrito
    await connection.query(
      `DELETE carrito_item
       FROM carrito_item
       JOIN carrito ON carrito_item.carrito_id = carrito.id
       WHERE carrito.usuario_id = ?`,
      [userId]
    );

    // 11. Commit de la transacción
    await connection.commit();

    // 12. Obtener datos completos de la venta para respuesta
    const [ventaCompleta] = await dbp.query(
      `SELECT 
         v.id,
         v.total,
         v.metodo_pago,
         v.estado,
         v.fecha,
         u.nombre as cliente_nombre,
         u.correo as cliente_correo
       FROM venta v
       JOIN usuario u ON v.usuario_id = u.id
       WHERE v.id = ?`,
      [ventaId]
    );

    return res.status(201).json({ 
      msg: "¡Compra realizada con éxito!",
      venta: {
        id: ventaId,
        total: parseFloat(total).toFixed(2),
        metodo_pago: metodo_pago.toLowerCase(),
        estado: ESTADO_VENTA.COMPLETADA,
        fecha: ventaCompleta[0].fecha,
        items: itemsCompra
      },
      resumen: {
        total_items: itemsCompra.length,
        total_productos: itemsCompra.reduce((sum, i) => sum + i.cantidad, 0)
      }
    });

  } catch (err) {
    try {
      await connection.rollback();
    } catch (rollbackErr) {
      console.error("Error al hacer rollback:", rollbackErr);
    }
    
    console.error("Error en buy:", err);
    
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: "Token inválido o expirado" });
    }
    
    return res.status(500).json({ 
      msg: "Error al procesar la compra",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    connection.release();
  }
};

// ============================================
// HISTORIAL DE COMPRAS DEL USUARIO
// ============================================

exports.getHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    // Paginación
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    // 1. Obtener total de compras
    const [countResult] = await dbp.query(
      "SELECT COUNT(*) as total FROM venta WHERE usuario_id = ?",
      [userId]
    );
    const total = countResult[0].total;

    // 2. Obtener ventas con paginación
    const [ventas] = await dbp.query(
      `SELECT 
         id,
         total,
         metodo_pago,
         estado,
         fecha
       FROM venta
       WHERE usuario_id = ?
       ORDER BY fecha DESC
       LIMIT ? OFFSET ?`,
      [userId, limitNum, offset]
    );

    if (ventas.length === 0) {
      return res.json({
        msg: "No tienes compras registradas",
        compras: [],
        paginacion: {
          pagina_actual: pageNum,
          total_paginas: 0,
          total_compras: 0
        }
      });
    }

    // 3. Obtener detalles de cada venta
    const ventasConDetalles = await Promise.all(
      ventas.map(async (venta) => {
        const [detalles] = await dbp.query(
          `SELECT 
             vd.producto_id,
             vd.cantidad,
             vd.precio_unitario,
             vd.subtotal,
             p.nombre,
             p.imagen
           FROM venta_detalle vd
           LEFT JOIN producto p ON vd.producto_id = p.id
           WHERE vd.venta_id = ?`,
          [venta.id]
        );

        return {
          id: venta.id,
          fecha: venta.fecha,
          total: parseFloat(venta.total).toFixed(2),
          metodo_pago: venta.metodo_pago,
          estado: venta.estado,
          items: detalles.map(d => ({
            producto_id: d.producto_id,
            nombre: d.nombre || 'Producto no disponible',
            imagen: d.imagen,
            cantidad: d.cantidad,
            precio_unitario: parseFloat(d.precio_unitario).toFixed(2),
            subtotal: parseFloat(d.subtotal).toFixed(2)
          })),
          total_items: detalles.length
        };
      })
    );

    const totalPages = Math.ceil(total / limitNum);

    return res.json({
      compras: ventasConDetalles,
      paginacion: {
        pagina_actual: pageNum,
        total_paginas: totalPages,
        total_compras: total,
        compras_por_pagina: limitNum,
        tiene_siguiente: pageNum < totalPages,
        tiene_anterior: pageNum > 1
      }
    });

  } catch (err) {
    console.error("Error en getHistory:", err);
    
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: "Token inválido o expirado" });
    }
    
    return res.status(500).json({ 
      msg: "Error al obtener historial de compras",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// DETALLE DE UNA COMPRA ESPECÍFICA
// ============================================

exports.getOne = async (req, res) => {
  try {
    const userId = req.user.id;
    const ventaId = parseInt(req.params.id, 10);

    // Validar ID
    if (!ventaId || !Number.isInteger(ventaId) || ventaId <= 0) {
      return res.status(400).json({ msg: "ID de venta inválido" });
    }

    // 1. Obtener venta (verificar que pertenezca al usuario)
    const [ventas] = await dbp.query(
      `SELECT 
         v.id,
         v.total,
         v.metodo_pago,
         v.estado,
         v.fecha,
         u.nombre as cliente_nombre,
         u.correo as cliente_correo,
         u.telefono as cliente_telefono
       FROM venta v
       JOIN usuario u ON v.usuario_id = u.id
       WHERE v.id = ? AND v.usuario_id = ?
       LIMIT 1`,
      [ventaId, userId]
    );

    if (ventas.length === 0) {
      return res.status(404).json({ 
        msg: "Compra no encontrada o no tienes acceso a ella" 
      });
    }

    const venta = ventas[0];

    // 2. Obtener detalles de la venta
    const [detalles] = await dbp.query(
      `SELECT 
         vd.producto_id,
         vd.cantidad,
         vd.precio_unitario,
         vd.subtotal,
         p.nombre,
         p.imagen,
         p.descripcion
       FROM venta_detalle vd
       LEFT JOIN producto p ON vd.producto_id = p.id
       WHERE vd.venta_id = ?`,
      [ventaId]
    );

    return res.json({
      id: venta.id,
      fecha: venta.fecha,
      total: parseFloat(venta.total).toFixed(2),
      metodo_pago: venta.metodo_pago,
      estado: venta.estado,
      cliente: {
        nombre: venta.cliente_nombre,
        correo: venta.cliente_correo,
        telefono: venta.cliente_telefono
      },
      items: detalles.map(d => ({
        producto_id: d.producto_id,
        nombre: d.nombre || 'Producto no disponible',
        descripcion: d.descripcion,
        imagen: d.imagen,
        cantidad: d.cantidad,
        precio_unitario: parseFloat(d.precio_unitario).toFixed(2),
        subtotal: parseFloat(d.subtotal).toFixed(2)
      })),
      resumen: {
        total_items: detalles.length,
        total_productos: detalles.reduce((sum, d) => sum + d.cantidad, 0)
      }
    });

  } catch (err) {
    console.error("Error en getOne:", err);
    
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: "Token inválido o expirado" });
    }
    
    return res.status(500).json({ 
      msg: "Error al obtener detalle de compra",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// ESTADÍSTICAS DE COMPRAS DEL USUARIO
// ============================================

exports.getStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Estadísticas generales
    const [stats] = await dbp.query(
      `SELECT 
         COUNT(*) as total_compras,
         COALESCE(SUM(total), 0) as total_gastado,
         COALESCE(AVG(total), 0) as promedio_compra,
         MAX(fecha) as ultima_compra
       FROM venta
       WHERE usuario_id = ?`,
      [userId]
    );

    // Productos más comprados
    const [topProductos] = await dbp.query(
      `SELECT 
         p.id,
         p.nombre,
         p.imagen,
         SUM(vd.cantidad) as veces_comprado,
         SUM(vd.subtotal) as total_gastado
       FROM venta_detalle vd
       JOIN venta v ON vd.venta_id = v.id
       LEFT JOIN producto p ON vd.producto_id = p.id
       WHERE v.usuario_id = ?
       GROUP BY vd.producto_id
       ORDER BY veces_comprado DESC
       LIMIT 5`,
      [userId]
    );

    // Métodos de pago más usados
    const [metodosPago] = await dbp.query(
      `SELECT 
         metodo_pago,
         COUNT(*) as veces_usado,
         SUM(total) as total_gastado
       FROM venta
       WHERE usuario_id = ?
       GROUP BY metodo_pago
       ORDER BY veces_usado DESC`,
      [userId]
    );

    return res.json({
      estadisticas_generales: {
        total_compras: stats[0].total_compras,
        total_gastado: parseFloat(stats[0].total_gastado).toFixed(2),
        promedio_compra: parseFloat(stats[0].promedio_compra).toFixed(2),
        ultima_compra: stats[0].ultima_compra
      },
      productos_mas_comprados: topProductos.map(p => ({
        id: p.id,
        nombre: p.nombre || 'Producto no disponible',
        imagen: p.imagen,
        veces_comprado: p.veces_comprado,
        total_gastado: parseFloat(p.total_gastado).toFixed(2)
      })),
      metodos_pago: metodosPago.map(m => ({
        metodo: m.metodo_pago,
        veces_usado: m.veces_usado,
        total_gastado: parseFloat(m.total_gastado).toFixed(2)
      }))
    });

  } catch (err) {
    console.error("Error en getStats:", err);
    
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: "Token inválido o expirado" });
    }
    
    return res.status(500).json({ 
      msg: "Error al obtener estadísticas",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// MÉTODOS DE PAGO DISPONIBLES
// ============================================

exports.getMetodosPago = (req, res) => {
  return res.json({
    metodos_disponibles: METODOS_PAGO.map(metodo => ({
      id: metodo,
      nombre: metodo.charAt(0).toUpperCase() + metodo.slice(1)
    }))
  });
};