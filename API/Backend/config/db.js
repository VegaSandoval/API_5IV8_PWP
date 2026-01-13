const mysql = require("mysql2");

// Crear POOL de conexiones (no una sola conexión)
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'veterinaria',
    
    // Configuración del pool
    waitForConnections: true,
    connectionLimit: 10,        // Máximo 10 conexiones simultáneas
    queueLimit: 0,              // Sin límite de cola
    
    // Timeouts
    connectTimeout: 10000,      // 10 segundos para conectar
    acquireTimeout: 10000,      // 10 segundos para obtener conexión del pool
    timeout: 60000,             // 60 segundos para queries
    
    // Encoding y charset
    charset: 'utf8mb4',         // Soporte completo Unicode (emojis, etc)
    
    // Manejo de errores y reconexión
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Probar conexión inicial
pool.getConnection((err, connection) => {
    if (err) {
        console.error("❌ Error al conectar la BD:", err.code);
        console.error("   Mensaje:", err.message);
        
        // Errores comunes con ayuda
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.error("   → La conexión se perdió");
        } else if (err.code === 'ER_CON_COUNT_ERROR') {
            console.error("   → Demasiadas conexiones");
        } else if (err.code === 'ECONNREFUSED') {
            console.error("   → Verifica que MySQL esté corriendo");
        } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error("   → Usuario/contraseña incorrectos");
        }
        
        // NO hacer process.exit() aquí, dejar que el servidor maneje el error
        return;
    }
    
    if (connection) {
        console.log("✅ Base de datos conectada");
        connection.release(); // Devolver conexión al pool
    }
});

// Manejo de errores del pool
pool.on('error', (err) => {
    console.error("❌ Error inesperado en el pool de BD:", err.code);
    
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.error("   → Reconectando...");
        // El pool manejará la reconexión automáticamente
    } else {
        console.error("   → Error crítico:", err.message);
    }
});

// Cerrar pool al terminar la app
process.on('SIGTERM', () => {
    console.log('⚠️  SIGTERM recibido, cerrando pool de BD...');
    pool.end((err) => {
        if (err) {
            console.error('Error al cerrar pool:', err);
        } else {
            console.log('✅ Pool de BD cerrado correctamente');
        }
        process.exit(err ? 1 : 0);
    });
});

process.on('SIGINT', () => {
    console.log('⚠️  SIGINT recibido, cerrando pool de BD...');
    pool.end((err) => {
        if (err) {
            console.error('Error al cerrar pool:', err);
        } else {
            console.log('✅ Pool de BD cerrado correctamente');
        }
        process.exit(err ? 1 : 0);
    });
});

// Exportar tanto el pool normal como la versión con promesas
module.exports = pool;
module.exports.promise = pool.promise();