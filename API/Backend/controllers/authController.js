const { promisePool: dbp } = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


// ============================================
// UTILIDADES Y VALIDACIONES
// ============================================

function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validarPassword(pass) {
  // Mínimo 8 caracteres, al menos: 1 letra, 1 número, 1 símbolo
  return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(pass);
}

function validarTelefono(tel) {
  if (!tel) return true; // Opcional
  // Acepta formatos: 1234567890, 123-456-7890, (123) 456-7890
  return /^[\d\s\-\(\)]{10,15}$/.test(tel);
}

// Generar tokens JWT
function generarTokens(userId, rol) {
  const accessToken = jwt.sign(
    { id: userId, rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '1h' } // 1 hora
  );

  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' } // 7 días
  );

  return { accessToken, refreshToken };
}

// ============================================
// REGISTRO
// ============================================

exports.register = async (req, res) => {
  try {
    const { nombre, correo, password, telefono, rol } = req.body;

    // 1. Validar campos obligatorios
    if (!nombre || !correo || !password) {
      return res.status(400).json({ 
        msg: "Campos obligatorios: nombre, correo, password" 
      }); 
    }

    // 2. Validar formato de email
    if (!validarEmail(correo)) {
      return res.status(400).json({
        msg: "Formato de email inválido"
      });
    }

    // 3. Validar contraseña
    if (!validarPassword(password)) {
      return res.status(400).json({
        msg: "Contraseña no válida. Debe tener mínimo 8 caracteres e incluir letras, números y símbolos.",
      });
    }

    // 4. Validar teléfono (si se proporciona)
    if (telefono && !validarTelefono(telefono)) {
      return res.status(400).json({
        msg: "Formato de teléfono inválido"
      });
    }

    // 5. Validar rol (solo admin puede crear otros admins)
    const rolFinal = rol === 'admin' ? 'admin' : 'cliente';
    
    // Si intenta crear admin, verificar que quien registra sea admin
    if (rol === 'admin') {
      // Aquí deberías verificar que el token del request sea de un admin
      // Por ahora, bloqueamos la creación de admins desde registro público
      return res.status(403).json({
        msg: "No puedes registrarte como administrador"
      });
    }

    // 6. Verificar si el email ya existe
    const [exists] = await dbp.query(
      "SELECT id FROM usuario WHERE correo = ? LIMIT 1",
      [correo.toLowerCase().trim()]
    );
    
    if (exists.length > 0) {
      return res.status(409).json({ msg: "El correo ya está registrado" });
    }

    // 7. Hashear contraseña (ASYNC para no bloquear)
    const hashed = await bcrypt.hash(password, 10);

    // 8. Insertar usuario
    const [result] = await dbp.query(
      "INSERT INTO usuario (nombre, correo, password, telefono, rol) VALUES (?, ?, ?, ?, ?)",
      [
        nombre.trim(),
        correo.toLowerCase().trim(),
        hashed,
        telefono?.trim() || null,
        rolFinal
      ]
    );

    // 9. Generar tokens
    const { accessToken, refreshToken } = generarTokens(result.insertId, rolFinal);

    // 10. Guardar refresh token en BD (opcional pero recomendado)
    await dbp.query(
      "UPDATE usuario SET refresh_token = ? WHERE id = ?",
      [refreshToken, result.insertId]
    );

    return res.status(201).json({ 
      msg: "Usuario registrado exitosamente",
      usuario: {
        id: result.insertId,
        nombre: nombre.trim(),
        correo: correo.toLowerCase().trim(),
        rol: rolFinal
      },
      accessToken,
      refreshToken
    });

  } catch (err) {
    console.error("Error en register:", err);
    return res.status(500).json({ 
      msg: "Error al registrar usuario",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// LOGIN
// ============================================

exports.login = async (req, res) => {
  try {
    const { correo, password } = req.body;

    // 1. Validar campos
    if (!correo || !password) {
      return res.status(400).json({ 
        msg: "Correo y contraseña son obligatorios" 
      });
    }

    // 2. Buscar usuario
    const [data] = await dbp.query(
      "SELECT id, nombre, correo, password, rol, telefono FROM usuario WHERE correo = ? LIMIT 1",
      [correo.toLowerCase().trim()]
    );

    if (data.length === 0) {
      return res.status(401).json({ 
        msg: "Credenciales incorrectas" // No especificar si es email o password
      }); 
    }

    const user = data[0];

    // 3. Verificar contraseña (ASYNC)
    const passwordValida = await bcrypt.compare(password, user.password);
    
    if (!passwordValida) {
      return res.status(401).json({ 
        msg: "Credenciales incorrectas" 
      });
    }

    // 4. Generar tokens
    const { accessToken, refreshToken } = generarTokens(user.id, user.rol);

    // 5. Guardar refresh token en BD
    await dbp.query(
      "UPDATE usuario SET refresh_token = ?, ultimo_login = NOW() WHERE id = ?",
      [refreshToken, user.id]
    );

    // 6. Retornar datos del usuario (SIN password)
    return res.json({ 
      msg: "Inicio de sesión exitoso",
      usuario: {
        id: user.id,
        nombre: user.nombre,
        correo: user.correo,
        telefono: user.telefono,
        rol: user.rol
      },
      accessToken,
      refreshToken
    });

  } catch (err) {
    console.error("Error en login:", err);
    return res.status(500).json({ 
      msg: "Error al iniciar sesión",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// REFRESH TOKEN
// ============================================

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ msg: "Refresh token requerido" });
    }

    // 1. Verificar que el refresh token sea válido
    let decoded;
    try {
      decoded = jwt.verify(
        refreshToken, 
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
      );
    } catch (err) {
      return res.status(401).json({ msg: "Refresh token inválido o expirado" });
    }

    // 2. Verificar que el token esté en la BD
    const [rows] = await dbp.query(
      "SELECT id, rol, refresh_token FROM usuario WHERE id = ? LIMIT 1",
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    const user = rows[0];

    if (user.refresh_token !== refreshToken) {
      return res.status(401).json({ msg: "Refresh token no válido" });
    }

    // 3. Generar nuevos tokens
    const tokens = generarTokens(user.id, user.rol);

    // 4. Actualizar refresh token en BD
    await dbp.query(
      "UPDATE usuario SET refresh_token = ? WHERE id = ?",
      [tokens.refreshToken, user.id]
    );

    return res.json({
      msg: "Tokens renovados",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });

  } catch (err) {
    console.error("Error en refreshToken:", err);
    return res.status(500).json({ 
      msg: "Error al renovar token",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// LOGOUT
// ============================================

exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ msg: "Refresh token requerido" });
    }

    // Invalidar refresh token en la BD
    await dbp.query(
      "UPDATE usuario SET refresh_token = NULL WHERE refresh_token = ?",
      [refreshToken]
    );

    return res.json({ msg: "Sesión cerrada exitosamente" });

  } catch (err) {
    console.error("Error en logout:", err);
    return res.status(500).json({ 
      msg: "Error al cerrar sesión",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ============================================
// CAMBIAR CONTRASEÑA
// ============================================

exports.cambiarPassword = async (req, res) => {
  try {
    const { correo, passwordActual, passwordNueva } = req.body;

    // 1. Validar campos
    if (!correo || !passwordActual || !passwordNueva) {
      return res.status(400).json({
        msg: "Todos los campos son obligatorios"
      });
    }

    // 2. Validar nueva contraseña
    if (!validarPassword(passwordNueva)) {
      return res.status(400).json({
        msg: "La nueva contraseña debe tener mínimo 8 caracteres e incluir letras, números y símbolos."
      });
    }

    // 3. Buscar usuario y verificar contraseña actual
    const [rows] = await dbp.query(
      "SELECT id, password FROM usuario WHERE correo = ? LIMIT 1",
      [correo.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    const user = rows[0];
    const passwordValida = await bcrypt.compare(passwordActual, user.password);

    if (!passwordValida) {
      return res.status(401).json({ msg: "Contraseña actual incorrecta" });
    }

    // 4. Hashear nueva contraseña
    const hashedNueva = await bcrypt.hash(passwordNueva, 10);

    // 5. Actualizar contraseña e invalidar refresh tokens
    await dbp.query(
      "UPDATE usuario SET password = ?, refresh_token = NULL WHERE id = ?",
      [hashedNueva, user.id]
    );

    return res.json({ 
      msg: "Contraseña actualizada exitosamente. Por favor, inicia sesión nuevamente." 
    });

  } catch (err) {
    console.error("Error en cambiarPassword:", err);
    return res.status(500).json({ 
      msg: "Error al cambiar contraseña",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};