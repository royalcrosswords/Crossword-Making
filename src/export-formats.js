/*
 * Gridwright US & UK Crossword Studio — interoperable crossword export formats.
 * The .puz header/checksum layout is adapted from Phil's PuzWriter
 * (Copyright 2017 Keiran King, Apache-2.0); this file is modified for
 * Gridwright's puzzle model, defensive text encoding, and export warnings.
 * See LICENSE-APACHE-2.0-Phil.txt and THIRD-PARTY-NOTICES.md.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./model.js"));
  } else {
    root.GridwrightExportFormats = factory(root.GridwrightModel);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Model) {
  "use strict";

  const PUZ_HEADER_SIZE = 0x34;
  const PUZ_MAGIC = "ACROSS&DOWN\0";
  function normalizedPuzzle(source) {
    if (!Model) throw new Error("The Gridwright crossword model is required.");
    return Model.normalizePuzzle(source);
  }

  function getEntries(puzzle) {
    const found = Model.getEntries(puzzle);
    return { across: found.across, down: found.down, cellNumbers: found.cellNumbers };
  }

  function createIpuz(source) {
    const puzzle = normalizedPuzzle(source);
    const { across, down, cellNumbers } = getEntries(puzzle);
    const grid = (values, numbered) => Array.from({ length: puzzle.rows }, (_unused, row) =>
      Array.from({ length: puzzle.cols }, (_other, col) => {
        const cell = row * puzzle.cols + col;
        if (puzzle.blocks[cell]) return "#";
        if (numbered && cellNumbers[cell]) return cellNumbers[cell];
        return values && values[cell] ? values[cell] : 0;
      }),
    );

    const result = {
      version: "http://ipuz.org/v2",
      kind: ["http://ipuz.org/crossword#1"],
      title: puzzle.title || "Untitled crossword",
      dimensions: { width: puzzle.cols, height: puzzle.rows },
      puzzle: grid(null, true),
      clues: {
        Across: across.map((entry) => [entry.number, Model.formatClue(puzzle, entry)]),
        Down: down.map((entry) => [entry.number, Model.formatClue(puzzle, entry)]),
      },
      block: "#",
      empty: 0,
      origin: "Gridwright US & UK Crossword Studio",
    };
    if (puzzle.author) result.author = puzzle.author;
    if (puzzle.notes) result.notes = puzzle.notes;
    if (puzzle.answers.some(Boolean)) result.solution = grid(puzzle.answers, false);
    if (puzzle.guesses.some(Boolean)) result.saved = grid(puzzle.guesses, false);
    return result;
  }

  function checksumRegion(bytes, initial = 0) {
    let checksum = initial & 0xffff;
    for (const value of bytes) {
      if (checksum & 1) checksum = (checksum >>> 1) + 0x8000;
      else checksum >>>= 1;
      checksum = (checksum + value) & 0xffff;
    }
    return checksum;
  }

  function asciiBytes(value) {
    const bytes = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index) & 0xff;
    return bytes;
  }

  function writeU16(bytes, offset, value) {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
  }

  function readU16(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }

  // PUZ 1.3 uses ISO-8859-1 (Latin-1), not Windows-1252. In particular,
  // bytes 0x80–0x9f are control codes in this version and must not be emitted
  // as CP1252 smart-quote glyphs.
  function encodeLatin1Char(char) {
    const code = char.codePointAt(0);
    if (code >= 0x20 && code <= 0xff && !(code >= 0x7f && code <= 0x9f)) return code;
    return null;
  }

  function encodePuzText(value, warningSet) {
    const original = String(value == null ? "" : value)
      .normalize("NFC")
      .replace(/\0/g, "")
      .replace(/\r\n?/g, "\n")
      .replace(/[\n\t]/g, " ");
    const replacements = {
      "\u00a0": " ", "\u00ad": "-",
      "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2013": "-", "\u2014": "-", "\u2212": "-",
      "\u2018": "'", "\u2019": "'", "\u201a": "'", "\u201b": "'",
      "\u201c": "\"", "\u201d": "\"", "\u201e": "\"", "\u201f": "\"",
      "\u2026": "...", "\u2022": "*", "\u2122": "(TM)", "\u20ac": "EUR",
      "\u0152": "OE", "\u0153": "oe", "\u0141": "L", "\u0142": "l",
    };
    let text = "";
    for (const char of original) text += Object.prototype.hasOwnProperty.call(replacements, char) ? replacements[char] : char;
    if (text !== original) warningSet.add("Some punctuation or ligatures were simplified for the PUZ 1.3 Latin-1 text encoding.");

    const bytes = [];
    for (const char of text) {
      const code = char.codePointAt(0);
      if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) {
        bytes.push(0x20);
        warningSet.add("Control characters were replaced in the .puz export.");
        continue;
      }
      const encoded = encodeLatin1Char(char);
      if (encoded !== null) bytes.push(encoded);
      else {
        bytes.push(0x3f);
        warningSet.add("Characters outside ISO-8859-1 were replaced with ? in the .puz export.");
      }
    }
    return Uint8Array.from(bytes);
  }

  function encodePuzCell(value, isBlock, warningSet) {
    if (isBlock) return 0x2e; // .
    if (!value) return 0x2d; // -
    const text = String(value).normalize("NFC").toLocaleUpperCase();
    const glyphs = Array.from(text);
    if (glyphs.length !== 1) throw new Error("Across Lite .puz cells must contain exactly one single-byte character. Use .ipuz for multi-character or Unicode cells.");
    const byte = encodeLatin1Char(glyphs[0]);
    if (byte === null || byte === 0x2e || byte === 0x2d) {
      throw new Error("Across Lite .puz supports one Latin-1 letter or digit per open cell. Use .ipuz for unsupported characters.");
    }
    if (byte > 0x7f) warningSet.add("The .puz export contains non-ASCII Latin-1 letters; some readers may display them differently.");
    return byte;
  }

  function withNul(bytes) {
    const result = new Uint8Array(bytes.length + 1);
    result.set(bytes);
    return result;
  }

  function concatBytes(parts) {
    const size = parts.reduce((total, part) => total + part.length, 0);
    const result = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }

  function createPuz(source) {
    const puzzle = normalizedPuzzle(source);
    if (puzzle.crosswordStyle === "british") {
      const layout = Model.validateLayout(puzzle, { minimumLength: 3, requireSymmetry: true });
      if (layout.twoCellRuns > 0) {
        throw new Error("Across Lite numbers two-cell runs as clues, but British cryptic grids use those positions as unches. Remove every two-cell run before exporting this British grid as .puz.");
      }
    }
    const { across, down } = getEntries(puzzle);
    const entries = across.concat(down).sort((left, right) => left.number - right.number || (left.direction === "across" ? -1 : 1));
    const shortEntry = entries.find((entry) => entry.indices.length < 2);
    if (shortEntry) {
      throw new Error("This pattern has a one-cell entry. Across Lite .puz cannot number it reliably; fix the layout or export as .ipuz.");
    }
    if (puzzle.cols > 255 || puzzle.rows > 255 || entries.length > 0xffff) {
      throw new Error("This grid is outside the size limits of the .puz format.");
    }

    const warnings = new Set();
    const solution = Uint8Array.from(puzzle.answers.map((value, index) => encodePuzCell(value, puzzle.blocks[index], warnings)));
    const current = Uint8Array.from(puzzle.guesses.map((value, index) => encodePuzCell(value, puzzle.blocks[index], warnings)));
    const title = encodePuzText(puzzle.title || "Untitled crossword", warnings);
    const author = encodePuzText(puzzle.author || "", warnings);
    const copyright = encodePuzText("", warnings);
    const clueTexts = entries.map((entry) => encodePuzText(Model.formatClue(puzzle, entry), warnings));
    const notes = encodePuzText(puzzle.notes || "", warnings);

    const header = new Uint8Array(PUZ_HEADER_SIZE);
    header.set(asciiBytes(PUZ_MAGIC), 0x02);
    header.set(asciiBytes("1.3\0"), 0x18);
    header[0x2c] = puzzle.cols;
    header[0x2d] = puzzle.rows;
    writeU16(header, 0x2e, entries.length);
    writeU16(header, 0x30, 1); // Standard crossword puzzle type, as in Phil's PUZ writer.
    writeU16(header, 0x32, 0); // Not scrambled.
    const cibChecksum = checksumRegion(header.subarray(0x2c, 0x34), 0);
    writeU16(header, 0x0e, cibChecksum);

    const strings = [title, author, copyright, ...clueTexts, notes];
    const stringSection = concatBytes(strings.map(withNul));
    let primaryChecksum = cibChecksum;
    primaryChecksum = checksumRegion(solution, primaryChecksum);
    primaryChecksum = checksumRegion(current, primaryChecksum);
    if (title.length) primaryChecksum = checksumRegion(withNul(title), primaryChecksum);
    if (author.length) primaryChecksum = checksumRegion(withNul(author), primaryChecksum);
    if (copyright.length) primaryChecksum = checksumRegion(withNul(copyright), primaryChecksum);
    for (const clue of clueTexts) primaryChecksum = checksumRegion(clue, primaryChecksum);
    if (notes.length) primaryChecksum = checksumRegion(withNul(notes), primaryChecksum);
    writeU16(header, 0x00, primaryChecksum);

    const solutionChecksum = checksumRegion(solution, 0);
    const gridChecksum = checksumRegion(current, 0);
    let partialChecksum = 0;
    if (title.length) partialChecksum = checksumRegion(withNul(title), partialChecksum);
    if (author.length) partialChecksum = checksumRegion(withNul(author), partialChecksum);
    if (copyright.length) partialChecksum = checksumRegion(withNul(copyright), partialChecksum);
    for (const clue of clueTexts) partialChecksum = checksumRegion(clue, partialChecksum);
    if (notes.length) partialChecksum = checksumRegion(withNul(notes), partialChecksum);
    const checksumParts = [cibChecksum, solutionChecksum, gridChecksum, partialChecksum];
    const lowMask = [0x49, 0x43, 0x48, 0x45];
    const highMask = [0x41, 0x54, 0x45, 0x44];
    for (let part = 0; part < checksumParts.length; part += 1) {
      header[0x10 + part] = lowMask[part] ^ (checksumParts[part] & 0xff);
      header[0x14 + part] = highMask[part] ^ ((checksumParts[part] >>> 8) & 0xff);
    }

    return {
      bytes: concatBytes([header, solution, current, stringSection]),
      warnings: Array.from(warnings),
      clueCount: entries.length,
    };
  }

  return { createIpuz, createPuz, checksumRegion, readU16 };
});
