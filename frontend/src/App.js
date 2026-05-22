import { useEffect, useState } from "react";

const API = "https://tenup-app-production.up.railway.app";

// ─────────────────────────────────────────────────────────────
// BARÈME FFT MARS 2026 — source : FFT Guide compétition fév 2026
// Structure : BAREME[type][tranche_paires][place - 1]
// Tranches : "4-8", "9-12", "13-16", "17-20", "21-24", "25-28", "29-32"
// ─────────────────────────────────────────────────────────────
const BAREME = {
  P25: {
    "4-8":   [25,20,15,9,6,4,2,1],
    "9-12":  [25,20,16,14,10,8,7,6,4,3,2,1],
    "13-16": [25,20,17,15,14,13,12,11,8,7,6,5,4,3,2,1],
    "17-20": [25,22,19,17,15,13,12,11,9,8,7,6,5,4,3,2,1,1,1,1],
    "21-24": [25,22,19,17,15,13,12,11,9,8,7,6,5,5,5,5,4,4,3,1,2,2,1,1],
    "25-28": [25,22,19,17,15,13,12,11,8,7,6,5,4,4,4,4,3,3,3,3,2,2,2,2,1,1,1,1],
  },
  P50: {
    "4-8":   [50,40,30,20,13,5,3,1],
    "9-12":  [50,40,33,28,20,15,10,5,3,2,1,1],
    "13-16": [50,40,35,30,25,23,20,15,13,11,9,8,5,3,2,1],
    "17-20": [50,43,38,35,30,28,25,23,18,15,13,12,10,9,8,6,5,3,2,1],
    "21-24": [50,43,38,35,30,28,25,23,19,18,17,16,15,14,13,12,10,9,8,6,5,3,2,1],
    "25-28": [50,43,38,35,30,28,25,23,19,18,17,16,15,13,13,12,10,9,8,7,6,5,4,3,2,2,1,1],
    "29-32": [50,43,38,35,30,29,28,27,23,22,21,20,19,18,17,16,14,13,13,12,12,11,11,10,9,8,7,6,5,4,3,2],
  },
  P100: {
    "4-8":   [100,80,60,40,25,10,5,1],
    "9-12":  [100,80,65,55,40,30,20,10,5,3,2,1],
    "13-16": [100,80,70,60,50,45,40,30,25,21,18,15,10,5,3,1],
    "17-20": [100,85,75,70,60,55,50,45,35,30,25,23,20,18,15,12,10,5,3,1],
    "21-24": [100,85,75,70,60,55,50,45,38,36,34,32,30,28,26,24,20,18,15,12,10,5,3,1],
    "25-28": [100,85,75,70,60,55,50,45,38,36,34,32,30,28,26,24,20,18,15,12,10,8,6,4,3,2,1,1],
    "29-32": [100,85,75,70,60,58,56,54,45,43,41,39,37,35,33,31,27,26,25,24,23,22,21,20,17,15,13,11,9,7,5,3],
  },
  P250: {
    "4-8":   [250,200,150,100,63,25,13,3],
    "9-12":  [250,200,165,140,100,75,50,25,13,8,5,3],
    "13-16": [250,200,175,150,125,115,100,75,63,53,45,38,25,13,8,3],
    "17-20": [250,213,188,175,150,138,125,113,88,75,63,58,50,45,38,30,25,13,8,3],
    "21-24": [250,213,188,175,150,138,125,113,95,90,85,80,75,70,65,60,50,45,38,30,25,13,8,3],
    "25-28": [250,213,188,175,150,138,125,113,95,90,85,80,75,65,65,60,50,45,38,30,25,15,10,8,10,8,5,3],
    "29-32": [250,213,188,175,150,145,140,135,113,108,103,98,93,88,83,78,68,65,63,60,58,55,53,50,43,38,33,28,23,18,13,8],
  },
  P500: {
    "4-8":   [500,375,300,200,125,50,25,5],
    "9-12":  [500,375,300,250,175,125,100,50,25,15,10,5],
    "13-16": [500,400,350,300,250,225,200,150,125,105,90,75,50,25,15,5],
    "17-20": [500,425,375,350,300,275,250,225,175,150,125,115,100,90,75,60,50,25,15,5],
    "21-24": [500,425,375,350,300,275,250,225,190,180,170,155,145,135,125,115,100,90,75,60,50,25,15,5],
    "25-28": [500,425,375,350,300,290,275,260,240,225,210,195,180,165,155,145,125,115,100,90,80,60,45,30,20,10,5,3],
    "29-32": [500,425,375,350,300,290,285,275,250,240,225,210,195,180,165,150,135,125,115,100,90,80,70,60,50,40,30,25,20,15,10,5],
  },
  P1000: {
    "4-8":   [1000,600,500,400,250,100,50,10],
    "9-12":  [1000,650,550,500,350,250,200,150,100,50,30,10],
    "13-16": [1000,700,600,550,450,400,350,300,250,210,180,150,100,50,30,10],
    "17-20": [1000,750,650,600,550,500,450,400,350,300,250,230,200,180,150,120,100,50,30,10],
    "21-24": [1000,750,700,650,600,550,500,470,430,400,370,330,300,280,250,230,200,180,150,120,100,50,30,10],
    "25-28": [1000,800,750,700,650,600,550,530,500,480,450,430,400,380,350,330,300,280,250,230,200,180,150,120,100,50,30,10,null,null,null,null],
    "29-32": [1000,800,750,720,700,650,630,600,580,550,530,500,480,450,430,400,380,350,330,300,280,250,230,200,180,150,null,null,null,null,null,null],
  },
  P1500: {
    "21-24": [1500,1125,1050,975,900,825,750,705,645,600,555,495,450,420,375,345,300,270,225,180,150,75,45,15],
    "25-28": [1500,1200,1125,1050,975,900,825,795,750,720,675,645,600,570,525,495,450,420,375,345,300,270,225,180,150,75,45,15],
    "29-32": [1500,1200,1125,1080,1050,975,945,900,870,825,795,750,720,675,645,600,570,525,495,450,420,375,345,300,270,225,180,150,120,75,45,15],
  },
  P2000: {
    "21-24": [2000,1500,1400,1300,1200,1100,1000,940,860,800,740,660,600,560,500,460,400,360,300,240,200,100,60,20],
    "25-28": [2000,1600,1500,1400,1300,1200,1100,1060,1000,960,900,860,800,760,700,660,600,560,500,460,400,360,300,240,200,100,60,20],
    "29-32": [2000,1600,1500,1440,1400,1300,1260,1200,1160,1100,1060,1000,960,900,860,800,760,700,660,600,560,500,460,400,360,300,240,200,160,100,60,20],
  },
};

