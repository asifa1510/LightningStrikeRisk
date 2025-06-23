from flask import Flask, jsonify, request
from flask_cors import CORS
import data_processor
from model import HTRPM
from ppo_agent import PPOAgent

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend
htrpm = HTRPM()
ppo_agent = PPOAgent()

@app.route('/api/flights', methods=['GET'])
def get_flights():
    """Fetch real-time flight data from OpenSky Network API."""
    origin = request.args.get('origin')
    destination = request.args.get('destination')
    flight_data = data_processor.fetch_flight_data(origin, destination)
    processed_data = data_processor.preprocess_data(flight_data)
    return jsonify(processed_data.to_dict('records'))

@app.route('/api/risk', methods=['POST'])
def predict_risk():
    """Predict lightning risk using HTRPM."""
    data = request.json
    risk_score = htrpm.predict_risk(data)
    return jsonify({'risk_score': risk_score, 'risk_level': 'High' if risk_score > 0.7 else 'Moderate' if risk_score > 0.4 else 'Low'})

@app.route('/api/optimize_path', methods=['POST'])
def optimize_path():
    """Optimize flight path using PPO."""
    data = request.json
    optimized_path = ppo_agent.optimize_path(data)
    return jsonify({'path': optimized_path})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
