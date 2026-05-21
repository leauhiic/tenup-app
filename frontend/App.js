import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const API = "https://ton-backend.up.railway.app";

function App() {
  const [token, setToken] = useState(null);
  const [data, setData] = useState([]);

  const login = () => {
    const popup = window.open(
      `${API}/login`,
      "login",
      "width=600,height=700"
    );

    const timer = setInterval(() => {
      try {
        const url = popup.location.href;

        if (url.includes("access_token")) {
          const token = url.split("access_token=")[1].split("&")[0];
          setToken(token);
          popup.close();
        }
      } catch (e) {}
    }, 500);
  };

  useEffect(() => {
    if (!token) return;

    fetch(`${API}/tournois`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((r) => r.json())
      .then((json) => {
        const mapped = json.map((t, i) => ({
          name: t.nom || `Tournoi ${i}`,
          date: t.dateDebut,
          points: t.points || 0,
        }));

        setData(mapped);
      });
  }, [token]);

  return (
    <div style={{ padding: 20 }}>
      <h1>🎾 Dashboard Padel</h1>

      {!token && (
        <button onClick={login}>
          🔐 Connexion TenUp
        </button>
      )}

      {token && (
        <div style={{ height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line dataKey="points" stroke="blue" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default App;
