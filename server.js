require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const db = require("./db");

// 🔐 ENV VARS
const TENUP_USER = process.env.TENUP_USER;
const TENUP_PASSWORD = process.env.TENUP_PASSWORD;
const SCRAPE_KEY = process.env.SCRAPE_KEY;

// -------------------------
// INIT DB
// -------------------------
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

// -------------------------
// HEALTH CHECK
// -------------------------
app.get("/", (req, res) => {
  res.send("✅ Backend TenUp OK");
});

// -------------------------
// GET DATA
// -------------------------
app.get("/tournois", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM tournois ORDER BY date DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------
// INSERT MANUEL
// -------------------------
app.post("/tournois", async (req, res) => {
  const { date, nom, categorie, partenaire, classement, point, validite } = req.body;

  try {
    await db.query(
      `INSERT INTO tournois (date, nom, categorie, partenaire, classement, point, validite)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [date, nom, categorie, partenaire, classement, point, validite]
    );

    res.send("✅ Tournoi ajouté");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------
// IMPORT JSON
// -------------------------
const data = require("./tournois-202605.json");

app.get("/import-from-2026mai", async (req, res) => {
  try {
    await db.query("DELETE FROM tournois");

    for (const t of data) {
      await db.query(
        `INSERT INTO tournois (date, nom, categorie, partenaire, classement, point, validite)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          t.Date,
          t["Nom"],
          t["Catégorie"],
          t["Partenaire"],
          t["Classement"],
          t["Point"],
          t["Validité"],
        ]
      );
    }

    res.send("✅ Import JSON terminé");
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// -------------------------
// SCRAPER TENUP
// -------------------------
async function scrapeTenup() {
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    locale: "fr-FR",
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });
  });

  // -------------------------
  // LOGIN
  // -------------------------
  await page.goto("https://tenup.fft.fr/classement/7146157482/padel", {
    waitUntil: "networkidle",
  });

  if (page.url().includes("login.fft.fr")) {
    console.log("🔐 Login requis");

    await page.waitForSelector('input[name="username"]', { timeout: 15000 });

    await page.fill('input[name="username"]', TENUP_USER);
    await page.fill('input[name="password"]', TENUP_PASSWORD);

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle" }),
      page.click('button[type="submit"]'),
    ]);

    console.log("✅ Login OK");
  }

  // -------------------------
  // PAGE CLASSEMENT
  // -------------------------
  await page.goto("https://tenup.fft.fr/classement/7146157482/padel", {
    waitUntil: "networkidle",
  });

  await page.waitForSelector("#custom-table tbody tr", { timeout: 30000 });

  // -------------------------
  // SCRAP DATA
  // -------------------------
  const tournois = await page.evaluate(() => {
    const rows = document.querySelectorAll("#custom-table tbody tr");

    const get = (cols, i) =>
      cols[i]?.innerText?.trim() ? cols[i].innerText.trim() : null;

    return Array.from(rows).map((row) => {
      const cols = row.querySelectorAll("td");

      return {
        date: get(cols, 0),
        nom: get(cols, 1),
        categorie: get(cols, 2),
        epreuve: get(cols, 3),
        partenaire: get(cols, 4),
        classement: parseInt(cols[5]?.innerText) || 0,
        point: parseInt(cols[6]?.innerText) || 0,
        validite: get(cols, 7),
      };
    });
  });

  await browser.close();
  return tournois;
}

// -------------------------
// ENDPOINT SCRAP
// -------------------------
app.get("/scrape-tenup", async (req, res) => {
  try {
    if (req.query.key !== SCRAPE_KEY) {
      return res.status(403).send("❌ Forbidden");
    }

    const tournois = await scrapeTenup();

    await db.query("DELETE FROM tournois");

    for (const t of tournois) {
      await db.query(
        `INSERT INTO tournois (date, nom, categorie, partenaire, classement, point, validite)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
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

    res.json({
      success: true,
      count: tournois.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------
// DEBUG IMAGE
// -------------------------
app.get("/debug-image", (req, res) => {
  res.sendFile(path.join(__dirname, "debug.png"));
});

// -------------------------
// START SERVER
// -------------------------
app.listen(3000, () => {
  console.log("🚀 Backend prêt sur http://localhost:3000");
});
