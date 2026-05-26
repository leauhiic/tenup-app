require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const tough = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");

const app = express();
app.use(cors());
app.use(express.json());

const db = require("./db");

// 🔐 ENV
const TENUP_USER = process.env.TENUP_USER;
const TENUP_PASSWORD = process.env.TENUP_PASSWORD;
const SCRAPE_KEY = process.env.SCRAPE_KEY;

// -------------------------
// HTTP CLIENT (SESSION)
// -------------------------
const jar = new tough.CookieJar();
const client = wrapper(
  axios.create({
    jar,
    withCredentials: true,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    },
  })
);

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
  res.send("🚀 TenUp API (stable) OK");
});

// -------------------------
// LOGIN TENUP (HTTP)
// -------------------------
async function loginTenup() {
  try {
    await client.post(
      "https://tenup.fft.fr/user/login",
      new URLSearchParams({
        name: TENUP_USER,
        pass: TENUP_PASSWORD,
        form_id: "user_login_form",
      }),
      {
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
          Referer: "https://tenup.fft.fr/user/login",
        },
      }
    );

    console.log("✅ Login OK");
  } catch (err) {
    console.error("❌ Login failed:", err.message);
  }
}

// -------------------------
// FETCH PAGE HTML
// -------------------------
async function fetchClassementPage() {
  const res = await client.get(
    "https://tenup.fft.fr/classement/7146157482/padel"
  );

  return res.data;
}

// -------------------------
// EXTRACTION ROBUSTE
// -------------------------
function extractData(html) {
  // 1. joueur (regex safe)
  const joueurMatch = html.match(
    /fft_fiche_joueur\s*:\s*(\{[\s\S]*?\})/
  );

  let joueur = null;

  if (joueurMatch) {
    try {
      joueur = eval("(" + joueurMatch[1] + ")");
    } catch {}
  }

  // 2. fallback tournois (competition rows)
  const tournoisMatch = html.match(
    /"rows"\s*:\s*(\[[\s\S]*?\])/
  );

  let tournois = [];

  if (tournoisMatch) {
    try {
      tournois = JSON.parse(tournoisMatch[1]);
    } catch {}
  }

  return { joueur, tournois };
}

// -------------------------
// CORE SCRAPER (API STYLE)
// -------------------------
async function scrapeTenup() {
  await loginTenup();

  const html = await fetchClassementPage();

  const data = extractData(html);

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
        hint:
          "TenUp HTML structure changed or login failed",
      });
    }

    const { joueur, tournois } = data;

    // -------------------------
    // INSERT DB
    // -------------------------
    for (const t of tournois || []) {
      await db.query(
        `
        INSERT INTO tournois 
        (date, nom, categorie, partenaire, classement, point, validite)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,
        [
          t.fin || null,
          t.competition || null,
          t.categorie || null,
          t.partenaire || null,
          t.classementEquipe || null,
          t.points || 0,
          "OK",
        ]
      );
    }

    res.json({
      success: true,
      joueur: {
        nom: joueur?.nom,
        prenom: joueur?.prenom,
        classement:
          joueur?.fft_classement?.dernierClassement?.rang,
        points:
          joueur?.fft_classement?.dernierClassement?.points,
      },
      tournoisCount: tournois?.length || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------
// DEBUG ENDPOINT
// -------------------------
app.get("/debug", async (req, res) => {
  try {
    const html = await fetchClassementPage();

    res.json({
      htmlPreview: html.slice(0, 5000),
      hasCompetition: html.includes("competition"),
      hasRows: html.includes("rows"),
      hasJoueur: html.includes("fft_fiche_joueur"),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
// START
// -------------------------
app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
