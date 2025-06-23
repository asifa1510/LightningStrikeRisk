import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./FlightTracker.css";

const indianAirports = [
  "Delhi (DEL)", "Mumbai (BOM)", "Bengaluru (BLR)", "Chennai (MAA)",
  "Kolkata (CCU)", "Hyderabad (HYD)", "Pune (PNQ)", "Ahmedabad (AMD)"
];

interface Flight {
  icao24: string;
  callsign: string;
  origin_country: string;
  time_position?: number;
  last_contact?: number;
  lat: number;
  lon: number;
  altitude: number;
  velocity: number;
  heading: number;
  landing_location: string;
}

const formatTime = (timestamp?: number) => {
  if (!timestamp) return "Unknown";
  return new Date(timestamp * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
};

const FlightTracker: React.FC = () => {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [filteredFlights, setFilteredFlights] = useState<Flight[]>([]);
  const [selectedAirport, setSelectedAirport] = useState<string>("");
  const [selectedFlight, setSelectedFlight] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchFlights = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:5000/api/flights?origin=India`);
      const data = await response.json();
      setFlights(data);
      setFilteredFlights(data);
    } catch (err) {
      setError("Failed to fetch flights.");
    } finally {
      setLoading(false);
    }
  };

  const handleAirportChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const airport = event.target.value;
    setSelectedAirport(airport);
    if (airport === "") {
      setFilteredFlights(flights);
    } else {
      setFilteredFlights(flights.filter((flight) => flight.landing_location === airport));
    }
    setSelectedFlight("");
  };

  const handleFlightChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedFlight(event.target.value);
  };

  const handleSubmit = () => {
    if (selectedFlight) {
      const flightDetails = filteredFlights.find((flight) => flight.callsign === selectedFlight);
      if (flightDetails) {
        navigate("/risk-analysis", { state: { selectedFlight: flightDetails } });
      }
    } else {
      alert("⚠️ Please select a flight!");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-center">Live Indian Flight Tracker ✈️</h1>
      <button className="mt-4 bg-blue-600 text-white py-2 px-4 rounded-md w-full" onClick={fetchFlights}>
        Fetch Flights
      </button>
      {loading && <p className="text-center text-blue-600 mt-4">Fetching flight data...</p>}
      {error && <p className="text-center text-red-600 mt-4">Error: {error}</p>}
      <div className="mt-6">
        <label className="block text-lg font-semibold">📍 Select Landing Airport:</label>
        <select className="w-full mt-2 p-2 border rounded-md" value={selectedAirport} onChange={handleAirportChange} disabled={flights.length === 0}>
          <option value="">-- Select Airport --</option>
          {indianAirports.map((airport) => (
            <option key={airport} value={airport}>{airport}</option>
          ))}
        </select>
      </div>
      <div className="mt-4">
        <label className="block text-lg font-semibold">✈️ Select Flight:</label>
        <select className="w-full mt-2 p-2 border rounded-md" value={selectedFlight} onChange={handleFlightChange} disabled={!selectedAirport || flights.length === 0}>
          <option value="">-- Select Flight --</option>
          {filteredFlights.map((flight) => (
            <option key={flight.icao24} value={flight.callsign}>{flight.callsign} ({flight.landing_location})</option>
          ))}
        </select>
      </div>
      <button className="mt-4 bg-blue-600 text-white py-2 px-4 rounded-md w-full" onClick={handleSubmit} disabled={!selectedFlight}>
        Submit
      </button>
      <button className="mt-4 bg-red-500 text-white py-2 px-4 rounded-md w-full" onClick={() => navigate("/risk-analysis")}>
        Risk Analysis 🚨
      </button>
      <div className="mt-6">
        <h2 className="text-lg font-bold">🛫 Indian Flights Currently in Air</h2>
        {filteredFlights.length === 0 && flights.length > 0 && <p>No flights found.</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {filteredFlights.map((flight) => (
            <div key={flight.icao24} className="p-4 border rounded-lg shadow-md bg-white">
              <p className="text-lg font-bold text-gray-800">✈ {flight.callsign}</p>
              <p>📍 Takeoff: Unknown</p>
              <p>🛬 Landing: {flight.landing_location}</p>
              <p>🕒 Last Signal: {formatTime(flight.last_contact)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FlightTracker;
