(() => {
  if (window.__TENUP_APP_SYNC_BRIDGE__) return;
  window.__TENUP_APP_SYNC_BRIDGE__ = true;

  const SOURCE = "tenup-app-sync-bridge";
  const CONTENT_SOURCE = "tenup-app-sync-content";
  const capturedPayloads = [];

  function shouldCapture(url) {
    return /bilan-classement|classement|tournoi|resultat|palmares|padel/i.test(String(url || ""));
  }

  function cloneJson(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (err) {
      return null;
    }
  }

  function pushPayload(payload) {
    if (!payload || capturedPayloads.length >= 80) return;
    capturedPayloads.push(payload);
    window.postMessage({ source: SOURCE, type: "payload", payload }, "*");
  }

  function extractNuxtPayload() {
    const payloads = [];
    const nuxt = window.__NUXT__;

    if (nuxt) {
      const clone = cloneJson(nuxt);
      if (clone) payloads.push({ source: "nuxt", body: clone });
    }

    const dataNode = document.getElementById("__NUXT_DATA__");
    if (dataNode?.textContent) {
      try {
        payloads.push({ source: "nuxt-data", body: JSON.parse(dataNode.textContent) });
      } catch (err) {
        payloads.push({ source: "nuxt-data", error: err.message });
      }
    }

    return payloads;
  }

  async function readJsonResponse(response, url, method) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return;

    try {
      const body = await response.clone().json();
      pushPayload({ source: "fetch", url, method, status: response.status, body });
    } catch (err) {
      pushPayload({ source: "fetch", url, method, status: response.status, error: err.message });
    }
  }

  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const request = args[0];
    const init = args[1] || {};
    const url = typeof request === "string" ? request : request?.url;
    const method = init.method || request?.method || "GET";
    const response = await originalFetch(...args);

    if (shouldCapture(url)) {
      readJsonResponse(response, url, method);
    }

    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
    this.__tenupSyncRequest = { method, url };
    return originalOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function send(...args) {
    this.addEventListener("load", () => {
      const request = this.__tenupSyncRequest || {};
      const contentType = this.getResponseHeader("content-type") || "";
      if (!shouldCapture(request.url) || !contentType.includes("application/json")) return;

      try {
        pushPayload({
          source: "xhr",
          url: request.url,
          method: request.method || "GET",
          status: this.status,
          body: JSON.parse(this.responseText)
        });
      } catch (err) {
        pushPayload({
          source: "xhr",
          url: request.url,
          method: request.method || "GET",
          status: this.status,
          error: err.message
        });
      }
    });

    return originalSend.apply(this, args);
  };

  async function probeEndpoints(personId) {
    if (!personId) return [];

    const endpoints = [
      {
        name: "bilan-classement",
        method: "POST",
        url: `/v1/personnes/${personId}/bilan-classement`,
        body: {}
      },
      {
        name: "historique",
        method: "GET",
        url: `/v1/personnes/${personId}/bilan-classement/historique`
      }
    ];
    const results = [];

    for (const endpoint of endpoints) {
      try {
        const response = await originalFetch(endpoint.url, {
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
          source: "probe",
          name: endpoint.name,
          url: endpoint.url,
          status: response.status,
          contentType,
          body
        });
      } catch (err) {
        results.push({
          source: "probe",
          name: endpoint.name,
          url: endpoint.url,
          status: 0,
          contentType: "",
          error: err.message
        });
      }
    }

    return results;
  }

  window.addEventListener("message", async event => {
    if (event.source !== window || event.data?.source !== CONTENT_SOURCE) return;
    if (event.data.type !== "collect") return;

    const requestId = event.data.requestId;
    const personId = event.data.personId;
    const probed = await probeEndpoints(personId);
    const nuxtPayloads = extractNuxtPayload();

    window.postMessage({
      source: SOURCE,
      type: "collect-result",
      requestId,
      payloads: [...capturedPayloads, ...nuxtPayloads, ...probed]
    }, "*");
  });
})();
