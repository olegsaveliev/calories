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
import {
  resetRateLimits,
  RATE_LIMIT_MAX_PER_WINDOW,
  MAX_CONCURRENT_VISION_CALLS,
} from "../src/rate-limit.js";
import { jpegWithExif, pngWithMetadata, SECRET_GPS_MARKER } from "./image-fixtures.js";

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
  resetRateLimits(); // R9 — every test starts with a full call budget
});

// A structurally valid JPEG carrying EXIF/GPS — the metadata strip (R10) runs on the real bytes,
// so the fixture has to actually parse as a JPEG.
const jpegBytes = () => jpegWithExif();

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
      body: pngWithMetadata(), // must really BE a PNG — the R10 strip parses it before egress
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

  it("R10 — gif/webp are now rejected with 415 (we cannot provably strip their metadata)", async () => {
    for (const mime of ["image/gif", "image/webp"]) {
      const res = await fetch(`${base}/upload`, {
        method: "POST",
        headers: { "Content-Type": mime },
        body: new Uint8Array([1, 2, 3, 4]),
      });
      expect(res.status).toBe(415);
    }
    expect(anthropicCallCount).toBe(0);
  });
});

describe("POST /upload — R9: vision-call cost guard (rate limit + concurrency)", () => {
  it("returns 429 once one IP exceeds its per-window call budget, WITHOUT spending a call", async () => {
    const send = () =>
      fetch(`${base}/upload`, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: jpegBytes(),
      });

    // Spend exactly the budget — all of these are allowed to hit the model.
    for (let i = 0; i < RATE_LIMIT_MAX_PER_WINDOW; i++) {
      const res = await send();
      expect(res.status).toBe(200);
    }
    expect(anthropicCallCount).toBe(RATE_LIMIT_MAX_PER_WINDOW);

    // One more is refused BEFORE the API call — the call count must not move.
    const denied = await send();
    expect(denied.status).toBe(429);
    const json = await denied.json();
    expect(typeof json.error).toBe("string");
    expect(json.calorieResult).toBeUndefined(); // no number, no fake estimate
    expect(anthropicCallCount).toBe(RATE_LIMIT_MAX_PER_WINDOW); // nothing extra was spent
  });

  it("caps concurrent in-flight vision calls — the overflow request gets 429, not a model call", async () => {
    // Hold every in-flight model call open until we say so.
    let releaseAll;
    const gate = new Promise((resolve) => {
      releaseAll = resolve;
    });
    anthropicImpl = async () => {
      await gate;
      return jsonResponse({ food_identified: true, calories: 400 });
    };

    const send = () =>
      fetch(`${base}/upload`, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: jpegBytes(),
      });

    // Fire one more than the concurrency cap, all at once.
    const inFlight = [];
    for (let i = 0; i < MAX_CONCURRENT_VISION_CALLS + 1; i++) inFlight.push(send());

    // Let them all reach the handler: the ones that took a slot are now parked on the gate, and the
    // overflow one has already been refused. THEN let the held model calls finish.
    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));
    expect(anthropicCallCount).toBeLessThanOrEqual(MAX_CONCURRENT_VISION_CALLS); // cap held
    releaseAll();

    const responses = await Promise.all(inFlight);
    const statuses = responses.map((r) => r.status);

    expect(statuses).toContain(429); // the overflow request was refused, not queued
    expect(statuses.filter((s) => s === 200).length).toBe(MAX_CONCURRENT_VISION_CALLS);
    expect(anthropicCallCount).toBeLessThanOrEqual(MAX_CONCURRENT_VISION_CALLS);
  });

  it("a 429 is not a fabricated estimate — the client gets an error, never a number", async () => {
    for (let i = 0; i < RATE_LIMIT_MAX_PER_WINDOW; i++) {
      await fetch(`${base}/upload`, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: jpegBytes(),
      });
    }
    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: jpegBytes(),
    });
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.ok).toBeUndefined();
    expect(JSON.stringify(json)).not.toMatch(/calories/i);
  });
});

