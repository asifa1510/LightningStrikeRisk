# backend/path_planner.py
from __future__ import annotations
from typing import List, Tuple, Optional, Dict
import heapq, math, random

from utils import haversine_km, geodesic_points
from risk_model import risk_field

LatLon = Tuple[float, float]

def _bbox_with_corridor(a: LatLon, b: LatLon, corridor_km: float) -> Tuple[float,float,float,float]:
    lat1, lon1 = a; lat2, lon2 = b
    pad_deg = corridor_km / 111.0  # ~1 deg ~111km
    return (min(lat1,lat2)-pad_deg, min(lon1,lon2)-pad_deg,
            max(lat1,lat2)+pad_deg, max(lon1,lon2)+pad_deg)

def _in_bbox(p: LatLon, box) -> bool:
    la, lo = p; a,b,c,d = box
    return (a <= la <= c) and (b <= lo <= d)

def _neighbors(p: LatLon, step_km: float) -> List[LatLon]:
    # 8-connected grid on lat/lon approx step
    d = step_km/111.0
    la, lo = p
    out: List[LatLon] = []
    for di in [-1,0,1]:
        for dj in [-1,0,1]:
            if di==0 and dj==0: continue
            out.append((la+di*d, lo+dj*d))
    return out

def _risk_cost(lat: float, lon: float) -> Tuple[float,float]:
    rf = risk_field(lat, lon)
    return rf["risk"], rf["uncertainty"]

def _astar(origin: LatLon, dest: LatLon, step_km: float,
           lam_dist: float, lam_risk: float, lam_unc: float,
           bbox, airway: Optional[List[LatLon]] = None,
           nofly_polys: Optional[List[List[LatLon]]] = None) -> List[LatLon]:
    # Simple and stable; bounds exploration to bbox, penalizes outside corridor via lam_unc.
    start = origin; goal = dest
    h = lambda p: haversine_km(p, goal)
    openq = []
    g: Dict[LatLon, float] = {start: 0.0}
    parent: Dict[LatLon, Optional[LatLon]] = {start: None}
    heapq.heappush(openq, (h(start), 0.0, start))
    seen = 0
    while openq and seen < 80000:
        _, gc, u = heapq.heappop(openq)
        seen += 1
        if haversine_km(u, goal) < step_km*1.1:
            parent[goal] = u
            break
        for v in _neighbors(u, step_km):
            if not _in_bbox(v, bbox): continue
            rd, ru = _risk_cost(v[0], v[1])
            step = haversine_km(u, v)
            cost = lam_dist*step + lam_risk*rd + lam_unc*ru*0.5
            ng = gc + cost
            if v not in g or ng < g[v]:
                g[v] = ng; parent[v] = u
                f = ng + h(v)
                heapq.heappush(openq, (f, ng, v))
    # Reconstruct
    path: List[LatLon] = []
    cur = goal if goal in parent else min(g.keys(), key=lambda p: h(p))
    while cur is not None:
        path.append(cur); cur = parent.get(cur)
    path.reverse()
    # Always return something; if too short, fall back to great-circle
    if len(path) < 4:
        path = geodesic_points(origin, dest, 64)
    return path

def a_star_route(origin: LatLon, dest: LatLon,
                 lam_dist=1.0, lam_risk=1.2, lam_unc=0.6, lam_corr=0.2,
                 airway: Optional[List[LatLon]] = None,
                 nofly_polys: Optional[List[List[LatLon]]] = None,
                 corridor_km: float = 25.0) -> List[List[float]]:
    bbox = _bbox_with_corridor(origin, dest, corridor_km)
    step_km = max(8.0, haversine_km(origin, dest)/80.0)  # denser for short legs
    pts = _astar(origin, dest, step_km, lam_dist, lam_risk, lam_unc, bbox, airway, nofly_polys)
    return [[la, lo] for la,lo in pts]

def pareto_paths(origin: LatLon, dest: LatLon,
                 airway: Optional[List[LatLon]] = None,
                 nofly_polys: Optional[List[List[LatLon]]] = None,
                 corridor_km: float = 25.0) -> List[dict]:
    # Sweep risk weight to approximate Pareto front
    out = []
    for lam in [0.4, 0.8, 1.2, 1.6, 2.0]:
        path = a_star_route(origin, dest, lam_dist=1.0, lam_risk=lam, lam_unc=0.5,
                            airway=airway, nofly_polys=nofly_polys, corridor_km=corridor_km)
        dist = 0.0; rsum = 0.0
        for i in range(1,len(path)):
            a = (path[i-1][0], path[i-1][1]); b = (path[i][0], path[i][1])
            dist += haversine_km(a,b)
            rsum += risk_field(b[0], b[1])["risk"]
        risk_avg = (rsum/max(1,(len(path)-1)))
        out.append({"lam":[1.0, lam], "path": path, "distance_km": round(dist,1),
                    "risk": round(risk_avg,3), "uncertainty": 0.5})
    return out
