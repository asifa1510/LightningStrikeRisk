import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./LightningRiskPrediction.css";

const BACKEND_URL = "http://127.0.0.1:5000"; // ✅ Flask backend

const LightningRiskPrediction: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedFlight = location.state?.selectedFlight;

  const [predictedRisk, setPredictedRisk] = useState<string>("Calculating...");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [takeoffDisplay, setTakeoffDisplay] = useState<string>("Unknown");
  const [historicalData, setHistoricalData] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedFlight) {
      setError("No flight data available.");
      setLoading(false);
      return;
    }

    if (selectedFlight.takeoffLocation) {
      setTakeoffDisplay(selectedFlight.takeoffLocation);
    }

    const fetchRiskFromBackend = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/predict-risk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ landingLocation: selectedFlight.landingLocation }),
        });

        if (!res.ok) throw new Error("Backend request failed");
        const data = await res.json();

        setPredictedRisk(data.lightningRisk || "Unknown");
        setError(null);
        generateFakeHistoricalData();
      } catch (err) {
        setError("⚠️ Could not fetch risk from backend");
      } finally {
        setLoading(false);
      }
    };

    fetchRiskFromBackend();
  }, [selectedFlight]);

  const generateFakeHistoricalData = () => {
    const fakeData = Array.from({ length: 5 }).map(() => ({
      time: new Date(Date.now() - Math.random() * 86400000).toLocaleString(),
      risk: ["Low", "Moderate", "High"][Math.floor(Math.random() * 3)],
      temp: (15 + Math.random() * 10).toFixed(1),
    }));
    setHistoricalData(fakeData);
  };

  return (
    <div className="risk-analysis-container">
      <h1 className="text-center text-2xl font-bold">⚡ Lightning Risk Prediction</h1>

      <div className="risk-box">
        {selectedFlight ? (
          <>
            <p><strong>Flight:</strong> {selectedFlight.callsign || "Unknown"}</p>
            <p><strong>From:</strong> {takeoffDisplay}</p>
            <p><strong>To:</strong> {selectedFlight.landingLocation || "Unknown"}</p>
          </>
        ) : (
          <p style={{ color: "red" }}>❌ No flight selected</p>
        )}

        {loading ? (
          <p>⏳ Calculating lightning risk...</p>
        ) : error ? (
          <p style={{ color: "red" }}>{error}</p>
        ) : (
          <div className={`risk-meter risk-${predictedRisk.toLowerCase()}`}>
            <p>⚠️ Predicted Lightning Risk: <strong>{predictedRisk}</strong></p>
          </div>
        )}

        <h3 className="historical-header">📊 Recent Risk Data</h3>
        <ul className="historical-data">
          {historicalData.map((entry, index) => (
            <li key={index}>
              🕒 {entry.time} | 🌡️ {entry.temp}°C | ⚡ {entry.risk} Risk
            </li>
          ))}
        </ul>

        <button onClick={() => navigate(-1)}>🔙 Back to Risk Analysis</button>
      </div>
    </div>
  );
};

export default LightningRiskPrediction;
