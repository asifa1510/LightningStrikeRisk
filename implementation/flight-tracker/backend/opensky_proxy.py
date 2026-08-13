import os

import requests

from flask import Flask, jsonify

OPENSKY_CLIENT_ID = os.getenv("OPENSKY_CLIENT_ID", "sasifa-api-client")

OPENSKY_API_KEY = os.getenv("OPENSKY_API_KEY", "t9hbVQLzbNueagscrzkD5yFAzJ7fv6gv")

OPENSKY_BASE_URL = os.getenv("OPENSKY_BASE_URL", "https://opensky-network.org/api/states/all")

app = Flask(__name__)

@app.route("/api/flights")

def get_flights():

    bbox = "68,6,97,36"  # India bounding box

    url = f"{OPENSKY_BASE_URL}?bbox={bbox}"

    try:

        res = requests.get(url, auth=(OPENSKY_CLIENT_ID, OPENSKY_API_KEY))

        if res.status_code != 200:

            return jsonify({"error": f"OpenSky error {res.status_code}", "body": res.text}), res.status_code

        return jsonify(res.json())

    except Exception as e:

        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":

    app.run(port=5000, debug=True)







