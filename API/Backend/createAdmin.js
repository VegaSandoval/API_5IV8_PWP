const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

async function createAdmin() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', // TU PASSWORD
    database: 'veterinaria'
  });

  const hashedPassword = await bcrypt.hash("Admin123!", 10);
  
  await connection.query(
    "UPDATE usuario SET password = ?, rol = 'admin' WHERE correo = 'admin@veterinaria.com'",[hashedPassword]
  );

  console.log("✅ Admin creado");
  console.log("Email: admin@veterinaria.com");
  console.log("Password: Admin123!");
  
  await connection.end();
}

createAdmin();