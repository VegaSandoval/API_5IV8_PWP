const express = require("express");
const router = express.Router();
const c = require("../controllers/userController");

router.get("/profile", c.getProfile);
router.put("/profile", c.updateProfile);

module.exports = router;
