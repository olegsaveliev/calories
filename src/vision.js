// Calories — Feature 002: vision-model calorie estimation. Expanded in Feature 007 (food ID +
// confidence) — SAME single call, additive schema fields.
//
// Calls the Anthropic Messages API directly with the built-in `fetch` (ADR-001: no
// @anthropic-ai/sdk, no new runtime dependency). The model's reply is constrained via
// `output_config.format` (structured outputs) to
// `{ food_identified: boolean, calories: integer|null, food_name: string|null,
//    confidence: "low"|"medium"|"high"|null, items_count: integer|null }`
// so there is nothing free-text to trust without passing validation first. Every failure mode
// (refusal, timeout, network error, non-2xx, unparseable/non-integer reply) collapses to the SAME
// fail-closed `"unavailable"` result — the caller never receives a fabricated, default, or
// placeholder calorie value. The three 007 fields degrade independently and never affect that
// whole-response fail-closed behaviour (see the per-field validators below).

import { STRIPPABLE_MIME_TYPES, stripImageMetadata } from "./strip-metadata.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Human-picked tier (30-design.md, settled 2026-07-13): near-Opus vision accuracy at ~half the
// cost of Opus, intro pricing through 2026-08-31. A one-line swap if that changes later.
const MODEL = "claude-sonnet-5";

// 007 — raised from 256. The structured-output object grew from 2 fields to 5 (food_name,
// confidence, items_count added). 256 was already comfortable for the old 2-field shape, but a
// verbose food_name (unbounded by the schema — see RESPONSE_SCHEMA note below) plus the extra keys'
// JSON overhead could plausibly approach it. Since thinking is disabled, the WHOLE budget is
// reserved for the answer, so hitting max_tokens here means truncated JSON -> parse failure ->
// FALSE fail-closed on a perfectly good photo (30-design.md §2 "Build flag"). 1024 leaves generous
// headroom (a food_name would need to run past ~800+ chars of JSON-escaped text to threaten it,
// far beyond MAX_FOOD_NAME_LENGTH). NOTE: this bound is not currently covered by a test (review
// F3, accepted & logged) — verify it if the schema or field bounds grow.
const MAX_TOKENS = 1024;
const REQUEST_TIMEOUT_MS = 30_000; // AI Eval Card latency ceiling (30-design.md decision 4)

/**
 * Threat-model fix R15 — plausibility band on the model's integer.
 *
 * Type/sign validation alone accepts `999999999`, which would render as "~999999999 calories" — the
 * visible tail of prompt-injection risk R11, and a credibility hole. A single human meal plausibly
 * spans ~1–5000 kcal (5000 is well above any realistic single plate, so a true estimate is never
 * clipped; anything beyond it is garbage or an injected absurdity, not a meal).
 *
 * A number outside the band FAILS CLOSED through the existing "couldn't estimate" path. We do NOT
 * clamp it to the boundary: rewriting the model's answer into a plausible-looking one would be
 * fabricating a number, which is exactly what the AI Eval Card forbids.
 */
export const MIN_PLAUSIBLE_CALORIES = 1;
export const MAX_PLAUSIBLE_CALORIES = 5000;

/**
 * 007 — untrusted-text/validation constants for the three new structured-output fields
 * (30-design.md §3). Same posture as MIN/MAX_PLAUSIBLE_CALORIES above: reject-to-neutral, NEVER
 * rewrite/clamp/truncate. Each new field degrades independently and never affects the calorie
 * estimate itself (fail-closed for `calories` is unchanged from 002).
 */

/**
 * `food_name` is the FIRST model-generated free text this app has ever surfaced to a user. The
 * structured-output schema cannot express a max length (see RESPONSE_SCHEMA note), so this is the
 * only enforcement point. Long enough for real dish names, short enough to bound the pill.
 */
export const MAX_FOOD_NAME_LENGTH = 60;

/** Closed enum for `confidence` — re-checked here in JS as defense-in-depth on top of the schema's
 * own `enum` constraint (AC5.3). Case-sensitive, no synonyms, no numbers. */
