import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "./FlightTracker.css";

const BACKEND_URL = "http://127.0.0.1:5000";

const indianAirports = [
  "Delhi (DEL)", "Mumbai (BOM)", "Bengaluru (BLR)", "Chennai (MAA)",
  "Kolkata (CCU)", "Hyderabad (HYD)", "Pune (PNQ)", "Ahmedabad (AMD)",
];

export interface Flight {
  icao24: string;
  callsign: string;
  originCountry: string;
  timePosition?: number;
  lastContact?: number;
  lat?: number | null;
  lon?: number | null;
  velocity?: number | null;   // m/s
  altitude?: number | null;   // m
  takeoffLocation: string;
  landingLocation: string;
}

const formatTime = (timestamp?: number) =>
  !timestamp ? "Unknown" :
  new Date(timestamp * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });

const FlightTracker: React.FC = () => {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [filteredFlights, setFilteredFlights] = useState<Flight[]>([]);
  const [selectedAirport, setSelectedAirport] = useState<string>("");
  const [selectedFlight, setSelectedFlight] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchFlights = () => {
    setLoading(true);
    setError(null);
    setNotice(null);

    fetch(BACKEND_URL + "/opensky/states")
      .then(async (res) => {
        const body = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return body;
      })
      .then((data) => {
        const states: any[] = data?.states || [];
        if (!states.length) {
          setFlights([]);
          setFilteredFlights([]);
          setNotice("No live vectors returned this moment. Try again shortly.");
          return;
        }

        const allFlights: Flight[] = states.map((f: any[]): Flight => {
          const lon = f[5], lat = f[6], baroAlt = f[7], vel = f[9], geoAlt = f[13];
          return {
            icao24: f[0],
            callsign: (f[1] || "").trim() || "Unknown",
            originCountry: f[2] || "Unknown",
            timePosition: f[3],
            lastContact: f[4],
            lat, lon,
            velocity: vel ?? null,
            altitude: geoAlt ?? baroAlt ?? null,
            takeoffLocation: "Unknown",
            landingLocation: indianAirports[Math.floor(Math.random() * indianAirports.length)],
          };
        });

        // IMPORTANT: no originCountry filtering — show everything for risk analysis
        setFlights(allFlights);
        setFilteredFlights(allFlights);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const handleAirportChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const airport = e.target.value;
    setSelectedAirport(airport);
    setFilteredFlights(airport === "" ? flights : flights.filter((f) => f.landingLocation === airport));
    setSelectedFlight("");
  };

  const handleFlightChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedFlight(e.target.value);
  };

  const handleProceed = () => {
    if (!selectedFlight) {
      alert("⚠️ Please select a flight!");
      return;
    }
    const flightDetails = filteredFlights.find((f) => f.callsign === selectedFlight);
    if (!flightDetails) {
      alert("Could not find selected flight details.");
      return;
    }
    navigate("/risk-analysis", { state: { selectedFlight: flightDetails } });
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-center">Live Flight Tracker ✈️</h1>

      <button className="mt-4 bg-blue-600 text-white py-2 px-4 rounded-md w-full" onClick={fetchFlights}>
        Fetch Flights
      </button>

      {loading && <p className="text-center text-blue-600 mt-4">Fetching flight data...</p>}
      {error && <p className="text-center text-red-600 mt-4">Error: {error}</p>}
      {notice && !error && <p className="text-center text-amber-700 mt-4">{notice}</p>}

      <div className="mt-6">
        <label className="block text-lg font-semibold">📍 Select Landing Airport:</label>
        <select
          className="w-full mt-2 p-2 border rounded-md"
          value={selectedAirport}
          onChange={handleAirportChange}
          disabled={flights.length === 0}
        >
          <option value="">-- Select Airport --</option>
          {indianAirports.map((airport) => (
            <option key={airport} value={airport}>{airport}</option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label className="block text-lg font-semibold">✈️ Select Flight:</label>
        <select
          className="w-full mt-2 p-2 border rounded-md"
          value={selectedFlight}
          onChange={handleFlightChange}
          disabled={!selectedAirport || flights.length === 0}
        >
          <option value="">-- Select Flight --</option>
          {filteredFlights.map((flight) => (
            <option key={flight.icao24} value={flight.callsign}>
              {flight.callsign} ({flight.landingLocation})
            </option>
          ))}
        </select>
      </div>

      <button
        className="mt-4 bg-purple-600 text-white py-2 px-4 rounded-md w-full"
        onClick={handleProceed}
        disabled={!selectedFlight}
      >
        Proceed to Risk Analysis
      </button>

      <div className="mt-6">
        <h2 className="text-lg font-bold">🛫 Live Flights (Global sample)</h2>
        {filteredFlights.length === 0 && flights.length > 0 && <p>No flights found.</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {filteredFlights.slice(0, 60).map((flight) => (
            <div key={flight.icao24} className="p-4 border rounded-lg shadow-md bg-white">
              <p className="text-lg font-bold text-gray-800">✈ {flight.callsign}</p>
              <p>🌍 Origin: {flight.originCountry}</p>
              <p>🕒 Last: {formatTime(flight.lastContact)}</p>
              <p>📡 Lat/Lon: {flight.lat?.toFixed?.(3) ?? "?"}, {flight.lon?.toFixed?.(3) ?? "?"}</p>
              <p>⬆ Alt (m): {flight.altitude ?? "?"} | 💨 Vel (m/s): {flight.velocity ?? "?"}</p>
              <p>🛬 Landing: {flight.landingLocation}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FlightTracker;
