const BRIDGE_SOURCE = "tenup-app-sync-bridge";
const CONTENT_SOURCE = "tenup-app-sync-content";
const capturedPayloads = [];
const pendingRequests = new Map();

injectBridge();

window.addEventListener("message", event => {
  if (event.source !== window || event.data?.source !== BRIDGE_SOURCE) return;

  if (event.data.type === "payload" && event.data.payload) {
    capturedPayloads.push(event.data.payload);
    if (capturedPayloads.length > 120) capturedPayloads.shift();
    return;
  }

  if (event.data.type === "collect-result") {
    const pending = pendingRequests.get(event.data.requestId);
    if (!pending) return;

    pendingRequests.delete(event.data.requestId);
    pending.resolve(event.data.payloads || []);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "COLLECT_TENUP") return false;

  collectTenUp(message)
    .then(result => sendResponse(result))
    .catch(err => sendResponse({ ok: false, error: err.message }));

  return true;
});

function injectBridge() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("page-bridge.js");
  script.onload = () => script.remove();
  (document.documentElement || document.head || document.body).appendChild(script);
}

function inferPersonId(configuredPersonId) {
  if (configuredPersonId) return String(configuredPersonId);

  const routeMatch = window.location.pathname.match(/\/classement\/(\d+)/);
  if (routeMatch) return routeMatch[1];

  return "";
}

function askBridge(personId) {
  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      resolve([]);
    }, 12000);

    pendingRequests.set(requestId, {
      resolve(payloads) {
        clearTimeout(timeout);
        resolve(payloads);
      }
    });

    window.postMessage({
      source: CONTENT_SOURCE,
      type: "collect",
      requestId,
      personId
    }, "*");
  });
}

async function collectTenUp(message) {
  const personId = inferPersonId(message.personId);
  const bridgePayloads = await askBridge(personId);
  const domRows = extractDomRows();
  const rawPayloads = [
    ...capturedPayloads.map(entry => entry.body || entry),
    ...bridgePayloads.map(entry => entry.body || entry),
    domRows
  ];
  const tournois = extractTournois(rawPayloads);

  return {
    ok: true,
    personId,
    tournois,
    diagnostics: {
      url: window.location.href,
      title: document.title,
      capturedPayloads: capturedPayloads.length,
      bridgePayloads: bridgePayloads.map(summarizePayload),
      domRows: domRows.length,
      extracted: tournois.length
    }
  };
}

function cleanText(value, maxLength = 160) {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function parseDateToISO(value) {
  const text = cleanText(value, 80);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  const frMatch = text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
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
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 4) {
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
  return "";
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
  ]) || "TenUp");
  const classement = parsePositiveInteger(firstValue(row, [
    "classement",
    "rang",
    "place",
    "position",
    "rank",
    "resultat"
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

function extractDomRows() {
  const rows = [];
  const elements = Array.from(document.querySelectorAll("table tr, [role='row']"));

  for (const element of elements) {
    const text = cleanText(element.innerText || element.textContent || "", 500);
    if (!/\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}/.test(text)) continue;
    if (!/point|pts|DM|DD|DX|messieurs|dames|mixte/i.test(text)) continue;

    rows.push({
      date: text.match(/\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}/)?.[0] || "",
      nom: text.match(/(?:P\d+|Tournoi|Open|Padel)[^|,\n]*/i)?.[0] || text.slice(0, 80),
      categorie: text.match(/\b(DM|DD|DX)\b/i)?.[1] || text,
      partenaire: text.match(/partenaire\s*:?\s*([A-Za-z '-]+)/i)?.[1] || "TenUp",
      classement: text.match(/(?:rang|place|position|classement)\D+(\d+)/i)?.[1] || "",
      point: text.match(/(\d+)\s*(?:pts|points?)/i)?.[1] || "",
      validite: ""
    });
  }

  return rows;
}

function summarizePayload(entry) {
  const body = entry?.body || entry;
  if (!body || typeof body !== "object") {
    return {
      source: entry?.source || "unknown",
      status: entry?.status,
      type: typeof body,
      error: entry?.error
    };
  }

  return {
    source: entry?.source || "unknown",
    url: entry?.url,
    status: entry?.status,
    keys: Object.keys(body).slice(0, 12),
    error: entry?.error
  };
}
