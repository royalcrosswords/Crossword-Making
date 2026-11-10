/* Gridwright crossword model — original, dependency-free logic. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GridwrightModel = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FORMAT = "gridwright.crossword";
  const VERSION = 1;
  const MAX_DIMENSION = 60;
  const MAX_CELLS = 3600;
  const CRYPTIC_MECHANISMS = new Set([
    "anagram", "charade", "container", "reversal", "hidden", "deletion",
    "homophone", "initials", "alternation", "double-definition", "other",
  ]);

  function makeId() {
    const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : null;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
    return `gw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function dimensions(rows, cols) {
    const height = Number(rows);
    const width = Number(cols);
    if (!Number.isInteger(height) || !Number.isInteger(width) || height < 3 || width < 3) {
      throw new Error("Grid rows and columns must each be whole numbers of at least 3.");
    }
    if (height > MAX_DIMENSION || width > MAX_DIMENSION || height * width > MAX_CELLS) {
      throw new Error(`For device safety, grids can be up to ${MAX_DIMENSION} × ${MAX_DIMENSION} (${MAX_CELLS} cells).`);
    }
    return { rows: height, cols: width, size: height * width };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createPuzzle(rows, cols, title) {
    const size = dimensions(rows === undefined ? 15 : rows, cols === undefined ? 15 : cols);
    const now = new Date().toISOString();
    return {
      format: FORMAT,
      version: VERSION,
      id: makeId(),
      title: typeof title === "string" && title.trim() ? title.trim() : "Untitled crossword",
      author: "",
      notes: "",
      rows: size.rows,
      cols: size.cols,
      blocks: Array(size.size).fill(false),
      answers: Array(size.size).fill(""),
      guesses: Array(size.size).fill(""),
      clues: {},
      crosswordStyle: "american",
      crypticClues: {},
      mirrorBlocks: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  function normalizeLetter(value) {
    if (value === null || value === undefined || value === "") return "";
    const text = String(value).normalize("NFC").toLocaleUpperCase();
    const glyphs = Array.from(text);
    if (glyphs.length !== 1 || !/^[\p{L}\p{N}]$/u.test(glyphs[0])) {
      throw new Error("Each crossword cell accepts one letter or number.");
    }
    return glyphs[0];
  }

  function parseEnumeration(value, expectedLength) {
    const text = String(value == null ? "" : value).trim();
    if (!text) return { valid: true, automatic: true, parts: [expectedLength], text: String(expectedLength) };
    if (!/^\d+(?:\s*,\s*\d+)*$/.test(text)) return { valid: false, automatic: false, parts: [], text };
    const parts = text.split(",").map((part) => Number(part.trim()));
    const valid = parts.every((part) => Number.isInteger(part) && part > 0) && parts.reduce((sum, part) => sum + part, 0) === expectedLength;
    return { valid, automatic: false, parts, text: parts.join(", ") };
  }

  function getEnumeration(puzzle, entry) {
    const meta = puzzle.crypticClues && puzzle.crypticClues[entry.id];
    const parsed = parseEnumeration(meta && meta.enumeration, entry.indices.length);
    return parsed.valid ? parsed.text : String(entry.indices.length);
  }

  function formatClue(puzzle, entry, sourceText) {
    const clue = String(sourceText == null ? (puzzle.clues[entry.id] || "") : sourceText).trim();
    if (!clue || puzzle.crosswordStyle !== "british") return clue;
    return `${clue} (${getEnumeration(puzzle, entry)})`;
  }

  function normalizePuzzle(source) {
    if (!source || source.format !== FORMAT || source.version !== VERSION) {
      throw new Error("This is not a Gridwright puzzle file. Import a .gwx.json file created by Gridwright.");
    }
    const size = dimensions(source.rows, source.cols);
    const exactArray = (value, name, mapper) => {
      if (!Array.isArray(value) || value.length !== size.size) {
        throw new Error(`Puzzle data is invalid: ${name} must contain ${size.size} cells.`);
      }
      return value.map(mapper);
    };
    const blocks = exactArray(source.blocks, "blocks", (value) => {
      if (typeof value !== "boolean") throw new Error("Puzzle data is invalid: block cells must be true or false.");
      return value;
    });
    const answers = exactArray(source.answers, "answers", normalizeLetter);
    const guesses = exactArray(source.guesses, "guesses", normalizeLetter);
    for (let index = 0; index < size.size; index += 1) {
      if (blocks[index]) {
        answers[index] = "";
        guesses[index] = "";
      }
    }
    const clues = {};
    if (source.clues && typeof source.clues === "object" && !Array.isArray(source.clues)) {
      for (const [key, value] of Object.entries(source.clues)) {
        const match = /^(across|down):(\d+):(\d+)$/.exec(key);
        if (match && Number(match[2]) < size.rows && Number(match[3]) < size.cols && typeof value === "string") clues[key] = value;
      }
    }
    const crypticClues = {};
    if (source.crypticClues && typeof source.crypticClues === "object" && !Array.isArray(source.crypticClues)) {
      for (const [key, value] of Object.entries(source.crypticClues)) {
        const match = /^(across|down):(\d+):(\d+)$/.exec(key);
        if (!match || Number(match[2]) >= size.rows || Number(match[3]) >= size.cols || !value || typeof value !== "object") continue;
        crypticClues[key] = {
          mechanism: CRYPTIC_MECHANISMS.has(value.mechanism) ? value.mechanism : "",
          definition: typeof value.definition === "string" ? value.definition.slice(0, 500) : "",
          wordplay: typeof value.wordplay === "string" ? value.wordplay.slice(0, 500) : "",
          enumeration: typeof value.enumeration === "string" ? value.enumeration.slice(0, 32) : "",
        };
      }
    }
    const validDate = (value, fallback) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : fallback;
    const now = new Date().toISOString();
    return {
      format: FORMAT,
      version: VERSION,
      id: typeof source.id === "string" && source.id ? source.id : makeId(),
      title: typeof source.title === "string" ? source.title : "Untitled crossword",
      author: typeof source.author === "string" ? source.author : "",
      notes: typeof source.notes === "string" ? source.notes : "",
      rows: size.rows,
      cols: size.cols,
      blocks,
      answers,
      guesses,
      clues,
      crosswordStyle: source.crosswordStyle === "british" ? "british" : "american",
      crypticClues,
      mirrorBlocks: source.mirrorBlocks === true || source.crosswordStyle === "british",
      createdAt: validDate(source.createdAt, now),
      updatedAt: validDate(source.updatedAt, now),
    };
  }

  function entryId(direction, row, col) {
    return `${direction}:${row}:${col}`;
  }

  function getEntries(puzzle) {
    const { rows, cols } = puzzle;
    const cellNumbers = Array(rows * cols).fill(0);
    const across = [];
    const down = [];
    const british = puzzle.crosswordStyle === "british";
    const minimumClueLength = british ? 3 : 1;
    let number = 0;
    const isBlock = (row, col) => row < 0 || col < 0 || row >= rows || col >= cols || puzzle.blocks[row * cols + col];
    const runLength = (row, col, direction) => {
      let length = 0;
      if (direction === "across") {
        for (let nextCol = col; nextCol < cols && !isBlock(row, nextCol); nextCol += 1) length += 1;
      } else {
        for (let nextRow = row; nextRow < rows && !isBlock(nextRow, col); nextRow += 1) length += 1;
      }
      return length;
    };

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (isBlock(row, col)) continue;
        const startsAcross = isBlock(row, col - 1);
        const startsDown = isBlock(row - 1, col);
        if (!startsAcross && !startsDown) continue;
        const acrossLength = startsAcross ? runLength(row, col, "across") : 0;
        const downLength = startsDown ? runLength(row, col, "down") : 0;
        const hasAcross = startsAcross && acrossLength >= minimumClueLength;
        const hasDown = startsDown && downLength >= minimumClueLength;
        if (!hasAcross && !hasDown) continue;
        number += 1;
        const startIndex = row * cols + col;
        cellNumbers[startIndex] = number;

        if (hasAcross) {
          const indices = [];
          for (let nextCol = col; nextCol < cols && !isBlock(row, nextCol); nextCol += 1) {
            indices.push(row * cols + nextCol);
          }
          across.push({
            id: entryId("across", row, col), direction: "across", number,
            row, col, startIndex, indices,
          });
        }
        if (hasDown) {
          const indices = [];
          for (let nextRow = row; nextRow < rows && !isBlock(nextRow, col); nextRow += 1) {
            indices.push(nextRow * cols + col);
          }
          down.push({
            id: entryId("down", row, col), direction: "down", number,
            row, col, startIndex, indices,
          });
        }
      }
    }
    return { across, down, cellNumbers };
  }

  function setLetter(puzzle, index, value, field) {
    if (!Number.isInteger(index) || index < 0 || index >= puzzle.rows * puzzle.cols) return clone(puzzle);
    const next = clone(puzzle);
    if (next.blocks[index]) return next;
    const target = field === "answer" ? "answers" : "guesses";
    next[target][index] = normalizeLetter(value);
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function toggleBlock(puzzle, index) {
    if (!Number.isInteger(index) || index < 0 || index >= puzzle.rows * puzzle.cols) return clone(puzzle);
    const next = clone(puzzle);
    const value = !next.blocks[index];
    const indices = new Set([index]);
    if (next.mirrorBlocks) indices.add(next.rows * next.cols - 1 - index);
    for (const target of indices) {
      next.blocks[target] = value;
      if (value) {
        next.answers[target] = "";
        next.guesses[target] = "";
      }
    }
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function resizePuzzle(puzzle, rows, cols) {
    const size = dimensions(rows, cols);
    const next = clone(puzzle);
    const blocks = Array(size.size).fill(false);
    const answers = Array(size.size).fill("");
    const guesses = Array(size.size).fill("");
    const keepRows = Math.min(puzzle.rows, size.rows);
    const keepCols = Math.min(puzzle.cols, size.cols);
    for (let row = 0; row < keepRows; row += 1) {
      for (let col = 0; col < keepCols; col += 1) {
        const oldIndex = row * puzzle.cols + col;
        const newIndex = row * size.cols + col;
        blocks[newIndex] = Boolean(puzzle.blocks[oldIndex]);
        answers[newIndex] = puzzle.answers[oldIndex] || "";
        guesses[newIndex] = puzzle.guesses[oldIndex] || "";
      }
    }
    const clues = {};
    for (const [key, value] of Object.entries(puzzle.clues || {})) {
      const match = /^(across|down):(\d+):(\d+)$/.exec(key);
      if (match && Number(match[2]) < size.rows && Number(match[3]) < size.cols) clues[key] = value;
    }
    next.rows = size.rows;
    next.cols = size.cols;
    next.blocks = blocks;
    next.answers = answers;
    next.guesses = guesses;
    next.clues = clues;
    const currentEntries = getEntries(next);
    const validEntries = new Set(currentEntries.across.concat(currentEntries.down).map((entry) => entry.id));
    next.crypticClues = Object.fromEntries(Object.entries(next.crypticClues || {}).filter(([id]) => validEntries.has(id)));
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function checkIndices(puzzle, indices) {
    const wrong = [];
    const empty = [];
    let comparable = 0;
    for (const index of indices) {
      if (!Number.isInteger(index) || index < 0 || index >= puzzle.rows * puzzle.cols || puzzle.blocks[index]) continue;
      const answer = puzzle.answers[index];
      const guess = puzzle.guesses[index];
      if (!answer) continue;
      comparable += 1;
      if (!guess) empty.push(index);
      else if (guess !== answer) wrong.push(index);
    }
    return {
      wrong,
      empty,
      comparable,
      complete: comparable > 0 && empty.length === 0,
      correct: comparable > 0 && empty.length === 0 && wrong.length === 0,
    };
  }

  function revealIndices(puzzle, indices) {
    const next = clone(puzzle);
    for (const index of indices) {
      if (Number.isInteger(index) && index >= 0 && index < next.rows * next.cols && !next.blocks[index]) {
        next.guesses[index] = next.answers[index] || "";
      }
    }
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function openIndices(puzzle) {
    const result = [];
    for (let index = 0; index < puzzle.rows * puzzle.cols; index += 1) {
      if (!puzzle.blocks[index]) result.push(index);
    }
    return result;
  }

  function blockGroups(rows, cols, symmetry) {
    const size = rows * cols;
    const groups = [];
    for (let index = 0; index < size; index += 1) {
      const mirror = symmetry ? size - 1 - index : index;
      if (symmetry && index > mirror) continue;
      groups.push(index === mirror ? [index] : [index, mirror]);
    }
    return groups;
  }

  function hasValidRuns(blocks, rows, cols, minimumLength) {
    for (let row = 0; row < rows; row += 1) {
      let run = 0;
      let open = 0;
      for (let col = 0; col <= cols; col += 1) {
        const blocked = col === cols || blocks[row * cols + col];
        if (blocked) {
          if (run > 0 && run < minimumLength) return false;
          run = 0;
        } else {
          run += 1;
          open += 1;
        }
      }
      if (open === 0) return false;
    }
    for (let col = 0; col < cols; col += 1) {
      let run = 0;
      let open = 0;
      for (let row = 0; row <= rows; row += 1) {
        const blocked = row === rows || blocks[row * cols + col];
        if (blocked) {
          if (run > 0 && run < minimumLength) return false;
          run = 0;
        } else {
          run += 1;
          open += 1;
        }
      }
      if (open === 0) return false;
    }
    return true;
  }

  function isConnectedOpenArea(blocks, rows, cols) {
    const total = rows * cols;
    const first = blocks.findIndex((blocked) => !blocked);
    if (first < 0) return false;
    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;
    let seen = 0;
    queue[tail++] = first;
    visited[first] = 1;
    while (head < tail) {
      const index = queue[head++];
      seen += 1;
      const row = Math.floor(index / cols);
      const col = index % cols;
      const neighbours = [
        row > 0 ? index - cols : -1,
        row + 1 < rows ? index + cols : -1,
        col > 0 ? index - 1 : -1,
        col + 1 < cols ? index + 1 : -1,
      ];
      for (const next of neighbours) {
        if (next >= 0 && !blocks[next] && !visited[next]) {
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    let open = 0;
    for (const blocked of blocks) if (!blocked) open += 1;
    return seen === open;
  }

  function collectDirectionalRuns(blocks, rows, cols, direction) {
    const horizontal = direction === "across";
    const lineCount = horizontal ? rows : cols;
    const lineLength = horizontal ? cols : rows;
    const runs = [];
    for (let line = 0; line < lineCount; line += 1) {
      let run = [];
      for (let position = 0; position <= lineLength; position += 1) {
        const atEnd = position === lineLength;
        const index = horizontal ? line * cols + position : position * cols + line;
        if (atEnd || blocks[index]) {
          if (run.length) runs.push(run);
          run = [];
        } else {
          run.push(index);
        }
      }
    }
    return runs;
  }

  function inspectBritishGrid(blocks, rows, cols, options) {
    const settings = options || {};
    const issues = [];
    const addIssue = (message) => {
      if (!issues.includes(message)) issues.push(message);
    };
    const size = rows * cols;
    const requireSymmetry = settings.requireSymmetry !== false;
    let blockCount = 0;
    let openCount = 0;
    for (const blocked of blocks) {
      if (blocked) blockCount += 1;
      else openCount += 1;
    }

    if (rows % 2 === 0 || cols % 2 === 0) {
      addIssue("British blocked cryptic grids normally use odd dimensions, such as 13 × 13 or 15 × 15.");
    }
    if (requireSymmetry) {
      for (let index = 0, end = size - 1; index < end; index += 1) {
        if (Boolean(blocks[index]) !== Boolean(blocks[end - index])) {
          addIssue("Black squares are not 180° rotationally symmetric.");
          break;
        }
      }
    }
    if (!isConnectedOpenArea(blocks, rows, cols)) {
      addIssue("All open squares must connect into one continuous region.");
    }

    for (let row = 0; row < rows; row += 1) {
      let rowOpen = false;
      let consecutiveBlocks = 0;
      for (let col = 0; col < cols; col += 1) {
        if (blocks[row * cols + col]) {
          consecutiveBlocks += 1;
          if (consecutiveBlocks > 3) addIssue("Avoid runs of more than three consecutive black squares.");
        } else {
          rowOpen = true;
          consecutiveBlocks = 0;
        }
      }
      if (!rowOpen) addIssue("Every row and column must contain open squares.");
    }
    for (let col = 0; col < cols; col += 1) {
      let colOpen = false;
      let consecutiveBlocks = 0;
      for (let row = 0; row < rows; row += 1) {
        if (blocks[row * cols + col]) {
          consecutiveBlocks += 1;
          if (consecutiveBlocks > 3) addIssue("Avoid runs of more than three consecutive black squares.");
        } else {
          colOpen = true;
          consecutiveBlocks = 0;
        }
      }
      if (!colOpen) addIssue("Every row and column must contain open squares.");
    }

    let hasBlackSquareCluster = false;
    for (let row = 0; row < rows - 1 && !hasBlackSquareCluster; row += 1) {
      for (let col = 0; col < cols - 1; col += 1) {
        const index = row * cols + col;
        if (blocks[index] && blocks[index + 1] && blocks[index + cols] && blocks[index + cols + 1]) {
          hasBlackSquareCluster = true;
          break;
        }
      }
    }
    if (hasBlackSquareCluster) addIssue("Avoid solid 2 × 2 blocks of black squares in a British-style grid.");

    const acrossRuns = collectDirectionalRuns(blocks, rows, cols, "across");
    const downRuns = collectDirectionalRuns(blocks, rows, cols, "down");
    const twoCellRuns = acrossRuns.filter((run) => run.length === 2).length + downRuns.filter((run) => run.length === 2).length;
    if (twoCellRuns) addIssue("British blocked grids must not contain two-cell runs; single-cell unches are allowed.");
    const acrossEntries = acrossRuns.filter((run) => run.length >= 3);
    const downEntries = downRuns.filter((run) => run.length >= 3);
    const entries = acrossEntries.concat(downEntries);
    if (!acrossEntries.length || !downEntries.length) addIssue("The grid needs at least one Across and one Down entry.");

    const entryCount = new Uint8Array(size);
    for (const entry of entries) for (const index of entry) entryCount[index] += 1;
    let checkedCells = 0;
    let uncheckedCells = 0;
    let orphanCells = 0;
    for (let index = 0; index < size; index += 1) {
      if (blocks[index]) continue;
      if (entryCount[index] === 0) orphanCells += 1;
      else if (entryCount[index] === 1) uncheckedCells += 1;
      else checkedCells += 1;
    }
    if (orphanCells) addIssue("Every open square must belong to at least one Across or Down answer.");
    if (settings.requireUnches && uncheckedCells === 0) {
      addIssue("A British blocked grid should include some unchecked letters (unches), not only fully checked squares.");
    }

    for (const entry of entries) {
      let checked = 0;
      let consecutiveUnches = 0;
      let invalidUnchPattern = false;
      for (const index of entry) {
        if (entryCount[index] >= 2) {
          checked += 1;
          consecutiveUnches = 0;
        } else {
          consecutiveUnches += 1;
          if (consecutiveUnches > 2) invalidUnchPattern = true;
        }
      }
      if (checked < Math.ceil(entry.length / 2)) {
        addIssue("Every British cryptic answer should have at least half its letters checked by crossings.");
      }
      if (invalidUnchPattern) addIssue("Do not place more than two unchecked letters consecutively in an answer.");
      if (entry.length >= 2 && entryCount[entry[0]] === 1 && entryCount[entry[1]] === 1) {
        addIssue("A pair of unchecked letters cannot start an answer.");
      }
      const last = entry.length - 1;
      if (entry.length >= 2 && entryCount[entry[last]] === 1 && entryCount[entry[last - 1]] === 1) {
        addIssue("A pair of unchecked letters cannot end an answer.");
      }
    }

    const blackPercent = size ? (blockCount / size) * 100 : 0;
    if (settings.checkDensity && (blackPercent < 24.5 || blackPercent > 35.5)) {
      addIssue("A standard British blocked cryptic grid usually aims for about 25–35% black squares.");
    }
    return {
      valid: issues.length === 0,
      issues,
      blockCount,
      blackPercent: Math.round(blackPercent * 10) / 10,
      acrossCount: acrossEntries.length,
      downCount: downEntries.length,
      entryCount: entries.length,
      checkedCells,
      uncheckedCells,
      orphanCells,
      checkedPercent: openCount ? Math.round((checkedCells / openCount) * 1000) / 10 : 0,
      twoCellRuns,
    };
  }

  function maskIsValid(blocks, rows, cols, minimumLength, symmetry, style) {
    if (style === "british") {
      return inspectBritishGrid(blocks, rows, cols, { requireSymmetry: symmetry }).valid;
    }
    if (symmetry) {
      for (let index = 0, end = blocks.length - 1; index < end; index += 1) {
        if (Boolean(blocks[index]) !== Boolean(blocks[end - index])) return false;
      }
    }
    return hasValidRuns(blocks, rows, cols, minimumLength) && isConnectedOpenArea(blocks, rows, cols);
  }

  function validateLayout(puzzle, options) {
    const settings = options || {};
    const { rows, cols, size } = dimensions(puzzle.rows, puzzle.cols);
    if (!Array.isArray(puzzle.blocks) || puzzle.blocks.length !== size) {
      throw new Error("This grid has invalid block data.");
    }
    const minimumLength = Number.isInteger(settings.minimumLength) ? Math.max(1, settings.minimumLength) : 3;
    const requireSymmetry = settings.requireSymmetry !== false;
    let blockCount = 0;
    for (const blocked of puzzle.blocks) if (blocked) blockCount += 1;
    const british = puzzle.crosswordStyle === "british";
    let issues = [];
    let britishStats = null;

    if (blockCount === 0) issues.push("Add at least one black square to make a crossword pattern.");
    if (british) {
      britishStats = inspectBritishGrid(puzzle.blocks, rows, cols, {
        requireSymmetry,
        checkDensity: true,
        requireUnches: true,
      });
      issues = issues.concat(britishStats.issues.filter((issue) => !issues.includes(issue)));
    } else {
      if (requireSymmetry) {
        for (let index = 0, end = size - 1; index < end; index += 1) {
          if (Boolean(puzzle.blocks[index]) !== Boolean(puzzle.blocks[end - index])) {
            issues.push("Black squares are not 180° rotationally symmetric.");
            break;
          }
        }
      }
      if (!hasValidRuns(puzzle.blocks, rows, cols, minimumLength)) {
        issues.push(`Every Across and Down slot must be at least ${minimumLength} cells; each row and column must contain open cells.`);
      }
      if (!isConnectedOpenArea(puzzle.blocks, rows, cols)) {
        issues.push("All open squares must connect into one continuous region.");
      }
    }

    const entries = getEntries(puzzle);
    const acrossCount = britishStats ? britishStats.acrossCount : entries.across.length;
    const downCount = britishStats ? britishStats.downCount : entries.down.length;
    return {
      valid: issues.length === 0,
      issues,
      style: british ? "british" : "american",
      blockCount,
      blackPercent: britishStats ? britishStats.blackPercent : Math.round((blockCount / size) * 1000) / 10,
      entryCount: acrossCount + downCount,
      acrossCount,
      downCount,
      minimumLength: british ? 3 : minimumLength,
      requireSymmetry,
      checkedCells: britishStats ? britishStats.checkedCells : null,
      uncheckedCells: britishStats ? britishStats.uncheckedCells : null,
      checkedPercent: britishStats ? britishStats.checkedPercent : null,
      orphanCells: britishStats ? britishStats.orphanCells : null,
      twoCellRuns: britishStats ? britishStats.twoCellRuns : 0,
      puzNumberingCompatible: !british || !britishStats.twoCellRuns,
    };
  }

  function shuffle(values, random = Math.random) {
    for (let index = values.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [values[index], values[other]] = [values[other], values[index]];
    }
    return values;
  }

  function generateLayout(puzzle, options) {
    const settings = options || {};
    const { rows, cols, size } = dimensions(puzzle.rows, puzzle.cols);
    const british = puzzle.crosswordStyle === "british";
    if (rows < 5 || cols < 5) throw new Error("Automatic patterns need a grid at least 5 × 5.");
    if (rows > 31 || cols > 31 || size > 961) {
      throw new Error("Automatic pattern generation currently supports grids up to 31 × 31; larger grids can still be designed manually.");
    }
    if (british && (rows % 2 === 0 || cols % 2 === 0)) {
      throw new Error("British blocked cryptic layouts use odd row and column counts. Resize to an odd grid such as 13 × 13 or 15 × 15 first.");
    }
    const minimumTarget = british ? 25 : 5;
    const maximumTarget = british ? 35 : 25;
    const targetPercent = Number(settings.targetPercent === undefined ? (british ? 30 : 15) : settings.targetPercent);
    if (!Number.isFinite(targetPercent) || targetPercent < minimumTarget || targetPercent > maximumTarget) {
      throw new Error(british
        ? "For a British blocked cryptic grid, choose a black-square target from 25% to 35%."
        : "Choose a black-square target from 5% to 25%.");
    }
    const targetCount = Math.max(1, Math.round((size * targetPercent) / 100));
    const minimumLength = 3;
    const symmetry = british || settings.symmetry !== false;
    const random = typeof settings.random === "function" ? settings.random : Math.random;
    const groups = blockGroups(rows, cols, symmetry);
    const anchorIndex = settings.anchorIndex;
    let anchorGroup = null;
    let seedAdjusted = false;
    let resolvedSeedIndex = null;
    if (anchorIndex !== null && anchorIndex !== undefined) {
      if (!Number.isInteger(anchorIndex) || anchorIndex < 0 || anchorIndex >= size) {
        throw new Error("Choose a square in the grid as the pattern seed.");
      }
      const mirror = symmetry ? size - 1 - anchorIndex : anchorIndex;
      const requestedGroup = anchorIndex === mirror ? [anchorIndex] : [anchorIndex, mirror];
      const seedIsValid = (group) => {
        const candidate = Array(size).fill(false);
        for (const index of group) candidate[index] = true;
        return maskIsValid(candidate, rows, cols, minimumLength, symmetry, british ? "british" : "american");
      };
      if (seedIsValid(requestedGroup)) {
        anchorGroup = requestedGroup;
      } else {
        const anchorRow = Math.floor(anchorIndex / cols);
        const anchorCol = anchorIndex % cols;
        const nearest = groups
          .map((group) => ({
            group,
            distance: Math.min(...group.map((index) => Math.abs(Math.floor(index / cols) - anchorRow) + Math.abs((index % cols) - anchorCol))),
          }))
          .sort((left, right) => left.distance - right.distance)
          .find((candidate) => seedIsValid(candidate.group));
        if (!nearest) throw new Error("Could not find a rule-safe seed square on this grid.");
        anchorGroup = nearest.group;
        seedAdjusted = true;
      }
      resolvedSeedIndex = anchorGroup.reduce((closest, index) => {
        const distance = Math.abs(Math.floor(index / cols) - Math.floor(anchorIndex / cols)) + Math.abs((index % cols) - (anchorIndex % cols));
        const closestDistance = Math.abs(Math.floor(closest / cols) - Math.floor(anchorIndex / cols)) + Math.abs((closest % cols) - (anchorIndex % cols));
        return distance < closestDistance ? index : closest;
      }, anchorGroup[0]);
    }

    const attempts = size > 600 ? 3 : british ? 12 : 8;
    let best = null;
    let bestScore = -Infinity;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const blocks = Array(size).fill(false);
      let blockCount = 0;
      if (anchorGroup) {
        for (const index of anchorGroup) blocks[index] = true;
        blockCount = anchorGroup.length;
      }

      let steps = 0;
      while (blockCount < targetCount && steps < targetCount + 2) {
        steps += 1;
        const candidates = shuffle(groups.filter((group) => group.every((index) => !blocks[index])), random);
        const validGroups = [];
        for (const group of candidates) {
          if (blockCount + group.length > targetCount + 1) continue;
          for (const index of group) blocks[index] = true;
          const stats = british
            ? inspectBritishGrid(blocks, rows, cols, { requireSymmetry: symmetry })
            : null;
          const valid = british
            ? stats.valid
            : maskIsValid(blocks, rows, cols, minimumLength, symmetry, "american");
          for (const index of group) blocks[index] = false;
          if (valid) validGroups.push({ group, uncheckedCells: stats ? stats.uncheckedCells : 0 });
        }
        if (!validGroups.length) break;
        let choicePool = validGroups;
        if (british) {
          const maxUnches = Math.max(...validGroups.map((candidate) => candidate.uncheckedCells));
          choicePool = validGroups.filter((candidate) => candidate.uncheckedCells >= maxUnches - 1);
        }
        const chosen = choicePool[Math.min(choicePool.length - 1, Math.floor(random() * choicePool.length))].group;
        for (const index of chosen) blocks[index] = true;
        blockCount += chosen.length;
      }

      if (!maskIsValid(blocks, rows, cols, minimumLength, symmetry, british ? "british" : "american")) continue;
      const britishStats = british
        ? inspectBritishGrid(blocks, rows, cols, { requireSymmetry: symmetry, checkDensity: true, requireUnches: true })
        : null;
      if (british && !britishStats.valid) continue;
      const score = blockCount >= targetCount
        ? 1000 - Math.abs(blockCount - targetCount) * 10
        : blockCount;
      if (score > bestScore) {
        bestScore = score;
        best = { blocks: [...blocks], blockCount, britishStats };
      }
      if (blockCount >= targetCount) break;
    }

    if (!best) throw new Error(british
      ? "Could not create a British-style blocked cryptic pattern for this grid and target. Try 13 × 13 or 15 × 15, or change the selected seed square."
      : "Could not create a valid pattern for this grid. Try a larger grid or a different seed square.");
    const next = clone(puzzle);
    next.blocks = best.blocks;
    next.answers = Array(size).fill("");
    next.guesses = Array(size).fill("");
    next.clues = {};
    next.crypticClues = {};
    next.mirrorBlocks = symmetry;
    next.updatedAt = new Date().toISOString();
    const entries = getEntries(next);
    return {
      puzzle: next,
      blockCount: best.blockCount,
      blackPercent: Math.round((best.blockCount / size) * 1000) / 10,
      targetPercent,
      targetReached: best.blockCount >= targetCount,
      seedAdjusted,
      seedIndex: resolvedSeedIndex,
      entryCount: entries.across.length + entries.down.length,
      acrossCount: entries.across.length,
      downCount: entries.down.length,
      checkedPercent: best.britishStats ? best.britishStats.checkedPercent : null,
      uncheckedCells: best.britishStats ? best.britishStats.uncheckedCells : null,
      puzNumberingCompatible: !british || best.britishStats.twoCellRuns === 0,
    };
  }

  return {
    FORMAT,
    VERSION,
    MAX_DIMENSION,
    MAX_CELLS,
    makeId,
    clone,
    createPuzzle,
    normalizeLetter,
    normalizePuzzle,
    parseEnumeration,
    getEnumeration,
    formatClue,
    entryId,
    getEntries,
    setLetter,
    toggleBlock,
    resizePuzzle,
    checkIndices,
    revealIndices,
    openIndices,
    validateLayout,
    generateLayout,
  };
});
