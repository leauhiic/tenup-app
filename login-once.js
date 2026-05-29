const { chromium } = require("playwright");
const fs = require("fs");

const STATE_PATH = "./storageState.json";

(async () => {
  const browser = await chromium.launch({
    headless: false, // 👈 IMPORTANT : tu vois le login
    slowMo: 50,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("👉 Ouvre login FFT...");

  await page.goto("https://login.fft.fr/", {
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
