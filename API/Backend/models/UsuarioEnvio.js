module.exports = {
  id: "INT AUTO_INCREMENT PRIMARY KEY",
  usuario_id: "INT NOT NULL UNIQUE",

  nombre: "VARCHAR(120) NULL",
  telefono: "VARCHAR(20) NULL",

  calle: "VARCHAR(120) NULL",
  num_ext: "VARCHAR(20) NULL",
  num_int: "VARCHAR(20) NULL",
  colonia: "VARCHAR(120) NULL",
  ciudad: "VARCHAR(120) NULL",
  estado: "VARCHAR(120) NULL",
  cp: "VARCHAR(10) NULL",
  referencias: "VARCHAR(255) NULL",

  creado: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
  actualizado: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",

  "FOREIGN KEY (usuario_id)": "REFERENCES usuario(id) ON DELETE CASCADE"
};
