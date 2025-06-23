import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import FlightTracker from "./components/FlightTracker";
import FlightRiskAnalysis from "./components/FlightRiskAnalysis";
import LightningRiskPrediction from "./components/LightningRiskPrediction";
import LiveFlightMonitor from "./components/LiveFlightMonitor";
import "./App.css";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tracker" element={<FlightTracker />} />
        <Route path="/risk-analysis" element={<FlightRiskAnalysis />} />
        <Route path="/predict-risk" element={<LightningRiskPrediction />} />
        <Route path="/monitor" element={<LiveFlightMonitor />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
