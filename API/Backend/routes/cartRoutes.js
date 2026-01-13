const express = require("express");
const router = express.Router();
const c = require("../controllers/cartController");
const auth = require("../middleware/authMiddleware"); // Middleware que crearemos

// TODAS las rutas del carrito requieren autenticación
router.use(auth);

// Gestión del carrito
router.post("/agregar", c.add);
router.get("/", c.getCart);
router.get("/validar", c.validate); // NUEVO: Validar antes de compra

// Gestión de items
router.put("/item/:itemId", c.updateQty);    
router.delete("/item/:itemId", c.removeItem); 

// Vaciar carrito
router.delete("/vaciar", c.empty);

module.exports = router;