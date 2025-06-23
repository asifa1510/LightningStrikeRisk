# ⚡ Lightning Strike Risk Prediction for Aviation Safety

A machine learning-based system to predict lightning strike risks in flight paths using real-time weather and telemetry data. The system aims to enhance aviation safety by proactively identifying high-risk zones and enabling safe flight rerouting.

---

## 💡 Motivation

Lightning strikes pose a significant threat to aviation, affecting:
- ✈️ Aircraft avionics and control systems
- 🛰️ Communication and radar equipment
- ⚙️ Engine performance and pilot visibility

However, current systems often **lack real-time lightning prediction** and **route-aware risk assessment**, especially over dynamic weather regions.

This project bridges that gap with a deep learning system that:
- Predicts lightning risk with high accuracy
- Analyzes the impact on different flight segments
- Suggests **safer alternate routes** using lightning-aware pathfinding

---

## 📚 Dataset Overview

The model is trained on a combination of real and simulated flight + weather data:

| Component | Description |
|----------|-------------|
| **Flight Data** | Flight paths, altitude, speed, heading, and location |
| **Weather Data** | Real-time temperature, humidity, wind speed, cloud cover, and pressure |
| **Lightning Labels** | Risk annotated based on NOAA storm data and observed strike patterns |

### ⚠️ Risk Classes:
- `0` — Safe
- `1` — Moderate Lightning Risk
- `2` — High Lightning Strike Risk

---

## 🧠 Model Architecture

### 🔁 BiLSTM-GPR Hybrid

| Component | Description |
|-----------|-------------|
| **BiLSTM** | Captures temporal dependencies from flight telemetry |
| **GPR (Gaussian Process Regression)** | Calibrates uncertainty and provides smooth probabilistic outputs |
| **AUC** | Achieved AUC of `1.00` and accuracy of `93.35%` on test data

---

## 🌩️ Features Used

- Wind speed, humidity, air pressure
- Cloud cover, altitude, vertical velocity
- Geographic coordinates (lat, long)
- Time of day, temperature deviation

---

## 🛠️ How to Run the Project

### ✅ 1. Clone the Repo
```bash
git clone https://github.com/your-username/LightningRiskAI.git
cd LightningRiskAI
