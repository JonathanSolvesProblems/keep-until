// The daily download of the recall feed: one dropped connection must not cost a day's check
// (it did on 2026-11-21), and a feed that never arrives must fail loudly, never as "nothing found".
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchFeed } from "./feed.js";

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

test("retries a download that was cut off, then returns the feed", async () => {
  let calls = 0;
  const get = async () => {
    calls++;
    if (calls === 1) throw new TypeError("terminated");
    return ok([{ NID: "1" }]);
  };
  assert.deepEqual(await fetchFeed(get, 3, 1), [{ NID: "1" }]);
  assert.equal(calls, 2);
});

test("fails after the last attempt instead of returning an empty feed", async () => {
  let calls = 0;
  const get = async () => {
    calls++;
    return { ok: false, status: 503, json: async () => [] };
  };
  await assert.rejects(fetchFeed(get, 3, 1), /failed 3 times: Error: recall feed returned 503/);
  assert.equal(calls, 3);
});
