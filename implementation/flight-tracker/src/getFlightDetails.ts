import { Flight } from "./types"; // Make sure this file defines the correct Flight interface

const getFlightDetails = async (country: string): Promise<Flight[]> => {
  try {
    // ✅ Add CORS proxy for local testing to bypass browser blocking
    const response = await fetch(
      `https://corsproxy.io/?https://api.flightapi.io/realtime/67b77dd21043f791fbffd240/${country}`
    );

    // Check if response is OK
    if (!response.ok) {
      console.error(`API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();

    // ✅ Defensive checks
    if (!data || !Array.isArray(data.flights)) {
      console.warn("Unexpected API format:", data);
      return [];
    }

    // ✅ Map API data into your Flight type
    return data.flights.map((flight: any) => ({
      flightNumber: flight.flight_iata || flight.flight_icao || "Unknown",
      origin: flight.dep_iata || flight.dep_icao || "Unknown",
      destination: flight.arr_iata || flight.arr_icao || "Unknown",
      coordinates:
        flight.route?.map((point: any) => [point.lat, point.lon]) || [],
    }));
  } catch (error) {
    console.error("Error fetching flight details:", error);
    return [];
  }
};

export default getFlightDetails;
