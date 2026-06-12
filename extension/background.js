const DEFAULT_SETTINGS = {
  autoSyncEnabled: true,
};
const API_BASE_URL = "https://tenup-app-production.up.railway.app";
const MONTHLY_ALARM = "monthly-tenup-sync";
const READ_SETTLE_DELAY_MS = 1200;
const MISSING_RECEIVER_PATTERN =
  /Receiving end does not exist|Could not establish connection/i;

chrome.runtime.onInstalled.addListener(() => {
  getSettings().then((settings) => scheduleNextMonthlySync(settings));
});

chrome.runtime.onStartup.addListener(() => {
  getSettings().then((settings) => scheduleNextMonthlySync(settings));
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== MONTHLY_ALARM) return;

  runSync({ automatic: true })
    .catch((err) =>
      recordLastRun({ ok: false, error: err.message, automatic: true }),
    )
    .finally(() =>
      getSettings().then((settings) => scheduleNextMonthlySync(settings)),
    );
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_SETTINGS") {
    Promise.all([
      getSettings(),
      getLastRun(),
      fetchSyncTargetsInfo(),
    ])
      .then(([settings, lastRun, targets]) =>
        sendResponse({ ok: true, settings, lastRun, targets }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === "SAVE_SETTINGS") {
    saveSettings(message.settings || {})
      .then((settings) =>
        scheduleNextMonthlySync(settings).then(() => settings),
      )
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === "SYNC_NOW") {
    runSync({ automatic: false })
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === "TEST_READ") {
    testReadFirstTarget()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === "OPEN_TENUP") {
    openFirstTenUpTarget({ active: true })
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  return false;
});

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_SETTINGS, (values) => {
      resolve({ ...DEFAULT_SETTINGS, ...values });
    });
  });
}

function saveSettings(settings) {
  const nextSettings = {
    autoSyncEnabled: settings.autoSyncEnabled !== false,
  };

  return new Promise((resolve) => {
    chrome.storage.local.remove(
      ["personId", "apiUrl", "adminApiKey", "classementUrl"],
      () => {
        chrome.storage.local.set(nextSettings, () => resolve(nextSettings));
      },
    );
  });
}

function getLastRun() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ lastRun: null }, (values) =>
      resolve(values.lastRun),
    );
  });
}

function recordLastRun(result) {
  const lastRun = {
    at: new Date().toISOString(),
    ...result,
  };

  return new Promise((resolve) => {
    chrome.storage.local.set({ lastRun }, () => resolve(lastRun));
  });
}

async function scheduleNextMonthlySync(settings) {
  await clearAlarm(MONTHLY_ALARM);
  if (!settings.autoSyncEnabled) return null;

  const nextRun = getNextRunDate(new Date());
  await createAlarm(MONTHLY_ALARM, { when: nextRun.getTime() });
  return nextRun.toISOString();
}

function getNextRunDate(now) {
  const next = new Date(now);
  next.setHours(7, 0, 0, 0);
  next.setDate(7);

  if (next <= now) {
    next.setMonth(next.getMonth() + 1);
    next.setDate(7);
  }

  return next;
}

function clearAlarm(name) {
  return new Promise((resolve) => chrome.alarms.clear(name, () => resolve()));
}

function createAlarm(name, info) {
  chrome.alarms.create(name, info);
  return Promise.resolve();
}

async function runSync({ automatic }) {
  const targets = await fetchSyncTargets();
  const summary = {
    targets: targets.length,
    synced: 0,
    failed: 0,
    received: 0,
    imported: 0,
    updated: 0,
    skipped: 0,
    results: [],
  };
  let tabId = null;

  for (let index = 0; index < targets.length; index += 1) {
    const personId = targets[index];

    try {
      const collection = await collectFromTenUp({
        active: !automatic && index === 0,
        personId,
        tabId,
      });
      tabId = collection.tabId || tabId;

      if (!collection.tournois?.length) {
        throw new Error(
          "Aucun tournoi detecte sur TenUp. Recharge la page puis relance la synchro.",
        );
      }

      const imported = await postImport(personId, collection.tournois);
      summary.synced += 1;
      summary.received += imported.received || 0;
      summary.imported += imported.imported || 0;
      summary.updated += imported.updated || 0;
      summary.skipped += imported.skipped || 0;
      summary.results.push({
        personId,
        ok: true,
        received: imported.received || 0,
        imported: imported.imported || 0,
        updated: imported.updated || 0,
        skipped: imported.skipped || 0,
        diagnostics: collection.diagnostics,
      });
    } catch (err) {
      summary.failed += 1;
      summary.results.push({
        personId,
        ok: false,
        error: err.message,
      });
    }
  }

  const errors = summary.results
    .filter((result) => !result.ok)
    .map((result) => ({
      personId: result.personId,
      error: result.error,
    }));
  const lastRun = await recordLastRun({
    ok: summary.failed === 0,
    automatic,
    ...summary,
    errors,
    error: summary.failed
      ? `${summary.failed}/${summary.targets} ID TenUp en erreur`
      : "",
  });

  return { ...summary, errors, lastRun };
}

async function testReadFirstTarget() {
  const targets = await fetchSyncTargets();
  const collection = await collectFromTenUp({
    active: true,
    personId: targets[0],
  });

  return {
    ...collection,
    targetCount: targets.length,
  };
}

async function openFirstTenUpTarget({ active }) {
  const targets = await fetchSyncTargets();
  const tab = await openOrFindTenUpTab(targets[0], { active });

  return {
    tabId: tab.id,
    personId: targets[0],
    targetCount: targets.length,
  };
}

