import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  buildChartData,
  CATEGORIES,
  getDashboardBuckets,
  getPoints,
  getValidite,
  normalizeTournois,
  parseDate,
  TRANCHES,
  TYPES,
} from "./fft";

const API =
  process.env.REACT_APP_API_URL ||
  "/api";
const LOGO = "/logo-petit.png";
const AUTH_TOKEN_KEY = "tenupUserToken";
const AUTH_EXPIRES_KEY = "tenupUserExpiresAt";
const AUTH_USER_KEY = "tenupUser";

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, date.getDate());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatMonthLabel(date) {
  return date.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

const EMPTY_FORM = {
  date: "",
  nom: "",
  type: "P250",
  tranche: "17-20",
  categorie: "DM",
  licence: "",
  partenaire: "",
  classement: "",
  point: "",
  validite: "",
  manuel: true,
};

const EMPTY_AUTH_FORM = {
  name: "",
  email: "",
  tenupId: "",
  licence: "",
  password: "",
};

const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    background: #eadcc6;
    background-image:
      linear-gradient(90deg, rgba(93, 91, 56, .045) 1px, transparent 1px),
      linear-gradient(0deg, rgba(178, 108, 62, .035) 1px, transparent 1px),
      linear-gradient(135deg, #f6eddf 0%, #ead9bd 48%, #d8c19d 100%);
    background-size: 42px 42px, 42px 42px, auto;
    color: #2b261d;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .tenup-app { max-width: 1240px; margin: 0 auto; padding: 28px 20px 56px; }
  .brand { display: flex; align-items: center; gap: 14px; min-width: 0; flex: 1; }
  .brand-mark { width: 74px; height: 48px; object-fit: contain; border-radius: 6px; mix-blend-mode: multiply; }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    border: 1px solid rgba(91, 92, 55, .18);
    border-radius: 8px;
    padding: 18px 20px;
    margin-bottom: 18px;
    background: rgba(255, 249, 238, .84);
    box-shadow: 0 18px 42px rgba(78, 58, 36, .1);
  }
  .logo { color: #454b2c; font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: 30px; letter-spacing: 0; line-height: 1.05; }
  .logo span, .accent { color: #b86438; }
  .subtitle { color: #8a5a38; font-size: 13px; text-transform: uppercase; letter-spacing: 0; margin-top: 7px; font-weight: 700; }
  .user-chip { color: #6f6c52; font-size: 13px; font-weight: 700; padding: 9px 12px; border: 1px solid rgba(91, 92, 55, .16); border-radius: 8px; background: rgba(255, 248, 236, .72); }
  .account-switcher { position: relative; }
  .user-chip-button { display: inline-flex; align-items: center; gap: 8px; min-height: 38px; color: #454b2c; }
  .user-chip-button:hover:not(:disabled) { background: #fff8ed; border-color: rgba(184, 100, 56, .34); }
  .chip-caret { color: #a9532f; font-size: 11px; text-transform: uppercase; }
  .account-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 30;
    width: min(320px, calc(100vw - 40px));
    max-height: 360px;
    overflow-y: auto;
    padding: 8px;
    background: rgba(255, 249, 238, .98);
    border: 1px solid rgba(91, 92, 55, .18);
    border-radius: 8px;
    box-shadow: 0 18px 42px rgba(78, 58, 36, .18);
  }
  .account-menu-title { color: #6f6c52; font-size: 11px; font-weight: 900; text-transform: uppercase; padding: 7px 8px; }
  .account-option {
    width: 100%;
    display: grid;
    gap: 3px;
    text-align: left;
    color: #2b261d;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 9px 10px;
  }
  .account-option:hover { background: rgba(244, 235, 220, .68); }
  .account-option.active { border-color: rgba(184, 100, 56, .32); background: rgba(184, 100, 56, .12); }
  .account-name { font-weight: 900; }
  .account-meta { color: #716b56; font-size: 12px; }
  .account-menu-empty { color: #716b56; padding: 12px 10px; font-size: 13px; }
  .header-actions { display: flex; justify-content: flex-end; align-items: center; gap: 10px; flex-wrap: wrap; }
  .sync-status { color: #6f6c52; font-size: 12px; white-space: nowrap; width: 100%; text-align: right; }
  button, input, select { font: inherit; }
  button { cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: .55; }
  .btn-primary {
    background: linear-gradient(180deg, #c97947, #a9532f);
    color: #fff8ec;
    border: 1px solid rgba(126, 59, 30, .3);
    border-radius: 8px;
    padding: 10px 16px;
    font-weight: 800;
    box-shadow: 0 10px 20px rgba(169, 83, 47, .18);
  }
  .btn-primary:hover:not(:disabled) { background: linear-gradient(180deg, #d18753, #b45d35); }
  .btn-secondary, .btn-ghost, .btn-danger {
    background: rgba(255, 248, 236, .72);
    color: #454b2c;
    border: 1px solid rgba(91, 92, 55, .2);
    border-radius: 8px;
    padding: 9px 14px;
  }
  .btn-secondary:hover:not(:disabled), .btn-ghost:hover:not(:disabled) { background: #fff8ed; border-color: rgba(91, 92, 55, .34); }
  .btn-ghost.active { border-color: #b86438; color: #a9532f; background: rgba(184, 100, 56, .12); }
  .btn-danger { color: #9b3b31; background: rgba(155, 59, 49, .08); border-color: rgba(155, 59, 49, .22); }
  .btn-small { padding: 6px 10px; font-size: 12px; font-weight: 800; }
  .feedback { border-radius: 8px; padding: 12px 14px; margin-bottom: 18px; font-weight: 700; }
  .feedback.success { color: #43512e; background: rgba(88, 104, 57, .12); border: 1px solid rgba(88, 104, 57, .25); }
  .feedback.error { color: #9b3b31; background: rgba(155, 59, 49, .1); border: 1px solid rgba(155, 59, 49, .24); }
  .feedback-title { color: #9b3b31; margin-bottom: 4px; }
  .feedback-text { color: #7b4c35; font-weight: 500; }
  .load-error { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
  .panel, .table-wrap {
    background: rgba(255, 249, 238, .88);
    border: 1px solid rgba(91, 92, 55, .16);
    border-radius: 8px;
    box-shadow: 0 18px 42px rgba(78, 58, 36, .08);
  }
  .panel { padding: 22px; margin-bottom: 24px; }
  .panel.compact { max-width: 520px; }
  .panel-title { color: #454b2c; font-size: 20px; font-weight: 800; margin-bottom: 18px; }
  .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; }
  label { display: grid; gap: 6px; color: #6f6c52; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0; }
  input, select {
    width: 100%;
    color: #2b261d;
    background: rgba(255, 252, 245, .9);
    border: 1px solid rgba(91, 92, 55, .18);
    border-radius: 8px;
    padding: 10px 11px;
    outline: none;
  }
  input:focus, select:focus { border-color: #b86438; box-shadow: 0 0 0 3px rgba(184, 100, 56, .13); }
  input[readonly] { color: #7f785d; background: rgba(244, 235, 220, .82); }
  .hint { color: #5a6737; font-size: 12px; font-weight: 800; margin-top: 6px; }
  .actions, .section-header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .actions { margin-top: 18px; }
  .filters {
    display: grid;
    grid-template-columns: minmax(240px, 1fr) minmax(150px, 180px) minmax(150px, 180px) auto;
    align-items: center;
    gap: 10px;
    margin-bottom: 18px;
  }
  .search { max-width: none; }
  .sort-toggle { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
  .sort-toggle .btn-ghost { min-width: 64px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .stat {
    background: rgba(255, 249, 238, .9);
    border: 1px solid rgba(91, 92, 55, .16);
    border-radius: 8px;
    padding: 18px;
    box-shadow: 0 14px 32px rgba(78, 58, 36, .07);
  }
  .stat.primary { border-color: rgba(184, 100, 56, .34); background: linear-gradient(180deg, rgba(255, 249, 238, .96), rgba(246, 232, 211, .9)); }
  .stat-label { color: #6f6c52; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0; }
  .stat-value { font-size: 36px; font-weight: 900; line-height: 1.1; margin-top: 6px; }
  .chart {
    height: 320px;
    margin: 8px 0 24px;
    padding: 14px 10px 8px;
    background: rgba(255, 249, 238, .64);
    border: 1px solid rgba(91, 92, 55, .12);
    border-radius: 8px;
  }
  .section-header { margin: 26px 0 12px; justify-content: space-between; }
  .section-title { color: #454b2c; font-size: 19px; font-weight: 900; text-transform: uppercase; letter-spacing: 0; }
  .section-meta { display: flex; gap: 8px; flex-wrap: wrap; }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #6f6c52;
    background: rgba(244, 235, 220, .82);
    border: 1px solid rgba(91, 92, 55, .12);
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
  }
  .badge.top { color: #45522f; background: rgba(88, 104, 57, .13); border-color: rgba(88, 104, 57, .24); }
  .badge.out { color: #6f6c52; background: rgba(244, 235, 220, .82); }
  .badge.warning, .badge.upcoming { color: #9a5a2f; background: rgba(184, 100, 56, .12); border-color: rgba(184, 100, 56, .24); }
  .badge.manual { color: #9a5a2f; background: rgba(221, 174, 111, .22); border-color: rgba(184, 100, 56, .28); }
  .badge.danger { color: #963d32; background: rgba(150, 61, 50, .1); border-color: rgba(150, 61, 50, .22); }
  .badge.history { color: #6f6c52; background: rgba(111, 108, 82, .1); }
  .table-wrap { overflow-x: auto; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 12px 14px; text-align: left; white-space: nowrap; border-bottom: 1px solid rgba(91, 92, 55, .12); }
  th { color: #6f6c52; font-size: 12px; text-transform: uppercase; letter-spacing: 0; background: rgba(239, 228, 209, .88); }
  tr:last-child td { border-bottom: 0; }
  tbody tr:nth-child(even) td { background: rgba(244, 235, 220, .42); }
  tbody tr:nth-child(odd) td { background: rgba(255, 252, 245, .38); }
  tbody tr:hover td { background: rgba(255, 255, 255, .28); }
  .manual-row td { background: rgba(221, 174, 111, .12); }
  .manual-row td:first-child { box-shadow: inset 3px 0 0 #b86438; }
  .dim { color: #716b56; }
  .points { color: #4e6136; font-weight: 900; }
  .points-out { color: #b86438; font-weight: 900; }
  .points-lost { color: #9b3b31; font-weight: 900; }
  .cat { display: inline-block; min-width: 34px; border-radius: 6px; padding: 2px 8px; text-align: center; color: #454b2c; background: rgba(88, 104, 57, .1); font-weight: 900; font-size: 12px; }
  .row-badges, .row-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .empty { padding: 32px; color: #716b56; text-align: center; }
  .auth-shell { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
  .auth-panel { width: min(460px, 100%); background: rgba(255, 249, 238, .9); border: 1px solid rgba(91, 92, 55, .16); border-radius: 8px; padding: 26px; box-shadow: 0 22px 54px rgba(78, 58, 36, .12); }
  .auth-brand { display: grid; justify-items: center; gap: 10px; margin-bottom: 22px; text-align: center; }
  .auth-brand img { width: 164px; max-width: 100%; mix-blend-mode: multiply; }
  .auth-title { color: #454b2c; font-family: Georgia, "Times New Roman", serif; font-size: 30px; font-weight: 700; }
  .auth-subtitle { color: #8a5a38; font-size: 13px; font-weight: 800; text-transform: uppercase; }
  .auth-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 18px; }
  .auth-tabs button { border-radius: 8px; border: 1px solid rgba(91, 92, 55, .18); background: rgba(244, 235, 220, .55); color: #454b2c; padding: 10px; font-weight: 800; }
  .auth-tabs button.active { background: rgba(184, 100, 56, .13); border-color: rgba(184, 100, 56, .34); color: #a9532f; }
  .auth-form { display: grid; gap: 13px; }
  .admin-panel .section-header { margin-top: 0; }
  .admin-table { overflow-x: auto; }
  .admin-note { color: #716b56; font-size: 13px; margin-top: -8px; margin-bottom: 14px; }
  @media (max-width: 760px) {
    .header { align-items: flex-start; flex-direction: column; }
    .header-actions, .sync-status { justify-content: flex-start; text-align: left; }
    .account-menu { left: 0; right: auto; }
    .brand-mark { width: 62px; height: 42px; }
    .stat-value { font-size: 30px; }
    .filters { grid-template-columns: 1fr; }
    .sort-toggle { width: 100%; }
    .sort-toggle .btn-ghost { flex: 1; }
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

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || "null");
  } catch {
    return null;
  }
}

function storeSession({ token, expiresAt, user }) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_EXPIRES_KEY, expiresAt);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function clearStoredSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_EXPIRES_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

function Stat({ label, value, primary, danger }) {
  return (
    <div className={`stat ${primary ? "primary" : ""}`}>
      <div className="stat-label">{label}</div>
      <div
        className="stat-value"
        style={{ color: primary ? "#4e6136" : danger ? "#9b3b31" : undefined }}
      >
        {value}
      </div>
    </div>
  );
}

function AuthScreen({
  mode,
  form,
  loading,
  feedback,
  onMode,
  onChange,
  onSubmit,
}) {
  const isRegister = mode === "register";

  return (
    <div className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <img src={LOGO} alt="" />
          <div>
            <div className="auth-title">Dashboard classement padel</div>
            <div className="auth-subtitle">Classement FFT</div>
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={mode === "login" ? "active" : ""}
            type="button"
            onClick={() => onMode("login")}
          >
            Connexion
          </button>
          <button
            className={isRegister ? "active" : ""}
            type="button"
            onClick={() => onMode("register")}
          >
            Creation
          </button>
        </div>

        {feedback && (
          <div className={`feedback ${feedback.type}`}>{feedback.msg}</div>
        )}

        <div className="auth-form">
          {isRegister && (
            <>
              <label>
                Nom
                <input
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  autoComplete="name"
                />
              </label>
              <label>
                ID TenUp
                <input
                  name="tenupId"
                  value={form.tenupId}
                  onChange={onChange}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="ex: 7146157482"
                />
              </label>
              <label>
                Licence FFT
                <input
                  name="licence"
                  value={form.licence}
                  onChange={onChange}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="ex: 123456789"
                />
              </label>
            </>
          )}
          <label>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={onChange}
              autoComplete="email"
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={onChange}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
              }}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </label>
          <button
            className="btn-primary"
            type="button"
            onClick={onSubmit}
            disabled={loading}
          >
            {loading
              ? "Traitement..."
              : isRegister
                ? "Creer le compte"
                : "Se connecter"}
          </button>
        </div>
      </section>
    </div>
  );
}

function AccountSwitcher({
  account,
  accounts,
  isAdmin,
  loading,
  open,
  onToggle,
  onSelect,
}) {
  const label = account?.name || account?.email || "Compte";

  if (!isAdmin) {
    return <span className="user-chip">{label}</span>;
  }

  return (
    <div className="account-switcher">
      <button
        className="user-chip user-chip-button"
        type="button"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>{label}</span>
        <span className="chip-caret">changer</span>
      </button>

      {open && (
        <div className="account-menu" role="menu">
          <div className="account-menu-title">Basculer vers</div>
          {loading && (
            <div className="account-menu-empty">Chargement des comptes...</div>
          )}
          {!loading && accounts.length === 0 && (
            <div className="account-menu-empty">Aucun compte approuve.</div>
          )}
          {!loading &&
            accounts.map((user) => (
              <button
                key={user.id}
                className={`account-option ${
                  user.id === account?.id ? "active" : ""
                }`}
                type="button"
                onClick={() => onSelect(user)}
                role="menuitem"
              >
                <span className="account-name">
                  {user.name || user.email}
                </span>
                <span className="account-meta">
                  {[
                    user.tenupId ? `ID TenUp ${user.tenupId}` : "",
                    user.licence ? `Licence ${user.licence}` : "",
                  ].filter(Boolean).join(" - ") || user.email}
                  {user.role === "admin" ? " - admin" : ""}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function RowBadges({ tournament, topRows, kind }) {
  const isTop12 = topRows.includes(tournament);
  let status;

  if (kind === "current")
    status = <span className="badge warning">mois courant</span>;
  else if (kind === "upcoming")
    status = <span className="badge upcoming">a venir</span>;
  else if (kind === "expiring")
    status = <span className="badge danger">expire ce mois</span>;
  else if (kind === "history")
    status = <span className="badge history">historique</span>;
  else if (isTop12) status = <span className="badge top">top 12</span>;
  else status = <span className="badge out">hors top 12</span>;

  return (
    <>
      {tournament.manuel === true && (
        <span className="badge manual">en attente FFT</span>
      )}
      {status}
    </>
  );
}

function TournamentTable({
  rows,
  topRows = [],
  kind = "active",
  onEdit,
  onDelete,
  canManage = false,
  deletingId = null,
}) {
  if (!rows.length)
    return (
      <div className="table-wrap">
        <div className="empty">Aucun tournoi trouve</div>
      </div>
    );

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
            <th>Licence</th>
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
              <tr
                key={t.id || `${t.date}-${t.nom}-${index}`}
                className={t.manuel === true ? "manual-row" : ""}
              >
                <td className="dim">{t.date}</td>
                <td>{t.nom}</td>
                <td>
                  <div className="row-badges">
                    <RowBadges tournament={t} topRows={topRows} kind={kind} />
                  </div>
                </td>
                <td>
                  <span className="cat">{t.categorie}</span>
                </td>
                <td className="dim">{t.licence || "-"}</td>
                <td className="dim">{t.partenaire}</td>
                <td className="dim">{t.classement}e</td>
                <td>
                  <span
                    className={
                      isLost ? "points-lost" : isTop12 ? "points" : "points-out"
                    }
                  >
                    {t.point}
                  </span>
                </td>
                {canManage && (
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn-secondary btn-small"
                        type="button"
                        onClick={() => onEdit(t)}
                        disabled={deletingId === t.id}
                      >
                        Modifier
                      </button>
                      <button
                        className="btn-danger btn-small"
                        type="button"
                        onClick={() => onDelete(t)}
                        disabled={deletingId === t.id}
                      >
                        {deletingId === t.id ? "..." : "Supprimer"}
                      </button>
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

function AdminUsersPanel({ users, loading, feedback, onRefresh, onApprove }) {
  return (
    <section className="panel admin-panel">
      <div className="section-header">
        <div className="section-title">Comptes a valider</div>
        <button
          className="btn-secondary btn-small"
          type="button"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? "Chargement..." : "Rafraichir"}
        </button>
      </div>
      <div className="admin-note">
        Les nouveaux utilisateurs ne peuvent acceder a leurs donnees qu'apres
        validation.
      </div>
      {feedback && (
        <div className={`feedback ${feedback.type}`}>{feedback.msg}</div>
      )}
      {users.length === 0 ? (
        <div className="empty">Aucun compte en attente.</div>
      ) : (
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>ID TenUp</th>
                <th>Licence</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td className="dim">{user.email}</td>
                  <td className="dim">{user.tenupId}</td>
                  <td className="dim">{user.licence || "-"}</td>
                  <td>
                    <button
                      className="btn-primary btn-small"
                      type="button"
                      onClick={() => onApprove(user)}
                      disabled={loading}
                    >
                      Valider
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ProfilePanel({ user, form, saving, feedback, onChange, onSubmit }) {
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <div className="section-title">Mon profil</div>
          <div className="admin-note">
            La licence FFT sert a relier automatiquement TenUp App et Padel Manager.
          </div>
        </div>
        <button
          className="btn-primary btn-small"
          type="button"
          onClick={onSubmit}
          disabled={saving}
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
      {feedback && (
        <div className={`feedback ${feedback.type}`}>{feedback.msg}</div>
      )}
      <div className="form-grid">
        <label>
          Nom
          <input name="name" value={form.name} onChange={onChange} />
        </label>
        <label>
          Email
          <input value={user?.email || ""} readOnly />
        </label>
        <label>
          ID TenUp
          <input
            name="tenupId"
            value={form.tenupId}
            onChange={onChange}
            inputMode="numeric"
          />
        </label>
        <label>
          Licence FFT
          <input
            name="licence"
            value={form.licence}
            onChange={onChange}
            inputMode="numeric"
            placeholder="ex: 123456789"
          />
        </label>
      </div>
    </section>
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
  const [editingId, setEditingId] = useState(null);
  const [autoPoint, setAutoPoint] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState(EMPTY_AUTH_FORM);
  const [authFeedback, setAuthFeedback] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authToken, setAuthToken] = useState(
    () => localStorage.getItem(AUTH_TOKEN_KEY) || "",
  );
  const [authExpiresAt, setAuthExpiresAt] = useState(
    () => localStorage.getItem(AUTH_EXPIRES_KEY) || "",
  );
  const [authUser, setAuthUser] = useState(() => readStoredUser());
  const [pendingUsers, setPendingUsers] = useState([]);
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [adminFeedback, setAdminFeedback] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: "",
    tenupId: "",
    licence: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState(null);
  const [now] = useState(() => new Date());

  const isAuthenticated = Boolean(
    authToken &&
      authUser?.approved === true &&
      authExpiresAt &&
      Date.parse(authExpiresAt) > Date.now(),
  );
  const isAdminUser = authUser?.role === "admin";
  const availableAccounts = useMemo(() => {
    const byId = new Map();
    approvedUsers.forEach((user) => {
      if (user?.id) byId.set(user.id, user);
    });
    if (authUser?.id) byId.set(authUser.id, authUser);

    return Array.from(byId.values()).sort((a, b) => {
      if (a.id === authUser?.id) return -1;
      if (b.id === authUser?.id) return 1;
      return String(a.name || a.email || "").localeCompare(
        String(b.name || b.email || ""),
        "fr",
      );
    });
  }, [approvedUsers, authUser]);
  const activeUserId = isAdminUser
    ? selectedUserId || authUser?.id || null
    : authUser?.id || null;
  const activeAccount =
    availableAccounts.find((user) => user.id === activeUserId) || authUser;
  const scopedApiPath = useCallback(
    (path) => {
      const scope =
        isAdminUser && activeUserId
          ? `${path.includes("?") ? "&" : "?"}userId=${encodeURIComponent(
              activeUserId,
            )}`
          : "";
      return `${API}${path}${scope}`;
    },
    [activeUserId, isAdminUser],
  );

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    const expires = Date.parse(authExpiresAt || "");
    if (authToken && (!expires || expires <= Date.now())) {
      clearStoredSession();
      setAuthToken("");
      setAuthExpiresAt("");
      setAuthUser(null);
      setApprovedUsers([]);
      setSelectedUserId(null);
      setAccountMenuOpen(false);
    }
  }, [authToken, authExpiresAt]);

  useEffect(() => {
    setProfileForm({
      name: authUser?.name || "",
      tenupId: authUser?.tenupId || "",
      licence: authUser?.licence || "",
    });
    setProfileFeedback(null);
  }, [authUser?.id, authUser?.name, authUser?.tenupId, authUser?.licence]);

  useEffect(() => {
    if (!isAdminUser) {
      setApprovedUsers([]);
      setSelectedUserId(null);
      setAccountMenuOpen(false);
      return;
    }

    if (!selectedUserId && authUser?.id) {
      setSelectedUserId(authUser.id);
      return;
    }

    if (
      selectedUserId &&
      availableAccounts.length > 0 &&
      !availableAccounts.some((user) => user.id === selectedUserId)
    ) {
      setSelectedUserId(authUser?.id || null);
    }
  }, [availableAccounts, authUser?.id, isAdminUser, selectedUserId]);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;

    const closeMenu = (event) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest(".account-switcher")
      ) {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, [accountMenuOpen]);

  const loadTournois = useCallback(
    async ({ manual = false, silent = false } = {}) => {
      if (!isAuthenticated) {
        setTournois([]);
        setInitialLoading(false);
        return;
      }

      if (manual) setRefreshing(true);
      if (!manual && !silent) setInitialLoading(true);
      setLoadError(null);

      try {
        const res = await fetch(scopedApiPath("/tournois"), {
          cache: "no-store",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) {
          throw new Error(
            await readApiError(res, "Impossible de charger les tournois."),
          );
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
    },
    [authToken, isAuthenticated, scopedApiPath],
  );

  const loadPendingUsers = useCallback(async () => {
    if (!isAuthenticated || !authToken || !isAdminUser) {
      setPendingUsers([]);
      return;
    }

    setLoadingUsers(true);
    setAdminFeedback(null);
    try {
      const res = await fetch(`${API}/admin/users?status=pending`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        throw new Error(
          await readApiError(res, "Impossible de charger les comptes."),
        );
      }

      const data = await res.json();
      setPendingUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      setAdminFeedback({
        type: "error",
        msg: err.message || "Chargement des comptes impossible.",
      });
    } finally {
      setLoadingUsers(false);
    }
  }, [authToken, isAdminUser, isAuthenticated]);

  const loadApprovedUsers = useCallback(async () => {
    if (!isAuthenticated || !authToken || !isAdminUser) {
      setApprovedUsers([]);
      return;
    }

    setLoadingAccounts(true);
    try {
      const res = await fetch(`${API}/admin/users?status=approved`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        throw new Error(
          await readApiError(res, "Impossible de charger les comptes."),
        );
      }

      const data = await res.json();
      setApprovedUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      setAdminFeedback({
        type: "error",
        msg: err.message || "Chargement des comptes impossible.",
      });
    } finally {
      setLoadingAccounts(false);
    }
  }, [authToken, isAdminUser, isAuthenticated]);

  useEffect(() => {
    loadTournois();
  }, [loadTournois]);

  useEffect(() => {
    loadPendingUsers();
  }, [loadPendingUsers]);

  useEffect(() => {
    loadApprovedUsers();
  }, [loadApprovedUsers]);

  useEffect(() => {
    if (!autoPoint) return;
    if (form.type && form.tranche && form.classement) {
      const pts = getPoints(
        form.type,
        form.tranche,
        parseInt(form.classement, 10),
      );
      setForm((f) => ({ ...f, point: pts !== "" ? String(pts) : f.point }));
    }
  }, [autoPoint, form.type, form.tranche, form.classement]);

  useEffect(() => {
    if (form.date) setForm((f) => ({ ...f, validite: getValidite(f.date) }));
  }, [form.date]);

  useEffect(() => {
    const tranches = TRANCHES[form.type] || [];
    if (!tranches.includes(form.tranche))
      setForm((f) => ({ ...f, tranche: tranches[0] || "" }));
  }, [form.type, form.tranche]);

  const submitAuth = async () => {
    const email = authForm.email.trim();
    const password = authForm.password;
    const name = authForm.name.trim();
    const tenupId = authForm.tenupId.trim();
    const licence = authForm.licence.trim();

    if (
      !email ||
      !password ||
      (authMode === "register" && (!name || !tenupId))
    ) {
      setAuthFeedback({
        type: "error",
        msg: "Merci de remplir tous les champs.",
      });
      return;
    }

    setAuthLoading(true);
    setAuthFeedback(null);
    try {
      const endpoint = authMode === "register" ? "register" : "login";
      const payload =
        authMode === "register"
          ? { name, email, password, tenupId, licence }
          : { email, password };
      const res = await fetch(`${API}/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await readApiError(res, "Connexion refusee."));
      }

      const data = await res.json();
      if (!data.token) {
        clearStoredSession();
        setAuthToken("");
        setAuthExpiresAt("");
        setAuthUser(null);
        setAuthMode("login");
        setAuthForm({ ...EMPTY_AUTH_FORM, email });
        setAuthFeedback({
          type: "success",
          msg:
            data.message ||
            "Compte cree. Il doit etre valide par un admin avant connexion.",
        });
        return;
      }

      storeSession(data);
      setAuthToken(data.token);
      setAuthExpiresAt(data.expiresAt);
      setAuthUser(data.user);
      setSelectedUserId(data.user?.role === "admin" ? data.user.id : null);
      setAuthForm(EMPTY_AUTH_FORM);
      setFeedback({
        type: "success",
        msg: authMode === "register" ? "Compte cree." : "Connexion reussie.",
      });
    } catch (err) {
      setAuthFeedback({
        type: "error",
        msg: err.message || "Connexion impossible.",
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const logoutUser = () => {
    clearStoredSession();
    setAuthToken("");
    setAuthExpiresAt("");
    setAuthUser(null);
    setTournois([]);
    setPendingUsers([]);
    setApprovedUsers([]);
    setSelectedUserId(null);
    setAccountMenuOpen(false);
    setAdminFeedback(null);
    setShowForm(false);
    setEditingId(null);
    setFeedback(null);
    setAuthFeedback({ type: "success", msg: "Session fermee." });
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setAutoPoint(true);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
    setFeedback(null);
  };

  const switchAccount = (user) => {
    if (!user?.id) return;
    setSelectedUserId(user.id);
    setAccountMenuOpen(false);
    setShowForm(false);
    resetForm();
    setFeedback({
      type: "success",
      msg: `Compte actif : ${user.name || user.email || user.tenupId}.`,
    });
  };

  const startEdit = (tournament) => {
    setEditingId(tournament.id);
    setAutoPoint(false);
    setForm({
      ...EMPTY_FORM,
      date: toInputDate(tournament.date),
      nom: tournament.nom || "",
      categorie: tournament.categorie || "DM",
      licence: tournament.licence || "",
      partenaire: tournament.partenaire || "",
      classement: String(tournament.classement || ""),
      point: String(tournament.point || ""),
      validite: tournament.validite || "",
      manuel: tournament.manuel === true,
    });
    setShowForm(true);
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteTournament = async (tournament) => {
    if (!window.confirm(`Supprimer "${tournament.nom}" ?`)) return;

    setDeletingId(tournament.id);
    setFeedback(null);
    try {
      const res = await fetch(scopedApiPath(`/tournois/${tournament.id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!res.ok)
        throw new Error(await readApiError(res, "Suppression impossible."));

      await loadTournois({ silent: true });
      setFeedback({ type: "success", msg: "Tournoi supprime." });
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err.message || "Suppression impossible.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const approveUser = async (user) => {
    setLoadingUsers(true);
    setAdminFeedback(null);
    try {
      const res = await fetch(`${API}/admin/users/${user.id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!res.ok)
        throw new Error(await readApiError(res, "Validation impossible."));

      await loadPendingUsers();
      await loadApprovedUsers();
      setAdminFeedback({
        type: "success",
        msg: `Compte valide pour ${user.name}.`,
      });
    } catch (err) {
      setAdminFeedback({
        type: "error",
        msg: err.message || "Validation impossible.",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const {
    actifsClassement,
    tournoisMoisCourant,
    tournoisExpirants,
    historique,
    tournoisAVenir,
  } = getDashboardBuckets(tournois, now);

  const filtered = actifsClassement.filter((t) => {
    const matchesCategory = categorie === "all" || t.categorie === categorie;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      t.nom?.toLowerCase().includes(q) ||
      t.licence?.toLowerCase().includes(q) ||
      t.partenaire?.toLowerCase().includes(q);
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
  const totalPoints = meilleurs.reduce(
    (sum, t) => sum + Number(t.point || 0),
    0,
  );
  const moyennePoints = meilleurs.length
    ? Math.round(totalPoints / meilleurs.length)
    : 0;
  const bestScore = actifsClassement.length
    ? Math.max(...actifsClassement.map((t) => Number(t.point || 0)))
    : 0;
  const pointsPerdus = tournoisExpirants.reduce(
    (sum, t) => sum + Number(t.point || 0),
    0,
  );
  const months = useMemo(() => {
    const start = startOfMonth(addMonths(now, -11));
    return Array.from({ length: 24 }, (_, i) => {
      const date = addMonths(start, i);
      return { date, label: formatMonthLabel(date) };
    });
  }, [now]);

  const normalized = useMemo(() => normalizeTournois(tournois), [tournois]);
  const chartData = useMemo(
    () => buildChartData(months, normalized, now),
    [months, normalized, now],
  );
  const nextMonthLabel = formatMonthLabel(startOfMonth(addMonths(now, 1)));
  const pointsSimules =
    chartData.find((point) => point.month === nextMonthLabel)?.simule ?? 0;
  const tranchesDisponibles = TRANCHES[form.type] || [];
  const pointsPreview =
    form.type && form.tranche && form.classement
      ? getPoints(form.type, form.tranche, parseInt(form.classement, 10))
      : null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "point") setAutoPoint(false);
    if (["type", "tranche", "classement"].includes(name)) setAutoPoint(true);
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async () => {
    if (
      !form.date ||
      !form.nom ||
      !form.partenaire ||
      !form.classement ||
      !form.point
    ) {
      setFeedback({
        type: "error",
        msg: "Merci de remplir tous les champs obligatoires.",
      });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const method = editingId ? "PUT" : "POST";
      const url = editingId
        ? scopedApiPath(`/tournois/${editingId}`)
        : scopedApiPath("/tournois");
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          date: form.date,
          nom: form.nom,
          categorie: form.categorie,
          licence: form.licence,
          partenaire: form.partenaire,
          classement: parseInt(form.classement, 10),
          point: parseInt(form.point, 10),
          validite: form.validite,
          manuel: editingId ? form.manuel === true : true,
        }),
      });

      if (!res.ok)
        throw new Error(await readApiError(res, "Enregistrement impossible."));

      await loadTournois({ silent: true });
      resetForm();
      setShowForm(false);
      setFeedback({
        type: "success",
        msg: editingId ? "Tournoi modifie." : "Tournoi ajoute.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err.message || "Enregistrement impossible.",
      });
    } finally {
      setSaving(false);
    }
  };

  const cancelForm = () => {
    resetForm();
    setShowForm(false);
  };

  const handleAuthMode = (mode) => {
    setAuthMode(mode);
    setAuthFeedback(null);
  };

  const handleAuthChange = (e) => {
    const { name, value } = e.target;
    setAuthForm((f) => ({ ...f, [name]: value }));
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((f) => ({ ...f, [name]: value }));
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileFeedback(null);
    try {
      const res = await fetch(`${API}/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(profileForm),
      });

      if (!res.ok)
        throw new Error(await readApiError(res, "Profil impossible a mettre a jour."));

      const data = await res.json();
      storeSession(data);
      setAuthToken(data.token);
      setAuthExpiresAt(data.expiresAt);
      setAuthUser(data.user);
      setApprovedUsers((users) =>
        users.map((user) => (user.id === data.user.id ? data.user : user)),
      );
      setProfileFeedback({ type: "success", msg: "Profil mis a jour." });
    } catch (err) {
      setProfileFeedback({
        type: "error",
        msg: err.message || "Profil impossible a mettre a jour.",
      });
    } finally {
      setProfileSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <AuthScreen
        mode={authMode}
        form={authForm}
        loading={authLoading}
        feedback={authFeedback}
        onMode={handleAuthMode}
        onChange={handleAuthChange}
        onSubmit={submitAuth}
      />
    );
  }

  return (
    <div className="tenup-app">
      <header className="header">
        <div className="brand">
          <img className="brand-mark" src={LOGO} alt="" />
          <div>
            <div className="logo">Dashboard classement padel</div>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="btn-secondary"
            type="button"
            onClick={() => loadTournois({ manual: true })}
            disabled={refreshing}
          >
            {refreshing ? "Actualisation..." : "Rafraichir"}
          </button>
          <AccountSwitcher
            account={activeAccount}
            accounts={availableAccounts}
            isAdmin={isAdminUser}
            loading={loadingAccounts}
            open={accountMenuOpen}
            onToggle={() => setAccountMenuOpen((open) => !open)}
            onSelect={switchAccount}
          />
          <button className="btn-secondary" type="button" onClick={logoutUser}>
            Se deconnecter
          </button>
          <button
            className="btn-primary"
            type="button"
            onClick={showForm ? cancelForm : openCreateForm}
          >
            {showForm ? "Fermer" : "Ajouter un tournoi"}
          </button>
          <div className="sync-status">
            Derniere synchro : {formatSyncDate(lastLoadedAt)}
          </div>
        </div>
      </header>

      {feedback && (
        <div className={`feedback ${feedback.type}`}>{feedback.msg}</div>
      )}

      {loadError && (
        <div className="feedback error load-error">
          <div>
            <div className="feedback-title">Chargement impossible</div>
            <div className="feedback-text">
              {loadError}
              {tournois.length
                ? " Les dernieres donnees chargees restent affichees."
                : ""}
            </div>
          </div>
          <button
            className="btn-secondary"
            type="button"
            onClick={() => loadTournois({ manual: true })}
            disabled={refreshing}
          >
            Reessayer
          </button>
        </div>
      )}

      <ProfilePanel
        user={authUser}
        form={profileForm}
        saving={profileSaving}
        feedback={profileFeedback}
        onChange={handleProfileChange}
        onSubmit={saveProfile}
      />

      {isAdminUser && (
        <AdminUsersPanel
          users={pendingUsers}
          loading={loadingUsers}
          feedback={adminFeedback}
          onRefresh={loadPendingUsers}
          onApprove={approveUser}
        />
      )}

      {showForm && (
        <section className="panel">
          <div className="panel-title">
            {editingId ? "Modifier le tournoi" : "Nouveau tournoi"}
          </div>
          <div className="form-grid">
            <label>
              Date *
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
              />
            </label>
            <label>
              Nom du tournoi *
              <input
                name="nom"
                value={form.nom}
                onChange={handleChange}
                placeholder="ex: P250 HOMMES"
              />
            </label>
            <label>
              Type
              <select name="type" value={form.type} onChange={handleChange}>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Nombre de paires
              <select
                name="tranche"
                value={form.tranche}
                onChange={handleChange}
              >
                {tranchesDisponibles.map((t) => (
                  <option key={t} value={t}>
                    {t} paires
                  </option>
                ))}
              </select>
            </label>
            <label>
              Categorie
              <select
                name="categorie"
                value={form.categorie}
                onChange={handleChange}
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Licence FFT
              <input
                name="licence"
                value={form.licence}
                onChange={handleChange}
                placeholder="Licence du joueur"
              />
            </label>
            <label>
              Partenaire *
              <input
                name="partenaire"
                value={form.partenaire}
                onChange={handleChange}
                placeholder="Prenom NOM"
              />
            </label>
            <label>
              Place finale *
              <input
                type="number"
                min="1"
                name="classement"
                value={form.classement}
                onChange={handleChange}
              />
            </label>
            <label>
              Points FFT
              <input
                type="number"
                name="point"
                value={form.point}
                onChange={handleChange}
              />
              {pointsPreview !== "" && pointsPreview != null && (
                <span className="hint">{pointsPreview} pts calcules</span>
              )}
            </label>
            <label>
              Validite
              <input
                name="validite"
                value={form.validite}
                onChange={handleChange}
                readOnly
              />
            </label>
          </div>
          <div className="actions">
            <button
              className="btn-primary"
              type="button"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving
                ? "Enregistrement..."
                : editingId
                  ? "Enregistrer"
                  : "Ajouter"}
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={cancelForm}
            >
              Annuler
            </button>
          </div>
        </section>
      )}

      <section className="stats">
        <Stat label="Points classement" value={totalPoints} primary />
        <Stat label="Tournois actifs" value={sorted.length} />
        <Stat label="Meilleur score" value={bestScore} />
        <Stat label="Moy. Top 12" value={moyennePoints} />
        <Stat
          label="Classement simule"
          value={pointsSimules}
          primary={pointsSimules >= totalPoints}
          danger={pointsSimules < totalPoints}
        />
      </section>

      <div className="chart">
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <XAxis dataKey="month" interval={2} />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="real"
              name="Classement reel"
              stroke="#4e6136"
              strokeWidth={3}
              dot
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="simule"
              name="Classement simule"
              stroke="#b86438"
              strokeDasharray="6 6"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="filters">
        <input
          className="search"
          placeholder="Rechercher tournoi ou partenaire"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={categorie}
          onChange={(e) => setCategorie(e.target.value)}
        >
          <option value="all">Toutes categories</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={tri} onChange={(e) => setTri(e.target.value)}>
          <option value="points">Trier par points</option>
          <option value="date">Trier par date</option>
        </select>
        <div className="sort-toggle">
          <button
            className={`btn-ghost ${!ordreAscendant ? "active" : ""}`}
            type="button"
            onClick={() => setOrdreAscendant(false)}
          >
            Desc
          </button>
          <button
            className={`btn-ghost ${ordreAscendant ? "active" : ""}`}
            type="button"
            onClick={() => setOrdreAscendant(true)}
          >
            Asc
          </button>
        </div>
      </div>

      {initialLoading ? (
        <div className="table-wrap">
          <div className="empty">Chargement des tournois...</div>
        </div>
      ) : (
        <>
          <div className="section-header">
            <div className="section-title">Tournois en cours de validite</div>
            <div className="section-meta">
              <span className="badge">{sorted.length} resultats</span>
              <span className="badge top">{meilleurs.length} top 12</span>
            </div>
          </div>
          <TournamentTable
            rows={sorted}
            topRows={meilleurs}
            kind="active"
            canManage={isAuthenticated}
            onEdit={startEdit}
            onDelete={deleteTournament}
            deletingId={deletingId}
          />

          {tournoisAVenir.length > 0 && (
            <>
              <div className="section-header">
                <div className="section-title">Tournois a venir</div>
                <div className="section-meta">
                  <span className="badge upcoming">
                    {tournoisAVenir.length}
                  </span>
                </div>
              </div>
              <TournamentTable
                rows={[...tournoisAVenir].sort(
                  (a, b) => parseDate(a.date) - parseDate(b.date),
                )}
                kind="upcoming"
                canManage={isAuthenticated}
                onEdit={startEdit}
                onDelete={deleteTournament}
                deletingId={deletingId}
              />
            </>
          )}

          {tournoisExpirants.length > 0 && (
            <>
              <div className="section-header">
                <div className="section-title">
                  Expirent fin{" "}
                  {now.toLocaleDateString("fr-FR", { month: "long" })}
                </div>
                <div className="section-meta">
                  <span className="badge danger">-{pointsPerdus} pts</span>
                </div>
              </div>
              <TournamentTable
                rows={tournoisExpirants}
                kind="expiring"
                canManage={isAuthenticated}
                onEdit={startEdit}
                onDelete={deleteTournament}
                deletingId={deletingId}
              />
            </>
          )}

          {tournoisMoisCourant.length > 0 && (
            <>
              <div className="section-header">
                <div className="section-title">Tournois du mois</div>
                <span className="badge warning">
                  {tournoisMoisCourant.length}
                </span>
              </div>
              <TournamentTable
                rows={tournoisMoisCourant}
                kind="current"
                canManage={isAuthenticated}
                onEdit={startEdit}
                onDelete={deleteTournament}
                deletingId={deletingId}
              />
            </>
          )}

          {historique.length > 0 && (
            <>
              <div className="section-header">
                <div className="section-title dim">Historique</div>
                <span className="badge history">{historique.length}</span>
              </div>
              <TournamentTable
                rows={[...historique].sort(
                  (a, b) => parseDate(b.date) - parseDate(a.date),
                )}
                kind="history"
                canManage={isAuthenticated}
                onEdit={startEdit}
                onDelete={deleteTournament}
                deletingId={deletingId}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
