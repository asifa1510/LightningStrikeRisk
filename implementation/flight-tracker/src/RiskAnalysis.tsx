// frontend/src/RiskAnalysis.tsx
// Live, auto-updating flight animation + ML CVaR routing (A*/NSGA-II, PPO-RL),
// airports layer where FROM (live origin) & TO (destination) are RED, all other airports BLACK.
// Includes HTRPM (BiLSTM + GPR + VAE) risk outputs, attention-based explainer,
// NSGA-II Pareto set visualization, and metrics panel as discussed in the RFCoN paper.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Flight } from "./FlightTracker";

// ========= CONFIG =========
const BACKEND_URL = "http://127.0.0.1:5000";
const POLL_MS_MIN = 4000;          // fast path when healthy
const POLL_MS_MAX = 15000;         // backoff ceiling
const REROUTE_THRESHOLD = 0.6;     // auto-replan when risk prob >= 0.6
const HEADING_SNAP_DEG = 10;       // rotate icon only if heading changes sufficiently
const MAX_TRAIL_POINTS = 2500;
const FETCH_TIMEOUT_MS = 9000;
const RETRIES = 2;                 // transient retry attempts for manual actions

// 👉 NEW: PPO retry cadence for auto-updation after failures
const PPO_RETRY_EVERY = 4;         // retry PPO every N poll cycles after a failure

// ========= TYPES (aligned with PID150) =========
// HTRPM = BiLSTM (temporal) + GPR (uncertainty) + VAE (latent)
export type RiskV2 = {
  model?: "HTRPM" | "Baseline";
  risk: "Low" | "Medium" | "High";
  probability: number;            // 0..1
  uncertainty: number;            // 0..1  (from GPR)
  proxies: { lightning_prob: number; turbulence: number };
  factors?: {                     // R = αT + βWS + γP + δL + ηTI
    temperature?: number;
    windspeed?: number;
    pressure?: number;
    lightning?: number;
    turbulenceIdx?: number;
    alpha?: number; beta?: number; gamma?: number; delta?: number; eta?: number;
  };
};

export type AttentionWeight = { feature: string; weight: number }; // Transformer self-attention explainer

export type ParetoItem = {
  lam?: [number, number];
  path: [number, number][];
  distance_km: number;
  risk: number;
  fuel_kg?: number;
  uncertainty?: number;
  tags?: string[]; // e.g., ["low-risk", "shortest", "fuel-opt"]
};

export type PlannerMode = "A*_Pareto" | "CVaR_ML" | "PPO_RL";

export type Metrics = {
  accuracy?: number;         // ~0.9335 in paper (test)
  auc?: number;              // ~1.00 in paper
  pr_curve?: { precision: number; recall: number }[];
  confusion?: { tn: number; fp: number; fn: number; tp: number };
};

const airportCoords: Record<string, [number, number]> = {
  "Delhi (DEL)": [28.5562, 77.1],
  "Mumbai (BOM)": [19.0896, 72.8656],
  "Bengaluru (BLR)": [13.1986, 77.7066],
  "Chennai (MAA)": [12.9941, 80.1709],
  "Kolkata (CCU)": [22.6547, 88.4467],
  "Hyderabad (HYD)": [17.2403, 78.4294],
  "Pune (PNQ)": [18.5821, 73.9197],
  "Ahmedabad (AMD)": [23.0736, 72.6347],
};

// ========= ICONS =========
function makePlaneIcon(headingDeg: number) {
  const size = 36;
  const html = `
    <div style="width:${size}px;height:${size}px;transform: rotate(${headingDeg}deg);transform-origin:center;display:flex;align-items:center;justify-content:center;">
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="#2563eb" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,.25));">
        <path d="M2.5 19l8.5-5 0-5.5c0-.55.45-1 1-1s1 .45 1 1V14l8.5 5-2 0-7.5-3.5L4.5 19H2.5z"/>
        <circle cx="12" cy="6" r="1" fill="#1e40af"/>
      </svg>
    </div>`;
  return L.divIcon({ className: "plane-icon", html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

const pinBlack = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -20], className: "pin-black",
} as any);
const pinRed = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -22], className: "pin-red",
} as any);

