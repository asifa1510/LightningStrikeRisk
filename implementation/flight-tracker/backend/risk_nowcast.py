# risk_nowcast.py
from __future__ import annotations
import numpy as np
from typing import Tuple, Dict, List

# Shape: (E, H, W) ensemble of hazard probabilities for horizon steps
# e.g., lightning probability per 5-min step for next 60–90 min.
class HazardNowcast:
    def __init__(self, horizon_steps: int = 12, ensemble: int = 8):
        self.H = horizon_steps
        self.E = ensemble

    def predict_grid(self,
                     lat_grid: np.ndarray,
                     lon_grid: np.ndarray,
                     t0_unix: int) -> Dict[str, np.ndarray]:
        """
        Returns ensemble probabilities for lightning/turbulence per (t, i, j).
        For now: synthetic but spatially structured. Replace with your trained model.
        Out:
          {"lightning": (E,H,Gx,Gy) in [0,1], "turb": same}
        """
        Gx, Gy = len(lat_grid), len(lon_grid)
        out = {}
        for k in ["lightning", "turb"]:
            arr = np.zeros((self.E, self.H, Gx, Gy), dtype=np.float32)
            # make a moving “storm core” to test routing decisions
            for e in range(self.E):
                # Random center that slowly drifts with horizon
                base_i = Gx//2 + np.random.randint(-4, 4)
                base_j = Gy//2 + np.random.randint(-4, 4)
                for h in range(self.H):
                    cx = base_i + int(0.12*h)  # drift
                    cy = base_j + int(-0.08*h)
                    for i in range(Gx):
                        for j in range(Gy):
                            d = ((i-cx)**2 + (j-cy)**2)**0.5
                            p = np.exp(-(d/8.0)**2)  # compact core
                            if k == "turb":
                                p *= 0.7
                            noise = 0.05*np.random.rand()
                            arr[e,h,i,j] = float(np.clip(p + noise, 0, 1))
            out[k] = arr
        return out

NOWCAST = HazardNowcast()
