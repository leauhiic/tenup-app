const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

let db;
function getDb() {
  if (!db) db = require("./db");
  return db;
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname.endsWith(".vercel.app");
  } catch (err) {
    return false;
  }
}

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin not allowed by CORS"));
  }
}));
app.use(express.json());

const seedData = require("./tournois-202605.json");
const CATEGORIES = new Set(["DM", "DD", "DX"]);

function requireAdmin(req, res, next) {
  if (!ADMIN_API_KEY) {
    return res.status(503).json({ error: "ADMIN_API_KEY is not configured" });
  }

  const authHeader = req.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const token = bearerToken || req.get("x-api-key");

  if (token !== ADMIN_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

function parseDateToISO(value) {
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const frMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (frMatch) {
    const [, day, month, year] = frMatch;
    return `${year}-${month}-${day}`;
  }

  return null;
}

function parsePositiveInteger(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return null;
  return number;
}

function cleanText(value, maxLength = 160) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function validateTournoiPayload(payload = {}) {
  const date = parseDateToISO(payload.date);
  const nom = cleanText(payload.nom);
  const categorie = cleanText(payload.categorie, 2).toUpperCase();
  const partenaire = cleanText(payload.partenaire);
  const classement = parsePositiveInteger(payload.classement);
  const point = parsePositiveInteger(payload.point);
  const validite = cleanText(payload.validite, 20);

  if (!date) return { error: "date must be YYYY-MM-DD or DD/MM/YYYY" };
  if (!nom) return { error: "nom is required" };
  if (!CATEGORIES.has(categorie)) return { error: "categorie must be DM, DD or DX" };
  if (!partenaire) return { error: "partenaire is required" };
  if (!classement) return { error: "classement must be a positive integer" };
  if (!point) return { error: "point must be a positive integer" };

  return { value: { date, nom, categorie, partenaire, classement, point, validite } };
}

async function insertTournoi(tournoi) {
  await getDb().query(
    `INSERT INTO tournois (date, nom, categorie, partenaire, classement, point, validite)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [tournoi.date, tournoi.nom, tournoi.categorie, tournoi.partenaire, tournoi.classement, tournoi.point, tournoi.validite]
  );
}

async function insertTournoiIfMissing(tournoi) {
  await getDb().query(
    `INSERT INTO tournois (date, nom, categorie, partenaire, classement, point, validite)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT DO NOTHING`,
    [tournoi.date, tournoi.nom, tournoi.categorie, tournoi.partenaire, tournoi.classement, tournoi.point, tournoi.validite]
  );
}

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "tenup-api" });
});

app.get("/healthz", (req, res) => {
  res.json({ status: "ok", service: "tenup-api", port: PORT });
});

app.post("/init-db", requireAdmin, async (req, res) => {
  try {
    await getDb().query(`
      CREATE TABLE IF NOT EXISTS tournois (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        nom TEXT NOT NULL,
        categorie TEXT NOT NULL CHECK (categorie IN ('DM', 'DD', 'DX')),
        partenaire TEXT NOT NULL,
        classement INTEGER NOT NULL CHECK (classement > 0),
        point INTEGER NOT NULL CHECK (point > 0),
        validite TEXT
      )
    `);
    await getDb().query(`
      ALTER TABLE tournois
      ALTER COLUMN date TYPE DATE
      USING CASE
        WHEN date::TEXT ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN to_date(date::TEXT, 'DD/MM/YYYY')
        ELSE date::DATE
      END
    `);
    await getDb().query("ALTER TABLE tournois ALTER COLUMN date SET NOT NULL");
    await getDb().query("ALTER TABLE tournois ALTER COLUMN nom SET NOT NULL");
    await getDb().query("ALTER TABLE tournois ALTER COLUMN categorie SET NOT NULL");
    await getDb().query("ALTER TABLE tournois ALTER COLUMN partenaire SET NOT NULL");
    await getDb().query("ALTER TABLE tournois ALTER COLUMN classement SET NOT NULL");
    await getDb().query("ALTER TABLE tournois ALTER COLUMN point SET NOT NULL");
    await getDb().query(`
      CREATE UNIQUE INDEX IF NOT EXISTS tournois_identity_idx
      ON tournois (date, nom, categorie, partenaire, classement, point)
    `);

    res.json({ message: "Table tournois ready" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/tournois", async (req, res) => {
  try {
    const result = await getDb().query(`
      SELECT
        id,
        TO_CHAR(
          CASE
            WHEN date::TEXT ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN to_date(date::TEXT, 'DD/MM/YYYY')
            ELSE date::DATE
          END,
          'DD/MM/YYYY'
        ) AS date,
        nom,
        categorie,
        partenaire,
        classement,
        point,
        validite
      FROM tournois
      ORDER BY
        CASE
          WHEN date::TEXT ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN to_date(date::TEXT, 'DD/MM/YYYY')
          ELSE date::DATE
        END DESC,
        point DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/tournois", requireAdmin, async (req, res) => {
  const validation = validateTournoiPayload(req.body);
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    await insertTournoi(validation.value);
    res.status(201).json({ message: "Tournoi ajoute" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/import-from-2026mai", requireAdmin, async (req, res) => {
  try {
    const replace = req.query.replace === "true";

    if (replace) {
      await getDb().query("TRUNCATE TABLE tournois RESTART IDENTITY");
    }

    let imported = 0;

    for (const t of seedData) {
      const validation = validateTournoiPayload({
        date: t.Date,
        nom: t.Nom,
        categorie: t.Catégorie,
        partenaire: t.Partenaire,
        classement: t.Classement,
        point: t.Point,
        validite: t.Validité
      });

      if (validation.error) {
        throw new Error(`Invalid seed row "${t.Nom}": ${validation.error}`);
      }

      await insertTournoiIfMissing(validation.value);
      imported += 1;
    }

    res.json({ message: "Import reussi", imported, replaced: replace });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

function listen(port) {
  app.listen(port, HOST, () => {
    console.log(`TenUp API listening on ${HOST}:${port}`);
  });
}

listen(PORT);

if (String(PORT) !== "3000") {
  listen(3000);
}
