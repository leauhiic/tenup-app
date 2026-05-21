import { useEffect, useState } from "react";

const API = "https://tenup-app-production.up.railway.app";

function App() {
  const [tournois, setTournois] = useState([]);
  const [search, setSearch] = useState("");
  const [tri, setTri] = useState("date");
  const [categorie, setCategorie] = useState("all");


  useEffect(() => {
    fetch(`${API}/tournois`)
      .then((res) => res.json())
      .then((data) => setTournois(data));
  }, []);

  
// 🔍 filtre
  const filtered = tournois.filter((t) => {
    return (
      (categorie === "all" || t.Catégorie === categorie) &&
      (t.Nom.toLowerCase().includes(search.toLowerCase()) ||
        t.Partenaire.toLowerCase().includes(search.toLowerCase()))
    );
  });

  // 🔄 tri
  const sorted = [...filtered].sort((a, b) => {
    if (tri === "points") return b.Point - a.Point;
    if (tri === "date") return b.Date - a.Date;
    return 0;
  });


const meilleurs = [...sorted]
  .sort((a, b) => b.Point - a.Point)
  .slice(0, 12);

// ✅ somme des 12 meilleurs
const totalPoints = meilleurs.reduce(
  (sum, t) => sum + (t.Point || 0),
  0
);


// ✅ mois prochain
const today = new Date();
const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1);

// format "mai-26"
const moisSuivant = nextMonth.toLocaleDateString("fr-FR", {
  month: "short",
}).toLowerCase() + "-" + String(nextMonth.getFullYear()).slice(-2);

// ✅ tournois qui expirent
const tournoisPerdus = tournois.filter((t) =>
  t["Validité"]?.toLowerCase().includes(moisSuivant)
);

  
return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h1>🎾 TenUp Dashboard</h1>

      {/* 🔹 filtres */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          placeholder="Recherche (tournoi ou partenaire)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: 8, width: 250 }}
        />

        <select onChange={(e) => setCategorie(e.target.value)}>
          <option value="all">Toutes catégories</option>
          <option value="DM">DM</option>
          <option value="DX">DX</option>
        </select>

        <select onChange={(e) => setTri(e.target.value)}>
          <option value="date">Trier par date</option>
          <option value="points">Trier par points</option>
        </select>
      </div>

      {/* 🔹 stats */}
      <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
        <Card title="Tournois" value={sorted.length} />
        <Card title="Points total" value={totalPoints} />
        <Card
          title="Meilleur score"
          value={Math.max(...sorted.map((t) => t.Point || 0), 0)}
        />
      </div>

      {/* 🔹 tableau */}
      <table style={tableStyle}>
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
      {sorted.map((t, i) => (
            <tr key={i}>
              <td>{t.Date}</td>
              <td>{t.Nom}</td>
              <td>{t.Catégorie}</td>
              <td>{t.Partenaire}</td>
              <td>{t.Classement}</td>          
              <td style={{
                fontWeight: "bold",
                color: meilleurs.includes(t) ? "green" : "red"
              }}>
                {t.Point}
              </td>
              <td>{t.Validité}</td>
            </tr>
          ))}
        </tbody>
      </table>
          <h2 style={{ marginTop: 30 }}>⚠️ Tournois perdus le mois prochain</h2>
          
          {tournoisPerdus.length === 0 ? (
            <p>Aucun tournoi ne sort du classement le mois prochain ✅</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Nom</th>
                  <th>Partenaire</th>
                  <th>Points perdus</th>
                </tr>
              </thead>
              <tbody>
                {tournoisPerdus.map((t, i) => (
                  <tr key={i} style={{ background: "#ffe5e5" }}>
                    <td>{t.Date}</td>
                    <td>{t.Nom}</td>
                    <td>{t.Partenaire}</td>
                    <td style={{ fontWeight: "bold", color: "red" }}>
                      {t.Point}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
