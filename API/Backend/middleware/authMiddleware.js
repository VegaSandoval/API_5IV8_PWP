const jwt = require("jsonwebtoken");

/**
 * Middleware de autenticación
 * Verifica que el token JWT sea válido y agrega req.user
 */
module.exports = (req, res, next) => {
  try {
    // 1. Obtener token del header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        msg: "Acceso denegado. No se proporcionó token de autenticación." 
      });
    }

    // 2. Extraer token (formato: "Bearer TOKEN")
    const token = authHeader.startsWith("Bearer ") 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({ 
        msg: "Acceso denegado. Token inválido." 
      });
    }

    // 3. Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Agregar datos del usuario al request
    req.user = {
      id: decoded.id,
      rol: decoded.rol
    };

    // 5. Continuar con el siguiente middleware/controlador
    next();

  } catch (err) {
    // Manejo de errores específicos de JWT
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        msg: "Token expirado. Por favor, inicia sesión nuevamente.",
        expired: true
      });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        msg: "Token inválido.",
        invalid: true
      });
    }

    // Error genérico
    console.error("Error en authMiddleware:", err);
    return res.status(500).json({ 
      msg: "Error al verificar autenticación" 
    });
  }
};