from __future__ import annotations
import gymnasium as gym
import numpy as np
from gymnasium import spaces
from utils import haversine_km
from risk_model import predict_risk

class RouteEnv(gym.Env):
    """
    State S_t = [lat, lon, progress, risk_prob]
    Action a_t = [dLat, dLon] clipped to small step.
    Reward r_t = -(λ1*d + λ2*R + λ3*E)
    """
    metadata = {"render.modes": []}

    def __init__(self, origin, dest, lam=(1.0, 1.2, 0.4)):
        super().__init__()
        self.origin = np.array(origin, dtype=float)
        self.dest   = np.array(dest, dtype=float)
        self.lam = lam
        self.max_step_km = 40.0
        self.max_steps = 120

        self.observation_space = spaces.Box(low=np.array([-90,-180,0,0]),
                                            high=np.array([90,180,1,1]),
                                            dtype=np.float32)
        self.action_space = spaces.Box(low=np.array([-1,-1]), high=np.array([1,1]), dtype=np.float32)
        self.reset(seed=42)

    def _risk(self, lat, lon):
        seq = [[lat, lon, 230, 0, 10000, 0, 12, 25, 1010] for _ in range(10)]
        return float(predict_risk(seq)["probability"])

    def _fuel_proxy(self, dkm):
        # crude: fuel ~ distance for now
        return dkm / 100.0

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        self.pos = self.origin.copy()
        self.steps = 0
        self.total = 0.0
        r = self._risk(*self.pos)
        obs = np.array([self.pos[0], self.pos[1], 0.0, r], dtype=np.float32)
        return obs, {}

    def step(self, action):
        action = np.clip(action, -1, 1)
        # convert action to lat/lon delta scaled to max_step_km along great-circle approx
        scale = self.max_step_km / 111.0  # ~111 km per degree
        target = self.pos + action*scale
        d = haversine_km(self.pos[0], self.pos[1], target[0], target[1])
        self.pos = target
        self.steps += 1

        # compute per-step cost
        risk = self._risk(*self.pos)
        fuel = self._fuel_proxy(d)
        lam1, lam2, lam3 = self.lam
        cost = lam1*d + lam2*risk + lam3*fuel
        reward = -cost
        self.total += cost

        # progress to goal & termination
        dist_to_goal = haversine_km(self.pos[0], self.pos[1], self.dest[0], self.dest[1])
        progress = np.clip(1.0 - dist_to_goal / max(haversine_km(*self.origin, *self.dest), 1e-6), 0, 1)
        done = (dist_to_goal < 20.0) or (self.steps >= self.max_steps)
        obs = np.array([self.pos[0], self.pos[1], progress, risk], dtype=np.float32)
        info = {"dist_to_goal": dist_to_goal, "cum_cost": self.total}
        return obs, reward, done, False, info
