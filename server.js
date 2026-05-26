const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const db = require("./db");

app.get("/init-db", async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS tournois (
        id SERIAL PRIMARY KEY,
        date TEXT,
        nom TEXT,
        categorie TEXT,
        partenaire TEXT,
        classement INTEGER,
        point INTEGER,
        validite TEXT
      )
    `);

    res.send("✅ Table créée avec succès");
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

app.get("/", (req, res) => {
  res.send("✅ Backend connecté TenUp OK");
});

// ✅ scraping automatique connecté


app.get("/tournois", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM tournois");

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/tournois", async (req, res) => {
  const { date, nom, categorie, partenaire, classement, point, validite } = req.body;

  try {
    await db.query(
      `INSERT INTO tournois (date, nom, categorie, partenaire, classement, point, validite)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [date, nom, categorie, partenaire, classement, point, validite]
    );

    res.send("✅ Tournoi ajouté");
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const data = require("./tournois-202605.json");

app.get("/import-from-2026mai", async (req, res) => {
  try {
    // ⚠️ nettoie avant import (optionnel)
    await db.query("DELETE FROM tournois");

    for (const t of data) {
      await db.query(
        `INSERT INTO tournois (date, nom, categorie, partenaire, classement, point, validite)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          t["Date"],
          t["Nom"],
          t["Catégorie"],
          t["Partenaire"],
          t["Classement"],
          t["Point"],
          t["Validité"]
        ]
      );
    }

    res.send("✅ Import réussi !");
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

app.listen(3000, () => {
  console.log("✅ Backend prêt");
});
