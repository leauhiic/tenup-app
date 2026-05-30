const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ADMIN_API_KEY;
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || ADMIN_API_KEY;
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
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
    const { hostname, protocol } = new URL(origin);
    if (protocol === "chrome-extension:" || protocol === "moz-extension:") return true;
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

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function signTokenBody(body) {
  return crypto
    .createHmac("sha256", ADMIN_TOKEN_SECRET)
    .update(body)
    .digest("base64url");
}

function safeCompare(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function createAdminToken() {
  const payload = {
    role: "admin",
    exp: Date.now() + TOKEN_TTL_MS
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${signTokenBody(body)}`;
}

function verifyAdminToken(token) {
  if (!ADMIN_TOKEN_SECRET || typeof token !== "string") return false;

  const [body, signature] = token.split(".");
  if (!body || !signature) return false;
  if (!safeCompare(signature, signTokenBody(body))) return false;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.role === "admin" && Number(payload.exp) > Date.now();
  } catch (err) {
    return false;
  }
}

function getBearerToken(req) {
  const authHeader = req.get("authorization") || "";
  return authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
}

function requireAdmin(req, res, next) {
  const bearerToken = getBearerToken(req);
  const apiKey = req.get("x-api-key");

  if (ADMIN_API_KEY && apiKey && safeCompare(apiKey, ADMIN_API_KEY)) {
    next();
    return;
  }

  if (bearerToken && verifyAdminToken(bearerToken)) {
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized" });
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

function parseBoolean(value, defaultValue = false) {
  if (value === true || value === false) return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
}

function cleanText(value, maxLength = 160) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function validateTournoiPayload(payload = {}, options = {}) {
  const date = parseDateToISO(payload.date);
  const nom = cleanText(payload.nom);
  const categorie = cleanText(payload.categorie, 2).toUpperCase();
  const partenaire = cleanText(payload.partenaire);
  const classement = parsePositiveInteger(payload.classement);
  const point = parsePositiveInteger(payload.point);
  const validite = cleanText(payload.validite, 20);
  const manuel = parseBoolean(payload.manuel, options.defaultManuel === true);

  if (!date) return { error: "date must be YYYY-MM-DD or DD/MM/YYYY" };
  if (!nom) return { error: "nom is required" };
  if (!CATEGORIES.has(categorie)) return { error: "categorie must be DM, DD or DX" };
  if (!partenaire) return { error: "partenaire is required" };
  if (!classement) return { error: "classement must be a positive integer" };
  if (!point) return { error: "point must be a positive integer" };

  return { value: { date, nom, categorie, partenaire, classement, point, validite, manuel } };
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function insertTournoi(tournoi) {
  await getDb().query(
    `INSERT INTO tournois (date, nom, categorie, partenaire, classement, point, validite, manuel)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [tournoi.date, tournoi.nom, tournoi.categorie, tournoi.partenaire, tournoi.classement, tournoi.point, tournoi.validite, tournoi.manuel === true]
  );
}

function normalizeMatchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function namesLikelyMatch(left, right) {
  const a = normalizeMatchText(left);
  const b = normalizeMatchText(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  const leftType = a.match(/\bp\d+\b/)?.[0];
  const rightType = b.match(/\bp\d+\b/)?.[0];
  return Boolean(leftType && rightType && leftType === rightType);
}

async function findExactTournoi(tournoi) {
  const result = await getDb().query(
    `SELECT id, manuel
     FROM tournois
     WHERE date = $1::date
       AND nom = $2
       AND categorie = $3
       AND LOWER(partenaire) = LOWER($4)
       AND classement = $5
       AND point = $6
     ORDER BY manuel DESC, id ASC
     LIMIT 1`,
    [tournoi.date, tournoi.nom, tournoi.categorie, tournoi.partenaire, tournoi.classement, tournoi.point]
  );

  return result.rows[0] || null;
}

async function findManualTournoiMatch(tournoi) {
  const result = await getDb().query(
    `SELECT id, nom
     FROM tournois
     WHERE manuel = true
       AND date = $1::date
       AND categorie = $2
       AND LOWER(partenaire) = LOWER($3)
     ORDER BY id ASC`,
    [tournoi.date, tournoi.categorie, tournoi.partenaire]
  );

  if (result.rows.length === 1) return result.rows[0];
  return result.rows.find(row => namesLikelyMatch(row.nom, tournoi.nom)) || null;
}

async function updateTournoiFromImport(id, tournoi) {
  await getDb().query(
    `UPDATE tournois
     SET date = $1,
         nom = $2,
         categorie = $3,
         partenaire = $4,
         classement = $5,
         point = $6,
         validite = $7,
         manuel = false
     WHERE id = $8`,
    [tournoi.date, tournoi.nom, tournoi.categorie, tournoi.partenaire, tournoi.classement, tournoi.point, tournoi.validite, id]
  );
}

async function deleteTournoiById(id) {
  await getDb().query("DELETE FROM tournois WHERE id = $1", [id]);
}

async function insertTournoiIfMissing(tournoi, options = {}) {
  const imported = options.imported === true;
  const row = {
    ...tournoi,
    manuel: imported ? false : tournoi.manuel === true
  };

  const existing = await findExactTournoi(row);

  if (imported) {
    const manualMatch = await findManualTournoiMatch(row);
    if (manualMatch) {
      if (existing && existing.id !== manualMatch.id) {
        await deleteTournoiById(manualMatch.id);
        return "updated";
      }

      await updateTournoiFromImport(manualMatch.id, row);
      return "updated";
    }
  }

  if (existing) return "skipped";

  const result = await getDb().query(
    `INSERT INTO tournois (date, nom, categorie, partenaire, classement, point, validite, manuel)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [row.date, row.nom, row.categorie, row.partenaire, row.classement, row.point, row.validite, row.manuel]
  );

  return result.rowCount > 0 ? "inserted" : "skipped";
}

async function ensureTournoisSchema() {
  await getDb().query(`
    CREATE TABLE IF NOT EXISTS tournois (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      nom TEXT NOT NULL,
      categorie TEXT NOT NULL CHECK (categorie IN ('DM', 'DD', 'DX')),
      partenaire TEXT NOT NULL,
      classement INTEGER NOT NULL CHECK (classement > 0),
      point INTEGER NOT NULL CHECK (point > 0),
      validite TEXT,
      manuel BOOLEAN NOT NULL DEFAULT false
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
  await getDb().query("ALTER TABLE tournois ADD COLUMN IF NOT EXISTS manuel BOOLEAN");
  await getDb().query("UPDATE tournois SET manuel = false WHERE manuel IS NULL");
  await getDb().query("ALTER TABLE tournois ALTER COLUMN manuel SET DEFAULT false");
  await getDb().query("ALTER TABLE tournois ALTER COLUMN manuel SET NOT NULL");
  await getDb().query("ALTER TABLE tournois ALTER COLUMN date SET NOT NULL");
  await getDb().query("ALTER TABLE tournois ALTER COLUMN nom SET NOT NULL");
  await getDb().query("ALTER TABLE tournois ALTER COLUMN categorie SET NOT NULL");
  await getDb().query("ALTER TABLE tournois ALTER COLUMN partenaire SET NOT NULL");
  await getDb().query("ALTER TABLE tournois ALTER COLUMN classement SET NOT NULL");
  await getDb().query("ALTER TABLE tournois ALTER COLUMN point SET NOT NULL");
  await getDb().query(`
    CREATE INDEX IF NOT EXISTS tournois_lookup_idx
    ON tournois (date, categorie, partenaire, classement, point)
  `);
}

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "tenup-api" });
});

