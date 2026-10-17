import test from "node:test";
import assert from "node:assert/strict";
import { isSkipped } from "../src/skipRules";
import { buildEvent } from "./support/testHelpers";

test("isSkipped matches listed title fragments in any case", () => {
  const rules = { titles: "focus time\n  Lunch \n\n", solo: false };
  assert.equal(isSkipped(buildEvent({ summary: "Deep Focus Time" }), rules), true);
  assert.equal(isSkipped(buildEvent({ summary: "Team lunch" }), rules), true);
  assert.equal(isSkipped(buildEvent({ summary: "Weekly Sync" }), rules), false);
});

test("isSkipped can skip events with nobody else invited", () => {
  const rules = { titles: "", solo: true };
  assert.equal(isSkipped(buildEvent({ attendees: [] }), rules), true);
  assert.equal(isSkipped(buildEvent({ attendees: [{ email: "me@example.com", self: true }] }), rules), true);
  assert.equal(isSkipped(buildEvent({ attendees: [{ email: "me@example.com", self: true }, { email: "bob@example.com" }] }), rules), false);
  assert.equal(isSkipped(buildEvent({ attendees: [] }), { titles: "", solo: false }), false);
});
