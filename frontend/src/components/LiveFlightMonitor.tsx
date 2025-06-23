import React, { useState, useEffect } from "react";
import { fetchWeather } from "../api/api";

interface WeatherData {
  wind: { speed: number };
}

interface Location {
  lat: number;
  lng: number;
  name: string;
}

const LiveFlightMonitor: React.FC = () => {
  const [weatherInfo, setWeatherInfo] = useState<{ origin: WeatherData; destination: WeatherData } | null>(null);
  const [turbulenceRisk, setTurbulenceRisk] = useState<string>("");
  const [currentLocation, setCurrentLocation] = useState<Location>({ lat: 0, lng: 0, name: "Unknown" });

  useEffect(() => {
    const fetchWeatherData = async () => {
      try {
        const originWeather: WeatherData = await fetchWeather("Delhi (DEL)");
        const destinationWeather: WeatherData = await fetchWeather("Mumbai (BOM)");
        if (!originWeather || !destinationWeather) {
          console.error("Error: Weather data is missing.");
          return;
        }
        setWeatherInfo({ origin: originWeather, destination: destinationWeather });
        const maxWindSpeed = Math.max(originWeather.wind.speed, destinationWeather.wind.speed);
        if (maxWindSpeed < 10) {
          setTurbulenceRisk("✅ Low Risk - Smooth Flight");
        } else if (maxWindSpeed < 20) {
          setTurbulenceRisk("⚠️ Moderate Risk - Possible Turbulence");
        } else {
          setTurbulenceRisk("🚨 High Risk - Expect Significant Turbulence");
        }
      } catch (error) {
        console.error("Error fetching weather data:", error);
      }
    };

    fetchWeatherData();
  }, []);

  useEffect(() => {
    const origin: Location = { lat: 28.5562, lng: 77.1000, name: "Delhi (DEL)" };
    const destination: Location = { lat: 19.0896, lng: 72.8656, name: "Mumbai (BOM)" };
    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.05;
      if (progress >= 1) {
        setCurrentLocation(destination);
        clearInterval(interval);
      } else {
        setCurrentLocation({
          lat: origin.lat + (destination.lat - origin.lat) * progress,
          lng: origin.lng + (destination.lng - origin.lng) * progress,
          name: "In Transit",
        });
      }
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2>Live Flight Monitor</h2>
      <p>Current Location: {currentLocation.name} (Lat: {currentLocation.lat}, Lng: {currentLocation.lng})</p>
      <p>Turbulence Risk: {turbulenceRisk}</p>
      {weatherInfo && (
        <div>
          <h3>Weather Information</h3>
          <p>Origin Wind Speed: {weatherInfo.origin.wind.speed} m/s</p>
          <p>Destination Wind Speed: {weatherInfo.destination.wind.speed} m/s</p>
        </div>
      )}
    </div>
  );
};

export default LiveFlightMonitor;
