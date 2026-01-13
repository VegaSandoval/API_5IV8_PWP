module.exports = {
    id: "INT AUTO_INCREMENT PRIMARY KEY",
    venta_id: "INT NOT NULL",
    producto_id: "INT NULL", // NULL si el producto se elimina
    cantidad: "INT NOT NULL",
    precio_unitario: "DECIMAL(10,2) NOT NULL",
    subtotal: "DECIMAL(10,2) NOT NULL",
    
    // Foreign keys
    "FOREIGN KEY (venta_id)": "REFERENCES venta(id) ON DELETE CASCADE",
    "FOREIGN KEY (producto_id)": "REFERENCES producto(id) ON DELETE SET NULL",
    
    // Índices
    "INDEX idx_venta_id": "(venta_id)",
    "INDEX idx_producto_id": "(producto_id)",
    
    // Constraints
    "CHECK (cantidad > 0)": "cantidad > 0",
    "CHECK (precio_unitario >= 0)": "precio_unitario >= 0",
    "CHECK (subtotal >= 0)": "subtotal >= 0"
};