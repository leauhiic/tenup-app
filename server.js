const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ADMIN_API_KEY;
const ADMIN_TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET || ADMIN_API_KEY || ADMIN_PASSWORD;
const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tenup.local";
const DEFAULT_ADMIN_NAME = process.env.ADMIN_NAME || "Loic Vossier";
const DEFAULT_ADMIN_TENUP_ID = process.env.ADMIN_TENUP_ID || "7146157482";
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const PASSWORD_KEYLEN = 32;
const PASSWORD_ITERATIONS = 120000;
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
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
    if (protocol === "chrome-extension:" || protocol === "moz-extension:")
      return true;
    return hostname === "localhost" || hostname.endsWith(".vercel.app");
  } catch (err) {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    },
  }),
);
app.use(express.json());
app.use((req, res, next) => {
  if (req.url === "/api") req.url = "/";
  else if (req.url.startsWith("/api/")) req.url = req.url.slice(4);
  next();
});

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
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${signTokenBody(body)}`;
}

function createUserToken(user) {
  const payload = {
    role: user.role || "user",
    userId: user.id,
    email: user.email,
    name: user.name || "",
    tenupId: user.tenupId || user.tenup_id || "",
    approved: user.approved === true,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${signTokenBody(body)}`;
}

function verifyToken(token) {
  if (!ADMIN_TOKEN_SECRET || typeof token !== "string") return false;

  const [body, signature] = token.split(".");
  if (!body || !signature) return false;
  if (!safeCompare(signature, signTokenBody(body))) return false;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (Number(payload.exp) <= Date.now()) return false;
    return payload;
  } catch (err) {
    return false;
  }
}

function verifyAdminToken(token) {
  const payload = verifyToken(token);
  return Boolean(payload && payload.role === "admin");
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

function getOptionalUser(req) {
  const payload = verifyToken(getBearerToken(req));
  return payload &&
    ["user", "admin"].includes(payload.role) &&
    payload.userId &&
    payload.approved === true
    ? {
        id: payload.userId,
        email: payload.email,
        name: payload.name || "",
        role: payload.role,
        tenupId: payload.tenupId || "",
        approved: true,
      }
    : null;
}

function requireUser(req, res, next) {
  const user = getOptionalUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.user = user;
  next();
}

function requireAdminUser(req, res, next) {
  requireUser(req, res, () => {
    if (req.user.role !== "admin") {
      res.status(403).json({ error: "Admin required" });
      return;
    }

    next();
  });
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

function cleanEmail(value) {
  return cleanText(value, 254).toLowerCase();
}

function cleanTenupId(value) {
  const text = cleanText(value, 240).replace(/\s+/g, "");
  if (/^\d{6,20}$/.test(text)) return text;

  const classementMatch = text.match(/classement\/(\d{6,20})/i);
  if (classementMatch) return classementMatch[1];

  const digitMatch = text.match(/\d{6,20}/);
  return digitMatch ? digitMatch[0] : "";
}

function validateUserPayload(
  payload = {},
  { requireName = false, requireTenupId = false } = {},
) {
  const email = cleanEmail(payload.email);
  const password = typeof payload.password === "string" ? payload.password : "";
  const name = cleanText(payload.name, 80);
  const tenupId = cleanTenupId(payload.tenupId || payload.tenup_id);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "email is invalid" };
  }
  if (password.length < 8) {
    return { error: "password must be at least 8 characters" };
  }
  if (requireName && !name) {
    return { error: "name is required" };
  }
  if (requireTenupId && !tenupId) {
    return { error: "tenup id is required" };
  }
  if (tenupId && !/^\d{6,20}$/.test(tenupId)) {
    return { error: "tenup id is invalid" };
  }

  return { value: { email, password, name, tenupId } };
}

