const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const TENUP_ORIGIN = "https://tenup.fft.fr";
const OUTPUT_PATH = process.env.TENUP_SYNC_OUTPUT || "tenup-sync-output.json";

function requiredEnv(name, fallback = "") {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function cleanText(value, maxLength = 160) {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, maxLength);
}

function parseDateToISO(value) {
  const text = cleanText(value, 40);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  const frMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (frMatch) {
    const [, day, month, year] = frMatch;
    return `${year}-${month}-${day}`;
  }

  const timestamp = Date.parse(text);
  if (!Number.isNaN(timestamp)) return new Date(timestamp).toISOString().slice(0, 10);

  return "";
}

function parsePositiveInteger(value) {
  const number = Number(String(value || "").replace(/[^\d]/g, ""));
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeKey(key) {
  return String(key)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function flattenObject(value, depth = 0, output = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 3) {
    return output;
  }

  for (const [key, entry] of Object.entries(value)) {
    const normalized = normalizeKey(key);
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      flattenObject(entry, depth + 1, output);
      continue;
    }

    output[normalized] = entry;
  }

  return output;
}

function firstValue(row, keys) {
  const flat = flattenObject(row);
  for (const key of keys.map(normalizeKey)) {
    if (flat[key] !== undefined && flat[key] !== null && flat[key] !== "") {
      return flat[key];
    }
  }

  for (const [key, value] of Object.entries(flat)) {
    if (value === undefined || value === null || value === "") continue;
    if (keys.some(candidate => key.includes(normalizeKey(candidate)))) {
      return value;
    }
  }

  return "";
}

function normalizeCategorie(value) {
  const text = cleanText(value, 80).toUpperCase();
  if (["DM", "DD", "DX"].includes(text)) return text;
  if (text.includes("MESSIEURS") || text.includes("HOMMES") || text.includes("MASC")) return "DM";
  if (text.includes("DAMES") || text.includes("FEMMES") || text.includes("FEM")) return "DD";
  if (text.includes("MIXTE") || text.includes("MIXED")) return "DX";
  return cleanText(process.env.TENUP_DEFAULT_CATEGORIE, 2).toUpperCase();
}

function normalizeTournoi(row) {
  const date = parseDateToISO(firstValue(row, [
    "date",
    "dateMatch",
    "dateTournoi",
    "dateDebut",
    "dateFin",
    "startDate"
  ]));
  const nom = cleanText(firstValue(row, [
    "nom",
    "nomTournoi",
    "tournoi",
    "competition",
    "epreuve",
    "libelle",
    "libelleTournoi"
  ]));
  const categorie = normalizeCategorie(firstValue(row, [
    "categorie",
    "cat",
    "tableau",
    "discipline",
    "typeEpreuve",
    "epreuve"
  ]));
  const partenaire = cleanText(firstValue(row, [
    "partenaire",
    "partenaireNom",
    "partenaireLibelle",
    "coequipier",
    "coequipiere",
    "partner"
  ]) || process.env.TENUP_DEFAULT_PARTENAIRE || "TenUp");
  const classement = parsePositiveInteger(firstValue(row, [
    "classement",
    "rang",
    "position",
    "rank",
    "classementPartenaire"
  ]));
  const point = parsePositiveInteger(firstValue(row, [
    "point",
    "points",
    "pointsObtenus",
    "pointObtenu",
    "pointsCumules",
    "pointsResultat"
  ]));
  const validite = cleanText(firstValue(row, [
    "validite",
    "dateValidite",
    "validiteClassement",
    "expiration"
  ]), 20);

  if (!date || !nom || !categorie || !classement || !point) return null;
  return { date, nom, categorie, partenaire, classement, point, validite };
}

function collectObjects(value, output = []) {
  if (Array.isArray(value)) {
    for (const entry of value) collectObjects(entry, output);
    return output;
  }

  if (!value || typeof value !== "object") return output;
  output.push(value);

  for (const entry of Object.values(value)) {
    if (entry && typeof entry === "object") collectObjects(entry, output);
  }

  return output;
}

function extractTournois(payloads) {
  const seen = new Set();
  const tournois = [];

  for (const payload of payloads) {
    for (const object of collectObjects(payload)) {
      const tournoi = normalizeTournoi(object);
      if (!tournoi) continue;

      const key = [
        tournoi.date,
        tournoi.nom,
        tournoi.categorie,
        tournoi.partenaire,
        tournoi.classement,
        tournoi.point
      ].join("|");

      if (seen.has(key)) continue;
      seen.add(key);
      tournois.push(tournoi);
    }
  }

  return tournois;
}

function summarizePayload(payload) {
  if (!payload || typeof payload !== "object") return typeof payload;
  if (Array.isArray(payload)) return `array(${payload.length})`;
  return `object(${Object.keys(payload).slice(0, 12).join(",")})`;
}

