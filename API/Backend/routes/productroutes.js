const express = require("express");
const router = express.Router();
const c = require("../controllers/productController");

// Rutas públicas (no requieren autenticación)

// Metadata y búsqueda (deben ir ANTES de las rutas con :id)
router.get("/metadata", c.getMetadata);
router.get("/buscar", c.search);
router.get("/destacados", c.getFeatured);

// Rutas específicas de producto
router.get("/:id/relacionados", c.getRelated);
router.get("/:id/verificar-stock", c.checkStock);

// Rutas CRUD básicas
router.get("/", c.getAll);
router.get("/:id", c.getOne);

module.exports = router;