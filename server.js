require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const db = require("./db");

// 🔐 ENV
const TENUP_USER = process.env.TENUP_USER;
const TENUP_PASSWORD = process.env.TENUP_PASSWORD;
const SCRAPE_KEY = process.env.SCRAPE_KEY;

// -------------------------
// DB INIT
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
// GET DATA
// -------------------------
app.get("/tournois", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM tournois ORDER BY date DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------
// PLAYWRIGHT PERSISTENCE
// -------------------------
const STORAGE_PATH = path.join(__dirname, "storage.json");

// -------------------------
// SCRAPE FUNCTION ROBUSTE
// -------------------------
async function scrapeTenup() {
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext(
    fs.existsSync(STORAGE_PATH)
      ? { storageState: STORAGE_PATH }
      : undefined
  );

  const page = await context.newPage();

  // anti detection léger
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  // -------------------------
  // NAVIGATE
  // -------------------------
  await page.goto(
    "https://tenup.fft.fr/classement/7146157482/padel",
    { waitUntil: "domcontentloaded" }
  );

  await page.waitForTimeout(2000);

  // -------------------------
  // LOGIN IF NEEDED
  // -------------------------
  if (page.url().includes("login")) {
    console.log("🔐 Login détecté");

    await page.waitForSelector('input[name="username"]', { timeout: 30000 });

    await page.fill('input[name="username"]', TENUP_USER);
    await page.fill('input[name="password"]', TENUP_PASSWORD);

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle" }),
      page.click('button[type="submit"]'),
    ]);

    console.log("✅ Login OK");

    // sauvegarde session
    await context.storageState({ path: STORAGE_PATH });
  }

  // -------------------------
  // RELOAD PAGE FINAL
  // -------------------------
  await page.goto(
    "https://tenup.fft.fr/classement/7146157482/padel",
    { waitUntil: "networkidle" }
  );

  await page.waitForTimeout(3000);
  console.log("URL:", page.url());
  
  await page.screenshot({
    path: "debug-tenup-error.png",
    fullPage: true
  });
  
  console.log(await page.content());
  // -------------------------
  // CHECK TABLE AVAILABILITY
  // -------------------------
  try {
    await page.waitForSelector("#custom-table", { timeout: 60000 });

    await page.waitForFunction(() => {
      return document.querySelectorAll("#custom-table tbody tr").length > 0;
    }, { timeout: 60000 });

  } catch (e) {
    console.log("❌ Table non trouvée → debug screenshot");

    await page.screenshot({
      path: "debug-tenup-error.png",
      fullPage: true,
    });

    throw new Error("Table TenUp non chargée");
  }

  // -------------------------
  // SCRAP
  // -------------------------
  const tournois = await page.evaluate(() => {
    const rows = document.querySelectorAll("#custom-table tbody tr");

    const get = (cols, i) =>
      cols[i]?.innerText?.trim() || null;

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
// SCRAPE ENDPOINT SECURISE
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
  const img = path.join(__dirname, "debug-tenup-error.png");
  if (!fs.existsSync(img)) {
    return res.status(404).send("No debug image");
  }
  res.sendFile(img);
});

// -------------------------
// HEALTHCHECK
// -------------------------
app.get("/", (req, res) => {
  res.send("🚀 TenUp API OK");
});

// -------------------------
// START
// -------------------------
app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
