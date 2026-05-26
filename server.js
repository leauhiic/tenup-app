require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright");

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
// SCRAPER CORE
// -------------------------
async function scrapeTenup() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  let apiCalls = [];

  // 🔥 capture toutes les réponses JSON
  page.on("response", async (response) => {
    const url = response.url();

    if (
      url.includes("classement") ||
      url.includes("padel") ||
      url.includes("joueur") ||
      url.includes("competition")
    ) {
      try {
        const json = await response.json();
        apiCalls.push({ url, json });
      } catch (e) {}
    }
  });

  const url =
    "https://tenup.fft.fr/classement/7146157482/padel";

  await page.goto(url, { waitUntil: "networkidle" });

  await page.waitForTimeout(8000);

  await browser.close();

  return {
    apiCalls,
  };
}

// -------------------------
// DEBUG ENDPOINT
// -------------------------
app.get("/debug-state", async (req, res) => {
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(
      "https://tenup.fft.fr/classement/7146157482/padel",
      { waitUntil: "networkidle" }
    );

    const state = await page.evaluate(() => {
      return {
        hasDrupal: !!window.Drupal,
        hasDrupalSettings: !!window.drupalSettings,
        joueur:
          window.drupalSettings?.fft_fiche_joueur ||
          window.Drupal?.settings?.fft_fiche_joueur ||
          null,
      };
    });

    await browser.close();

    res.json(state);
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
