# backend/app.py
import os, time, math, random
from typing import Dict, Any, List, Optional, Tuple
from flask import Flask, jsonify, request
from flask_cors import CORS
import requests

# ---------------- Config ----------------
OPENSKY_BASE = "https://opensky-network.org/api/states/all"
OPENSKY_USER = os.getenv("OPENSKY_USER", "sasifa")        # your creds
OPENSKY_PASS = os.getenv("OPENSKY_PASS", "Asifareh1")

REQ_TIMEOUT = float(os.getenv("REQ_TIMEOUT", "7.0"))
UA = {"Accept": "application/json", "User-Agent": "lrp-flight-tracker/2.0"}

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}})

# ---------------- OpenSky helpers ----------------
def fetch_opensky_global() -> Optional[Dict[str, Any]]:
    """Fetch global states; try with auth then without."""
    try:
        r = requests.get(OPENSKY_BASE, auth=(OPENSKY_USER, OPENSKY_PASS), headers=UA, timeout=REQ_TIMEOUT)
        if r.status_code == 401:
            r = requests.get(OPENSKY_BASE, headers=UA, timeout=REQ_TIMEOUT)
        if r.status_code != 200:
            return None
        data = r.json()
        if not isinstance(data, dict) or "states" not in data:
            return None
        return data
    except Exception:
        return None

def find_flight(states: List[list], icao24: Optional[str], callsign: Optional[str]) -> Optional[list]:
    """Find a single state row by icao24 or callsign (trimmed)."""
    target_icao = (icao24 or "").lower().strip()
    target_call = (callsign or "").strip()
    best = None
    for st in states:
        # OpenSky indices
        # 0: icao24, 1: callsign, 5: lon, 6: lat, 7: baro_alt, 9: velocity, 10: true_track, 13: geo_alt
        if target_icao and (st[0] or "").lower() == target_icao:
            best = st; break
        if target_call and (st[1] or "").strip() == target_call:
            best = st
    return best

