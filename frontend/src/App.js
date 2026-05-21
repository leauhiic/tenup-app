import { useState } from "react";

const API = "https://tenup-app-production.up.railway.app";

function App() {
  const [token, setToken] = useState("");
  const [tournois, setTournois] = useState([]);
  const [loading, setLoading] = useState(false);

  // 🔐 Ouvre TenUp pour login
  const ouvrirTenUp = () => {
    window.open("https://tenup.fft.fr/connexion", "_blank");

    alert(
      "1. Connecte-toi sur TenUp\n" +
        "2. Ouvre F12 → Network\n" +
        "3. Copie le Bearer token\n" +
        "4. Colle-le ici 👇"
    );
  };

  // 📋 Récupérer les tournois
  const chargerTournois = async () => {
    if (!token) {
      alert("Merci de coller ton token TenUp");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API}/tournois`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      console.log("Réponse API:", data);

      // Adapter selon structure réelle
      const liste = Array.isArray(data)
        ? data
        : data.data || [];

      setTournois(liste);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la récupération des tournois");
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>🎾 TenUp Dashboard</h1>

      {/* 🔐 Login */}
      <button onClick={ouvrirTenUp} style={{ marginBottom: 10 }}>
        🔐 Se connecter à TenUp
      </button>

      <div>
        <input
          type="text"
          placeholder="Colle ton token TenUp ici"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          style={{ width: 400, padding: 5 }}
        />
      </div>

      {/* 📋 Bouton */}
      <div style={{ marginTop: 10 }}>
        <button onClick={chargerTournois}>
          {loading ? "Chargement..." : "Charger mes tournois"}
        </button>
      </div>

      {/* 📊 Résultats */}
      <ul style={{ marginTop: 20 }}>
        {tournois.length === 0 && !loading && (
          <p>Aucun tournoi chargé</p>
        )}

        {tournois.map((t, i) => (
          <li key={i} style={{ marginBottom: 10 }}>
            <b>{t.nom || "Tournoi"}</b>
            <br />
            📅 {t.dateDebut || "Date inconnue"}
            <br />
            ⭐ Points : {t.points || 0}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
