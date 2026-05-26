require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const app = express();
app.use(cors());
app.use(express.json());

const SCRAPE_KEY = process.env.SCRAPE_KEY;

const STORAGE_PATH = path.join(__dirname, "storageState.json");

const URL =
  "https://tenup.fft.fr/classement/7146157482/padel";

const LOGIN_URL = "https://login.fft.fr/";

// =========================
// INIT SESSION (RAILWAY ONLY)
// =========================
app.get("/init-session", async (req, res) => {
  try {
    const browser = await chromium.launch({
      headless: false, // IMPORTANT pour login interactif
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(LOGIN_URL);

    res.write(
      "👉 Connecte-toi dans la fenêtre Playwright...\n"
    );

    // attendre redirection après login
    await page.waitForURL("**tenup.fft.fr**", {
      timeout: 0,
    });

    await context.storageState({
      path: STORAGE_PATH,
    });

    await browser.close();

    res.end("✅ Session enregistrée sur Railway");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// =========================
// SCRAPER
// =========================
async function scrapeTenup() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = fs.existsSync(STORAGE_PATH)
    ? await browser.newContext({
        storageState: STORAGE_PATH,
      })
    : await browser.newContext();

  const page = await context.newPage();

  await page.goto(URL, {
    waitUntil: "networkidle",
  });

  await page.waitForTimeout(4000);

  const debug = await page.evaluate(() => ({
    url: location.href,
    hasDrupal: !!window.Drupal,
    keys: window.Drupal?.settings
      ? Object.keys(window.Drupal.settings)
      : [],
    text: document.body.innerText.slice(0, 600),
  }));

  const data = await page.evaluate(() => {
    const joueur = window.Drupal?.settings?.fft_fiche_joueur;

    return {
      joueur,
      tournois:
        joueur?.fft_classement?.competition?.data?.rows ||
        [],
    };
  });

  await browser.close();

  return { debug, ...data };
}

// =========================
// ENDPOINT SCRAPE
// =========================
app.get("/scrape-tenup", async (req, res) => {
  try {
    if (req.query.key !== SCRAPE_KEY) {
      return res.status(403).send("Forbidden");
    }

    const data = await scrapeTenup();

    res.json({
      success: true,
      debug: data.debug,
      tournois: data.tournois,
      joueur: data.joueur,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// =========================
// HEALTH
// =========================
app.get("/", (req, res) => {
  res.send("🚀 TenUp Railway API OK");
});

// =========================
// START
// =========================
app.listen(3000, () => {
  console.log("🚀 Server running on Railway");
});
