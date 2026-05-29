const DEFAULT_SETTINGS = {
  apiUrl: "https://tenup-app-production.up.railway.app",
  adminApiKey: "",
  personId: "7146157482",
  classementUrl: "https://tenup.fft.fr/classement/7146157482/padel",
  autoSyncEnabled: true
};
const MONTHLY_ALARM = "monthly-tenup-sync";
const MISSING_RECEIVER_PATTERN = /Receiving end does not exist|Could not establish connection/i;

chrome.runtime.onInstalled.addListener(() => {
  getSettings().then(settings => scheduleNextMonthlySync(settings));
});

chrome.runtime.onStartup.addListener(() => {
  getSettings().then(settings => scheduleNextMonthlySync(settings));
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== MONTHLY_ALARM) return;

  runSync({ automatic: true })
    .catch(err => recordLastRun({ ok: false, error: err.message, automatic: true }))
    .finally(() => getSettings().then(settings => scheduleNextMonthlySync(settings)));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_SETTINGS") {
    Promise.all([getSettings(), getLastRun()])
      .then(([settings, lastRun]) => sendResponse({ ok: true, settings, lastRun }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === "SAVE_SETTINGS") {
    saveSettings(message.settings || {})
      .then(settings => scheduleNextMonthlySync(settings).then(() => settings))
      .then(settings => sendResponse({ ok: true, settings }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === "SYNC_NOW") {
    runSync({ automatic: false })
      .then(result => sendResponse({ ok: true, result }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === "TEST_READ") {
    collectFromTenUp({ active: true })
      .then(result => sendResponse({ ok: true, result }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === "OPEN_TENUP") {
    getSettings()
      .then(settings => openOrFindTenUpTab(settings, { active: true }))
      .then(tab => sendResponse({ ok: true, tabId: tab.id }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  return false;
});

function getSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get(DEFAULT_SETTINGS, values => {
      resolve({ ...DEFAULT_SETTINGS, ...values });
    });
  });
}

function saveSettings(settings) {
  const nextSettings = {
    apiUrl: String(settings.apiUrl || DEFAULT_SETTINGS.apiUrl).trim().replace(/\/$/, ""),
    adminApiKey: String(settings.adminApiKey || "").trim(),
    personId: String(settings.personId || DEFAULT_SETTINGS.personId).trim(),
    classementUrl: String(settings.classementUrl || DEFAULT_SETTINGS.classementUrl).trim(),
    autoSyncEnabled: settings.autoSyncEnabled !== false
  };

  return new Promise(resolve => {
    chrome.storage.local.set(nextSettings, () => resolve(nextSettings));
  });
}

function getLastRun() {
  return new Promise(resolve => {
    chrome.storage.local.get({ lastRun: null }, values => resolve(values.lastRun));
  });
}

function recordLastRun(result) {
  const lastRun = {
    at: new Date().toISOString(),
    ...result
  };

  return new Promise(resolve => {
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
  return new Promise(resolve => chrome.alarms.clear(name, () => resolve()));
}

function createAlarm(name, info) {
  chrome.alarms.create(name, info);
  return Promise.resolve();
}

async function runSync({ automatic }) {
  const settings = await getSettings();
  validateSettings(settings);
  const collection = await collectFromTenUp({ active: !automatic, settings });

  if (!collection.tournois?.length) {
    const lastRun = await recordLastRun({
      ok: false,
      automatic,
      imported: 0,
      skipped: 0,
      error: "Aucun tournoi detecte sur TenUp",
      diagnostics: collection.diagnostics
    });
    throw new Error(`${lastRun.error}. Recharge la page TenUp puis relance la synchro.`);
  }

  const imported = await postImport(settings, collection.tournois);
  const lastRun = await recordLastRun({
    ok: true,
    automatic,
    imported: imported.imported,
    skipped: imported.skipped,
    received: imported.received,
    diagnostics: collection.diagnostics
  });

  return { ...imported, lastRun };
}

async function collectFromTenUp({ active, settings }) {
  const currentSettings = settings || await getSettings();
  validateReadSettings(currentSettings);

  const tab = await openOrFindTenUpTab(currentSettings, { active });
  await waitForTabReady(tab.id);
  const collection = await sendCollectMessage(tab.id, currentSettings.personId);

  if (!collection?.ok) {
    throw new Error(collection?.error || "Impossible de lire la page TenUp");
  }

  return collection;
}

async function sendCollectMessage(tabId, personId) {
  const message = {
    type: "COLLECT_TENUP",
    personId
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

function validateSettings(settings) {
  validateReadSettings(settings);
  if (!settings.apiUrl) throw new Error("URL API manquante");
  if (!settings.adminApiKey) throw new Error("Cle admin API manquante");
}

function validateReadSettings(settings) {
  if (!settings.personId) throw new Error("Identifiant TenUp manquant");
  if (!settings.classementUrl) throw new Error("URL classement TenUp manquante");
}

async function openOrFindTenUpTab(settings, { active }) {
  const tabs = await queryTabs({ url: "https://tenup.fft.fr/*" });
  const classementTab = tabs.find(tab => tab.url?.includes(`/classement/${settings.personId}`));
  const tab = tabs.find(item => item.active) || tabs[0];

  if (classementTab) {
    if (active) await updateTab(classementTab.id, { active: true });
    return classementTab;
  }

  if (tab) {
    return updateTab(tab.id, { active, url: settings.classementUrl });
  }

  return createTab({ url: settings.classementUrl, active });
}

function queryTabs(queryInfo) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(queryInfo, tabs => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(tabs || []);
    });
  });
}

function createTab(createProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(createProperties, tab => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(tab);
    });
  });
}

function updateTab(tabId, updateProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, updateProperties, tab => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(tab);
    });
  });
}

function waitForTabReady(tabId) {
  return new Promise(resolve => {
    const timeout = setTimeout(done, 15000);

    function done() {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") done();
    }

    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId, tab => {
      if (chrome.runtime.lastError || tab?.status === "complete") done();
    });
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, response => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(response);
    });
  });
}

function injectContentScript(tabId) {
  if (!chrome.scripting?.executeScript) {
    throw new Error("Script TenUp non charge. Recharge l'extension puis la page TenUp.");
  }

  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    }, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function postImport(settings, tournois) {
  const response = await fetch(`${settings.apiUrl.replace(/\/$/, "")}/tournois/import`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": settings.adminApiKey
    },
    body: JSON.stringify({
      source: "tenup-extension",
      tournois
    })
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Import API failed with ${response.status}`);
  }

  return data;
}
