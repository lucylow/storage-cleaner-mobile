import { describe, it } from "vitest";

describe.skip("auth logout", () => {
  it("clears the local session without touching on-device files", () => {
    // Preview auth is host-injected; this suite stays skipped until a store session exists.
  });
});