function hashPassword(
  password,
  salt = crypto.randomBytes(16).toString("base64url"),
) {
  const hash = crypto
    .pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEYLEN, "sha256")
    .toString("base64url");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  return safeCompare(hash, expectedHash);
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
  if (!CATEGORIES.has(categorie))
    return { error: "categorie must be DM, DD or DX" };
  if (!partenaire) return { error: "partenaire is required" };
  if (!classement) return { error: "classement must be a positive integer" };
  if (!point) return { error: "point must be a positive integer" };

  return {
    value: {
      date,
      nom,
      categorie,
      partenaire,
      classement,
      point,
      validite,
      manuel,
    },
  };
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function insertTournoi(tournoi) {
  await getDb().query(
    `INSERT INTO tournois (date, nom, categorie, partenaire, classement, point, validite, manuel, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      tournoi.date,
      tournoi.nom,
      tournoi.categorie,
      tournoi.partenaire,
      tournoi.classement,
      tournoi.point,
      tournoi.validite,
      tournoi.manuel === true,
      tournoi.userId || null,
    ],
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

async function findExactTournoi(tournoi, userId = null) {
  const result = await getDb().query(
    `SELECT id, manuel
     FROM tournois
     WHERE date = $1::date
       AND nom = $2
       AND categorie = $3
       AND LOWER(partenaire) = LOWER($4)
       AND classement = $5
         AND point = $6
         AND (
           ($7::integer IS NULL AND user_id IS NULL)
           OR ($7::integer IS NOT NULL AND user_id = $7::integer)
         )
     ORDER BY manuel DESC, id ASC
     LIMIT 1`,
    [
      tournoi.date,
      tournoi.nom,
      tournoi.categorie,
      tournoi.partenaire,
      tournoi.classement,
      tournoi.point,
      userId,
    ],
  );

  return result.rows[0] || null;
}

async function findManualTournoiMatch(tournoi, userId = null) {
  const result = await getDb().query(
    `SELECT id, nom
     FROM tournois
     WHERE manuel = true
       AND date = $1::date
       AND categorie = $2
       AND LOWER(partenaire) = LOWER($3)
       AND (
         ($4::integer IS NULL AND user_id IS NULL)
         OR ($4::integer IS NOT NULL AND user_id = $4::integer)
       )
     ORDER BY id ASC`,
    [tournoi.date, tournoi.categorie, tournoi.partenaire, userId],
  );

  if (result.rows.length === 1) return result.rows[0];
  return (
    result.rows.find((row) => namesLikelyMatch(row.nom, tournoi.nom)) || null
  );
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
    [
      tournoi.date,
      tournoi.nom,
      tournoi.categorie,
      tournoi.partenaire,
      tournoi.classement,
      tournoi.point,
      tournoi.validite,
      id,
    ],
  );
}

async function deleteTournoiById(id) {
  await getDb().query("DELETE FROM tournois WHERE id = $1", [id]);
}

async function insertTournoiIfMissing(tournoi, options = {}) {
  const imported = options.imported === true;
  const userId = options.userId || null;
  const row = {
    ...tournoi,
    manuel: imported ? false : tournoi.manuel === true,
  };

  const existing = await findExactTournoi(row, userId);

  if (imported) {
    const manualMatch = await findManualTournoiMatch(row, userId);
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
    `INSERT INTO tournois (date, nom, categorie, partenaire, classement, point, validite, manuel, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      row.date,
      row.nom,
      row.categorie,
      row.partenaire,
      row.classement,
      row.point,
      row.validite,
      row.manuel,
      userId,
    ],
  );

  return result.rowCount > 0 ? "inserted" : "skipped";
}

