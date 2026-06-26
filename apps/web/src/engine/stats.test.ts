import { describe, it, expect } from "vitest";
import { computeStats, computeConsistency, charStatuses } from "./stats";

describe("computeStats", () => {
  it("is 100% accuracy and correct wpm for a perfect minute", () => {
    // 60 correct chars in 60s => 12 wpm (60/5/1)
    const target = "a".repeat(60);
    const s = computeStats(target, "a".repeat(60), 60_000);
    expect(s.accuracy).toBe(100);
    expect(s.wpm).toBe(12);
    expect(s.correctChars).toBe(60);
    expect(s.incorrectChars).toBe(0);
  });

  it("counts incorrect chars and lowers accuracy", () => {
    const s = computeStats("hello", "hxllo", 60_000);
    expect(s.correctChars).toBe(4);
    expect(s.incorrectChars).toBe(1);
    expect(s.accuracy).toBe(80);
  });

  it("raw wpm counts all typed chars including wrong ones", () => {
    const s = computeStats("aaaaa", "bbbbb", 60_000);
    expect(s.wpm).toBe(0); // none correct
    expect(s.raw).toBe(1); // 5 chars / 5 / 1min
  });

  it("returns 100% accuracy for empty input", () => {
    expect(computeStats("abc", "", 1000).accuracy).toBe(100);
  });
});

describe("computeConsistency", () => {
  it("is 100 for perfectly steady wpm", () => {
    expect(computeConsistency([50, 50, 50, 50])).toBe(100);
  });
  it("drops below 100 for variable wpm", () => {
    expect(computeConsistency([10, 90, 20, 80])).toBeLessThan(100);
  });
});

describe("charStatuses", () => {
  it("marks correct, incorrect, and pending", () => {
    expect(charStatuses("abc", "ax")).toEqual(["correct", "incorrect", "pending"]);
  });
});
