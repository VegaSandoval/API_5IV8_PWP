const express = require("express");
const router = express.Router();
const c = require("../controllers/authController");

// Rutas públicas
router.post("/register", c.register);
router.post("/login", c.login);

// Gestión de tokens
router.post("/refresh", c.refreshToken);
router.post("/logout", c.logout);

// Cambio de contraseña
router.post("/cambiar-password", c.cambiarPassword);

module.exports = router;