// Tranches disponibles par type
const TRANCHES = {
  P25:   ["4-8","9-12","13-16","17-20","21-24","25-28"],
  P50:   ["4-8","9-12","13-16","17-20","21-24","25-28","29-32"],
  P100:  ["4-8","9-12","13-16","17-20","21-24","25-28","29-32"],
  P250:  ["4-8","9-12","13-16","17-20","21-24","25-28","29-32"],
  P500:  ["4-8","9-12","13-16","17-20","21-24","25-28","29-32"],
  P1000: ["4-8","9-12","13-16","17-20","21-24","25-28","29-32"],
  P1500: ["21-24","25-28","29-32"],
  P2000: ["21-24","25-28","29-32"],
};

const CATEGORIES = ["DM","DD","DX"];
const TYPES = ["P25","P50","P100","P250","P500","P1000","P1500","P2000"];

function getPoints(type, tranche, place) {
  const table = BAREME[type]?.[tranche];
  if (!table) return "";
  const pts = table[place - 1];
  return pts != null ? pts : "";
}

function getValidite(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const future = new Date(d.getFullYear() + 1, d.getMonth(), 1);
  return future.toLocaleDateString("fr-FR", { month: "short" }).toLowerCase()
    + "-" + String(future.getFullYear()).slice(-2);
}

