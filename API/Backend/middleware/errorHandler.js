/**
 * Middleware de manejo centralizado de errores
 * Debe colocarse AL FINAL de todas las rutas en server.js
 */

const errorHandler = (err, req, res, next) => {
  console.error("Error capturado por errorHandler:", err);

  // Error de validación de Mongoose/Sequelize (si los usas en futuro)
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      msg: "Error de validación",
      errores: Object.values(err.errors).map(e => e.message)
    });
  }

  // Error de cast (ID inválido)
  if (err.name === 'CastError') {
    return res.status(400).json({
      msg: "ID inválido",
      campo: err.path
    });
  }

  // Error de duplicado (MySQL)
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      msg: "Registro duplicado",
      detalle: err.sqlMessage
    });
  }

  // Error de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      msg: "Token inválido"
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      msg: "Token expirado"
    });
  }

  // Error de sintaxis JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      msg: "JSON inválido en el cuerpo de la petición"
    });
  }

  // Error personalizado con status
  if (err.status) {
    return res.status(err.status).json({
      msg: err.message || "Error en la petición"
    });
  }

  // Error genérico del servidor
  const status = err.statusCode || 500;
  const message = err.message || "Error interno del servidor";

  return res.status(status).json({
    msg: message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      detalles: err
    })
  });
};

module.exports = errorHandler;