import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createYouTubeOAuthState, readYouTubeOAuthState, verifyYouTubeOAuthState } from "./oauth";

beforeEach(() => { vi.stubEnv("AUTH_SECRET", "test-secret-not-for-production"); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("YouTube OAuth state", () => {
  it("binds the brand and return origin", () => {
    const state = createYouTubeOAuthState("brand", "https://firm.example.test");
    expect(verifyYouTubeOAuthState(state, "brand", "https://firm.example.test")).toBe(true);
    expect(verifyYouTubeOAuthState(state, "other", "https://firm.example.test")).toBe(false);
    expect(verifyYouTubeOAuthState(state, "brand", "https://other.example.test")).toBe(false);
    expect(readYouTubeOAuthState(`${state}.extra`)).toBeNull();
    expect(readYouTubeOAuthState(`${state.split(".")[0]}.${"é".repeat(43)}`)).toBeNull();
  });
  it("rejects expired state", () => {
    vi.useFakeTimers();
    const state = createYouTubeOAuthState("brand", "https://firm.example.test");
    vi.advanceTimersByTime(11 * 60_000);
    expect(readYouTubeOAuthState(state)).toBeNull();
  });
  it("does not allow insecure remote origins in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(readYouTubeOAuthState(createYouTubeOAuthState("brand", "http://remote.example.test"))).toBeNull();
  });
});
