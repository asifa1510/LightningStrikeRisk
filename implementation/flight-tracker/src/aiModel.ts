//aiModel.ts
export const getFlightRiskPrediction = (lat: number, lon: number): string => {
    return Math.random() > 0.5 ? "High" : "Low";
  };
  