async function collectFromTenUp({ active, personId, tabId }) {
  const normalizedPersonId = validatePersonId(personId);
  const tab = await openOrFindTenUpTab(normalizedPersonId, {
    active,
    tabId,
  });
  await waitForTabReady(tab.id, `/classement/${normalizedPersonId}`);
  await delay(READ_SETTLE_DELAY_MS);
  const collection = await sendCollectMessage(tab.id, normalizedPersonId);

  if (!collection?.ok) {
    throw new Error(collection?.error || "Impossible de lire la page TenUp");
  }

  return {
    ...collection,
    personId: normalizedPersonId,
    tabId: tab.id,
  };
}

async function sendCollectMessage(tabId, personId) {
  const message = {
    type: "COLLECT_TENUP",
    personId,
  };

  try {
    return await sendTabMessage(tabId, message);
  } catch (err) {
    if (!MISSING_RECEIVER_PATTERN.test(err.message || "")) throw err;

    await injectContentScript(tabId);
    await delay(250);
    return sendTabMessage(tabId, message);
  }
}

function validatePersonId(value) {
  const personId = normalizePersonId(value);
  if (!personId) throw new Error("Identifiant TenUp invalide");
  return personId;
}

function normalizePersonId(value) {
  const personId = String(value || "")
    .trim()
    .replace(/\s+/g, "");
  return /^\d{6,20}$/.test(personId) ? personId : "";
}

function buildClassementUrl(personId) {
  return `https://tenup.fft.fr/classement/${encodeURIComponent(personId)}/padel`;
}

async function openOrFindTenUpTab(personId, { active, tabId } = {}) {
  const url = buildClassementUrl(personId);

  if (tabId) {
    try {
      await getTab(tabId);
      return updateTab(tabId, { active, url });
    } catch (err) {
      // The tab may have been closed between two IDs. Fall back to another tab.
    }
  }

  const tabs = await queryTabs({ url: "https://tenup.fft.fr/*" });
  const classementTab = tabs.find((tab) =>
    tab.url?.includes(`/classement/${personId}`),
  );
  const tenupTab = tabs.find((item) => item.active) || tabs[0];

  if (classementTab) {
    if (active) await updateTab(classementTab.id, { active: true });
    return classementTab;
  }

  if (tenupTab) {
    return updateTab(tenupTab.id, { active, url });
  }

  return createTab({ url, active });
}

function queryTabs(queryInfo) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(queryInfo, (tabs) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(tabs || []);
    });
  });
}

function getTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(tab);
    });
  });
}

function createTab(createProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(createProperties, (tab) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(tab);
    });
  });
}

function updateTab(tabId, updateProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, updateProperties, (tab) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(tab);
    });
  });
}

function waitForTabReady(tabId, expectedUrlPart) {
  return new Promise((resolve) => {
    const timeout = setTimeout(done, 30000);

    function done() {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }

    function isReady(tab) {
      const url = tab?.url || "";
      const urlOk = !expectedUrlPart || url.includes(expectedUrlPart);
      return urlOk && tab?.status === "complete";
    }

    function listener(updatedTabId, changeInfo, tab) {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status === "complete" && isReady(tab)) done();
    }

    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || isReady(tab)) done();
    });
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(response);
    });
  });
}

function injectContentScript(tabId) {
  if (!chrome.scripting?.executeScript) {
    throw new Error(
      "Script TenUp non charge. Recharge l'extension puis la page TenUp.",
    );
  }

  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: ["content.js"],
      },
      () => {
        const err = chrome.runtime.lastError;
        if (err) reject(new Error(err.message));
        else resolve();
      },
    );
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSyncTargetsInfo() {
  try {
    const tenupIds = await fetchSyncTargets();
    return { tenupIds, count: tenupIds.length };
  } catch (err) {
    return { tenupIds: [], count: 0, error: err.message };
  }
}

async function fetchSyncTargets() {
  const response = await fetch(`${API_BASE_URL}/sync/tenup-ids`, {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  });
  const text = await response.text();
  const data = parseJson(text);

  if (!response.ok) {
    const detail = data.error || extractTextError(text);
    throw new Error(
      detail
        ? `Liste ID TenUp indisponible (${response.status}) : ${detail}`
        : `Liste ID TenUp indisponible (${response.status})`,
    );
  }

  const rawIds = Array.isArray(data.tenupIds)
    ? data.tenupIds
    : Array.isArray(data.ids)
      ? data.ids
      : [];
  const seen = new Set();
  const tenupIds = rawIds
    .map(normalizePersonId)
    .filter(Boolean)
    .filter((personId) => {
      if (seen.has(personId)) return false;
      seen.add(personId);
      return true;
    });

  if (!tenupIds.length) {
    throw new Error("Aucun ID TenUp valide disponible en base");
  }

  return tenupIds;
}

async function postImport(personId, tournois) {
  const response = await fetch(`${API_BASE_URL}/tournois/import/tenup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      source: "tenup-extension",
      tenupId: personId,
      tournois,
    }),
  });
  const text = await response.text();
  const data = parseJson(text);

  if (!response.ok) {
    const detail = data.error || extractTextError(text);
    if (response.status === 404) {
      throw new Error(
        detail ||
          "ID TenUp inconnu. Cree et fais valider le compte dans le dashboard.",
      );
    }

    throw new Error(
      detail
        ? `Import API failed with ${response.status}: ${detail}`
        : `Import API failed with ${response.status}`,
    );
  }

  return data;
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch (err) {
    return {};
  }
}

function extractTextError(text) {
  return String(text || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}
