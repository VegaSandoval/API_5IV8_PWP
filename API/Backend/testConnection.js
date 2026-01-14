require("dotenv").config();
const mysql = require("mysql2/promise");

async function testConnection() {
  try {
    console.log("=== VERIFICACIÓN DE VARIABLES ===");
    console.log("DB_HOST:", process.env.DB_HOST);
    console.log("DB_USER:", process.env.DB_USER);
    console.log("DB_PASS:", process.env.DB_PASS ? "✅ Configurada" : "❌ NO CONFIGURADA");
    console.log("DB_NAME:", process.env.DB_NAME);
    console.log("=================================\n");

    console.log("🔌 Intentando conectar a MySQL...");
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS,
      database: process.env.DB_NAME || 'veterinaria'
    });

    console.log("✅ Conexión exitosa!");

    // Probar una query simple
    const [rows] = await connection.query("SELECT 1 + 1 AS resultado");
    console.log("✅ Query de prueba exitosa:", rows);

    // Verificar que la tabla producto existe
    const [tables] = await connection.query("SHOW TABLES");
    console.log("\n📊 Tablas en la base de datos:");
    tables.forEach(table => {
      console.log("  -", Object.values(table)[0]);
    });

    // Verificar productos
    const [productos] = await connection.query("SELECT COUNT(*) as total FROM producto");
    console.log("\n🛍️  Total de productos:", productos[0].total);

    await connection.end();
    console.log("\n✅ Todo funciona correctamente!");
    process.exit(0);

  } catch (err) {
    console.error("\n❌ ERROR:", err.message);
    console.error("Código:", err.code);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error("\n🔐 Problema de autenticación. Verifica:");
      console.error("  - Usuario: root");
      console.error("  - Contraseña: mono123");
    } else if (err.code === 'ECONNREFUSED') {
      console.error("\n🔌 MySQL no está corriendo. Inicia el servicio:");
      console.error("  - Windows: services.msc → MySQL");
      console.error("  - Mac: brew services start mysql");
      console.error("  - Linux: sudo systemctl start mysql");
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.error("\n📁 La base de datos 'veterinaria' no existe. Créala con:");
      console.error('  mysql -u root -p -e "CREATE DATABASE veterinaria"');
    }
    process.exit(1);
  }
}

testConnection();