describe("POST /upload — R10: the photo that egresses is stripped", () => {
  it("the bytes sent to Anthropic carry no EXIF/GPS from the uploaded photo", async () => {
    let sentBase64 = null;
    anthropicImpl = (_url, init) => {
      const body = JSON.parse(init.body);
      sentBase64 = body.messages[0].content.find((b) => b.type === "image").source.data;
      return Promise.resolve(jsonResponse({ food_identified: true, calories: 420 }));
    };

    const photo = jpegBytes();
    expect(Buffer.from(photo).includes(SECRET_GPS_MARKER)).toBe(true); // the upload HAS GPS in it

    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: photo,
    });
    expect(res.status).toBe(200);

    const sent = Buffer.from(sentBase64, "base64");
    expect(sent.includes(SECRET_GPS_MARKER)).toBe(false); // ...and the third party never saw it
  });
});

describe("POST /upload — R15: implausible numbers fail closed", () => {
  it("an absurd calorie value comes back as 'unavailable', never as a number", async () => {
    anthropicImpl = () => Promise.resolve(jsonResponse({ food_identified: true, calories: 999999999 }));

    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: jpegBytes(),
    });

    const json = await res.json();
    expect(json.calorieResult).toEqual({ status: "unavailable" });
    expect(json.calorieResult.calories).toBeUndefined(); // not clamped to a plausible-looking number
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

describe("POST /upload — 007: food ID + confidence (end-to-end contract)", () => {
  it("AC1.1/AC6.4 — a valid reply carries foodName/confidence/itemsCount alongside calories, additively", async () => {
    anthropicImpl = () =>
      Promise.resolve(
        jsonResponse({
          food_identified: true,
          calories: 480,
          food_name: "Grilled salmon with rice",
          confidence: "high",
          items_count: 3,
        }),
      );

    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: jpegBytes(),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    // ok/size/type byte-for-byte unchanged (AC6.4).
    expect(json.ok).toBe(true);
    expect(typeof json.size).toBe("number");
    expect(json.type).toBe("image/jpeg");
    expect(json.calorieResult).toEqual({
      status: "estimated",
      calories: 480,
      foodName: "Grilled salmon with rice",
      confidence: "high",
      itemsCount: 3,
    });
    expect(anthropicCallCount).toBe(1); // AC1.3 — still exactly one round-trip
  });

  it("AC6.1 — a fully-degraded reply (all three invalid) still renders the calorie estimate, old shape preserved", async () => {
    anthropicImpl = () =>
      Promise.resolve(
        jsonResponse({
          food_identified: true,
          calories: 300,
          food_name: null,
          confidence: "extremely high", // off-enum
          items_count: -1, // out of range
        }),
      );

    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: jpegBytes(),
    });

    const json = await res.json();
    // Byte-identical to the pre-007 shape: no foodName/confidence/itemsCount keys present at all.
    expect(json.calorieResult).toEqual({ status: "estimated", calories: 300 });
    expect(Object.keys(json.calorieResult).sort()).toEqual(["calories", "status"]);
  });

  it("AC2.3/AC5.1 — an over-length food_name is omitted entirely, never truncated", async () => {
    const overLong = "a".repeat(61); // MAX_FOOD_NAME_LENGTH is 60
    anthropicImpl = () =>
      Promise.resolve(
        jsonResponse({
          food_identified: true,
          calories: 250,
          food_name: overLong,
          confidence: "low",
          items_count: 2,
        }),
      );

    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: jpegBytes(),
    });

    const json = await res.json();
    expect(json.calorieResult.foodName).toBeUndefined();
    expect(JSON.stringify(json.calorieResult)).not.toContain("a".repeat(61));
    // The other two fields are unaffected by foodName's rejection (independent per-field degrade).
    expect(json.calorieResult.confidence).toBe("low");
    expect(json.calorieResult.itemsCount).toBe(2);
  });

  it("AC4.2 — an off-enum confidence value is omitted, never defaulted", async () => {
    anthropicImpl = () =>
      Promise.resolve(
        jsonResponse({
          food_identified: true,
          calories: 250,
          food_name: "Soup",
          confidence: "Medium", // wrong case — not exactly "low"|"medium"|"high"
          items_count: 1,
        }),
      );

    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: jpegBytes(),
    });

    const json = await res.json();
    expect(json.calorieResult.confidence).toBeUndefined();
    expect(json.calorieResult.foodName).toBe("Soup");
  });

  it("AC3.2 — an out-of-range itemsCount is omitted, never clamped", async () => {
    anthropicImpl = () =>
      Promise.resolve(
        jsonResponse({
          food_identified: true,
          calories: 250,
          food_name: "Soup",
          confidence: "medium",
          items_count: 51, // one over MAX_PLAUSIBLE_ITEMS
        }),
      );

    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: jpegBytes(),
    });

    const json = await res.json();
    expect(json.calorieResult.itemsCount).toBeUndefined();
  });

  it("AC1.4/AC1.5/AC2.5 — no_food / unavailable never carry any of the three new fields", async () => {
    anthropicImpl = () =>
      Promise.resolve(
        jsonResponse({
          food_identified: false,
          calories: null,
          food_name: "Something",
          confidence: "high",
          items_count: 5,
        }),
      );

    const res = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: jpegBytes(),
    });

    const json = await res.json();
    expect(json.calorieResult).toEqual({ status: "no_food" });
  });
});

