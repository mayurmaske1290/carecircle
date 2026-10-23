import test from "node:test";
import assert from "node:assert/strict";
import { emptyStore, isMemberAvailable, overlaps, parseRequest, proposePlan, timeToMinutes } from "./domain.js";

test("time conversion validates 24-hour times", () => {
  assert.equal(timeToMinutes("17:30"), 1050);
  assert.throws(() => timeToMinutes("29:00"));
});
test("interval overlap is boundary-safe", () => {
  assert.equal(overlaps("16:00", "17:00", "17:00", "18:00"), false);
  assert.equal(overlaps("16:30", "17:30", "17:00", "18:00"), true);
});
test("seed schedule recommends sister for 5 PM appointment", () => {
  const store = emptyStore();
  assert.equal(isMemberAvailable(store.members[0]!, "17:00"), false);
  const plan = proposePlan(store, "17:00", "Help with appointment transportation");
  assert.equal(plan.recommendedMemberName, "Sister");
  assert.equal(plan.conflict, true);
});
test("no available member produces no assignment", () => {
  const store = emptyStore();
  store.members.forEach(m => m.availability = [{ day: "tomorrow", start: "16:00", end: "18:00", available: false }]);
  const plan = proposePlan(store, "17:00");
  assert.equal(plan.recommendedMemberId, null);
  assert.equal(plan.recommendedMemberName, "No available member");
});
test("request parser extracts time and request category", () => {
  assert.deepEqual(parseRequest("Dad has an appointment tomorrow at 5 PM"), { title: "Help with appointment transportation", time: "17:00", day: "tomorrow" });
  assert.equal(parseRequest("family dinner at 7 PM").title, "Prepare for family dinner");
});
