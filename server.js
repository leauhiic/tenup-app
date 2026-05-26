require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const STATE_PATH = "./storageState.json";

const URL =
  "https://tenup.fft.fr/classement/7146157482/padel";

// -------------------------
// HEALTH
// -------------------------
app.get("/", (req, res) => {
  res.send("🚀 TenUp scraper OK (session mode)");
});

// -------------------------
// SCRAPE HTML COMPLET
// -------------------------
async function scrapeTenup() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  if (!fs.existsSync(STATE_PATH)) {
    throw new Error(
      "❌ Pas de session. Lance d'abord node login-once.js"
    );
  }

  const context = await browser.newContext({
    storageState: STATE_PATH,
  });

  const page = await context.newPage();

  console.log("🌐 Chargement TenUp avec session...");

  await page.goto(URL, {
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
// ENDPOINT SCRAPE
// -------------------------
app.get("/scrape", async (req, res) => {
  try {
    const data = await scrapeTenup();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// -------------------------
// START
// -------------------------
app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("🔐 Opening Keycloak FFT...");

  await page.goto("https://login.fft.fr/", {
    waitUntil: "networkidle",
  });

  // 🔥 ATTEND N'IMPORTE QUEL INPUT (Keycloak lazy render)
  await page.waitForTimeout(5000);

  // DEBUG utile si ça recasse
  console.log("URL after redirect:", page.url());

  // 🎯 Keycloak peut utiliser différents names selon version
  const username = page.locator(
    'input[name="username"], input#username, input[type="text"]'
  );

  const password = page.locator(
    'input[name="password"], input#password, input[type="password"]'
  );

  await username.first().fill(FFT_USER);
  await password.first().fill(FFT_PASSWORD);

  const submit = page.locator(
    'button[type="submit"], input[type="submit"]'
  );

  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle" }),
    submit.first().click(),
  ]);

  console.log("✅ FFT login completed");

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