async function ensureTournoisSchema() {
  await ensureUsersSchema();
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
      manuel BOOLEAN NOT NULL DEFAULT false,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
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
  await getDb().query(
    "ALTER TABLE tournois ADD COLUMN IF NOT EXISTS manuel BOOLEAN",
  );
  await getDb().query(
    "ALTER TABLE tournois ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE",
  );
  await getDb().query(
    "UPDATE tournois SET manuel = false WHERE manuel IS NULL",
  );
  await getDb().query(
    "ALTER TABLE tournois ALTER COLUMN manuel SET DEFAULT false",
  );
  await getDb().query("ALTER TABLE tournois ALTER COLUMN manuel SET NOT NULL");
  await getDb().query("ALTER TABLE tournois ALTER COLUMN date SET NOT NULL");
  await getDb().query("ALTER TABLE tournois ALTER COLUMN nom SET NOT NULL");
  await getDb().query(
    "ALTER TABLE tournois ALTER COLUMN categorie SET NOT NULL",
  );
  await getDb().query(
    "ALTER TABLE tournois ALTER COLUMN partenaire SET NOT NULL",
  );
  await getDb().query(
    "ALTER TABLE tournois ALTER COLUMN classement SET NOT NULL",
  );
  await getDb().query("ALTER TABLE tournois ALTER COLUMN point SET NOT NULL");
  await getDb().query(`
    CREATE INDEX IF NOT EXISTS tournois_lookup_idx
    ON tournois (date, categorie, partenaire, classement, point)
  `);
  await getDb().query(
    "CREATE INDEX IF NOT EXISTS tournois_user_id_idx ON tournois (user_id)",
  );

  const adminUser = await ensureDefaultAdminUser(true);
  if (adminUser?.id) {
    await getDb().query(
      "UPDATE tournois SET user_id = $1 WHERE user_id IS NULL",
      [adminUser.id],
    );
  }
}

