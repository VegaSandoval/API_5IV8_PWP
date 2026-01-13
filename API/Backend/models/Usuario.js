module.exports = {
    id: "INT AUTO_INCREMENT PRIMARY KEY",
    nombre: "VARCHAR(100) NOT NULL",
    correo: "VARCHAR(100) UNIQUE NOT NULL",
    password: "VARCHAR(255) NOT NULL",
    telefono: "VARCHAR(20) NULL",
    rol: "ENUM('admin', 'cliente') DEFAULT 'cliente'",
    refresh_token: "TEXT NULL",
    fecha_registro: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    ultimo_login: "TIMESTAMP NULL"
};