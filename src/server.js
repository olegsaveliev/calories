// Calories — Feature 001: the single Node service.
// Roles (ADR-001): (1) serve the browser frontend, (2) own the ONE upload endpoint.
// Transport (ADR-002): the image arrives as the RAW request body; MIME = Content-Type header.
// Built-in http + fs only — no framework, no runtime dependency.
// Feature 007 grows calorieResult additively (foodName/confidence/itemsCount, omit-on-absent) —
// see the comment above the calorieResult assignment in handleUpload below.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isSupportedRasterMime, estimateCalories } from "./vision.js";
import { acquireVisionSlot } from "./rate-limit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Maximum accepted upload size: 10 MB (10 × 1024 × 1024). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10,485,760

const INDEX_HTML_PATH = join(__dirname, "index.html");

/**
 * Send a JSON response.
 * @param {import('node:http').ServerResponse} res
 * @param {number} status - HTTP status code
 * @param {object} body - JSON-serialisable body
 * @returns {void}
 */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * Read the raw request body, enforcing MAX_UPLOAD_BYTES by aborting mid-stream.
 * Resolves with the collected Buffer, or rejects with { tooLarge: true } once the
 * running byte count strictly exceeds the cap (without buffering the whole body).
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<Buffer>}
 */
function readBodyCapped(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;

    req.on("data", (chunk) => {
      if (settled) return;
      total += chunk.length;
      if (total > MAX_UPLOAD_BYTES) {
        // Abort mid-stream: stop buffering the oversized body immediately.
        // We free what we've collected and stop accumulating, but let the request
        // drain (without keeping bytes) so the 413 response can flush cleanly instead
        // of the client seeing a reset socket.
        settled = true;
        chunks.length = 0;
        req.resume();
        const err = new Error("file too large");
        err.tooLarge = true;
        reject(err);
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });

    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

/**
 * Handle POST /upload per the 001 base contract (AC1.2 happy path, AC2.1–2.4 negatives) PLUS the
 * 002 additions: an explicit raster-MIME allowlist ahead of any model call (Story 2), and the
 * vision-model calorie estimate itself (Story 1 / Story 3). The allowlist check happens BEFORE the
 * body is even read — an unsupported type never reaches the model (AC2.2).
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @returns {Promise<void>}
 */
async function handleUpload(req, res) {
  const contentType = (req.headers["content-type"] || "").trim();

  // AC2.1 (001) — no Content-Type at all means nothing meaningful was sent.
  if (contentType === "") {
    sendJson(res, 400, { error: "no file provided" });
    return;
  }

  // Story 2 / AC2.1–AC2.2 (002) — explicit raster-image allowlist, replacing 001's loose
  // `startsWith("image/")` check (manifest hard pre-condition R3/M1/M2). Anything not on the
  // allowlist (incl. image/svg+xml, non-image types) is rejected with 415 BEFORE any API call.
  const mime = contentType.split(";")[0].trim().toLowerCase();
  if (!isSupportedRasterMime(mime)) {
    sendJson(res, 415, { error: "unsupported file type" });
    return;
  }

  let body;
  try {
    body = await readBodyCapped(req);
  } catch (err) {
    if (err && err.tooLarge) {
      // AC2.3 (001) — oversized: rejected while streaming, before the whole body lands in memory.
      sendJson(res, 413, { error: "file too large" });
      return;
    }
    sendJson(res, 400, { error: "could not read upload" });
    return;
  }

  // AC2.4 (001) — zero-byte body.
  if (body.length === 0) {
    sendJson(res, 400, { error: "file is empty" });
    return;
  }

  // R9 — cost guard. The vision call spends real money, and this endpoint is unauthenticated. Take a
  // rate-limit + concurrency slot BEFORE the API call; if the caller is over their per-IP window, or
  // too many calls are already in flight, we spend nothing and return 429.
  const slot = acquireVisionSlot(req.socket.remoteAddress);
  if (!slot.allowed) {
    sendJson(res, 429, {
      error:
        slot.reason === "concurrency"
          ? "too many photos being analysed right now, try again in a moment"
          : "too many requests, try again in a minute",
    });
    return;
  }

  // Story 1 / Story 3 (002) — forward the validated image to the vision model. estimateCalories()
  // never throws and never returns a fabricated number: every failure mode (refusal, timeout,
  // network/API error, unparseable/non-integer/implausible reply, un-strippable image) collapses to
  // status "unavailable" (AC1.2); an image with no recognizable meal collapses to "no_food" (AC3.1).
  // Each call is independent — nothing is cached or persisted (AC3.2). The image's EXIF/GPS metadata
  // is stripped inside estimateCalories before it egresses (R10).
  let result;
  try {
    result = await estimateCalories(body, mime);
  } finally {
    slot.release(); // always give the in-flight slot back, success or throw
  }

  // 007 — grow calorieResult additively on the "estimated" branch only. Each new field is present
  // ONLY if estimateCalories already validated it (omit-on-absent — never send `foodName: null`),
  // so a response where all three degraded is byte-identical to a pre-007 response (AC6.1/AC6.4).
  // The no_food/unavailable shapes are completely unchanged.
  const calorieResult =
    result.status === "estimated"
      ? {
          status: "estimated",
          calories: result.calories,
          ...("foodName" in result ? { foodName: result.foodName } : {}),
          ...("confidence" in result ? { confidence: result.confidence } : {}),
          ...("itemsCount" in result ? { itemsCount: result.itemsCount } : {}),
        }
      : { status: result.status };

  sendJson(res, 200, { ok: true, size: body.length, type: mime, calorieResult });
}

/**
 * Serve the static frontend (src/index.html) for GET /.
 * @param {import('node:http').ServerResponse} res
 * @returns {Promise<void>}
 */
async function serveIndex(res) {
  try {
    const html = await readFile(INDEX_HTML_PATH);
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": html.length,
    });
    res.end(html);
  } catch {
    sendJson(res, 500, { error: "could not load page" });
  }
}

/**
 * Top-level request handler: routes GET / (frontend) and POST /upload (endpoint).
 * Exported so tests can mount it on an ephemeral-port server.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @returns {Promise<void>}
 */
export async function requestHandler(req, res) {
  const url = new URL(req.url, "http://localhost");

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    await serveIndex(res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/upload") {
    await handleUpload(req, res);
    return;
  }

  sendJson(res, 404, { error: "not found" });
}

/**
 * Create (but do not start) the HTTP server bound to the request handler.
 * @returns {import('node:http').Server}
 */
export function createServer() {
  return http.createServer((req, res) => {
    requestHandler(req, res).catch(() => {
      if (!res.headersSent) sendJson(res, 500, { error: "internal error" });
      else res.end();
    });
  });
}

// Start the server when run directly (npm start). Import in tests won't start it.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, () => {
    console.log(`Calories service listening on http://localhost:${port}`);
  });
}
