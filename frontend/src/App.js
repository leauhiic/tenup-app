import { useEffect, useState } from "react";

const API = "https://tenup-app-production.up.railway.app";

function App() {
  const [tournois, setTournois] = useState([]);

  useEffect(() => {
    fetch(`${API}/tournois`)
      .then((res) => res.json())
      .then((data) => setTournois(data));
  }, []);

  const totalPoints = tournois.reduce(
    (sum, t) => sum + (t.Point || 0),
    0
  );

  return (
    
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
      🎾 TenUp Dashboard
      </h1>

      {/* 🔹 Stats */}
      <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
        <Card title="Tournois" value={tournois.length} />
        <Card title="Points total" value={totalPoints} />
        <Card
          title="Meilleur score"
          value={
            Math.max(...tournois.map((t) => t.Point || 0), 0)
          }
        />
      </div>

      {/* 🔹 Tableau */}
      <table className="w-full border rounded-xl overflow-hidden">
        <thead>
          <tr>
            <th>Date</th>
            <th>Nom</th>
            <th>Catégorie</th>
            <th>Partenaire</th>
            <th>Classement</th>
            <th>Points</th>
            <th>Validité</th>
          </tr>
        </thead>
        <tbody>
          {tournois.map((t, i) => (
            <tr key={i}>
              <td>{t.Date}</td>
              <td>{t.Nom}</td>
              <td>{t.Catégorie}</td>
              <td>{t.Partenaire}</td>
              <td>{t.Classement}</td>
              <td>{t.Validité}</td>
              <td style={{ fontWeight: "bold" }}>{t.Point}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 🔹 carte stats
function Card({ title, value }) {
  return (
    <div
      style={{
        background: "#f5f5f5",
        padding: 20,
        borderRadius: 10,
        minWidth: 120,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: "bold" }}>
        {value}
      </div>
    </div>
  );
}

// 🔹 style tableau
const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
};

export default App;
