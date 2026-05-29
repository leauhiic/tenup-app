import {
  computeTop12Total,
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
    }))
  );

  expect(computeTop12Total(tournois)).toBe(90);
});
