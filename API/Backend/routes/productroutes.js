const express = require("express");
const router = express.Router();
const c = require("../controllers/productController");

router.get("/", c.getAll);
router.get("/:id", c.getOne);

module.exports = router;
