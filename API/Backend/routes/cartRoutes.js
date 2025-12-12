const express = require("express");
const router = express.Router();
const c = require("../controllers/cartController");

router.post("/agregar", c.add);
router.get("/", c.getCart);

router.put("/item/:itemId", c.updateQty);    
router.delete("/item/:itemId", c.removeItem); 

router.delete("/vaciar", c.empty);

module.exports = router;
