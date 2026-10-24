import { describe, expect, test } from "bun:test";
import { DB_LIMIT_BYTES, formatBytes, storageShare, storageWarning } from "./storage";

describe("Speicher", () => {
  test("Warnung ab 80 % der Grenze", () => {
    expect(storageWarning(DB_LIMIT_BYTES * 0.79)).toBe(false);
    expect(storageWarning(DB_LIMIT_BYTES * 0.8)).toBe(true);
    expect(storageWarning(DB_LIMIT_BYTES * 1.2)).toBe(true);
  });
  test("Anteil, auch mit eigener Grenze und ohne Grenze", () => {
    expect(storageShare(DB_LIMIT_BYTES / 2)).toBeCloseTo(0.5);
    expect(storageShare(50, 100)).toBe(0.5);
    expect(storageShare(50, 0)).toBe(0);
  });
  test("Anzeige in MB bzw. GB", () => {
    expect(formatBytes(312 * 1_048_576)).toBe("312 MB");
    expect(formatBytes(DB_LIMIT_BYTES)).toBe("1 GB");
    expect(formatBytes(1.5 * DB_LIMIT_BYTES)).toBe("1,5 GB");
  });
});
