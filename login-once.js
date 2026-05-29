const { chromium } = require("playwright");

const STATE_PATH = process.env.TENUP_STORAGE_STATE_PATH || "./storageState.json";
const TENUP_HOME_URL = process.env.TENUP_HOME_URL || "https://tenup.fft.fr/";
const TENUP_LOGIN_URL = process.env.TENUP_LOGIN_URL || "";

async function resolveLoginUrl(page) {
  if (TENUP_LOGIN_URL) {
    return TENUP_LOGIN_URL;
  }

  await page.goto(TENUP_HOME_URL, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForURL("**tenup.fft.fr/**", { timeout: 60000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

  return page.evaluate(async () => {
    const response = await fetch("/login", { credentials: "include" });
    if (!response.ok) {
      throw new Error(`TenUp login endpoint failed with ${response.status}`);
    }

    const payload = await response.json();
    const loginUrl = typeof payload === "string" ? payload : payload?.url || payload?.loginUrl;
    if (!loginUrl) {
      throw new Error("TenUp login endpoint returned an unknown payload");
    }

    const separator = loginUrl.includes("?") ? "&" : "?";
    return `${loginUrl}${separator}redirect_uri=${window.location.origin}/api/auth/callback`;
  });
}

(async () => {
  const browser = await chromium.launch({
    headless: false, // 👈 IMPORTANT : tu vois le login
    slowMo: 50,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("👉 Preparation du login TenUp/FFT...");

  const loginUrl = await resolveLoginUrl(page);
  await page.goto(loginUrl, {
    waitUntil: "domcontentloaded",
  });

  console.log("\n⚠️ Connecte-toi MANUELLEMENT dans la fenêtre");
  console.log("👉 Une fois connecté, reviens ici, j'attends...\n");

  // On attend que tu sois redirigé vers TenUp ou domaine FFT
  await page.waitForURL("**tenup.fft.fr/**", {
    timeout: 0,
  });

  console.log("✅ Login détecté sur TenUp !");

  // Sauvegarde session complète
  await context.storageState({
    path: STATE_PATH,
  });

  console.log("💾 Session sauvegardée dans storageState.json");

  await browser.close();
})();
