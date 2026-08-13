export type Flight = {
    flightNumber: string;
    origin: string;
    destination: string;
    coordinates: [number, number][]; // Array of latitude/longitude pairs
  };
  