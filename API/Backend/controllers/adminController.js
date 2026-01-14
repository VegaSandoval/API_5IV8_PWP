const { promisePool: dbp } = require("../config/db");


// ============================================
// GESTIÓN DE PRODUCTOS
// ============================================

// CREAR PRODUCTO
exports.createProduct = async (req, res) => {
  try {
    const {
      nombre,
      descripcion,
      precio,
      categoria,
      color,
      stock,
      imagen
    } = req.body;

    // 1. Validar campos obligatorios
    if (!nombre || !precio || !stock) {
      return res.status(400).json({
        msg: "Campos obligatorios: nombre, precio, stock"
      });
    }

    // 2. Validar tipos de datos
    const precioNum = parseFloat(precio);
    const stockNum = parseInt(stock, 10);

    if (isNaN(precioNum) || precioNum < 0) {
      return res.status(400).json({ msg: "Precio inválido" });
    }

    if (isNaN(stockNum) || stockNum < 0) {
      return res.status(400).json({ msg: "Stock inválido" });
    }

    // 3. Insertar producto
    const [result] = await dbp.query(
      `INSERT INTO producto 
       (nombre, descripcion, precio, categoria, color, stock, imagen) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre.trim(),
        descripcion?.trim() || null,
        precioNum,
        categoria?.trim() || null,
        color?.trim() || null,
        stockNum,
        imagen?.trim() || null
      ]
    );

    // 4. Obtener el producto creado
    const [producto] = await dbp.query(
      "SELECT * FROM producto WHERE id = ?",
      [result.insertId]
    );

    return res.status(201).json({
      msg: "Producto creado exitosamente",
      producto: {
        ...producto[0],
        precio: parseFloat(producto[0].precio).toFixed(2),
        stock: parseInt(producto[0].stock, 10)
      }
    });

  } catch (err) {
    console.error("Error en createProduct:", err);
    return res.status(500).json({
      msg: "Error al crear producto",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ACTUALIZAR PRODUCTO
exports.updateProduct = async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const { nombre, descripcion, precio, categoria, color, stock, imagen } = req.body;

    // 1. Validar ID
    if (!productId || !Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ msg: "ID de producto inválido" });
    }

    // 2. Verificar que el producto existe
    const [exists] = await dbp.query(
      "SELECT id FROM producto WHERE id = ? LIMIT 1",
      [productId]
    );

    if (exists.length === 0) {
      return res.status(404).json({ msg: "Producto no encontrado" });
    }

    // 3. Construir query dinámicamente (solo actualiza campos enviados)
    const updates = [];
    const params = [];

    if (nombre !== undefined) {
      if (!nombre.trim()) {
        return res.status(400).json({ msg: "El nombre no puede estar vacío" });
      }
      updates.push("nombre = ?");
      params.push(nombre.trim());
    }

    if (descripcion !== undefined) {
      updates.push("descripcion = ?");
      params.push(descripcion?.trim() || null);
    }

    if (precio !== undefined) {
      const precioNum = parseFloat(precio);
      if (isNaN(precioNum) || precioNum < 0) {
        return res.status(400).json({ msg: "Precio inválido" });
      }
      updates.push("precio = ?");
      params.push(precioNum);
    }

    if (categoria !== undefined) {
      updates.push("categoria = ?");
      params.push(categoria?.trim() || null);
    }

    if (color !== undefined) {
      updates.push("color = ?");
      params.push(color?.trim() || null);
    }

    if (stock !== undefined) {
      const stockNum = parseInt(stock, 10);
      if (isNaN(stockNum) || stockNum < 0) {
        return res.status(400).json({ msg: "Stock inválido" });
      }
      updates.push("stock = ?");
      params.push(stockNum);
    }

    if (imagen !== undefined) {
      updates.push("imagen = ?");
      params.push(imagen?.trim() || null);
    }

    // 4. Verificar que hay algo que actualizar
    if (updates.length === 0) {
      return res.status(400).json({
        msg: "Debes proporcionar al menos un campo para actualizar"
      });
    }

    // 5. Agregar ID al final de params
    params.push(productId);

    // 6. Ejecutar actualización
    await dbp.query(
      `UPDATE producto SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    // 7. Obtener producto actualizado
    const [updated] = await dbp.query(
      "SELECT * FROM producto WHERE id = ?",
      [productId]
    );

    return res.json({
      msg: "Producto actualizado exitosamente",
      producto: {
        ...updated[0],
        precio: parseFloat(updated[0].precio).toFixed(2),
        stock: parseInt(updated[0].stock, 10)
      }
    });

  } catch (err) {
    console.error("Error en updateProduct:", err);
    return res.status(500).json({
      msg: "Error al actualizar producto",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ELIMINAR PRODUCTO
exports.deleteProduct = async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);

    // 1. Validar ID
    if (!productId || !Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ msg: "ID de producto inválido" });
    }

    // 2. Verificar si el producto está en carritos activos
    const [inCart] = await dbp.query(
      "SELECT COUNT(*) as cantidad FROM carrito_item WHERE producto_id = ?",
      [productId]
    );

    if (inCart[0].cantidad > 0) {
      return res.status(409).json({
        msg: "No se puede eliminar. El producto está en carritos de compra.",
        carritos_activos: inCart[0].cantidad
      });
    }

    // 3. Verificar si el producto existe
    const [result] = await dbp.query(
      "DELETE FROM producto WHERE id = ?",
      [productId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ msg: "Producto no encontrado" });
    }

    return res.json({
      msg: "Producto eliminado exitosamente",
      producto_id: productId
    });

  } catch (err) {
    console.error("Error en deleteProduct:", err);
    
    // Error de Foreign Key (producto en ventas históricas)
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        msg: "No se puede eliminar. El producto tiene historial de ventas."
      });
    }

    return res.status(500).json({
      msg: "Error al eliminar producto",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ACTUALIZAR SOLO EL STOCK
exports.updateStock = async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const { cantidad, operacion } = req.body; // operacion: 'sumar', 'restar', 'establecer'

    // 1. Validar parámetros
    if (!productId || !Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ msg: "ID de producto inválido" });
    }

    const cantidadNum = parseInt(cantidad, 10);
    if (isNaN(cantidadNum) || cantidadNum < 0) {
      return res.status(400).json({ msg: "Cantidad inválida" });
    }

    const operacionesValidas = ['sumar', 'restar', 'establecer'];
    if (!operacion || !operacionesValidas.includes(operacion)) {
      return res.status(400).json({
        msg: "Operación inválida",
        operaciones_validas: operacionesValidas
      });
    }

    // 2. Obtener stock actual
    const [producto] = await dbp.query(
      "SELECT id, nombre, stock FROM producto WHERE id = ? LIMIT 1",
      [productId]
    );

    if (producto.length === 0) {
      return res.status(404).json({ msg: "Producto no encontrado" });
    }

    const stockActual = parseInt(producto[0].stock, 10);
    let nuevoStock;

    // 3. Calcular nuevo stock según operación
    switch (operacion) {
      case 'sumar':
        nuevoStock = stockActual + cantidadNum;
        break;
      case 'restar':
        nuevoStock = Math.max(0, stockActual - cantidadNum);
        break;
      case 'establecer':
        nuevoStock = cantidadNum;
        break;
    }

    // 4. Actualizar stock
    await dbp.query(
      "UPDATE producto SET stock = ? WHERE id = ?",
      [nuevoStock, productId]
    );

    return res.json({
      msg: "Stock actualizado exitosamente",
      producto_id: productId,
      nombre: producto[0].nombre,
      stock_anterior: stockActual,
      stock_nuevo: nuevoStock,
      operacion: operacion,
      cantidad: cantidadNum
    });

  } catch (err) {
    console.error("Error en updateStock:", err);
    return res.status(500).json({
      msg: "Error al actualizar stock",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// REPORTES Y ESTADÍSTICAS
// ============================================

// DASHBOARD GENERAL
exports.getDashboard = async (req, res) => {
  try {
    // 1. Estadísticas de productos
    const [productStats] = await dbp.query(
      `SELECT 
         COUNT(*) as total_productos,
         SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END) as productos_disponibles,
         SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as productos_agotados,
         SUM(CASE WHEN stock < 10 THEN 1 ELSE 0 END) as stock_bajo,
         SUM(stock) as stock_total
       FROM producto`
    );

    // 2. Estadísticas de ventas
    const [salesStats] = await dbp.query(
      `SELECT 
         COUNT(*) as total_ventas,
         COALESCE(SUM(total), 0) as ingresos_totales,
         COALESCE(AVG(total), 0) as ticket_promedio,
         COUNT(DISTINCT usuario_id) as clientes_unicos
       FROM venta
       WHERE estado = 'completada'`
    );

    // 3. Ventas del día
    const [todaySales] = await dbp.query(
      `SELECT 
         COUNT(*) as ventas_hoy,
         COALESCE(SUM(total), 0) as ingresos_hoy
       FROM venta
       WHERE DATE(fecha) = CURDATE() AND estado = 'completada'`
    );

    // 4. Ventas del mes
    const [monthSales] = await dbp.query(
      `SELECT 
         COUNT(*) as ventas_mes,
         COALESCE(SUM(total), 0) as ingresos_mes
       FROM venta
       WHERE MONTH(fecha) = MONTH(CURDATE()) 
         AND YEAR(fecha) = YEAR(CURDATE())
         AND estado = 'completada'`
    );

    // 5. Usuarios registrados
    const [userStats] = await dbp.query(
      `SELECT 
         COUNT(*) as total_usuarios,
         SUM(CASE WHEN rol = 'admin' THEN 1 ELSE 0 END) as administradores,
         SUM(CASE WHEN rol = 'cliente' THEN 1 ELSE 0 END) as clientes
       FROM usuario`
    );

    return res.json({
      productos: {
        total: productStats[0].total_productos,
        disponibles: productStats[0].productos_disponibles,
        agotados: productStats[0].productos_agotados,
        stock_bajo: productStats[0].stock_bajo,
        stock_total: productStats[0].stock_total
      },
      ventas: {
        total: salesStats[0].total_ventas,
        ingresos_totales: parseFloat(salesStats[0].ingresos_totales).toFixed(2),
        ticket_promedio: parseFloat(salesStats[0].ticket_promedio).toFixed(2),
        clientes_unicos: salesStats[0].clientes_unicos,
        hoy: {
          ventas: todaySales[0].ventas_hoy,
          ingresos: parseFloat(todaySales[0].ingresos_hoy).toFixed(2)
        },
        mes: {
          ventas: monthSales[0].ventas_mes,
          ingresos: parseFloat(monthSales[0].ingresos_mes).toFixed(2)
        }
      },
      usuarios: {
        total: userStats[0].total_usuarios,
        administradores: userStats[0].administradores,
        clientes: userStats[0].clientes
      }
    });

  } catch (err) {
    console.error("Error en getDashboard:", err);
    return res.status(500).json({
      msg: "Error al obtener dashboard",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// PRODUCTOS MÁS VENDIDOS
exports.getTopProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));

    const [rows] = await dbp.query(
      `SELECT 
         p.id,
         p.nombre,
         p.imagen,
         p.precio,
         p.stock,
         p.categoria,
         COALESCE(SUM(vd.cantidad), 0) as total_vendido,
         COALESCE(SUM(vd.subtotal), 0) as ingresos_generados,
         COUNT(DISTINCT vd.venta_id) as veces_comprado
       FROM producto p
       LEFT JOIN venta_detalle vd ON p.id = vd.producto_id
       LEFT JOIN venta v ON vd.venta_id = v.id AND v.estado = 'completada'
       GROUP BY p.id
       ORDER BY total_vendido DESC
       LIMIT ?`,
      [limitNum]
    );

    const productos = rows.map(p => ({
      id: p.id,
      nombre: p.nombre,
      imagen: p.imagen,
      precio: parseFloat(p.precio).toFixed(2),
      stock: parseInt(p.stock, 10),
      categoria: p.categoria,
      estadisticas: {
        total_vendido: parseInt(p.total_vendido, 10),
        ingresos_generados: parseFloat(p.ingresos_generados).toFixed(2),
        veces_comprado: parseInt(p.veces_comprado, 10)
      }
    }));

    return res.json({
      productos,
      total_resultados: productos.length
    });

  } catch (err) {
    console.error("Error en getTopProducts:", err);
    return res.status(500).json({
      msg: "Error al obtener productos más vendidos",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// PRODUCTOS CON STOCK BAJO
exports.getLowStock = async (req, res) => {
  try {
    const { umbral = 10 } = req.query;
    const umbralNum = Math.max(1, parseInt(umbral, 10));

    const [rows] = await dbp.query(
      `SELECT 
         id,
         nombre,
         imagen,
         precio,
         stock,
         categoria,
         color
       FROM producto
       WHERE stock <= ?
       ORDER BY stock ASC, nombre ASC`,
      [umbralNum]
    );

    const productos = rows.map(p => ({
      id: p.id,
      nombre: p.nombre,
      imagen: p.imagen,
      precio: parseFloat(p.precio).toFixed(2),
      stock: parseInt(p.stock, 10),
      categoria: p.categoria,
      color: p.color,
      estado: parseInt(p.stock, 10) === 0 ? 'agotado' : 'bajo'
    }));

    return res.json({
      productos,
      total_productos: productos.length,
      umbral: umbralNum
    });

  } catch (err) {
    console.error("Error en getLowStock:", err);
    return res.status(500).json({
      msg: "Error al obtener productos con stock bajo",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// HISTORIAL DE VENTAS (para admin)
exports.getAllSales = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      estado, 
      fecha_desde, 
      fecha_hasta 
    } = req.query;

    // Paginación
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    // Construir query con filtros
    let whereConditions = [];
    let params = [];

    if (estado) {
      whereConditions.push("v.estado = ?");
      params.push(estado);
    }

    if (fecha_desde) {
      whereConditions.push("DATE(v.fecha) >= ?");
      params.push(fecha_desde);
    }

    if (fecha_hasta) {
      whereConditions.push("DATE(v.fecha) <= ?");
      params.push(fecha_hasta);
    }

    const whereClause = whereConditions.length > 0 
      ? "WHERE " + whereConditions.join(" AND ") 
      : "";

    // Total de registros
    const [countResult] = await dbp.query(
      `SELECT COUNT(*) as total FROM venta v ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Obtener ventas
    const [ventas] = await dbp.query(
      `SELECT 
         v.id,
         v.total,
         v.metodo_pago,
         v.estado,
         v.fecha,
         u.nombre as cliente_nombre,
         u.correo as cliente_correo
       FROM venta v
       LEFT JOIN usuario u ON v.usuario_id = u.id
       ${whereClause}
       ORDER BY v.fecha DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const totalPages = Math.ceil(total / limitNum);

    return res.json({
      ventas: ventas.map(v => ({
        id: v.id,
        total: parseFloat(v.total).toFixed(2),
        metodo_pago: v.metodo_pago,
        estado: v.estado,
        fecha: v.fecha,
        cliente: {
          nombre: v.cliente_nombre || 'Usuario eliminado',
          correo: v.cliente_correo
        }
      })),
      paginacion: {
        pagina_actual: pageNum,
        total_paginas: totalPages,
        total_ventas: total,
        ventas_por_pagina: limitNum
      }
    });

  } catch (err) {
    console.error("Error en getAllSales:", err);
    return res.status(500).json({
      msg: "Error al obtener historial de ventas",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// GESTIÓN DE USUARIOS (solo listado, para modificar usar userController)
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, rol } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = "";
    let params = [];

    if (rol) {
      whereClause = "WHERE rol = ?";
      params.push(rol);
    }

    // Total usuarios
    const [countResult] = await dbp.query(
      `SELECT COUNT(*) as total FROM usuario ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Obtener usuarios
    const [usuarios] = await dbp.query(
      `SELECT 
         id,
         nombre,
         correo,
         telefono,
         rol,
         fecha_registro,
         ultimo_login
       FROM usuario
       ${whereClause}
       ORDER BY fecha_registro DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const totalPages = Math.ceil(total / limitNum);

    return res.json({
      usuarios,
      paginacion: {
        pagina_actual: pageNum,
        total_paginas: totalPages,
        total_usuarios: total,
        usuarios_por_pagina: limitNum
      }
    });

  } catch (err) {
    console.error("Error en getAllUsers:", err);
    return res.status(500).json({
      msg: "Error al obtener usuarios",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};