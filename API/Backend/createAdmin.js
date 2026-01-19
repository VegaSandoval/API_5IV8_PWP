// API/Backend/createAdmin.js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

// node Backend/createAdmin.js

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@petwoof.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin123!";
const ADMIN_NAME = process.env.ADMIN_NAME || "Administrador";
const ADMIN_PHONE = process.env.ADMIN_PHONE || "0000000000";

const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || process.env.DB_DATABASE || "veterinaria", // ajusta si tu BD se llama distinto
};

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);

  try {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    // ¿Existe el usuario?
    const [rows] = await conn.execute(
      "SELECT id FROM usuario WHERE correo = ? LIMIT 1",
      [ADMIN_EMAIL]
    );

    if (rows.length === 0) {
      // Crear
      await conn.execute(
        `INSERT INTO usuario (nombre, correo, password, telefono, rol, fecha_registro)
         VALUES (?, ?, ?, ?, 'admin', NOW())`,
        [ADMIN_NAME, ADMIN_EMAIL, hash, ADMIN_PHONE]
      );
      console.log("✅ Admin CREADO");
    } else {
      // Actualizar (asegura rol admin + password)
      await conn.execute(
        `UPDATE usuario
         SET nombre = ?, telefono = ?, password = ?, rol = 'admin'
         WHERE id = ?`,
        [ADMIN_NAME, ADMIN_PHONE, hash, rows[0].id]
      );
      console.log("✅ Admin ACTUALIZADO");
    }

    console.log("🔐 Credenciales Admin:");
    console.log("Email:", ADMIN_EMAIL);
    console.log("Password:", ADMIN_PASSWORD);
  } catch (err) {
    console.error("❌ Error creando admin:", err.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
