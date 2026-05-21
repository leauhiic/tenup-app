import { useEffect, useState } from "react";

const API = "https://tenup-app-production.up.railway.app";

function App() {
  const [message, setMessage] = useState("");
  const [tournois, setTournois] = useState([]);

  useEffect(() => {
    // tester backend
    fetch(`${API}/`)
      .then((res) => res.text())
      .then((data) => setMessage(data));
  }, []);

  const chargerTournois = async () => {
    const res = await fetch(`${API}/tournois`, {
      headers: {
        Authorization: "Bearer TON_TOKEN_ICI",
      },
    });

    const data = await res.json();
    setTournois(data);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>🎾 TenUp Dashboard</h1>

      <p>{message}</p>

      <button onClick={chargerTournois}>
        Charger mes tournois
      </button>

      <ul>
        {tournois.map((t, i) => (