const EMPTY_FORM = {
  date: "", nom: "", type: "P250", tranche: "17-20",
  categorie: "DM", partenaire: "", classement: "", point: "", validite: "",
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
    fetch(`${API}/tournois`).then(r => r.json()).then(setTournois);
  }, []);

  // Auto-calcul points quand type/tranche/classement/date changent
  useEffect(() => {
    if (form.type && form.tranche && form.classement) {
      const pts = getPoints(form.type, form.tranche, parseInt(form.classement));
      setForm(f => ({ ...f, point: pts !== "" ? String(pts) : f.point }));
    }
  }, [form.type, form.tranche, form.classement]);

  useEffect(() => {
    if (form.date) setForm(f => ({ ...f, validite: getValidite(f.date) }));
  }, [form.date]);

  // Réinitialise la tranche si le type change
  useEffect(() => {
    const tranches = TRANCHES[form.type] || [];
    if (!tranches.includes(form.tranche)) {
      setForm(f => ({ ...f, tranche: tranches[0] || "" }));
    }
  }, [form.type]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
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
      const data = await fetch(`${API}/tournois`).then(r => r.json());
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

  const parseDate = (s) => {
    if (!s) return new Date(0);
    const [j, m, a] = s.split("/");
    return new Date(`${a}-${m}-${j}`);
  };

  const filtered = tournois.filter(t =>
    (categorie === "all" || t.categorie === categorie) &&
    (t.nom?.toLowerCase().includes(search.toLowerCase()) ||
     t.partenaire?.toLowerCase().includes(search.toLowerCase()))
  );

  const sorted = [...filtered].sort((a, b) => {
    if (tri === "points") return ordreAscendant ? a.point - b.point : b.point - a.point;
    if (tri === "date") {
      const da = parseDate(a.date), db = parseDate(b.date);
      return ordreAscendant ? da - db : db - da;
    }
    return 0;
  });

  const meilleurs = [...sorted].sort((a, b) => b.point - a.point).slice(0, 12);
  const totalPoints = meilleurs.reduce((s, t) => s + (t.point || 0), 0);
  const moyennePoints = meilleurs.length > 0 ? Math.round(totalPoints / meilleurs.length) : 0;

  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth());
  const moisSuivant = nextMonth.toLocaleDateString("fr-FR", { month: "short" }).toLowerCase()
    + "-" + String(nextMonth.getFullYear()).slice(-2);
  const tournoisPerdus = tournois.filter(t => t.validite?.toLowerCase().includes(moisSuivant));
  const pointsPerdus = tournoisPerdus.reduce((s, t) => s + (t.point || 0), 0);

  const tranchesDisponibles = TRANCHES[form.type] || [];
  const pointsPreview = form.type && form.tranche && form.classement
    ? getPoints(form.type, form.tranche, parseInt(form.classement))
    : null;

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h1 style={{ margin: 0 }}>🎾 TenUp Dashboard</h1>
        <button onClick={() => { setShowForm(!showForm); setFeedback(null); }} style={btnPrimary}>
          {showForm ? "✕ Fermer" : "+ Ajouter un tournoi"}
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{
          padding: "10px 16px", borderRadius: 8, marginBottom: 16,
          background: feedback.type === "success" ? "#d4edda" : "#f8d7da",
          color: feedback.type === "success" ? "#155724" : "#721c24",
          fontWeight: "bold",
        }}>
          {feedback.msg}
        </div>
      )}

      {/* Formulaire */}
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
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            <label style={labelStyle}>
              Nombre de paires inscrites
              <select name="tranche" value={form.tranche} onChange={handleChange} style={inputStyle}>
                {tranchesDisponibles.map(t => <option key={t} value={t}>{t} paires</option>)}
              </select>
              <span style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Détermine les points selon le barème FFT</span>
            </label>

            <label style={labelStyle}>
              Catégorie
              <select name="categorie" value={form.categorie} onChange={handleChange} style={inputStyle}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label style={labelStyle}>
              Partenaire *
              <input type="text" name="partenaire" value={form.partenaire} onChange={handleChange} placeholder="Prénom NOM" style={inputStyle} />
            </label>

            <label style={labelStyle}>
              Place finale *
              <input type="number" name="classement" value={form.classement} onChange={handleChange} min="1" placeholder="ex: 3" style={inputStyle} />
            </label>

            <label style={labelStyle}>
              Points FFT
              <input
                type="number" name="point" value={form.point} onChange={handleChange}
                placeholder="Auto-calculé"
                style={{ ...inputStyle, background: form.point ? "#fff" : "#f0f7ff", fontWeight: "bold", color: "#2563eb" }}
              />
              {pointsPreview !== "" && pointsPreview != null && (
                <span style={{ fontSize: 12, color: "#2563eb", marginTop: 2, fontWeight: "bold" }}>
                  📊 Barème FFT : {pointsPreview} pts ({form.type} · {form.tranche} paires · {form.classement}e)
                </span>
              )}
            </label>

            <label style={labelStyle}>
              Validité
              <input type="text" name="validite" value={form.validite} onChange={handleChange}
                placeholder="ex: juil-26"
                style={{ ...inputStyle, background: form.validite ? "#fff" : "#f0f7ff" }} />
              <span style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Auto-calculé (date + 12 mois)</span>
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

      {/* Filtres */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input placeholder="Recherche (tournoi ou partenaire)" value={search}
          onChange={e => setSearch(e.target.value)} style={{ padding: 8, width: 250 }} />
        <select onChange={e => setCategorie(e.target.value)}>
          <option value="all">Toutes catégories</option>
          <option value="DM">DM</option>
          <option value="DX">DX</option>
        </select>
        <select onChange={e => setTri(e.target.value)}>
          <option value="date">Trier par date</option>
          <option value="points">Trier par points</option>
        </select>
        <button onClick={() => setOrdreAscendant(!ordreAscendant)}>
          {ordreAscendant ? "⬆️ Croissant" : "⬇️ Décroissant"}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
        <Card title="Tournois" value={sorted.length} />
        <Card title="Points total" value={totalPoints} />
        <Card title="Meilleur score" value={Math.max(...sorted.map(t => t.point || 0), 0)} />
        <Card title="Moyenne (Top 12)" value={moyennePoints} />
      </div>

      {/* Tableau */}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th>Date</th><th>Nom</th><th>Catégorie</th><th>Partenaire</th>
            <th>Classement</th><th>Points</th><th>Validité</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#fafafa" : "white" }}>
              <td>{t.date}</td><td>{t.nom}</td><td>{t.categorie}</td><td>{t.partenaire}</td>
              <td>{t.classement}</td>
              <td style={{ fontWeight: "bold", color: meilleurs.includes(t) ? "green" : "red" }}>{t.point}</td>
              <td>{t.validite}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 30 }}>⚠️ Tournois perdus le mois prochain</h2>
      {tournoisPerdus.length === 0 ? (
        <p>Aucun tournoi ne sort du classement le mois prochain ✅</p>
      ) : (
        <div>
          <p style={{ color: "red", fontWeight: "bold" }}>⚠️ Perte prévue : {pointsPerdus} points</p>
          <table style={tableStyle}>
            <thead>
              <tr><th>Date</th><th>Nom</th><th>Partenaire</th><th>Points perdus</th></tr>
            </thead>
            <tbody>
              {tournoisPerdus.map((t, i) => (
                <tr key={i} style={{ background: "#ffe5e5" }}>
                  <td>{t.date}</td><td>{t.nom}</td><td>{t.partenaire}</td>
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
const formCard = { background: "#f9f9f9", border: "1px solid #ddd", borderRadius: 12, padding: 24, marginBottom: 24 };
const formGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 };
const labelStyle = { display: "flex", flexDirection: "column", fontSize: 13, fontWeight: "bold", color: "#444", gap: 4 };
const inputStyle = { padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14, marginTop: 2 };
const btnPrimary = { padding: "10px 20px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer", fontSize: 14 };
const btnSecondary = { padding: "10px 20px", background: "#e5e7eb", color: "#333", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer", fontSize: 14 };
