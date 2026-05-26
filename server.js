const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright");


const TENUP_USER = "leau-hiic";
const TENUP_PASSWORD = "31!Vosl!";

const path = require("path");

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
  await page.goto("https://tenup.fft.fr/classement/7146157482/padel", {
  waitUntil: "networkidle"
});

// 🔐 Si redirigé vers login
if (page.url().includes("login.fft.fr")) {
  console.log("✅ Redirection vers login FFT");

  // attendre les champs (selectors FFT)
  await page.waitForSelector('input[name="username"]', { timeout: 15000 });

  // remplir login FFT
  await page.fill('input[name="username"]', TENUP_USER);
  await page.fill('input[name="password"]', TENUP_PASSWORD);

  // submit
  await Promise.all([
    page.waitForNavigation(),
    page.click('button[type="submit"]')
  ]);

  console.log("✅ Login effectué");
}

// ✅ maintenant tu es connecté automatiquement

  console.log("URL actuelle:", page.url());
  await page.screenshot({ path: "debug.png" });

  // 🎾 PAGE JOUEUR
 await page.goto("https://tenup.fft.fr/classement/7146157482/padel", {
    waitUntil: "domcontentloaded"
  });
  
  // attendre que la page AJAX se stabilise
  await page.waitForLoadState("networkidle");
  
  // attendre les données (pas juste le DOM)
  await page.waitForFunction(() => {
    return document.querySelectorAll("#custom-table tbody tr").length > 0;
  }, { timeout: 30000 });
  
  // petit délai sécurité
  await page.waitForTimeout(2000);
  
  // 📊 SCRAP
  const tournois = await page.evaluate(() => {
    const rows = document.querySelectorAll("#custom-table tbody tr");
  
    return [...rows].map(row => {
      const cols = row.querySelectorAll("td");
  
      return {
        date: cols[0]?.innerText.trim(),
        nom: cols[1]?.innerText.trim(),
        categorie: cols[2]?.innerText.trim(),
        epreuve: cols[3]?.innerText.trim(),
        partenaire: cols[4]?.innerText.trim(),
        classement: parseInt(cols[5]?.innerText) || 0,
        point: parseInt(cols[6]?.innerText) || 0,
        validite: cols[7]?.innerText.trim(),
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


app.get("/debug-image", (req, res) => {
  res.sendFile(path.join(__dirname, "debug.png"));
});
