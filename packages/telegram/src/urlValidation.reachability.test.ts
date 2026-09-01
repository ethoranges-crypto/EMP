import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRedirectBaseUrlReachable } from "./urlValidation.js";

describe("checkRedirectBaseUrlReachable", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports reachable when the request completes at all, even a 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );
    const result = await checkRedirectBaseUrlReachable("https://real-domain.example/r");
    expect(result).toEqual({ reachable: true });
  });

  it("names DNS failure (the exact NXDOMAIN case this exists for) with a clear reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(Object.assign(new Error("fetch failed"), { cause: { code: "ENOTFOUND" } })),
    );
    const result = await checkRedirectBaseUrlReachable("https://not-purchased-yet.example/r");
    expect(result.reachable).toBe(false);
    if (!result.reachable) {
      expect(result.reason).toContain("doesn't resolve");
      expect(result.reason).toContain("not-purchased-yet.example");
    }
  });

  it("names a refused connection distinctly from a DNS failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } })),
    );
    const result = await checkRedirectBaseUrlReachable("https://nothing-listening.example/r");
    expect(result.reachable).toBe(false);
    if (!result.reachable) expect(result.reason).toContain("refused");
  });

  it("reports a timeout distinctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, opts: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          opts.signal.addEventListener("abort", () => reject(new Error("aborted")));
        });
      }),
    );
    const result = await checkRedirectBaseUrlReachable("https://slow.example/r", 20);
    expect(result.reachable).toBe(false);
    if (!result.reachable) expect(result.reason).toContain("Timed out");
  });

  it("rejects a malformed URL without making a network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await checkRedirectBaseUrlReachable("not-a-url");
    expect(result).toEqual({ reachable: false, reason: expect.stringContaining("isn't a valid URL") });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
