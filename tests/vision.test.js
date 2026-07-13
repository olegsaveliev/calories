// Feature 002 — unit tests for the vision-model calorie estimation module.
// The outbound `fetch` to the Anthropic Messages API is always mocked — these tests never make a
// real network call, and pass whether or not a real ANTHROPIC_API_KEY is present in the environment.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  estimateCalories,
  isSupportedRasterMime,
  SUPPORTED_RASTER_MIME_TYPES,
  MIN_PLAUSIBLE_CALORIES,
  MAX_PLAUSIBLE_CALORIES,
} from "../src/vision.js";
import { jpegWithExif, pngWithMetadata, SECRET_GPS_MARKER } from "./image-fixtures.js";

// A structurally valid JPEG carrying EXIF — i.e. what a real phone photo looks like.
const IMAGE_BYTES = jpegWithExif();

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

/** Pull the base64 image payload out of what the code actually POSTed to Anthropic. */
function outboundImageBase64(fetchMock) {
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  return body.messages[0].content.find((b) => b.type === "image").source.data;
}

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-real");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("isSupportedRasterMime", () => {
  it("accepts every type on the documented allowlist", () => {
    for (const mime of SUPPORTED_RASTER_MIME_TYPES) {
      expect(isSupportedRasterMime(mime)).toBe(true);
    }
  });

  it("rejects image/svg+xml (non-raster, scriptable)", () => {
    expect(isSupportedRasterMime("image/svg+xml")).toBe(false);
  });

  it("rejects a degenerate image/* subtype not on the allowlist", () => {
    expect(isSupportedRasterMime("image/x-icon")).toBe(false);
  });

  it("rejects a non-image type", () => {
    expect(isSupportedRasterMime("text/plain")).toBe(false);
  });

  it("R10 — rejects gif/webp, which we cannot provably strip metadata from", () => {
    expect(isSupportedRasterMime("image/gif")).toBe(false);
    expect(isSupportedRasterMime("image/webp")).toBe(false);
  });
});

