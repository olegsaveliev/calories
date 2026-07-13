// Calories — threat-model fix R10(a): strip metadata from an image BEFORE it leaves the machine.
//
// Every accepted upload is transmitted to api.anthropic.com (TB-3, the project's first outbound
// personal-data flow). A phone photo carries EXIF: GPS coordinates, capture timestamp, device serial.
// None of that is needed to count calories, so none of it should cross the boundary.
//
// Dependency-free by construction (ADR-001 — no new runtime deps, so no sharp/exif-parser/piexif):
// we do a structural walk of the container and DROP the metadata-bearing segments, leaving the
// compressed pixel data byte-for-byte untouched. We never re-encode, so image fidelity is exactly
// preserved and the model sees the same picture.
//
// FAIL-CLOSED: a format we cannot provably strip, or a buffer whose structure doesn't parse, returns
// `null` — the caller MUST treat that as a reject, never as "send it through unstripped".

/**
 * MIME types we can provably strip metadata from, and therefore the only types allowed to egress.
 *
 * NOTE (R10 consequence): the design's original allowlist also included `image/gif` and `image/webp`.
 * They are removed here deliberately. Stripping them safely dependency-free would mean walking GIF's
 * LZW-interleaved block structure and rewriting WebP's RIFF/VP8X chunk flags — enough parsing surface
 * to risk corrupting the pixels we're supposed to leave alone. Per the threat-model disposition, a
 * format that can't be safely stripped is a fail-closed REJECT, not a silent pass-through. JPEG and
 * PNG cover the actual product path (camera photos and screenshots), and EXIF/GPS — the risk R10 is
 * about — is overwhelmingly a JPEG concern.
 * @type {ReadonlyArray<string>}
 */
export const STRIPPABLE_MIME_TYPES = Object.freeze(["image/jpeg", "image/png"]);

/**
 * Can we strip this (normalised) MIME type, i.e. is it allowed to leave the machine at all?
 * @param {string} mime
 * @returns {boolean}
 */
export function isStrippableMime(mime) {
  return STRIPPABLE_MIME_TYPES.includes(mime);
}

/**
 * Strip metadata from an image buffer, dependency-free.
 * @param {Buffer} buffer - raw image bytes
 * @param {string} mime - normalised MIME; must be in STRIPPABLE_MIME_TYPES
 * @returns {Buffer|null} the stripped image, or `null` if it cannot be safely stripped (fail closed)
 */
export function stripImageMetadata(buffer, mime) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  if (mime === "image/jpeg") return stripJpeg(buffer);
  if (mime === "image/png") return stripPng(buffer);
  return null; // unknown/unstrippable format → fail closed
}

// --- JPEG ------------------------------------------------------------------------------------
// A JPEG is SOI (FFD8) followed by marker segments, ending with entropy-coded scan data after SOS.
// EXIF lives in APP1 (FFE1); XMP/ICC/Adobe/JFIF live in the other APPn (FFE0–FFEF); free-text
// comments live in COM (FFFE). We drop ALL of those and keep every segment a decoder needs
// (DQT/SOF/DHT/DRI/…), then copy the scan data through untouched.

const JPEG_SOI = 0xd8;
const JPEG_EOI = 0xd9;
const JPEG_SOS = 0xda;
const JPEG_COM = 0xfe;
const JPEG_APP0 = 0xe0;
const JPEG_APP15 = 0xef;
const JPEG_RST0 = 0xd0;
const JPEG_RST7 = 0xd7;

/**
 * @param {Buffer} buf
 * @returns {Buffer|null}
 */
function stripJpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== JPEG_SOI) return null;

  const kept = [Buffer.from([0xff, JPEG_SOI])];
  let i = 2;
  let sawScanOrEnd = false;

  while (i + 1 < buf.length) {
    if (buf[i] !== 0xff) return null; // not sitting on a marker → malformed
    const marker = buf[i + 1];

    if (marker === 0xff) {
      i += 1; // fill byte; markers may be padded with 0xFF
      continue;
    }

    if (marker === JPEG_EOI) {
      kept.push(Buffer.from([0xff, JPEG_EOI]));
      sawScanOrEnd = true;
      break;
    }

    if (marker === JPEG_SOS) {
      // Start of scan: everything from here on is the segment header + entropy-coded pixel data
      // (+ EOI). Copy it through verbatim — we never touch pixels.
      kept.push(buf.subarray(i));
      sawScanOrEnd = true;
      break;
    }

    if (marker >= JPEG_RST0 && marker <= JPEG_RST7 || marker === 0x01) {
      kept.push(buf.subarray(i, i + 2)); // standalone marker, no length field
      i += 2;
      continue;
    }

    // Length-prefixed segment: 2-byte big-endian length that includes the length bytes themselves.
    if (i + 4 > buf.length) return null;
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) return null;

    const isAppN = marker >= JPEG_APP0 && marker <= JPEG_APP15; // EXIF (APP1), XMP, ICC, JFIF, Adobe…
    const isComment = marker === JPEG_COM;
    if (!isAppN && !isComment) {
      kept.push(buf.subarray(i, i + 2 + len)); // decoder needs it — keep byte-for-byte
    }
    i += 2 + len;
  }

  if (!sawScanOrEnd) return null; // no scan data and no EOI → not a usable JPEG
  return Buffer.concat(kept);
}

// --- PNG -------------------------------------------------------------------------------------
// A PNG is an 8-byte signature followed by length/type/data/CRC chunks. Metadata lives in the
// ancillary chunks: eXIf (EXIF, incl. GPS), tEXt/zTXt/iTXt (text + XMP), tIME (timestamp).
// Rather than denylist the ones we happen to know, we KEEP an explicit set and drop every other
// ancillary chunk — so a chunk type we've never heard of cannot smuggle data out.
//
// A chunk is "critical" (structurally required) iff bit 5 of its first byte is 0 (uppercase ASCII):
// IHDR, PLTE, IDAT, IEND. Those are always kept. Chunk contents are never modified, so the original
// CRCs stay valid.

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Ancillary (lowercase-first) chunks a decoder needs to render the image FAITHFULLY — colour,
 * transparency, and APNG animation. Everything ancillary that is not on this list is dropped.
 */
const PNG_ANCILLARY_KEEP = new Set([
  "tRNS", // transparency
  "gAMA",
  "cHRM",
  "sRGB",
  "iCCP", // colour profile / rendering intent
  "sBIT",
  "bKGD",
  "pHYs", // aspect ratio
  "acTL",
  "fcTL",
  "fdAT", // APNG animation control + frame data
]);

/**
 * @param {Buffer} buf
 * @returns {Buffer|null}
 */
function stripPng(buf) {
  if (buf.length < PNG_SIGNATURE.length + 12) return null;
  if (!buf.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return null;

  const kept = [PNG_SIGNATURE];
  let i = PNG_SIGNATURE.length;
  let sawIhdr = false;
  let sawIend = false;

  while (i + 8 <= buf.length) {
    const dataLength = buf.readUInt32BE(i);
    const type = buf.toString("latin1", i + 4, i + 8);
    const chunkEnd = i + 12 + dataLength; // 4 len + 4 type + data + 4 CRC
    if (dataLength > buf.length || chunkEnd > buf.length) return null; // truncated/lying length

    if (!sawIhdr && type !== "IHDR") return null; // IHDR must come first
    if (type === "IHDR") sawIhdr = true;

    // bit 5 of the first byte: 0 → uppercase → critical chunk (structurally required).
    const isCritical = (buf[i + 4] & 0x20) === 0;
    if (isCritical || PNG_ANCILLARY_KEEP.has(type)) {
      kept.push(buf.subarray(i, chunkEnd)); // unmodified → its CRC remains valid
    }

    i = chunkEnd;
    if (type === "IEND") {
      sawIend = true;
      break;
    }
  }

  if (!sawIhdr || !sawIend) return null; // malformed → fail closed
  return Buffer.concat(kept);
}
