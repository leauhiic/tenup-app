import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { addMonths, format, startOfMonth } from "date-fns";
import {
  buildChartData,
  CATEGORIES,
  getPoints,
  getValidite,
  normalizeTournois,
  parseDate,
  TRANCHES,
  TYPES,
} from "./fft";

const API = process.env.REACT_APP_API_URL || "https://tenup-app-production.up.railway.app";

const EMPTY_FORM = {
  date: "",
  nom: "",
  type: "P250",
  tranche: "17-20",
  categorie: "DM",
  partenaire: "",
  classement: "",
  point: "",
  validite: "",
};

const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: #0a0c0f; color: #e8eaed; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .tenup-app { max-width: 1200px; margin: 0 auto; padding: 28px 20px 56px; }
  .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid rgba(255,255,255,.1); padding-bottom: 22px; margin-bottom: 24px; }
  .logo { font-weight: 900; font-size: 34px; letter-spacing: .03em; }
  .logo span, .accent { color: #00e676; }
  .subtitle { color: #8a909a; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; margin-top: 2px; }
  button, input, select { font: inherit; }
  button { cursor: pointer; }
  .btn-primary { background: #00e676; color: #050607; border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 800; }
  .btn-secondary, .btn-ghost { background: #22272f; color: #e8eaed; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; padding: 9px 14px; }
  .btn-ghost.active { border-color: #00e676; color: #00e676; background: rgba(0,230,118,.12); }
  .feedback { border-radius: 10px; padding: 12px 14px; margin-bottom: 18px; font-weight: 700; }
  .feedback.success { color: #00e676; background: rgba(0,230,118,.1); border: 1px solid rgba(0,230,118,.25); }
  .feedback.error { color: #ff4d6d; background: rgba(255,77,109,.12); border: 1px solid rgba(255,77,109,.25); }
  .panel, .table-wrap { background: #13161b; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; }
  .panel { padding: 22px; margin-bottom: 24px; }
  .panel-title { font-size: 20px; font-weight: 800; margin-bottom: 18px; }
  .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; }
  label { display: grid; gap: 6px; color: #8a909a; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
  input, select { width: 100%; color: #e8eaed; background: #1a1e25; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; padding: 10px 11px; outline: none; }
  input:focus, select:focus { border-color: #00e676; box-shadow: 0 0 0 3px rgba(0,230,118,.14); }
  .hint { color: #00e676; font-size: 12px; font-weight: 800; margin-top: 6px; }
  .actions, .filters, .section-header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .actions { margin-top: 18px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .stat { background: #13161b; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 18px; }
  .stat.primary { border-color: rgba(0,230,118,.35); }
  .stat-label { color: #8a909a; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
  .stat-value { font-size: 36px; font-weight: 900; line-height: 1.1; margin-top: 6px; }
  .chart { height: 320px; margin: 8px 0 24px; }
  .filters { margin-bottom: 18px; }
  .search { max-width: 300px; }
  .section-header { margin: 26px 0 12px; }
  .section-title { font-size: 19px; font-weight: 900; text-transform: uppercase; }
  .badge { color: #8a909a; background: #22272f; border: 1px solid rgba(255,255,255,.08); border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 800; }
  .badge.danger { color: #ff4d6d; background: rgba(255,77,109,.12); }
  .table-wrap { overflow-x: auto; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 12px 14px; text-align: left; white-space: nowrap; border-bottom: 1px solid rgba(255,255,255,.08); }
  th { color: #8a909a; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; background: #1a1e25; }
  tr:last-child td { border-bottom: 0; }
  .dim { color: #8a909a; }
  .points { color: #00e676; font-weight: 900; }
  .points-out { color: #8a909a; font-weight: 800; }
  .points-lost { color: #ff4d6d; font-weight: 900; }
  .cat { display: inline-block; min-width: 34px; border-radius: 6px; padding: 2px 8px; text-align: center; background: #22272f; font-weight: 900; font-size: 12px; }
  .empty { padding: 32px; color: #8a909a; text-align: center; }
`;

function Stat({ label, value, primary, danger }) {
  return (
    <div className={`stat ${primary ? "primary" : ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: primary ? "#00e676" : danger ? "#ff4d6d" : undefined }}>{value}</div>
    </div>
  );
}

function TournamentTable({ rows, topRows = [], lost = false }) {
  if (!rows.length) return <div className="table-wrap"><div className="empty">Aucun tournoi trouve</div></div>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Tournoi</th>
            <th>Cat.</th>
            <th>Partenaire</th>
            <th>Classement</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, index) => {
            const isTop12 = topRows.includes(t);
            return (
              <tr key={t.id || `${t.date}-${t.nom}-${index}`}>
                <td className="dim">{t.date}</td>
                <td>{t.nom}</td>
                <td><span className="cat">{t.categorie}</span></td>
                <td className="dim">{t.partenaire}</td>
                <td className="dim">{t.classement}e</td>
                <td><span className={lost ? "points-lost" : isTop12 ? "points" : "points-out"}>{t.point}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [tournois, setTournois] = useState([]);
  const [search, setSearch] = useState("");
  const [tri, setTri] = useState("points");
  const [categorie, setCategorie] = useState("all");
  const [ordreAscendant, setOrdreAscendant] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem("tenupAdminKey") || "");

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const loadTournois = async () => {
    const res = await fetch(`${API}/tournois`);
    if (!res.ok) throw new Error("Impossible de charger les tournois");
    setTournois(await res.json());
  };

  useEffect(() => {
    loadTournois().catch(err => setFeedback({ type: "error", msg: err.message }));
  }, []);

  useEffect(() => {
    if (form.type && form.tranche && form.classement) {
      const pts = getPoints(form.type, form.tranche, parseInt(form.classement, 10));
      setForm(f => ({ ...f, point: pts !== "" ? String(pts) : f.point }));
    }
  }, [form.type, form.tranche, form.classement]);

  useEffect(() => {
    if (form.date) setForm(f => ({ ...f, validite: getValidite(f.date) }));
  }, [form.date]);

  useEffect(() => {
    const tranches = TRANCHES[form.type] || [];
    if (!tranches.includes(form.tranche)) setForm(f => ({ ...f, tranche: tranches[0] || "" }));
  }, [form.type, form.tranche]);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const startWindow = new Date(currentYear, currentMonth - 11, 1);

  const actifs = tournois.filter(t => parseDate(t.date) >= startWindow);
  const tournoisMoisCourant = tournois.filter(t => {
    const d = parseDate(t.date);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });
  const actifsClassement = actifs.filter(t => !tournoisMoisCourant.includes(t));
  const expires = tournois.filter(t => parseDate(t.date) < startWindow);
  const tournoisExpirants = tournois.filter(t => {
    const d = parseDate(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear - 1;
  });

  const filtered = actifsClassement.filter(t => {
    const matchesCategory = categorie === "all" || t.categorie === categorie;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || t.nom?.toLowerCase().includes(q) || t.partenaire?.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (tri === "date") {
      const diff = parseDate(a.date) - parseDate(b.date);
      return ordreAscendant ? diff : -diff;
    }
    const diff = Number(a.point || 0) - Number(b.point || 0);
    return ordreAscendant ? diff : -diff;
  });

  const meilleurs = [...sorted].sort((a, b) => Number(b.point || 0) - Number(a.point || 0)).slice(0, 12);
  const totalPoints = meilleurs.reduce((sum, t) => sum + Number(t.point || 0), 0);
  const moyennePoints = meilleurs.length ? Math.round(totalPoints / meilleurs.length) : 0;
  const bestScore = sorted.length ? Math.max(...sorted.map(t => Number(t.point || 0))) : 0;
  const pointsPerdus = tournoisExpirants.reduce((sum, t) => sum + Number(t.point || 0), 0);
  const poolProjetee = [
    ...actifsClassement.filter(t => !tournoisExpirants.includes(t)),
    ...tournoisMoisCourant,
  ];
  const pointsProjetes = [...poolProjetee]
    .sort((a, b) => Number(b.point || 0) - Number(a.point || 0))
    .slice(0, 12)
    .reduce((sum, t) => sum + Number(t.point || 0), 0);
  const deltaPoints = pointsProjetes - totalPoints;

  const months = useMemo(() => {
    const start = startOfMonth(addMonths(now, -11));
    return Array.from({ length: 24 }, (_, i) => {
      const date = addMonths(start, i);
      return { date, label: format(date, "MMM yyyy") };
    });
  }, [currentMonth, currentYear]);

  const normalized = useMemo(() => normalizeTournois(tournois), [tournois]);
  const chartData = useMemo(() => buildChartData(months, normalized, now), [months, normalized, currentMonth, currentYear]);
  const tranchesDisponibles = TRANCHES[form.type] || [];
  const pointsPreview = form.type && form.tranche && form.classement
    ? getPoints(form.type, form.tranche, parseInt(form.classement, 10))
    : null;

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.date || !form.nom || !form.partenaire || !form.classement || !form.point) {
      setFeedback({ type: "error", msg: "Merci de remplir tous les champs obligatoires." });
      return;
    }
    if (!adminKey) {
      setFeedback({ type: "error", msg: "La cle admin est requise pour ajouter un tournoi." });
      return;
    }

    setLoading(true);
    setFeedback(null);
    try {
      sessionStorage.setItem("tenupAdminKey", adminKey);
      const res = await fetch(`${API}/tournois`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": adminKey },
        body: JSON.stringify({
          date: form.date,
          nom: form.nom,
          categorie: form.categorie,
          partenaire: form.partenaire,
          classement: parseInt(form.classement, 10),
          point: parseInt(form.point, 10),
          validite: form.validite,
        }),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      await loadTournois();
      setForm(EMPTY_FORM);
      setShowForm(false);
      setFeedback({ type: "success", msg: "Tournoi ajoute avec succes." });
    } catch (err) {
      setFeedback({ type: "error", msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tenup-app">
      <header className="header">
        <div>
          <div className="logo">TEN<span>UP</span></div>
          <div className="subtitle">Dashboard Padel - FFT 2026</div>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(v => !v)}>{showForm ? "Fermer" : "Ajouter un tournoi"}</button>
      </header>

      {feedback && <div className={`feedback ${feedback.type}`}>{feedback.msg}</div>}

      {showForm && (
        <section className="panel">
          <div className="panel-title">Nouveau tournoi</div>
          <div className="form-grid">
            <label>Date *<input type="date" name="date" value={form.date} onChange={handleChange} /></label>
            <label>Nom du tournoi *<input name="nom" value={form.nom} onChange={handleChange} placeholder="ex: P250 HOMMES" /></label>
            <label>Type<select name="type" value={form.type} onChange={handleChange}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
            <label>Nombre de paires<select name="tranche" value={form.tranche} onChange={handleChange}>{tranchesDisponibles.map(t => <option key={t} value={t}>{t} paires</option>)}</select></label>
            <label>Categorie<select name="categorie" value={form.categorie} onChange={handleChange}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
            <label>Partenaire *<input name="partenaire" value={form.partenaire} onChange={handleChange} placeholder="Prenom NOM" /></label>
            <label>Place finale *<input type="number" min="1" name="classement" value={form.classement} onChange={handleChange} /></label>
            <label>Points FFT<input type="number" name="point" value={form.point} onChange={handleChange} />{pointsPreview !== "" && pointsPreview != null && <span className="hint">{pointsPreview} pts</span>}</label>
            <label>Cle admin *<input type="password" value={adminKey} onChange={e => setAdminKey(e.target.value)} autoComplete="off" /></label>
          </div>
          <div className="actions">
            <button className="btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? "Envoi..." : "Ajouter"}</button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Annuler</button>
          </div>
        </section>
      )}

      <section className="stats">
        <Stat label="Points classement" value={totalPoints} primary />
        <Stat label="Tournois actifs" value={sorted.length} />
        <Stat label="Meilleur score" value={bestScore} />
        <Stat label="Moy. Top 12" value={moyennePoints} />
        <Stat label="Projection" value={`${deltaPoints >= 0 ? "+" : ""}${deltaPoints}`} primary={deltaPoints >= 0} danger={deltaPoints < 0} />
      </section>

      <div className="chart">
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <XAxis dataKey="month" interval={2} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="real" stroke="#00e676" strokeWidth={3} dot connectNulls={false} />
            <Line type="monotone" dataKey="projected" stroke="#00e676" strokeDasharray="6 6" strokeWidth={2} dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="filters">
        <input className="search" placeholder="Rechercher tournoi ou partenaire" value={search} onChange={e => setSearch(e.target.value)} />
        <select value={categorie} onChange={e => setCategorie(e.target.value)}><option value="all">Toutes categories</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        <select value={tri} onChange={e => setTri(e.target.value)}><option value="points">Trier par points</option><option value="date">Trier par date</option></select>
        <button className={`btn-ghost ${!ordreAscendant ? "active" : ""}`} onClick={() => setOrdreAscendant(false)}>Desc</button>
        <button className={`btn-ghost ${ordreAscendant ? "active" : ""}`} onClick={() => setOrdreAscendant(true)}>Asc</button>
      </div>

      <div className="section-header"><div className="section-title">Tournois en cours de validite</div><span className="badge">{sorted.length} resultats</span></div>
      <TournamentTable rows={sorted} topRows={meilleurs} />

      {tournoisExpirants.length > 0 && (
        <>
          <div className="section-header"><div className="section-title">Expirent fin {now.toLocaleDateString("fr-FR", { month: "long" })}</div><span className="badge danger">-{pointsPerdus} pts</span></div>
          <TournamentTable rows={tournoisExpirants} lost />
        </>
      )}

      {tournoisMoisCourant.length > 0 && (
        <>
          <div className="section-header"><div className="section-title">Tournois du mois</div><span className="badge">{tournoisMoisCourant.length}</span></div>
          <TournamentTable rows={tournoisMoisCourant} />
        </>
      )}

      {expires.length > 0 && (
        <>
          <div className="section-header"><div className="section-title dim">Historique</div><span className="badge">{expires.length}</span></div>
          <TournamentTable rows={[...expires].sort((a, b) => parseDate(b.date) - parseDate(a.date))} />
        </>
      )}
    </div>
  );
}
