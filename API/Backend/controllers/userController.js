const db = require("../config/db");
const bcrypt = require("bcryptjs");
const dbp = db.promise();

// ============================================
// UTILIDADES DE VALIDACIÓN
// ============================================

function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validarTelefono(tel) {
  if (!tel) return true; // Opcional
  return /^[\d\s\-\(\)]{10,15}$/.test(tel);
}

function validarNombre(nombre) {
  if (!nombre || nombre.trim().length < 2) return false;
  if (nombre.trim().length > 100) return false;
  return true;
}

// ============================================
// OBTENER PERFIL
// ============================================

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id; // Viene del middleware

    const [rows] = await dbp.query(
      `SELECT 
         id, 
         nombre, 
         correo, 
         telefono, 
         rol, 
         fecha_registro,
         ultimo_login
       FROM usuario 
       WHERE id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    const usuario = rows[0];

    // Obtener estadísticas adicionales
    const [statsCompras] = await dbp.query(
      `SELECT 
         COUNT(*) as total_compras,
         COALESCE(SUM(total), 0) as total_gastado
       FROM venta 
       WHERE usuario_id = ?`,
      [userId]
    );

    const [statsCarrito] = await dbp.query(
      `SELECT COUNT(*) as items_en_carrito
       FROM carrito_item ci
       JOIN carrito c ON ci.carrito_id = c.id
       WHERE c.usuario_id = ?`,
      [userId]
    );

    return res.json({
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        telefono: usuario.telefono,
        rol: usuario.rol,
        fecha_registro: usuario.fecha_registro,
        ultimo_login: usuario.ultimo_login
      },
      estadisticas: {
        total_compras: statsCompras[0].total_compras,
        total_gastado: parseFloat(statsCompras[0].total_gastado).toFixed(2),
        items_en_carrito: statsCarrito[0].items_en_carrito
      }
    });

  } catch (err) {
    console.error("Error en getProfile:", err);
    
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: "Token inválido o expirado" });
    }
    
    return res.status(500).json({ 
      msg: "Error al obtener perfil",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// ACTUALIZAR PERFIL
// ============================================

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { nombre, telefono, correo } = req.body;

    // 1. Validar que al menos un campo esté presente
    if (!nombre && !telefono && !correo) {
      return res.status(400).json({ 
        msg: "Debes proporcionar al menos un campo para actualizar" 
      });
    }

    // 2. Construir query dinámicamente
    const updates = [];
    const params = [];

    if (nombre !== undefined) {
      if (!validarNombre(nombre)) {
        return res.status(400).json({ 
          msg: "Nombre inválido (mínimo 2 caracteres, máximo 100)" 
        });
      }
      updates.push("nombre = ?");
      params.push(nombre.trim());
    }

    if (telefono !== undefined) {
      if (telefono && !validarTelefono(telefono)) {
        return res.status(400).json({ 
          msg: "Formato de teléfono inválido" 
        });
      }
      updates.push("telefono = ?");
      params.push(telefono?.trim() || null);
    }

    if (correo !== undefined) {
      if (!validarEmail(correo)) {
        return res.status(400).json({ 
          msg: "Formato de email inválido" 
        });
      }

      // Verificar que el correo no esté en uso
      const [exists] = await dbp.query(
        "SELECT id FROM usuario WHERE correo = ? AND id <> ? LIMIT 1",
        [correo.toLowerCase().trim(), userId]
      );

      if (exists.length > 0) {
        return res.status(409).json({ 
          msg: "El correo ya está registrado por otro usuario" 
        });
      }

      updates.push("correo = ?");
      params.push(correo.toLowerCase().trim());
    }

    // 3. Agregar userId al final de los parámetros
    params.push(userId);

    // 4. Ejecutar actualización
    await dbp.query(
      `UPDATE usuario SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    // 5. Obtener datos actualizados
    const [updated] = await dbp.query(
      "SELECT id, nombre, correo, telefono, rol FROM usuario WHERE id = ?",
      [userId]
    );

    return res.json({ 
      msg: "Perfil actualizado correctamente",
      usuario: updated[0]
    });

  } catch (err) {
    console.error("Error en updateProfile:", err);
    
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: "Token inválido o expirado" });
    }
    
    return res.status(500).json({ 
      msg: "Error al actualizar perfil",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// CAMBIAR CONTRASEÑA (desde el perfil)
// ============================================

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password_actual, password_nueva } = req.body;

    // 1. Validar campos
    if (!password_actual || !password_nueva) {
      return res.status(400).json({ 
        msg: "Contraseña actual y nueva son obligatorias" 
      });
    }

    // 2. Validar formato de nueva contraseña
    const passwordValida = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password_nueva);
    if (!passwordValida) {
      return res.status(400).json({
        msg: "La nueva contraseña debe tener mínimo 8 caracteres e incluir letras, números y símbolos."
      });
    }

    // 3. Obtener usuario
    const [rows] = await dbp.query(
      "SELECT id, password FROM usuario WHERE id = ? LIMIT 1",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    const user = rows[0];

    // 4. Verificar contraseña actual
    const esValida = await bcrypt.compare(password_actual, user.password);
    if (!esValida) {
      return res.status(401).json({ msg: "Contraseña actual incorrecta" });
    }

    // 5. Hashear nueva contraseña
    const hashedNueva = await bcrypt.hash(password_nueva, 10);

    // 6. Actualizar contraseña e invalidar refresh tokens
    await dbp.query(
      "UPDATE usuario SET password = ?, refresh_token = NULL WHERE id = ?",
      [hashedNueva, userId]
    );

    return res.json({ 
      msg: "Contraseña actualizada correctamente. Debes iniciar sesión nuevamente.",
      logout_required: true
    });

  } catch (err) {
    console.error("Error en changePassword:", err);
    
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: "Token inválido o expirado" });
    }
    
    return res.status(500).json({ 
      msg: "Error al cambiar contraseña",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// ELIMINAR CUENTA
// ============================================

exports.deleteAccount = async (req, res) => {
  const connection = await dbp.getConnection();
  
  try {
    const userId = req.user.id;
    const { password, confirmacion } = req.body;

    // 1. Validar confirmación
    if (confirmacion !== "ELIMINAR") {
      return res.status(400).json({ 
        msg: 'Debes escribir "ELIMINAR" para confirmar' 
      });
    }

    if (!password) {
      return res.status(400).json({ 
        msg: "Debes proporcionar tu contraseña para confirmar" 
      });
    }

    // 2. Verificar contraseña
    const [rows] = await dbp.query(
      "SELECT id, password, rol FROM usuario WHERE id = ? LIMIT 1",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    const user = rows[0];

    // No permitir que el último admin se elimine
    if (user.rol === 'admin') {
      const [adminCount] = await dbp.query(
        "SELECT COUNT(*) as total FROM usuario WHERE rol = 'admin'"
      );
      
      if (adminCount[0].total <= 1) {
        return res.status(403).json({ 
          msg: "No puedes eliminar el último administrador del sistema" 
        });
      }
    }

    const esValida = await bcrypt.compare(password, user.password);
    if (!esValida) {
      return res.status(401).json({ msg: "Contraseña incorrecta" });
    }

    // 3. Iniciar transacción
    await connection.beginTransaction();

    // 4. Eliminar datos relacionados (por si no hay CASCADE)
    await connection.query("DELETE FROM carrito_item WHERE carrito_id IN (SELECT id FROM carrito WHERE usuario_id = ?)", [userId]);
    await connection.query("DELETE FROM carrito WHERE usuario_id = ?", [userId]);
    
    // Las ventas NO se eliminan (mantener historial por auditoría)
    // Solo desvinculamos el usuario
    await connection.query("UPDATE venta SET usuario_id = NULL WHERE usuario_id = ?", [userId]);

    // 5. Eliminar usuario
    await connection.query("DELETE FROM usuario WHERE id = ?", [userId]);

    await connection.commit();

    return res.json({ 
      msg: "Cuenta eliminada correctamente. ¡Esperamos verte de nuevo pronto!",
      deleted: true
    });

  } catch (err) {
    try {
      await connection.rollback();
    } catch (rollbackErr) {
      console.error("Error al hacer rollback:", rollbackErr);
    }
    
    console.error("Error en deleteAccount:", err);
    
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: "Token inválido o expirado" });
    }
    
    return res.status(500).json({ 
      msg: "Error al eliminar cuenta",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    connection.release();
  }
};

// ============================================
// OBTENER PREFERENCIAS (futuro: notificaciones, idioma, etc.)
// ============================================

exports.getPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    // Por ahora retorna configuración básica
    // En el futuro podrías tener una tabla `preferencias_usuario`
    return res.json({
      preferencias: {
        notificaciones_email: true,
        notificaciones_compras: true,
        idioma: 'es',
        moneda: 'MXN'
      },
      msg: "Funcionalidad de preferencias en desarrollo"
    });

  } catch (err) {
    console.error("Error en getPreferences:", err);
    
    return res.status(500).json({ 
      msg: "Error al obtener preferencias",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// VERIFICAR SI EL EMAIL ESTÁ DISPONIBLE
// ============================================

exports.checkEmailAvailability = async (req, res) => {
  try {
    const { correo } = req.query;
    const userId = req.user?.id; // Opcional, si está logueado

    if (!correo) {
      return res.status(400).json({ msg: "Email requerido" });
    }

    if (!validarEmail(correo)) {
      return res.status(400).json({ 
        msg: "Formato de email inválido",
        disponible: false
      });
    }

    // Verificar si existe (excluyendo el usuario actual si está logueado)
    let query = "SELECT id FROM usuario WHERE correo = ? LIMIT 1";
    let params = [correo.toLowerCase().trim()];

    if (userId) {
      query = "SELECT id FROM usuario WHERE correo = ? AND id <> ? LIMIT 1";
      params = [correo.toLowerCase().trim(), userId];
    }

    const [rows] = await dbp.query(query, params);

    return res.json({
      correo: correo.toLowerCase().trim(),
      disponible: rows.length === 0
    });

  } catch (err) {
    console.error("Error en checkEmailAvailability:", err);
    
    return res.status(500).json({ 
      msg: "Error al verificar email",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};