import React from "react";
import { Link } from "react-router-dom";

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "Poppins, sans-serif",
    textAlign: "center",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    background: "linear-gradient(135deg, #a1c4fd, #c2e9fb)",
    color: "#333",
    padding: "20px",
  },
  box: {
    maxWidth: "800px",
    background: "white",
    padding: "40px",
    borderRadius: "15px",
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
  },
  title: { fontSize: "32px", fontWeight: "700", color: "#007bff" },
  text: { fontSize: "18px", fontWeight: "300", color: "#555" },
  button: {
    display: "inline-block",
    padding: "14px 24px",
    background: "#007bff",
    color: "white",
    borderRadius: "8px",
    fontSize: "18px",
    fontWeight: "600",
    cursor: "pointer",
    textDecoration: "none",
  },
};

function Home() {
  return (
    <div style={styles.container}>
      <div style={styles.box}>
        <h1 style={styles.title}>Lightning Risk Prediction For Your Flights! ⚡✈️</h1>
        <p style={styles.text}>Fly Safe with Lightning Alerts!</p>
        <Link to="/tracker" style={styles.button}>Track your Flight..</Link>
      </div>
    </div>
  );
}

export default Home;
