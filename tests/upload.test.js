// Feature 001 — integration tests for the upload endpoint + served frontend.
// Every server AC is exercised with REAL HTTP requests against an ephemeral-port server.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createServer, MAX_UPLOAD_BYTES } from "../src/server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = join(__dirname, "..", "src", "index.html");

let server;
let base;

beforeAll(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// A tiny but non-empty "image" payload (bytes are all we check; MIME is from the header).
const jpegBytes = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

describe("POST /upload", () => {
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
