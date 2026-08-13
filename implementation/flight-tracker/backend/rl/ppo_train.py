from __future__ import annotations
import numpy as np
from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
from rl.route_env import RouteEnv

def train(origin=(19.09,72.86), dest=(28.556,77.10), steps=50_000, n_envs=4, save_path="artifacts/ppo_route"):
    def _make():
        return RouteEnv(origin, dest, lam=(1.0, 1.2, 0.4))
    env = make_vec_env(_make, n_envs=n_envs)
    model = PPO("MlpPolicy", env, verbose=1, n_steps=1024, batch_size=256, gae_lambda=0.95, gamma=0.995, learning_rate=3e-4, ent_coef=0.01)
    model.learn(total_timesteps=steps)
    model.save(save_path)
    print("Saved PPO to", save_path)

if __name__ == "__main__":
    train()