export const CONFIDENCE_LEVELS = Object.freeze(["low", "medium", "high"]);

/** Plausibility band for `items_count`, mirroring the MIN/MAX_PLAUSIBLE_CALORIES pattern. A real
 * plate plausibly has 0-50 distinct visible items; anything outside that is a hallucination or an
 * injected absurdity, not a meal. */
export const MIN_PLAUSIBLE_ITEMS = 0;
export const MAX_PLAUSIBLE_ITEMS = 50;

/**
 * Reject-set for `food_name` (character policy = reject, don't strip — AC5.5). Matches:
 * - C0 controls (\x00-\x1F) and DEL (\x7F)
 * - C1 controls (\x80-\x9F)
 * - Zero-width characters (U+200B-U+200F: ZWSP/ZWNJ/ZWJ/LRM/RLM)
 * - Bidirectional embedding/override characters (U+202A-U+202E)
 * - Invisible math operators / word joiner (U+2060-U+2064)
 * - Zero-width no-break space / BOM (U+FEFF)
 * A single hit anywhere in the trimmed string means the WHOLE name is omitted — never stripped and
 * partially shown, which would itself be a rewrite of the model's answer.
 */
export const FOOD_NAME_DISALLOWED_RE =
  // eslint-disable-next-line no-control-regex -- deliberately matching control chars (see above)
  /[\x00-\x1F\x7F-\x9F\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/;

/**
 * Validate `food_name`: trim edge whitespace ONLY (the sole allowed normalization), then omit
 * (return null) if not a string, empty after trim, over-length, or containing any disallowed
 * code point. Never truncates, never rewrites the interior of the string.
 * @param {unknown} raw
 * @returns {string | null}
 */
function validateFoodName(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_FOOD_NAME_LENGTH) return null;
  if (FOOD_NAME_DISALLOWED_RE.test(trimmed)) return null;
  return trimmed;
}

/**
 * Validate `confidence`: trusted only if it is EXACTLY one of CONFIDENCE_LEVELS. Anything else
 * (off-enum, wrong case, free text, a number, null, missing) is omitted — never defaulted.
 * @param {unknown} raw
 * @returns {"low" | "medium" | "high" | null}
 */
function validateConfidence(raw) {
  return typeof raw === "string" && CONFIDENCE_LEVELS.includes(raw) ? raw : null;
}

/**
 * Validate `items_count`: a non-negative integer within the plausibility band. Out-of-range,
 * non-integer, or missing/null values are omitted — never clamped, never defaulted to 0.
 * @param {unknown} raw
 * @returns {number | null}
 */
function validateItemsCount(raw) {
  return Number.isInteger(raw) && raw >= MIN_PLAUSIBLE_ITEMS && raw <= MAX_PLAUSIBLE_ITEMS
    ? raw
    : null;
}

/**
 * MIME types allowed to reach the vision model.
 *
 * This is now exactly the set we can provably strip metadata from (R10) — see `strip-metadata.js`
 * for why `image/gif` and `image/webp` were dropped from the design's original allowlist. Anything
 * else, including `image/svg+xml` and degenerate `image/` subtypes, is rejected with 415 by the
 * caller BEFORE this module is ever invoked (Story 2 / AC2.1–AC2.2; manifest R3/M1/M2).
 * @type {ReadonlyArray<string>}
 */
export const SUPPORTED_RASTER_MIME_TYPES = STRIPPABLE_MIME_TYPES;

/**
 * Is this normalised (lowercased, no `;` params) Content-Type on the supported raster allowlist?
 * @param {string} mime
 * @returns {boolean}
 */
export function isSupportedRasterMime(mime) {
  return SUPPORTED_RASTER_MIME_TYPES.includes(mime);
}

