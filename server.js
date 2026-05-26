require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright");

const app = express();
app.use(cors());
app.use(express.json());

// -------------------------
// HEALTHCHECK
// -------------------------
app.get("/", (req, res) => {
  res.send("🚀 TenUp HTML Debug OK");
});

// -------------------------
// DEBUG FULL HTML PAGE
// -------------------------
app.get("/debug-html", async (req, res) => {
  let browser;

  try {
    browser = await chromium.launch({
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

    // 1. aller sur la page
    await page.goto(url, {
      waitUntil: "domcontentloaded",
    });

    // 2. laisser le JS finir de charger
    await page.waitForTimeout(8000);

    // -------------------------
    // FULL HTML FINAL (DOM après JS)
    // -------------------------
    const html = await page.content();

    // -------------------------
    // BONUS DEBUG INFO
    // -------------------------
    const debug = await page.evaluate(() => {
      return {
        url: window.location.href,
        hasDrupal: !!window.Drupal,
        drupalKeys: window.Drupal
          ? Object.keys(window.Drupal)
          : [],
        windowKeysSample: Object.keys(window).slice(0, 50),
        bodyTextPreview: document.body.innerText.slice(
          0,
          2000
        ),
        scriptCount: document.scripts.length,
      };
    });

    await browser.close();

    // -------------------------
    // RESPONSE CLEAN
    // -------------------------
    res.json({
      success: true,
      debug,
      html,
    });
  } catch (err) {
    if (browser) await browser.close();

    console.error(err);
    res.status(500).json({
      error: err.message,
    });
  }
});

// -------------------------
// START
// -------------------------
app.listen(3000, () => {
  console.log(
    "🚀 Server running on http://localhost:3000"
  );
});
