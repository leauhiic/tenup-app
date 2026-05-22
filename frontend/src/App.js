import { useEffect, useState } from "react";

const API = "https://tenup-app-production.up.railway.app";

// Barème FFT par type de tournoi et classement
const BAREME = {
  P25:  [250,188,150,120,108,100,90,80,70,63,56,50,45,40,35,30,25,20,18,16,14,12,10,9,8,7,6,5],
  P100: [450,338,270,215,188,175,158,140,125,112,100,90,80,72,63,56,50,45,40,35,30,25,20,18,15,12,10,8,6,5],
  P250: [700,525,420,335,293,272,245,218,195,175,155,140,125,112,100,90,80,72,63,56,50,45,40,35,30,25,20,16,13,10,8,6],
  P500: [1100,825,660,528,462,429,386,344,308,275,245,220,195,175,155,140,125,112,100,90,80,72,63,56,50,45,40,35,30,25,20,16],
  P1000:[1800,1350,1080,864,756,702,632,562,504,450,400,360,320,288,255,228,200,180,160,144,125,112,100,90,80,72,63,56,50,45,40,35],
};

function getPoints(type, classement) {
  const table = BAREME[type];
  if (!table) return "";
  return table[classement - 1] ?? "";
}

function getValidite(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const future = new Date(d.getFullYear() + 1, d.getMonth(), 1);
  return future.toLocaleDateString("fr-FR", { month: "short" }).toLowerCase()
    + "-" + String(future.getFullYear()).slice(-2);
}

const CATEGORIES = ["DM", "DD", "DX"];
const TYPES = ["P25", "P100", "P250", "P500", "P1000"];

const EMPTY_FORM = {
  date: "",
  nom: "",
  type: "P250",
  categorie: "DM",
  partenaire: "",
  classement: "",
  point: "",
  validite: "",
};

