require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// Rutas principales
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/productos", require("./routes/productRoutes"));
app.use("/api/carrito", require("./routes/cartRoutes"));
app.use("/api/venta", require("./routes/saleRoutes"));

// Ruta de productos que venía del HEAD
app.use("/", productroutes);

// Levantar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
