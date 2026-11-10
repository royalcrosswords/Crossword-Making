"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Model = require("../src/model.js");
const AutoFill = require("../src/autofill.js");

function emptyGrid(rows = 3, cols = 5) {
  return {
    rows,
    cols,
    blocks: Array(rows * cols).fill(false),
    answers: Array(rows * cols).fill(""),
  };
}

test("autofill can exclude earlier complete fills and generate successive alternatives", async () => {
  const puzzle = emptyGrid();
  const entries = [
    { id: "one", indices: [0, 1, 2] },
    { id: "two", indices: [3, 4, 5] },
  ];
  const index = AutoFill.buildIndex(["CAT", "DOG", "CAR", "RAT"]);
  const tried = [];
  for (let variant = 0; variant < 4; variant += 1) {
    const result = await AutoFill.solveGrid({
      ...puzzle,
      entries,
      index,
      excludedSolutions: tried,
      variant,
      maxNodes: 1000,
      maxMilliseconds: 2000,
    });
    assert.equal(result.complete, true);
    assert.equal(tried.includes(result.signature), false);
    tried.push(result.signature);
  }
  assert.equal(new Set(tried).size, 4);
});

test("ipuz export contains standard dimensions, blocks, labels, clues, solution, and saved state", () => {
  const puzzle = Model.createPuzzle(3, 3, "Mini crossword");
  puzzle.author = "A. Maker";
  puzzle.notes = "Test note";
  puzzle.blocks[2] = true;
  puzzle.blocks[5] = true;
  puzzle.blocks[6] = true;
  puzzle.blocks[7] = true;
  puzzle.answers = ["C", "A", "", "B", "O", "", "", "", "R"];
  puzzle.guesses = ["C", "", "", "", "", "", "", "", "R"];
  const entries = Model.getEntries(puzzle);
  for (const entry of [...entries.across, ...entries.down]) puzzle.clues[entry.id] = `${entry.direction} clue ${entry.number}`;

  const ipuz = require("../src/export-formats.js").createIpuz(puzzle);
  assert.equal(ipuz.version, "http://ipuz.org/v2");
  assert.deepEqual(ipuz.kind, ["http://ipuz.org/crossword#1"]);
  assert.deepEqual(ipuz.dimensions, { width: 3, height: 3 });
  assert.equal(ipuz.title, "Mini crossword");
  assert.equal(ipuz.author, "A. Maker");
  assert.equal(ipuz.puzzle[0][2], "#");
  assert.equal(ipuz.puzzle[0][0], 1);
  assert.equal(ipuz.solution[0][0], "C");
  assert.equal(ipuz.solution[0][2], "#");
  assert.equal(ipuz.saved[0][0], "C");
  assert.ok(ipuz.clues.Across.length > 0);
  assert.ok(ipuz.clues.Down.length > 0);
});

test("British cryptic exports append a validated enumeration to clues", () => {
  const Exports = require("../src/export-formats.js");
  const puzzle = Model.createPuzzle(3, 3, "British clue export");
  puzzle.crosswordStyle = "british";
  const entry = Model.getEntries(puzzle).across[0];
  puzzle.clues[entry.id] = "Mixed-up clue";
  puzzle.crypticClues[entry.id] = { mechanism: "anagram", definition: "clue", wordplay: "mixed up", enumeration: "1,2" };

  const ipuz = Exports.createIpuz(puzzle);
  assert.equal(ipuz.clues.Across[0][1], "Mixed-up clue (1, 2)");
  const puz = Exports.createPuz(puzzle);
  assert.ok(Buffer.from(puz.bytes).toString("latin1").includes("Mixed-up clue (1, 2)"));

  puzzle.crypticClues[entry.id].enumeration = "2,2";
  assert.equal(Exports.createIpuz(puzzle).clues.Across[0][1], "Mixed-up clue (3)", "invalid overrides fall back to the grid length");
});