app.get("/healthz", (req, res) => {
  res.json({ status: "ok", service: "tenup-api", port: PORT });
});

app.post("/auth/login", (req, res) => {
  if (!ADMIN_PASSWORD || !ADMIN_TOKEN_SECRET) {
    res.status(503).json({ error: "Admin login is not configured" });
    return;
  }

  if (!safeCompare(req.body?.password, ADMIN_PASSWORD)) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  res.json({
    token: createAdminToken(),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString()
  });
});

app.get("/auth/me", requireAdmin, (req, res) => {
  res.json({ role: "admin" });
});

app.post("/init-db", requireAdmin, async (req, res) => {
  try {
    await ensureTournoisSchema();
    res.json({ message: "Table tournois ready" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/tournois", async (req, res) => {
  try {
    await ensureTournoisSchema();
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
        validite,
        manuel
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
  const validation = validateTournoiPayload(req.body, { defaultManuel: true });
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    await ensureTournoisSchema();
    const result = await insertTournoiIfMissing(validation.value);
    if (result === "skipped") {
      return res.json({ message: "Tournoi deja existant", skipped: true });
    }

    res.status(201).json({ message: "Tournoi ajoute" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/tournois/:id", requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid tournament id" });
  }

  const validation = validateTournoiPayload(req.body);
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    await ensureTournoisSchema();
    const t = validation.value;
    const result = await getDb().query(
      `UPDATE tournois
       SET date = $1, nom = $2, categorie = $3, partenaire = $4, classement = $5, point = $6, validite = $7, manuel = $8
       WHERE id = $9`,
      [t.date, t.nom, t.categorie, t.partenaire, t.classement, t.point, t.validite, t.manuel, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    res.json({ message: "Tournoi modifie" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/tournois/:id", requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid tournament id" });
  }

  try {
    const result = await getDb().query("DELETE FROM tournois WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    res.json({ message: "Tournoi supprime" });
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

      if (await insertTournoiIfMissing(validation.value) === "inserted") {
        imported += 1;
      }
    }

    res.json({ message: "Import reussi", imported, replaced: replace });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

require("./sync-routes")(app, {
  requireAdmin,
  validateTournoiPayload,
  insertTournoiIfMissing,
  ensureTournoisSchema,
  getDb,
  cleanText
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    next(err);
    return;
  }

  res.status(err.message === "Origin not allowed by CORS" ? 403 : 500).json({
    error: err.message || "Internal Server Error"
  });
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
