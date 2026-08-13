#app.py
from flask import Flask, jsonify, request
import torch
from transformers import pipeline
from geopy.distance import geodesic

app = Flask(__name__)

# Route for lightning risk prediction
@app.route('/predict-risk', methods=['POST'])
def predict_lightning_risk():
    flight_data = request.json
    landing_location = flight_data.get('landingLocation', '')
    lightning_risk = get_lightning_risk(landing_location)
    return jsonify({"lightningRisk": lightning_risk})

# Simple mock function for lightning risk
def get_lightning_risk(airport: str):
    lightning_data = {
        "Mumbai (BOM)": "High",
        "Chennai (MAA)": "Medium",
        "Kolkata (CCU)": "Low",
    }
    return lightning_data.get(airport, "None")

# Optional: Transformer sentiment analysis route
@app.route('/analyze-text', methods=['POST'])
def analyze_text():
    text_data = request.json
    text = text_data.get('text', '')
    sentiment_analyzer = pipeline('sentiment-analysis')
    result = sentiment_analyzer(text)
    return jsonify({"sentiment": result})

if __name__ == '__main__':
    app.run(debug=True)
