from __future__ import annotations
import numpy as np

def fast_feature_importance(window: np.ndarray) -> dict:
    """
    Super-fast attribution: variance-based + last-step sensitivity.
    Replace with SHAP if you want exact values (slower).
    """
    imp_var = np.var(window, axis=0)                # shape (F,)
    last = window[-1]
    imp_last = np.abs(last)
    score = imp_var / (imp_var.sum()+1e-9) * 0.5 + imp_last / (np.sum(imp_last)+1e-9) * 0.5
    names = ["Lat","Lon","V","theta","h","squawk","WS","TempC","PressHpa"]
    return {k: float(score[i]) for i,k in enumerate(names)}
