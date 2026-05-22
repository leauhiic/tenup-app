import { useEffect, useState } from "react";

const API = "https://tenup-app-production.up.railway.app";

// ─────────────────────────────────────────────────────────────
// BARÈME FFT MARS 2026
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

// ─── CSS global injecté ───────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #0a0c0f;
    color: #e8eaed;
    font-family: 'Barlow', sans-serif;
    min-height: 100vh;
  }

  :root {
    --accent: #00e676;
    --accent-dim: #00c85a;
    --accent-glow: rgba(0,230,118,0.15);
    --surface: #13161b;
    --surface2: #1a1e25;
    --surface3: #22272f;
    --border: rgba(255,255,255,0.07);
    --text: #e8eaed;
    --text-dim: #8a909a;
    --red: #ff4d6d;
    --red-dim: rgba(255,77,109,0.12);
    --yellow: #ffd166;
  }

  .tenup-app {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px 60px;
  }

  /* HEADER */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 32px 0 28px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 32px;
  }
  .header-left { display: flex; align-items: baseline; gap: 12px; }
  .header-logo {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 36px;
    letter-spacing: -1px;
    color: var(--text);
  }
  .header-logo span { color: var(--accent); }
  .header-subtitle {
    font-size: 13px;
    color: var(--text-dim);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  /* BOUTONS */
  .btn-primary {
    background: var(--accent);
    color: #000;
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;
    white-space: nowrap;
  }
  .btn-primary:hover { background: var(--accent-dim); box-shadow: 0 0 20px var(--accent-glow); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary {
    background: var(--surface3);
    color: var(--text-dim);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 20px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-secondary:hover { background: var(--surface2); color: var(--text); }

  .btn-ghost {
    background: transparent;
    color: var(--text-dim);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 14px;
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-ghost:hover { background: var(--surface3); color: var(--text); border-color: rgba(255,255,255,0.15); }
  .btn-ghost.active { background: var(--accent-glow); color: var(--accent); border-color: var(--accent); }

  /* FEEDBACK */
  .feedback {
    padding: 12px 18px;
    border-radius: 10px;
    margin-bottom: 20px;
    font-weight: 600;
    font-size: 14px;
  }
  .feedback.success { background: rgba(0,230,118,0.1); color: var(--accent); border: 1px solid rgba(0,230,118,0.3); }
  .feedback.error { background: var(--red-dim); color: var(--red); border: 1px solid rgba(255,77,109,0.3); }

  /* FORMULAIRE */
  .form-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 28px;
    margin-bottom: 28px;
    position: relative;
    overflow: hidden;
  }
  .form-panel::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--accent), transparent);
  }
  .form-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 22px;
    letter-spacing: 0.02em;
    color: var(--text);
    margin-bottom: 24px;
  }
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
  }
  .form-field { display: flex; flex-direction: column; gap: 6px; }
  .form-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .form-input, .form-select {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--text);
    font-family: 'Barlow', sans-serif;
    font-size: 14px;
    transition: border-color 0.15s, box-shadow 0.15s;
    outline: none;
  }
  .form-input:focus, .form-select:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }
  .form-input::placeholder { color: var(--text-dim); }
  .form-select option { background: #1a1e25; }
  .form-hint { font-size: 11px; color: var(--text-dim); }
  .form-hint.accent { color: var(--accent); font-weight: 600; }
  .form-actions { display: flex; gap: 10px; margin-top: 24px; }
  .points-highlight {
    background: var(--accent-glow);
    border: 1px solid rgba(0,230,118,0.3);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
    margin-top: 4px;
  }

  /* FILTRES */
  .filters {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
    flex-wrap: wrap;
    align-items: center;
  }
  .filter-search {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 9px 14px;
    color: var(--text);
    font-family: 'Barlow', sans-serif;
    font-size: 14px;
    outline: none;
    width: 240px;
    transition: border-color 0.15s;
  }
  .filter-search:focus { border-color: var(--accent); }
  .filter-search::placeholder { color: var(--text-dim); }
  .filter-select {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 9px 12px;
    color: var(--text);
    font-family: 'Barlow', sans-serif;
    font-size: 14px;
    outline: none;
    cursor: pointer;
  }
  .filter-select option { background: #1a1e25; }

  /* CARDS STATS */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    margin-bottom: 28px;
  }
  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 20px;
    position: relative;
    overflow: hidden;
    transition: border-color 0.2s;
  }
  .stat-card:hover { border-color: rgba(255,255,255,0.15); }
  .stat-card.primary { border-color: rgba(0,230,118,0.3); }
  .stat-card.primary::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 2px;
    background: var(--accent);
  }
  .stat-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-dim);
    margin-bottom: 8px;
  }
  .stat-value {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 40px;
    line-height: 1;
    color: var(--text);
  }
  .stat-card.primary .stat-value { color: var(--accent); }

  /* SECTION TITLES */
  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  .section-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 20px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text);
  }
  .section-badge {
    background: var(--surface3);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 2px 10px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-dim);
  }
  .section-badge.accent { background: var(--accent-glow); border-color: rgba(0,230,118,0.3); color: var(--accent); }
  .section-badge.danger { background: var(--red-dim); border-color: rgba(255,77,109,0.3); color: var(--red); }

  /* TABLEAUX */
  .table-wrap {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
    margin-bottom: 36px;
  }
  .data-table { width: 100%; border-collapse: collapse; }
  .data-table thead th {
    background: var(--surface2);
    padding: 12px 16px;
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-dim);
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  .data-table tbody tr {
    border-bottom: 1px solid var(--border);
    transition: background 0.1s;
  }
  .data-table tbody tr:last-child { border-bottom: none; }
  .data-table tbody tr:hover { background: var(--surface2); }
  .data-table tbody td {
    padding: 13px 16px;
    font-size: 14px;
    color: var(--text);
    white-space: nowrap;
  }
  .data-table tbody td.dim { color: var(--text-dim); font-size: 13px; }

  .pts-top12 {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 17px;
    color: var(--accent);
  }
  .pts-out {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 17px;
    color: var(--text-dim);
  }
  .pts-lost {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 17px;
    color: var(--red);
  }

  .rank-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px; height: 28px;
    border-radius: 50%;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 13px;
    background: var(--surface3);
    color: var(--text-dim);
  }
  .rank-badge.gold { background: rgba(255,209,102,0.15); color: var(--yellow); }
  .rank-badge.silver { background: rgba(200,200,200,0.1); color: #c8c8c8; }
  .rank-badge.bronze { background: rgba(205,127,50,0.15); color: #cd7f32; }

  .cat-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    background: var(--surface3);
    color: var(--text-dim);
  }
  .cat-badge.DM { background: rgba(66,133,244,0.15); color: #4285f4; }
  .cat-badge.DX { background: rgba(255,167,38,0.15); color: #ffa726; }
  .cat-badge.DD { background: rgba(240,98,146,0.15); color: #f06292; }

  .validite-near { color: var(--red); font-weight: 600; }

  /* TABLE EXPIRÉS */
  .table-wrap.expired { opacity: 0.6; }
  .table-wrap.expired:hover { opacity: 0.85; transition: opacity 0.2s; }

  /* ALERTE POINTS PERDUS */
  .alert-bar {
    background: var(--red-dim);
    border: 1px solid rgba(255,77,109,0.25);
    border-radius: 10px;
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  .alert-bar-icon { font-size: 20px; }
  .alert-bar-text { font-size: 14px; color: var(--text); }
  .alert-bar-pts {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 28px;
    color: var(--red);
    margin-left: auto;
  }

  .empty-state {
    padding: 40px 20px;
    text-align: center;
    color: var(--text-dim);
    font-size: 14px;
  }

  /* Divider */
  .divider { height: 1px; background: var(--border); margin: 36px 0; }
`;

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
    const style = document.createElement("style");
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    fetch(`${API}/tournois`).then(r => r.json()).then(setTournois);
  }, []);

  useEffect(() => {
    if (form.type && form.tranche && form.classement) {
      const pts = getPoints(form.type, form.tranche, parseInt(form.classement));
      setForm(f => ({ ...f, point: pts !== "" ? String(pts) : f.point }));
    }
  }, [form.type, form.tranche, form.classement]);

  useEffect(() => {
    if (form.date) setForm(f => ({ ...f, validite: getValidite(f.date) }));
  }, [form.date]);

  useEffect(() => {
    const tranches = TRANCHES[form.type] || [];
    if (!tranches.includes(form.tranche)) setForm(f => ({ ...f, tranche: tranches[0] || "" }));
  }, [form.type]);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

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
          nom: form.nom, categorie: form.categorie,
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
      setFeedback({ type: "success", msg: "Tournoi ajouté avec succès !" });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: "error", msg: "Erreur : " + err.message });
    } finally {
      setLoading(false);
    }
  };

  const parseDate = s => {
    if (!s) return new Date(0);
    const [j, m, a] = s.split("/");
    return new Date(`${a}-${m}-${j}`);
  };

  const unAn = new Date();
  unAn.setFullYear(unAn.getFullYear() - 1);

  const actifs  = tournois.filter(t => parseDate(t.date) >= unAn);
  const expires = tournois.filter(t => parseDate(t.date) <  unAn);

  const filtered = actifs.filter(t =>
    (categorie === "all" || t.categorie === categorie) &&
    (t.nom?.toLowerCase().includes(search.toLowerCase()) ||
     t.partenaire?.toLowerCase().includes(search.toLowerCase()))
  );

  const sorted = [...filtered].sort((a, b) => {
    if (tri === "points") return ordreAscendant ? a.point - b.point : b.point - a.point;
    const da = parseDate(a.date), db = parseDate(b.date);
    return ordreAscendant ? da - db : db - da;
  });

  const meilleurs = [...sorted].sort((a, b) => b.point - a.point).slice(0, 12);
  const totalPoints = meilleurs.reduce((s, t) => s + (t.point || 0), 0);
  const moyennePoints = meilleurs.length > 0 ? Math.round(totalPoints / meilleurs.length) : 0;
  const bestScore = Math.max(...sorted.map(t => t.point || 0), 0);

  const today = new Date();
  const moisSuivant = new Date(today.getFullYear(), today.getMonth())
    .toLocaleDateString("fr-FR", { month: "short" }).toLowerCase()
    + "-" + String(today.getFullYear()).slice(-2);
  const tournoisPerdus = actifs.filter(t => t.validite?.toLowerCase().includes(moisSuivant));
  const pointsPerdus = tournoisPerdus.reduce((s, t) => s + (t.point || 0), 0);

  const tranchesDisponibles = TRANCHES[form.type] || [];
  const pointsPreview = form.type && form.tranche && form.classement
    ? getPoints(form.type, form.tranche, parseInt(form.classement)) : null;

  const rankBadge = (n) => {
    if (n === 1) return <span className="rank-badge gold">1</span>;
    if (n === 2) return <span className="rank-badge silver">2</span>;
    if (n === 3) return <span className="rank-badge bronze">3</span>;
    return <span className="rank-badge">{n}</span>;
  };

  return (
    <div className="tenup-app">

      {/* HEADER */}
      <header className="header">
        <div className="header-left">
          <div className="header-logo">TEN<span>UP</span></div>
          <div className="header-subtitle">Dashboard Padel · FFT 2026</div>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setFeedback(null); }}>
          {showForm ? "✕ Fermer" : "+ Ajouter un tournoi"}
        </button>
      </header>

      {/* FEEDBACK */}
      {feedback && (
        <div className={`feedback ${feedback.type}`}>
          {feedback.type === "success" ? "✓ " : "✕ "}{feedback.msg}
        </div>
      )}

      {/* FORMULAIRE */}
      {showForm && (
        <div className="form-panel">
          <div className="form-title">Nouveau tournoi</div>
          <div className="form-grid">

            <div className="form-field">
              <label className="form-label">Date *</label>
              <input className="form-input" type="date" name="date" value={form.date} onChange={handleChange} />
            </div>

            <div className="form-field">
              <label className="form-label">Nom du tournoi *</label>
              <input className="form-input" type="text" name="nom" value={form.nom} onChange={handleChange} placeholder="ex: P250 HOMMES" />
            </div>

            <div className="form-field">
              <label className="form-label">Type</label>
              <select className="form-select" name="type" value={form.type} onChange={handleChange}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label">Nombre de paires</label>
              <select className="form-select" name="tranche" value={form.tranche} onChange={handleChange}>
                {tranchesDisponibles.map(t => <option key={t} value={t}>{t} paires</option>)}
              </select>
              <span className="form-hint">Détermine les points FFT</span>
            </div>

            <div className="form-field">
              <label className="form-label">Catégorie</label>
              <select className="form-select" name="categorie" value={form.categorie} onChange={handleChange}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label">Partenaire *</label>
              <input className="form-input" type="text" name="partenaire" value={form.partenaire} onChange={handleChange} placeholder="Prénom NOM" />
            </div>

            <div className="form-field">
              <label className="form-label">Place finale *</label>
              <input className="form-input" type="number" name="classement" value={form.classement} onChange={handleChange} min="1" placeholder="ex: 3" />
            </div>

            <div className="form-field">
              <label className="form-label">Points FFT</label>
              <input className="form-input" type="number" name="point" value={form.point} onChange={handleChange} placeholder="Auto-calculé" />
              {pointsPreview !== "" && pointsPreview != null && (
                <div className="points-highlight">
                  {pointsPreview} pts · {form.type} · {form.tranche} paires · {form.classement}e
                </div>
              )}
            </div>

          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? "Envoi en cours…" : "Ajouter le tournoi"}
            </button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-label">Points classement</div>
          <div className="stat-value">{totalPoints}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tournois actifs</div>
          <div className="stat-value">{sorted.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Meilleur score</div>
          <div className="stat-value">{bestScore}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Moy. Top 12</div>
          <div className="stat-value">{moyennePoints}</div>
        </div>
        {pointsPerdus > 0 && (
          <div className="stat-card" style={{ borderColor: "rgba(255,77,109,0.3)" }}>
            <div className="stat-label" style={{ color: "var(--red)" }}>Perte ce mois</div>
            <div className="stat-value" style={{ color: "var(--red)" }}>−{pointsPerdus}</div>
          </div>
        )}
      </div>

      {/* FILTRES */}
      <div className="filters">
        <input className="filter-search" placeholder="🔍  Rechercher tournoi ou partenaire…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-select" onChange={e => setCategorie(e.target.value)}>
          <option value="all">Toutes catégories</option>
          <option value="DM">DM</option>
          <option value="DD">DD</option>
          <option value="DX">DX</option>
        </select>
        <select className="filter-select" value={tri} onChange={e => setTri(e.target.value)}>
          <option value="date">Trier par date</option>
          <option value="points">Trier par points</option>
        </select>
        <button className={`btn-ghost ${!ordreAscendant ? "active" : ""}`} onClick={() => setOrdreAscendant(false)}>↓ Déc.</button>
        <button className={`btn-ghost ${ordreAscendant ? "active" : ""}`} onClick={() => setOrdreAscendant(true)}>↑ Asc.</button>
      </div>

      {/* TABLEAU PRINCIPAL */}
      <div className="section-header">
        <div className="section-title">Tournois en cours de validité</div>
        <span className="section-badge accent">{sorted.length} résultats</span>
        <span className="section-badge" style={{ marginLeft: "auto", fontSize: 11 }}>🟢 top 12 · ⬜ hors top 12</span>
      </div>

      <div className="table-wrap">
        {sorted.length === 0 ? (
          <div className="empty-state">Aucun tournoi trouvé</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Place</th>
                <th>Date</th>
                <th>Tournoi</th>
                <th>Cat.</th>
                <th>Partenaire</th>
                <th>Classement</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, i) => {
                const isTop12 = meilleurs.includes(t);
                const isExpiringSoon = t.validite?.toLowerCase().includes(moisSuivant);
                return (
                  <tr key={i}>
                    <td>{rankBadge(i + 1)}</td>
                    <td className="dim">{t.date}</td>
                    <td style={{ fontWeight: 500 }}>{t.nom}</td>
                    <td><span className={`cat-badge ${t.categorie}`}>{t.categorie}</span></td>
                    <td className="dim">{t.partenaire}</td>
                    <td className="dim">{t.classement}e</td>
                    <td>
                      <span className={isTop12 ? "pts-top12" : "pts-out"}>{t.point}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ALERTE TOURNOIS PERDUS */}
      {tournoisPerdus.length > 0 && (
        <>
          <div className="section-header">
            <div className="section-title">Expirent ce mois-ci</div>
            <span className="section-badge danger">{tournoisPerdus.length} tournoi{tournoisPerdus.length > 1 ? "s" : ""}</span>
          </div>
          <div className="alert-bar">
            <span className="alert-bar-icon">⚠️</span>
            <span className="alert-bar-text">
              {tournoisPerdus.map(t => t.nom).join(", ")} sortiront du classement en fin de mois.
            </span>
            <span className="alert-bar-pts">−{pointsPerdus} pts</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Tournoi</th><th>Cat.</th><th>Partenaire</th><th>Points perdus</th></tr>
              </thead>
              <tbody>
                {tournoisPerdus.map((t, i) => (
                  <tr key={i}>
                    <td className="dim">{t.date}</td>
                    <td style={{ fontWeight: 500 }}>{t.nom}</td>
                    <td><span className={`cat-badge ${t.categorie}`}>{t.categorie}</span></td>
                    <td className="dim">{t.partenaire}</td>
                    <td><span className="pts-lost">{t.point}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ANCIENS TOURNOIS */}
      {expires.length > 0 && (
        <>
          <div className="divider" />
          <div className="section-header">
            <div className="section-title" style={{ color: "var(--text-dim)" }}>Historique</div>
            <span className="section-badge">{expires.length} tournoi{expires.length > 1 ? "s" : ""} hors classement</span>
          </div>
          <div className="table-wrap expired">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th><th>Tournoi</th><th>Cat.</th><th>Partenaire</th>
                  <th>Classement</th><th>Points</th><th>Validité</th>
                </tr>
              </thead>
              <tbody>
                {[...expires].sort((a, b) => parseDate(b.date) - parseDate(a.date)).map((t, i) => (
                  <tr key={i} style={{ opacity: 0.7 }}>
                    <td className="dim">{t.date}</td>
                    <td style={{ fontWeight: 500 }}>{t.nom}</td>
                    <td><span className={`cat-badge ${t.categorie}`}>{t.categorie}</span></td>
                    <td className="dim">{t.partenaire}</td>
                    <td className="dim">{t.classement}e</td>
                    <td><span className="pts-out">{t.point}</span></td>
                    <td className="dim">{t.validite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

    </div>
  );
}
