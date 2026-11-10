/* Gridwright US & UK Crossword Studio — crossing-aware autofill and backtracking. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./model.js"));
  } else {
    root.GridwrightAutoFill = factory(root.GridwrightModel);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Model) {
  "use strict";

  function normalizeWord(value) {
    const text = String(value == null ? "" : value)
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    return /^[A-Z]+$/.test(text) ? text : "";
  }

  function normalizeCell(value) {
    if (value === null || value === undefined || value === "") return "";
    const glyphs = Array.from(String(value).normalize("NFC").toLocaleUpperCase());
    return glyphs.length === 1 ? glyphs[0] : "";
  }

  function parseWordList(text, options = {}) {
    const minLength = Number.isInteger(options.minLength) ? options.minLength : 3;
    const maxLength = Number.isInteger(options.maxLength) ? options.maxLength : 60;
    const words = [];
    const seen = new Set();
    const lines = String(text == null ? "" : text).split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const firstField = trimmed.split(/[,;\t|]/, 1)[0].trim();
      const word = normalizeWord(firstField);
      if (!word || word.length < minLength || word.length > maxLength || seen.has(word)) continue;
      seen.add(word);
      words.push(word);
    }
    return words;
  }

  function buildIndex(inputWords) {
    const source = Array.isArray(inputWords) ? inputWords : [];
    const byLength = new Map();
    const seen = new Set();
    const words = [];

    for (const raw of source) {
      const word = normalizeWord(raw);
      if (word.length < 3 || seen.has(word)) continue;
      seen.add(word);
      words.push(word);
      let bucket = byLength.get(word.length);
      if (!bucket) {
        bucket = {
          words: [],
          positions: Array.from({ length: word.length }, () => new Map()),
        };
        byLength.set(word.length, bucket);
      }
      bucket.words.push(word);
      for (let position = 0; position < word.length; position += 1) {
        const letter = word[position];
        let candidates = bucket.positions[position].get(letter);
        if (!candidates) {
          candidates = [];
          bucket.positions[position].set(letter, candidates);
        }
        candidates.push(word);
      }
    }

    return { byLength, words, wordSet: seen, wordCount: words.length };
  }

  function entryPattern(entry, grid) {
    return entry.indices.map((index) => grid[index] || "").join("");
  }

  function countMatches(entry, grid, index, usedWords, usedByLength, allowRepeats) {
    const length = entry.indices.length;
    const bucket = index.byLength.get(length);
    if (!bucket) return 0;

    let pool = null;
    let hasConstraint = false;
    for (let position = 0; position < length; position += 1) {
      const letter = grid[entry.indices[position]];
      if (!letter) continue;
      hasConstraint = true;
      const candidates = bucket.positions[position].get(letter);
      if (!candidates || candidates.length === 0) return 0;
      if (!pool || candidates.length < pool.length) pool = candidates;
    }

    if (!hasConstraint) {
      return Math.max(0, bucket.words.length - (allowRepeats ? 0 : (usedByLength.get(length) || 0)));
    }

    let count = 0;
    for (const word of pool) {
      if (!allowRepeats && usedWords.has(word)) continue;
      let matches = true;
      for (let position = 0; position < length; position += 1) {
        const letter = grid[entry.indices[position]];
        if (letter && letter !== word[position]) {
          matches = false;
          break;
        }
      }
      if (matches) count += 1;
    }
    return count;
  }

  function rotateCandidates(words, rotation) {
    if (!words.length) return words;
    const offset = ((Math.trunc(rotation) % words.length) + words.length) % words.length;
    return offset ? words.slice(offset).concat(words.slice(0, offset)) : words;
  }

  function listMatches(entry, grid, index, usedWords, allowRepeats, limit, rotation = 0) {
    const length = entry.indices.length;
    const bucket = index.byLength.get(length);
    if (!bucket) return { words: [], truncated: false };

    let pool = null;
    for (let position = 0; position < length; position += 1) {
      const letter = grid[entry.indices[position]];
      if (!letter) continue;
      const candidates = bucket.positions[position].get(letter);
      if (!candidates || candidates.length === 0) return { words: [], truncated: false };
      if (!pool || candidates.length < pool.length) pool = candidates;
    }
    if (!pool) pool = bucket.words;

    const matches = [];
    for (const word of pool) {
      if (!allowRepeats && usedWords.has(word)) continue;
      let fits = true;
      for (let position = 0; position < length; position += 1) {
        const letter = grid[entry.indices[position]];
        if (letter && letter !== word[position]) {
          fits = false;
          break;
        }
      }
      if (!fits) continue;
      if (matches.length >= limit) return { words: rotateCandidates(matches, rotation), truncated: true };
      matches.push(word);
    }
    return { words: rotateCandidates(matches, rotation), truncated: false };
  }

  function countFilled(grid) {
    let count = 0;
    for (const letter of grid) if (letter) count += 1;
    return count;
  }

  function gridSignature(grid, blocks) {
    return grid.map((letter, index) => blocks[index] ? "#" : letter || ".").join("");
  }

  async function solveGrid(options = {}) {
    if (!Model) throw new Error("The Gridwright crossword model is required.");
    const rows = Number(options.rows);
    const cols = Number(options.cols);
    const size = rows * cols;
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || !Number.isSafeInteger(size) || size > 3600) {
      throw new Error("The grid dimensions are invalid or too large for autofill.");
    }
    if (!Array.isArray(options.blocks) || options.blocks.length !== size || !Array.isArray(options.answers) || options.answers.length !== size) {
      throw new Error("Autofill needs a block map and answer array matching the grid size.");
    }

    const puzzleShape = { rows, cols, blocks: options.blocks };
    const entries = Array.isArray(options.entries)
      ? options.entries
      : (() => {
        const found = Model.getEntries(puzzleShape);
        return found.across.concat(found.down);
      })();
    const grid = options.answers.map((value, cell) => options.blocks[cell] ? "" : normalizeCell(value));
    const dictionary = options.index && options.index.byLength instanceof Map
      ? options.index
      : buildIndex(options.words || []);
    const allowRepeats = options.allowRepeats === true;
    const maxNodes = Math.max(100, Math.min(1_000_000, Number(options.maxNodes) || 50_000));
    const maxMilliseconds = Math.max(250, Math.min(120_000, Number(options.maxMilliseconds) || 20_000));
    const maxCandidates = Math.max(1, Math.min(10_000, Number(options.maxCandidates) || 500));
    const variant = Math.max(0, Math.trunc(Number(options.variant) || 0));
    const excludedSolutions = new Set(Array.isArray(options.excludedSolutions)
      ? options.excludedSolutions.filter((signature) => typeof signature === "string")
      : []);
    const signal = options.signal || null;
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => {};
    const start = Date.now();
    const usedWords = new Set();
    const usedByLength = new Map();
    const assigned = new Set();
    let nodes = 0;
    let deadEnds = 0;
    let cancelled = false;
    let limitReached = false;
    let limitReason = "";
    let candidateTruncated = false;
    let bestGrid = grid.slice();
    let bestAssigned = 0;
    let bestFilled = countFilled(grid);
    let bestSignature = gridSignature(bestGrid, options.blocks);
    let lastReportedNode = 0;

    const sortedEntries = entries
      .filter((entry) => entry && Array.isArray(entry.indices) && entry.indices.length > 0)
      .map((entry, ordinal) => ({ ...entry, ordinal, crossings: 0 }));
    const crossingCounts = new Map();
    for (const entry of sortedEntries) {
      for (const cell of entry.indices) crossingCounts.set(cell, (crossingCounts.get(cell) || 0) + 1);
    }
    for (const entry of sortedEntries) {
      entry.crossings = entry.indices.reduce((total, cell) => total + ((crossingCounts.get(cell) || 0) > 1 ? 1 : 0), 0);
      const pattern = entryPattern(entry, grid);
      if (entry.indices.every((cell) => Boolean(grid[cell]))) {
        assigned.add(entry.id || `slot-${entry.ordinal}`);
        if (!allowRepeats) {
          if (!usedWords.has(pattern)) {
            usedWords.add(pattern);
            if (dictionary.wordSet && dictionary.wordSet.has(pattern)) {
              usedByLength.set(pattern.length, (usedByLength.get(pattern.length) || 0) + 1);
            }
          }
        }
      }
    }
    bestAssigned = assigned.size;

    function slotId(entry) {
      return entry.id || `slot-${entry.ordinal}`;
    }

    function saveBest() {
      const filled = countFilled(grid);
      const signature = gridSignature(grid, options.blocks);
      if (excludedSolutions.has(signature)) return;
      const betterScore = assigned.size > bestAssigned || (assigned.size === bestAssigned && filled > bestFilled);
      const equalScoreAlternative = variant > 0 && assigned.size === bestAssigned && filled === bestFilled &&
        signature !== bestSignature && !excludedSolutions.has(signature);
      if (betterScore || equalScoreAlternative) {
        bestAssigned = assigned.size;
        bestFilled = filled;
        bestGrid = grid.slice();
        bestSignature = signature;
      }
    }

    function stopped() {
      if (signal && signal.aborted) {
        cancelled = true;
        return true;
      }
      if (nodes >= maxNodes) {
        limitReached = true;
        limitReason = "step limit";
        return true;
      }
      if (Date.now() - start >= maxMilliseconds) {
        limitReached = true;
        limitReason = "time limit";
        return true;
      }
      return false;
    }

    function report(force = false) {
      if (!force && nodes - lastReportedNode < 128) return;
      lastReportedNode = nodes;
      try {
        onProgress({
          nodes,
          maxNodes,
          assigned: assigned.size,
          bestAssigned,
          total: sortedEntries.length,
          filledCells: countFilled(grid),
          bestFilledCells: bestFilled,
          totalOpenCells: options.blocks.filter((blocked) => !blocked).length,
          elapsedMilliseconds: Date.now() - start,
        });
      } catch (_error) {
        // A UI progress callback must not interrupt the search.
      }
    }

    function addUsed(word) {
      if (allowRepeats || usedWords.has(word)) return;
      usedWords.add(word);
      usedByLength.set(word.length, (usedByLength.get(word.length) || 0) + 1);
    }

    function removeUsed(word) {
      if (allowRepeats) return;
      usedWords.delete(word);
      const next = (usedByLength.get(word.length) || 1) - 1;
      if (next > 0) usedByLength.set(word.length, next);
      else usedByLength.delete(word.length);
    }

    async function search() {
      if (stopped()) return false;
      nodes += 1;
      if (assigned.size === sortedEntries.length) {
        if (excludedSolutions.has(gridSignature(grid, options.blocks))) {
          deadEnds += 1;
          return false;
        }
        saveBest();
        return true;
      }
      saveBest();

      let chosen = null;
      let chosenCount = Infinity;
      for (const entry of sortedEntries) {
        if (assigned.has(slotId(entry))) continue;
        const count = countMatches(entry, grid, dictionary, usedWords, usedByLength, allowRepeats);
        if (count === 0) {
          deadEnds += 1;
          return false;
        }
        if (!chosen || count < chosenCount || (count === chosenCount && entry.crossings > chosen.crossings) ||
          (count === chosenCount && entry.crossings === chosen.crossings && entry.indices.length > chosen.indices.length)) {
          chosen = entry;
          chosenCount = count;
        }
      }
      if (!chosen) return true;

      const rotation = variant ? variant * (chosen.ordinal + 1) : 0;
      const listed = listMatches(chosen, grid, dictionary, usedWords, allowRepeats, maxCandidates, rotation);
      candidateTruncated = candidateTruncated || listed.truncated;
      if (!listed.words.length) {
        deadEnds += 1;
        return false;
      }

      const id = slotId(chosen);
      for (const word of listed.words) {
        if (stopped()) return false;
        const changedCells = [];
        let conflict = false;
        for (let position = 0; position < chosen.indices.length; position += 1) {
          const cell = chosen.indices[position];
          if (grid[cell] && grid[cell] !== word[position]) {
            conflict = true;
            break;
          }
          if (!grid[cell]) {
            grid[cell] = word[position];
            changedCells.push(cell);
          }
        }
        if (!conflict) {
          assigned.add(id);
          addUsed(word);
          saveBest();
          if (nodes - lastReportedNode >= 128) {
            report();
            await new Promise((resolve) => setTimeout(resolve, 0));
            if (stopped()) {
              assigned.delete(id);
              removeUsed(word);
              for (const cell of changedCells) grid[cell] = "";
              return false;
            }
          }
          const solved = await search();
          if (solved) return true;
          assigned.delete(id);
          removeUsed(word);
        }
        for (const cell of changedCells) grid[cell] = "";
        if (cancelled || limitReached) return false;
      }
      return false;
    }

    report(true);
    let complete = false;
    if (!sortedEntries.length) complete = true;
    else if (assigned.size === sortedEntries.length && !excludedSolutions.has(gridSignature(grid, options.blocks))) complete = true;
    else if (dictionary.wordCount > 0) complete = await search();
    if (complete) {
      bestGrid = grid.slice();
      bestAssigned = assigned.size;
      bestFilled = countFilled(grid);
      bestSignature = gridSignature(bestGrid, options.blocks);
    }
    report(true);

    const elapsedMilliseconds = Date.now() - start;
    const resultGrid = complete ? grid.slice() : bestGrid;
    return {
      grid: resultGrid,
      signature: gridSignature(resultGrid, options.blocks),
      complete,
      cancelled,
      limitReached,
      limitReason,
      candidateTruncated,
      exhausted: !complete && !cancelled && !limitReached,
      nodes,
      deadEnds,
      elapsedMilliseconds,
      assignedCount: complete ? sortedEntries.length : bestAssigned,
      totalEntries: sortedEntries.length,
      filledCells: complete ? countFilled(grid) : bestFilled,
      totalOpenCells: options.blocks.filter((blocked) => !blocked).length,
      dictionaryWords: dictionary.wordCount,
    };
  }

  return { normalizeWord, parseWordList, buildIndex, gridSignature, solveGrid };
});
