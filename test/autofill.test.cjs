"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const AutoFill = require("../src/autofill.js");

function grid(rows = 3, cols = 5, letters = []) {
  const blocks = Array(rows * cols).fill(false);
  const answers = Array(rows * cols).fill("");
  for (const [index, value] of letters) answers[index] = value;
  return { rows, cols, blocks, answers };
}

test("word-list parser skips comments, normalizes case, removes duplicates, and rejects phrases", () => {
  const words = AutoFill.parseWordList("# note\ncat\nDOG,12\ncafé\ncat\nice cream\na\nwell-made\n");
  assert.deepEqual(words, ["CAT", "DOG", "CAFE"]);
});

test("backtracking moves off a dead-end first word and completes a crossing", async () => {
  const puzzle = grid(3, 5);
  const entries = [
    { id: "a", direction: "across", indices: [0, 1, 2] },
    { id: "b", direction: "down", indices: [2, 3, 4] },
  ];
  const index = AutoFill.buildIndex(["CAT", "CAR", "RAT"]);
  const result = await AutoFill.solveGrid({
    ...puzzle,
    entries,
    index,
    maxNodes: 500,
    maxMilliseconds: 3000,
    maxCandidates: 20,
  });

  assert.equal(result.complete, true);
  assert.ok(result.deadEnds >= 1, "the first candidate should be rejected before the solver backtracks");
  assert.equal(result.grid.slice(0, 3).join(""), "CAR");
  assert.equal(result.grid.slice(2, 5).join(""), "RAT");
});

test("crossing letters constrain candidate words", async () => {
  const puzzle = grid(3, 5, [[0, "C"], [1, "A"], [2, "R"]]);
  const entries = [{ id: "fixed", direction: "across", indices: [0, 1, 2] }];
  const result = await AutoFill.solveGrid({
    ...puzzle,
    entries,
    words: ["CAT", "CAR", "BAR"],
    maxNodes: 100,
    maxMilliseconds: 2000,
  });
  assert.equal(result.complete, true);
  assert.equal(result.grid.slice(0, 3).join(""), "CAR");
});

test("duplicate answers are blocked by default but can be enabled", async () => {
  const puzzle = grid(3, 5);
  const entries = [
    { id: "one", indices: [0, 1, 2] },
    { id: "two", indices: [3, 4, 5] },
  ];
  const base = { ...puzzle, entries, words: ["CAT"], maxNodes: 100, maxMilliseconds: 2000 };
  const noRepeats = await AutoFill.solveGrid(base);
  assert.equal(noRepeats.complete, false);
  assert.equal(noRepeats.assignedCount, 1);

  const repeats = await AutoFill.solveGrid({ ...base, allowRepeats: true });
  assert.equal(repeats.complete, true);
  assert.equal(repeats.grid.slice(0, 6).join(""), "CATCAT");
});

test("non-alphabetic filled cells stay fixed and cannot be overwritten", async () => {
  const puzzle = grid(3, 5, [[0, "1"]]);
  const entries = [{ id: "numbered", indices: [0, 1, 2] }];
  const result = await AutoFill.solveGrid({
    ...puzzle,
    entries,
    words: ["CAT"],
    maxNodes: 100,
    maxMilliseconds: 2000,
  });
  assert.equal(result.complete, false);
  assert.equal(result.grid[0], "1");
});

test("a prefilled answer absent from the dictionary does not consume a dictionary choice", async () => {
  const puzzle = grid(3, 5, [[0, "Z"], [1, "Z"], [2, "Z"]]);
  const entries = [
    { id: "fixed", indices: [0, 1, 2] },
    { id: "blank", indices: [3, 4, 5] },
  ];
  const result = await AutoFill.solveGrid({
    ...puzzle,
    entries,
    words: ["CAT"],
    maxNodes: 100,
    maxMilliseconds: 2000,
  });
  assert.equal(result.complete, true);
  assert.equal(result.grid.slice(0, 6).join(""), "ZZZCAT");
});

test("a search-step limit preserves the best partial fill", async () => {
  const puzzle = grid(3, 5);
  const words = [];
  for (let first = 65; first < 90 && words.length < 150; first += 1) {
    for (let second = 65; second < 71 && words.length < 150; second += 1) {
      words.push(`${String.fromCharCode(first)}${String.fromCharCode(second)}Z`);
    }
  }
  const result = await AutoFill.solveGrid({
    ...puzzle,
    entries: [
      { id: "one", indices: [0, 1, 2] },
      { id: "two", indices: [2, 3, 4] },
    ],
    words,
    maxNodes: 100,
    maxMilliseconds: 2000,
  });
  assert.equal(result.complete, false);
  assert.equal(result.limitReached, true);
  assert.equal(result.assignedCount, 1);
  assert.equal(result.grid.slice(0, 3).join(""), "AAZ");
});

test("an already-aborted search returns cleanly", async () => {
  const puzzle = grid(3, 5);
  const controller = new AbortController();
  controller.abort();
  const result = await AutoFill.solveGrid({
    ...puzzle,
    entries: [{ id: "one", indices: [0, 1, 2] }],
    words: ["CAT"],
    signal: controller.signal,
    maxNodes: 100,
  });
  assert.equal(result.complete, false);
  assert.equal(result.cancelled, true);
});
