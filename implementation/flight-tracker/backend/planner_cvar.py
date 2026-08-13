# backend/planner_cvar.py
from __future__ import annotations
from typing import List, Tuple
import numpy as np
from utils import haversine_km, geodesic_points
from risk_model import risk_field

LatLon = Tuple[float,float]

def _path_points(origin: LatLon, dest: LatLon, n: int = 64) -> List[LatLon]:
    return geodesic_points(origin, dest, n)

def _cvar_on_path(path: List[LatLon], alpha: float) -> float:
    risks = np.array([risk_field(la,lo)["risk"] for la,lo in path], dtype=float)
    q = np.quantile(risks, alpha)
    tail = risks[risks >= q]
    return float(tail.mean()) if tail.size else float(risks.mean())

def cvar_route(origin: LatLon, dest: LatLon, start_unix: int,
               alpha: float = 0.9, lam_dist: float = 1.0, lam_cvar: float = 4.0,
               airway=None, nofly=None) -> List[List[float]]:
    """
    Optimize distance + CVaR of risk along the path.
    For stability we:
      1) start with great-circle,
      2) locally perturb via coarse lateral offsets and keep best.
    """
    base = _path_points(origin, dest, 64)
    best = base; best_obj = lam_dist*sum(haversine_km(base[i-1], base[i]) for i in range(1,len(base))) + lam_cvar*_cvar_on_path(base, alpha)

    # lateral perturbations ±0.25/±0.5 deg around mid thirds (very fast & stable)
    lat_offs = [-0.5, -0.25, 0.0, 0.25, 0.5]
    lon_offs = [-0.5, -0.25, 0.0, 0.25, 0.5]
    idxs = [int(len(base)*0.33), int(len(base)*0.66)]
    for dlat in lat_offs:
        for dlon in lon_offs:
            cand = base.copy()
            for k in idxs:
                la, lo = cand[k]
                cand[k] = (la + dlat, lo + dlon)
            # smooth via 3-point average
            sm = []
            for i,p in enumerate(cand):
                if 0<i<len(cand)-1:
                    la = (cand[i-1][0]+p[0]+cand[i+1][0])/3
                    lo = (cand[i-1][1]+p[1]+cand[i+1][1])/3
                    sm.append((la,lo))
                else:
                    sm.append(p)
            dist = sum(haversine_km(sm[i-1], sm[i]) for i in range(1,len(sm)))
            cvar = _cvar_on_path(sm, alpha)
            obj = lam_dist*dist + lam_cvar*cvar
            if obj < best_obj:
                best_obj = obj; best = sm

    return [[la,lo] for la,lo in best]
