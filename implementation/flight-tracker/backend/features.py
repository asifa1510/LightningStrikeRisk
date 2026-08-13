import numpy as np

# Expected single timestep fields (paper-like):
# Lat, Lon, V (m/s), theta (deg), h (m), squawk (0/1), WS (m/s), Temp (C), Press (hPa)
# Optional proxies we compute: TI (turbulence index), Lprob (lightning prob)

def compute_turbulence_index(ws_series: np.ndarray) -> float:
    # proxy: normalized standard deviation of wind speed over the window
    if ws_series.size < 2: return 0.0
    std = float(np.std(ws_series))
    return float(np.tanh(std / 10.0))  # squash 0..~1

def lightning_proxy(temp_c: float, press_hpa: float, ws: float) -> float:
    # super simple CAPE-ish proxy: warmer + lower pressure + higher wind => higher convective risk
    score = (max(temp_c - 10, 0)/25.0) + (max(1013-press_hpa, 0)/40.0) + (ws/40.0)
    return float(np.clip(score/3.0, 0.0, 1.0))

def risk_formula(alpha, beta, gamma, delta, eta, T, WS, P, L, TI):
    # R = αT + βWS + γP + δL + ηTI    (paper’s linear blend)
    raw = alpha*T + beta*WS + gamma*P + delta*L + eta*TI
    return float(np.clip(raw, 0.0, 1.0))
