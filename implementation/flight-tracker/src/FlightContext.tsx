//FlightContext.tsx
import React, { createContext, useContext, useState } from "react";

interface Flight {
  flightNumber: string;
  origin: string;
  destination: string;
}

interface FlightContextType {
  selectedFlight: Flight | null;
  setSelectedFlight: (flight: Flight) => void;
}

const FlightContext = createContext<FlightContextType | undefined>(undefined);

export const FlightProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);

  return (
    <FlightContext.Provider value={{ selectedFlight, setSelectedFlight }}>
      {children}
    </FlightContext.Provider>
  );
};

export const useFlight = () => {
  const context = useContext(FlightContext);
  if (!context) throw new Error("useFlight must be used within a FlightProvider");
  return context;
};