// Structured-output schema: the ONLY shape the model is allowed to reply with.
//
// 007 — expanded to add food_name/confidence/items_count on the SAME call (verified against the
// claude-api structured-outputs reference, not from memory — 30-design.md §2): `enum` and
// `anyOf`/`null` ARE schema-enforced, but numeric (`minimum`/`maximum`) and string
// (`minLength`/`maxLength`) constraints are NOT supported by structured outputs and are silently
// unusable here (this app calls raw `fetch`, not the SDK, so there's no client-side fallback
// enforcement either). That split is why `confidence` gets a schema-level `enum` (defense-in-depth,
// AC5.3) while `food_name`'s length bound and `items_count`'s range live ONLY in the JS validators
// above (validateFoodName/validateItemsCount) — mirroring the existing calories plausibility band,
// which has always been JS-only for the same reason.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    food_identified: { type: "boolean" },
    calories: { anyOf: [{ type: "integer" }, { type: "null" }] },
    food_name: { anyOf: [{ type: "string" }, { type: "null" }] },
    confidence: {
      anyOf: [{ type: "string", enum: [...CONFIDENCE_LEVELS] }, { type: "null" }],
    },
    items_count: { anyOf: [{ type: "integer" }, { type: "null" }] },
  },
  required: ["food_identified", "calories", "food_name", "confidence", "items_count"],
  additionalProperties: false,
};

const PROMPT_TEXT =
  "Look at this photo. Determine whether it clearly shows a recognizable food item or meal. " +
  "If it does, give your best estimate of the total calories for what is visible in the photo, " +
  "a short plain-text name for the dish (no emoji, no markdown/formatting), your own confidence " +
  "in that identification as low, medium, or high, and a count of the distinct food items you can " +
  "see. If you cannot identify food in the image, or cannot make a reasonable estimate, say so " +
  "honestly instead of guessing. Respond only through the structured output.";

/**
 * @typedef {{
 *   status: "estimated",
 *   calories: number,
 *   foodName?: string,
 *   confidence?: "low" | "medium" | "high",
 *   itemsCount?: number,
 * }} EstimatedResult
 * @typedef {{ status: "no_food" }} NoFoodResult
 * @typedef {{ status: "unavailable" }} UnavailableResult
 * @typedef {EstimatedResult | NoFoodResult | UnavailableResult} CalorieResult
 */

/** Fail-closed constant returned for every non-"estimated"/"no_food" outcome. */
const UNAVAILABLE = Object.freeze({ status: "unavailable" });
const NO_FOOD = Object.freeze({ status: "no_food" });

/**
 * Ask the vision model for a calorie estimate for one image.
 *
 * Fails closed: a refusal, a request that exceeds the latency ceiling, a network error, a non-2xx
 * response, or a reply that doesn't parse into the expected `{ food_identified, calories }` shape
 * ALL become `{ status: "unavailable" }`. `{ status: "no_food" }` is the one recognised "the model
 * looked and didn't find a meal" outcome (AC3.1). Only `{ status: "estimated", calories }` carries a
 * number, and that number is always a validated non-negative integer — never model free text.
 *
 * @param {Buffer} imageBuffer - raw image bytes, already validated against the raster allowlist
 * @param {string} mime - one of SUPPORTED_RASTER_MIME_TYPES
 * @returns {Promise<CalorieResult>}
 */
