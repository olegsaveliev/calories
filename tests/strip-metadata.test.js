// Threat-model fix R10(a) — prove metadata is actually REMOVED from the bytes that egress, and that
// pixel data survives byte-for-byte.
import { describe, it, expect } from "vitest";
import {
  stripImageMetadata,
  isStrippableMime,
  STRIPPABLE_MIME_TYPES,
} from "../src/strip-metadata.js";
import {
  jpegWithExif,
  pngWithMetadata,
  SECRET_GPS_MARKER,
  JPEG_ENTROPY_BYTES,
  PNG_IDAT_BYTES,
} from "./image-fixtures.js";

describe("isStrippableMime — the egress allowlist", () => {
  it("allows exactly the formats we can provably strip", () => {
    expect([...STRIPPABLE_MIME_TYPES]).toEqual(["image/jpeg", "image/png"]);
  });

  it("rejects formats we cannot safely strip dependency-free (fail-closed, not pass-through)", () => {
    expect(isStrippableMime("image/gif")).toBe(false);
    expect(isStrippableMime("image/webp")).toBe(false);
    expect(isStrippableMime("image/svg+xml")).toBe(false);
  });
});

describe("stripImageMetadata — JPEG", () => {
  it("removes the EXIF/APP1 segment (the GPS carrier) from the outbound bytes", () => {
    const original = jpegWithExif();
    // Sanity: the fixture really does carry the needle before stripping.
    expect(original.includes(SECRET_GPS_MARKER)).toBe(true);

    const stripped = stripImageMetadata(original, "image/jpeg");

    expect(stripped).not.toBeNull();
    expect(stripped.includes(SECRET_GPS_MARKER)).toBe(false); // GPS is GONE
    expect(stripped.length).toBeLessThan(original.length);
  });

  it("removes every APPn marker segment and the COM comment", () => {
    const stripped = stripImageMetadata(jpegWithExif(), "image/jpeg");

    // Walk the stripped stream: no marker in the APP0–APP15 (0xE0–0xEF) or COM (0xFE) range may
    // remain among the header segments that precede the scan.
    for (let i = 2; i + 1 < stripped.length; i++) {
      if (stripped[i] !== 0xff) continue;
      const marker = stripped[i + 1];
      if (marker === 0xda) break; // reached the scan — header segments are all behind us
      expect(marker >= 0xe0 && marker <= 0xef).toBe(false);
      expect(marker).not.toBe(0xfe);
    }
  });

  it("keeps the segments a decoder needs (DQT) and the pixel data byte-for-byte", () => {
    const stripped = stripImageMetadata(jpegWithExif(), "image/jpeg");

    expect(stripped.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8])); // still a JPEG (SOI)
    expect(stripped.includes(Buffer.from([0xff, 0xdb]))).toBe(true); // DQT survived
    expect(stripped.includes(Buffer.from([0xff, 0xda]))).toBe(true); // SOS survived
    expect(stripped.includes(JPEG_ENTROPY_BYTES)).toBe(true); // pixels untouched
    expect(stripped.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9])); // EOI intact
  });

  it("fails closed on a buffer that isn't really a JPEG", () => {
    expect(stripImageMetadata(Buffer.from([0x00, 0x01, 0x02, 0x03]), "image/jpeg")).toBeNull();
  });

  it("fails closed on a truncated JPEG (segment length runs off the end)", () => {
    const truncated = Buffer.concat([
      Buffer.from([0xff, 0xd8]), // SOI
      Buffer.from([0xff, 0xe1, 0xff, 0xf0]), // APP1 claiming a 65,264-byte payload that isn't there
    ]);
    expect(stripImageMetadata(truncated, "image/jpeg")).toBeNull();
  });
});

describe("stripImageMetadata — PNG", () => {
  it("removes eXIf / tEXt / tIME chunks from the outbound bytes", () => {
    const original = pngWithMetadata();
    expect(original.includes(SECRET_GPS_MARKER)).toBe(true);

    const stripped = stripImageMetadata(original, "image/png");

    expect(stripped).not.toBeNull();
    expect(stripped.includes(SECRET_GPS_MARKER)).toBe(false); // GPS is GONE
    expect(stripped.includes("eXIf")).toBe(false);
    expect(stripped.includes("tEXt")).toBe(false);
    expect(stripped.includes("tIME")).toBe(false);
  });

  it("keeps the critical chunks, the rendering-relevant tRNS, and the pixel data", () => {
    const stripped = stripImageMetadata(pngWithMetadata(), "image/png");

    expect(stripped.includes("IHDR")).toBe(true);
    expect(stripped.includes("IDAT")).toBe(true);
    expect(stripped.includes("IEND")).toBe(true);
    expect(stripped.includes("tRNS")).toBe(true); // ancillary but needed to render faithfully
    expect(stripped.includes(PNG_IDAT_BYTES)).toBe(true); // pixels untouched
  });

  it("fails closed on a buffer that isn't really a PNG", () => {
    expect(stripImageMetadata(Buffer.alloc(64, 0x41), "image/png")).toBeNull();
  });

  it("fails closed on a PNG with a lying chunk length", () => {
    const png = pngWithMetadata();
    png.writeUInt32BE(0xfffffff0, 8); // IHDR now claims a preposterous length
    expect(stripImageMetadata(png, "image/png")).toBeNull();
  });
});

describe("stripImageMetadata — unsupported input", () => {
  it("fails closed for a format that isn't on the strippable list", () => {
    expect(stripImageMetadata(Buffer.from([0x47, 0x49, 0x46]), "image/gif")).toBeNull();
    expect(stripImageMetadata(Buffer.from([0x52, 0x49, 0x46, 0x46]), "image/webp")).toBeNull();
  });

  it("fails closed on an empty buffer", () => {
    expect(stripImageMetadata(Buffer.alloc(0), "image/jpeg")).toBeNull();
  });
});