test("PUZ export writes a standard header, solution/state, strings, and valid checksums", () => {
  const Exports = require("../src/export-formats.js");
  const puzzle = Model.createPuzzle(3, 3, "Test grid");
  puzzle.author = "Ada";
  puzzle.notes = "Note";
  puzzle.answers = ["C", "A", "T", "A", "R", "E", "T", "E", "N"];
  puzzle.guesses = ["C", "", "", "", "", "", "", "", ""];
  const entries = Model.getEntries(puzzle);
  for (const entry of [...entries.across, ...entries.down]) puzzle.clues[entry.id] = `${entry.direction} ${entry.number}`;

  const { bytes, clueCount } = Exports.createPuz(puzzle);
  const ascii = (offset, length) => String.fromCharCode(...bytes.slice(offset, offset + length));
  const getU16 = (offset) => Exports.readU16(bytes, offset);
  assert.equal(bytes.length > 0x34 + 18, true);
  assert.equal(ascii(2, 12), "ACROSS&DOWN\0");
  assert.equal(bytes[0x2c], 3);
  assert.equal(bytes[0x2d], 3);
  assert.equal(getU16(0x2e), 6);
  assert.equal(getU16(0x30), 1, "header identifies a normal crossword, matching Across Lite/Phil");
  assert.equal(getU16(0x32), 0, "puzzle is not scrambled");
  assert.equal(clueCount, 6);
  assert.equal(ascii(0x34, 9), "CATARETEN");
  assert.equal(ascii(0x34 + 9, 9), "C--------");
  assert.equal(getU16(0x0e), Exports.checksumRegion(bytes.slice(0x2c, 0x34), 0));

  let cursor = 0x34 + 18;
  const strings = [];
  while (cursor < bytes.length) {
    const start = cursor;
    while (cursor < bytes.length && bytes[cursor] !== 0) cursor += 1;
    strings.push(ascii(start, cursor - start));
    cursor += 1;
  }
  assert.equal(strings.length, 3 + clueCount + 1);
  assert.deepEqual(strings.slice(0, 3), ["Test grid", "Ada", ""]);
  assert.equal(strings.at(-1), "Note");

  const solution = bytes.slice(0x34, 0x34 + 9);
  const current = bytes.slice(0x34 + 9, 0x34 + 18);
  const titleBytes = Buffer.from("Test grid\0", "ascii");
  const authorBytes = Buffer.from("Ada\0", "ascii");
  const clueBytes = strings.slice(3, 3 + clueCount).map((text) => Buffer.from(text, "ascii"));
  const noteBytes = Buffer.from("Note\0", "ascii");
  let expected = getU16(0x0e);
  expected = Exports.checksumRegion(solution, expected);
  expected = Exports.checksumRegion(current, expected);
  expected = Exports.checksumRegion(titleBytes, expected);
  expected = Exports.checksumRegion(authorBytes, expected);
  for (const clue of clueBytes) expected = Exports.checksumRegion(clue, expected);
  expected = Exports.checksumRegion(noteBytes, expected);
  assert.equal(getU16(0), expected);

  let partial = Exports.checksumRegion(titleBytes, 0);
  partial = Exports.checksumRegion(authorBytes, partial);
  for (const clue of clueBytes) partial = Exports.checksumRegion(clue, partial);
  partial = Exports.checksumRegion(noteBytes, partial);
  const parts = [
    getU16(0x0e),
    Exports.checksumRegion(solution, 0),
    Exports.checksumRegion(current, 0),
    partial,
  ];
  const lowMasks = [0x49, 0x43, 0x48, 0x45];
  const highMasks = [0x41, 0x54, 0x45, 0x44];
  parts.forEach((checksum, index) => {
    assert.equal(bytes[0x10 + index], lowMasks[index] ^ (checksum & 0xff));
    assert.equal(bytes[0x14 + index], highMasks[index] ^ ((checksum >>> 8) & 0xff));
  });
});

test("PUZ 1.3 text is ISO-8859-1, not Windows-1252 control bytes", () => {
  const puzzle = Model.createPuzzle(3, 3, "Café “En dash” — €");
  const { bytes, warnings } = require("../src/export-formats.js").createPuz(puzzle);
  let cursor = 0x34 + 2 * puzzle.rows * puzzle.cols;
  const title = [];
  while (bytes[cursor] !== 0) title.push(bytes[cursor++]);
  assert.equal(Buffer.from(title).toString("latin1"), 'Café "En dash" - EUR');
  assert.equal(title.includes(0x91), false, "smart quote must not be emitted as a CP1252 C1 control byte");
  assert.ok(warnings.some((warning) => /Latin-1 text encoding/.test(warning)));
});

test("PUZ export rejects one-cell entries rather than silently misnumbering clues", () => {
  const puzzle = Model.createPuzzle(3, 3, "Short entry");
  puzzle.blocks[1] = true;
  puzzle.blocks[3] = true;
  puzzle.blocks[4] = true;
  puzzle.blocks[5] = true;
  puzzle.blocks[7] = true;
  const Exports = require("../src/export-formats.js");
  assert.throws(() => Exports.createPuz(puzzle), /one-cell entry/);
});
