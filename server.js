const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const Tournois = [
  {
    "Date": "27/07/2025",
    "Nom": "tournoi interne P250",
    "type": "P250",
    "Catégorie": "DM",
    "Partenaire": "Damien VILLEDIEU",
    "Classement": 3,
    "Point": 188,
    "Validité": "juil-26"
  },
  {
    "Date": "27/07/2025",
    "Nom": "tournoi interne P250",
    "type": "P250",
    "Catégorie": "DX",
    "Partenaire": "Elise SAVARIT",
    "Classement": 4,
    "Point": 180,
    "Validité": "juil-26"
  },
  {
    "Date": "30/01/2026",
    "Nom": "P250 HOMMES",
    "type": "P250",
    "Catégorie": "DM",
    "Partenaire": "Sébastien CREUSOT",
    "Classement": 9,
    "Point": 108,
    "Validité": "janv-27"
  },
  {
    "Date": "12/08/2025",
    "Nom": "P250 H",
    "type": "P250",
    "Catégorie": "DM",
    "Partenaire": "Damien VILLEDIEU",
    "Classement": 9,
    "Point": 108,
    "Validité": "août-26"
  },
  {
    "Date": "15/07/2025",
    "Nom": "P250 HOMMES",
    "type": "P250",
    "Catégorie": "DM",
    "Partenaire": "Mathieu SOUNIER",
    "Classement": 9,
    "Point": 108,
    "Validité": "juil-26"
  },
  {
    "Date": "16/01/2026",
    "Nom": "p250 messieurs",
    "type": "P250",
    "Catégorie": "DM",
    "Partenaire": "Clement TRICHARD",
    "Classement": 6,
    "Point": 100,
    "Validité": "janv-27"
  },
  {
    "Date": "28/01/2026",
    "Nom": "Circuit M+ Matériaux Par Equipes - 4ème étape",
    "type": "P100",
    "Catégorie": "DM",
    "Partenaire": "David SALA",
    "Classement": 3,
    "Point": 70,
    "Validité": "janv-27"
  },
  {
    "Date": "20/08/2025",
    "Nom": "P250 MIXTE SOIREE",
    "type": "P250",
    "Catégorie": "DX",
    "Partenaire": "Chloé CAIZERGUES",
    "Classement": 11,
    "Point": 63,
    "Validité": "août-26"
  },
  {
    "Date": "13/06/2025",
    "Nom": "p250 hommes",
    "type": "P250",
    "Catégorie": "DM",
    "Partenaire": "Vincent ROBERT",
    "Classement": 9,
    "Point": 63,
    "Validité": "juin-26"
  },
  {
    "Date": "06/06/2025",
    "Nom": "P250H Mam's Padel",
    "type": "P250",
    "Catégorie": "DM",
    "Partenaire": "Vincent ROBERT",
    "Classement": 11,
    "Point": 45,
    "Validité": "juin-26"
  },
  {
    "Date": "14/07/2025",
    "Nom": "P100 MIXTE PADEL GENTLE LUNDI 14/07 MATIN",
    "type": "P100",
    "Catégorie": "DX",
    "Partenaire": "Mathilde BENOIT",
    "Classement": 5,
    "Point": 35,
    "Validité": "juil-26"
  },
  {
    "Date": "16/02/2026",
    "Nom": "P250H PUNTACO Padel",
    "type": "P250",
    "Catégorie": "DM",
    "Partenaire": "Stéphane HUYGHE",
    "Classement": 21,
    "Point": 25,
    "Validité": "févr-27"
  },
  {
    "Date": "25/07/2025",
    "Nom": "P250 HOMMES",
    "type": "P250",
    "Catégorie": "DM",
    "Partenaire": "Vincent ROBERT",
    "Classement": 21,
    "Point": 25,
    "Validité": "juil-26"
  },
  {
    "Date": "24/02/2026",
    "Nom": "P100 HOMMES",
    "type": "P100",
    "Catégorie": "DM",
    "Partenaire": "Adrien EMERAUX",
    "Classement": 18,
    "Point": 18,
    "Validité": "févr-27"
  }
];


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

app.get("/tournois", (req, res) => {
  res.json(Tournois);
});



app.get("/tournois2", async (req, res) => {
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

const data = require("./tournois.json");

app.get("/import", async (req, res) => {
  try {
    // ⚠️ nettoie avant import (optionnel)
    await db.query("DELETE FROM tournois");

    for (const t of data) {
      await db.query(
        `INSERT INTO tournois (date, nom, categorie, partenaire, classement, point, validite)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          t.date,
          t.nom,
          t.categorie,
          t.partenaire,
          t.classement,
          t.point,
          t.validite,
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