export async function estimateCalories(imageBuffer, mime) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No key configured server-side (ADR-001: key is env-only, never committed) — fail closed
    // instead of making a request that would 401.
    return UNAVAILABLE;
  }

  // R10(a) — LAST CHOKE POINT BEFORE EGRESS. The photo is about to cross TB-3 to a third party;
  // strip EXIF/GPS/timestamp/comment metadata first. A buffer we cannot provably strip fails closed
  // here and is NEVER sent unstripped. Everything downstream uses `safeBuffer`, not `imageBuffer`.
  const safeBuffer = stripImageMetadata(imageBuffer, mime);
  if (!safeBuffer) {
    return UNAVAILABLE;
  }

  const controller = new globalThis.AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // Review fix M1 — explicitly disable thinking (30-design.md decision 3: "no extended
        // thinking"). On claude-sonnet-5, OMITTING this field means adaptive thinking ON, and
        // thinking tokens share max_tokens — a real photo could exhaust the 256-token budget
        // before the structured JSON was emitted (stop_reason: max_tokens → parse fail →
        // fail-closed on a VALID photo). Disabling reserves the whole budget for the answer.
        thinking: { type: "disabled" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mime, data: safeBuffer.toString("base64") },
              },
              { type: "text", text: PROMPT_TEXT },
            ],
          },
        ],
        output_config: {
          format: { type: "json_schema", schema: RESPONSE_SCHEMA },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return UNAVAILABLE;
    }

    const data = await response.json();

    // Refusal — never attempt to read `content` for a refused response (per skill guidance:
    // always branch on stop_reason before touching content).
    if (data.stop_reason === "refusal") {
      return UNAVAILABLE;
    }

    const parsed = extractStructuredReply(data);
    if (!parsed) {
      return UNAVAILABLE;
    }

    if (parsed.food_identified === false || parsed.calories === null) {
      return NO_FOOD;
    }

    // Treat the model's number as untrusted until it's proven to be a sane non-negative integer.
    if (!Number.isInteger(parsed.calories) || parsed.calories < 0) {
      return UNAVAILABLE;
    }

    // R15 — plausibility band. An absurd-but-well-typed value (hallucinated, or injected via text in
    // the pixels) fails closed rather than rendering as a number. NOT clamped to the boundary: we
    // never rewrite the model's answer into a plausible-looking one.
    if (parsed.calories < MIN_PLAUSIBLE_CALORIES || parsed.calories > MAX_PLAUSIBLE_CALORIES) {
      return UNAVAILABLE;
    }

    // 007 — per-field fail-closed (30-design.md §3/§4): each new field is validated INDEPENDENTLY
    // and, if it doesn't pass, is simply OMITTED from the result (not set to null, not defaulted).
    // None of this can ever flip a good calorie estimate to unavailable/no_food — the whole-response
    // fail-closed above (refusal / bad food_identified / null or implausible calories) is unchanged.
    /** @type {EstimatedResult} */
    const result = { status: "estimated", calories: parsed.calories };

    const foodName = validateFoodName(parsed.food_name);
    if (foodName !== null) result.foodName = foodName;

    const confidence = validateConfidence(parsed.confidence);
    if (confidence !== null) result.confidence = confidence;

    const itemsCount = validateItemsCount(parsed.items_count);
    if (itemsCount !== null) result.itemsCount = itemsCount;

    return result;
  } catch {
    // Covers AbortError (timeout past the ceiling), DNS/connection failures, and any JSON.parse
    // error on the response body — all fail-closed, all indistinguishable to the caller.
    return UNAVAILABLE;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

/**
 * Extract and shape-check the structured reply from a raw Messages API response body. Only
 * `food_identified`/`calories` are required here (AC1.2/AC1.4 — this story adds fields, it does
 * not change the meaning or validation of the existing two); the 007 fields (`food_name`,
 * `confidence`, `items_count`) are read through untouched — whatever the caller passed for them
 * (including missing/wrong-shaped) is validated separately, per-field, by the caller. Returns
 * `null` for anything that doesn't match the required shape — the model's output is always
 * untrusted until it passes this check.
 * @param {any} data - parsed JSON body of the Messages API response
 * @returns {{
 *   food_identified: boolean,
 *   calories: number|null,
 *   food_name?: unknown,
 *   confidence?: unknown,
 *   items_count?: unknown,
 * } | null}
 */
function extractStructuredReply(data) {
  const content = Array.isArray(data && data.content) ? data.content : [];
  const textBlock = content.find((block) => block && block.type === "text");
  if (!textBlock || typeof textBlock.text !== "string") return null;

  let obj;
  try {
    obj = JSON.parse(textBlock.text);
  } catch {
    return null;
  }

  if (typeof obj !== "object" || obj === null) return null;
  if (typeof obj.food_identified !== "boolean") return null;
  if (obj.calories !== null && typeof obj.calories !== "number") return null;

  return obj;
}
