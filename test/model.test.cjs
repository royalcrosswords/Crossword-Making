const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../src/model.js");

test("numbers and entries are generated row-major", () => {
  const puzzle = M.createPuzzle(3, 3, "Tiny crossword");
  const entries = M.getEntries(puzzle);
  assert.equal(entries.across.length, 3);
  assert.equal(entries.down.length, 3);
  assert.deepEqual(entries.cellNumbers.slice(0, 3), [1, 2, 3]);
  assert.equal(entries.cellNumbers[3], 4);
  assert.equal(entries.cellNumbers[6], 5);
  assert.deepEqual(entries.across[0].indices, [0, 1, 2]);
  assert.deepEqual(entries.down[2].indices, [2, 5, 8]);
});

test("American is the default; British cryptic metadata and enumeration survive normalization", () => {
  const american = M.createPuzzle(3, 3);
  assert.equal(american.crosswordStyle, "american");
  assert.deepEqual(american.crypticClues, {});

  const entry = M.getEntries(american).across[0];
  american.crosswordStyle = "british";
  american.clues[entry.id] = "A sample cryptic clue";
  american.crypticClues[entry.id] = {
    mechanism: "charade",
    definition: "a sample",
    wordplay: "parts put together",
    enumeration: "1,2",
  };
  const brit = M.normalizePuzzle(american);
  assert.equal(brit.crosswordStyle, "british");
  assert.equal(brit.crypticClues[entry.id].mechanism, "charade");
  assert.equal(M.getEnumeration(brit, entry), "1, 2");
  assert.equal(M.formatClue(brit, entry), "A sample cryptic clue (1, 2)");
  assert.equal(M.parseEnumeration("2,2", 3).valid, false);

  const legacy = M.clone(brit);
  delete legacy.crosswordStyle;
  delete legacy.crypticClues;
  const normalizedLegacy = M.normalizePuzzle(legacy);
  assert.equal(normalizedLegacy.crosswordStyle, "american");
  assert.deepEqual(normalizedLegacy.crypticClues, {});
});

test("block symmetry mirrors toggles and clears letters", () => {
  let puzzle = M.createPuzzle(3, 3);
  puzzle.mirrorBlocks = true;
  puzzle = M.setLetter(puzzle, 0, "a", "answer");
  puzzle = M.setLetter(puzzle, 0, "b", "guess");
  puzzle = M.toggleBlock(puzzle, 0);
  assert.equal(puzzle.blocks[0], true);
  assert.equal(puzzle.blocks[8], true);
  assert.equal(puzzle.answers[0], "");
  assert.equal(puzzle.guesses[0], "");
  puzzle = M.toggleBlock(puzzle, 0);
  assert.equal(puzzle.blocks[0], false);
  assert.equal(puzzle.blocks[8], false);
});

test("resize preserves cells by row and column and keeps in-bounds clues", () => {
  let puzzle = M.createPuzzle(3, 4);
  puzzle = M.setLetter(puzzle, 5, "k", "answer"); // row 1, column 1
  puzzle.clues["across:1:1"] = "A preserved clue";
  puzzle.clues["down:2:3"] = "Outside after resize";
  const resized = M.resizePuzzle(puzzle, 4, 3);
  assert.equal(resized.answers[4], "K");
  assert.equal(resized.rows, 4);
  assert.equal(resized.cols, 3);
  assert.equal(resized.clues["across:1:1"], "A preserved clue");
  assert.equal(resized.clues["down:2:3"], undefined);
});

test("checker marks only wrong filled cells and reports blanks", () => {
  let puzzle = M.createPuzzle(3, 3);
  puzzle = M.setLetter(puzzle, 0, "A", "answer");
  puzzle = M.setLetter(puzzle, 1, "B", "answer");
  puzzle = M.setLetter(puzzle, 0, "X", "guess");
  const result = M.checkIndices(puzzle, [0, 1]);
  assert.deepEqual(result.wrong, [0]);
  assert.deepEqual(result.empty, [1]);
  assert.equal(result.complete, false);
  assert.equal(result.correct, false);
  const revealed = M.revealIndices(puzzle, [0, 1]);
  assert.deepEqual(revealed.guesses.slice(0, 2), ["A", "B"]);
});

