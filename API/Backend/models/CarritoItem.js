module.exports = {
    id: "INT AUTO_INCREMENT PRIMARY KEY",
    carrito_id: "INT NOT NULL",
    producto_id: "INT NOT NULL",
    cantidad: "INT NOT NULL DEFAULT 1",
    actualizado: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    
    // Constraints
    "FOREIGN KEY (carrito_id)": "REFERENCES carrito(id) ON DELETE CASCADE",
    "FOREIGN KEY (producto_id)": "REFERENCES producto(id) ON DELETE CASCADE",
    "UNIQUE KEY unique_carrito_producto": "(carrito_id, producto_id)",
    "CHECK (cantidad > 0)": "cantidad <= 999"
};