describe("GET / (served frontend) — 003 Midnight Lime rebuild", () => {
  it("AC1.1/AC1.2/AC8.2 — Pick screen: keyboard-operable dropzone as the file-input target, narrowed to JPEG/PNG", async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();

    expect(html).toContain('data-testid="pick-screen"');
    expect(html).toContain('data-testid="dropzone"');
    expect(html).toContain('data-testid="file-input"');
    // Narrowed from the 002 `accept="image/*"` debt (manifest) — client UX guard, AC1.4/AC8.2.
    expect(html).toContain('accept="image/jpeg,image/png"');
    expect(html).not.toContain('accept="image/*"');
  });

  it("AC1.1/AC8.3 — the 'Estimate calories' CTA ships disabled by default (native disabled + aria-disabled)", async () => {
    const html = await readFile(INDEX_HTML, "utf8");
    const ctaMatch = html.match(/<button[^>]*data-testid="estimate-cta"[^>]*>/);
    expect(ctaMatch).not.toBeNull();
    const ctaTag = ctaMatch[0];
    expect(ctaTag).toContain("disabled");
    expect(ctaTag).toContain('aria-disabled="true"');
    expect(html).toMatch(/estimate calories/i);
  });

  it("BUG-001 — dropzone-empty content is a centred flex column (icon centred, label directly under it)", async () => {
    const html = await readFile(INDEX_HTML, "utf8");

    // The icon + labels live inside #dropzone-empty. Without its own centring rule the 64px icon
    // aligns to the block's left edge (see .factory/bugs.md BUG-001). Guard: the rule must exist and
    // declare a centred flex column so the icon is centred with the label stacked beneath it.
    const ruleMatch = html.match(/#dropzone-empty\s*\{([^}]*)\}/);
    expect(ruleMatch).not.toBeNull();
    const rule = ruleMatch[1].replace(/\s+/g, " ");
    expect(rule).toMatch(/display:\s*flex/);
    expect(rule).toMatch(/flex-direction:\s*column/);
    expect(rule).toMatch(/align-items:\s*center/);
  });

  it("AC3.1/AC3.4/AC4.1/AC4.2 — Result screen: hero-number container, error-state container, and reset controls all present", async () => {
    const html = await readFile(INDEX_HTML, "utf8");

    expect(html).toContain('data-testid="result-screen"');
    expect(html).toContain('data-testid="hero-number"');
    expect(html).toContain('data-testid="hero-value"');
    expect(html).toContain('data-testid="error-message"');
    expect(html).toContain('data-testid="back-button"');
    expect(html).toContain('data-testid="new-photo-button"');
    expect(html).toContain('data-testid="try-again-button"');
    expect(html).toContain('data-testid="result-photo"');
  });

  it("007 — the food-name pill and both stat tiles are wired (present, hidden/neutral by default), never hardcoded demo values", async () => {
    const html = await readFile(INDEX_HTML, "utf8");

    // The mock's demo values must NEVER appear anywhere in the shipped markup/script, even though
    // the fields themselves are now wired — a real value only ever comes from the model response
    // at runtime, never from a literal in the page (revises the 003 negative assertion per
    // 30-design.md's closing note / AC6.3 — this was always scoped "until 007 wires these fields").
    expect(html).not.toMatch(/642/);
    expect(html).not.toMatch(/grilled chicken bowl/i);
    expect(html).not.toMatch(/3\s*items seen/i); // no hardcoded item count
    expect(html).not.toMatch(/±\s?\d/); // no "± NN" range anywhere — still out of scope
    expect(html).not.toMatch(/high confidence/i);

    // The food-name pill DOM hook now exists, ships hidden by default (AC2.2 — omitted, not an
    // empty pill), and is populated exclusively via textContent (never innerHTML/insertAdjacentHTML
    // — AC2.4/AC5.2/AC5.5).
    const pillMatch = html.match(/<div[^>]*data-testid="food-name-pill"[^>]*>/);
    expect(pillMatch).not.toBeNull();
    expect(pillMatch[0]).toContain("hidden");
    // Real usage, not just the word appearing in a comment discussing why it's avoided.
    expect(html).not.toMatch(/\.innerHTML\s*=/);
    expect(html).not.toMatch(/\.insertAdjacentHTML\s*\(/);

    // The two stat tiles are present, ship as the neutral "—" in the static markup (the real value
    // is written in by the script at runtime — AC3.1/AC3.3/AC4.1/AC4.3).
    expect(html).toContain('data-testid="stat-value-1"');
    expect(html).toContain('data-testid="stat-value-2"');
    const statValues = [...html.matchAll(/data-testid="stat-value-\d"[^>]*>([^<]*)</g)].map((m) => m[1].trim());
    expect(statValues.length).toBe(2);
    for (const v of statValues) expect(v).toBe("—");
  });
});

describe("AC2.5 — no secret in client code", () => {
  it("served index.html contains no API key / secret", async () => {
    const html = await readFile(INDEX_HTML, "utf8");
    // No Anthropic-style key, no key-shaped identifier, no env var name.
    expect(html).not.toMatch(/sk-[a-zA-Z0-9-]{10,}/);
    expect(html).not.toMatch(/api[_-]?key/i);
    expect(html).not.toMatch(/ANTHROPIC_API_KEY/);
    // NOTE: this used to also forbid /anthropic/i outright. R10(b) requires the page to NAME the
    // third party the photo is sent to, so the vendor's name is now expected in the copy. The scan
    // above still catches an actual key/secret, which is what AC2.5 is really about.
  });
});

describe("R10(b) / AC7.3 — the user is told the photo leaves the machine", () => {
  it("served index.html carries a plain-language third-party notice (003 restyled copy, same substance)", async () => {
    const res = await fetch(`${base}/`);
    const html = await res.text();

    expect(html).toContain('data-testid="privacy-notice"');
    expect(html).toMatch(/sent to Anthropic/i); // names the third party
    expect(html).toMatch(/metadata is\s+stripped/i); // says what we do, before egress
    expect(html).toMatch(/is stored here/i); // says nothing is retained
  });
});
