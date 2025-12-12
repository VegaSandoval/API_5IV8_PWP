const db = require("../config/db");

exports.getAll = (req, res) => {
    db.query("SELECT * FROM producto", (err, data) => {
        if (err) return res.status(500).json({ msg: "Error", err });
        res.json(data);
    });
};

exports.getOne = (req, res) => {
    db.query("SELECT * FROM producto WHERE id = ?", [req.params.id], (err, data) => {
        if (err) return res.status(500).json({ msg: "Error", err });
        res.json(data[0]);
    });
};
