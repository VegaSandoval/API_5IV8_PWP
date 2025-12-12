const express = require("express");
const router = express.Router();
const c = require("../controllers/saleController");

router.post("/confirmar", c.buy);

module.exports = router;
