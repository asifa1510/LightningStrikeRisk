//api.ts
export const fetchWeather = async (location: string) => {
    try {
      const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=1b760e28ff8642ef7bc8f3ebf655b6ac`);
      if (!response.ok) throw new Error("Failed to fetch weather data");
      
      return await response.json();
    } catch (error) {
      console.error("Weather API error:", error);
      return null;
    }
  };
  