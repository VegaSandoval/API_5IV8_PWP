const db = require("../config/db");
const dbp = db.promise();

exports.getAll = async (req, res) => {
  try {
    const { categoria, color, q } = req.query;

    let sql = "SELECT * FROM producto";
    const where = [];
    const params = [];

    if (categoria) {
      where.push("categoria = ?");
      params.push(categoria);
    }
    if (color) {
      where.push("color = ?");
      params.push(color);
    }
    if (q) {
      where.push("(nombre LIKE ? OR descripcion LIKE ?)");
      params.push(`%${q}%`, `%${q}%`);
    }

    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY id DESC";

    const [rows] = await dbp.query(sql, params);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ msg: "Error", err });
  }
};

exports.getOne = async (req, res) => {
  try {
    const [rows] = await dbp.query("SELECT * FROM producto WHERE id = ? LIMIT 1", [
      req.params.id,
    ]);
    if (rows.length === 0) return res.status(404).json({ msg: "Producto no encontrado" });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ msg: "Error", err });
  }
};

exports.getRelated = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const [baseRows] = await dbp.query(
      "SELECT id, categoria, color FROM producto WHERE id = ? LIMIT 1",
      [id]
    );
    if (baseRows.length === 0) return res.status(404).json({ msg: "Producto no encontrado" });

    const { categoria, color } = baseRows[0];

    const [rows] = await dbp.query(
      `SELECT * FROM producto
       WHERE id <> ?
         AND (categoria = ? OR color = ?)
       ORDER BY id DESC
       LIMIT 8`,
      [id, categoria, color]
    );

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ msg: "Error", err });
  }
};

exports.getMetadata = async (req, res) => {
  try {
    const [cats] = await dbp.query(
      "SELECT DISTINCT categoria FROM producto WHERE categoria IS NOT NULL AND categoria <> '' ORDER BY categoria"
    );
    const [colors] = await dbp.query(
      "SELECT DISTINCT color FROM producto WHERE color IS NOT NULL AND color <> '' ORDER BY color"
    );

    return res.json({
      categorias: cats.map((c) => c.categoria),
      colores: colors.map((c) => c.color),
    });
  } catch (err) {
    return res.status(500).json({ msg: "Error", err });
  }
};
