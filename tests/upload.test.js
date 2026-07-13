// Feature 001 — integration tests for the upload endpoint + served frontend.
// Feature 002 — extends this suite with the vision-model calorie estimate (Story 1), the
// raster-MIME allowlist ahead of the model call (Story 2), and the no-meal / independent-call
// guarantees (Story 3).
//
// The outbound call to the Anthropic Messages API is ALWAYS mocked here — a real
// `ANTHROPIC_API_KEY` may be present in the local/dev environment, but these tests must never make
// a real network call to api.anthropic.com, so CI stays green (and fast) without a key.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createServer, MAX_UPLOAD_BYTES } from "../src/server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = join(__dirname, "..", "src", "index.html");

let server;
let base;

// --- Anthropic fetch mock -------------------------------------------------------------------
// vision.js calls the SAME global `fetch` the tests use to talk to the local ephemeral server, so
// the mock must only intercept requests to api.anthropic.com and pass everything else through to
// the real fetch implementation.
const realFetch = globalThis.fetch;
let anthropicCallCount = 0;
/** @type {(url: string, init: object) => Promise<{ok: boolean, status?: number, json: () => Promise<any>}>} */
let anthropicImpl = defaultAnthropicImpl;

/** Default stub: a usable estimate, so tests that don't care about the vision response still see AC1.1 behaviour. */
function defaultAnthropicImpl() {
  return Promise.resolve(jsonResponse({ food_identified: true, calories: 400 }));
}

/** Build a fetch-like Response stub carrying a structured-output text block. */
function jsonResponse(structured, { ok = true, status = 200, stopReason = "end_turn" } = {}) {
  return {
    ok,
    status,
    json: async () => ({
      stop_reason: stopReason,
      content: [{ type: "text", text: JSON.stringify(structured) }],
    }),
  };
}

async function fetchDispatcher(url, init) {
  const href = typeof url === "string" ? url : String(url);
  if (href.includes("api.anthropic.com")) {
    anthropicCallCount += 1;
    return anthropicImpl(href, init);
  }
  return realFetch(url, init);
}

beforeAll(async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-real");
  vi.stubGlobal("fetch", fetchDispatcher);

  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

beforeEach(() => {
  anthropicCallCount = 0;
  anthropicImpl = defaultAnthropicImpl;
});

// A tiny but non-empty "image" payload (bytes are all we check; MIME is from the header).
const jpegBytes = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

describe("POST /upload — 001 base contract", () => {
  it("AC1.2 — accepts a valid image and returns 200 with size + type", async () => {
    const body = jpegBytes();
    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body,
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.size).toBe(body.length);
    expect(json.type).toBe("image/jpeg");
  });

  it("AC2.1 — no Content-Type / empty request → 400 JSON error", async () => {
    // Send with no body and strip Content-Type to simulate "nothing selected".
    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "" },
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(typeof json.error).toBe("string");
    expect(res.status).not.toBe(200);
  });

  it("AC2.2 — non-image Content-Type → 400 or 415 JSON error", async () => {
    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hello, not an image",
    });
    expect([400, 415]).toContain(res.status);
    const json = await res.json();
    expect(typeof json.error).toBe("string");
    expect(res.status).not.toBe(200);
  });

  it("AC2.3 — oversized (> 10,485,760 bytes) → 413 or 400 JSON error", async () => {
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1); // strictly over the cap
    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: big,
    });
    expect([413, 400]).toContain(res.status);
    const json = await res.json();
    expect(typeof json.error).toBe("string");
    expect(res.status).not.toBe(200);
  });

  it("boundary — exactly 10,485,760 bytes is accepted (not oversized)", async () => {
    const atCap = new Uint8Array(MAX_UPLOAD_BYTES);
    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: atCap,
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.size).toBe(MAX_UPLOAD_BYTES);
  });

  it("AC2.4 — zero-byte image body → 400 JSON error", async () => {
    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: new Uint8Array(0),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(typeof json.error).toBe("string");
    expect(res.status).not.toBe(200);
  });
});