test("file import validates format, dimensions, and cell arrays", () => {
  const puzzle = M.createPuzzle(3, 4);
  assert.equal(M.normalizePuzzle(puzzle).cols, 4);
  assert.throws(() => M.normalizePuzzle({ rows: 3, cols: 3 }), /not a Gridwright/);
  assert.throws(() => M.createPuzzle(61, 61), /device safety/);
  assert.throws(() => M.normalizePuzzle({ ...puzzle, answers: ["A"] }), /must contain/);
});

test("file normalization rejects non-boolean blocks and clears letters from blocked cells", () => {
  const puzzle = M.createPuzzle(3, 3);
  puzzle.blocks[0] = true;
  puzzle.answers[0] = "A";
  puzzle.guesses[0] = "B";
  const normalized = M.normalizePuzzle(puzzle);
  assert.equal(normalized.answers[0], "");
  assert.equal(normalized.guesses[0], "");
  const malformed = { ...puzzle, blocks: [...puzzle.blocks] };
  malformed.blocks[1] = "false";
  assert.throws(() => M.normalizePuzzle(malformed), /must be true or false/);
});

test("layout checker reports symmetry and minimum-entry violations", () => {
  const asymmetric = M.createPuzzle(5, 5);
  asymmetric.blocks[0] = true;
  const symmetryResult = M.validateLayout(asymmetric, { requireSymmetry: true, minimumLength: 3 });
  assert.equal(symmetryResult.valid, false);
  assert.ok(symmetryResult.issues.some((issue) => issue.includes("180°")));
  assert.equal(symmetryResult.blackPercent, 4);

  const shortEntry = M.createPuzzle(5, 5);
  for (const index of [0, 2, 12, 22, 24]) shortEntry.blocks[index] = true;
  const lengthResult = M.validateLayout(shortEntry, { requireSymmetry: true, minimumLength: 3 });
  assert.ok(lengthResult.issues.some((issue) => issue.includes("at least 3 cells")));
});

test("automatic layout generation creates a symmetric connected pattern without short entries", () => {
  let puzzle = M.createPuzzle(15, 15, "Generated layout test");
  puzzle = M.setLetter(puzzle, 12, "A", "answer");
  puzzle.clues["across:0:0"] = "Old clue should be replaced";
  const generated = M.generateLayout(puzzle, { targetPercent: 15, anchorIndex: 0, symmetry: true });
  const result = M.validateLayout(generated.puzzle, { requireSymmetry: true, minimumLength: 3 });
  assert.equal(result.valid, true, result.issues.join(" "));
  assert.equal(generated.puzzle.blocks[0], true, "selected seed becomes a block");
  assert.equal(generated.puzzle.blocks[224], true, "seed is mirrored through the grid centre");
  assert.equal(generated.targetReached, true);
  assert.ok(generated.blackPercent >= 14 && generated.blackPercent <= 16);
  assert.ok(generated.entryCount > 0);
  assert.ok(generated.puzzle.answers.every((value) => value === ""));
  assert.ok(generated.puzzle.guesses.every((value) => value === ""));
  assert.deepEqual(generated.puzzle.clues, {});
});

test("automatic layout generation shifts an invalid seed to a nearby legal square", () => {
  const puzzle = M.createPuzzle(5, 5);
  const adjusted = M.generateLayout(puzzle, { targetPercent: 15, anchorIndex: 1 });
  assert.equal(adjusted.seedAdjusted, true);
  assert.notEqual(adjusted.seedIndex, 1);
  assert.equal(M.validateLayout(adjusted.puzzle, { requireSymmetry: true }).valid, true);
  assert.throws(() => M.generateLayout(puzzle, { targetPercent: 15, anchorIndex: 99 }), /pattern seed/);
  const larger = M.createPuzzle(32, 32);
  assert.throws(() => M.generateLayout(larger), /up to 31 × 31/);
  assert.throws(() => M.generateLayout(puzzle, { targetPercent: 30 }), /5% to 25%/);
});

test("each cell accepts one Unicode letter or digit", () => {
  assert.equal(M.normalizeLetter("ñ"), "Ñ");
  assert.equal(M.normalizeLetter("7"), "7");
  assert.equal(M.normalizeLetter(""), "");
  assert.throws(() => M.normalizeLetter("AB"), /one letter/);
});
