const { promisePool: dbp } = require("../config/db");


// Configuración de paginación
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ============================================
// OBTENER TODOS LOS PRODUCTOS (con filtros y paginación)
// ============================================

exports.getAll = async (req, res) => {
  try {
    const { 
      categoria, 
      color, 
      q, 
      page = DEFAULT_PAGE, 
      limit = DEFAULT_LIMIT,
      sort = 'id',
      order = 'DESC',
      stock = 'all' // 'all', 'disponible', 'agotado'
    } = req.query;

    // 1. Validar paginación
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    // 2. Validar ordenamiento
    const allowedSorts = ['id', 'nombre', 'precio', 'stock', 'categoria'];
    const allowedOrders = ['ASC', 'DESC'];
    const sortField = allowedSorts.includes(sort) ? sort : 'id';
    const sortOrder = allowedOrders.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

    // 3. Construir query con filtros
    let sql = "SELECT * FROM producto";
    const where = [];
    const params = [];

    if (categoria) {
      where.push("categoria = ?");
      params.push(categoria);
    }

    if (color) {
      where.push("color = ?");
      params.push(color);
    }

    if (q) {
      where.push("(nombre LIKE ? OR descripcion LIKE ?)");
      const searchTerm = `%${q}%`;
      params.push(searchTerm, searchTerm);
    }

    // Filtro de stock
    if (stock === 'disponible') {
      where.push("stock > 0");
    } else if (stock === 'agotado') {
      where.push("stock = 0");
    }

    if (where.length) {
      sql += " WHERE " + where.join(" AND ");
    }

    // 4. Obtener total de registros (para paginación)
    const countSql = sql.replace("SELECT *", "SELECT COUNT(*) as total");
    const [countResult] = await dbp.query(countSql, params);
    const total = countResult[0].total;

    // 5. Agregar ordenamiento y paginación
    sql += ` ORDER BY ${sortField} ${sortOrder}`;
    sql += " LIMIT ? OFFSET ?";
    params.push(limitNum, offset);

    // 6. Ejecutar query
    const [rows] = await dbp.query(sql, params);

    // 7. Formatear precios y calcular páginas
    const productos = rows.map(p => ({
      ...p,
      precio: parseFloat(p.precio).toFixed(2),
      stock: parseInt(p.stock, 10),
      disponible: parseInt(p.stock, 10) > 0
    }));

    const totalPages = Math.ceil(total / limitNum);

    return res.json({
      productos,
      paginacion: {
        pagina_actual: pageNum,
        total_paginas: totalPages,
        total_productos: total,
        productos_por_pagina: limitNum,
        tiene_siguiente: pageNum < totalPages,
        tiene_anterior: pageNum > 1
      },
      filtros_aplicados: {
        categoria: categoria || null,
        color: color || null,
        busqueda: q || null,
        stock: stock,
        ordenamiento: `${sortField} ${sortOrder}`
      }
    });

  } catch (err) {
    console.error("Error en getAll:", err);
    return res.status(500).json({ 
      msg: "Error al obtener productos",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// OBTENER UN PRODUCTO POR ID
// ============================================

exports.getOne = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    // 1. Validar ID
    if (!id || !Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ msg: "ID de producto inválido" });
    }

    // 2. Buscar producto
    const [rows] = await dbp.query(
      "SELECT * FROM producto WHERE id = ? LIMIT 1",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ msg: "Producto no encontrado" });
    }

    const producto = rows[0];

    // 3. Formatear respuesta
    return res.json({
      ...producto,
      precio: parseFloat(producto.precio).toFixed(2),
      stock: parseInt(producto.stock, 10),
      disponible: parseInt(producto.stock, 10) > 0
    });

  } catch (err) {
    console.error("Error en getOne:", err);
    return res.status(500).json({ 
      msg: "Error al obtener producto",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// OBTENER PRODUCTOS RELACIONADOS
// ============================================

exports.getRelated = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    // 1. Validar ID
    if (!id || !Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ msg: "ID de producto inválido" });
    }

    // 2. Obtener producto base
    const [baseRows] = await dbp.query(
      "SELECT id, categoria, color FROM producto WHERE id = ? LIMIT 1",
      [id]
    );

    if (baseRows.length === 0) {
      return res.status(404).json({ msg: "Producto no encontrado" });
    }

    const { categoria, color } = baseRows[0];

    // 3. Buscar relacionados con scoring
    // Prioridad: misma categoría Y color > misma categoría > mismo color
    const [rows] = await dbp.query(
      `SELECT *,
         CASE 
           WHEN categoria = ? AND color = ? THEN 3
           WHEN categoria = ? THEN 2
           WHEN color = ? THEN 1
           ELSE 0
         END as relevancia
       FROM producto
       WHERE id <> ?
         AND (categoria = ? OR color = ?)
       ORDER BY relevancia DESC, stock DESC, id DESC
       LIMIT 8`,
      [categoria, color, categoria, color, id, categoria, color]
    );

    // 4. Formatear productos
    const relacionados = rows.map(p => ({
      ...p,
      precio: parseFloat(p.precio).toFixed(2),
      stock: parseInt(p.stock, 10),
      disponible: parseInt(p.stock, 10) > 0,
      relevancia: undefined // No enviar al cliente
    }));

    return res.json(relacionados);

  } catch (err) {
    console.error("Error en getRelated:", err);
    return res.status(500).json({ 
      msg: "Error al obtener productos relacionados",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// OBTENER METADATA (categorías y colores)
// ============================================

exports.getMetadata = async (req, res) => {
  try {
    // Obtener categorías únicas con conteo
    const [cats] = await dbp.query(
      `SELECT 
         categoria, 
         COUNT(*) as cantidad,
         SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END) as con_stock
       FROM producto 
       WHERE categoria IS NOT NULL AND categoria <> '' 
       GROUP BY categoria 
       ORDER BY categoria`
    );

    // Obtener colores únicos con conteo
    const [colors] = await dbp.query(
      `SELECT 
         color, 
         COUNT(*) as cantidad,
         SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END) as con_stock
       FROM producto 
       WHERE color IS NOT NULL AND color <> '' 
       GROUP BY color 
       ORDER BY color`
    );

    // Obtener estadísticas generales
    const [stats] = await dbp.query(
      `SELECT 
         COUNT(*) as total_productos,
         SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END) as productos_disponibles,
         SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as productos_agotados,
         MIN(precio) as precio_minimo,
         MAX(precio) as precio_maximo
       FROM producto`
    );

    return res.json({
      categorias: cats.map(c => ({
        nombre: c.categoria,
        cantidad: c.cantidad,
        con_stock: c.con_stock
      })),
      colores: colors.map(c => ({
        nombre: c.color,
        cantidad: c.cantidad,
        con_stock: c.con_stock
      })),
      estadisticas: {
        total_productos: stats[0].total_productos,
        productos_disponibles: stats[0].productos_disponibles,
        productos_agotados: stats[0].productos_agotados,
        precio_minimo: parseFloat(stats[0].precio_minimo || 0).toFixed(2),
        precio_maximo: parseFloat(stats[0].precio_maximo || 0).toFixed(2)
      }
    });

  } catch (err) {
    console.error("Error en getMetadata:", err);
    return res.status(500).json({ 
      msg: "Error al obtener metadata",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// BUSCAR PRODUCTOS (búsqueda avanzada)
// ============================================

exports.search = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ 
        msg: "La búsqueda debe tener al menos 2 caracteres" 
      });
    }

    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const searchTerm = `%${q.trim()}%`;

    // Búsqueda con relevancia
    const [rows] = await dbp.query(
      `SELECT *,
         CASE 
           WHEN nombre LIKE ? THEN 3
           WHEN nombre LIKE ? THEN 2
           WHEN descripcion LIKE ? THEN 1
           ELSE 0
         END as relevancia
       FROM producto
       WHERE nombre LIKE ? OR descripcion LIKE ?
       ORDER BY relevancia DESC, stock DESC
       LIMIT ?`,
      [
        q.trim(), // Coincidencia exacta
        searchTerm, // Coincidencia parcial nombre
        searchTerm, // Coincidencia descripción
        searchTerm, 
        searchTerm,
        limitNum
      ]
    );

    const resultados = rows.map(p => ({
      ...p,
      precio: parseFloat(p.precio).toFixed(2),
      stock: parseInt(p.stock, 10),
      disponible: parseInt(p.stock, 10) > 0,
      relevancia: undefined
    }));

    return res.json({
      resultados,
      total_encontrados: resultados.length,
      termino_busqueda: q.trim()
    });

  } catch (err) {
    console.error("Error en search:", err);
    return res.status(500).json({ 
      msg: "Error al buscar productos",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// PRODUCTOS DESTACADOS (más vendidos o random)
// ============================================

exports.getFeatured = async (req, res) => {
  try {
    const { limit = 8, tipo = 'random' } = req.query;
    const limitNum = Math.min(20, Math.max(1, parseInt(limit, 10)));

    let sql;
    
    if (tipo === 'mas-vendidos') {
      // Productos más vendidos (requiere datos de ventas)
      sql = `
        SELECT p.*, COALESCE(SUM(vd.cantidad), 0) as total_vendido
        FROM producto p
        LEFT JOIN venta_detalle vd ON p.id = vd.producto_id
        WHERE p.stock > 0
        GROUP BY p.id
        ORDER BY total_vendido DESC, p.id DESC
        LIMIT ?
      `;
    } else {
      // Productos aleatorios con stock
      sql = `
        SELECT * FROM producto
        WHERE stock > 0
        ORDER BY RAND()
        LIMIT ?
      `;
    }

    const [rows] = await dbp.query(sql, [limitNum]);

    const productos = rows.map(p => ({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: parseFloat(p.precio).toFixed(2),
      categoria: p.categoria,
      color: p.color,
      stock: parseInt(p.stock, 10),
      imagen: p.imagen,
      disponible: true,
      ...(tipo === 'mas-vendidos' && { total_vendido: p.total_vendido })
    }));

    return res.json({
      productos,
      tipo
    });

  } catch (err) {
    console.error("Error en getFeatured:", err);
    return res.status(500).json({ 
      msg: "Error al obtener productos destacados",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// VERIFICAR DISPONIBILIDAD DE STOCK
// ============================================

exports.checkStock = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { cantidad = 1 } = req.query;

    // Validar parámetros
    if (!id || !Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ msg: "ID de producto inválido" });
    }

    const cantidadNum = parseInt(cantidad, 10);
    if (!Number.isInteger(cantidadNum) || cantidadNum < 1) {
      return res.status(400).json({ msg: "Cantidad inválida" });
    }

    // Verificar stock
    const [rows] = await dbp.query(
      "SELECT id, nombre, stock FROM producto WHERE id = ? LIMIT 1",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ msg: "Producto no encontrado" });
    }

    const producto = rows[0];
    const stockDisponible = parseInt(producto.stock, 10);
    const disponible = stockDisponible >= cantidadNum;

    return res.json({
      producto_id: producto.id,
      nombre: producto.nombre,
      stock_disponible: stockDisponible,
      cantidad_solicitada: cantidadNum,
      disponible,
      ...(disponible ? {} : { 
        msg: "Stock insuficiente",
        faltante: cantidadNum - stockDisponible 
      })
    });

  } catch (err) {
    console.error("Error en checkStock:", err);
    return res.status(500).json({ 
      msg: "Error al verificar stock",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};