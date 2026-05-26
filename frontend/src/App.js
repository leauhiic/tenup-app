import { useEffect, useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import BAREME from "./bareme.json";

const API = "https://tenup-app-production.up.railway.app";

const TRANCHES = {
  P25: ["4-8","9-12","13-16","17-20","21-24","25-28"],
  P50: ["4-8","9-12","13-16","17-20","21-24","25-28","29-32"],
  P100: ["4-8","9-12","13-16","17-20","21-24","25-28","29-32"],
  P250: ["4-8","9-12","13-16","17-20","21-24","25-28","29-32"],
  P500: ["4-8","9-12","13-16","17-20","21-24","25-28","29-32"],
  P1000: ["4-8","9-12","13-16","17-20","21-24","25-28","29-32"],
  P1500: ["21-24","25-28","29-32"],
  P2000: ["21-24","25-28","29-32"],
};

const CATEGORIES = ["DM","DD","DX"];
const TYPES = ["P25","P50","P100","P250","P500","P1000","P1500","P2000"];

function parseDate(s) {
  if (!s) return new Date(0);

  if (s.includes("-")) return new Date(s);

  if (s.includes("/")) {
    const [j, m, a] = s.split("/");
    return new Date(`${a}-${m}-${j}`);
  }

  return new Date(0);
}

function getPoints(type, tranche, place) {
  const table = BAREME[type]?.[tranche];
  if (!table) return "";
  const pts = table[place - 1];
  return pts != null ? pts : "";
}

const EMPTY_FORM = {
  date: "", nom: "", type: "P250", tranche: "17-20",
  categorie: "DM", partenaire: "", classement: "", point: "", validite: "",
};

export default function App() {
  const [tournois, setTournois] = useState([]);

  // ─────────────────────────────
  // DATA LOAD
  // ─────────────────────────────
  useEffect(() => {
    fetch(`${API}/tournois`)
      .then(r => r.json())
      .then(data => setTournois(Array.isArray(data) ? data : data.tournois || []));
  }, []);

  // ─────────────────────────────
  // TOP 12 GLOBAL (actuel)
  // ─────────────────────────────
  const top12Current = useMemo(() => {
    const sorted = [...tournois]
      .map(t => ({
        ...t,
        dateObj: parseDate(t.date),
        point: Number(t.point || 0)
      }))
      .sort((a, b) => b.point - a.point);

    return sorted.slice(0, 12);
  }, [tournois]);

  const totalPoints = top12Current.reduce((s, t) => s + t.point, 0);

  // ─────────────────────────────
  // PROGRESSION TOP12 MENSUELLE
  // ─────────────────────────────
  const progressionTop12 = useMemo(() => {
    if (!tournois?.length) return [];

    const sorted = [...tournois]
      .map(t => ({
        ...t,
        dateObj: parseDate(t.date),
        point: Number(t.point || 0)
      }))
      .sort((a, b) => a.dateObj - b.dateObj);

    const byMonth = new Map();

    for (const t of sorted) {
      const key = `${t.dateObj.getFullYear()}-${t.dateObj.getMonth()}`;
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(t);
    }

    const history = [];

    for (const [key, list] of byMonth.entries()) {
      const top12 = [...list]
        .sort((a, b) => b.point - a.point)
        .slice(0, 12);

      const sum = top12.reduce((s, t) => s + t.point, 0);

      const d = list[0].dateObj;

      history.push({
        date: new Date(d.getFullYear(), d.getMonth(), 1)
          .toISOString()
          .slice(0, 10),
        value: sum,
        projection: false
      });
    }

    return history.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [tournois]);

  // ─────────────────────────────
  // PROJECTION (mois en cours inclus)
  // ─────────────────────────────
  const progressionProjected = useMemo(() => {
    if (!tournois?.length) return [];

    const now = new Date();
    const cm = now.getMonth();
    const cy = now.getFullYear();

    const sorted = [...tournois].map(t => ({
      ...t,
      dateObj: parseDate(t.date),
      point: Number(t.point || 0)
    }));

    const past = sorted.filter(t =>
      t.dateObj.getFullYear() < cy ||
      (t.dateObj.getFullYear() === cy && t.dateObj.getMonth() < cm)
    );

    const current = sorted.filter(t =>
      t.dateObj.getFullYear() === cy &&
      t.dateObj.getMonth() === cm
    );

    const sumTop12 = (list) =>
      [...list]
        .sort((a, b) => b.point - a.point)
        .slice(0, 12)
        .reduce((s, t) => s + t.point, 0);

    const pastValue = sumTop12(past);
    const projectedValue = sumTop12([...past, ...current]);

    return [
      {
        date: new Date(cy, cm - 1, 1).toISOString().slice(0, 10),
        value: pastValue,
        projection: false
      },
      {
        date: new Date(cy, cm, 1).toISOString().slice(0, 10),
        value: projectedValue,
        projection: true
      }
    ];
  }, [tournois]);

  // ─────────────────────────────
  // UI
  // ─────────────────────────────
  return (
    <div className="tenup-app">

      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-label">Points classement</div>
          <div className="stat-value">{totalPoints}</div>
        </div>
      </div>

      {/* PROGRESSION */}
      <div style={{ width: "100%", height: 300, marginTop: 20 }}>
        <ResponsiveContainer>
          <LineChart data={[...progressionTop12, ...progressionProjected]}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />

            {/* HISTORIQUE */}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#00e676"
              strokeWidth={2}
              dot
            />

            {/* PROJECTION (pointillé) */}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#00e676"
              strokeWidth={2}
              strokeDasharray="6 6"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
