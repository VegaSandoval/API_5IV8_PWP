const express = require("express");
const router = express.Router();
const c = require("../controllers/adminController");
const auth = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/roleMiddleware");

// TODAS las rutas de admin requieren autenticación Y rol de admin
router.use(auth);
router.use(requireAdmin);

// ============================================
// GESTIÓN DE PRODUCTOS
// ============================================

// CRUD de productos
router.post("/productos", c.createProduct);           // Crear
router.put("/productos/:id", c.updateProduct);        // Actualizar
router.delete("/productos/:id", c.deleteProduct);     // Eliminar
router.patch("/productos/:id/stock", c.updateStock);  // Actualizar solo stock

// ============================================
// REPORTES Y ESTADÍSTICAS
// ============================================

// Dashboard
router.get("/dashboard", c.getDashboard);

// Productos
router.get("/productos/top", c.getTopProducts);       // Más vendidos
router.get("/productos/stock-bajo", c.getLowStock);   // Stock bajo

// Ventas
router.get("/ventas", c.getAllSales);                 // Historial completo

// Usuarios
router.get("/usuarios", c.getAllUsers);               // Listado de usuarios

module.exports = router;