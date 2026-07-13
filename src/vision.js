// Calories — Feature 002: vision-model calorie estimation.
//
// Calls the Anthropic Messages API directly with the built-in `fetch` (ADR-001: no
// @anthropic-ai/sdk, no new runtime dependency). The model's reply is constrained via
// `output_config.format` (structured outputs) to `{ food_identified: boolean, calories: integer|null }`
// so there is nothing free-text to trust. Every failure mode (refusal, timeout, network error,
// non-2xx, unparseable/non-integer reply) collapses to the SAME fail-closed `"unavailable"` result —
// the caller never receives a fabricated, default, or placeholder calorie value.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Human-picked tier (30-design.md, settled 2026-07-13): near-Opus vision accuracy at ~half the
// cost of Opus, intro pricing through 2026-08-31. A one-line swap if that changes later.
const MODEL = "claude-sonnet-5";

const MAX_TOKENS = 256; // single small extraction, not a conversation
const REQUEST_TIMEOUT_MS = 30_000; // AI Eval Card latency ceiling (30-design.md decision 4)

/**
 * Raster MIME types the vision API accepts. Anything else on `image/*` — including
 * `image/svg+xml` and other non-raster/degenerate subtypes — must be rejected with 415 by the
 * caller BEFORE this module is ever invoked (Story 2 / AC2.1–AC2.2; manifest R3/M1/M2).
 * @type {ReadonlyArray<string>}
 */
export const SUPPORTED_RASTER_MIME_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

/**
 * Is this normalised (lowercased, no `;` params) Content-Type on the supported raster allowlist?
 * @param {string} mime
 * @returns {boolean}
 */
export function isSupportedRasterMime(mime) {
  return SUPPORTED_RASTER_MIME_TYPES.includes(mime);
}

// Structured-output schema: the ONLY shape the model is allowed to reply with.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    food_identified: { type: "boolean" },
    calories: { anyOf: [{ type: "integer" }, { type: "null" }] },
  },
  required: ["food_identified", "calories"],
  additionalProperties: false,
};

const PROMPT_TEXT =
  "Look at this photo. Determine whether it clearly shows a recognizable food item or meal. " +
  "If it does, give your best estimate of the total calories for what is visible in the photo. " +
  "If you cannot identify food in the image, or cannot make a reasonable estimate, say so honestly " +
  "instead of guessing. Respond only through the structured output.";

/**
 * @typedef {{ status: "estimated", calories: number }} EstimatedResult
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
                source: { type: "base64", media_type: mime, data: imageBuffer.toString("base64") },
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

    return { status: "estimated", calories: parsed.calories };
  } catch {
    // Covers AbortError (timeout past the ceiling), DNS/connection failures, and any JSON.parse
    // error on the response body — all fail-closed, all indistinguishable to the caller.
    return UNAVAILABLE;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

/**
 * Extract and shape-check the structured `{ food_identified, calories }` reply from a raw Messages
 * API response body. Returns `null` for anything that doesn't match — the model's output is always
 * untrusted until it passes this check.
 * @param {any} data - parsed JSON body of the Messages API response
 * @returns {{ food_identified: boolean, calories: number|null } | null}
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
