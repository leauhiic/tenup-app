import {
  buildChartData,
  computeTop12Total,
  getDashboardBuckets,
  getPoints,
  getValidite,
  normalizeTournois,
  parseDate,
} from "./fft";

test("parse French and ISO tournament dates", () => {
  expect(parseDate("27/07/2025").getFullYear()).toBe(2025);
  expect(parseDate("2026-01-30").getMonth()).toBe(0);
});

test("computes the FFT validity month one year later", () => {
  expect(getValidite("2026-01-30")).toBe("janv.-27");
});

test("reads points from the FFT bareme", () => {
  expect(getPoints("P250", "17-20", 3)).toBe(188);
});

test("keeps only the best 12 scores for ranking totals", () => {
  const tournois = normalizeTournois(
    Array.from({ length: 13 }, (_, index) => ({
      date: `2026-01-${String(index + 1).padStart(2, "0")}`,
      point: index + 1,
    })),
  );

  expect(computeTop12Total(tournois)).toBe(90);
});

test("keeps future tournaments out of the active ranking bucket", () => {
  const buckets = getDashboardBuckets(
    [
      { nom: "Ancien score", date: "15/07/2025", point: 108 },
      { nom: "Score du mois", date: "24/05/2026", point: 63 },
      { nom: "Tournoi futur", date: "25/06/2026", point: 188 },
    ],
    new Date(2026, 4, 30),
  );

  expect(buckets.actifsClassement.map((t) => t.nom)).toEqual(["Ancien score"]);
  expect(buckets.tournoisMoisCourant.map((t) => t.nom)).toEqual([
    "Score du mois",
  ]);
  expect(buckets.tournoisAVenir.map((t) => t.nom)).toEqual(["Tournoi futur"]);
});

test("starts simulated ranking data at next month", () => {
  const now = new Date(2026, 4, 30);
  const months = [
    { date: new Date(2026, 4, 1), label: "mai 2026" },
    { date: new Date(2026, 5, 1), label: "juin 2026" },
    { date: new Date(2026, 6, 1), label: "juil. 2026" },
  ];
  const tournois = normalizeTournois([
    { date: "24/05/2026", point: 63 },
    { date: "25/06/2026", point: 188 },
  ]);

  const data = buildChartData(months, tournois, now);

  expect(data[0].simule).toBeNull();
  expect(data[1].simule).toBe(63);
  expect(data[2].simule).toBe(251);
  expect(data[0].projected).toBeUndefined();
});
