const form = document.getElementById("settings-form");
const statusBox = document.getElementById("status");
const syncButton = document.getElementById("sync-now");
const openButton = document.getElementById("open-tenup");

const fields = {
  apiUrl: document.getElementById("api-url"),
  adminApiKey: document.getElementById("admin-api-key"),
  personId: document.getElementById("person-id"),
  classementUrl: document.getElementById("classement-url"),
  autoSyncEnabled: document.getElementById("auto-sync")
};

load();

form.addEventListener("submit", async event => {
  event.preventDefault();
  setBusy(true);
  setStatus("Enregistrement...", "muted");

  const response = await sendMessage({
    type: "SAVE_SETTINGS",
    settings: readForm()
  });

  setBusy(false);
  if (!response.ok) {
    setStatus(response.error || "Enregistrement impossible", "error");
    return;
  }

  fillForm(response.settings);
  setStatus("Parametres enregistres.", "success");
});

syncButton.addEventListener("click", async () => {
  setBusy(true);
  setStatus("Synchronisation en cours...", "muted");

  const response = await sendMessage({ type: "SYNC_NOW" });

  setBusy(false);
  if (!response.ok) {
    setStatus(response.error || "Synchronisation impossible", "error");
    return;
  }

  const result = response.result || {};
  setStatus(
    `Synchronise : ${result.imported || 0} importes, ${result.skipped || 0} ignores.`,
    "success"
  );
});

openButton.addEventListener("click", async () => {
  setBusy(true);
  const response = await sendMessage({ type: "OPEN_TENUP" });
  setBusy(false);

  if (!response.ok) {
    setStatus(response.error || "Ouverture TenUp impossible", "error");
  } else {
    setStatus("Page TenUp ouverte. Connecte-toi puis relance la synchro.", "muted");
  }
});

async function load() {
  const response = await sendMessage({ type: "GET_SETTINGS" });
  if (!response.ok) {
    setStatus(response.error || "Chargement impossible", "error");
    return;
  }

  fillForm(response.settings);
  renderLastRun(response.lastRun);
}

function readForm() {
  return {
    apiUrl: fields.apiUrl.value,
    adminApiKey: fields.adminApiKey.value,
    personId: fields.personId.value,
    classementUrl: fields.classementUrl.value,
    autoSyncEnabled: fields.autoSyncEnabled.checked
  };
}

function fillForm(settings) {
  fields.apiUrl.value = settings.apiUrl || "";
  fields.adminApiKey.value = settings.adminApiKey || "";
  fields.personId.value = settings.personId || "";
  fields.classementUrl.value = settings.classementUrl || "";
  fields.autoSyncEnabled.checked = settings.autoSyncEnabled !== false;
}

function renderLastRun(lastRun) {
  if (!lastRun) {
    setStatus("Aucune synchronisation lancee.", "muted");
    return;
  }

  const date = new Date(lastRun.at).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

  if (lastRun.ok) {
    setStatus(
      `Derniere synchro ${date} : ${lastRun.imported || 0} importes, ${lastRun.skipped || 0} ignores.`,
      "success"
    );
  } else {
    setStatus(`Derniere synchro ${date} : ${lastRun.error || "echec"}`, "error");
  }
}

function sendMessage(message) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(message, response => {
      const err = chrome.runtime.lastError;
      if (err) resolve({ ok: false, error: err.message });
      else resolve(response || { ok: false, error: "Reponse extension vide" });
    });
  });
}

function setBusy(isBusy) {
  syncButton.disabled = isBusy;
  openButton.disabled = isBusy;
  form.querySelectorAll("button, input").forEach(element => {
    if (element.id !== "sync-now" && element.id !== "open-tenup") {
      element.disabled = isBusy;
    }
  });
}

function setStatus(message, className) {
  statusBox.className = `status ${className || "muted"}`;
  statusBox.textContent = message;
}
