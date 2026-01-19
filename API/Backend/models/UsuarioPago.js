module.exports = {
  id: "INT AUTO_INCREMENT PRIMARY KEY",
  usuario_id: "INT NOT NULL UNIQUE",

  metodo: "ENUM('efectivo','tarjeta','transferencia','paypal') NULL",
  titular: "VARCHAR(120) NULL",
  marca: "VARCHAR(30) NULL",
  last4: "CHAR(4) NULL",
  exp_mes: "TINYINT NULL",
  exp_anio: "SMALLINT NULL",

  creado: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
  actualizado: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",

  "FOREIGN KEY (usuario_id)": "REFERENCES usuario(id) ON DELETE CASCADE"
};
