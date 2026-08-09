import assert from "node:assert/strict";
import test from "node:test";

import { MemoryAuthSessionStore } from "../src/modules/auth/auth-session.store.js";

function session(id: string, expiresAt = new Date(Date.now() + 60_000)) {
  return {
    id,
    userId: `user-${id}`,
    refreshTokenHash: `hash-${id}`,
    expiresAt,
  };
}

test("memory session cache creates, rotates, and revokes sessions", () => {
  const store = new MemoryAuthSessionStore(10);
  store.create(session("one"));
  assert.equal(store.isActive("one", "user-one"), true);

  assert.equal(
    store.rotate({
      sessionId: "one",
      userId: "user-one",
      currentTokenHash: "hash-one",
      nextTokenHash: "hash-next",
      expiresAt: new Date(Date.now() + 120_000),
    }),
    true,
  );

  store.revoke("one", "user-one");
  assert.equal(store.isActive("one", "user-one"), false);
});

test("memory session cache rejects reuse and removes expired sessions", () => {
  const store = new MemoryAuthSessionStore(10);
  store.create(session("one"));
  assert.equal(
    store.rotate({
      sessionId: "one",
      userId: "user-one",
      currentTokenHash: "wrong-old-hash",
      nextTokenHash: "hash-next",
      expiresAt: new Date(Date.now() + 120_000),
    }),
    false,
  );
  assert.equal(store.isActive("one", "user-one"), false);

  store.create(session("expired", new Date(Date.now() - 1)));
  assert.equal(store.isActive("expired", "user-expired"), false);
});

test("memory session cache remains bounded", () => {
  const store = new MemoryAuthSessionStore(2);
  store.create(session("one"));
  store.create(session("two"));
  store.create(session("three"));

  assert.equal(store.isActive("one", "user-one"), false);
  assert.equal(store.isActive("two", "user-two"), true);
  assert.equal(store.isActive("three", "user-three"), true);
});
