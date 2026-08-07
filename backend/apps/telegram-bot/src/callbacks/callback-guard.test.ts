import { describe, expect, it } from "vitest";

import type { BotSession } from "../types.js";
import { acquireCallback, markCallbackCompleted, releaseCallback } from "./callback-guard.js";

describe("callback guard", () => {
  it("blocks concurrent and recently completed duplicate actions", () => {
    const session: BotSession = {};

    expect(acquireCallback(session, "pay:order-1", 1_000)).toBe("acquired");
    expect(acquireCallback(session, "pay:order-1", 1_000)).toBe("pending");

    markCallbackCompleted(session, "pay:order-1", 1_000);
    releaseCallback(session, "pay:order-1");
    expect(acquireCallback(session, "pay:order-1", 5_999)).toBe("processed");
    expect(acquireCallback(session, "pay:order-1", 6_001)).toBe("acquired");
  });

  it("allows a failed action to be retried after its pending lock is released", () => {
    const session: BotSession = {};
    expect(acquireCallback(session, "ready:order-1")).toBe("acquired");
    releaseCallback(session, "ready:order-1");
    expect(acquireCallback(session, "ready:order-1")).toBe("acquired");
  });
});
