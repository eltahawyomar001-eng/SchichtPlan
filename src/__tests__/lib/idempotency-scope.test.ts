/**
 * Who a cached response belongs to.
 *
 * The cache was keyed by `{ip}:{key}`, consulted BEFORE the request
 * authenticated. Two people behind one NAT -- every guard at a shared site,
 * every office -- who happened to use the same Idempotency-Key value would
 * read each other's responses. The key ignored route, method and body, so one
 * key could also replay an unrelated operation's result, and errors were
 * cached for 24 hours so a transient failure became a day-long one.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { mockRequireAuth } = vi.hoisted(() => ({ mockRequireAuth: vi.fn() }));

// No Redis in tests: idempotency.ts owns a private getRedis() that returns
// null without credentials and falls back to its in-memory LRU. That fallback
// is the real code path here, so everything is asserted through the public
// API -- a test reaching for an internal store would only prove it could not
// see one.
vi.mock("@/lib/api-response", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const asUser = (id: string, workspaceId = "ws1") => ({
  ok: true as const,
  user: { id, workspaceId },
  workspaceId,
});

function post(body: unknown, key = "key-1") {
  return new Request("http://localhost/api/absences", {
    method: "POST",
    headers: { "Content-Type": "application/json", "idempotency-key": key },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  // The fallback cache is module state; a fresh module gives a clean one.
  vi.resetModules();
});

async function lib() {
  return import("@/lib/idempotency");
}

describe("a cached response belongs to one identity", () => {
  it("is not served to a different user with the same key", async () => {
    const { checkIdempotency, cacheIdempotentResponse } = await lib();
    mockRequireAuth.mockResolvedValue(asUser("user-a"));
    await cacheIdempotentResponse(
      post({ x: 1 }),
      NextResponse.json({ secret: "A" }, { status: 201 }),
      "/api/absences",
      "POST",
    );

    // Same NAT, same key, different person.
    mockRequireAuth.mockResolvedValue(asUser("user-b"));
    expect(
      await checkIdempotency(post({ x: 1 }), "/api/absences", "POST"),
    ).toBeNull();
  });

  it("is not served across workspaces", async () => {
    const { checkIdempotency, cacheIdempotentResponse } = await lib();
    mockRequireAuth.mockResolvedValue(asUser("user-a", "ws1"));
    await cacheIdempotentResponse(
      post({ x: 1 }),
      NextResponse.json({ ok: true }, { status: 201 }),
      "/api/absences",
      "POST",
    );
    mockRequireAuth.mockResolvedValue(asUser("user-a", "ws2"));
    expect(
      await checkIdempotency(post({ x: 1 }), "/api/absences", "POST"),
    ).toBeNull();
  });

  it("is served back to the same user", async () => {
    // The feature still has to work.
    const { checkIdempotency, cacheIdempotentResponse } = await lib();
    mockRequireAuth.mockResolvedValue(asUser("user-a"));
    await cacheIdempotentResponse(
      post({ x: 1 }),
      NextResponse.json({ id: "abs-1" }, { status: 201 }),
      "/api/absences",
      "POST",
    );
    const replay = await checkIdempotency(
      post({ x: 1 }),
      "/api/absences",
      "POST",
    );
    expect(replay).not.toBeNull();
    expect(replay!.headers.get("Idempotency-Replayed")).toBe("true");
    expect(await replay!.json()).toEqual({ id: "abs-1" });
  });
});

describe("a key is bound to one operation", () => {
  beforeEach(() => mockRequireAuth.mockResolvedValue(asUser("user-a")));

  it("does not replay across routes", async () => {
    const { checkIdempotency, cacheIdempotentResponse } = await lib();
    await cacheIdempotentResponse(
      post({ x: 1 }),
      NextResponse.json({ from: "absences" }, { status: 201 }),
      "/api/absences",
      "POST",
    );
    expect(
      await checkIdempotency(post({ x: 1 }), "/api/clients", "POST"),
    ).toBeNull();
  });

  it("does not replay across methods", async () => {
    const { checkIdempotency, cacheIdempotentResponse } = await lib();
    await cacheIdempotentResponse(
      post({ x: 1 }),
      NextResponse.json({ ok: true }, { status: 201 }),
      "/api/absences",
      "POST",
    );
    expect(
      await checkIdempotency(post({ x: 1 }), "/api/absences", "DELETE"),
    ).toBeNull();
  });

  it("does not replay when the body differs", async () => {
    // Reusing a key with a changed payload is a client bug; returning the old
    // result would hide it and silently discard the new request.
    const { checkIdempotency, cacheIdempotentResponse } = await lib();
    await cacheIdempotentResponse(
      post({ days: 1 }),
      NextResponse.json({ ok: true }, { status: 201 }),
      "/api/absences",
      "POST",
    );
    expect(
      await checkIdempotency(post({ days: 30 }), "/api/absences", "POST"),
    ).toBeNull();
  });
});

describe("authentication gates the cache", () => {
  it("never serves a cached success to an unauthenticated caller", async () => {
    const { checkIdempotency, cacheIdempotentResponse } = await lib();
    mockRequireAuth.mockResolvedValue(asUser("user-a"));
    await cacheIdempotentResponse(
      post({ x: 1 }),
      NextResponse.json({ secret: "A" }, { status: 201 }),
      "/api/absences",
      "POST",
    );

    mockRequireAuth.mockResolvedValue({
      ok: false,
      response: new NextResponse(null, { status: 401 }),
    });
    expect(
      await checkIdempotency(post({ x: 1 }), "/api/absences", "POST"),
    ).toBeNull();
  });

  it("stores nothing for an unauthenticated request", async () => {
    const { checkIdempotency, cacheIdempotentResponse } = await lib();
    mockRequireAuth.mockResolvedValue({
      ok: false,
      response: new NextResponse(null, { status: 401 }),
    });
    await cacheIdempotentResponse(
      post({ x: 1 }),
      NextResponse.json({ ok: true }, { status: 201 }),
      "/api/absences",
      "POST",
    );
    // Now authenticate properly: nothing may be waiting under that key.
    mockRequireAuth.mockResolvedValue(asUser("user-a"));
    expect(
      await checkIdempotency(post({ x: 1 }), "/api/absences", "POST"),
    ).toBeNull();
  });
});

describe("only successes are replayable", () => {
  beforeEach(() => mockRequireAuth.mockResolvedValue(asUser("user-a")));

  it.each([400, 403, 409, 500])("does not cache a %i", async (status) => {
    // A failure should be retried, not remembered for 24 hours. A cached 500
    // turned a transient blip into a day-long outage for that key.
    const { checkIdempotency, cacheIdempotentResponse } = await lib();
    mockRequireAuth.mockResolvedValue(asUser("user-a"));
    await cacheIdempotentResponse(
      post({ x: 1 }),
      NextResponse.json({ error: "nope" }, { status }),
      "/api/absences",
      "POST",
    );
    expect(
      await checkIdempotency(post({ x: 1 }), "/api/absences", "POST"),
    ).toBeNull();
  });

  it.each([200, 201])("caches a %i so a retry replays it", async (status) => {
    const { checkIdempotency, cacheIdempotentResponse } = await lib();
    mockRequireAuth.mockResolvedValue(asUser("user-a"));
    await cacheIdempotentResponse(
      post({ x: 1 }),
      NextResponse.json({ ok: true }, { status }),
      "/api/absences",
      "POST",
    );
    const replay = await checkIdempotency(
      post({ x: 1 }),
      "/api/absences",
      "POST",
    );
    expect(replay).not.toBeNull();
    expect(replay!.status).toBe(status);
  });
});

/**
 * Concurrency.
 *
 * Caching the response afterwards does nothing for two requests that arrive
 * together: both found an empty cache, both ran, and both created a record --
 * exactly what an Idempotency-Key exists to prevent. The first caller now
 * reserves the key before the handler runs.
 */
