import BAREME from "./bareme.json";

export const TRANCHES = {
  P25: ["4-8", "9-12", "13-16", "17-20", "21-24", "25-28"],
  P50: ["4-8", "9-12", "13-16", "17-20", "21-24", "25-28", "29-32"],
  P100: ["4-8", "9-12", "13-16", "17-20", "21-24", "25-28", "29-32"],
  P250: ["4-8", "9-12", "13-16", "17-20", "21-24", "25-28", "29-32"],
  P500: ["4-8", "9-12", "13-16", "17-20", "21-24", "25-28", "29-32"],
  P1000: ["4-8", "9-12", "13-16", "17-20", "21-24", "25-28", "29-32"],
  P1500: ["21-24", "25-28", "29-32"],
  P2000: ["21-24", "25-28", "29-32"],
};

export const CATEGORIES = ["DM", "DD", "DX"];
export const TYPES = [
  "P25",
  "P50",
  "P100",
  "P250",
  "P500",
  "P1000",
  "P1500",
  "P2000",
];

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, date.getDate());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function getPoints(type, tranche, place) {
  const table = BAREME[type]?.[tranche];
  if (!table) return "";

  const pts = table[place - 1];
  return pts != null ? pts : "";
}

export function getValidite(dateStr) {
  if (!dateStr) return "";

  const d = parseDate(dateStr);
  if (Number.isNaN(d.getTime())) return "";

  const future = new Date(d.getFullYear() + 1, d.getMonth(), 1);
  return (
    future.toLocaleDateString("fr-FR", { month: "short" }).toLowerCase() +
    "-" +
    String(future.getFullYear()).slice(-2)
  );
}

export function parseDate(value) {
  if (!value) return new Date(0);

  const s = String(value);

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [year, month, day] = s.slice(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [day, month, year] = s.split("/").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(0);
}

export function getRollingWindow(month) {
  return {
    start: startOfMonth(addMonths(month, -12)),
    end: endOfMonth(addMonths(month, -1)),
  };
}

export function normalizeTournois(tournois) {
  return tournois.map((t) => ({
    ...t,
    dateObj: parseDate(t.date),
    point: Number(t.point || 0),
  }));
}

export function getDashboardBuckets(tournois, now = new Date()) {
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const today = new Date(currentYear, currentMonth, now.getDate());
  const startWindow = new Date(currentYear - 1, currentMonth, 1);

  const dated = tournois.map((t) => ({ tournoi: t, date: parseDate(t.date) }));
  const completed = dated.filter(({ date }) => date <= today);
  const actifs = completed
    .filter(({ date }) => date >= startWindow)
    .map(({ tournoi }) => tournoi);

  const tournoisMoisCourant = completed
    .filter(
      ({ date }) =>
        date.getFullYear() === currentYear && date.getMonth() === currentMonth,
    )
    .map(({ tournoi }) => tournoi);

  const actifsClassement = actifs.filter(
    (t) => !tournoisMoisCourant.includes(t),
  );

  const tournoisExpirants = completed
    .filter(
      ({ date }) =>
        date.getMonth() === currentMonth &&
        date.getFullYear() === currentYear - 1,
    )
    .map(({ tournoi }) => tournoi);

  const historique = completed
    .filter(
      ({ date, tournoi }) =>
        date < startWindow && !tournoisExpirants.includes(tournoi),
    )
    .map(({ tournoi }) => tournoi);

  const tournoisAVenir = dated
    .filter(({ date }) => date > today)
    .map(({ tournoi }) => tournoi);

  return {
    actifs,
    actifsClassement,
    tournoisMoisCourant,
    tournoisExpirants,
    historique,
    tournoisAVenir,
  };
}

export function getTop12(tournois) {
  return [...tournois]
    .sort((a, b) => {
      if (b.point !== a.point) return b.point - a.point;
      return b.dateObj - a.dateObj;
    })
    .slice(0, 12);
}

export function computeTop12Total(tournois) {
  return getTop12(tournois).reduce((sum, t) => sum + t.point, 0);
}

export function buildChartData(months, normalizedTournois, now) {
  return months.map((month) => {
    const { start, end } = getRollingWindow(month.date);
    const pool = normalizedTournois.filter(
      (t) => t.dateObj >= start && t.dateObj <= end,
    );
    const total = computeTop12Total(pool);
    const showSimule = month.date >= startOfMonth(now);

    return {
      month: month.label,
      real: month.date <= now ? total : null,
      simule: showSimule ? total : null,
    };
  });
}