const ensureIconFilters = () => {
  const id = "airport-pin-filters";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    .pin-black img { filter: grayscale(100%) brightness(0%) contrast(120%); }
    .pin-red img { filter: hue-rotate(330deg) saturate(800%) brightness(110%); }
    .airport-label { background: rgba(0,0,0,.65); color: #fff; border-radius: 6px; padding: 2px 6px; box-shadow: 0 1px 2px rgba(0,0,0,.25); font-weight: 600; }
    .bar { height: 8px; border-radius: 9999px; background: #e5e7eb; overflow: hidden; }
    .bar > span { display:block; height:100%; background: #10b981; }
    .btn { cursor:pointer; transition:opacity .15s ease; }
    .btn[disabled] { opacity:.6; cursor:not-allowed; }
  `;
  document.head.appendChild(style);
};

// ========= SMALL UI =========
const RiskBadge: React.FC<{ level?: "Low" | "Medium" | "High" }> = ({ level }) => {
  const color = level === "High" ? "#ef4444" : level === "Medium" ? "#f59e0b" : "#10b981";
  const label = level ?? "-";
  return <span style={{ background: color, color: "white", padding: "4px 10px", borderRadius: 999, fontWeight: 700 }}>{label}</span>;
};

// ========= GEO UTILS =========
function projectForward(lat: number, lon: number, headingDeg?: number, gs_mps?: number, minutes = 8): [number, number][] {
  if (!headingDeg || !gs_mps) return [];
  const R = 6371000; // meters
  const stepSec = 30;
  const steps = Math.floor((minutes * 60) / stepSec);
  const rad = Math.PI / 180; const brg = headingDeg * rad;
  let la = lat * rad, lo = lon * rad; const out: [number, number][] = [];
  for (let k = 0; k < steps; k++) {
    const d = gs_mps * stepSec; const δ = d / R;
    const sinLa = Math.sin(la), cosLa = Math.cos(la);
    const sinδ = Math.sin(δ), cosδ = Math.cos(δ);
    const sinLa2 = sinLa * cosδ + cosLa * sinδ * Math.cos(brg);
    const la2 = Math.asin(sinLa2);
    const y = Math.sin(brg) * sinδ * cosLa; const x = cosδ - sinLa * sinLa2;
    const lo2 = lo + Math.atan2(y, x); la = la2; lo = lo2;
    out.push([la / rad, ((lo / rad + 540) % 360) - 180]);
  }
  return out;
}

// ========= RELIABLE FETCH HELPERS =========
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
const withTimeout = async (p: Promise<Response>, ms: number, ctl: AbortController) => {
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await p; } finally { clearTimeout(t); }
};

async function fetchJSONReliable(url: string, init: RequestInit, retries = RETRIES, timeoutMs = FETCH_TIMEOUT_MS) {
  let attempt = 0; let lastErr: any; let delay = 400;
  while (attempt <= retries) {
    const ctl = new AbortController();
    try {
      const res = await withTimeout(fetch(url, { ...init, signal: ctl.signal }), timeoutMs, ctl);
      const raw = await res.text();
      let data: any = null; try { data = raw ? JSON.parse(raw) : null; } catch {}
      if (!res.ok) throw new Error(data?.error || data?.message || raw || `HTTP ${res.status}`);
      return data ?? {};
    } catch (e) {
      lastErr = e;
      // network/timeout/backoff with jitter
      delay = Math.min(POLL_MS_MAX, delay * 1.8 + Math.random() * 200);
      await sleep(delay);
      attempt++;
    }
  }
  throw lastErr;
}

// ========= COMPONENT =========
const RiskAnalysis: React.FC = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const selectedFlight = (state?.selectedFlight ?? null) as Flight | null;

  // Map refs
  const mapRef = useRef<L.Map | null>(null);
  const airportsLayerRef = useRef<L.LayerGroup | null>(null);
  const straightLayerRef = useRef<L.Polyline | null>(null);
  const safeLayerRef = useRef<L.Polyline | null>(null);
  const previewLayerRef = useRef<L.Polyline | null>(null);
  const trailLayerRef = useRef<L.Polyline | null>(null);
  const projLayerRef = useRef<L.Polyline | null>(null);
  const planeRef = useRef<L.Marker | null>(null);
  const originMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);

  // Live state
  const [risk, setRisk] = useState<RiskV2 | null>(null);
  const [attention, setAttention] = useState<AttentionWeight[] | null>(null);
  const [paretoRoutes, setParetoRoutes] = useState<ParetoItem[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [msg, setMsg] = useState("");
  const [planner, setPlanner] = useState<PlannerMode>("CVaR_ML");
  const [riskSensitivity, setRiskSensitivity] = useState<number>(4.0); // λ in Eq. (5)/(6)
  const [lastUpdated, setLastUpdated] = useState<string>("—");
  const [isRouting, setIsRouting] = useState(false);

  // 👉 NEW: PPO retry & route-cache state
  const ppoFailCountRef = useRef<number>(0);
  const pollCountRef = useRef<number>(0);
  const routeCacheRef = useRef<{ path: [number, number][], source: "ppo"|"cvar"|"a_star" } | null>(null);

  // 👉 NEW: PPO live updater state (add-only)
  const ppoLoopBusyRef = useRef(false);
  const ppoTickMsRef = useRef(6000); // PPO refresh cadence
  const ppoRiskLayerRef = useRef<L.LayerGroup | null>(null); // colored segments layer (optional)

  // Poll cadence (adaptive backoff)
  const pollMsRef = useRef<number>(POLL_MS_MIN);
  const inFlightLiveRef = useRef<boolean>(false);

  // Interpolation
  const prevPosRef = useRef<{ lat: number; lon: number; t: number } | null>(null);
  const nextPosRef = useRef<{ lat: number; lon: number; t: number; heading?: number; altitude?: number; velocity?: number } | null>(null);
  const animReqRef = useRef<number | null>(null);
  const lastHeadingRef = useRef<number>(0);
  const liveTrailRef = useRef<[number, number][]>([]);

  const getDest = useMemo(() => {
    const lookup: Record<string, [number, number]> = airportCoords;
    return () => {
      if (!selectedFlight?.landingLocation) return null;
      return lookup[selectedFlight.landingLocation] ?? null;
    };
  }, [selectedFlight?.landingLocation]);

  const drawLine = (
    coords: [number, number][], color = "blue", weight = 3, dashArray?: string, fit = false,
  ): L.Polyline => {
    const map = mapRef.current!;
    const polyline = L.polyline(coords, { color, weight, dashArray, opacity: 0.95 }).addTo(map);
    if (fit) map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
    return polyline;
  };

  // Init map
  useEffect(() => {
    ensureIconFilters();
    if (mapRef.current) return;
    const m = L.map("risk-map", { zoomControl: true }).setView([20.6, 78.96], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
    airportsLayerRef.current = L.layerGroup().addTo(m);
    mapRef.current = m;
  }, []);

  // Mark airports: DEST in red (separate marker), others in BLACK.
  useEffect(() => {
    if (!mapRef.current || !airportsLayerRef.current) return;
    airportsLayerRef.current.clearLayers();
    const destName = selectedFlight?.landingLocation || "";
    Object.entries(airportCoords).forEach(([name, [lat, lon]]) => {
      if (name === destName) return; // TO marker later in red
      L.marker([lat, lon], { icon: pinBlack })
        .bindTooltip(name, { permanent: true, direction: "top", offset: L.point(0, -18), className: "airport-label" })
        .bindPopup(`<b>${name}</b>`)
        .addTo(airportsLayerRef.current!);
    });
  }, [mapRef.current, state]);

  // Seed initial markers/lines
  useEffect(() => {
    if (!mapRef.current || !selectedFlight) return;
    const dest = getDest();
    const lat = selectedFlight.lat ?? null; const lon = selectedFlight.lon ?? null;
    if (lat == null || lon == null) { setMsg("❌ Missing live position for flight."); return; }
    if (!dest) { setMsg("❌ Unknown destination airport."); return; }
    setMsg(""); const start: [number, number] = [lat, lon];

    planeRef.current?.remove();
    planeRef.current = L.marker(start, { icon: makePlaneIcon(0) }).addTo(mapRef.current).bindPopup(`${selectedFlight.callsign} (live)`);

    originMarkerRef.current?.remove();
    originMarkerRef.current = L.marker(start, { icon: pinRed }).addTo(mapRef.current)
      .bindTooltip("FROM (live)", { permanent: true, direction: "right", offset: L.point(10, 0) });

    destMarkerRef.current?.remove();
    destMarkerRef.current = L.marker(dest, { icon: pinRed }).addTo(mapRef.current)
      .bindTooltip(`${selectedFlight.landingLocation} — TO`, { permanent: true, direction: "left", offset: L.point(-10, 0) });

    trailLayerRef.current?.remove();
    liveTrailRef.current = [start];
    trailLayerRef.current = L.polyline(liveTrailRef.current, { color: "#6b7280", weight: 3, opacity: 0.85 }).addTo(mapRef.current);

    straightLayerRef.current?.remove();
    straightLayerRef.current = drawLine([start, dest], "#2563eb", 2, undefined, true);

    projLayerRef.current?.remove();

    const now = performance.now();
    prevPosRef.current = { lat, lon, t: now };
    nextPosRef.current = { lat, lon, t: now + pollMsRef.current };
  }, [selectedFlight]);

  // Animation loop (smooth position)
  useEffect(() => {
    if (!mapRef.current || !planeRef.current) return;
    const step = () => {
      const prev = prevPosRef.current; const next = nextPosRef.current;
      if (prev && next) {
        const now = performance.now(); const span = Math.max(1, next.t - prev.t);
        let u = (now - prev.t) / span; u = Math.min(Math.max(u, 0), 1);
        const lat = prev.lat + (next.lat - prev.lat) * u; const lon = prev.lon + (next.lon - prev.lon) * u;
        planeRef.current!.setLatLng([lat, lon]);
        const trail = liveTrailRef.current; const last = trail[trail.length - 1];
        if (!last || Math.hypot(lat - last[0], lon - last[1]) > 0.0015) {
          trail.push([lat, lon]); if (trail.length > MAX_TRAIL_POINTS) trail.shift();
          trailLayerRef.current?.setLatLngs(trail);
        }
        const dest = getDest(); if (dest && straightLayerRef.current) straightLayerRef.current.setLatLngs([[lat, lon], dest]);
        const hdg = (next.heading ?? lastHeadingRef.current) % 360;
        if (Math.abs(hdg - lastHeadingRef.current) >= HEADING_SNAP_DEG) { planeRef.current!.setIcon(makePlaneIcon(hdg)); lastHeadingRef.current = hdg; }
      }
      animReqRef.current = requestAnimationFrame(step);
    };
    animReqRef.current = requestAnimationFrame(step);
    return () => { if (animReqRef.current) cancelAnimationFrame(animReqRef.current); };
  }, [mapRef.current, planeRef.current]);

  // LIVE polling (no overlap, adaptive backoff) + 👉 PPO auto-updation logic
  useEffect(() => {
    if (!selectedFlight) return;
    const callsign = (selectedFlight.callsign || "").trim();
    const dest = getDest(); if (!dest) return;

    let timer: any = null; // single declaration
    const loop = async () => {
      if (inFlightLiveRef.current) return; // skip if previous still running
      inFlightLiveRef.current = true;
      pollCountRef.current += 1;

      try {
        // 1) Live position
        const idParam = selectedFlight?.icao24 ? `icao24=${encodeURIComponent(selectedFlight.icao24)}` : `callsign=${encodeURIComponent(callsign)}`;
        const url = `${BACKEND_URL}/live/flight?${idParam}&simulate=1`;
        const j = await fetchJSONReliable(url, { method: "GET" }, 1, FETCH_TIMEOUT_MS);
        if (j.lat == null || j.lon == null) { setMsg("⚠️ Live feed returned null coordinates."); return; }

        const lat = Number(j.lat); const lon = Number(j.lon);
        const altitude = j.altitude != null ? Number(j.altitude) : undefined;
        const velocity = j.velocity != null ? Number(j.velocity) : undefined; // m/s
        const heading = j.heading != null ? Number(j.heading) : undefined;

        // interpolation target
        const now = performance.now();
        const prevNext = nextPosRef.current ?? { lat, lon, t: now, heading, altitude, velocity };
        prevPosRef.current = { lat: prevNext.lat, lon: prevNext.lon, t: now };
        nextPosRef.current = { lat, lon, t: now + pollMsRef.current, heading, altitude, velocity };

        // forward projection (purple dashed)
        projLayerRef.current?.remove(); const proj = projectForward(lat, lon, heading, velocity, 8);
        if (proj.length) projLayerRef.current = drawLine(proj, "#7c3aed", 2, "6 6", false);

        // 2) Risk + route via live endpoint (uses current planner)
        const body = {
          flight: { lat, lon, altitude, velocity },
          destination: { lat: dest[0], lon: dest[1] },
          reroute_if_prob_gt: REROUTE_THRESHOLD,
          planner: planner === "PPO_RL" ? "ppo" : planner === "A*_Pareto" ? "a_star" : "cvar",
          risk_sensitivity: riskSensitivity,
        };
        let data: any = null;
        try {
          data = await fetchJSONReliable(`${BACKEND_URL}/live/risk-route`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
          }, 1, FETCH_TIMEOUT_MS);

          // success => reset PPO fail counter
          if (planner === "PPO_RL") ppoFailCountRef.current = 0;
        } catch (err) {
          // If we're in PPO mode and it failed, increase PPO fail count and continue (we'll retry PPO below)
          if (planner === "PPO_RL") {
            ppoFailCountRef.current += 1;
          } else {
            throw err; // non-PPO errors bubble up
          }
        }

        // apply live risk/route when available
        if (data) {
          const out: RiskV2 | null = data?.risk ?? null; if (out) setRisk(out);
          if (Array.isArray(data?.safe_path) && data.safe_path.length) {
            safeLayerRef.current?.remove();
            safeLayerRef.current = drawLine(data.safe_path, "green", 4);
            routeCacheRef.current = { path: data.safe_path, source: planner === "PPO_RL" ? "ppo" : planner === "A*_Pareto" ? "a_star" : "cvar" };
          }
          if (Array.isArray(data?.pareto)) setParetoRoutes(data.pareto);
          if (Array.isArray(data?.attention)) setAttention(data.attention);
          if (data?.metrics) setMetrics(data.metrics);
          setMsg("");
        }

        // 👉 3) PPO auto-updation: if PPO previously failed, retry every PPO_RETRY_EVERY polls
        if (planner === "PPO_RL" && ppoFailCountRef.current > 0 && (pollCountRef.current % PPO_RETRY_EVERY === 0)) {
          try {
            const ppo = await fetchJSONReliable(`${BACKEND_URL}/route/ppo`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                origin: { lat, lon },
                destination: { lat: dest[0], lon: dest[1] },
                lambda: riskSensitivity
              }),
            }, 1, FETCH_TIMEOUT_MS);

            if (Array.isArray(ppo?.safe_path) && ppo.safe_path.length) {
              safeLayerRef.current?.remove();
              safeLayerRef.current = drawLine(ppo.safe_path, "green", 4);
              routeCacheRef.current = { path: ppo.safe_path, source: "ppo" };
              ppoFailCountRef.current = 0; // PPO is back!
            }
          } catch {
            // still failing; keep last good route silently
          }
        }

        // keep last good route visible if live endpoint returned none
        if (!data?.safe_path && routeCacheRef.current) {
          safeLayerRef.current?.remove();
          safeLayerRef.current = drawLine(routeCacheRef.current.path, "green", 4);
        }

        setLastUpdated(new Date().toLocaleTimeString("en-IN", { hour12: false }));
        // success → tighten cadence
        pollMsRef.current = Math.max(POLL_MS_MIN, Math.floor(pollMsRef.current * 0.85));
      } catch (e: any) {
        console.error("Live poll error:", e);
        setMsg(`⚠️ Live update problem — ${e?.message ?? e}. Retrying…`);
        // failure → backoff
        pollMsRef.current = Math.min(POLL_MS_MAX, Math.floor(pollMsRef.current * 1.5 + 500));
      } finally {
        inFlightLiveRef.current = false;
        // schedule next tick
        timer = setTimeout(loop, pollMsRef.current);
      }
    };

    timer = setTimeout(loop, 50);
    return () => clearTimeout(timer);
  }, [selectedFlight, planner, riskSensitivity]);

  // === NEW: helper to draw PPO path colored by per-point lightning risk (optional) ===
  const drawPpoRiskColoredPath = (coords: [number, number][], risks?: number[]) => {
    if (ppoRiskLayerRef.current) {
      ppoRiskLayerRef.current.clearLayers();
      mapRef.current?.removeLayer(ppoRiskLayerRef.current);
      ppoRiskLayerRef.current = null;
    }
    if (!risks || risks.length < 2 || risks.length !== coords.length) return;

    const g = L.layerGroup().addTo(mapRef.current!);
    ppoRiskLayerRef.current = g;

    const colorFor = (p: number) => (p >= 0.66 ? "#ef4444" : p >= 0.33 ? "#f59e0b" : "#10b981"); // red/amber/green
    for (let i = 1; i < coords.length; i++) {
      const seg: [number, number][] = [coords[i - 1], coords[i]];
      const p = Math.max(0, Math.min(1, risks[i] ?? risks[i - 1] ?? 0));
      L.polyline(seg, { color: colorFor(p), weight: 5, opacity: 0.95 }).addTo(g);
    }
  };

  // === NEW: PPO RL continuous updater loop (adds-only, independent of your main loop) ===
  useEffect(() => {
    if (planner !== "PPO_RL") return;

    let timer: any = null;
    const tick = async () => {
      if (ppoLoopBusyRef.current) { timer = setTimeout(tick, ppoTickMsRef.current); return; }

      const dest = getDest();
      const next = nextPosRef.current;
      if (!dest || !next) { timer = setTimeout(tick, ppoTickMsRef.current); return; }

      ppoLoopBusyRef.current = true;
      try {
        const data = await fetchJSONReliable(`${BACKEND_URL}/route/ppo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: { lat: next.lat, lon: next.lon },
            destination: { lat: dest[0], lon: dest[1] },
            lambda: riskSensitivity,
            // optionally: include_risk_profile: true
          }),
        });

        if (Array.isArray(data.safe_path) && data.safe_path.length) {
          // Replace plain line, draw colored risk if available
          safeLayerRef.current?.remove();
          if (Array.isArray(data.risks) && data.risks.length === data.safe_path.length) {
            drawPpoRiskColoredPath(data.safe_path, data.risks);
          } else {
            safeLayerRef.current = L.polyline(data.safe_path, { color: "green", weight: 4, opacity: 0.95 }).addTo(mapRef.current!);
            if (ppoRiskLayerRef.current) {
              mapRef.current?.removeLayer(ppoRiskLayerRef.current);
              ppoRiskLayerRef.current = null;
            }
          }
          routeCacheRef.current = { path: data.safe_path, source: "ppo" };
          setMsg("");
        }
        if (data?.metrics) setMetrics(data.metrics);
      } catch (e: any) {
        // FIX HERE: use m.includes instead of mincludes
        setMsg((m) => ((m && m.includes("PPO route")) ? m : `⚠️ PPO route unavailable — ${e?.message ?? e}`));
      } finally {
        ppoLoopBusyRef.current = false;
        timer = setTimeout(tick, ppoTickMsRef.current);
      }
    };

    timer = setTimeout(tick, 300);
    return () => clearTimeout(timer);
  }, [planner, riskSensitivity, selectedFlight]);

  // Manual "Get Safe Route" — unchanged
  const handleManualSafeRoute = async () => {
    const dest = getDest(); const next = nextPosRef.current; if (!dest || !next) return;
    setIsRouting(true); setMsg("");
    try {
      if (planner === "CVaR_ML") {
        const data = await fetchJSONReliable(`${BACKEND_URL}/route/cvar`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin: { lat: next.lat, lon: next.lon }, destination: { lat: dest[0], lon: dest[1] }, alpha: 0.9, lam_dist: 1.0, lam_cvar: riskSensitivity }),
        });
        if (Array.isArray(data.safe_path) && data.safe_path.length) {
          safeLayerRef.current?.remove(); safeLayerRef.current = drawLine(data.safe_path, "green", 4);
          routeCacheRef.current = { path: data.safe_path, source: "cvar" };
        }
        if (Array.isArray(data.attention)) setAttention(data.attention);
        if (data.metrics) setMetrics(data.metrics);
      } else if (planner === "A*_Pareto") {
        const data = await fetchJSONReliable(`${BACKEND_URL}/optimize-path`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin: { lat: next.lat, lon: next.lon }, destination: { lat: dest[0], lon: dest[1] }, strategy: "nsga2" }),
        });
        if (Array.isArray(data.safe_path) && data.safe_path.length) {
          safeLayerRef.current?.remove(); safeLayerRef.current = drawLine(data.safe_path, "green", 4);
          routeCacheRef.current = { path: data.safe_path, source: "a_star" };
        }
        if (Array.isArray(data.pareto)) setParetoRoutes(data.pareto);
      } else {
        const data = await fetchJSONReliable(`${BACKEND_URL}/route/ppo`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin: { lat: next.lat, lon: next.lon }, destination: { lat: dest[0], lon: dest[1] }, lambda: riskSensitivity }),
        });
        if (Array.isArray(data.safe_path) && data.safe_path.length) {
          safeLayerRef.current?.remove(); safeLayerRef.current = drawLine(data.safe_path, "green", 4);
          routeCacheRef.current = { path: data.safe_path, source: "ppo" };
          ppoFailCountRef.current = 0;
        }
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch (err: any) {
      console.error("Route request error (manual):", err);
      setMsg(`⚠️ Failed to get safe route — ${err?.message ?? err}`);
    } finally { setIsRouting(false); }
  };

  const handlePreviewPareto = (p: ParetoItem) => {
    if (!p?.path?.length) return; previewLayerRef.current?.remove(); previewLayerRef.current = drawLine(p.path, "#f59e0b", 4, "6 6");
  };

  const handleClearRoutes = () => {
    safeLayerRef.current?.remove(); (safeLayerRef as any).current = null;
    previewLayerRef.current?.remove(); (previewLayerRef as any).current = null;
    projLayerRef.current?.remove(); (projLayerRef as any).current = null;
    if (trailLayerRef.current) { liveTrailRef.current = []; trailLayerRef.current.setLatLngs(liveTrailRef.current); }
    if (ppoRiskLayerRef.current) {
      mapRef.current?.removeLayer(ppoRiskLayerRef.current);
      ppoRiskLayerRef.current = null;
    }
  };

  const formatPct = (x?: number) => (x == null ? "-" : `${(x * 100).toFixed(2)}%`);

  return (
    <div className="risk-analysis-container" style={{ maxWidth: 1060, margin: "0 auto" }}>
      <h1 className="text-center text-2xl font-bold" style={{ marginBottom: 10 }}>
        {selectedFlight?.callsign || "Unknown"} Risk Analysis
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 12 }}>
        <div className="risk-box">
          <p><strong>Risk Level:&nbsp;</strong><RiskBadge level={risk?.risk} /></p>
          <p><strong>Probability:</strong> {formatPct(risk?.probability)}</p>
          <p><strong>Uncertainty:</strong> {formatPct(risk?.uncertainty)}</p>
          <p><strong>Lightning Proxy:</strong> {(risk?.proxies?.lightning_prob ?? 0).toFixed(2)}</p>
          <p><strong>Turbulence Proxy:</strong> {(risk?.proxies?.turbulence ?? 0).toFixed(2)}</p>
          {risk?.factors && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontWeight: 700 }}>Linear Risk Mix (R = αT + βWS + γP + δL + ηTI):</p>
              <div style={{ fontSize: 12, color: "#374151" }}>
                α={risk.factors.alpha ?? "?"}, β={risk.factors.beta ?? "?"}, γ={risk.factors.gamma ?? "?"}, δ={risk.factors.delta ?? "?"}, η={risk.factors.eta ?? "?"}
              </div>
            </div>
          )}
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            Live (OpenSky): adaptive {Math.round(pollMsRef.current / 1000)}s • Last update: {lastUpdated}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <label style={{ fontWeight: 600, marginRight: 8 }}>Planner:</label>
          <select
            value={planner}
            onChange={(e) => setPlanner(e.target.value as PlannerMode)}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", marginRight: 8 }}
          >
            <option value="CVaR_ML">CVaR (ML, risk-aware)</option>
            <option value="A*_Pareto">A* / NSGA-II (Pareto)</option>
            <option value="PPO_RL">PPO (RL, MMDP)</option>
          </select>
          <div style={{ marginTop: 10 }}>
            <label style={{ fontWeight: 600, marginRight: 6 }}>Risk λ:</label>
            <input type="range" min={1} max={8} step={0.5} value={riskSensitivity} onChange={(e) => setRiskSensitivity(parseFloat(e.target.value))} />
            <span style={{ marginLeft: 8, fontWeight: 700 }}>{riskSensitivity.toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div id="risk-map" style={{ height: 500, width: "100%", borderRadius: 8, overflow: "hidden", marginTop: 10 }} />

      {msg && <p style={{ color: "#d9534f", marginTop: 12, textAlign: "center", fontWeight: 600 }}>{msg}</p>}

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
        <button className="mt-4 bg-indigo-600 text-white py-2 px-4 rounded-md w-full btn" onClick={handleManualSafeRoute} disabled={isRouting}>
          {isRouting ? "⌛" : "🟢"} Get Safe Route ({planner === "CVaR_ML" ? "CVaR ML" : planner === "PPO_RL" ? "PPO RL" : "A* / Pareto"})
        </button>
        <button className="mt-4 bg-gray-700 text-white py-2 px-4 rounded-md w-full btn" onClick={handleClearRoutes} disabled={isRouting}>
          ♻️ Clear Routes
        </button>
      </div>

      {/* Attention-based risk explainer */}
      {attention && attention.length > 0 && (
        <div className="mt-4 bg-white p-4 rounded-lg shadow" style={{ textAlign: "left", marginTop: 16 }}>
          <h3 className="font-bold text-lg mb-2">🧠 Risk Explainer (Attention Weights)</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {attention.map((a, idx) => (
              <div key={idx}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>{a.feature}</span>
                  <span>{(a.weight * 100).toFixed(1)}%</span>
                </div>
                <div className="bar"><span style={{ width: `${Math.min(100, Math.max(0, a.weight * 100))}%` }} /></div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">Higher weight ⇒ stronger contribution to current risk estimate.</p>
        </div>
      )}

      {/* NSGA-II Pareto front list */}
      {planner === "A*_Pareto" && paretoRoutes.length > 0 && (
        <div className="mt-4 bg-white p-4 rounded-lg shadow" style={{ textAlign: "left" }}>
          <h3 className="font-bold text-lg mb-2">⚖️ Pareto Route Options (Fuel vs Risk vs Distance)</h3>
          <ul style={{ display: "grid", gap: 8 }}>
            {paretoRoutes.map((p, idx) => (
              <li key={idx} className="border border-gray-200 p-3 rounded-md" style={{ fontSize: "0.95rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div><strong>Option {idx + 1}</strong>{p.tags && p.tags.length ? <span style={{ marginLeft: 8, fontSize: 12, color: "#374151" }}>({p.tags.join(", ")})</span> : null}</div>
                  <div>Distance: {p.distance_km.toFixed?.(1) ?? p.distance_km} km</div>
                  {p.fuel_kg != null && <div>Fuel: {p.fuel_kg.toFixed?.(0) ?? p.fuel_kg} kg</div>}
                  <div>Risk: {p.risk.toFixed?.(3) ?? p.risk}</div>
                  {p.uncertainty != null && <div>Uncertainty: {p.uncertainty.toFixed?.(3) ?? p.uncertainty}</div>}
                  {p.lam && <div>λ = ({p.lam[0]}, {p.lam[1]})</div>}
                </div>
                <button className="bg-amber-500 hover:bg-amber-600 text-white py-1 px-3 rounded" onClick={() => handlePreviewPareto(p)}>Preview</button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 mt-2">Green: chosen safe route • Orange dashed: previewed Pareto route • Blue: live→dest • Grey: actual trail • Purple dashed: projection</p>
        </div>
      )}

      {/* Metrics panel (accuracy, AUC, confusion) */}
      {metrics && (
        <div className="mt-4 bg-white p-4 rounded-lg shadow" style={{ textAlign: "left" }}>
          <h3 className="font-bold text-lg mb-2">📊 Model Performance (BiLSTM/HTRPM)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div className="border border-gray-200 rounded p-3"><div style={{ fontSize: 12, color: "#6b7280" }}>Accuracy</div><div style={{ fontSize: 20, fontWeight: 800 }}>{formatPct(metrics.accuracy)}</div></div>
            <div className="border border-gray-200 rounded p-3"><div style={{ fontSize: 12, color: "#6b7280" }}>AUC (ROC)</div><div style={{ fontSize: 20, fontWeight: 800 }}>{metrics.auc?.toFixed(3) ?? "-"}</div></div>
            {metrics.confusion && (
              <div className="border border-gray-200 rounded p-3">
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Confusion</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, fontSize: 13 }}>
                  <div>TN: <strong>{metrics.confusion.tn}</strong></div>
                  <div>FP: <strong>{metrics.confusion.fp}</strong></div>
                  <div>FN: <strong>{metrics.confusion.fn}</strong></div>
                  <div>TP: <strong>{metrics.confusion.tp}</strong></div>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">Paper reports ≈93.35% accuracy and AUC≈1.00 for lightning-risk prediction (BiLSTM/HTRPM).</p>
        </div>
      )}

      <button className="mt-3 bg-gray-600 text-white py-2 px-4 rounded-md w-full btn" onClick={() => navigate("/tracker")} style={{ marginTop: 10 }}>
        🔙 Back to Tracker
      </button>
    </div>
  );
};

export default RiskAnalysis;
