const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright");


const TENUP_USER = "leau-hiic";
const TENUP_PASSWORD = "31!Vosl!";


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

async function scrapeTenup() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 🔐 LOGIN
  await page.goto("https://tenup.fft.fr/connexion", {
    waitUntil: "networkidle",
  });

  
  
  await page.fill('#username', TENUP_USER);
  await page.fill('#password', TENUP_PASSWORD);



  await Promise.all([
    page.waitForNavigation(),
    page.click('button[type="submit"]'),
  ]);

  // 🎾 PAGE JOUEUR
  await page.goto("https://tenup.fft.fr/classement/7146157482/padel", {
    waitUntil: "networkidle",
  });

  // attend le tableau
  await page.waitForSelector("table");

  // 📊 SCRAP
  const data = await page.evaluate(() => {
    const rows = document.querySelectorAll("tbody tr");

    return [...rows].map(row => {
      const cols = row.querySelectorAll("td");

      return {
        date: cols[0]?.innerText.trim(),
        nom: cols[1]?.innerText.trim(),
        categorie: "", // TenUp ne le donne pas toujours
        partenaire: cols[2]?.innerText.trim(),
        classement: parseInt(cols[3]?.innerText) || 0,
        point: parseInt(cols[4]?.innerText) || 0,
        validite: "",
      };
    });
  });

  await browser.close();

  return data;
}

app.get("/scrape-tenup", async (req, res) => {
  try {
    const tournois = await scrapeTenup();

    // option : on vide avant
    await db.query("DELETE FROM tournois");

    for (const t of tournois) {
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

    res.json({ success: true, count: tournois.length });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