async function ensureUsersSchema() {
  await getDb().query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      tenup_id TEXT,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      approved BOOLEAN NOT NULL DEFAULT false,
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await getDb().query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS tenup_id TEXT",
  );
  await getDb().query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT");
  await getDb().query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS approved BOOLEAN",
  );
  await getDb().query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ",
  );
  await getDb().query(
    "UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''",
  );
  await getDb().query(
    "UPDATE users SET approved = false WHERE approved IS NULL",
  );
  await getDb().query("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user'");
  await getDb().query("ALTER TABLE users ALTER COLUMN role SET NOT NULL");
  await getDb().query(
    "ALTER TABLE users ALTER COLUMN approved SET DEFAULT false",
  );
  await getDb().query("ALTER TABLE users ALTER COLUMN approved SET NOT NULL");
  await getDb().query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_tenup_id_idx
    ON users (tenup_id)
    WHERE tenup_id IS NOT NULL AND tenup_id <> ''
  `);
  await ensureDefaultAdminUser(false);
}

function serializeUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    tenupId: row.tenup_id || row.tenupId || "",
    role: row.role || "user",
    approved: row.approved === true,
    createdAt: row.created_at || row.createdAt || null,
    approvedAt: row.approved_at || row.approvedAt || null,
  };
}

async function ensureDefaultAdminUser() {
  if (!ADMIN_PASSWORD) return null;

  const email = cleanEmail(DEFAULT_ADMIN_EMAIL);
  const name = cleanText(DEFAULT_ADMIN_NAME, 80) || "Admin";
  const tenupId = cleanTenupId(DEFAULT_ADMIN_TENUP_ID);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

  const password = hashPassword(ADMIN_PASSWORD);
  const result = await getDb().query(
    `INSERT INTO users (email, name, tenup_id, password_hash, password_salt, role, approved, approved_at)
     VALUES ($1, $2, NULLIF($3, ''), $4, $5, 'admin', true, NOW())
     ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           tenup_id = EXCLUDED.tenup_id,
           role = 'admin',
           approved = true,
           approved_at = COALESCE(users.approved_at, NOW())
     RETURNING id, email, name, tenup_id, role, approved, created_at, approved_at`,
    [email, name, tenupId, password.hash, password.salt],
  );

  return serializeUser(result.rows[0]);
}

async function getDefaultAdminUser() {
  await ensureUsersSchema();
  const email = cleanEmail(DEFAULT_ADMIN_EMAIL);
  const result = await getDb().query(
    `SELECT id, email, name, tenup_id, role, approved, created_at, approved_at
     FROM users
     WHERE email = $1 AND role = 'admin'
     LIMIT 1`,
    [email],
  );

  return result.rows[0] ? serializeUser(result.rows[0]) : null;
}

async function findUserByTenupId(value) {
  const tenupId = cleanTenupId(value);
  if (!tenupId) return null;

  await ensureUsersSchema();
  const result = await getDb().query(
    `SELECT id, email, name, tenup_id, role, approved, created_at, approved_at
     FROM users
     WHERE tenup_id = $1
     LIMIT 1`,
    [tenupId],
  );

  return result.rows[0] ? serializeUser(result.rows[0]) : null;
}

function serializeUserTableRow(row) {
  const firstName = cleanText(row.firstName || row.first_name || "", 80);
  const lastName = cleanText(row.lastName || row.last_name || "", 80);
  const name =
    cleanText(`${firstName} ${lastName}`.trim(), 80) ||
    cleanText(row.email || "", 80) ||
    "Utilisateur";
  const role = cleanText(row.role || "", 40).toLowerCase();
  const status = cleanText(row.status || "", 40).toLowerCase();

  return {
    externalId: row.id,
    email: cleanEmail(row.email),
    name,
    tenupId: cleanTenupId(row.tenupProfileUrl || row.tenup_profile_url),
    role: role === "admin" ? "admin" : "user",
    approved: status === "approved",
    createdAt: row.createdAt || row.created_at || null,
  };
}

async function getUserTableRowByTenupId(value) {
  const tenupId = cleanTenupId(value);
  if (!tenupId) return null;

  const result = await getDb().query(
    `SELECT id, email, "firstName", "lastName", role, status, "tenupProfileUrl", "createdAt"
     FROM "User"
     WHERE regexp_replace(COALESCE("tenupProfileUrl", ''), '\\D', '', 'g') = $1
     ORDER BY role = 'admin' DESC, "createdAt" ASC NULLS LAST, id ASC
     LIMIT 1`,
    [tenupId],
  );

  return result.rows[0] ? serializeUserTableRow(result.rows[0]) : null;
}

async function listUserTableTenupIds() {
  const result = await getDb().query(`
    SELECT id, email, "firstName", "lastName", role, status, "tenupProfileUrl", "createdAt"
    FROM "User"
    WHERE status = 'approved'
      AND "tenupProfileUrl" IS NOT NULL
      AND trim("tenupProfileUrl") <> ''
    ORDER BY role = 'admin' DESC, "createdAt" ASC NULLS LAST, id ASC
  `);
  const seen = new Set();

  return result.rows
    .map(serializeUserTableRow)
    .map((user) => user.tenupId)
    .filter(Boolean)
    .filter((tenupId) => {
      if (seen.has(tenupId)) return false;
      seen.add(tenupId);
      return true;
    });
}

async function ensureInternalUserFromUserTable(externalUser) {
  if (!externalUser?.tenupId || !externalUser.email) return null;

  await ensureUsersSchema();
  const existing = await getDb().query(
    `SELECT id, email, name, tenup_id, role, approved, created_at, approved_at
     FROM users
     WHERE tenup_id = $1 OR email = $2
     ORDER BY tenup_id = $1 DESC, id ASC
     LIMIT 1`,
    [externalUser.tenupId, externalUser.email],
  );

  if (existing.rows[0]) {
    const result = await getDb().query(
      `UPDATE users
       SET email = $1,
           name = $2,
           tenup_id = $3,
           role = $4,
           approved = $5,
           approved_at = CASE
             WHEN $5 = true THEN COALESCE(approved_at, NOW())
             ELSE approved_at
           END
       WHERE id = $6
       RETURNING id, email, name, tenup_id, role, approved, created_at, approved_at`,
      [
        externalUser.email,
        externalUser.name,
        externalUser.tenupId,
        externalUser.role,
        externalUser.approved,
        existing.rows[0].id,
      ],
    );

    return serializeUser(result.rows[0]);
  }

  const placeholderPassword = hashPassword(
    crypto.randomBytes(32).toString("base64url"),
  );
  const result = await getDb().query(
    `INSERT INTO users (email, name, tenup_id, password_hash, password_salt, role, approved, approved_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $7 = true THEN NOW() ELSE NULL END)
     RETURNING id, email, name, tenup_id, role, approved, created_at, approved_at`,
    [
      externalUser.email,
      externalUser.name,
      externalUser.tenupId,
      placeholderPassword.hash,
      placeholderPassword.salt,
      externalUser.role,
      externalUser.approved,
    ],
  );

  return serializeUser(result.rows[0]);
}

async function findSyncOwnerByTenupId(value) {
  const externalUser = await getUserTableRowByTenupId(value);
  if (externalUser) return ensureInternalUserFromUserTable(externalUser);

  return findUserByTenupId(value);
}

function getScopeInput(req) {
  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body
      : {};

  return {
    userId: parseId(
      req.query.userId ||
        req.query.user_id ||
        body.userId ||
        body.user_id,
    ),
    tenupId: cleanTenupId(
      req.query.tenupId ||
        req.query.tenup_id ||
        body.tenupId ||
        body.tenup_id ||
        "",
    ),
  };
}

async function resolveScopedUser(req) {
  if (!req.user) return null;
  if (req.user.role !== "admin") return req.user;

  const { userId, tenupId } = getScopeInput(req);
  if (!userId && !tenupId) return req.user;

  await ensureUsersSchema();
  const result = await getDb().query(
    `SELECT id, email, name, tenup_id, role, approved, created_at, approved_at
     FROM users
     WHERE approved = true
       AND ($1::integer IS NULL OR id = $1::integer)
       AND ($2::text = '' OR tenup_id = $2::text)
     LIMIT 1`,
    [userId, tenupId],
  );

  return result.rows[0] ? serializeUser(result.rows[0]) : null;
}

async function getScopedUserOrRespond(req, res) {
  const user = await resolveScopedUser(req);
  if (!user?.id) {
    res.status(404).json({ error: "Compte cible introuvable" });
    return null;
  }

  return user;
}

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "tenup-api" });
});

app.get("/healthz", (req, res) => {
  res.json({ status: "ok", service: "tenup-api", port: PORT });
});

app.post("/auth/register", async (req, res) => {
  const validation = validateUserPayload(req.body, {
    requireName: true,
    requireTenupId: true,
  });
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    await ensureUsersSchema();
    const user = validation.value;
    const password = hashPassword(user.password);
    const result = await getDb().query(
      `INSERT INTO users (email, name, tenup_id, password_hash, password_salt, role, approved)
       VALUES ($1, $2, $3, $4, $5, 'user', false)
       RETURNING id, email, name, tenup_id, role, approved, created_at, approved_at`,
      [user.email, user.name, user.tenupId, password.hash, password.salt],
    );
    const createdUser = serializeUser(result.rows[0]);

    res.status(201).json({
      user: createdUser,
      pending: true,
      message: "Compte cree, en attente de validation admin",
    });
  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(409)
        .json({
          error: "Un compte existe deja avec cet email ou cet ID TenUp",
        });
    }

    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/auth/login", async (req, res) => {
  const validation = validateUserPayload(req.body);
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    await ensureUsersSchema();
    const credentials = validation.value;
    const result = await getDb().query(
      "SELECT id, email, name, tenup_id, role, approved, password_hash, password_salt, created_at, approved_at FROM users WHERE email = $1",
      [credentials.email],
    );
    const user = result.rows[0];

    if (
      !user ||
      !verifyPassword(
        credentials.password,
        user.password_salt,
        user.password_hash,
      )
    ) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    const safeUser = serializeUser(user);
    if (!safeUser.approved) {
      return res
        .status(403)
        .json({ error: "Compte en attente de validation admin" });
    }

    res.json({
      user: safeUser,
      token: createUserToken(safeUser),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/auth/me", requireUser, (req, res) => {
  res.json({ user: req.user });
});

app.get("/admin/users", requireAdminUser, async (req, res) => {
  try {
    await ensureUsersSchema();
    const status = cleanText(req.query.status || "", 20);
    const result = await getDb().query(
      `SELECT id, email, name, tenup_id, role, approved, created_at, approved_at
       FROM users
       WHERE
         ($1 = 'pending' AND role <> 'admin' AND approved = false)
         OR ($1 = 'approved' AND approved = true)
         OR ($1 NOT IN ('pending', 'approved') AND role <> 'admin')
       ORDER BY role = 'admin' DESC, name ASC, created_at ASC`,
      [status],
    );

    res.json({ users: result.rows.map(serializeUser) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/admin/users/:id/approve", requireAdminUser, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    await ensureUsersSchema();
    const result = await getDb().query(
      `UPDATE users
       SET approved = true,
           approved_at = NOW()
       WHERE id = $1 AND role <> 'admin'
       RETURNING id, email, name, tenup_id, role, approved, created_at, approved_at`,
      [id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: serializeUser(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
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

app.get("/tournois", requireUser, async (req, res) => {
  try {
    await ensureTournoisSchema();
    const scopedUser = await getScopedUserOrRespond(req, res);
    if (!scopedUser) return;

    const result = await getDb().query(
      `
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
        manuel,
        user_id
      FROM tournois
      WHERE user_id = $1
      ORDER BY
        CASE
          WHEN date::TEXT ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN to_date(date::TEXT, 'DD/MM/YYYY')
          ELSE date::DATE
        END DESC,
        point DESC
    `,
      [scopedUser.id],
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/tournois", requireUser, async (req, res) => {
  const validation = validateTournoiPayload(req.body, { defaultManuel: true });
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    await ensureTournoisSchema();
    const scopedUser = await getScopedUserOrRespond(req, res);
    if (!scopedUser) return;

    const result = await insertTournoiIfMissing(validation.value, {
      userId: scopedUser.id,
    });
    if (result === "skipped") {
      return res.json({ message: "Tournoi deja existant", skipped: true });
    }

    res.status(201).json({ message: "Tournoi ajoute" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/tournois/:id", requireUser, async (req, res) => {
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
    const scopedUser = await getScopedUserOrRespond(req, res);
    if (!scopedUser) return;

    const t = validation.value;
    const result = await getDb().query(
      `UPDATE tournois
         SET date = $1, nom = $2, categorie = $3, partenaire = $4, classement = $5, point = $6, validite = $7, manuel = $8, user_id = $9
         WHERE id = $10
           AND user_id = $9`,
      [
        t.date,
        t.nom,
        t.categorie,
        t.partenaire,
        t.classement,
        t.point,
        t.validite,
        t.manuel,
        scopedUser.id,
        id,
      ],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    res.json({ message: "Tournoi modifie" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/tournois/:id", requireUser, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid tournament id" });
  }

  try {
    await ensureTournoisSchema();
    const scopedUser = await getScopedUserOrRespond(req, res);
    if (!scopedUser) return;

    const result = await getDb().query(
      "DELETE FROM tournois WHERE id = $1 AND user_id = $2",
      [id, scopedUser.id],
    );
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
    await ensureTournoisSchema();
    const adminUser = await getDefaultAdminUser();

    if (!adminUser?.id) {
      return res
        .status(500)
        .json({
          error:
            "ADMIN_PASSWORD or ADMIN_API_KEY is required to create the admin account",
        });
    }

    if (replace) {
      await getDb().query("DELETE FROM tournois WHERE user_id = $1", [
        adminUser.id,
      ]);
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
        validite: t.Validité,
      });

      if (validation.error) {
        throw new Error(`Invalid seed row "${t.Nom}": ${validation.error}`);
      }

      if (
        (await insertTournoiIfMissing(validation.value, {
          userId: adminUser.id,
        })) === "inserted"
      ) {
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
  cleanText,
  findUserByTenupId,
  findSyncOwnerByTenupId,
  listUserTableTenupIds,
  getDefaultAdminUser,
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    next(err);
    return;
  }

  res.status(err.message === "Origin not allowed by CORS" ? 403 : 500).json({
    error: err.message || "Internal Server Error",
  });
});

function listen(port) {
  app.listen(port, HOST, () => {
    console.log(`TenUp API listening on ${HOST}:${port}`);
  });
}

if (require.main === module) {
  listen(PORT);

  if (String(PORT) !== "3000") {
    listen(3000);
  }
}

module.exports = app;
