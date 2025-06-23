import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./LightningRiskPrediction.css";

const WEATHER_API_KEY = "1b760e28ff8642ef7bc8f3ebf655b6ac";
const WEATHER_API_URL = "https://api.openweathermap.org/data/2.5/weather";

const LightningRiskPrediction: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedFlight = location.state?.selectedFlight;
  const [weatherData, setWeatherData] = useState<any>(null);
  const [predictedRisk, setPredictedRisk] = useState<string>("Calculating...");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedFlight) {
      setError("No flight data available.");
      setLoading(false);
      return;
    }

    const fetchWeatherAndRisk = async () => {
      try {
        let weatherUrl = `${WEATHER_API_URL}?appid=${WEATHER_API_KEY}&units=metric`;
        if (selectedFlight.lat && selectedFlight.lon) {
          weatherUrl += `&lat=${selectedFlight.lat}&lon=${selectedFlight.lon}`;
        } else {
          setError("Invalid flight location.");
          setLoading(false);
          return;
        }

        const weatherResponse = await fetch(weatherUrl);
        const weatherData = await weatherResponse.json();

        if (weatherData.cod !== 200) {
          setError("Failed to load weather data.");
          setLoading(false);
          return;
        }

        setWeatherData(weatherData);

        const riskResponse = await fetch("http://localhost:5000/api/risk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            temperature: weatherData.main.temp,
            wind_speed: weatherData.wind.speed,
            pressure: weatherData.main.pressure,
            lightning_prob: weatherData.clouds.all / 100,
            turbulence_index: weatherData.wind.speed / 20
          })
        });
        const { risk_level } = await riskResponse.json();
        setPredictedRisk(risk_level);
        setError(null);
        generateFakeHistoricalData();
      } catch (err) {
        setError("Network error. Could not fetch data.");
      } finally {
        setLoading(false);
      }
    };

    fetchWeatherAndRisk();
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
            <p><strong>From:</strong> Unknown</p>
            <p><strong>To:</strong> {selectedFlight.landing_location || "Unknown"}</p>
          </>
        ) : (
          <p style={{ color: "red" }}>❌ No flight selected</p>
        )}
        {loading ? (
          <p>⏳ Loading weather data...</p>
        ) : error ? (
          <p style={{ color: "red" }}>❌ {error}</p>
        ) : weatherData ? (
          <>
            <p><strong>Temperature:</strong> {weatherData.main.temp}°C</p>
            <p><strong>Humidity:</strong> {weatherData.main.humidity}%</p>
            <p><strong>Weather Condition:</strong> {weatherData.weather[0].description}</p>
            <p><strong>Cloud Cover:</strong> {weatherData.clouds.all}%</p>
            <p><strong>Wind Speed:</strong> {weatherData.wind.speed} m/s</p>
            <div className={`risk-meter risk-${predictedRisk.toLowerCase()}`}>
              <p>⚠️ Predicted Lightning Risk: <strong>{predictedRisk}</strong></p>
            </div>
          </>
        ) : null}
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
