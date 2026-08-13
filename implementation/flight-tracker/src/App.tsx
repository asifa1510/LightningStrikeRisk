//App.tsx
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import FlightTracker from "./FlightTracker";

function App() {
  return (
    <Router>
      <MainLayout />
    </Router>
  );
}

const MainLayout = () => {
  const location = useLocation();

  return (
    <div>
      {/* ✅ Show white container only if NOT on /tracker */}
      {location.pathname !== "/tracker" && (
        <div className="white-container p-6 bg-white shadow-md rounded-lg text-center">
          <h1 className="text-2xl font-bold text-blue-600">Lightning Risk Prediction For Your Flights! ⚡✈</h1>
          <p className="text-gray-600">Fly Safe with Lightning Alerts!</p>
          <button className="bg-blue-600 text-white py-2 px-4 rounded-md mt-4">
            Track your Flight..
          </button>
        </div>
      )}

      <Routes>
        <Route path="/tracker" element={<FlightTracker />} />
      </Routes>
    </div>
  );
};

export default App;
