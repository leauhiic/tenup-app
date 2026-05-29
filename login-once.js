const { chromium } = require("playwright");
const fs = require("fs");

const STATE_PATH = process.env.TENUP_STORAGE_STATE_PATH || "./storageState.json";
const TENUP_HOME_URL = process.env.TENUP_HOME_URL || "https://tenup.fft.fr/";
const TENUP_LOGIN_URL = process.env.TENUP_LOGIN_URL || "";
const PLAYWRIGHT_CHANNEL = process.env.PLAYWRIGHT_CHANNEL || "";
const CHROME_EXECUTABLE = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function getLaunchOptions() {
  const options = {
    headless: false,
    slowMo: 50,
  };

  if (PLAYWRIGHT_CHANNEL) {
    options.channel = PLAYWRIGHT_CHANNEL;
    return options;
  }

  if (fs.existsSync(CHROME_EXECUTABLE)) {
    options.executablePath = CHROME_EXECUTABLE;
  }

  return options;
}

function withRedirectUri(loginUrl) {
  const separator = loginUrl.includes("?") ? "&" : "?";
  return `${loginUrl}${separator}redirect_uri=https://tenup.fft.fr/api/auth/callback`;
}

async function readLoginEndpoint(page) {
  return page.evaluate(async () => {
    const response = await fetch("/login", {
      credentials: "include",
      headers: {
        accept: "application/json, text/plain, */*",
      },
    });
    if (!response.ok) return "";

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    if (contentType.includes("application/json")) {
      const payload = JSON.parse(text);
      if (typeof payload === "string") return payload;
      return payload?.url || payload?.loginUrl || "";
    }

    const trimmed = text.trim();
    return /^https?:\/\//.test(trimmed) ? trimmed : "";
  }).catch(() => "");
}

async function clickLoginButton(page) {
  const locators = [
    page.getByRole("button", { name: /connexion|inscription|connecter/i }).first(),
    page.getByRole("link", { name: /connexion|inscription|connecter/i }).first(),
    page.locator("button", { hasText: /connexion|inscription|connecter/i }).first(),
    page.locator("a", { hasText: /connexion|inscription|connecter/i }).first(),
  ];

  for (const locator of locators) {
    try {
      if (await locator.count() === 0) continue;

      const popupPromise = page.context().waitForEvent("page", { timeout: 5000 }).catch(() => null);
      await locator.click({ timeout: 5000 });
      return (await popupPromise) || page;
    } catch (err) {
      // Try the next possible login control.
    }
  }

  return null;
}

async function waitForManualLogin(page) {
  console.log("\nSi une verification humaine ou un captcha apparait, resous-le dans la fenetre.");
  console.log("Clique ensuite sur Connexion/inscription, connecte-toi, puis attends le retour sur TenUp.\n");

  await page.waitForURL(
    url => /login\.fft\.fr|tenup\.fft\.fr\/api\/auth\/callback/.test(url.href),
    { timeout: 0 }
  ).catch(() => {});

  await page.waitForURL(
    url => url.hostname === "tenup.fft.fr" && !url.pathname.startsWith("/api/auth/callback"),
    { timeout: 0 }
  );
}

async function resolveLoginUrl(page) {
  if (TENUP_LOGIN_URL) {
    return withRedirectUri(TENUP_LOGIN_URL);
  }

  await page.goto(TENUP_HOME_URL, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForURL("**tenup.fft.fr/**", { timeout: 60000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

  const loginUrl = await readLoginEndpoint(page);
  if (loginUrl) return withRedirectUri(loginUrl);

  return null;
}

(async () => {
  const browser = await chromium.launch(getLaunchOptions());

  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("👉 Preparation du login TenUp/FFT...");

  const loginUrl = await resolveLoginUrl(page);
  let loginPage = page;

  if (loginUrl) {
    await page.goto(loginUrl, {
      waitUntil: "domcontentloaded",
    });
  } else {
    loginPage = await clickLoginButton(page);
    if (!loginPage) {
      await waitForManualLogin(page);
      loginPage = page;
    }
  }

  console.log("\n⚠️ Connecte-toi MANUELLEMENT dans la fenêtre si ce n'est pas deja fait");
  console.log("👉 Une fois connecté, je sauvegarde la session automatiquement...\n");

  // On attend que tu sois redirigé vers TenUp ou domaine FFT
  if (!loginPage.url().includes("tenup.fft.fr")) {
    await loginPage.waitForURL("**tenup.fft.fr/**", {
      timeout: 0,
    });
  }

  console.log("✅ Login détecté sur TenUp !");

  // Sauvegarde session complète
  await context.storageState({
    path: STATE_PATH,
  });

  console.log("💾 Session sauvegardée dans storageState.json");

  await browser.close();
})();
