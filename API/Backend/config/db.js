// Backend/config/db.js
const mysql = require("mysql2");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "veterinaria",

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  // En mysql2 es connectTimeout (NO "timeout" ni "acquireTimeout")
  connectTimeout: 10000,
});

const promisePool = pool.promise();

// (Opcional) Mensaje de conexión para debug
pool.getConnection((err, conn) => {
  if (err) {
    console.error("❌ Error al conectar la BD:", err.code, "-", err.message);
    return;
  }
  console.log("✅ Base de datos conectada");
  conn.release();
});

module.exports = { pool, promisePool };
