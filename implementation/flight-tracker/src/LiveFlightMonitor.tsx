import React, { useState, useEffect } from "react";
import { fetchWeather } from "./api"; // Assuming fetchWeather fetches weather data

// Define the structure for weather data
interface WeatherData {
  wind: {
    speed: number;
  };
}

// Define the structure for location state
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
        // Fetch weather data
        const originWeather: WeatherData = await fetchWeather("Origin_Location");
        const destinationWeather: WeatherData = await fetchWeather("Destination_Location");

        // Ensure weather data is available before updating state
        if (!originWeather || !destinationWeather) {
          console.error("Error: Weather data is missing.");
          return;
        }

        setWeatherInfo({ origin: originWeather, destination: destinationWeather });

        // Calculate wind speed and determine turbulence risk
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

  // Simulate flight progress
  useEffect(() => {
    const origin: Location = { lat: 40.7128, lng: -74.006, name: "New York" }; // Example origin
    const destination: Location = { lat: 51.5074, lng: -0.1278, name: "London" }; // Example destination

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
          name: "In Transit", // Fixed: Ensuring the required 'name' property is present
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
          <p>Origin Wind Speed: {weatherInfo.origin.wind.speed} km/h</p>
          <p>Destination Wind Speed: {weatherInfo.destination.wind.speed} km/h</p>
        </div>
      )}
    </div>
  );
};

export default LiveFlightMonitor;
