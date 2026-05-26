require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const db = require("./db");

// 🔐 ENV
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
  res.send("🚀 TenUp API OK");
});

// -------------------------
// GET DATA
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
// SCRAPER (DRUPAL STATE BASED)
// -------------------------
async function scrapeTenup() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // anti-bot léger
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });
  });

  const url =
    "https://tenup.fft.fr/classement/7146157482/padel";

  await page.goto(url, {
    waitUntil: "domcontentloaded",
  });

  await page.waitForTimeout(3000);

  // -------------------------
  // LOGIN CHECK
  // -------------------------
  if (page.url().includes("login")) {
    console.log("🔐 Login requis");

    await page.waitForSelector('input[name="username"]');

    await page.fill(
      'input[name="username"]',
      TENUP_USER
    );
    await page.fill(
      'input[name="password"]',
      TENUP_PASSWORD
    );

    await Promise.all([
      page.waitForNavigation({
        waitUntil: "domcontentloaded",
      }),
      page.click('button[type="submit"]'),
    ]);

    console.log("✅ Login OK");
  }

  // -------------------------
  // RELOAD FINAL PAGE
  // -------------------------
  await page.goto(url, {
    waitUntil: "domcontentloaded",
  });

  await page.waitForTimeout(3000);

  // -------------------------
  // EXTRACTION DRUPAL STATE (IMPORTANT)
  // -------------------------
  const data = await page.evaluate(() => {
  const joueur = window.Drupal?.settings?.fft_fiche_joueur;

  return {
    joueur,
    tournois: joueur?.fft_classement?.competition?.data?.rows || []
  };
});
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
      return res
        .status(500)
        .json({ error: "Aucune donnée trouvée" });
    }

    const { joueur, tournois } = data;

    // 🔥 insertion propre des tournois
    for (const t of tournois) {
      await db.query(
        `
        INSERT INTO tournois (date, nom, categorie, partenaire, classement, point, validite)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,
        [
          t.fin,
          t.competition,
          t.categorie || null,
          t.partenaire,
          t.classementEquipe,
          t.points,
          "OK",
        ]
      );
    }

    res.json({
      success: true,
      joueur,
      tournoisCount: tournois.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------
// START
// -------------------------
app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
