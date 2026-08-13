# backend/utils.py
from __future__ import annotations
import math
from typing import List, Tuple

EARTH_R = 6371000.0  # meters

def haversine_km(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    s = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 2 * EARTH_R * math.asin(math.sqrt(s)) / 1000.0

def geodesic_points(a: Tuple[float, float], b: Tuple[float, float], n: int) -> List[Tuple[float, float]]:
    """Great-circle interpolation including endpoints, n>=2."""
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    d = 2*math.asin(math.sqrt(
        math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    ))
    if d == 0:
        return [a, b]
    out: List[Tuple[float, float]] = []
    for i in range(n):
        f = i / (n-1)
        A = math.sin((1-f)*d) / math.sin(d)
        B = math.sin(f*d) / math.sin(d)
        x = A*math.cos(lat1)*math.cos(lon1) + B*math.cos(lat2)*math.cos(lon2)
        y = A*math.cos(lat1)*math.sin(lon1) + B*math.cos(lat2)*math.sin(lon2)
        z = A*math.sin(lat1) + B*math.sin(lat2)
        lat = math.degrees(math.atan2(z, math.sqrt(x*x+y*y)))
        lon = math.degrees(math.atan2(y, x))
        out.append((lat, lon))
    return out
