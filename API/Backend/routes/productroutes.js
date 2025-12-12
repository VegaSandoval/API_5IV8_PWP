const express = require("express");
const router = express.Router();
const c = require("../controllers/productController");

router.get("/metadata", c.getMetadata);
router.get("/:id/relacionados", c.getRelated);

router.get("/", c.getAll);
router.get("/:id", c.getOne);

module.exports = router;