export default function App() {
  const [tournois, setTournois] = useState([]);
  const [search, setSearch] = useState("");
  const [tri, setTri] = useState("date");
  const [categorie, setCategorie] = useState("all");
  const [ordreAscendant, setOrdreAscendant] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    fetch(`${API}/tournois`)
      .then((res) => res.json())
      .then((data) => setTournois(data));
  }, []);

  // Auto-calcul points et validité quand type/classement/date changent
  useEffect(() => {
    if (form.type && form.classement) {
      const pts = getPoints(form.type, parseInt(form.classement));
      const val = getValidite(form.date);
      setForm((f) => ({ ...f, point: pts !== "" ? String(pts) : f.point, validite: val || f.validite }));
    }
  }, [form.type, form.classement, form.date]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!form.date || !form.nom || !form.partenaire || !form.classement || !form.point) {
      setFeedback({ type: "error", msg: "Merci de remplir tous les champs obligatoires." });
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API}/tournois`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date.split("-").reverse().join("/"),
          nom: form.nom,
          categorie: form.categorie,
          partenaire: form.partenaire,
          classement: parseInt(form.classement),
          point: parseInt(form.point),
          validite: form.validite,
        }),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      // Recharge les tournois
      const data = await fetch(`${API}/tournois`).then((r) => r.json());
      setTournois(data);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setFeedback({ type: "success", msg: "✅ Tournoi ajouté avec succès !" });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: "error", msg: "❌ Erreur : " + err.message });
    } finally {
      setLoading(false);
    }
  };

  const parseDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    const [jour, mois, annee] = dateStr.split("/");
    return new Date(`${annee}-${mois}-${jour}`);
  };

  const filtered = tournois.filter((t) => {
    return (
      (categorie === "all" || t.categorie === categorie) &&
      (t.nom?.toLowerCase().includes(search.toLowerCase()) ||
        t.partenaire?.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (tri === "points") return ordreAscendant ? a.point - b.point : b.point - a.point;
    if (tri === "date") {
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      return ordreAscendant ? dateA - dateB : dateB - dateA;
    }
    return 0;
  });

  const meilleurs = [...sorted].sort((a, b) => b.point - a.point).slice(0, 12);
  const totalPoints = meilleurs.reduce((sum, t) => sum + (t.point || 0), 0);
  const moyennePoints = meilleurs.length > 0 ? Math.round(totalPoints / meilleurs.length) : 0;

  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth());
  const moisSuivant =
    nextMonth.toLocaleDateString("fr-FR", { month: "short" }).toLowerCase() +
    "-" +
    String(nextMonth.getFullYear()).slice(-2);
  const tournoisPerdus = tournois.filter((t) => t.validite?.toLowerCase().includes(moisSuivant));
  const pointsPerdus = tournoisPerdus.reduce((sum, t) => sum + (t.point || 0), 0);

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h1 style={{ margin: 0 }}>🎾 TenUp Dashboard</h1>
        <button onClick={() => { setShowForm(!showForm); setFeedback(null); }} style={btnPrimary}>
          {showForm ? "✕ Fermer" : "+ Ajouter un tournoi"}
        </button>
      </div>

      {/* ✅ Feedback */}
      {feedback && (
        <div style={{
          padding: "10px 16px",
          borderRadius: 8,
          marginBottom: 16,
          background: feedback.type === "success" ? "#d4edda" : "#f8d7da",
          color: feedback.type === "success" ? "#155724" : "#721c24",
          fontWeight: "bold",
        }}>
          {feedback.msg}
        </div>
      )}

      {/* ➕ Formulaire */}
      {showForm && (
        <div style={formCard}>
          <h2 style={{ marginTop: 0, marginBottom: 20 }}>➕ Nouveau tournoi</h2>
          <div style={formGrid}>

            <label style={labelStyle}>
              Date *
              <input type="date" name="date" value={form.date} onChange={handleChange} style={inputStyle} />
            </label>

            <label style={labelStyle}>
              Nom du tournoi *
              <input type="text" name="nom" value={form.nom} onChange={handleChange} placeholder="ex: P250 HOMMES" style={inputStyle} />
            </label>

            <label style={labelStyle}>
              Type
              <select name="type" value={form.type} onChange={handleChange} style={inputStyle}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            <label style={labelStyle}>
              Catégorie
              <select name="categorie" value={form.categorie} onChange={handleChange} style={inputStyle}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label style={labelStyle}>
              Partenaire *
              <input type="text" name="partenaire" value={form.partenaire} onChange={handleChange} placeholder="Prénom NOM" style={inputStyle} />
            </label>

            <label style={labelStyle}>
              Classement (place) *
              <input type="number" name="classement" value={form.classement} onChange={handleChange} min="1" placeholder="ex: 3" style={inputStyle} />
            </label>

            <label style={labelStyle}>
              Points
              <input
                type="number"
                name="point"
                value={form.point}
                onChange={handleChange}
                placeholder="Auto-calculé"
                style={{ ...inputStyle, background: form.point ? "#fff" : "#f0f7ff" }}
              />
              <span style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Auto-calculé selon le barème FFT</span>
            </label>

            <label style={labelStyle}>
              Validité
              <input
                type="text"
                name="validite"
                value={form.validite}
                onChange={handleChange}
                placeholder="ex: juil-26"
                style={{ ...inputStyle, background: form.validite ? "#fff" : "#f0f7ff" }}
              />
              <span style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Auto-calculé (J+12 mois)</span>
            </label>

          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={handleSubmit} disabled={loading} style={btnPrimary}>
              {loading ? "Envoi..." : "✅ Ajouter"}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} style={btnSecondary}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* 🔹 Filtres */}
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
        <button onClick={() => setOrdreAscendant(!ordreAscendant)}>
          {ordreAscendant ? "⬆️ Croissant" : "⬇️ Décroissant"}
        </button>
      </div>

      {/* 🔹 Stats */}
      <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
        <Card title="Tournois" value={sorted.length} />
        <Card title="Points total" value={totalPoints} />
        <Card title="Meilleur score" value={Math.max(...sorted.map((t) => t.point || 0), 0)} />
        <Card title="Moyenne (Top 12)" value={moyennePoints} />
      </div>

      {/* 🔹 Tableau */}
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
            <tr key={i} style={{ background: i % 2 === 0 ? "#fafafa" : "white" }}>
              <td>{t.date}</td>
              <td>{t.nom}</td>
              <td>{t.categorie}</td>
              <td>{t.partenaire}</td>
              <td>{t.classement}</td>
              <td style={{ fontWeight: "bold", color: meilleurs.includes(t) ? "green" : "red" }}>
                {t.point}
              </td>
              <td>{t.validite}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 🔹 Tournois perdus */}
      <h2 style={{ marginTop: 30 }}>⚠️ Tournois perdus le mois prochain</h2>
      {tournoisPerdus.length === 0 ? (
        <p>Aucun tournoi ne sort du classement le mois prochain ✅</p>
      ) : (
        <div>
          <p style={{ color: "red", fontWeight: "bold" }}>⚠️ Perte prévue : {pointsPerdus} points</p>
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
                  <td>{t.date}</td>
                  <td>{t.nom}</td>
                  <td>{t.partenaire}</td>
                  <td style={{ fontWeight: "bold", color: "red" }}>{t.point}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div style={{ background: "#f5f5f5", padding: 20, borderRadius: 10, minWidth: 120, textAlign: "center" }}>
      <div style={{ fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: "bold" }}>{value}</div>
    </div>
  );
}

const tableStyle = { width: "100%", borderCollapse: "collapse" };

const formCard = {
  background: "#f9f9f9",
  border: "1px solid #ddd",
  borderRadius: 12,
  padding: 24,
  marginBottom: 24,
};

const formGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: 16,
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  fontSize: 13,
  fontWeight: "bold",
  color: "#444",
  gap: 4,
};

const inputStyle = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: 14,
  marginTop: 2,
};

const btnPrimary = {
  padding: "10px 20px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: 14,
};

const btnSecondary = {
  padding: "10px 20px",
  background: "#e5e7eb",
  color: "#333",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: 14,
};
