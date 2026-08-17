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

test("memory session cache creates, rotates, and revokes sessions", async () => {
  const store = new MemoryAuthSessionStore(10);
  await store.create(session("one"));
  assert.equal(await store.isActive("one", "user-one"), true);

  assert.equal(
    await store.rotate({
      sessionId: "one",
      userId: "user-one",
      currentTokenHash: "hash-one",
      nextTokenHash: "hash-next",
      expiresAt: new Date(Date.now() + 120_000),
    }),
    true,
  );

  await store.revoke("one", "user-one");
  assert.equal(await store.isActive("one", "user-one"), false);
});

test("memory session cache rejects reuse and removes expired sessions", async () => {
  const store = new MemoryAuthSessionStore(10);
  await store.create(session("one"));
  assert.equal(
    await store.rotate({
      sessionId: "one",
      userId: "user-one",
      currentTokenHash: "wrong-old-hash",
      nextTokenHash: "hash-next",
      expiresAt: new Date(Date.now() + 120_000),
    }),
    false,
  );
  assert.equal(await store.isActive("one", "user-one"), false);

  await store.create(session("expired", new Date(Date.now() - 1)));
  assert.equal(await store.isActive("expired", "user-expired"), false);
});

test("memory session cache remains bounded", async () => {
  const store = new MemoryAuthSessionStore(2);
  await store.create(session("one"));
  await store.create(session("two"));
  await store.create(session("three"));

  assert.equal(await store.isActive("one", "user-one"), false);
  assert.equal(await store.isActive("two", "user-two"), true);
  assert.equal(await store.isActive("three", "user-three"), true);
});