describe("POST /upload — 002 Story 1: calorie estimate", () => {
  it("AC1.1 — usable estimate is returned as calorieResult.status 'estimated' with a number", async () => {
    anthropicImpl = () => Promise.resolve(jsonResponse({ food_identified: true, calories: 452 }));

    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: jpegBytes(),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.calorieResult).toEqual({ status: "estimated", calories: 452 });
    expect(anthropicCallCount).toBe(1);
  });

  it("AC1.2 — non-2xx response from the model → calorieResult 'unavailable', no calorie number", async () => {
    anthropicImpl = () => Promise.resolve({ ok: false, status: 500, json: async () => ({}) });

    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: jpegBytes(),
    });

    expect(res.status).toBe(200); // the upload itself succeeded; the estimate did not
    const json = await res.json();
    expect(json.calorieResult).toEqual({ status: "unavailable" });
    expect(json.calorieResult.calories).toBeUndefined();
  });

  it("AC1.2 — network error calling the model → calorieResult 'unavailable', no calorie number", async () => {
    anthropicImpl = () => Promise.reject(new Error("fetch failed"));

    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: jpegBytes(),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.calorieResult).toEqual({ status: "unavailable" });
  });

  it("AC1.2 — refusal stop_reason → calorieResult 'unavailable', no calorie number", async () => {
    anthropicImpl = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ stop_reason: "refusal", content: [] }),
      });

    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: jpegBytes(),
    });

    const json = await res.json();
    expect(json.calorieResult).toEqual({ status: "unavailable" });
  });

  it("AC1.2 — unparseable model reply → calorieResult 'unavailable', no calorie number", async () => {
    anthropicImpl = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          stop_reason: "end_turn",
          content: [{ type: "text", text: "not valid json" }],
        }),
      });

    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: jpegBytes(),
    });

    const json = await res.json();
    expect(json.calorieResult).toEqual({ status: "unavailable" });
  });
});

describe("POST /upload — 002 Story 2: raster-MIME allowlist ahead of the model", () => {
  it("AC2.1 — a supported raster image (PNG) is forwarded to the vision model", async () => {
    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: jpegBytes(),
    });

    expect(res.status).toBe(200);
    expect(anthropicCallCount).toBe(1);
  });

  it("AC2.2 — image/svg+xml is rejected with 415 and NEVER reaches the model", async () => {
    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/svg+xml" },
      body: "<svg></svg>",
    });

    expect(res.status).toBe(415);
    const json = await res.json();
    expect(typeof json.error).toBe("string");
    expect(anthropicCallCount).toBe(0);
  });

  it("AC2.2 — a degenerate non-raster image/* subtype is rejected with 415 and never reaches the model", async () => {
    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/x-icon" },
      body: new Uint8Array([1, 2, 3]),
    });

    expect(res.status).toBe(415);
    expect(anthropicCallCount).toBe(0);
  });
});

describe("POST /upload — 002 Story 3: no misleading numbers", () => {
  it("AC3.1 — a non-food photo (food_identified:false) → calorieResult 'no_food', no calorie number", async () => {
    anthropicImpl = () => Promise.resolve(jsonResponse({ food_identified: false, calories: null }));

    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: jpegBytes(),
    });

    const json = await res.json();
    expect(json.calorieResult).toEqual({ status: "no_food" });
    expect(json.calorieResult.calories).toBeUndefined();
  });

  it("AC3.2 — two uploads of the same photo each make their own independent model call", async () => {
    anthropicImpl = () => Promise.resolve(jsonResponse({ food_identified: true, calories: 300 }));
    const body = jpegBytes();
    const opts = { method: "POST", headers: { "Content-Type": "image/jpeg" }, body };

    const first = await fetch(`${base}/upload`, opts);
    const second = await fetch(`${base}/upload`, opts);

    expect((await first.json()).calorieResult).toEqual({ status: "estimated", calories: 300 });
    expect((await second.json()).calorieResult).toEqual({ status: "estimated", calories: 300 });
    expect(anthropicCallCount).toBe(2); // never served from a single cached call
  });
});

describe("GET / (served frontend)", () => {
  it("AC1.1 / AC1.3 — served HTML has file input, send control, and confirmation area", async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain('data-testid="file-input"');
    expect(html).toContain('accept="image/*"');
    expect(html).toContain('data-testid="send-button"');
    expect(html).toContain('data-testid="status"');
  });
});

describe("AC2.5 — no secret in client code", () => {
  it("served index.html contains no API key / secret", async () => {
    const html = await readFile(INDEX_HTML, "utf8");
    // No Anthropic-style key, no generic secret assignment.
    expect(html).not.toMatch(/sk-[a-zA-Z0-9-]{10,}/);
    expect(html).not.toMatch(/api[_-]?key/i);
    expect(html).not.toMatch(/anthropic/i);
  });
});
