const WEATHER_API_KEY = "1b760e28ff8642ef7bc8f3ebf655b6ac";

export const fetchWeather = async (location: string): Promise<any> => {
  const city = location.split("(")[0].trim();
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.cod !== 200) throw new Error("Failed to fetch weather");
    return { wind: { speed: data.wind.speed } };
  } catch (error) {
    console.error("Error fetching weather:", error);
    throw error;
  }
};

export const getFlightDetails = async (country: string): Promise<any[]> => {
  try {
    const response = await fetch(`http://localhost:5000/api/flights?origin=${country}`);
    const data = await response.json();
    return data.map((flight: any) => ({
      flightNumber: flight.callsign || "Unknown",
      origin: "Unknown",
      destination: flight.landing_location || "Unknown",
      coordinates: [[flight.lat, flight.lon]],
    }));
  } catch (error) {
    console.error("Error fetching flight details:", error);
    return [];
  }
};
