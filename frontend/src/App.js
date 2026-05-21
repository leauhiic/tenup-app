import { useState, useEffect } from "react";

const API = "https://tenup-app-production.up.railway.app";

function App() {
  const [token, setToken] = useState(null);
  const [tournois, setTournois] = useState([]);

  // 🔐 lancer login
  const login = () => {
    const popup = window.open(
      `${API}/login`,
      "login",
      "width=600,height=700"
    );

    const interval = setInterval(() => {
      try {
        const url = popup.location.href;

        if (url.includes("access_token")) {
          const t = url.split("access_token=")[1].split("&")[0];
          setToken(t);
          popup.close();
          clearInterval(interval);
        }
      } catch (e) {}
    }, 500);
  };

  // 📋 charger tournois
  useEffect(() => {
    if (!token) return;

    fetch(`${API}/tournois`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => setTournois(data));
  }, [token]);

  return (
    <div style={{ padding: 20 }}>
      <h1>🎾 TenUp Dashboard</h1>

      {!token && (
        <button onClick={login}>
          🔐 Se connecter avec TenUp
        </button>
      )}

      {token && (
        <>
          <h2>✅ Connecté</h2>

          <ul>
            {tournois.map((t, i) => (
              <li key={i}>{t.nom || "Tournoi"}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default App;
