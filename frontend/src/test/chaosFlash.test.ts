import { describe, it, expect } from "vitest";
import { useChaosStore } from "../store/chaosStore";

describe("chaos flash overlay", () => {
  beforeEach(() => {
    useChaosStore.getState().reset();
  });

  it("lastChaosInjectionAt starts at 0 (no flash)", () => {
    expect(useChaosStore.getState().lastChaosInjectionAt).toBe(0);
  });

  it("after injection, lastChaosInjectionAt > 0 triggers flash", () => {
    useChaosStore.getState().setLastChaosInjectionAt(Date.now());
    expect(useChaosStore.getState().lastChaosInjectionAt).toBeGreaterThan(0);
  });

  it("flash clears after reset", () => {
    useChaosStore.getState().setLastChaosInjectionAt(Date.now());
    expect(useChaosStore.getState().lastChaosInjectionAt).toBeGreaterThan(0);
    useChaosStore.getState().reset();
    expect(useChaosStore.getState().lastChaosInjectionAt).toBe(0);
  });

  it("multiple injections update timestamp", () => {
    const t1 = 1000;
    const t2 = 2000;
    useChaosStore.getState().setLastChaosInjectionAt(t1);
    expect(useChaosStore.getState().lastChaosInjectionAt).toBe(t1);
    useChaosStore.getState().setLastChaosInjectionAt(t2);
    expect(useChaosStore.getState().lastChaosInjectionAt).toBe(t2);
  });

  it("chaos panel default visibility is false", () => {
    expect(useChaosStore.getState().showChaosPanel).toBe(false);
  });

  it("chaos panel can be toggled", () => {
    useChaosStore.getState().setShowChaosPanel(true);
    expect(useChaosStore.getState().showChaosPanel).toBe(true);
    useChaosStore.getState().setShowChaosPanel(false);
    expect(useChaosStore.getState().showChaosPanel).toBe(false);
  });
});
