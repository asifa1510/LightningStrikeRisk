⚡**Lightning Strike Risk Prediction for Aviation Safety**
 
> ### 🏆 Best Paper Award 🏆
>
>Our publication has been honored with the Best Paper Award at the **1st International Conference on Radio Frequency Communication and Networks (RFCoN)** in 2025.
>
>**Read the full paper here:**
>[**Lightning Strike Risk Prediction for Aviation Safety**](https://ieeexplore.ieee.org/document/11085355)

---


A real-time flight tracking and risk-aware route optimization system that predicts lightning strike risk using hybrid deep learning and reinforcement learning. Built with Bi-LSTM, Gaussian Process Regression, and PPO-based path reoptimization, this system enhances aviation safety by dynamically analyzing lightning hazards and rerouting aircraft safely.

---

**💡 Why This Project?**

Traditional flight monitoring systems rely heavily on radar and static ATC infrastructure. These systems:
- Lack real-time lightning risk prediction
- Cannot proactively reroute based on evolving weather
- Offer limited decision-making support for pilots and ATCs

**This project solves these limitations** by integrating:
- 🔁 Real-time data (via OpenSky API)
- 🧠 Deep Learning for lightning risk forecasting
- 🧭 Reinforcement Learning for flight path optimization
- 🗺️ GIS visualization with Leaflet.js

---

**📚 Datasets Used**

The model is trained on real + simulated data combining aircraft telemetry and meteorological variables.

| Feature | Description |
|--------|-------------|
| `Latitude` / `Longitude` | Flight coordinates |
| `Velocity` | Aircraft speed (150–600 knots) |
| `Heading` | Direction (0°–360°) |
| `Altitude` | Cruise level (10,000–40,000 ft) |
| `WindSpeed` | Wind impact at location |
| `TurbulenceIndex` | Simulated turbulence severity (0.0–1.0) |
| `LightningProb` | Lightning strike probability (0.0–1.0) |
| `Temperature` | Ambient air temperature (−60°C to 40°C) |
| `Pressure` | Atmospheric pressure (500–1100 hPa) |
| `Risk` | Target label: `0` (no risk), `1` (risk) |

---

**🧠 Model Architecture**

**🔗 Hybrid Temporal Risk Prediction Model (HTRPM)**
- *BiLSTM*: Temporal modeling of flight & weather sequence data
- *GPR (Gaussian Process Regression)*: Adds uncertainty estimation
- *VAE (Variational Autoencoder)*: For latent representation learning

Risk is calculated as:  
`R = αT + βWS + γP + δL + ηTI`  
where coefficients are learned weights for key features.

---

**🛠️ Flight Path Optimization**

*🔄 Proximal Policy Optimization (PPO)*
A reinforcement learning agent is trained to choose safe detours by:
- Penalizing high-risk regions
- Minimizing fuel consumption
- Reducing geodesic distance
- Using lightning-aware reward functions

The PPO policy considers:
```text
State: [Latitude, Longitude, Velocity, Predicted Risk]
Action: [ΔLatitude, ΔLongitude]
