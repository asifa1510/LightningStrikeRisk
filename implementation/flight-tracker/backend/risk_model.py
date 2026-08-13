# backend/risk_model.py
from __future__ import annotations
from typing import Dict, List

# ====== SIMPLE, STABLE RISK (defensible fallback) ======
# Linear blend T, WS, P, L, TI as discussed earlier; proxies are mock but stable.
# In production, replace with your trained BiLSTM+GPR and real nowcast tiles.

ALPHA, BETA, GAMMA, DELTA, ETA = 0.25, 0.20, 0.15, 0.30, 0.10

def _clip01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x

def _mock_meteorology(lat: float, lon: float) -> Dict[str, float]:
    # Smooth pseudo field: more lightning over west coast belt, wind in plains
    import math
    s = 0.5 + 0.5*math.sin((lat+lon)/15.0)
    l = 0.5 + 0.5*math.sin((lon)/10.0)  # lightning proxy
    t = 0.5 + 0.5*math.cos((lat)/12.0)  # convective temp proxy
    w = 0.5 + 0.5*math.sin((lat)/9.0)   # wind shear proxy
    p = 0.5 + 0.5*math.cos((lon)/11.0)  # pressure tendency proxy
    return {"T": t, "WS": w, "P": p, "L": l, "TI": s}

def risk_field(lat: float, lon: float) -> Dict[str, float]:
    m = _mock_meteorology(lat, lon)
    R = ALPHA*m["T"] + BETA*m["WS"] + GAMMA*m["P"] + DELTA*m["L"] + ETA*m["TI"]
    return {
        "risk": _clip01(R),
        "uncertainty": 0.5,  # proxy (replace with GPR sigma)
        "lightning_prob": _clip01(m["L"]),
        "turbulence": _clip01(m["WS"]),
    }

def predict_risk(sequence_10x9: List[List[float]]) -> Dict[str, float]:
    # sequence is not used in this fallback; we compute risk at last point
    lat, lon = sequence_10x9[-1][0], sequence_10x9[-1][1]
    rf = risk_field(lat, lon)
    r = rf["risk"]
    return {
        "risk": "Low" if r < 0.33 else "Medium" if r < 0.66 else "High",
        "probability": r,
        "uncertainty": rf["uncertainty"],
        "proxies": {"lightning_prob": rf["lightning_prob"], "turbulence": rf["turbulence"]},
    }
