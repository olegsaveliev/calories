// Test fixtures — structurally valid JPEG/PNG buffers that CARRY metadata, so the R10 strip tests can
// prove the metadata is actually gone from the bytes that would egress (not just that a function ran).
import { crc32 } from "node:zlib";

/** A recognisable needle we plant in the metadata segments and then assert is absent after stripping. */
export const SECRET_GPS_MARKER = "GPS-51.5074N-0.1278W";

// --- JPEG -------------------------------------------------------------------------------------

function jpegSegment(marker, payload) {
  const len = Buffer.alloc(2);
  len.writeUInt16BE(payload.length + 2); // length includes the 2 length bytes
  return Buffer.concat([Buffer.from([0xff, marker]), len, payload]);
}

/**
 * A minimal JPEG containing an APP1/EXIF segment (with a GPS needle), an APP0/JFIF segment, and a
 * COM comment — plus the segments a decoder actually needs (DQT) and scan data.
 * @returns {Buffer}
 */
export function jpegWithExif() {
  const exifPayload = Buffer.concat([
    Buffer.from("Exif\0\0", "latin1"),
    Buffer.from(SECRET_GPS_MARKER, "latin1"),
  ]);
  const app1 = jpegSegment(0xe1, exifPayload); // EXIF — the GPS/timestamp/device carrier
  const app0 = jpegSegment(0xe0, Buffer.from("JFIF\0\0\0\0\0\0", "latin1"));
  const comment = jpegSegment(0xfe, Buffer.from(`comment ${SECRET_GPS_MARKER}`, "latin1"));
  const dqt = jpegSegment(0xdb, Buffer.alloc(65, 0x10)); // a segment a decoder NEEDS — must survive
  const sos = jpegSegment(0xda, Buffer.from([0x01, 0x01, 0x00])); // start of scan
  const entropy = Buffer.from([0x12, 0x34, 0x56, 0x78, 0x9a]); // "pixel" data — must survive verbatim

  return Buffer.concat([
    Buffer.from([0xff, 0xd8]), // SOI
    app1,
    app0,
    comment,
    dqt,
    sos,
    entropy,
    Buffer.from([0xff, 0xd9]), // EOI
  ]);
}

/** The entropy-coded "pixel" bytes planted by jpegWithExif — used to prove pixels survive untouched. */
export const JPEG_ENTROPY_BYTES = Buffer.from([0x12, 0x34, 0x56, 0x78, 0x9a]);

// --- PNG --------------------------------------------------------------------------------------

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData) >>> 0);
  return Buffer.concat([len, typeAndData, crc]);
}

/**
 * A minimal PNG containing an eXIf chunk (with a GPS needle), a tEXt chunk, and a tIME chunk —
 * plus IHDR/IDAT/IEND and a tRNS chunk a decoder needs (which must survive).
 * @returns {Buffer}
 */
export function pngWithMetadata() {
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1, 0); // width
  ihdrData.writeUInt32BE(1, 4); // height
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // colour type (truecolour)

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdrData),
    pngChunk("eXIf", Buffer.from(SECRET_GPS_MARKER, "latin1")), // EXIF in a PNG
    pngChunk("tEXt", Buffer.from(`Comment\0${SECRET_GPS_MARKER}`, "latin1")),
    pngChunk("tIME", Buffer.alloc(7, 1)),
    pngChunk("tRNS", Buffer.from([0, 0, 0, 0, 0, 0])), // rendering-relevant — must SURVIVE
    pngChunk("IDAT", PNG_IDAT_BYTES), // "pixel" data — must survive verbatim
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** The IDAT payload planted by pngWithMetadata — used to prove pixels survive untouched. */
export const PNG_IDAT_BYTES = Buffer.from([0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01]);
