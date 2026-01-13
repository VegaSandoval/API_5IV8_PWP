/**
 * Middleware de autorización por rol
 * Verifica que el usuario tenga un rol específico
 * IMPORTANTE: Debe usarse DESPUÉS de authMiddleware
 */

/**
 * Crear middleware para verificar rol específico
 * @param {string|string[]} rolesPermitidos - Rol o array de roles permitidos
 */
const requireRole = (rolesPermitidos) => {
  return (req, res, next) => {
    try {
      // 1. Verificar que req.user existe (debe venir de authMiddleware)
      if (!req.user || !req.user.rol) {
        return res.status(401).json({ 
          msg: "Acceso denegado. Usuario no autenticado." 
        });
      }

      // 2. Convertir a array si es un solo rol
      const roles = Array.isArray(rolesPermitidos) 
        ? rolesPermitidos 
        : [rolesPermitidos];

      // 3. Verificar si el usuario tiene uno de los roles permitidos
      if (!roles.includes(req.user.rol)) {
        return res.status(403).json({ 
          msg: "Acceso denegado. No tienes permisos suficientes.",
          rol_requerido: roles,
          tu_rol: req.user.rol
        });
      }

      // 4. Usuario autorizado, continuar
      next();

    } catch (err) {
      console.error("Error en roleMiddleware:", err);
      return res.status(500).json({ 
        msg: "Error al verificar permisos" 
      });
    }
  };
};

/**
 * Middleware para verificar que el usuario sea ADMIN
 */
const requireAdmin = requireRole('admin');

/**
 * Middleware para verificar que el usuario sea CLIENTE
 */
const requireCliente = requireRole('cliente');

/**
 * Middleware para verificar que el usuario sea ADMIN o CLIENTE
 */
const requireAny = requireRole(['admin', 'cliente']);

module.exports = {
  requireRole,
  requireAdmin,
  requireCliente,
  requireAny
};