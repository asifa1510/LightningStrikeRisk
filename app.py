from flask import Flask, jsonify, request
import data_processor
from model import HTRPM
from ppo_agent import PPOAgent
import json

app = Flask(__name__)
htrpm = HTRPM()
ppo_agent = PPOAgent()

@app.route('/api/flights', methods=['GET'])
def get_flights():
    origin = request.args.get('origin')
    destination = request.args.get('destination')
    flight_data = data_processor.fetch_flight_data(origin, destination)
    processed_data = data_processor.preprocess_data(flight_data)
    return jsonify(processed_data)

@app.route('/api/risk', methods=['POST'])
def predict_risk():
    data = request.json
    risk_score = htrpm.predict_risk(data)
    return jsonify({'risk_score': risk_score})

@app.route('/api/optimize_path', methods=['POST'])
def optimize_path():
    data = request.json
    optimized_path = ppo_agent.optimize_path(data)
    return jsonify({'path': optimized_path})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
