import { describe, expect, it, vi } from "vitest";
import { safelyDeliverSafeArea, safelyInitializePreview, safelyInvoke, safelyPostMessage } from "../lib/_core/manus-runtime-safety";

describe("preview runtime failure boundaries", () => {
  it("returns true and invokes a successful action", () => {
    const action = vi.fn();
    expect(safelyInvoke(action)).toBe(true);
    expect(action).toHaveBeenCalledOnce();
  });

  it("contains postMessage failures without throwing", () => {
    expect(safelyPostMessage(() => { throw new Error("host closed"); })).toBe(false);
  });

  it("contains safe-area callback failures without throwing", () => {
    expect(safelyDeliverSafeArea(() => { throw new Error("callback failed"); })).toBe(false);
  });

  it("does not notify readiness when listener registration fails", () => {
    const notifyReady = vi.fn();
    expect(safelyInitializePreview(() => { throw new Error("listener unavailable"); }, notifyReady)).toBe(false);
    expect(notifyReady).not.toHaveBeenCalled();
  });

  it("contains readiness notification failures after listener registration", () => {
    const addListener = vi.fn();
    expect(safelyInitializePreview(addListener, () => { throw new Error("preview closed"); })).toBe(false);
    expect(addListener).toHaveBeenCalledOnce();
  });
});
