"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Model = require("../src/model.js");
const Exports = require("../src/export-formats.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const html = read("index.html");
const app = read("src/app.js");
const ukPriority = read("src/british-word-priority.js");

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function countRuns(puzzle, direction, wantedLength = null) {
  const horizontal = direction === "across";
  const lineCount = horizontal ? puzzle.rows : puzzle.cols;
  const lineLength = horizontal ? puzzle.cols : puzzle.rows;
  let count = 0;
  for (let line = 0; line < lineCount; line += 1) {
    let run = 0;
    for (let position = 0; position <= lineLength; position += 1) {
      const end = position === lineLength;
      const index = horizontal ? line * puzzle.cols + position : position * puzzle.cols + line;
      if (end || puzzle.blocks[index]) {
        if (run > 0 && (wantedLength === null ? run > 1 : run === wantedLength)) count += 1;
        run = 0;
      } else {
        run += 1;
      }
    }
  }
  return count;
}

test("American and British Cryptic styles are selectable and persisted per puzzle", () => {
  assert.match(html, /id="crosswordStyleSelect"/);
  assert.match(html, /<option value="american">American<\/option>/);
  assert.match(html, /<option value="british">British Cryptic<\/option>/);
  assert.match(app, /ui\.crosswordStyleSelect\.addEventListener\("change", \(\) => setCrosswordStyle/);
  assert.match(app, /puzzle\.crosswordStyle = nextStyle/);
  assert.match(app, /next\.crosswordStyle = ui\.crosswordStyleSelect\.value/);
});

test("British Cryptic mode offers wordplay notes, enumeration, and a structure review", () => {
  assert.match(html, /id="crypticReviewButton"/);
  assert.match(app, /Cryptic clue builder/);
  assert.match(app, /Main wordplay device/);
  assert.match(app, /Definition/);
  assert.match(app, /Wordplay notes/);
  assert.match(app, /Enumeration/);
  assert.match(app, /function reviewCrypticClues\(\)/);
  assert.match(app, /does not judge clue fairness or correctness/);
});

test("British mode has a distinct block target and British-specific layout-generation feedback", () => {
  assert.match(html, /id="blockDensityInput"[^>]*min="5"[^>]*max="40"[^>]*value="15"/);
  assert.match(html, /id="generatorModeHint"/);
  assert.match(html, /id="generatorRuleNote"/);
  assert.match(app, /layoutDensityByStyle = \{ american: 15, british: 30 \}/);
  assert.match(app, /const minimum = british \? 25 : 5/);
  assert.match(app, /const maximum = british \? 35 : 25/);
  assert.match(app, /British blocked-cryptic rules/);
  assert.match(app, /British Cryptic grid:/);
});

test("British autofill prioritizes a curated British vocabulary list before the general list", () => {
  assert.match(html, /src\/british-word-priority\.js/);
  assert.match(app, /BritishWordPriority[\s\S]*window\.GRIDWRIGHT_DEFAULT_TEXT/);
  assert.match(ukPriority, /\ncolour\n/);
  assert.match(ukPriority, /\ncentre\n/);
  assert.match(ukPriority, /\naeroplane\n/);
});

test("British generator builds a symmetric blocked lattice with UK checking and unches", () => {
  const puzzle = Model.createPuzzle(15, 15, "British layout test");
  puzzle.crosswordStyle = "british";
  const generated = Model.generateLayout(puzzle, { random: seededRandom(1) });
  const validation = Model.validateLayout(generated.puzzle);

  assert.equal(generated.puzzle.crosswordStyle, "british");
  assert.equal(validation.valid, true, validation.issues.join(" "));
  assert.equal(generated.targetReached, true);
  assert.ok(generated.blackPercent >= 25 && generated.blackPercent <= 35);
  assert.ok(generated.uncheckedCells > 0, "British style should produce unchecked letters");
  assert.ok(generated.checkedPercent < 70, "British blocked grids should not be fully checked like American grids");
  assert.equal(generated.puzNumberingCompatible, true);
  assert.ok(generated.puzzle.mirrorBlocks, "British grids keep 180-degree block symmetry on");

  for (let index = 0; index < generated.puzzle.blocks.length; index += 1) {
    assert.equal(generated.puzzle.blocks[index], generated.puzzle.blocks.at(-1 - index), "blocks should be 180° symmetric");
  }
  const entries = Model.getEntries(generated.puzzle);
  assert.ok(entries.across.concat(entries.down).every((entry) => entry.indices.length >= 3));
  assert.equal(countRuns(generated.puzzle, "across", 2) + countRuns(generated.puzzle, "down", 2), 0, "no two-cell answer runs");

  const memberships = Array(generated.puzzle.rows * generated.puzzle.cols).fill(0);
  for (const entry of entries.across.concat(entries.down)) for (const index of entry.indices) memberships[index] += 1;
  for (const entry of entries.across.concat(entries.down)) {
    const checked = entry.indices.map((index) => memberships[index] >= 2);
    assert.ok(checked.filter(Boolean).length >= Math.ceil(entry.indices.length / 2), `${entry.id} has at least half its letters checked`);
    let unchRun = 0;
    for (const value of checked) {
      unchRun = value ? 0 : unchRun + 1;
      assert.ok(unchRun <= 2, `${entry.id} has no triple-unch run`);
    }
    assert.equal(checked[0] === false && checked[1] === false, false, `${entry.id} does not start with a double unch`);
    assert.equal(checked.at(-1) === false && checked.at(-2) === false, false, `${entry.id} does not end with a double unch`);
  }
});

test("British layouts require odd dimensions and .puz export rejects parser-ambiguous two-cell runs", () => {
  const even = Model.createPuzzle(14, 15, "Even dimensions");
  even.crosswordStyle = "british";
  assert.throws(() => Model.generateLayout(even), /odd row and column counts/);

  const malformed = Model.createPuzzle(5, 5, "Two-cell run");
  malformed.crosswordStyle = "british";
  malformed.blocks[0] = true;
  malformed.blocks[3] = true;
  malformed.blocks[24] = true;
  malformed.blocks[21] = true;
  assert.ok(Model.validateLayout(malformed).twoCellRuns > 0);
  assert.throws(() => Exports.createPuz(malformed), /two-cell runs as clues/);
});

test("British .puz clue count agrees with standard clue numbering when singleton unches are present", () => {
  const puzzle = Model.createPuzzle(15, 15, "British PUZ numbering");
  puzzle.crosswordStyle = "british";
  const generated = Model.generateLayout(puzzle, { random: seededRandom(2) }).puzzle;
  const puz = Exports.createPuz(generated);
  const expected = countRuns(generated, "across") + countRuns(generated, "down");
  assert.equal(puz.clueCount, expected);
  assert.equal(Model.validateLayout(generated).puzNumberingCompatible, true);
});
