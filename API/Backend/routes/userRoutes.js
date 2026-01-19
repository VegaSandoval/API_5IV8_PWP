const express = require("express");
const router = express.Router();
const c = require("../controllers/userController");
const auth = require("../middleware/authMiddleware"); // Middleware que crearemos

// Ruta pública (para verificar email en registro)
router.get("/verificar-email", c.checkEmailAvailability);

// TODAS las demás rutas requieren autenticación
router.use(auth);

// Gestión de perfil
router.get("/profile", c.getProfile);
router.put("/profile", c.updateProfile);

// Seguridad
router.put("/cambiar-password", c.changePassword);
router.delete("/eliminar-cuenta", c.deleteAccount);

// Preferencias
router.get("/preferencias", c.getPreferences);

// Envío (perfil)
router.get("/envio", c.getEnvio);
router.put("/envio", c.upsertEnvio);

// Pago (perfil)
router.get("/pago", c.getPago);
router.put("/pago", c.upsertPago);


module.exports = router;