import { addMonths, startOfMonth, endOfMonth } from "date-fns";
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
export const TYPES = ["P25", "P50", "P100", "P250", "P500", "P1000", "P1500", "P2000"];

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
  return future.toLocaleDateString("fr-FR", { month: "short" }).toLowerCase()
    + "-" + String(future.getFullYear()).slice(-2);
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
  return tournois.map(t => ({
    ...t,
    dateObj: parseDate(t.date),
    point: Number(t.point || 0),
  }));
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
  return months.map(month => {
    const { start, end } = getRollingWindow(month.date);
    const pool = normalizedTournois.filter(t => t.dateObj >= start && t.dateObj <= end);
    const total = computeTop12Total(pool);
    const showProjected = month.date >= startOfMonth(addMonths(now, -1));

    return {
      month: month.label,
      real: month.date <= now ? total : null,
      projected: showProjected ? total : null,
    };
  });
}
