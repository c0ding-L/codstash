import { afterEach, describe, expect, it, vi } from "vitest";

import { appBaseUrl } from "@/lib/app-url";

afterEach(() => vi.unstubAllEnvs());

describe("appBaseUrl", () => {
  it("drops trailing slashes", () => {
    vi.stubEnv("APP_URL", "https://cortex.example//");
    expect(appBaseUrl("test")).toBe("https://cortex.example");
  });

  it("is null, and logs the caller's tag, when unset", () => {
    vi.stubEnv("APP_URL", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(appBaseUrl("billing")).toBeNull();
    expect(error).toHaveBeenCalledWith("[billing] APP_URL is not set.");
  });
});