describe("a duplicate arriving mid-flight", () => {
  beforeEach(() => mockRequireAuth.mockResolvedValue(asUser("user-a")));

  it("is refused while the first is still running", async () => {
    const { checkIdempotency } = await lib();
    // First caller wins the reservation and proceeds.
    expect(
      await checkIdempotency(post({ x: 1 }), "/api/absences", "POST"),
    ).toBeNull();

    // Second caller, before the first has finished.
    const second = await checkIdempotency(
      post({ x: 1 }),
      "/api/absences",
      "POST",
    );
    expect(second).not.toBeNull();
    expect(second!.status).toBe(409);
    expect((await second!.json()).error).toBe("IDEMPOTENT_REQUEST_IN_PROGRESS");
  });

  it("tells the caller when to retry", async () => {
    const { checkIdempotency } = await lib();
    await checkIdempotency(post({ x: 1 }), "/api/absences", "POST");
    const second = await checkIdempotency(
      post({ x: 1 }),
      "/api/absences",
      "POST",
    );
    expect(second!.headers.get("Retry-After")).toBeTruthy();
  });

  it("does not block a different key", async () => {
    const { checkIdempotency } = await lib();
    await checkIdempotency(post({ x: 1 }, "key-A"), "/api/absences", "POST");
    expect(
      await checkIdempotency(post({ x: 1 }, "key-B"), "/api/absences", "POST"),
    ).toBeNull();
  });

  it("replays the real response once the first completes", async () => {
    const { checkIdempotency, cacheIdempotentResponse } = await lib();
    await checkIdempotency(post({ x: 1 }), "/api/absences", "POST");
    await cacheIdempotentResponse(
      post({ x: 1 }),
      NextResponse.json({ id: "abs-1" }, { status: 201 }),
      "/api/absences",
      "POST",
    );
    const replay = await checkIdempotency(
      post({ x: 1 }),
      "/api/absences",
      "POST",
    );
    expect(replay!.status).toBe(201);
    expect(await replay!.json()).toEqual({ id: "abs-1" });
  });

  it("frees the key when the first attempt fails", async () => {
    // Otherwise one transient error would refuse every retry for a full minute.
    const { checkIdempotency, cacheIdempotentResponse } = await lib();
    await checkIdempotency(post({ x: 1 }), "/api/absences", "POST");
    await cacheIdempotentResponse(
      post({ x: 1 }),
      NextResponse.json({ error: "boom" }, { status: 500 }),
      "/api/absences",
      "POST",
    );
    // The retry must be allowed to run, not answered with 409 or a cached 500.
    expect(
      await checkIdempotency(post({ x: 1 }), "/api/absences", "POST"),
    ).toBeNull();
  });
});
