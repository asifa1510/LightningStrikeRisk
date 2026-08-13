//App.js
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import FlightTracker from "./FlightTracker.tsx";
import Home from "./Home";
import RiskAnalysis from "./RiskAnalysis.tsx"
import LightningRisk from "./LightningRiskPrediction.tsx";
import LightningRiskPrediction from "./LightningRiskPrediction.tsx";


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tracker" element={<FlightTracker />} />
        <Route path="/risk-analysis" element={<RiskAnalysis />} />
        <Route path="/predict-risk" element={<LightningRiskPrediction />} />


      </Routes>
    </Router>
  );
  
}

export default App;
