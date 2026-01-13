module.exports = {
    id: "INT AUTO_INCREMENT PRIMARY KEY",
    usuario_id: "INT NOT NULL",
    total: "DECIMAL(10,2) NOT NULL",
    metodo_pago: "ENUM('efectivo', 'tarjeta', 'transferencia', 'paypal') NOT NULL",
    estado: "ENUM('completada', 'cancelada', 'pendiente') DEFAULT 'completada'",
    fecha: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    
    // Foreign key
    "FOREIGN KEY (usuario_id)": "REFERENCES usuario(id) ON DELETE CASCADE",
    
    // Índices
    "INDEX idx_usuario_id": "(usuario_id)",
    "INDEX idx_fecha": "(fecha)",
    "INDEX idx_estado": "(estado)"
};