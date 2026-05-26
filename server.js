require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// -------------------------
// ENV
// -------------------------
const FFT_USER = process.env.TENUP_USER;
const FFT_PASSWORD = process.env.TENUP_PASSWORD;

const STATE_PATH = "./storageState.json";

const TENUP_URL =
  "https://tenup.fft.fr/classement/7146157482/padel";

const LOGIN_URL = "https://login.fft.fr/";

// -------------------------
// INIT
// -------------------------
app.get("/", (req, res) => {
  res.send("🚀 FFT / TenUp scraper API OK");
});

// -------------------------
// LOGIN FFT SSO
// -------------------------
async function loginFFT() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("🔐 Login FFT SSO...");

  await page.goto("https://login.fft.fr/", {
    waitUntil: "domcontentloaded",
  });

  // 👉 attendre explicitement les bons champs
  await page.waitForSelector('input[name="username"]', {
    timeout: 15000,
  });

  await page.waitForSelector('input[name="password"]', {
    timeout: 15000,
  });

  // 👉 remplissage propre
  await page.fill('input[name="username"]', FFT_USER);
  await page.fill('input[name="password"]', FFT_PASSWORD);

  // 👉 bouton submit robuste
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle" }),
    page.click('button[type="submit"], input[type="submit"]'),
  ]);

  console.log("✅ Login FFT OK");

  // sauvegarde session
  await context.storageState({ path: STATE_PATH });

  await browser.close();
}

// -------------------------
// SCRAPE TENUP (AUTH SESSION)
// -------------------------
async function scrapeTenup() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = fs.existsSync(STATE_PATH)
    ? await browser.newContext({ storageState: STATE_PATH })
    : await browser.newContext();

  const page = await context.newPage();

  console.log("🌐 Navigation TenUp...");

  await page.goto(TENUP_URL, {
    waitUntil: "networkidle",
  });

  await page.waitForTimeout(4000);

  const html = await page.content();

  const debug = await page.evaluate(() => {
    return {
      url: window.location.href,
      hasDrupal: !!window.Drupal,
      hasSettings: !!window.Drupal?.settings,
      title: document.title,
      bodyPreview: document.body?.innerText?.slice(0, 300),
    };
  });

  await browser.close();

  return { html, debug };
}

// -------------------------
// ROUTE LOGIN MANUEL
// -------------------------
app.get("/login", async (req, res) => {
  try {
    await loginFFT();
    res.json({ success: true, message: "FFT login session saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------
// SCRAPE HTML COMPLET
// -------------------------
app.get("/scrape-html", async (req, res) => {
  try {
    const data = await scrapeTenup();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------
// DEBUG
// -------------------------
app.get("/debug", async (req, res) => {
  try {
    const data = await scrapeTenup();
    res.json({
      url: data.debug.url,
      hasDrupal: data.debug.hasDrupal,
      hasSettings: data.debug.hasSettings,
      title: data.debug.title,
      preview: data.debug.bodyPreview,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------
// START
// -------------------------
app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