# ---------------- Geo helpers ----------------
def haversine_km(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    p = math.pi / 180.0
    dlat = (lat2 - lat1) * p
    dlon = (lon2 - lon1) * p
    a = math.sin(dlat/2)**2 + math.cos(lat1*p)*math.cos(lat2*p)*math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def lerp_path(origin: List[float], dest: List[float], npts: int = 64) -> List[List[float]]:
    """Simple polyline (lat,lon) between two points (not a true great-circle; good enough for UI)."""
    lat1, lon1 = origin
    lat2, lon2 = dest
    pts = []
    for i in range(npts+1):
        u = i / npts
        pts.append([lat1 + (lat2 - lat1) * u, lon1 + (lon2 - lon1) * u])
    return pts

def bent_path(origin: Tuple[float,float], dest: Tuple[float,float], npts: int = 60, detour_amp: float = 0.12) -> List[List[float]]:
    """Like lerp but applies a smooth sinusoidal lateral bend to visualize PPO avoiding mid-route risk."""
    (lat1, lon1), (lat2, lon2) = origin, dest
    pts: List[List[float]] = []
    for i in range(npts+1):
        u = i / npts
        # base linear
        lat = lat1 + (lat2 - lat1) * u
        lon = lon1 + (lon2 - lon1) * u
        # small bend (stronger near middle)
        wobble = detour_amp * math.sin(u * math.pi)  # 0 at ends, peak at middle
        lat += wobble * 0.6
        pts.append([lat, lon])
    return pts

def fake_risks_for_path(path: List[List[float]], bias: float = 0.18, amp: float = 0.62, lam: float = 4.0) -> List[float]:
    """
    Fake per-point lightning risk profile (0..1). Peaked around mid-route.
    Scaled slightly by lambda (risk sensitivity).
    """
    n = len(path)
    if n == 0:
        return []
    out: List[float] = []
    for i in range(n):
        u = i / max(1, n-1)
        r = bias + amp * math.sin(u * math.pi)  # 0..1-ish
        r = max(0.0, min(1.0, r))
        r = min(1.0, r * (0.6 + lam / 10.0))
        out.append(r)
    return out

# ---------------- Routes ----------------
@app.route("/")
def index():
    return jsonify({"ok": True, "endpoints": ["/healthz", "/opensky/states", "/live/flight", "/live/risk-route", "/route/cvar", "/optimize-path", "/route/ppo"]})

@app.route("/healthz")
def healthz():
    return jsonify({"ok": True})

@app.route("/opensky/states")
def opensky_states():
    data = fetch_opensky_global()
    if not data:
        return jsonify({"time": int(time.time()), "states": []}), 200
    # You can trim if needed:
    states = data.get("states") or []
    return jsonify({"time": data.get("time", int(time.time())), "states": states}), 200

# --------- live vector for a single flight ----------
# GET /live/flight?icao24=xxxx   OR   /live/flight?callsign=AI123
# Optional: &simulate=1 → if not found, return a small plausible dummy instead of nothing
@app.route("/live/flight")
def live_flight():
    icao24 = request.args.get("icao24")
    callsign = request.args.get("callsign")
    simulate = request.args.get("simulate", "0") == "1"

    data = fetch_opensky_global()
    if data:
        st = find_flight(data.get("states") or [], icao24, callsign)
        if st:
            lon = st[5]; lat = st[6]
            baro_alt = st[7]; vel = st[9]; track = st[10]; geo_alt = st[13]
            return jsonify({
                "ok": True,
                "icao24": st[0], "callsign": (st[1] or "").strip(),
                "lat": lat, "lon": lon,
                "altitude": geo_alt if geo_alt is not None else baro_alt,
                "velocity": vel,      # m/s
                "heading": track,     # degrees
                "time": data.get("time")
            }), 200

    # Not found
    if simulate:
        # small random position near Delhi to keep the UI moving
        lat = 28.6139 + random.uniform(-0.15, 0.15)
        lon = 77.2090 + random.uniform(-0.15, 0.15)
        return jsonify({
            "ok": False, "simulated": True,
            "lat": lat, "lon": lon,
            "altitude": 2500.0, "velocity": 210.0, "heading": 130.0,
            "time": int(time.time())
        }), 200

    return jsonify({"ok": False, "error": "flight not found"}), 200

# --------- PPO RL route (NEW) ----------
# POST /route/ppo
# { origin:{lat,lon}, destination:{lat,lon}, lambda: <risk_sensitivity> }
@app.route("/route/ppo", methods=["POST"])
def route_ppo():
    try:
        b = request.get_json(force=True) or {}
        o = b.get("origin") or {}
        d = b.get("destination") or {}
        lam = float(b.get("lambda", 4.0))

        lat1, lon1 = float(o.get("lat")), float(o.get("lon"))
        lat2, lon2 = float(d.get("lat")), float(d.get("lon"))

        # “Policy” path with a bend (risk-aware visual)
        path = bent_path((lat1, lon1), (lat2, lon2), npts=64, detour_amp=0.10 + 0.01*lam)
        risks = fake_risks_for_path(path, bias=0.18, amp=0.62, lam=lam)

        # Example metrics stub
        metrics = {"auc": 0.99, "accuracy": 0.93}

        return jsonify({"safe_path": path, "risks": risks, "metrics": metrics}), 200
    except Exception as e:
        # Frontend expects JSON with an error message when it shows "PPO route unavailable"
        return jsonify({"error": str(e)}), 500

# --------- risk + route (used by RiskAnalysis.tsx poller) ----------
# POST body:
# {
#   flight: {lat,lon,altitude,velocity},
#   destination: {lat,lon},
#   reroute_if_prob_gt,
#   planner: "cvar"|"a_star"|"ppo",
#   risk_sensitivity: number
# }
@app.route("/live/risk-route", methods=["POST"])
def live_risk_route():
    try:
        body = request.get_json(force=True) or {}
        fl  = body.get("flight") or {}
        dest = body.get("destination") or {}
        planner = (body.get("planner") or "cvar").lower()
        lam = float(body.get("risk_sensitivity", 4.0))

        lat, lon = float(fl.get("lat")), float(fl.get("lon"))
        dlat, dlon = float(dest.get("lat")), float(dest.get("lon"))

        # toy risk model (distance & altitude proxy) — replace with your ML later
        dist_km = haversine_km(lat, lon, dlat, dlon)
        alt = float(fl.get("altitude") or 2500.0)
        base = min(1.0, dist_km / 2000.0)
        alt_mod = 0.2 if alt > 9000 else 0.5 if alt > 3000 else 0.8
        prob = max(0.02, min(0.98, base * alt_mod))
        risk_level = "Low" if prob < 0.33 else "Medium" if prob < 0.66 else "High"

        risk_obj = {
            "model": "HTRPM",
            "risk": risk_level,
            "probability": prob,
            "uncertainty": 0.15,
            "proxies": {"lightning_prob": round(prob*0.8, 3), "turbulence": round(prob*0.6, 3)},
            "factors": {"alpha": 0.25, "beta": 0.21, "gamma": 0.19, "delta": 0.18, "eta": 0.17}
        }

        # choose planner
        if planner == "ppo":
            # Directly call the PPO function to keep response consistent
            path = bent_path((lat, lon), (dlat, dlon), npts=64, detour_amp=0.10 + 0.01*lam)
            # we don't embed risks here; frontend PPO updater can draw them from /route/ppo
            return jsonify({
                "risk": risk_obj,
                "safe_path": path,
                "metrics": {"auc": 0.99, "accuracy": 0.93}
            }), 200

        if planner == "a_star":
            # straight-ish path; your NSGA-II can be wired in instead
            base = lerp_path([lat, lon], [dlat, dlon], 96)
            return jsonify({
                "risk": risk_obj,
                "safe_path": base,
                "pareto": []  # optional list if you want to surface candidates here
            }), 200

        # default: CVaR-like
        path = lerp_path([lat, lon], [dlat, dlon], 96)
        return jsonify({
            "risk": risk_obj,
            "safe_path": path,
            "distance_km": round(dist_km, 1)
        }), 200

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 200

# --------- manual CVaR route ----------
@app.route("/route/cvar", methods=["POST"])
def route_cvar():
    b = request.get_json(force=True) or {}
    o, d = b.get("origin") or {}, b.get("destination") or {}
    lat1, lon1 = float(o.get("lat")), float(o.get("lon"))
    lat2, lon2 = float(d.get("lat")), float(d.get("lon"))
    path = lerp_path([lat1, lon1], [lat2, lon2], 96)
    return jsonify({"safe_path": path, "meta": {"algo": "CVaR_stub"}}), 200

# --------- manual optimize-path (A*/Pareto stub) ----------
@app.route("/optimize-path", methods=["POST"])
def optimize_path():
    b = request.get_json(force=True) or {}
    o, d = b.get("origin") or {}, b.get("destination") or {}
    lat1, lon1 = float(o.get("lat")), float(o.get("lon"))
    lat2, lon2 = float(d.get("lat")), float(d.get("lon"))
    base = lerp_path([lat1, lon1], [lat2, lon2], 96)
    # Create 2 fake Pareto variants by slightly offsetting the line
    off = 0.6
    p1 = [[lat + (i%10==0 and off or 0), lon] for (lat,lon), i in zip(base, range(len(base)))]
    p2 = [[lat, lon + (i%12==0 and off or 0)] for (lat,lon), i in zip(base, range(len(base)))]
    pareto = [
        {"lam": [1.0, 0.5], "path": p1, "distance_km": round(haversine_km(lat1,lon1,lat2,lon2)*1.03,1), "risk": 0.42, "uncertainty": 0.18},
        {"lam": [0.8, 0.8], "path": p2, "distance_km": round(haversine_km(lat1,lon1,lat2,lon2)*1.05,1), "risk": 0.36, "uncertainty": 0.22},
    ]
    return jsonify({"safe_path": base, "pareto": pareto}), 200

# ---------------- main ----------------
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
