import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const getAirportCoordinates = (airport: string): [number, number] => {
  const airportCoords: Record<string, [number, number]> = {
    "Delhi (DEL)": [28.5562, 77.1000],
    "Mumbai (BOM)": [19.0896, 72.8656],
    "Bengaluru (BLR)": [13.1986, 77.7066],
    "Chennai (MAA)": [12.9941, 80.1709],
    "Kolkata (CCU)": [22.6547, 88.4467],
    "Hyderabad (HYD)": [17.2403, 78.4294],
    "Pune (PNQ)": [18.5821, 73.9197],
    "Ahmedabad (AMD)": [23.0736, 72.6347],
  };
  return airportCoords[airport] || [20.5937, 78.9629];
};

const flightIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

const FlightRiskAnalysis: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedFlight = location.state?.selectedFlight || null;
  const mapRef = useRef<L.Map | null>(null);
  const [lightningRisk, setLightningRisk] = useState<string>("None");
  const [satelliteView, setSatelliteView] = useState<boolean>(false);
  const [safeRoute, setSafeRoute] = useState<boolean>(false);

  const getSafeRouteCoordinates = async (origin: [number, number], destination: [number, number]) => {
    if (lightningRisk === "High") {
      const response = await fetch("http://localhost:5000/api/optimize_path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: origin[0], lon: origin[1], velocity: selectedFlight.velocity, risk: 0.8 })
      });
      const { path } = await response.json();
      return [origin, [path.lat, path.lon], destination];
    }
    return [origin, destination];
  };

  const fetchLightningRisk = async () => {
    if (!selectedFlight) return;
    const response = await fetch("http://localhost:5000/api/risk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        temperature: 25,
        wind_speed: 5,
        pressure: 1013,
        lightning_prob: 0.1,
        turbulence_index: 0.2
      })
    });
    const { risk_level } = await response.json();
    setLightningRisk(risk_level);
  };

  const initializeMap = async () => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map("map").setView([20.5937, 78.9629], 5);
    L.tileLayer(
      satelliteView
        ? "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    ).addTo(map);

    mapRef.current = map;

    if (selectedFlight) {
      const originCoords = [selectedFlight.lat, selectedFlight.lon] as [number, number];
      const destinationCoords = getAirportCoordinates(selectedFlight.landing_location);

      await fetchLightningRisk();

      const flightPathCoords = safeRoute
        ? await getSafeRouteCoordinates(originCoords, destinationCoords)
        : [originCoords, destinationCoords];

      L.polyline(flightPathCoords, { color: safeRoute ? "green" : "blue", weight: 3 }).addTo(map);
      L.marker(originCoords, { icon: flightIcon }).addTo(map).bindPopup("Current Position");
      L.marker(destinationCoords, { icon: flightIcon }).addTo(map).bindPopup("Landing");

      map.fitBounds(L.polyline(flightPathCoords).getBounds());
    }
  };

  useEffect(() => {
    initializeMap();
  }, [selectedFlight, satelliteView, safeRoute]);

  return (
    <div className="risk-analysis-container">
      <h1 className="text-center text-2xl font-bold">Analysing {selectedFlight?.callsign || "Flight"}</h1>
      <div id="map" style={{ height: "400px", width: "90%", margin: "auto", border: "2px solid gray" }}></div>
      <div style={{
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        borderRadius: "20px",
        padding: "15px",
        margin: "20px auto",
        width: "80%",
        boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.2)",
        textAlign: "center",
      }}>
        <p><strong>Lightning Risk:</strong> {lightningRisk}</p>
        {lightningRisk === "High" && (
          <button
            onClick={() => setSafeRoute(true)}
            style={{
              backgroundColor: "#ff5733",
              color: "white",
              padding: "10px 15px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              marginTop: "15px",
              fontWeight: "bold",
            }}
          >
            ⚡ Get Safe Route
          </button>
        )}
        <button
          onClick={() => setSatelliteView(!satelliteView)}
          style={{
            backgroundColor: "#007bff",
            color: "white",
            padding: "10px 15px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            marginTop: "15px",
            fontWeight: "bold",
          }}
        >
          🛰️ Toggle Satellite View
        </button>
        <button
          onClick={() => navigate("/tracker")}
          style={{
            backgroundColor: "#007bff",
            color: "white",
            padding: "10px 15px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            marginTop: "15px",
            fontWeight: "bold",
            display: "block",
            width: "100%",
          }}
        >
          🔙 Back to Flight Tracker
        </button>
        <button
          onClick={() => navigate("/predict-risk", { state: { selectedFlight } })}
          style={{
            backgroundColor: "#28a745",
            color: "white",
            padding: "10px 15px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            marginTop: "15px",
            fontWeight: "bold",
            width: "100%",
          }}
        >
          🌩️ Predict Lightning Risk
        </button>
      </div>
    </div>
  );
};

export default FlightRiskAnalysis;
