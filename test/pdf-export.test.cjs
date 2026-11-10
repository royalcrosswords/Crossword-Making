const test = require("node:test");
const assert = require("node:assert/strict");
const Model = require("../src/model.js");
const PdfExport = require("../src/pdf-export.js");

function filledPatternedPuzzle(title = "Sample crossword") {
  const puzzle = Model.createPuzzle(5, 5, title);
  for (const index of [0, 4, 20, 24]) puzzle.blocks[index] = true;
  puzzle.answers = puzzle.blocks.map((blocked) => blocked ? "" : "A");
  const entries = Model.getEntries(puzzle);
  for (const entry of [...entries.across, ...entries.down]) puzzle.clues[entry.id] = `Sample clue ${entry.number}`;
  return puzzle;
}

test("printable PDF is a valid one-page PDF with a blank numbered grid and clue columns", () => {
  const puzzle = filledPatternedPuzzle();
  const result = PdfExport.createPrintablePuzzlePdf(puzzle);
  assert.equal(String.fromCharCode(...result.bytes.slice(0, 8)), "%PDF-1.3");
  assert.equal(result.pageCount, 1);
  assert.ok(result.bytes.length > 1000);
  assert.deepEqual(result.warnings, []);
});

test("solution grid PDF uses the answer letters and reports any blanks without blocking export", () => {
  const complete = filledPatternedPuzzle();
  const completeResult = PdfExport.createSolutionGridPdf(complete);
  assert.equal(String.fromCharCode(...completeResult.bytes.slice(0, 8)), "%PDF-1.3");
  assert.equal(completeResult.pageCount, 1);
  assert.ok(completeResult.bytes.length > 1000);
  assert.deepEqual(completeResult.warnings, []);

  const partial = Model.clone(complete);
  partial.answers[1] = "";
  partial.guesses[1] = "Z";
  const partialResult = PdfExport.createSolutionGridPdf(partial);
  assert.equal(String.fromCharCode(...partialResult.bytes.slice(0, 8)), "%PDF-1.3");
  assert.equal(partialResult.pageCount, 1);
  assert.match(partialResult.warnings[0], /1 open cell has no answer letter and is shown blank/);
});

test("NYT PDF includes the filled and blank grids plus clue-and-answer pages", () => {
  const puzzle = filledPatternedPuzzle();
  puzzle.author = "Puzzle Byline";
  const before = JSON.stringify(puzzle);
  const result = PdfExport.createNytSubmissionPdf(puzzle, {
    name: "Ada Example",
    email: "ada@example.com",
    address: "123 Crossword Street\nNew York, NY 10001",
  });
  assert.equal(String.fromCharCode(...result.bytes.slice(0, 8)), "%PDF-1.3");
  assert.equal(result.pageCount, 3);
  assert.ok(result.bytes.length > 1500);
  assert.match(result.warnings[0], /not the typical NYT/);
  assert.equal(JSON.stringify(puzzle), before, "contact details and PDF generation do not mutate or save puzzle data");
});

test("standard 15×15 NYT packet has no dimensions warning and includes multi-page clues", () => {
  const puzzle = Model.createPuzzle(15, 15, "Standard daily puzzle");
  for (const index of [0, 14, 210, 224]) puzzle.blocks[index] = true;
  puzzle.answers = puzzle.blocks.map((blocked) => blocked ? "" : "A");
  const entries = Model.getEntries(puzzle);
  for (const entry of [...entries.across, ...entries.down]) puzzle.clues[entry.id] = `Clue ${entry.number}`;
  const result = PdfExport.createNytSubmissionPdf(puzzle, {
    name: "Ada Example",
    email: "ada@example.com",
    address: "123 Crossword Street",
  });
  assert.equal(result.warnings.length, 0);
  assert.ok(result.pageCount >= 3);
  assert.ok(result.bytes.length > 5000);
});

test("NYT PDF refuses incomplete answers, missing clues, and invalid contact details", () => {
  const complete = filledPatternedPuzzle();
  const contact = { name: "Ada Example", email: "ada@example.com", address: "123 Main Street" };
  const incompleteAnswer = Model.clone(complete);
  incompleteAnswer.answers[1] = "";
  assert.throws(() => PdfExport.createNytSubmissionPdf(incompleteAnswer, contact), /Fill the answer grid/);

  const incompleteClues = Model.clone(complete);
  delete incompleteClues.clues[Model.getEntries(incompleteClues).across[0].id];
  assert.throws(() => PdfExport.createNytSubmissionPdf(incompleteClues, contact), /Add a clue for every entry/);

  assert.throws(() => PdfExport.createNytSubmissionPdf(complete, { ...contact, email: "not-an-email" }), /valid email address/);
  assert.throws(() => PdfExport.createNytSubmissionPdf(complete, { ...contact, address: "" }), /mailing address/);
});
