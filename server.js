require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const app = express();
app.use(cors());
app.use(express.json());

const db = require("./db");

// =========================
// CONFIG
// =========================
const SCRAPE_KEY = process.env.SCRAPE_KEY;
const STORAGE_STATE_PATH = path.join(__dirname, "storageState.json");

const URL =
  "https://tenup.fft.fr/classement/7146157482/padel";

// =========================
// INIT DB
// =========================
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
    res.status(500).send(err.message);
  }
});

// =========================
// HEALTHCHECK
// =========================
app.get("/", (req, res) => {
  res.send("🚀 TenUp API OK");
});

// =========================
// LOAD BROWSER CONTEXT
// =========================
async function createContext(browser) {
  if (fs.existsSync(STORAGE_STATE_PATH)) {
    return await browser.newContext({
      storageState: STORAGE_STATE_PATH,
    });
  }

  return await browser.newContext();
}

// =========================
// SCRAPER CORE
// =========================
async function scrapeTenup() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await createContext(browser);
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: "networkidle" });

  // IMPORTANT : on ne force PLUS de login automatique
  // (Keycloak casse le flow en headless sur Railway)

  await page.waitForTimeout(4000);

  // =========================
  // DEBUG INFO
  // =========================
  const debug = await page.evaluate(() => {
    return {
      url: window.location.href,
      hasDrupal: !!window.Drupal,
      drupalKeys: window.Drupal?.settings
        ? Object.keys(window.Drupal.settings)
        : [],
      bodyTextPreview: document.body.innerText.slice(0, 800),
      scriptCount: document.scripts.length,
    };
  });

  // =========================
  // FULL HTML (IMPORTANT)
  // =========================
  const html = await page.content();

  // =========================
  // TRY EXTRACT DRUPAL STATE
  // =========================
  let tournois = [];

  try {
    const drupalSettings = await page.evaluate(() => {
      return window.Drupal?.settings || null;
    });

    const joueur = drupalSettings?.fft_fiche_joueur;

    tournois =
      joueur?.fft_classement?.competition?.data?.rows ||
      [];
  } catch (e) {
    console.log("Drupal parse failed");
  }

  await browser.close();

  return {
    debug,
    html,
    tournois,
  };
}

// =========================
// SCRAPE ENDPOINT
// =========================
app.get("/scrape-tenup", async (req, res) => {
  try {
    if (req.query.key !== SCRAPE_KEY) {
      return res.status(403).send("❌ Forbidden");
    }

    const data = await scrapeTenup();

    // 👇 IMPORTANT : on renvoie TOUT pour debug
    res.json({
      success: true,
      debug: data.debug,
      tournoisCount: data.tournois.length,
      tournois: data.tournois,
      htmlPreview: data.html.slice(0, 2000), // évite payload énorme
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// =========================
// HTML DEBUG FULL PAGE
// =========================
app.get("/debug-html", async (req, res) => {
  try {
    const browser = await chromium.launch({
      headless: true,
    });

    const page = await browser.newPage();

    await page.goto(URL, { waitUntil: "networkidle" });

    const html = await page.content();

    await browser.close();

    res.send(html);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =========================
// DEBUG STATE LIGHT
// =========================
app.get("/debug-state", async (req, res) => {
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(URL, { waitUntil: "networkidle" });

    const state = await page.evaluate(() => ({
      url: location.href,
      drupal: !!window.Drupal,
      keys: window.Drupal?.settings
        ? Object.keys(window.Drupal.settings)
        : [],
    }));

    await browser.close();

    res.json(state);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =========================
// START
// =========================
app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
