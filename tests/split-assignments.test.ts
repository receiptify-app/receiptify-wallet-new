import assert from "node:assert/strict";
import { diffReceiptAssignments } from "../server/split-folder-storage";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

run("preserves unchanged assignments (no inserts, no deletes)", () => {
  const existing = [
    { id: "a1", memberId: "m1", itemId: null, shareAmount: "10.00" },
    { id: "a2", memberId: "m2", itemId: null, shareAmount: "10.00" },
  ];
  const desired = [
    { memberId: "m1", itemId: null, shareAmount: "10.00" },
    { memberId: "m2", itemId: null, shareAmount: "10.00" },
  ];
  const { toDeleteIds, toInsertIndexes } = diffReceiptAssignments(existing, desired);
  assert.deepEqual(toDeleteIds, []);
  assert.deepEqual(toInsertIndexes, []);
});

run("adding a new member only inserts the new row; existing paid rows untouched", () => {
  const existing = [
    { id: "a1", memberId: "m1", itemId: null, shareAmount: "10.00" },
    { id: "a2", memberId: "m2", itemId: null, shareAmount: "10.00" },
  ];
  // Owner re-splits 20.00 across 3 people — but in this test, m1 & m2 keep
  // their original shares and only m3 gets added (e.g. covering extra).
  const desired = [
    { memberId: "m1", itemId: null, shareAmount: "10.00" },
    { memberId: "m2", itemId: null, shareAmount: "10.00" },
    { memberId: "m3", itemId: null, shareAmount: "5.00" },
  ];
  const { toDeleteIds, toInsertIndexes } = diffReceiptAssignments(existing, desired);
  assert.deepEqual(toDeleteIds, []);
  assert.deepEqual(toInsertIndexes, [2]);
});

run("removing a member deletes only that assignment", () => {
  const existing = [
    { id: "a1", memberId: "m1", itemId: null, shareAmount: "10.00" },
    { id: "a2", memberId: "m2", itemId: null, shareAmount: "10.00" },
  ];
  const desired = [{ memberId: "m1", itemId: null, shareAmount: "10.00" }];
  const { toDeleteIds, toInsertIndexes } = diffReceiptAssignments(existing, desired);
  assert.deepEqual(toDeleteIds, ["a2"]);
  assert.deepEqual(toInsertIndexes, []);
});

run("changed share replaces the row (delete + insert)", () => {
  const existing = [
    { id: "a1", memberId: "m1", itemId: null, shareAmount: "10.00" },
    { id: "a2", memberId: "m2", itemId: null, shareAmount: "10.00" },
  ];
  const desired = [
    { memberId: "m1", itemId: null, shareAmount: "12.00" },
    { memberId: "m2", itemId: null, shareAmount: "10.00" },
  ];
  const { toDeleteIds, toInsertIndexes } = diffReceiptAssignments(existing, desired);
  assert.deepEqual(toDeleteIds, ["a1"]);
  assert.deepEqual(toInsertIndexes, [0]);
});

run("normalizes share formatting (10 vs 10.00 vs '10.0')", () => {
  const existing = [
    { id: "a1", memberId: "m1", itemId: null, shareAmount: "10" },
  ];
  const desired = [{ memberId: "m1", itemId: null, shareAmount: "10.00" }];
  const { toDeleteIds, toInsertIndexes } = diffReceiptAssignments(existing, desired);
  assert.deepEqual(toDeleteIds, []);
  assert.deepEqual(toInsertIndexes, []);
});

run("distinguishes assignments by itemId for item-mode splits", () => {
  const existing = [
    { id: "a1", memberId: "m1", itemId: "i1", shareAmount: "5.00" },
    { id: "a2", memberId: "m1", itemId: "i2", shareAmount: "5.00" },
  ];
  const desired = [
    { memberId: "m1", itemId: "i1", shareAmount: "5.00" },
    { memberId: "m1", itemId: "i3", shareAmount: "5.00" },
  ];
  const { toDeleteIds, toInsertIndexes } = diffReceiptAssignments(existing, desired);
  assert.deepEqual(toDeleteIds, ["a2"]);
  assert.deepEqual(toInsertIndexes, [1]);
});

run("clearing all assignments deletes everything", () => {
  const existing = [
    { id: "a1", memberId: "m1", itemId: null, shareAmount: "10.00" },
    { id: "a2", memberId: "m2", itemId: null, shareAmount: "10.00" },
  ];
  const { toDeleteIds, toInsertIndexes } = diffReceiptAssignments(existing, []);
  assert.deepEqual(toDeleteIds.sort(), ["a1", "a2"]);
  assert.deepEqual(toInsertIndexes, []);
});