async function getStorageStatePath() {
  if (process.env.TENUP_STORAGE_STATE_JSON) {
    const statePath = path.resolve(".tenup-storage-state.json");
    await fs.writeFile(statePath, process.env.TENUP_STORAGE_STATE_JSON);
    return statePath;
  }

  const configuredPath = process.env.TENUP_STORAGE_STATE_PATH || "storageState.json";
  await fs.access(configuredPath);
  return configuredPath;
}

async function probeEndpoints(page, personId) {
  return page.evaluate(async ({ personId: id }) => {
    const endpoints = [
      {
        name: "bilan-classement",
        method: "POST",
        url: `/v1/personnes/${id}/bilan-classement`,
        body: {}
      },
      {
        name: "historique",
        method: "GET",
        url: `/v1/personnes/${id}/bilan-classement/historique`
      }
    ];
    const results = [];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          credentials: "include",
          headers: {
            accept: "application/json",
            "content-type": "application/json"
          },
          body: endpoint.body ? JSON.stringify(endpoint.body) : undefined
        });
        const contentType = response.headers.get("content-type") || "";
        const text = await response.text();
        let body = text;

        if (contentType.includes("application/json")) {
          body = JSON.parse(text);
        }

        results.push({
          name: endpoint.name,
          url: endpoint.url,
          status: response.status,
          contentType,
          body
        });
      } catch (err) {
        results.push({
          name: endpoint.name,
          url: endpoint.url,
          status: 0,
          contentType: "",
          error: err.message
        });
      }
    }

    return results;
  }, { personId });
}

async function postImport(tournois) {
  const apiUrl = requiredEnv("TENUP_API_URL", process.env.API_URL);
  const adminApiKey = process.env.TENUP_ADMIN_API_KEY || process.env.ADMIN_API_KEY;
  const adminToken = process.env.TENUP_ADMIN_TOKEN || process.env.ADMIN_TOKEN;

  if (!adminApiKey && !adminToken) {
    throw new Error("TENUP_ADMIN_API_KEY or TENUP_ADMIN_TOKEN is required");
  }

  const url = new URL("/tournois/import", apiUrl);
  const headers = { "content-type": "application/json" };
  if (adminApiKey) headers["x-api-key"] = adminApiKey;
  if (adminToken) headers.authorization = `Bearer ${adminToken}`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ source: "tenup", tournois })
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Import API failed with ${response.status}`);
  }

  return data;
}

async function main() {
  const personId = requiredEnv("TENUP_PERSON_ID");
  const classementUrl = process.env.TENUP_CLASSEMENT_URL || `${TENUP_ORIGIN}/classement/${personId}/padel`;
  const storageState = await getStorageStatePath();
  const capturedPayloads = [];
  const capturedSummaries = [];

  const browser = await chromium.launch({ headless: process.env.TENUP_HEADLESS !== "false" });
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  page.on("response", async response => {
    const url = response.url();
    const contentType = response.headers()["content-type"] || "";
    const interesting = /bilan-classement|classement|tournoi|resultat|palmares/i.test(url);

    if (!interesting || !contentType.includes("application/json")) return;

    try {
      const body = await response.json();
      capturedPayloads.push(body);
      capturedSummaries.push({
        url,
        status: response.status(),
        summary: summarizePayload(body)
      });
    } catch (err) {
      capturedSummaries.push({ url, status: response.status(), error: err.message });
    }
  });

  try {
    await page.goto(classementUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    const normalizedBodyText = bodyText.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (/Acces refuse|403|Connecte-toi/i.test(normalizedBodyText)) {
      throw new Error("TenUp session is not allowed to access the classement page");
    }

    const endpointResults = await probeEndpoints(page, personId);
    const endpointPayloads = endpointResults
      .filter(result => result.body && typeof result.body === "object")
      .map(result => result.body);
    const tournois = extractTournois([...capturedPayloads, ...endpointPayloads]);
    const diagnostic = {
      classementUrl,
      captured: capturedSummaries,
      probed: endpointResults.map(result => ({
        name: result.name,
        url: result.url,
        status: result.status,
        contentType: result.contentType,
        summary: summarizePayload(result.body),
        error: result.error
      })),
      extracted: tournois.length
    };

    if (process.env.TENUP_SYNC_DEBUG === "true") {
      diagnostic.rawPayloads = [...capturedPayloads, ...endpointPayloads];
    }

    if (tournois.length === 0) {
      await fs.writeFile(OUTPUT_PATH, JSON.stringify(diagnostic, null, 2));
      throw new Error(`No TenUp tournaments extracted. Diagnostic written to ${OUTPUT_PATH}`);
    }

    if (process.env.TENUP_SYNC_DRY_RUN === "true") {
      await fs.writeFile(OUTPUT_PATH, JSON.stringify({ ...diagnostic, tournois }, null, 2));
      console.log(`Dry run: extracted ${tournois.length} tournaments`);
      return;
    }

    const imported = await postImport(tournois);
    await fs.writeFile(OUTPUT_PATH, JSON.stringify({ ...diagnostic, imported }, null, 2));
    console.log(`TenUp sync complete: ${imported.imported} imported, ${imported.skipped} skipped`);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
