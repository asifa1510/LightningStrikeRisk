import numpy as np
from gym import Env
from gym.spaces import Box
from stable_baselines3 import PPO

class FlightEnv(Env):
    def __init__(self):
        super().__init__()
        self.action_space = Box(low=-1.0, high=1.0, shape=(2,))  # Delta Lat, Lon
        self.observation_space = Box(low=-np.inf, high=np.inf, shape=(4,))  # Lat, Lon, Velocity, Risk
        self.state = None
        self.max_steps = 100
        self.current_step = 0

    def reset(self):
        self.state = np.array([0.0, 0.0, 150.0, 0.0])  # Initial state: Lat, Lon, Velocity, Risk
        self.current_step = 0
        return self.state

    def step(self, action):
        self.state[:2] += action  # Update Lat, Lon
        risk = self.calculate_risk(self.state)
        distance = np.linalg.norm(action)
        fuel = self.calculate_fuel(distance)
        reward = -(0.4 * distance + 0.4 * risk + 0.2 * fuel)
        self.current_step += 1
        done = self.current_step >= self.max_steps
        return self.state, reward, done, {}

    def calculate_risk(self, state):
        return state[3]

    def calculate_fuel(self, distance):
        return distance * 0.1

class PPOAgent:
    def __init__(self):
        self.env = FlightEnv()
        self.model = PPO("MlpPolicy", self.env, verbose=0)

    def optimize_path(self, data):
        """Optimize flight path using PPO."""
        state = np.array([
            data.get('lat', 0.0),
            data.get('lon', 0.0),
            data.get('velocity', 150.0),
            data.get('risk', 0.0)
        ])
        path, _ = self.model.predict(state)
        return {'lat': float(path[0]), 'lon': float(path[1])}
