// Feature 002 — unit tests for the vision-model calorie estimation module.
// The outbound `fetch` to the Anthropic Messages API is always mocked — these tests never make a
// real network call, and pass whether or not a real ANTHROPIC_API_KEY is present in the environment.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { estimateCalories, isSupportedRasterMime, SUPPORTED_RASTER_MIME_TYPES } from "../src/vision.js";

const IMAGE_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

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

    await estimateCalories(IMAGE_BYTES, "image/png");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["x-api-key"]).toBe("test-key-not-real");
    expect(init.headers["anthropic-version"]).toBe("2023-06-01");

    const body = JSON.parse(init.body);
    expect(body.model).toBe("claude-sonnet-5");
    expect(body.max_tokens).toBeLessThanOrEqual(1024);
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body.output_config.format.schema.required).toEqual(
      expect.arrayContaining(["food_identified", "calories"]),
    );
    const imageBlock = body.messages[0].content.find((b) => b.type === "image");
    expect(imageBlock.source.media_type).toBe("image/png");
    expect(imageBlock.source.data).toBe(IMAGE_BYTES.toString("base64"));
  });

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
