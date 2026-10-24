import { describe, expect, test } from "bun:test";
import { isChefkochImageUrl, sniffImageType } from "./chefkochPhotos";

const bytes = (...b: number[]) => new Uint8Array(b);
const text = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe("Bildformat an den ersten Bytes", () => {
  test("erkennt JPEG, PNG und WebP", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffImageType(text("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });
  test("lehnt alles andere ab (HTML, SVG, GIF, zu kurz)", () => {
    expect(sniffImageType(text("<!DOCTYPE html>"))).toBeNull();
    expect(sniffImageType(text("<svg xmlns="))).toBeNull();
    expect(sniffImageType(text("GIF89a......"))).toBeNull();
    expect(sniffImageType(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe("Chefkoch-Bildadresse", () => {
  test("nur https auf img.chefkoch-cdn.de", () => {
    expect(isChefkochImageUrl("https://img.chefkoch-cdn.de/rezepte/1/bilder/2/crop-960x540/x.jpg")).toBe(true);
    expect(isChefkochImageUrl("http://img.chefkoch-cdn.de/rezepte/1/x.jpg")).toBe(false);
    expect(isChefkochImageUrl("https://img.chefkoch-cdn.de.evil.example/x.jpg")).toBe(false);
    expect(isChefkochImageUrl("https://example.com/x.jpg")).toBe(false);
    expect(isChefkochImageUrl("kein link")).toBe(false);
  });
});
