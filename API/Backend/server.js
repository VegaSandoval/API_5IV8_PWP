require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const ejs = require("ejs");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const ROOT_DIR = path.join(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT_DIR, "Frontend");
const VIEWS_DIR = path.join(FRONTEND_DIR, "views");
const PUBLIC_DIR = path.join(FRONTEND_DIR, "public");

app.use(express.static(PUBLIC_DIR));
app.set("views", VIEWS_DIR);
app.set("view engine", "ejs");

import webRoutes from "./routes/webRoutes.js"; // ajusta la ruta si tu app.js está en otra carpeta

app.use("/", webRoutes);


function renderWithLayout(res, view, locals = {}) {
  const pageFile = path.join(VIEWS_DIR, `${view}.ejs`);
  const layoutFile = path.join(VIEWS_DIR, "layouts", "main.ejs");

  ejs.renderFile(pageFile, locals, (err, body) => {
    if (err) {
      console.error("EJS page error:", err);
      return res.status(500).send("Error al renderizar la vista.");
    }

    ejs.renderFile(layoutFile, { ...locals, body }, (err2, html) => {
      if (err2) {
        console.error("EJS layout error:", err2);
        return res.status(500).send("Error al renderizar el layout.");
      }
      return res.send(html);
    });
  });
}

// API routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/productos", require("./routes/productRoutes"));
app.use("/api/carrito", require("./routes/cartRoutes"));
app.use("/api/venta", require("./routes/saleRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));

// Front routes
app.get("/", (req, res) => renderWithLayout(res, "pages/home", { title: "Inicio" }));
app.get("/products", (req, res) => renderWithLayout(res, "pages/products", { title: "Productos" }));
app.get("/products/:id", (req, res) =>
  renderWithLayout(res, "pages/product-detail", { title: "Detalle de producto" })
);
app.get("/cart", (req, res) => renderWithLayout(res, "pages/cart", { title: "Carrito" }));
app.get("/profile", (req, res) => renderWithLayout(res, "pages/profile", { title: "Mi cuenta" }));
app.get("/login", (req, res) => renderWithLayout(res, "pages/login", { title: "Iniciar sesión" }));
app.get("/register", (req, res) => renderWithLayout(res, "pages/register", { title: "Registrarse" }));
app.get("/contact", (req, res) => renderWithLayout(res, "pages/contact", { title: "Contacto" }));

// Admin view
app.get("/admin", (req, res) => renderWithLayout(res, "pages/admin", { title: "Admin Panel" }));

// 404
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ msg: "Endpoint no encontrado" });
  }
  return renderWithLayout(res, "pages/404", { title: "No encontrado" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));
