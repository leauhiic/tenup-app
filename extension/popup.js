const form = document.getElementById("settings-form");
const statusBox = document.getElementById("status");
const targetSummary = document.getElementById("target-summary");
const syncButton = document.getElementById("sync-now");
const testButton = document.getElementById("test-read");
const openButton = document.getElementById("open-tenup");

const fields = {
  autoSyncEnabled: document.getElementById("auto-sync"),
};

load();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(true);
  setStatus("Enregistrement...", "muted");

  const response = await sendMessage({
    type: "SAVE_SETTINGS",
    settings: readForm(),
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
  setStatus("Synchronisation de tous les IDs en cours...", "muted");

  const response = await sendMessage({ type: "SYNC_NOW" });

  setBusy(false);
  if (!response.ok) {
    setStatus(response.error || "Synchronisation impossible", "error");
    return;
  }

  renderSyncResult(response.result || {});
});

testButton.addEventListener("click", async () => {
  setBusy(true);
  setStatus("Lecture TenUp du premier ID en cours...", "muted");

  const response = await sendMessage({ type: "TEST_READ" });

  setBusy(false);
  if (!response.ok) {
    setStatus(response.error || "Lecture TenUp impossible", "error");
    return;
  }

  const result = response.result || {};
  const diagnostics = result.diagnostics || {};
  const count = result.tournois?.length || 0;
  const details = `captures ${diagnostics.capturedPayloads || 0}, lignes ${diagnostics.domRows || 0}`;
  const prefix = `ID ${result.personId || "?"} sur ${result.targetCount || 1}`;

  if (count > 0) {
    setStatus(
      `${prefix} : ${count} tournoi(s) detecte(s), ${details}.`,
      "success",
    );
  } else {
    setStatus(
      `${prefix} : aucun tournoi detecte (${details}). Recharge la page TenUp puis reessaie.`,
      "error",
    );
  }
});

openButton.addEventListener("click", async () => {
  setBusy(true);
  const response = await sendMessage({ type: "OPEN_TENUP" });
  setBusy(false);

  if (!response.ok) {
    setStatus(response.error || "Ouverture TenUp impossible", "error");
  } else {
    setStatus(
      `Premier ID ouvert (${response.personId}). Connecte-toi puis relance la synchro des ${response.targetCount || 1} ID(s).`,
      "muted",
    );
  }
});

async function load() {
  const response = await sendMessage({ type: "GET_SETTINGS" });
  if (!response.ok) {
    setStatus(response.error || "Chargement impossible", "error");
    return;
  }

  fillForm(response.settings);
  renderTargets(response.targets);
  renderLastRun(response.lastRun);
}

function readForm() {
  return {
    autoSyncEnabled: fields.autoSyncEnabled.checked,
  };
}

function fillForm(settings) {
  fields.autoSyncEnabled.checked = settings.autoSyncEnabled !== false;
}

function renderTargets(targets = {}) {
  if (targets.error) {
    targetSummary.textContent = `IDs indisponibles : ${targets.error}`;
    targetSummary.className = "hint error-text";
    return;
  }

  targetSummary.textContent = `${targets.count || 0} ID TenUp valide(s) trouve(s) en base.`;
  targetSummary.className = "hint";
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
    minute: "2-digit",
  });

  if (lastRun.ok) {
    setStatus(
      `Derniere synchro ${date} : ${lastRun.synced || 0}/${lastRun.targets || 0} ID, ${lastRun.imported || 0} importes, ${lastRun.updated || 0} remplaces, ${lastRun.skipped || 0} ignores${formatRunMeta(lastRun)}.`,
      "success",
    );
  } else {
    setStatus(
      `Derniere synchro ${date} : ${lastRun.error || "echec"}`,
      "error",
    );
  }
}

function renderSyncResult(result) {
  const failed = result.failed || 0;
  const synced = result.synced || 0;
  const targets = result.targets || 0;
  const base = `${synced}/${targets} ID synchronise(s) : ${result.imported || 0} importes, ${result.updated || 0} remplaces, ${result.skipped || 0} ignores${formatRunMeta(result)}.`;

  if (!failed) {
    setStatus(base, "success");
    return;
  }

  const firstError = (result.errors || [])[0];
  const detail = firstError
    ? ` Premier echec ${firstError.personId} : ${firstError.error}`
    : "";
  setStatus(`${base} ${failed} erreur(s).${detail}`, synced ? "warning" : "error");
}

function formatRunMeta(result = {}) {
  const parts = [];
  if (result.durationMs) {
    parts.push(formatDuration(result.durationMs));
  }
  if (result.concurrency > 1) {
    parts.push(`${result.concurrency} onglets`);
  }

  return parts.length ? ` en ${parts.join(", ")}` : "";
}

function formatDuration(durationMs) {
  const seconds = Math.max(1, Math.round(Number(durationMs || 0) / 1000));
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}min ${rest}s` : `${minutes}min`;
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      const err = chrome.runtime.lastError;
      if (err) resolve({ ok: false, error: err.message });
      else resolve(response || { ok: false, error: "Reponse extension vide" });
    });
  });
}

function setBusy(isBusy) {
  syncButton.disabled = isBusy;
  testButton.disabled = isBusy;
  openButton.disabled = isBusy;
  form.querySelectorAll("button, input").forEach((element) => {
    if (element.id !== "sync-now" && element.id !== "open-tenup") {
      element.disabled = isBusy;
    }
  });
}

function setStatus(message, className) {
  statusBox.className = `status ${className || "muted"}`;
  statusBox.textContent = message;
}
