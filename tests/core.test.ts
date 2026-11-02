import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../apps/server/src/store.ts";
import { parseVote } from "../packages/shared/src/index.ts";
import { encrypt, decrypt } from "../apps/server/src/auth.ts";
function setup() {
  const store = new Store(":memory:"),
    s = store.start("demo");
  const d = store.createDecision(
    s.id,
    "Which game next?",
    ["Minecraft", "Valorant", "Chess"],
    60,
  );
  store.open(d.id, 1000);
  return { store, s, d };
}
function vote(
  store: Store,
  s: string,
  id: string,
  text: string,
  at = 2000,
  userId = "u1",
  arrival = at,
) {
  return store.ingest(s, {
    id,
    text,
    userId,
    name: userId,
    at,
    arrival,
    emotes: [],
  });
}
test("complete valid vote syntax; malformed commands preserve ballots", () => {
  assert.deepEqual(parseVote("!vote 1 3", 3), [1, 3]);
  assert.deepEqual(parseVote("!vote 1 1", 3), [1]);
  assert.deepEqual(parseVote("!VOTE clear", 3), []);
  for (const t of [
    "!vote 4",
    "!vote 1 hi",
    "!vote 1,3",
    "!vote  1",
    "hello !vote 1",
    "!vote 1\n2",
    "!vote clear 1",
    "!vote 0",
  ])
    assert.equal(parseVote(t, 3), null);
});
test("deduplication, replacement, malformed preservation and clearing", () => {
  const { store, s, d } = setup();
  vote(store, s.id, "a", "!vote 1 3");
  assert.equal(vote(store, s.id, "a", "!vote 2"), false);
  vote(store, s.id, "b", "!vote 1 3", 2100);
  assert.deepEqual(store.result(d.id), {
    counts: [1, 0, 1],
    voters: 1,
    winners: [0, 2],
  });
  vote(store, s.id, "c", "!vote 2", 2200);
  vote(store, s.id, "bad", "!vote 2 invalid", 2300);
  assert.deepEqual(store.result(d.id).counts, [0, 1, 0]);
  vote(store, s.id, "clear", "!vote clear", 2400);
  assert.equal(store.result(d.id).voters, 0);
  store.db.close();
});
test("stale arrivals, source interval and server deadline", () => {
  const { store, s, d } = setup();
  vote(store, s.id, "latest", "!vote 3", 4000);
  vote(store, s.id, "stale", "!vote 1", 3000, "u1", 5000);
  assert.deepEqual(store.result(d.id).counts, [0, 0, 1]);
  vote(store, s.id, "early", "!vote 2", 999, "early", 5000);
  vote(store, s.id, "late", "!vote 2", 61000, "late", 61000);
  vote(store, s.id, "delayed", "!vote 2", 5000, "delay", 61000);
  assert.equal(store.result(d.id).voters, 1);
  store.tick(61000);
  vote(store, s.id, "closed", "!vote 2", 6000, "after", 70000);
  assert.equal(store.decision(d.id).state, "closed");
  assert.equal(store.decision(d.id).voters, 1);
  store.db.close();
});
test("delete rolls an open ballot back; closed aggregate remains frozen", () => {
  const { store, s, d } = setup();
  vote(store, s.id, "first", "!vote 1", 2000);
  vote(store, s.id, "second", "!vote 2", 3000);
  store.moderate(s.id, { messageId: "second" });
  assert.deepEqual(store.result(d.id).counts, [1, 0, 0]);
  store.close(d.id, false, 4000);
  store.moderate(s.id, { messageId: "first" });
  assert.deepEqual(store.decision(d.id).counts, [1, 0, 0]);
  assert.equal(store.messages(s.id, 5000).length, 0);
  store.db.close();
});
test("deletion and clearing tombstones handle out-of-order delivery", () => {
  const { store, s, d } = setup();
  store.moderate(s.id, { messageId: "deleted" });
  vote(store, s.id, "deleted", "!vote 1", 2000);
  store.moderate(s.id, { userId: "cleared", at: 3000 });
  vote(store, s.id, "c", "!vote 2", 2500, "cleared", 4000);
  assert.equal(store.result(d.id).voters, 0);
  vote(store, s.id, "new", "!vote 2", 5000, "cleared");
  assert.equal(store.result(d.id).voters, 1);
  store.db.close();
});
test("one open decision, tie, zero votes, session isolation", () => {
  const { store, s, d } = setup();
  const other = store.createDecision(s.id, "Another?", ["A", "B"], 30);
  assert.throws(() => store.open(other.id, 2000));
  vote(store, s.id, "a", "!vote 1", 2000, "a");
  vote(store, s.id, "b", "!vote 2", 2000, "b");
  assert.deepEqual(store.result(d.id).winners, [0, 1]);
  store.close(d.id);
  store.open(other.id);
  assert.deepEqual(store.result(other.id).winners, []);
  const s2 = store.start("replay");
  assert.notEqual(s.id, s2.id);
  assert.equal(store.decisions(s2.id).length, 0);
  store.db.close();
});
test("SQLite restart preserves closed results", () => {
  const dir = mkdtempSync(join(tmpdir(), "chatlas-"));
  try {
    const db = join(dir, "test.sqlite");
    let store = new Store(db);
    const s = store.start("demo"),
      d = store.createDecision(s.id, "Choose", ["A", "B"], 30);
    store.open(d.id, 1000);
    vote(store, s.id, "a", "!vote 2");
    store.close(d.id);
    store.db.close();
    store = new Store(db);
    assert.equal(store.decision(d.id).state, "closed");
    assert.deepEqual(store.decision(d.id).counts, [0, 1]);
    store.db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("authenticated encryption rejects changed ciphertext", () => {
  const key = "12".repeat(32),
    value = encrypt({ access_token: "synthetic-test" }, key);
  assert.deepEqual(decrypt(value, key), { access_token: "synthetic-test" });
  const b = Buffer.from(value, "base64");
  b[29] ^= 1;
  assert.throws(() => decrypt(b.toString("base64"), key));
});
test("raw retention expires messages but preserves vote revisions", () => {
  const { store, s, d } = setup();
  vote(store, s.id, "a", "!vote 1", 2000);
  store.close(d.id, false, 3000);
  store.purge(86400001 + 2000);
  assert.equal(store.messages(s.id, 86400001 + 2000, 999999999).length, 0);
  assert.equal(store.decision(d.id).voters, 1);
  store.db.close();
});

test("test contributor mode counts vote messages, preserves real authors and freezes closed results", () => {
  const { store, s, d } = setup();
  try {
    vote(store, s.id, "test-a", "!vote 1", 2000);
    vote(store, s.id, "test-b", "!vote 1", 2100);
    vote(store, s.id, "test-c", "!vote 2", 2200);
    assert.deepEqual(store.result(d.id).counts, [0, 1, 0]);
    assert.equal(store.result(d.id).voters, 1);
    store.set("testUniqueMessages", true);
    assert.deepEqual(store.result(d.id).counts, [2, 1, 0]);
    assert.equal(store.result(d.id).voters, 3);
    assert.equal(store.decision(d.id).countingMode, "message");
    assert.equal(vote(store, s.id, "test-c", "!vote 2", 2200), false);
    assert.equal(store.result(d.id).voters, 3);
    vote(store, s.id, "test-bad", "!vote 4", 2300);
    assert.equal(store.result(d.id).voters, 3);
    vote(store, s.id, "test-other", "!vote 3", 2400, "u2");
    assert.equal(store.result(d.id).voters, 4);
    store.moderate(s.id, { messageId: "test-b" });
    assert.equal(store.result(d.id).voters, 3);
    assert.deepEqual(store.result(d.id).counts, [1, 1, 1]);
    vote(store, s.id, "test-clear", "!vote clear", 2500);
    assert.equal(store.result(d.id).voters, 1);
    assert.deepEqual(store.result(d.id).counts, [0, 0, 1]);
    vote(store, s.id, "test-new", "!vote 1 3", 2600);
    assert.equal(store.result(d.id).voters, 2);
    store.set("testUniqueMessages", false);
    assert.equal(store.decision(d.id).countingMode, "account");
    assert.equal(store.result(d.id).voters, 2);
    store.set("testUniqueMessages", true);
    const closed = store.close(d.id, false, 3000);
    assert.equal(closed.countingMode, "message");
    store.set("testUniqueMessages", false);
    assert.equal(store.decision(d.id).countingMode, "message");
    assert.deepEqual(store.decision(d.id).counts, closed.counts);
    assert.equal(store.result(d.id).countingMode, "message");
    assert.ok(
      store
        .all("SELECT user_id FROM vote_revisions")
        .every((row) => ["u1", "u2"].includes(row.user_id)),
    );
  } finally {
    store.db.close();
  }
});

test("closed account-based results stay account-based after enabling test mode", () => {
  const { store, s, d } = setup();
  try {
    vote(store, s.id, "normal-a", "!vote 1", 2000);
    vote(store, s.id, "normal-b", "!vote 2", 2100);
    store.close(d.id, false, 3000);
    store.set("testUniqueMessages", true);
    assert.equal(store.decision(d.id).countingMode, "account");
    assert.equal(store.decision(d.id).voters, 1);
    assert.deepEqual(store.result(d.id).counts, [0, 1, 0]);
  } finally {
    store.db.close();
  }
});
