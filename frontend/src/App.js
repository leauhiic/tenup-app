import { useCallback, useEffect, useMemo, useState } from "react";
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
  .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid rgba(255,255,255,.1); padding-bottom: 22px; margin-bottom: 18px; }
  .logo { font-weight: 900; font-size: 34px; letter-spacing: .03em; }
  .logo span, .accent { color: #00e676; }
  .subtitle { color: #8a909a; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; margin-top: 2px; }
  .header-actions { display: flex; justify-content: flex-end; align-items: center; gap: 10px; flex-wrap: wrap; }
  .sync-status { color: #8a909a; font-size: 12px; white-space: nowrap; width: 100%; text-align: right; }
  button, input, select { font: inherit; }
  button { cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: .55; }
  .btn-primary { background: #00e676; color: #050607; border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 800; }
  .btn-primary:hover:not(:disabled) { background: #27ef8e; }
  .btn-secondary, .btn-ghost, .btn-danger { background: #22272f; color: #e8eaed; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; padding: 9px 14px; }
  .btn-ghost.active { border-color: #00e676; color: #00e676; background: rgba(0,230,118,.12); }
  .btn-danger { color: #ff6b86; background: rgba(255,77,109,.08); border-color: rgba(255,77,109,.25); }
  .btn-small { padding: 6px 10px; font-size: 12px; font-weight: 800; }
  .feedback { border-radius: 10px; padding: 12px 14px; margin-bottom: 18px; font-weight: 700; }
  .feedback.success { color: #00e676; background: rgba(0,230,118,.1); border: 1px solid rgba(0,230,118,.25); }
  .feedback.error { color: #ff4d6d; background: rgba(255,77,109,.12); border: 1px solid rgba(255,77,109,.25); }
  .feedback-title { color: #ff6b86; margin-bottom: 4px; }
  .feedback-text { color: #f3a6b6; font-weight: 500; }
  .load-error { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
  .panel, .table-wrap { background: #13161b; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; }
  .panel { padding: 22px; margin-bottom: 24px; }
  .panel.compact { max-width: 520px; }
  .panel-title { font-size: 20px; font-weight: 800; margin-bottom: 18px; }
  .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; }
  label { display: grid; gap: 6px; color: #8a909a; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
  input, select { width: 100%; color: #e8eaed; background: #1a1e25; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; padding: 10px 11px; outline: none; }
  input:focus, select:focus { border-color: #00e676; box-shadow: 0 0 0 3px rgba(0,230,118,.14); }
  input[readonly] { color: #8a909a; }
  .hint { color: #00e676; font-size: 12px; font-weight: 800; margin-top: 6px; }
  .actions, .filters, .section-header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .actions { margin-top: 18px; }
  .filters { margin-bottom: 18px; }
  .search { max-width: 300px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .stat { background: #13161b; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 18px; }
  .stat.primary { border-color: rgba(0,230,118,.35); }
  .stat-label { color: #8a909a; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
  .stat-value { font-size: 36px; font-weight: 900; line-height: 1.1; margin-top: 6px; }
  .chart { height: 320px; margin: 8px 0 24px; }
  .section-header { margin: 26px 0 12px; justify-content: space-between; }
  .section-title { font-size: 19px; font-weight: 900; text-transform: uppercase; }
  .section-meta { display: flex; gap: 8px; flex-wrap: wrap; }
  .badge { display: inline-flex; align-items: center; gap: 4px; color: #8a909a; background: #22272f; border: 1px solid rgba(255,255,255,.08); border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 800; white-space: nowrap; }
  .badge.top { color: #00e676; background: rgba(0,230,118,.1); border-color: rgba(0,230,118,.28); }
  .badge.out { color: #cbd1da; background: rgba(255,255,255,.06); }
  .badge.warning { color: #ffd166; background: rgba(255,209,102,.1); border-color: rgba(255,209,102,.25); }
  .badge.danger { color: #ff6b86; background: rgba(255,77,109,.12); border-color: rgba(255,77,109,.25); }
  .badge.history { color: #aeb4bd; background: rgba(174,180,189,.08); }
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
  .row-badges, .row-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .empty { padding: 32px; color: #8a909a; text-align: center; }
  @media (max-width: 760px) {
    .header { align-items: flex-start; flex-direction: column; }
    .header-actions, .sync-status { justify-content: flex-start; text-align: left; }
    .stat-value { font-size: 30px; }
  }
`;

async function readApiError(response, fallback) {
  try {
    const data = await response.json();
    return data?.error || data?.message || fallback;
  } catch {
    return fallback;
  }
}

function formatSyncDate(value) {
  if (!value) return "jamais";
  return value.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toInputDate(value) {
  if (!value) return "";
  const text = String(value);

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split("/");
    return `${year}-${month}-${day}`;
  }

  return "";
}

function Stat({ label, value, primary, danger }) {
  return (
    <div className={`stat ${primary ? "primary" : ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: primary ? "#00e676" : danger ? "#ff4d6d" : undefined }}>{value}</div>
    </div>
  );
}

function RowBadges({ tournament, topRows, kind }) {
  const isTop12 = topRows.includes(tournament);

  if (kind === "current") return <span className="badge warning">mois courant</span>;
  if (kind === "expiring") return <span className="badge danger">expire ce mois</span>;
  if (kind === "history") return <span className="badge history">historique</span>;
  if (isTop12) return <span className="badge top">top 12</span>;
  return <span className="badge out">hors top 12</span>;
}

function TournamentTable({ rows, topRows = [], kind = "active", onEdit, onDelete, canManage = false, deletingId = null }) {
  if (!rows.length) return <div className="table-wrap"><div className="empty">Aucun tournoi trouve</div></div>;

  const isLost = kind === "expiring";

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Tournoi</th>
            <th>Statut</th>
            <th>Cat.</th>
            <th>Partenaire</th>
            <th>Classement</th>
            <th>Points</th>
            {canManage && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((t, index) => {
            const isTop12 = topRows.includes(t);
            return (
              <tr key={t.id || `${t.date}-${t.nom}-${index}`}>
                <td className="dim">{t.date}</td>
                <td>{t.nom}</td>
                <td><div className="row-badges"><RowBadges tournament={t} topRows={topRows} kind={kind} /></div></td>
                <td><span className="cat">{t.categorie}</span></td>
                <td className="dim">{t.partenaire}</td>
                <td className="dim">{t.classement}e</td>
                <td><span className={isLost ? "points-lost" : isTop12 ? "points" : "points-out"}>{t.point}</span></td>
                {canManage && (
                  <td>
                    <div className="row-actions">
                      <button className="btn-secondary btn-small" type="button" onClick={() => onEdit(t)} disabled={deletingId === t.id}>Modifier</button>
                      <button className="btn-danger btn-small" type="button" onClick={() => onDelete(t)} disabled={deletingId === t.id}>{deletingId === t.id ? "..." : "Supprimer"}</button>
                    </div>
                  </td>
                )}
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
  const [showLogin, setShowLogin] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [autoPoint, setAutoPoint] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authToken, setAuthToken] = useState(() => sessionStorage.getItem("tenupAdminToken") || "");
  const [authExpiresAt, setAuthExpiresAt] = useState(() => sessionStorage.getItem("tenupAdminExpiresAt") || "");
  const [now] = useState(() => new Date());

  const isAdmin = Boolean(authToken && authExpiresAt && Date.parse(authExpiresAt) > Date.now());

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    const expires = Date.parse(authExpiresAt || "");
    if (authToken && (!expires || expires <= Date.now())) {
      sessionStorage.removeItem("tenupAdminToken");
      sessionStorage.removeItem("tenupAdminExpiresAt");
      setAuthToken("");
      setAuthExpiresAt("");
    }
  }, [authToken, authExpiresAt]);

  const loadTournois = useCallback(async ({ manual = false, silent = false } = {}) => {
    if (manual) setRefreshing(true);
    if (!manual && !silent) setInitialLoading(true);
    setLoadError(null);

    try {
      const res = await fetch(`${API}/tournois`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(await readApiError(res, "Impossible de charger les tournois."));
      }

      const data = await res.json();
      setTournois(Array.isArray(data) ? data : []);
      setLastLoadedAt(new Date());
    } catch (err) {
      setLoadError(err.message || "Chargement impossible.");
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTournois();
  }, [loadTournois]);

  useEffect(() => {
    if (!autoPoint) return;
    if (form.type && form.tranche && form.classement) {
      const pts = getPoints(form.type, form.tranche, parseInt(form.classement, 10));
      setForm(f => ({ ...f, point: pts !== "" ? String(pts) : f.point }));
    }
  }, [autoPoint, form.type, form.tranche, form.classement]);

  useEffect(() => {
    if (form.date) setForm(f => ({ ...f, validite: getValidite(f.date) }));
  }, [form.date]);

  useEffect(() => {
    const tranches = TRANCHES[form.type] || [];
    if (!tranches.includes(form.tranche)) setForm(f => ({ ...f, tranche: tranches[0] || "" }));
  }, [form.type, form.tranche]);

  const loginAdmin = async () => {
    if (!adminPassword.trim()) {
      setFeedback({ type: "error", msg: "Le mot de passe admin est requis." });
      return;
    }

    setAuthLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });

      if (!res.ok) {
        throw new Error(await readApiError(res, "Connexion admin refusee."));
      }

      const data = await res.json();
      sessionStorage.setItem("tenupAdminToken", data.token);
      sessionStorage.setItem("tenupAdminExpiresAt", data.expiresAt);
      setAuthToken(data.token);
      setAuthExpiresAt(data.expiresAt);
      setAdminPassword("");
      setShowLogin(false);
      setFeedback({ type: "success", msg: "Mode admin active." });
    } catch (err) {
      setFeedback({ type: "error", msg: err.message || "Connexion admin impossible." });
    } finally {
      setAuthLoading(false);
    }
  };

  const logoutAdmin = () => {
    sessionStorage.removeItem("tenupAdminToken");
    sessionStorage.removeItem("tenupAdminExpiresAt");
    setAuthToken("");
    setAuthExpiresAt("");
    setShowForm(false);
    setEditingId(null);
    setFeedback({ type: "success", msg: "Session admin fermee." });
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setAutoPoint(true);
  };

  const openCreateForm = () => {
    if (!isAdmin) {
      setShowLogin(true);
      setFeedback({ type: "error", msg: "Connecte-toi en admin pour modifier les tournois." });
      return;
    }

    resetForm();
    setShowForm(true);
    setFeedback(null);
  };

  const startEdit = tournament => {
    if (!isAdmin) {
      setShowLogin(true);
      setFeedback({ type: "error", msg: "Connecte-toi en admin pour modifier les tournois." });
      return;
    }

    setEditingId(tournament.id);
    setAutoPoint(false);
    setForm({
      ...EMPTY_FORM,
      date: toInputDate(tournament.date),
      nom: tournament.nom || "",
      categorie: tournament.categorie || "DM",
      partenaire: tournament.partenaire || "",
      classement: String(tournament.classement || ""),
      point: String(tournament.point || ""),
      validite: tournament.validite || "",
    });
    setShowForm(true);
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteTournament = async tournament => {
    if (!isAdmin) {
      setShowLogin(true);
      setFeedback({ type: "error", msg: "Connecte-toi en admin pour supprimer un tournoi." });
      return;
    }

    if (!window.confirm(`Supprimer "${tournament.nom}" ?`)) return;

    setDeletingId(tournament.id);
    setFeedback(null);
    try {
      const res = await fetch(`${API}/tournois/${tournament.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!res.ok) throw new Error(await readApiError(res, "Suppression impossible."));

      await loadTournois({ silent: true });
      setFeedback({ type: "success", msg: "Tournoi supprime." });
    } catch (err) {
      setFeedback({ type: "error", msg: err.message || "Suppression impossible." });
    } finally {
      setDeletingId(null);
    }
  };

  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const startWindow = new Date(currentYear, currentMonth - 11, 1);

  const actifs = tournois.filter(t => parseDate(t.date) >= startWindow);
  const tournoisMoisCourant = tournois.filter(t => {
    const d = parseDate(t.date);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });
  const actifsClassement = actifs.filter(t => !tournoisMoisCourant.includes(t));
  const tournoisExpirants = tournois.filter(t => {
    const d = parseDate(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear - 1;
  });
  const historique = tournois.filter(t => parseDate(t.date) < startWindow && !tournoisExpirants.includes(t));

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

  const meilleurs = [...actifsClassement]
    .sort((a, b) => Number(b.point || 0) - Number(a.point || 0))
    .slice(0, 12);
  const totalPoints = meilleurs.reduce((sum, t) => sum + Number(t.point || 0), 0);
  const moyennePoints = meilleurs.length ? Math.round(totalPoints / meilleurs.length) : 0;
  const bestScore = actifsClassement.length ? Math.max(...actifsClassement.map(t => Number(t.point || 0))) : 0;
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
  }, [now]);

  const normalized = useMemo(() => normalizeTournois(tournois), [tournois]);
  const chartData = useMemo(() => buildChartData(months, normalized, now), [months, normalized, now]);
  const tranchesDisponibles = TRANCHES[form.type] || [];
  const pointsPreview = form.type && form.tranche && form.classement
    ? getPoints(form.type, form.tranche, parseInt(form.classement, 10))
    : null;

  const handleChange = e => {
    const { name, value } = e.target;
    if (name === "point") setAutoPoint(false);
    if (["type", "tranche", "classement"].includes(name)) setAutoPoint(true);
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!form.date || !form.nom || !form.partenaire || !form.classement || !form.point) {
      setFeedback({ type: "error", msg: "Merci de remplir tous les champs obligatoires." });
      return;
    }
    if (!isAdmin) {
      setShowLogin(true);
      setFeedback({ type: "error", msg: "Connecte-toi en admin pour enregistrer." });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `${API}/tournois/${editingId}` : `${API}/tournois`;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
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

      if (!res.ok) throw new Error(await readApiError(res, "Enregistrement impossible."));

      await loadTournois({ silent: true });
      resetForm();
      setShowForm(false);
      setFeedback({ type: "success", msg: editingId ? "Tournoi modifie." : "Tournoi ajoute." });
    } catch (err) {
      setFeedback({ type: "error", msg: err.message || "Enregistrement impossible." });
    } finally {
      setSaving(false);
    }
  };

  const cancelForm = () => {
    resetForm();
    setShowForm(false);
  };

  const adminActionLabel = isAdmin ? "Se deconnecter" : "Admin";

  return (
    <div className="tenup-app">
      <header className="header">
        <div>
          <div className="logo">TEN<span>UP</span></div>
          <div className="subtitle">Dashboard Padel - FFT 2026</div>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" type="button" onClick={() => loadTournois({ manual: true })} disabled={refreshing}>
            {refreshing ? "Actualisation..." : "Rafraichir"}
          </button>
          <button className="btn-secondary" type="button" onClick={isAdmin ? logoutAdmin : () => setShowLogin(v => !v)}>
            {adminActionLabel}
          </button>
          <button className="btn-primary" type="button" onClick={showForm ? cancelForm : openCreateForm}>
            {showForm ? "Fermer" : "Ajouter un tournoi"}
          </button>
          <div className="sync-status">Derniere synchro : {formatSyncDate(lastLoadedAt)}</div>
        </div>
      </header>

      {feedback && <div className={`feedback ${feedback.type}`}>{feedback.msg}</div>}

      {loadError && (
        <div className="feedback error load-error">
          <div>
            <div className="feedback-title">Chargement impossible</div>
            <div className="feedback-text">{loadError}{tournois.length ? " Les dernieres donnees chargees restent affichees." : ""}</div>
          </div>
          <button className="btn-secondary" type="button" onClick={() => loadTournois({ manual: true })} disabled={refreshing}>
            Reessayer
          </button>
        </div>
      )}

      {showLogin && !isAdmin && (
        <section className="panel compact">
          <div className="panel-title">Connexion admin</div>
          <div className="form-grid">
            <label>Mot de passe admin
              <input
                type="password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") loginAdmin(); }}
                autoComplete="current-password"
              />
            </label>
          </div>
          <div className="actions">
            <button className="btn-primary" type="button" onClick={loginAdmin} disabled={authLoading}>{authLoading ? "Connexion..." : "Se connecter"}</button>
            <button className="btn-secondary" type="button" onClick={() => setShowLogin(false)}>Annuler</button>
          </div>
        </section>
      )}

      {showForm && (
        <section className="panel">
          <div className="panel-title">{editingId ? "Modifier le tournoi" : "Nouveau tournoi"}</div>
          <div className="form-grid">
            <label>Date *<input type="date" name="date" value={form.date} onChange={handleChange} /></label>
            <label>Nom du tournoi *<input name="nom" value={form.nom} onChange={handleChange} placeholder="ex: P250 HOMMES" /></label>
            <label>Type<select name="type" value={form.type} onChange={handleChange}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
            <label>Nombre de paires<select name="tranche" value={form.tranche} onChange={handleChange}>{tranchesDisponibles.map(t => <option key={t} value={t}>{t} paires</option>)}</select></label>
            <label>Categorie<select name="categorie" value={form.categorie} onChange={handleChange}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
            <label>Partenaire *<input name="partenaire" value={form.partenaire} onChange={handleChange} placeholder="Prenom NOM" /></label>
            <label>Place finale *<input type="number" min="1" name="classement" value={form.classement} onChange={handleChange} /></label>
            <label>Points FFT<input type="number" name="point" value={form.point} onChange={handleChange} />{pointsPreview !== "" && pointsPreview != null && <span className="hint">{pointsPreview} pts calcules</span>}</label>
            <label>Validite<input name="validite" value={form.validite} onChange={handleChange} readOnly /></label>
          </div>
          <div className="actions">
            <button className="btn-primary" type="button" onClick={handleSubmit} disabled={saving}>{saving ? "Enregistrement..." : editingId ? "Enregistrer" : "Ajouter"}</button>
            <button className="btn-secondary" type="button" onClick={cancelForm}>Annuler</button>
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
        <button className={`btn-ghost ${!ordreAscendant ? "active" : ""}`} type="button" onClick={() => setOrdreAscendant(false)}>Desc</button>
        <button className={`btn-ghost ${ordreAscendant ? "active" : ""}`} type="button" onClick={() => setOrdreAscendant(true)}>Asc</button>
      </div>

      {initialLoading ? (
        <div className="table-wrap"><div className="empty">Chargement des tournois...</div></div>
      ) : (
        <>
          <div className="section-header">
            <div className="section-title">Tournois en cours de validite</div>
            <div className="section-meta"><span className="badge">{sorted.length} resultats</span><span className="badge top">{meilleurs.length} top 12</span></div>
          </div>
          <TournamentTable rows={sorted} topRows={meilleurs} kind="active" canManage={isAdmin} onEdit={startEdit} onDelete={deleteTournament} deletingId={deletingId} />

          {tournoisExpirants.length > 0 && (
            <>
              <div className="section-header">
                <div className="section-title">Expirent fin {now.toLocaleDateString("fr-FR", { month: "long" })}</div>
                <div className="section-meta"><span className="badge danger">-{pointsPerdus} pts</span></div>
              </div>
              <TournamentTable rows={tournoisExpirants} kind="expiring" canManage={isAdmin} onEdit={startEdit} onDelete={deleteTournament} deletingId={deletingId} />
            </>
          )}

          {tournoisMoisCourant.length > 0 && (
            <>
              <div className="section-header"><div className="section-title">Tournois du mois</div><span className="badge warning">{tournoisMoisCourant.length}</span></div>
              <TournamentTable rows={tournoisMoisCourant} kind="current" canManage={isAdmin} onEdit={startEdit} onDelete={deleteTournament} deletingId={deletingId} />
            </>
          )}

          {historique.length > 0 && (
            <>
              <div className="section-header"><div className="section-title dim">Historique</div><span className="badge history">{historique.length}</span></div>
              <TournamentTable rows={[...historique].sort((a, b) => parseDate(b.date) - parseDate(a.date))} kind="history" canManage={isAdmin} onEdit={startEdit} onDelete={deleteTournament} deletingId={deletingId} />
            </>
          )}
        </>
      )}
    </div>
  );
}
