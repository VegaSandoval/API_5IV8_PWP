const express = require("express");
const router = express.Router();
const c = require("../controllers/saleController");
const auth = require("../middleware/authMiddleware"); // Middleware que crearemos

// TODAS las rutas de venta requieren autenticación
router.use(auth);

// Procesar compra
router.post("/confirmar", c.buy);

// Historial de compras
router.get("/historial", c.getHistory);
router.get("/estadisticas", c.getStats);
router.get("/:id", c.getOne);

// Información de métodos de pago
router.get("/metodos-pago", c.getMetodosPago);

module.exports = router;