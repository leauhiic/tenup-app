require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright");

const app = express();
app.use(cors());
app.use(express.json());

const db = require("./db");

// 🔐 ENV
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

    res.send("✅ DB OK");
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// -------------------------
// HEALTHCHECK
// -------------------------
app.get("/", (req, res) => {
  res.send("🚀 TenUp API (Playwright stable) OK");
});

// -------------------------
// SCRAPER CORE
// -------------------------
async function scrapeTenup() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121 Safari/537.36",
    locale: "fr-FR",
  });

  const page = await context.newPage();

  const url =
    "https://tenup.fft.fr/classement/7146157482/padel";

  await page.goto(url, {
    waitUntil: "networkidle",
  });

  await page.waitForTimeout(5000);

  // -------------------------
  // EXTRACTION SAFE JS RUNTIME
  // -------------------------
  const data = await page.evaluate(() => {
    const joueur =
      window.Drupal?.settings?.fft_fiche_joueur || null;

    const competition =
      joueur?.fft_classement?.competition?.data?.rows || [];

    const tournois = competition.map((t) => ({
      date: t.fin || null,
      nom: t.competition || null,
      categorie: t.categorie || null,
      partenaire: t.partenaire || null,
      classement: t.classementEquipe || null,
      point: t.points || 0,
      validite: t.calcul || null,
    }));

    return {
      hasDrupal: !!window.Drupal,
      hasSettings: !!window.Drupal?.settings,
      joueur,
      tournois,
    };
  });

  await browser.close();

  return data;
}

// -------------------------
// SCRAPE ENDPOINT
// -------------------------
app.get("/scrape-tenup", async (req, res) => {
  try {
    if (req.query.key !== SCRAPE_KEY) {
      return res.status(403).send("❌ Forbidden");
    }

    const data = await scrapeTenup();

    if (!data?.joueur) {
      return res.status(500).json({
        error: "Aucune donnée trouvée",
        debug: {
          hasDrupal: data?.hasDrupal,
          hasSettings: data?.hasSettings,
        },
      });
    }

    // -------------------------
    // INSERT DB
    // -------------------------
    for (const t of data.tournois || []) {
      await db.query(
        `
        INSERT INTO tournois
        (date, nom, categorie, partenaire, classement, point, validite)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,
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
      joueur: {
        nom: data.joueur?.nom,
        prenom: data.joueur?.prenom,
        classement:
          data.joueur?.fft_classement?.dernierClassement?.rang,
        points:
          data.joueur?.fft_classement?.dernierClassement?.points,
      },
      tournois: data.tournois?.length || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------
// GET TOURNOIS
// -------------------------
app.get("/tournois", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM tournois ORDER BY date DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------
// DEBUG ENDPOINT
// -------------------------
app.get("/debug", async (req, res) => {
  try {
    const data = await scrapeTenup();

    res.json({
      hasDrupal: data.hasDrupal,
      hasSettings: data.hasSettings,
      tournoisCount: data.tournois?.length || 0,
      sample: data.tournois?.slice(0, 3),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// -------------------------
// START
// -------------------------
app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
