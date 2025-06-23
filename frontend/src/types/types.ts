export interface Flight {
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
