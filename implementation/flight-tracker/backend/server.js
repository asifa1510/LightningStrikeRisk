const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
app.use(cors());

// env
const PORT = process.env.PORT || 4000;
const OS_USER = process.env.OPENSKY_USER || "";
const OS_PASS = process.env.OPENSKY_PASS || "";
const BBOX = process.env.BBOX || "68,6,97,36"; // India-ish
const CACHE_MS = Number(process.env.CACHE_MS || 10000); // 10s
const RETRY = Number(process.env.RETRY || 3);

// simple in-memory cache
let cache = { t: 0, json: null };

async function fetchWithRetry(url, headers, retries) {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url, { headers });
    if (res.status !== 503) return res; // return immediately if not 503
    if (i < retries) {
      await new Promise(r => setTimeout(r, 800 * (i + 1))); // backoff
    }
  }
  // last attempt
  return fetch(url, { headers });
}

app.get("/api/health", (_, res) => res.json({ ok: true }));

app.get("/api/states", async (req, res) => {
  try {
    // serve from cache if fresh
    if (cache.json && Date.now() - cache.t < CACHE_MS) {
      return res.json(cache.json);
    }

    const url = `https://opensky-network.org/api/states/all?bbox=${encodeURIComponent(BBOX)}`;
    const auth =
      OS_USER && OS_PASS
        ? "Basic " + Buffer.from(`${OS_USER}:${OS_PASS}`).toString("base64")
        : undefined;

    const headers = auth ? { Authorization: auth } : {};

    const r = await fetchWithRetry(url, headers, RETRY);
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).send(text || "OpenSky error");
    }

    const json = await r.json();

    // store cache
    cache = { t: Date.now(), json };
    return res.json(json);
  } catch (e) {
    console.error("Backend /api/states error:", e);
    return res.status(500).json({ error: "Failed to fetch from OpenSky" });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy running on http://localhost:${PORT}`);
});
