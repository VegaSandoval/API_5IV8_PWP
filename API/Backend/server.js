require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/productos", require("./routes/productRoutes"));
app.use("/api/carrito", require("./routes/cartRoutes"));
app.use("/api/venta", require("./routes/saleRoutes"));

app.listen(process.env.PORT, () => {
    console.log("Servidor corriendo en puerto", process.env.PORT);
});