describe("estimateCalories", () => {
  it("returns an estimated result for a valid structured reply", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ food_identified: true, calories: 610 })),
    );

    const result = await estimateCalories(IMAGE_BYTES, "image/jpeg");
    expect(result).toEqual({ status: "estimated", calories: 610 });
  });

  it("sends the model, max_tokens, image, and structured-output schema the design specifies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ food_identified: true, calories: 100 }));
    vi.stubGlobal("fetch", fetchMock);

    await estimateCalories(pngWithMetadata(), "image/png");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["x-api-key"]).toBe("test-key-not-real");
    expect(init.headers["anthropic-version"]).toBe("2023-06-01");

    const body = JSON.parse(init.body);
    expect(body.model).toBe("claude-sonnet-5");
    expect(body.max_tokens).toBeLessThanOrEqual(1024);
    // Review fix M1 — thinking must be EXPLICITLY disabled: omitting it turns adaptive thinking
    // on for claude-sonnet-5, and thinking tokens would share the small max_tokens budget with
    // the structured JSON answer.
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body.output_config.format.schema.required).toEqual(
      expect.arrayContaining(["food_identified", "calories"]),
    );
    const imageBlock = body.messages[0].content.find((b) => b.type === "image");
    expect(imageBlock.source.media_type).toBe("image/png");
    expect(imageBlock.source.type).toBe("base64");
  });

  // --- R10(a): nothing with metadata may cross the egress boundary ----------------------------

  it("R10 — the JPEG that egresses has its EXIF/GPS stripped", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ food_identified: true, calories: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    // The source photo definitely carries the GPS needle.
    expect(IMAGE_BYTES.includes(SECRET_GPS_MARKER)).toBe(true);

    await estimateCalories(IMAGE_BYTES, "image/jpeg");

    const sent = Buffer.from(outboundImageBase64(fetchMock), "base64");
    expect(sent.includes(SECRET_GPS_MARKER)).toBe(false); // GPS never left the machine
    expect(sent.length).toBeLessThan(IMAGE_BYTES.length);
    expect(sent.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8])); // still a valid JPEG
  });

  it("R10 — the PNG that egresses has its eXIf/tEXt chunks stripped", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ food_identified: true, calories: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await estimateCalories(pngWithMetadata(), "image/png");

    const sent = Buffer.from(outboundImageBase64(fetchMock), "base64");
    expect(sent.includes(SECRET_GPS_MARKER)).toBe(false);
    expect(sent.includes("eXIf")).toBe(false);
  });

  it("R10 — an image that cannot be stripped fails closed and is NEVER sent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // Bytes labelled image/jpeg that aren't a parseable JPEG → we cannot prove the metadata is gone.
    const result = await estimateCalories(Buffer.from([0x00, 0x01, 0x02, 0x03]), "image/jpeg");

    expect(result).toEqual({ status: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled(); // no egress, no spend
  });

  // --- R15: plausibility band -----------------------------------------------------------------

  it("R15 — an absurd but well-typed calorie value fails closed (not clamped)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ food_identified: true, calories: 999999999 })),
    );

    const result = await estimateCalories(IMAGE_BYTES, "image/jpeg");
    // Fails closed through the existing "couldn't estimate" path — and crucially does NOT come back
    // as a plausible-looking clamped number like MAX_PLAUSIBLE_CALORIES.
    expect(result).toEqual({ status: "unavailable" });
    expect(result.calories).toBeUndefined();
  });

  it("R15 — zero calories (below the band) fails closed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ food_identified: true, calories: 0 })),
    );

    expect(await estimateCalories(IMAGE_BYTES, "image/jpeg")).toEqual({ status: "unavailable" });
  });

  it("R15 — values at the band edges are accepted unchanged", async () => {
    for (const calories of [MIN_PLAUSIBLE_CALORIES, MAX_PLAUSIBLE_CALORIES]) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({ food_identified: true, calories })),
      );
      expect(await estimateCalories(IMAGE_BYTES, "image/jpeg")).toEqual({
        status: "estimated",
        calories,
      });
    }
  });

  it("R15 — one over the band fails closed", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ food_identified: true, calories: MAX_PLAUSIBLE_CALORIES + 1 }),
        ),
    );

    expect(await estimateCalories(IMAGE_BYTES, "image/jpeg")).toEqual({ status: "unavailable" });
  });

  // --- existing fail-closed matrix -------------------------------------------------------------

  it("returns no_food when the model reports food_identified: false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ food_identified: false, calories: null })),
    );

    const result = await estimateCalories(IMAGE_BYTES, "image/jpeg");
    expect(result).toEqual({ status: "no_food" });
  });

  it("returns no_food when calories is null even if food_identified is true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ food_identified: true, calories: null })),
    );

    const result = await estimateCalories(IMAGE_BYTES, "image/jpeg");
    expect(result).toEqual({ status: "no_food" });
  });

  it("fails closed on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));

    const result = await estimateCalories(IMAGE_BYTES, "image/jpeg");
    expect(result).toEqual({ status: "unavailable" });
  });

  it("fails closed on stop_reason 'refusal' without inspecting content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ stop_reason: "refusal", content: [{ type: "text", text: "irrelevant" }] }),
      }),
    );

    const result = await estimateCalories(IMAGE_BYTES, "image/jpeg");
    expect(result).toEqual({ status: "unavailable" });
  });

  it("fails closed when the reply body isn't valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          stop_reason: "end_turn",
          content: [{ type: "text", text: "the model said something free-text, not JSON" }],
        }),
      }),
    );

    const result = await estimateCalories(IMAGE_BYTES, "image/jpeg");
    expect(result).toEqual({ status: "unavailable" });
  });

  it("fails closed when calories is a non-integer number (untrusted model output)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ food_identified: true, calories: 450.7 })),
    );

    const result = await estimateCalories(IMAGE_BYTES, "image/jpeg");
    expect(result).toEqual({ status: "unavailable" });
  });

  it("fails closed when calories is negative (untrusted model output)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ food_identified: true, calories: -5 })),
    );

    const result = await estimateCalories(IMAGE_BYTES, "image/jpeg");
    expect(result).toEqual({ status: "unavailable" });
  });

  it("fails closed on a network error (fetch rejects)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await estimateCalories(IMAGE_BYTES, "image/jpeg");
    expect(result).toEqual({ status: "unavailable" });
  });

  it("fails closed on an aborted (timed-out) request without waiting for the real ceiling", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    const result = await estimateCalories(IMAGE_BYTES, "image/jpeg");
    expect(result).toEqual({ status: "unavailable" });
  });

  it("fails closed and never calls fetch when ANTHROPIC_API_KEY is not set", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await estimateCalories(IMAGE_BYTES, "image/jpeg");
    expect(result).toEqual({ status: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
