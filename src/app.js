(() => {
  "use strict";

  const M = window.GridwrightModel;
  const AutoFill = window.GridwrightAutoFill;
  const ExportFormats = window.GridwrightExportFormats;
  const PdfExport = window.GridwrightPdfExport;
  const BritishWordPriority = window.GRIDWRIGHT_BRITISH_WORD_PRIORITY || "";
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "gridwright.usuk.crossword.library.v1";
  const HISTORY_LIMIT = 80;
  const layoutDensityByStyle = { american: 15, british: 30 };
  let layoutDensityStyle = null;
  const CRYPTIC_MECHANISM_LABELS = {
    "": "Choose a wordplay device…",
    anagram: "Anagram",
    charade: "Charade / put together",
    container: "Container / insertion",
    reversal: "Reversal",
    hidden: "Hidden word",
    deletion: "Deletion / subtraction",
    homophone: "Homophone",
    initials: "Initial letters",
    alternation: "Alternate letters",
    "double-definition": "Double definition",
    other: "Other / combination",
  };
  const CRYPTIC_MECHANISM_TIPS = {
    "": "Choose the main wordplay device used by this clue.",
    anagram: "Rearrange letters; common indicators include broken, wild, confused, or oddly.",
    charade: "Put word parts side by side to make the answer.",
    container: "Put one set of letters inside another; indicators can include about, holding, or around.",
    reversal: "Reverse letters; indicators can include back, returned, or going west/east.",
    hidden: "Read consecutive answer letters inside surrounding text; indicators can include part of or concealed in.",
    deletion: "Remove letters; indicators can include endless, heartless, or without.",
    homophone: "Use a word that sounds like the answer; indicators can include reportedly, heard, or on the radio.",
    initials: "Take initial or leading letters; indicators can include initially, leaders, or at first.",
    alternation: "Take alternating letters; indicators can include oddly, regularly, or every other.",
    "double-definition": "Use two separate definitions of the same answer; no wordplay indicator is needed.",
    other: "Use another device or a combination; explain the construction in the wordplay notes.",
  };

  const ui = {
    puzzleSelect: $("puzzleSelect"),
    crosswordStyleSelect: $("crosswordStyleSelect"),
    cluePanelKicker: $("cluePanelKicker"),
    cluesHeading: $("cluesHeading"),
    cluePanelHint: $("cluePanelHint"),
    crypticReviewButton: $("crypticReviewButton"),
    newPuzzleButton: $("newPuzzleButton"),
    openFileButton: $("openFileButton"),
    saveFileButton: $("saveFileButton"),
    exportPuzButton: $("exportPuzButton"),
    exportIpuzButton: $("exportIpuzButton"),
    exportPuzzlePdfButton: $("exportPuzzlePdfButton"),
    exportSolutionPdfButton: $("exportSolutionPdfButton"),
    exportNytPdfButton: $("exportNytPdfButton"),
    nytSubmissionDialog: $("nytSubmissionDialog"),
    nytSubmissionForm: $("nytSubmissionForm"),
    nytNameInput: $("nytNameInput"),
    nytEmailInput: $("nytEmailInput"),
    nytAddressInput: $("nytAddressInput"),
    closeNytDialogButton: $("closeNytDialogButton"),
    cancelNytDialogButton: $("cancelNytDialogButton"),
    printButton: $("printButton"),
    fileInput: $("fileInput"),
    buildModeButton: $("buildModeButton"),
    solveModeButton: $("solveModeButton"),
    buildTools: $("buildTools"),
    autoFillTools: $("autoFillTools"),
    solveTools: $("solveTools"),
    dictionaryStatus: $("dictionaryStatus"),
    defaultDictionaryButton: $("defaultDictionaryButton"),
    customDictionaryButton: $("customDictionaryButton"),
    dictionaryFileInput: $("dictionaryFileInput"),
    avoidRepeatsInput: $("avoidRepeatsInput"),
    fillNodeLimitInput: $("fillNodeLimitInput"),
    fillTimeLimitInput: $("fillTimeLimitInput"),
    fillCandidateLimitInput: $("fillCandidateLimitInput"),
    startAutoFillButton: $("startAutoFillButton"),
    tryAnotherFillButton: $("tryAnotherFillButton"),
    cancelAutoFillButton: $("cancelAutoFillButton"),
    autoFillProgress: $("autoFillProgress"),
    autoFillProgressBar: $("autoFillProgressBar"),
    autoFillStatus: $("autoFillStatus"),
    titleInput: $("titleInput"),
    authorInput: $("authorInput"),
    rowsInput: $("rowsInput"),
    colsInput: $("colsInput"),
    resizeButton: $("resizeButton"),
    mirrorBlocksInput: $("mirrorBlocksInput"),
    mirrorBlocksHint: $("mirrorBlocksHint"),
    blockButton: $("blockButton"),
    blockDensityInput: $("blockDensityInput"),
    anchorSeedInput: $("anchorSeedInput"),
    generatorModeHint: $("generatorModeHint"),
    generatorRuleNote: $("generatorRuleNote"),
    generateLayoutButton: $("generateLayoutButton"),
    validateLayoutButton: $("validateLayoutButton"),
    clearButton: $("clearButton"),
    deletePuzzleButton: $("deletePuzzleButton"),
    timerText: $("timerText"),
    progressText: $("progressText"),
    checkCellButton: $("checkCellButton"),
    checkWordButton: $("checkWordButton"),
    revealCellButton: $("revealCellButton"),
    revealWordButton: $("revealWordButton"),
    checkPuzzleButton: $("checkPuzzleButton"),
    revealPuzzleButton: $("revealPuzzleButton"),
    clearGuessesButton: $("clearGuessesButton"),
    playHint: $("playHint"),
    boardTitle: $("boardTitle"),
    boardByline: $("boardByline"),
    modeDot: $("modeDot"),
    modeLabel: $("modeLabel"),
    gridDimensionsLabel: $("gridDimensionsLabel"),
    entryCountText: $("entryCountText"),
    fillCountText: $("fillCountText"),
    saveStatusDot: $("saveStatusDot"),
    saveStatusText: $("saveStatusText"),
    grid: $("crosswordGrid"),
    activeEntryLabel: $("activeEntryLabel"),
    activeEntryLength: $("activeEntryLength"),
    toast: $("toast"),
    acrossTab: $("acrossTab"),
    downTab: $("downTab"),
    acrossCount: $("acrossCount"),
    downCount: $("downCount"),
    clueTotal: $("clueTotal"),
    clueList: $("clueList"),
    undoButton: $("undoButton"),
    redoButton: $("redoButton"),
    focusGridButton: $("focusGridButton"),
  };

  let projects = [];
  let activeId = "";
  let puzzle = null;
  let mode = "build";
  let direction = "across";
  let selectedIndex = 0;
  let currentEntries = null;
  let wrongCells = new Set();
  let history = [];
  let redoHistory = [];
  let saveTimer = 0;
  let toastTimer = 0;
  let startedAt = 0;
  let elapsedBeforeStart = 0;
  let timerInterval = 0;
  let dictionaryIndex = null;
  let dictionaryName = "default.txt";
  let dictionarySource = "default";
  let fillController = null;
  let autoFillSession = null;

  function safeReadLibrary() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.projects)) return null;
      const valid = [];
      for (const item of data.projects) {
        try {
          const normalized = M.normalizePuzzle(item.puzzle);
          normalized.id = typeof item.id === "string" && item.id ? item.id : normalized.id;
          valid.push({ id: normalized.id, puzzle: normalized });
        } catch (_error) {
          // Ignore one damaged local item rather than losing the rest of the library.
        }
      }
      return { activeId: data.activeId, projects: valid };
    } catch (_error) {
      return null;
    }
  }

  function createDemoPuzzle() {
    const demo = M.createPuzzle(3, 3, "First steps — word square");
    demo.author = "Gridwright example";
    demo.answers = ["C", "A", "T", "A", "R", "E", "T", "E", "N"];
    demo.clues = {
      "across:0:0": "Pet that may purr",
      "across:1:0": "Exist, for you and me",
      "across:2:0": "Five plus five",
      "down:0:0": "Pet that may purr",
      "down:0:1": "Exist, for you and me",
      "down:0:2": "Five plus five",
    };
    return demo;
  }

  function initialize() {
    const saved = safeReadLibrary();
    if (saved && saved.projects.length) {
      projects = saved.projects;
      activeId = projects.some((item) => item.id === saved.activeId) ? saved.activeId : projects[0].id;
      puzzle = M.clone(projects.find((item) => item.id === activeId).puzzle);
    } else {
      const demo = createDemoPuzzle();
      const blank = M.createPuzzle(15, 15, "Untitled crossword");
      projects = [
        { id: demo.id, puzzle: M.clone(demo) },
        { id: blank.id, puzzle: M.clone(blank) },
      ];
      activeId = blank.id;
      puzzle = M.clone(blank);
    }
    selectedIndex = firstOpenCell(puzzle);
    currentEntries = M.getEntries(puzzle);
    renderAll(false);
    saveNow(false);
  }

  function firstOpenCell(value) {
    const index = value.blocks.findIndex((blocked) => !blocked);
    return index < 0 ? 0 : index;
  }

  function activeProject() {
    return projects.find((item) => item.id === activeId);
  }

  function copyCurrentIntoLibrary() {
    const item = activeProject();
    if (!item) {
      projects.unshift({ id: activeId, puzzle: M.clone(puzzle) });
      return;
    }
    item.puzzle = M.clone(puzzle);
  }

  function saveNow(showFeedback = true) {
    if (!puzzle) return;
    clearTimeout(saveTimer);
    puzzle.updatedAt = new Date().toISOString();
    copyCurrentIntoLibrary();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeId, projects }));
      setSaveStatus("saved", "Saved on this device");
      if (showFeedback) showToast("Saved locally. Use Save file for a portable copy.");
    } catch (_error) {
      setSaveStatus("error", "Local storage is full");
      if (showFeedback) showToast("Could not autosave. Export a puzzle file to keep your work.", "error");
    }
  }

  function requestSave() {
    setSaveStatus("saving", "Saving…");
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveNow(false), 240);
  }

  function setSaveStatus(state, label) {
    ui.saveStatusText.textContent = label;
    ui.saveStatusDot.classList.toggle("saving", state === "saving");
    ui.saveStatusDot.classList.toggle("error", state === "error");
  }

  function showToast(message, type) {
    clearTimeout(toastTimer);
    ui.toast.textContent = message;
    ui.toast.classList.toggle("error", type === "error");
    toastTimer = window.setTimeout(() => {
      ui.toast.textContent = "";
      ui.toast.classList.remove("error");
    }, 3600);
  }

  function snapshot() {
    history.push({ puzzle: M.clone(puzzle), mode, direction, selectedIndex });
    if (history.length > HISTORY_LIMIT) history.shift();
    redoHistory = [];
    updateHistoryButtons();
  }

  function restoreSnapshot(stack, otherStack) {
    if (!stack.length) return;
    otherStack.push({ puzzle: M.clone(puzzle), mode, direction, selectedIndex });
    const state = stack.pop();
    const previousStyle = puzzle.crosswordStyle;
    puzzle = M.clone(state.puzzle);
    mode = state.mode;
    direction = state.direction;
    selectedIndex = state.selectedIndex;
    wrongCells.clear();
    currentEntries = M.getEntries(puzzle);
    renderAll(true);
    if (previousStyle !== puzzle.crosswordStyle && dictionarySource === "default") loadDefaultDictionary();
    requestSave();
    updateHistoryButtons();
  }

  function undo() {
    restoreSnapshot(history, redoHistory);
  }

  function redo() {
    restoreSnapshot(redoHistory, history);
  }

  function updateHistoryButtons() {
    ui.undoButton.disabled = history.length === 0;
    ui.redoButton.disabled = redoHistory.length === 0;
    ui.undoButton.setAttribute("aria-disabled", String(history.length === 0));
    ui.redoButton.setAttribute("aria-disabled", String(redoHistory.length === 0));
  }

  function updateLibrarySelect() {
    const previous = ui.puzzleSelect.value;
    ui.puzzleSelect.replaceChildren();
    const sorted = [...projects].sort((a, b) => String(a.puzzle.title).localeCompare(String(b.puzzle.title)));
    for (const item of sorted) {
      const option = document.createElement("option");
      option.value = item.id;
      const styleLabel = item.puzzle.crosswordStyle === "british" ? "British Cryptic" : "American";
      option.textContent = `${item.puzzle.title || "Untitled crossword"} · ${styleLabel}`;
      ui.puzzleSelect.append(option);
    }
    ui.puzzleSelect.value = activeId || previous;
  }

  function syncLayoutGeneratorStyle(british) {
    const nextStyle = british ? "british" : "american";
    if (layoutDensityStyle !== nextStyle) {
      if (layoutDensityStyle) {
        const current = Number(ui.blockDensityInput.value);
        const oldMinimum = layoutDensityStyle === "british" ? 25 : 5;
        const oldMaximum = layoutDensityStyle === "british" ? 35 : 25;
        if (Number.isFinite(current) && current >= oldMinimum && current <= oldMaximum) {
          layoutDensityByStyle[layoutDensityStyle] = current;
        }
      }
      layoutDensityStyle = nextStyle;
      ui.blockDensityInput.value = String(layoutDensityByStyle[nextStyle]);
    }
    const minimum = british ? 25 : 5;
    const maximum = british ? 35 : 25;
    ui.blockDensityInput.min = String(minimum);
    ui.blockDensityInput.max = String(maximum);
    const current = Number(ui.blockDensityInput.value);
    if (!Number.isFinite(current) || current < minimum || current > maximum) {
      ui.blockDensityInput.value = String(layoutDensityByStyle[nextStyle]);
    }
    ui.blockDensityInput.title = british
      ? "British blocked cryptic layouts target 25–35% black squares"
      : "American blocked layouts target 5–25% black squares";
    ui.generatorModeHint.textContent = british
      ? "Build a British blocked-cryptic grid with unches"
      : "Build a rule-checked American block pattern";
    ui.generatorRuleNote.textContent = british
      ? "Odd grid · 180° symmetry · 25–35% blocks · ≥50% checked per answer · unches allowed"
      : "180° symmetry · one connected open area · all letters checked · no 1–2 letter answers";
    ui.generateLayoutButton.textContent = british ? "✦ Generate British layout" : "✦ Generate valid layout";
    ui.generateLayoutButton.title = british
      ? "Generate a British blocked cryptic layout: higher block density and unchecked letters"
      : "Generate a symmetric American-style blocked layout";
    ui.validateLayoutButton.textContent = british ? "Check British grid rules" : "Check current layout";
  }

  function updateHeader() {
    const title = puzzle.title.trim() || "Untitled crossword";
    ui.titleInput.value = puzzle.title;
    ui.authorInput.value = puzzle.author;
    ui.boardTitle.textContent = title;
    ui.boardByline.textContent = puzzle.author.trim()
      ? `By ${puzzle.author.trim()}`
      : mode === "build" ? "A blank grid is a good beginning." : "Take your time. The crossings will help.";
    ui.rowsInput.value = puzzle.rows;
    ui.colsInput.value = puzzle.cols;
    const british = puzzle.crosswordStyle === "british";
    if (british) puzzle.mirrorBlocks = true;
    ui.mirrorBlocksInput.checked = puzzle.mirrorBlocks;
    ui.mirrorBlocksInput.disabled = british;
    ui.mirrorBlocksHint.textContent = british ? "Required 180° symmetry for British grids" : "180° symmetry for new blocks";
    syncLayoutGeneratorStyle(british);
    ui.crosswordStyleSelect.value = british ? "british" : "american";
    ui.cluePanelKicker.textContent = british ? "BRITISH CRYPTIC" : "AMERICAN CLUES";
    ui.cluesHeading.textContent = british ? "Cryptic clues" : "Clues";
    ui.cluePanelHint.textContent = british
      ? "Write the final clue above; use Cryptic clue builder for its definition, wordplay device, notes, and enumeration."
      : "Choose a clue to jump to its first square. Add clue text while building.";
    ui.crypticReviewButton.classList.toggle("hidden", !british || mode !== "build");
    ui.exportNytPdfButton.classList.toggle("hidden", british);
    ui.defaultDictionaryButton.textContent = british ? "Use UK list" : "Use default.txt";
    ui.defaultDictionaryButton.title = british
      ? "Load the general word list with common British spellings tried first"
      : "Load the bundled general English word list";
    ui.modeLabel.textContent = mode === "build" ? "BUILD MODE" : "SOLVE MODE";
    ui.modeDot.classList.toggle("solve", mode === "solve");
    ui.gridDimensionsLabel.textContent = `${puzzle.rows} × ${puzzle.cols}`;
    ui.buildModeButton.classList.toggle("is-active", mode === "build");
    ui.solveModeButton.classList.toggle("is-active", mode === "solve");
    ui.buildModeButton.setAttribute("aria-selected", String(mode === "build"));
    ui.solveModeButton.setAttribute("aria-selected", String(mode === "solve"));
    ui.buildTools.classList.toggle("hidden", mode !== "build");
    ui.autoFillTools.classList.toggle("hidden", mode !== "build");
    ui.solveTools.classList.toggle("hidden", mode !== "solve");
    updateAutoFillButtons();
    updateLibrarySelect();
  }

  function findEntryAt(index, dir = direction) {
    const list = currentEntries ? currentEntries[dir] : [];
    return list.find((entry) => entry.indices.includes(index)) || null;
  }

  function getActiveEntry() {
    const list = currentEntries ? currentEntries[direction] : [];
    return list.find((entry) => entry.indices.includes(selectedIndex)) || null;
  }

  function ensureSelection() {
    if (selectedIndex < 0 || selectedIndex >= puzzle.rows * puzzle.cols || (mode === "solve" && puzzle.blocks[selectedIndex])) {
      selectedIndex = firstOpenCell(puzzle);
    }
    const across = findEntryAt(selectedIndex, "across");
    const down = findEntryAt(selectedIndex, "down");
    if (direction === "across" && !across && down) direction = "down";
    if (direction === "down" && !down && across) direction = "across";
  }

  function renderGrid(shouldFocus = false) {
    ensureSelection();
    currentEntries = M.getEntries(puzzle);
    const entry = getActiveEntry();
    const activeSet = new Set(entry ? entry.indices : []);
    const numbers = currentEntries.cellNumbers;
    const size = Math.max(22, Math.min(42, Math.floor(660 / puzzle.cols)));
    ui.grid.style.setProperty("--cell-size", `${size}px`);
    ui.grid.style.gridTemplateColumns = `repeat(${puzzle.cols}, ${size}px)`;
    ui.grid.replaceChildren();
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < puzzle.rows * puzzle.cols; index += 1) {
      const row = Math.floor(index / puzzle.cols);
      const col = index % puzzle.cols;
      const blocked = puzzle.blocks[index];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.dataset.index = String(index);
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-selected", String(index === selectedIndex));
      button.style.width = `${size}px`;
      button.style.height = `${size}px`;
      if (col === puzzle.cols - 1) button.classList.add("last-col");
      if (row === puzzle.rows - 1) button.classList.add("last-row");
      if (blocked) button.classList.add("is-block");
      if (activeSet.has(index) && !blocked) button.classList.add("is-active-word");
      if (index === selectedIndex) button.classList.add("is-selected");
      if (wrongCells.has(index) && !blocked) button.classList.add("is-wrong");

      const cellNumber = numbers[index];
      if (cellNumber) {
        const number = document.createElement("span");
        number.className = "cell-number";
        number.textContent = String(cellNumber);
        button.append(number);
      }
      const letter = document.createElement("span");
      letter.className = "cell-letter";
      letter.textContent = blocked ? "" : (mode === "build" ? puzzle.answers[index] : puzzle.guesses[index]);
      button.append(letter);
      const value = blocked ? "black square" : (mode === "build" ? puzzle.answers[index] : puzzle.guesses[index]) || "blank";
      button.setAttribute("aria-label", `Row ${row + 1}, column ${col + 1}, ${value}${cellNumber ? `, number ${cellNumber}` : ""}`);
      fragment.append(button);
    }
    ui.grid.append(fragment);
    updateGridSummary();
    updateActiveClueHighlight();
    if (shouldFocus) focusSelectedCell();
  }

  function focusSelectedCell() {
    const cell = ui.grid.querySelector(`[data-index="${selectedIndex}"]`);
    if (cell) cell.focus({ preventScroll: true });
  }

  function updateGridSummary() {
    const acrossCount = currentEntries.across.length;
    const downCount = currentEntries.down.length;
    ui.acrossCount.textContent = String(acrossCount);
    ui.downCount.textContent = String(downCount);
    ui.clueTotal.textContent = String(acrossCount + downCount);
    ui.entryCountText.textContent = `${acrossCount + downCount} entries`;

    const open = M.openIndices(puzzle);
    const letters = mode === "build" ? puzzle.answers : puzzle.guesses;
    const filled = open.filter((index) => Boolean(letters[index])).length;
    ui.fillCountText.textContent = `${filled} filled`;
    ui.progressText.textContent = `${open.length ? Math.round((filled / open.length) * 100) : 0}% filled`;

    const active = getActiveEntry();
    if (active) {
      ui.activeEntryLabel.textContent = `${active.direction === "across" ? "Across" : "Down"} ${active.number}`;
      ui.activeEntryLength.textContent = `${active.indices.length} ${active.indices.length === 1 ? "cell" : "cells"}`;
    } else {
      ui.activeEntryLabel.textContent = "No open entry";
      ui.activeEntryLength.textContent = "";
    }
  }

  function crypticMetaFor(entry) {
    return puzzle.crypticClues[entry.id] || { mechanism: "", definition: "", wordplay: "", enumeration: "" };
  }

  function createCrypticTools(entry, originalMeta, lengthBadge, printText, clueInput) {
    const details = document.createElement("details");
    details.className = "cryptic-helper";
    const summary = document.createElement("summary");
    const summaryLabel = document.createElement("span");
    summaryLabel.textContent = "Cryptic clue builder";
    const summaryDetail = document.createElement("span");
    summaryDetail.className = "cryptic-helper-summary-detail";
    summary.append(summaryLabel, summaryDetail);
    const fields = document.createElement("div");
    fields.className = "cryptic-helper-fields";
    const deviceHelp = document.createElement("p");
    deviceHelp.className = "cryptic-device-help";
    const enumerationHelp = document.createElement("p");
    enumerationHelp.className = "cryptic-enumeration-help";
    let meta = { ...originalMeta };

    const fieldLabel = (caption, control, fullWidth = false) => {
      const label = document.createElement("label");
      label.className = `cryptic-field${fullWidth ? " cryptic-field-full" : ""}`;
      const captionNode = document.createElement("span");
      captionNode.textContent = caption;
      label.append(captionNode, control);
      return label;
    };
    const select = document.createElement("select");
    select.setAttribute("aria-label", `${entry.direction} ${entry.number} cryptic wordplay device`);
    for (const [value, label] of Object.entries(CRYPTIC_MECHANISM_LABELS)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
    select.value = meta.mechanism || "";
    fields.append(fieldLabel("Main wordplay device", select, true));

    const definition = document.createElement("input");
    definition.type = "text";
    definition.maxLength = 500;
    definition.autocomplete = "off";
    definition.placeholder = "The part that defines the answer";
    definition.value = meta.definition || "";
    definition.setAttribute("aria-label", `${entry.direction} ${entry.number} definition notes`);
    fields.append(fieldLabel("Definition", definition));

    const wordplay = document.createElement("input");
    wordplay.type = "text";
    wordplay.maxLength = 500;
    wordplay.autocomplete = "off";
    wordplay.placeholder = "Letters and indicators used";
    wordplay.value = meta.wordplay || "";
    wordplay.setAttribute("aria-label", `${entry.direction} ${entry.number} wordplay notes`);
    fields.append(fieldLabel("Wordplay notes", wordplay));

    const enumeration = document.createElement("input");
    enumeration.type = "text";
    enumeration.maxLength = 32;
    enumeration.autocomplete = "off";
    enumeration.placeholder = `${entry.indices.length} or 3,4`;
    enumeration.value = meta.enumeration || "";
    enumeration.setAttribute("aria-label", `${entry.direction} ${entry.number} answer enumeration`);
    fields.append(fieldLabel("Enumeration", enumeration, true));
    fields.append(deviceHelp, enumerationHelp);
    details.append(summary, fields);

    const refresh = () => {
      const parsed = M.parseEnumeration(enumeration.value, entry.indices.length);
      const formattedEnumeration = M.getEnumeration(puzzle, entry);
      lengthBadge.textContent = `(${formattedEnumeration})`;
      summaryDetail.textContent = `${CRYPTIC_MECHANISM_LABELS[meta.mechanism] || "Choose device"} · (${formattedEnumeration})`;
      deviceHelp.textContent = CRYPTIC_MECHANISM_TIPS[meta.mechanism] || CRYPTIC_MECHANISM_TIPS[""];
      enumerationHelp.classList.toggle("is-invalid", !parsed.valid);
      if (!enumeration.value.trim()) {
        enumerationHelp.textContent = `Using ${entry.indices.length} from the grid. For multiword answers, enter parts such as 3,4.`;
      } else if (parsed.valid) {
        enumerationHelp.textContent = `Printed as (${parsed.text}); the parts add up to ${entry.indices.length} cells.`;
      } else {
        enumerationHelp.textContent = `Use positive comma-separated numbers that add up to ${entry.indices.length} cells.`;
      }
      const clue = clueInput.value.trim();
      printText.textContent = clue ? M.formatClue(puzzle, entry, clue) : `(no clue yet) (${formattedEnumeration})`;
    };
    const saveField = (field, value) => {
      meta = { ...meta, [field]: value };
      puzzle.crypticClues[entry.id] = { ...meta };
      requestSave();
      refresh();
    };
    select.addEventListener("change", () => {
      snapshot();
      saveField("mechanism", select.value);
    });
    const bindTextControl = (control, field) => {
      let editSnapshotted = false;
      control.addEventListener("input", () => {
        if (!editSnapshotted) {
          snapshot();
          editSnapshotted = true;
        }
        saveField(field, control.value);
      });
      control.addEventListener("blur", () => { editSnapshotted = false; });
    };
    bindTextControl(definition, "definition");
    bindTextControl(wordplay, "wordplay");
    bindTextControl(enumeration, "enumeration");
    refresh();
    return details;
  }

  function reviewCrypticClues() {
    if (puzzle.crosswordStyle !== "british") return;
    const entries = M.getEntries(puzzle).across.concat(M.getEntries(puzzle).down);
    const missingClue = [];
    const missingDevice = [];
    const missingDefinition = [];
    const missingWordplay = [];
    const invalidEnumeration = [];
    for (const entry of entries) {
      const meta = crypticMetaFor(entry);
      if (!String(puzzle.clues[entry.id] || "").trim()) missingClue.push(entry);
      if (!meta.mechanism) missingDevice.push(entry);
      if (!meta.definition.trim()) missingDefinition.push(entry);
      if (meta.mechanism !== "double-definition" && !meta.wordplay.trim()) missingWordplay.push(entry);
      if (meta.enumeration && !M.parseEnumeration(meta.enumeration, entry.indices.length).valid) invalidEnumeration.push(entry);
    }
    const checks = [
      ["missing clue text", missingClue],
      ["missing wordplay device", missingDevice],
      ["missing definition note", missingDefinition],
      ["missing wordplay notes", missingWordplay],
      ["invalid enumeration", invalidEnumeration],
    ].filter(([, list]) => list.length);
    if (!checks.length) {
      showToast("Cryptic checklist complete. This checks structure and enumeration, not whether a clue is fair or solvable.");
      return;
    }
    const summary = checks.map(([label, list]) => `${list.length} ${label}`).join(" · ");
    showToast(`Cryptic review: ${summary}. The checklist does not judge clue fairness or correctness.`);
  }

  function renderClues() {
    currentEntries = M.getEntries(puzzle);
    const british = puzzle.crosswordStyle === "british";
    const entries = currentEntries[direction];
    const active = getActiveEntry();
    ui.acrossTab.classList.toggle("is-active", direction === "across");
    ui.downTab.classList.toggle("is-active", direction === "down");
    ui.acrossTab.setAttribute("aria-selected", String(direction === "across"));
    ui.downTab.setAttribute("aria-selected", String(direction === "down"));
    ui.clueList.replaceChildren();

    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "empty-clues";
      const icon = document.createElement("span");
      icon.textContent = "✦";
      const title = document.createElement("strong");
      title.textContent = "No entries this way yet";
      const text = document.createElement("p");
      text.textContent = "Open a few squares or change the grid layout to create word slots.";
      empty.append(icon, title, text);
      ui.clueList.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const entry of entries) {
      const row = document.createElement("div");
      row.className = `clue-item${active && active.id === entry.id ? " is-current" : ""}`;
      row.dataset.entryId = entry.id;
      row.dataset.direction = entry.direction;
      row.dataset.start = String(entry.startIndex);

      const number = document.createElement("button");
      number.type = "button";
      number.className = "clue-number";
      number.textContent = String(entry.number);
      number.setAttribute("aria-label", `Select ${entry.direction} ${entry.number}, ${entry.indices.length} cells`);
      number.addEventListener("click", (event) => {
        event.stopPropagation();
        selectEntry(entry);
      });
      const content = document.createElement("div");
      content.className = "clue-content";
      const clueText = puzzle.clues[entry.id] || "";
      const crypticMeta = crypticMetaFor(entry);
      const formattedEnumeration = british ? M.getEnumeration(puzzle, entry) : "";
      const printText = document.createElement("span");
      printText.className = "clue-print";
      printText.textContent = clueText
        ? M.formatClue(puzzle, entry, clueText)
        : british ? `(no clue yet) (${formattedEnumeration})` : "(no clue yet)";
      let clueInput = null;

      if (mode === "build") {
        const input = document.createElement("input");
        clueInput = input;
        input.className = "clue-input";
        input.type = "text";
        input.autocomplete = "off";
        input.placeholder = british ? "Write the cryptic clue…" : "Write a clue…";
        input.value = clueText;
        input.setAttribute("aria-label", `${entry.direction} ${entry.number} clue`);
        let clueEditSnapshotted = false;
        input.addEventListener("focus", () => {
          direction = entry.direction;
          selectedIndex = entry.startIndex;
          renderGrid(false);
          updateGridSummary();
          updateDirectionTabs();
        });
        input.addEventListener("keydown", (event) => {
          // Let Space insert into the clue and keep grid shortcuts out of the input.
          if (event.key === " " || event.code === "Space" || event.key === "Spacebar") {
            event.stopPropagation();
          }
        });
        input.addEventListener("input", () => {
          if (!clueEditSnapshotted) {
            snapshot();
            clueEditSnapshotted = true;
          }
          puzzle.clues[entry.id] = input.value;
          printText.textContent = input.value.trim()
            ? M.formatClue(puzzle, entry, input.value)
            : british ? `(no clue yet) (${M.getEnumeration(puzzle, entry)})` : "(no clue yet)";
          requestSave();
        });
        input.addEventListener("blur", () => { clueEditSnapshotted = false; });
        content.append(input, printText);
      } else {
        const readOnly = document.createElement("span");
        readOnly.className = `clue-readonly${clueText ? "" : " is-empty"}`;
        readOnly.textContent = clueText
          ? M.formatClue(puzzle, entry, clueText)
          : british ? `Clue not written yet (${formattedEnumeration})` : "Clue not written yet";
        content.append(readOnly, printText);
      }

      const length = document.createElement("span");
      length.className = "clue-length";
      length.textContent = british ? `(${formattedEnumeration})` : String(entry.indices.length);
      length.title = british ? "Cryptic answer enumeration" : `${entry.indices.length} cells`;
      if (british && mode === "build") {
        content.append(createCrypticTools(entry, crypticMeta, length, printText, clueInput));
      }
      row.append(number, content, length);
      row.addEventListener("click", (event) => {
        if (event.target.closest(".clue-input, .clue-number, .cryptic-helper")) return;
        selectEntry(entry);
      });
      fragment.append(row);
    }
    ui.clueList.append(fragment);
  }

  function updateActiveClueHighlight() {
    const active = getActiveEntry();
    for (const row of ui.clueList.querySelectorAll(".clue-item")) {
      row.classList.toggle("is-current", Boolean(active && row.dataset.entryId === active.id));
    }
  }

  function updateDirectionTabs() {
    ui.acrossTab.classList.toggle("is-active", direction === "across");
    ui.downTab.classList.toggle("is-active", direction === "down");
    ui.acrossTab.setAttribute("aria-selected", String(direction === "across"));
    ui.downTab.setAttribute("aria-selected", String(direction === "down"));
  }

  function renderAll(shouldFocus = false) {
    currentEntries = M.getEntries(puzzle);
    updateHeader();
    renderGrid(shouldFocus);
    renderClues();
    updateGridSummary();
    updateHistoryButtons();
    updateSolveControls();
  }

  function updateSolveControls() {
    const hasAnswer = puzzle.answers.some(Boolean);
    for (const button of [ui.checkCellButton, ui.checkWordButton, ui.revealCellButton, ui.revealWordButton, ui.checkPuzzleButton, ui.revealPuzzleButton]) {
      button.disabled = !hasAnswer;
    }
    ui.playHint.textContent = hasAnswer
      ? "Checks compare your entries with the author's answer grid."
      : "Switch to Build to add an answer key before checking or revealing.";
    updateTimerText();
  }

  function selectEntry(entry, focusGrid = true) {
    direction = entry.direction;
    selectedIndex = entry.startIndex;
    wrongCells.clear();
    renderGrid(focusGrid);
    renderClues();
    updateGridSummary();
    updateDirectionTabs();
  }

  function selectCell(index, fromClick = false) {
    if (!Number.isInteger(index) || index < 0 || index >= puzzle.rows * puzzle.cols) return;
    if (puzzle.blocks[index]) {
      if (mode !== "build") return;
      selectedIndex = index;
      wrongCells.clear();
      renderGrid(true);
      renderClues();
      updateDirectionTabs();
      return;
    }
    if (fromClick && index === selectedIndex) {
      const other = direction === "across" ? "down" : "across";
      if (findEntryAt(index, other)) direction = other;
    } else if (!findEntryAt(index, direction)) {
      const other = direction === "across" ? "down" : "across";
      if (findEntryAt(index, other)) direction = other;
    }
    selectedIndex = index;
    wrongCells.delete(index);
    renderGrid(true);
    renderClues();
    updateDirectionTabs();
  }

  function setMode(nextMode) {
    if (nextMode !== "build" && nextMode !== "solve") return;
    if (mode === nextMode) return;
    if (nextMode === "solve" && fillController) cancelAutoFill(true);
    mode = nextMode;
    wrongCells.clear();
    if (mode === "solve" && !startedAt) updateTimerText();
    renderAll(mode === "solve");
    requestSave();
  }

  function setDirection(nextDirection) {
    if (nextDirection !== "across" && nextDirection !== "down") return;
    if (currentEntries[nextDirection].length === 0) {
      showToast(`There are no ${nextDirection} entries yet.`, "error");
      return;
    }
    direction = nextDirection;
    const existing = getActiveEntry();
    if (!existing) {
      const list = currentEntries[nextDirection];
      const containing = list.find((entry) => entry.indices.includes(selectedIndex));
      selectedIndex = (containing || list[0]).startIndex;
    }
    renderGrid(true);
    renderClues();
    updateDirectionTabs();
  }

  function moveCell(deltaRow, deltaCol, nextDirection) {
    direction = nextDirection;
    const row = Math.floor(selectedIndex / puzzle.cols) + deltaRow;
    const col = (selectedIndex % puzzle.cols) + deltaCol;
    if (row < 0 || col < 0 || row >= puzzle.rows || col >= puzzle.cols) return;
    const target = row * puzzle.cols + col;
    if (puzzle.blocks[target]) return;
    selectedIndex = target;
    wrongCells.delete(target);
    renderGrid(true);
    renderClues();
    updateDirectionTabs();
  }

  function advanceWithinEntry(entry, index, step) {
    if (!entry) return index;
    const position = entry.indices.indexOf(index);
    if (position < 0) return index;
    return entry.indices[position + step] === undefined ? index : entry.indices[position + step];
  }

  function typeLetter(value) {
    try {
      const letter = M.normalizeLetter(value);
      if (!letter || puzzle.blocks[selectedIndex]) return;
      if (mode === "build") clearAutoFillSession();
      snapshot();
      puzzle = M.setLetter(puzzle, selectedIndex, letter, mode === "build" ? "answer" : "guess");
      wrongCells.delete(selectedIndex);
      if (mode === "solve" && !startedAt) startTimer();
      const entry = getActiveEntry();
      selectedIndex = advanceWithinEntry(entry, selectedIndex, 1);
      renderGrid(true);
      renderClues();
      updateSolveControls();
      requestSave();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  function clearCurrentCell(moveBack) {
    if (puzzle.blocks[selectedIndex]) return;
    const field = mode === "build" ? "answers" : "guesses";
    if (field === "answers") clearAutoFillSession();
    let target = selectedIndex;
    if (moveBack && !puzzle[field][target]) target = advanceWithinEntry(getActiveEntry(), target, -1);
    snapshot();
    puzzle = M.setLetter(puzzle, target, "", field === "answers" ? "answer" : "guess");
    selectedIndex = target;
    wrongCells.delete(target);
    renderGrid(true);
    updateSolveControls();
    requestSave();
  }

  function toggleBlockAtSelection() {
    if (mode !== "build") return;
    clearAutoFillSession();
    snapshot();
    puzzle = M.toggleBlock(puzzle, selectedIndex);
    currentEntries = M.getEntries(puzzle);
    const mirror = puzzle.mirrorBlocks ? puzzle.rows * puzzle.cols - 1 - selectedIndex : selectedIndex;
    if (puzzle.blocks[selectedIndex]) {
      const first = M.openIndices(puzzle)[0];
      selectedIndex = first === undefined ? 0 : first;
    } else {
      selectedIndex = selectedIndex === mirror ? selectedIndex : selectedIndex;
    }
    wrongCells.clear();
    renderAll(true);
    requestSave();
  }

  function generateLayoutFromUI() {
    if (mode !== "build") return;
    const british = puzzle.crosswordStyle === "british";
    const targetPercent = Number(ui.blockDensityInput.value);
    const anchorIndex = ui.anchorSeedInput.checked ? selectedIndex : undefined;
    const seedNote = anchorIndex === undefined ? "with a random starting point" : "using the selected square as its starting point when rule-safe";
    const styleNote = british
      ? `British blocked-cryptic rules: odd dimensions, 180° symmetry, ${targetPercent}% black squares, no two-cell runs, and at least half of each answer cross-checked.`
      : `American blocked-grid rules: 180° symmetry, ${targetPercent}% black squares, connected open cells, and no 1–2 letter answers.`;
    const prompt = `Generate a new ${british ? "British Cryptic" : "American"} ${puzzle.rows} × ${puzzle.cols} crossword layout ${seedNote}? ${styleNote} This replaces the current block pattern, answers, guesses, and clues.`;
    if (!window.confirm(prompt)) return;
    clearAutoFillSession();
    try {
      const result = M.generateLayout(puzzle, { targetPercent, anchorIndex, symmetry: true });
      snapshot();
      puzzle = result.puzzle;
      mode = "build";
      direction = "across";
      selectedIndex = result.seedIndex === null ? firstOpenCell(puzzle) : result.seedIndex;
      wrongCells.clear();
      currentEntries = M.getEntries(puzzle);
      renderAll(true);
      requestSave();
      const targetMessage = result.targetReached ? "target reached" : "closest valid pattern found";
      const seedMessage = result.seedAdjusted ? ` Seed shifted to row ${Math.floor(result.seedIndex / puzzle.cols) + 1}, column ${(result.seedIndex % puzzle.cols) + 1} to satisfy the rules.` : "";
      const styleMessage = british
        ? `British Cryptic grid: ${result.blackPercent}% blocks, ${result.entryCount} answers, ${result.uncheckedCells} unches · at least half of every answer is checked.`
        : `American grid: ${result.blackPercent}% blocks, ${result.entryCount} answers · all open squares are checked.`;
      showToast(`Generated ${puzzle.rows} × ${puzzle.cols}. ${styleMessage} (${targetMessage}).${seedMessage}`);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  function validateCurrentLayout() {
    try {
      const result = M.validateLayout(puzzle, { minimumLength: 3, requireSymmetry: true });
      if (result.valid) {
        const message = puzzle.crosswordStyle === "british"
          ? `British rules pass: ${result.uncheckedCells} unchecked letters; ≥50% checked per answer; no two-cell entries · ${result.blackPercent}% blocks.`
          : `American rules pass: 180° symmetric, connected, no short entries, all letters checked · ${result.blackPercent}% blocks.`;
        showToast(message);
      } else {
        showToast(`Layout needs changes: ${result.issues.join(" ")}`, "error");
      }
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  function updateAutoFillButtons() {
    const running = Boolean(fillController);
    const hasDictionary = Boolean(dictionaryIndex);
    const canRetry = Boolean(autoFillSession) && mode === "build" && hasDictionary;
    ui.startAutoFillButton.disabled = !hasDictionary || running || Boolean(autoFillSession);
    ui.tryAnotherFillButton.classList.toggle("hidden", !canRetry);
    ui.tryAnotherFillButton.disabled = !canRetry || running;
    ui.cancelAutoFillButton.disabled = !running;
  }

  function clearAutoFillSession() {
    autoFillSession = null;
    updateAutoFillButtons();
  }

  function setDictionaryFromText(text, name, source = "custom") {
    if (fillController) cancelAutoFill(true);
    const words = AutoFill.parseWordList(text);
    if (!words.length) throw new Error("No usable A–Z words of three or more letters were found in that text file.");
    dictionaryIndex = AutoFill.buildIndex(words);
    dictionaryName = name || "word list";
    dictionarySource = source;
    if (autoFillSession) autoFillSession.dictionaryIndex = dictionaryIndex;
    updateAutoFillButtons();
    ui.dictionaryStatus.textContent = `${dictionaryName} · ${dictionaryIndex.wordCount.toLocaleString()} words`;
    ui.autoFillStatus.textContent = autoFillSession
      ? "Word list updated. Try another fill to explore this list while excluding earlier grids."
      : "Ready. Existing letters are fixed; crossing conflicts trigger backtracking.";
  }

  function loadDefaultDictionary() {
    try {
      if (typeof window.GRIDWRIGHT_DEFAULT_TEXT !== "string" || !window.GRIDWRIGHT_DEFAULT_TEXT.length) {
        throw new Error("The bundled default.txt content is missing. Open the project folder or load a .txt word list.");
      }
      const british = puzzle.crosswordStyle === "british";
      const priorityText = british && BritishWordPriority ? `${BritishWordPriority}\n` : "";
      const name = british && BritishWordPriority ? "British priority + default.txt" : "default.txt";
      setDictionaryFromText(`${priorityText}${window.GRIDWRIGHT_DEFAULT_TEXT}`, name, "default");
    } catch (error) {
      dictionaryIndex = null;
      clearAutoFillSession();
      ui.dictionaryStatus.textContent = "No dictionary loaded";
      ui.autoFillStatus.textContent = error.message || "Load a plain-text word list to enable autofill.";
    }
  }

  async function loadCustomDictionary(file) {
    if (!file) return;
    try {
      const text = await file.text();
      setDictionaryFromText(text, file.name || "custom.txt", "custom");
      showToast(`Loaded ${dictionaryIndex.wordCount.toLocaleString()} words from ${file.name || "your text file"}.`);
    } catch (error) {
      showToast(error.message || "That word list could not be loaded.", "error");
      ui.autoFillStatus.textContent = error.message || "That word list could not be loaded.";
    } finally {
      ui.dictionaryFileInput.value = "";
    }
  }

  function cancelAutoFill(quiet = false) {
    if (!fillController) return;
    fillController.abort();
    ui.cancelAutoFillButton.disabled = true;
    if (!quiet) ui.autoFillStatus.textContent = "Stopping search… the best fill found so far will be kept if the grid has not changed.";
  }

  function updateAutoFillProgress(progress) {
    const percent = progress.maxNodes ? Math.min(100, Math.round(progress.nodes * 100 / progress.maxNodes)) : 0;
    ui.autoFillProgressBar.style.width = `${percent}%`;
    ui.autoFillProgress.setAttribute("aria-valuenow", String(percent));
    const elapsed = (progress.elapsedMilliseconds / 1000).toFixed(1);
    ui.autoFillStatus.textContent = `${progress.nodes.toLocaleString()} search steps · best ${progress.bestAssigned}/${progress.total} entries · ${elapsed}s`;
  }

  async function startAutoFill(tryAnother = false) {
    if (fillController) return;
    const session = tryAnother ? autoFillSession : null;
    if (tryAnother && !session) {
      showToast("There is no previous autofill result to vary.", "error");
      return;
    }
    if (!tryAnother && autoFillSession) {
      showToast("Use “Try another fill” to keep the original letters and explore a different combination.", "error");
      return;
    }
    if (!dictionaryIndex) {
      showToast("Load a word list before starting autofill.", "error");
      return;
    }
    if (mode !== "build") {
      showToast("Switch to Build mode to add answers to the puzzle.", "error");
      return;
    }
    if (session && (session.projectId !== activeId || session.rows !== puzzle.rows || session.cols !== puzzle.cols ||
      session.dictionaryIndex !== dictionaryIndex || !session.blocks.every((value, index) => puzzle.blocks[index] === value))) {
      clearAutoFillSession();
      showToast("The puzzle or word list changed. Start a fresh autofill.", "error");
      return;
    }
    const entryGroups = M.getEntries(puzzle);
    const entries = entryGroups.across.concat(entryGroups.down);
    if (!entries.length) {
      ui.autoFillStatus.textContent = "There are no Across or Down entries in this layout.";
      showToast("This layout has no word entries to fill.", "error");
      return;
    }

    const readLimit = (input, minimum, maximum, fallback) => {
      const value = Math.trunc(Number(input.value));
      const safe = Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
      input.value = String(safe);
      return safe;
    };
    const maxNodes = readLimit(ui.fillNodeLimitInput, 100, 1_000_000, 50_000);
    const maxMilliseconds = readLimit(ui.fillTimeLimitInput, 1, 120, 20) * 1000;
    const maxCandidates = readLimit(ui.fillCandidateLimitInput, 1, 10_000, 500);
    const controller = new AbortController();
    const sourceProjectId = activeId;
    const sourceMode = mode;
    const sourceRows = puzzle.rows;
    const sourceCols = puzzle.cols;
    const sourceBlocks = puzzle.blocks.slice();
    const displayedAnswers = puzzle.answers.slice();
    const sourceAnswers = session ? session.baselineAnswers.slice() : displayedAnswers.slice();
    const sourceDictionary = dictionaryIndex;
    const excludedSolutions = session ? session.triedSignatures.slice() : [];
    const variant = session ? session.attempts + 1 : 0;
    fillController = controller;
    updateAutoFillButtons();
    ui.autoFillProgressBar.style.width = "0%";
    ui.autoFillProgress.setAttribute("aria-valuenow", "0");
    ui.autoFillStatus.textContent = session
      ? `Trying a different combination; ${excludedSolutions.length} earlier fill(s) excluded…`
      : `Searching ${entries.length} entries with ${sourceDictionary.wordCount.toLocaleString()} words…`;

    try {
      const result = await AutoFill.solveGrid({
        rows: sourceRows,
        cols: sourceCols,
        blocks: sourceBlocks,
        answers: sourceAnswers,
        entries,
        index: sourceDictionary,
        allowRepeats: !ui.avoidRepeatsInput.checked,
        maxNodes,
        maxMilliseconds,
        maxCandidates,
        variant,
        excludedSolutions,
        signal: controller.signal,
        onProgress: (progress) => {
          if (fillController === controller && dictionaryIndex === sourceDictionary) updateAutoFillProgress(progress);
        },
      });
      const sameGrid = activeId === sourceProjectId && mode === sourceMode && dictionaryIndex === sourceDictionary &&
        puzzle.rows === sourceRows && puzzle.cols === sourceCols && puzzle.blocks.length === sourceBlocks.length && puzzle.answers.length === displayedAnswers.length &&
        sourceBlocks.every((value, index) => puzzle.blocks[index] === value) &&
        displayedAnswers.every((value, index) => puzzle.answers[index] === value);
      if (!sameGrid || (session && autoFillSession !== session)) {
        ui.autoFillStatus.textContent = "The grid changed during search, so this result was not applied.";
        showToast("Autofill result discarded because the grid changed during search.", "error");
        return;
      }

      const signature = result.signature || AutoFill.gridSignature(result.grid, sourceBlocks);
      const changed = result.grid.some((letter, index) => letter !== puzzle.answers[index]);
      let applyResult = changed;
      let retryFailure = "";
      if (session) {
        session.attempts = variant;
        const baselineSignature = AutoFill.gridSignature(session.baselineAnswers, sourceBlocks);
        const alreadyTried = session.triedSignatures.includes(signature);
        const distinct = signature !== baselineSignature && !alreadyTried;
        if (distinct) {
          session.triedSignatures.push(signature);
          if (session.triedSignatures.length > 100) session.triedSignatures.shift();
        }
        const previous = session.lastMetrics;
        const sameOrBetter = result.complete || result.assignedCount > previous.assignedCount ||
          (result.assignedCount === previous.assignedCount && result.filledCells >= previous.filledCells);
        applyResult = changed && distinct && sameOrBetter;
        if (!applyResult) retryFailure = distinct
          ? "No different fill with equal or better coverage was found within this search; the current fill was kept."
          : "No new combination was found within this search; the current fill was kept.";
      }

      if (applyResult) {
        snapshot();
        puzzle.answers = result.grid.slice();
        wrongCells.clear();
        if (session) {
          session.lastMetrics = { complete: result.complete, assignedCount: result.assignedCount, filledCells: result.filledCells };
        } else {
          autoFillSession = {
            projectId: sourceProjectId,
            rows: sourceRows,
            cols: sourceCols,
            blocks: sourceBlocks.slice(),
            baselineAnswers: sourceAnswers.slice(),
            dictionaryIndex: sourceDictionary,
            triedSignatures: [signature],
            attempts: 0,
            lastMetrics: { complete: result.complete, assignedCount: result.assignedCount, filledCells: result.filledCells },
          };
        }
        renderAll(true);
        requestSave();
      } else if (session && signature !== AutoFill.gridSignature(session.baselineAnswers, sourceBlocks) && !session.triedSignatures.includes(signature)) {
        session.triedSignatures.push(signature);
        if (session.triedSignatures.length > 100) session.triedSignatures.shift();
      }

      if (retryFailure) {
        ui.autoFillStatus.textContent = `${retryFailure} Try increasing the search budget, time, or choices per slot.`;
        showToast(retryFailure, "error");
      } else if (result.complete) {
        ui.autoFillProgressBar.style.width = "100%";
        ui.autoFillProgress.setAttribute("aria-valuenow", "100");
        ui.autoFillStatus.textContent = result.totalEntries
          ? `${session ? "Alternative complete fill" : "Complete"} · ${result.assignedCount}/${result.totalEntries} entries · ${result.nodes.toLocaleString()} search steps · ${(result.elapsedMilliseconds / 1000).toFixed(1)}s.`
          : "Nothing to fill: this layout has no entries.";
        showToast(session
          ? `Found a different complete fill: ${result.assignedCount} entries.`
          : `Autofill completed ${result.assignedCount} entries in ${(result.elapsedMilliseconds / 1000).toFixed(1)} seconds.`);
      } else {
        const reason = result.cancelled ? "Stopped by request" : result.limitReached ? `Search ${result.limitReason} reached` : "Search exhausted without a full fill";
        const capNote = result.candidateTruncated ? " Some slot choices were capped; raise Choices per slot to explore more." : "";
        const label = session ? "Alternative fill" : "Best fill";
        ui.autoFillStatus.textContent = `${label} · ${reason} · ${result.assignedCount}/${result.totalEntries} entries · ${result.filledCells} open cells filled · ${result.nodes.toLocaleString()} steps · ${(result.elapsedMilliseconds / 1000).toFixed(1)}s.${capNote}`;
        if (applyResult) showToast(`${label} saved: ${result.assignedCount}/${result.totalEntries} entries.`, "error");
        else showToast(`${reason}. Try a larger list or search budget.`, "error");
      }
    } catch (error) {
      ui.autoFillStatus.textContent = error.message || "Autofill could not complete.";
      showToast(error.message || "Autofill could not complete.", "error");
    } finally {
      fillController = null;
      updateAutoFillButtons();
    }
  }

  function applyDimensions() {
    const rows = Number(ui.rowsInput.value);
    const cols = Number(ui.colsInput.value);
    try {
      if (rows === puzzle.rows && cols === puzzle.cols) return;
      if (!window.confirm(`Resize this grid to ${rows} × ${cols}? Cells outside the new edge will be removed.`)) return;
      clearAutoFillSession();
      snapshot();
      puzzle = M.resizePuzzle(puzzle, rows, cols);
      selectedIndex = firstOpenCell(puzzle);
      wrongCells.clear();
      currentEntries = M.getEntries(puzzle);
      renderAll(true);
      requestSave();
      showToast(`Grid resized to ${rows} × ${cols}.`);
    } catch (error) {
      ui.rowsInput.value = puzzle.rows;
      ui.colsInput.value = puzzle.cols;
      showToast(error.message, "error");
    }
  }

  function clearPuzzle() {
    if (!window.confirm("Clear all black squares, answers, guesses, and clues in this puzzle?")) return;
    clearAutoFillSession();
    snapshot();
    puzzle.blocks = Array(puzzle.rows * puzzle.cols).fill(false);
    puzzle.answers = Array(puzzle.rows * puzzle.cols).fill("");
    puzzle.guesses = Array(puzzle.rows * puzzle.cols).fill("");
    puzzle.clues = {};
    puzzle.crypticClues = {};
    selectedIndex = 0;
    direction = "across";
    wrongCells.clear();
    currentEntries = M.getEntries(puzzle);
    renderAll(true);
    requestSave();
    showToast("Puzzle cleared.");
  }

  function setCrosswordStyle(nextStyle) {
    if (nextStyle !== "american" && nextStyle !== "british") return;
    if (puzzle.crosswordStyle === nextStyle) return;
    snapshot();
    clearAutoFillSession();
    puzzle.crosswordStyle = nextStyle;
    if (nextStyle === "british") puzzle.mirrorBlocks = true;
    renderAll(false);
    if (dictionarySource === "default") {
      loadDefaultDictionary();
    } else {
      ui.dictionaryStatus.textContent = `${dictionaryName} · custom list retained`;
      ui.autoFillStatus.textContent = nextStyle === "british"
        ? "Custom word list retained. Load a British list if you want UK-only vocabulary."
        : "Custom word list retained for American-style autofill.";
    }
    requestSave();
    showToast(nextStyle === "british"
      ? "British Cryptic selected. Your grid and clues are preserved; UK clue tools are ready."
      : "American crossword selected. Your grid and clues are preserved.");
  }

  function newPuzzle() {
    const title = window.prompt("Name your new crossword:", "Untitled crossword");
    if (title === null) return;
    clearAutoFillSession();
    saveNow(false);
    const next = M.createPuzzle(15, 15, title.trim() || "Untitled crossword");
    next.crosswordStyle = ui.crosswordStyleSelect.value === "british" ? "british" : "american";
    puzzle = next;
    activeId = next.id;
    projects.push({ id: activeId, puzzle: M.clone(next) });
    history = [];
    redoHistory = [];
    direction = "across";
    mode = "build";
    selectedIndex = 0;
    wrongCells.clear();
    resetTimer();
    currentEntries = M.getEntries(puzzle);
    renderAll(true);
    saveNow(false);
    showToast("New crossword created.");
  }

  function deletePuzzle() {
    if (!window.confirm(`Delete “${puzzle.title || "Untitled crossword"}” from this device? This cannot be undone.`)) return;
    clearAutoFillSession();
    projects = projects.filter((item) => item.id !== activeId);
    if (!projects.length) {
      puzzle = M.createPuzzle(15, 15, "Untitled crossword");
      puzzle.crosswordStyle = ui.crosswordStyleSelect.value === "british" ? "british" : "american";
      activeId = puzzle.id;
      projects = [{ id: activeId, puzzle: M.clone(puzzle) }];
    } else {
      activeId = projects[0].id;
      puzzle = M.clone(projects[0].puzzle);
    }
    history = [];
    redoHistory = [];
    wrongCells.clear();
    direction = "across";
    selectedIndex = firstOpenCell(puzzle);
    resetTimer();
    currentEntries = M.getEntries(puzzle);
    renderAll(true);
    if (dictionarySource === "default") loadDefaultDictionary();
    saveNow(false);
    showToast("Puzzle deleted from this device.");
  }

  function switchPuzzle(id) {
    if (!projects.some((item) => item.id === id) || id === activeId) return;
    clearAutoFillSession();
    saveNow(false);
    activeId = id;
    puzzle = M.clone(projects.find((item) => item.id === id).puzzle);
    history = [];
    redoHistory = [];
    wrongCells.clear();
    direction = "across";
    selectedIndex = firstOpenCell(puzzle);
    resetTimer();
    currentEntries = M.getEntries(puzzle);
    renderAll(false);
    if (dictionarySource === "default") loadDefaultDictionary();
    saveNow(false);
  }

  function filenameStemFor(title) {
    return (title || "crossword").normalize("NFKC").replace(/[^\p{L}\p{N}_ -]/gu, "").trim().replace(/[\s-]+/g, "-").slice(0, 80) || "crossword";
  }

  function filenameFor(title) {
    return `${filenameStemFor(title)}.gwx.json`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportPuzzle() {
    saveNow(false);
    const content = JSON.stringify(puzzle, null, 2);
    downloadBlob(new Blob([content], { type: "application/json;charset=utf-8" }), filenameFor(puzzle.title));
    showToast("Puzzle exported as a portable .gwx.json file.");
  }

  function exportIpuz() {
    try {
      saveNow(false);
      const content = JSON.stringify(ExportFormats.createIpuz(puzzle), null, 2);
      downloadBlob(new Blob([content], { type: "application/json;charset=utf-8" }), `${filenameStemFor(puzzle.title)}.ipuz`);
      showToast("Puzzle exported as .ipuz JSON.");
    } catch (error) {
      showToast(error.message || "The puzzle could not be exported as .ipuz.", "error");
    }
  }

  function exportPuz() {
    try {
      saveNow(false);
      const result = ExportFormats.createPuz(puzzle);
      downloadBlob(new Blob([result.bytes], { type: "application/octet-stream" }), `${filenameStemFor(puzzle.title)}.puz`);
      showToast(result.warnings.length
        ? `Exported .puz. ${result.warnings.join(" ")}`
        : "Puzzle exported as Across Lite .puz.");
    } catch (error) {
      showToast(error.message || "The puzzle could not be exported as .puz.", "error");
    }
  }

  function exportPrintablePdf() {
    try {
      saveNow(false);
      const result = PdfExport.createPrintablePuzzlePdf(puzzle);
      downloadBlob(new Blob([result.bytes], { type: "application/pdf" }), `${filenameStemFor(puzzle.title)}.pdf`);
      showToast(`Printable puzzle PDF created · ${result.pageCount} page${result.pageCount === 1 ? "" : "s"}.`);
    } catch (error) {
      showToast(error.message || "The printable puzzle PDF could not be created.", "error");
    }
  }

  function exportSolutionPdf() {
    try {
      saveNow(false);
      const result = PdfExport.createSolutionGridPdf(puzzle);
      downloadBlob(new Blob([result.bytes], { type: "application/pdf" }), `${filenameStemFor(puzzle.title)}-solution.pdf`);
      const warningText = result.warnings.length ? ` ${result.warnings.join(" ")}` : "";
      showToast(`Solution grid PDF created · ${result.pageCount} page${result.pageCount === 1 ? "" : "s"}.${warningText}`);
    } catch (error) {
      showToast(error.message || "The solution grid PDF could not be created.", "error");
    }
  }

  function openNytSubmissionDialog() {
    ui.nytNameInput.value = puzzle.author.trim();
    ui.nytEmailInput.value = "";
    ui.nytAddressInput.value = "";
    if (typeof ui.nytSubmissionDialog.showModal === "function") {
      ui.nytSubmissionDialog.showModal();
      ui.nytNameInput.focus();
    } else {
      showToast("This browser does not support the NYT details dialog. Use a current browser or the Windows app.", "error");
    }
  }

  function createNytSubmissionPdf(event) {
    event.preventDefault();
    if (!ui.nytSubmissionForm.checkValidity()) {
      ui.nytSubmissionForm.reportValidity();
      return;
    }
    const contact = {
      name: ui.nytNameInput.value.trim(),
      email: ui.nytEmailInput.value.trim(),
      address: ui.nytAddressInput.value.trim(),
    };
    try {
      saveNow(false);
      const result = PdfExport.createNytSubmissionPdf(puzzle, contact);
      const lastName = contact.name.split(/\s+/).filter(Boolean).at(-1) || "Constructor";
      const filename = `${filenameStemFor(lastName)}_${filenameStemFor(puzzle.title)}_NYT.pdf`;
      downloadBlob(new Blob([result.bytes], { type: "application/pdf" }), filename);
      ui.nytSubmissionDialog.close();
      const warningText = result.warnings.length ? ` ${result.warnings.join(" ")}` : "";
      showToast(`NYT-formatted submission PDF created · ${result.pageCount} pages. Contact details were added only to this PDF.${warningText}`);
    } catch (error) {
      showToast(error.message || "The NYT submission PDF could not be created.", "error");
    }
  }

  async function importPuzzle(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const imported = M.normalizePuzzle(parsed);
      clearAutoFillSession();
      imported.id = M.makeId();
      imported.title = imported.title || file.name.replace(/\.gwx\.json$|\.json$/i, "") || "Imported crossword";
      puzzle = imported;
      activeId = imported.id;
      projects.push({ id: activeId, puzzle: M.clone(imported) });
      history = [];
      redoHistory = [];
      wrongCells.clear();
      direction = "across";
      mode = "build";
      selectedIndex = firstOpenCell(puzzle);
      resetTimer();
      currentEntries = M.getEntries(puzzle);
      renderAll(true);
      if (dictionarySource === "default") loadDefaultDictionary();
      saveNow(false);
      showToast("Puzzle opened and added to your local library.");
    } catch (error) {
      showToast(error.message || "This puzzle file could not be opened.", "error");
    } finally {
      ui.fileInput.value = "";
    }
  }

  function allAnswersExist() {
    return puzzle.answers.some(Boolean);
  }

  function checkCells(indices, label) {
    if (!allAnswersExist()) {
      showToast("Add answer letters in Build mode before checking.", "error");
      return;
    }
    const result = M.checkIndices(puzzle, indices);
    wrongCells = new Set(result.wrong);
    renderGrid(false);
    updateGridSummary();
    if (!result.comparable) showToast("There are no answer letters in this selection yet.", "error");
    else if (result.correct) showToast(`${label}: all filled letters are correct.`);
    else if (result.wrong.length) showToast(`${label}: ${result.wrong.length} incorrect ${result.wrong.length === 1 ? "letter" : "letters"} highlighted.`, "error");
    else showToast(`${label}: no errors so far; ${result.empty.length} answer ${result.empty.length === 1 ? "cell is" : "cells are"} still blank.`);
  }

  function checkCurrentCell() {
    checkCells([selectedIndex], "Cell check");
  }

  function checkCurrentWord() {
    const entry = getActiveEntry();
    if (!entry) return showToast("Select an entry first.", "error");
    checkCells(entry.indices, `${entry.direction === "across" ? "Across" : "Down"} ${entry.number}`);
  }

  function checkWholePuzzle() {
    checkCells(M.openIndices(puzzle), "Puzzle check");
  }

  function reveal(indices, label, confirmText) {
    if (!allAnswersExist()) {
      showToast("Add answer letters in Build mode before revealing.", "error");
      return;
    }
    if (confirmText && !window.confirm(confirmText)) return;
    snapshot();
    puzzle = M.revealIndices(puzzle, indices);
    wrongCells.clear();
    renderGrid(true);
    renderClues();
    updateSolveControls();
    requestSave();
    showToast(`${label} revealed.`);
  }

  function revealCurrentCell() {
    reveal([selectedIndex], "Cell", null);
  }

  function revealCurrentWord() {
    const entry = getActiveEntry();
    if (!entry) return showToast("Select an entry first.", "error");
    reveal(entry.indices, `${entry.direction === "across" ? "Across" : "Down"} ${entry.number}`, "Reveal this entire answer?");
  }

  function revealWholePuzzle() {
    reveal(M.openIndices(puzzle), "Whole puzzle", "Reveal the complete answer grid? Your current entries will be replaced.");
  }

  function clearGuesses() {
    if (!window.confirm("Clear all of your solve-mode letters? The answer key will stay unchanged.")) return;
    snapshot();
    puzzle.guesses = Array(puzzle.rows * puzzle.cols).fill("");
    wrongCells.clear();
    resetTimer();
    renderGrid(true);
    updateSolveControls();
    requestSave();
    showToast("Solve entries cleared.");
  }

  function resetTimer() {
    clearInterval(timerInterval);
    timerInterval = 0;
    startedAt = 0;
    elapsedBeforeStart = 0;
    updateTimerText();
  }

  function startTimer() {
    if (startedAt) return;
    startedAt = Date.now();
    timerInterval = window.setInterval(updateTimerText, 1000);
  }

  function updateTimerText() {
    const elapsed = elapsedBeforeStart + (startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const secs = String(elapsed % 60).padStart(2, "0");
    ui.timerText.textContent = `${mins}:${secs}`;
  }

  function setTitle(value) {
    puzzle.title = value;
    ui.boardTitle.textContent = value.trim() || "Untitled crossword";
    updateLibrarySelect();
    requestSave();
  }

  function setAuthor(value) {
    puzzle.author = value;
    ui.boardByline.textContent = value.trim()
      ? `By ${value.trim()}`
      : mode === "build" ? "A blank grid is a good beginning." : "Take your time. The crossings will help.";
    requestSave();
  }

  function isNativeControlTarget(target) {
    return Boolean(target && typeof target.closest === "function"
      && target.closest("input, textarea, select, button:not(.cell), a[href], summary, [role='button'], [contenteditable='true']"));
  }

  function handleKeyboard(event) {
    const command = event.ctrlKey || event.metaKey;
    const key = event.key;
    if (command) {
      const lower = key.toLowerCase();
      if (lower === "s") { event.preventDefault(); exportPuzzle(); return; }
      if (lower === "o") { event.preventDefault(); ui.fileInput.click(); return; }
      if (lower === "z" && event.shiftKey) { event.preventDefault(); redo(); return; }
      if (lower === "z") { event.preventDefault(); undo(); return; }
      if (lower === "y") { event.preventDefault(); redo(); return; }
    }
    if (isNativeControlTarget(event.target)) return;

    if (key === "ArrowRight") { event.preventDefault(); moveCell(0, 1, "across"); return; }
    if (key === "ArrowLeft") { event.preventDefault(); moveCell(0, -1, "across"); return; }
    if (key === "ArrowDown") { event.preventDefault(); moveCell(1, 0, "down"); return; }
    if (key === "ArrowUp") { event.preventDefault(); moveCell(-1, 0, "down"); return; }
    if (key === "Tab" || key === "Enter") {
      event.preventDefault();
      setDirection(direction === "across" ? "down" : "across");
      return;
    }
    if (key === " " && mode === "build") { event.preventDefault(); toggleBlockAtSelection(); return; }
    if (key === "Backspace") { event.preventDefault(); clearCurrentCell(true); return; }
    if (key === "Delete") { event.preventDefault(); clearCurrentCell(false); return; }
    if (key.length === 1 && /[\p{L}\p{N}]/u.test(key)) { event.preventDefault(); typeLetter(key); }
  }

  function onGridClick(event) {
    const cell = event.target.closest(".cell[data-index]");
    if (!cell) return;
    selectCell(Number(cell.dataset.index), true);
  }

  function bindEvents() {
    ui.buildModeButton.addEventListener("click", () => setMode("build"));
    ui.solveModeButton.addEventListener("click", () => setMode("solve"));
    ui.newPuzzleButton.addEventListener("click", newPuzzle);
    ui.puzzleSelect.addEventListener("change", () => switchPuzzle(ui.puzzleSelect.value));
    ui.crosswordStyleSelect.addEventListener("change", () => setCrosswordStyle(ui.crosswordStyleSelect.value));
    ui.crypticReviewButton.addEventListener("click", reviewCrypticClues);
    ui.openFileButton.addEventListener("click", () => ui.fileInput.click());
    ui.fileInput.addEventListener("change", () => importPuzzle(ui.fileInput.files && ui.fileInput.files[0]));
    ui.saveFileButton.addEventListener("click", exportPuzzle);
    ui.exportPuzButton.addEventListener("click", exportPuz);
    ui.exportIpuzButton.addEventListener("click", exportIpuz);
    ui.exportPuzzlePdfButton.addEventListener("click", exportPrintablePdf);
    ui.exportSolutionPdfButton.addEventListener("click", exportSolutionPdf);
    ui.exportNytPdfButton.addEventListener("click", openNytSubmissionDialog);
    ui.nytSubmissionForm.addEventListener("submit", createNytSubmissionPdf);
    ui.closeNytDialogButton.addEventListener("click", () => ui.nytSubmissionDialog.close());
    ui.cancelNytDialogButton.addEventListener("click", () => ui.nytSubmissionDialog.close());
    ui.printButton.addEventListener("click", () => window.print());
    ui.titleInput.addEventListener("input", () => setTitle(ui.titleInput.value));
    ui.authorInput.addEventListener("input", () => setAuthor(ui.authorInput.value));
    ui.resizeButton.addEventListener("click", applyDimensions);
    ui.rowsInput.addEventListener("keydown", (event) => { if (event.key === "Enter") applyDimensions(); });
    ui.colsInput.addEventListener("keydown", (event) => { if (event.key === "Enter") applyDimensions(); });
    ui.mirrorBlocksInput.addEventListener("change", () => {
      snapshot();
      puzzle.mirrorBlocks = ui.mirrorBlocksInput.checked;
      requestSave();
      showToast(puzzle.mirrorBlocks ? "Future block toggles will mirror across the grid." : "Block mirroring is off.");
    });
    ui.blockButton.addEventListener("click", toggleBlockAtSelection);
    ui.generateLayoutButton.addEventListener("click", generateLayoutFromUI);
    ui.validateLayoutButton.addEventListener("click", validateCurrentLayout);
    ui.defaultDictionaryButton.addEventListener("click", loadDefaultDictionary);
    ui.customDictionaryButton.addEventListener("click", () => ui.dictionaryFileInput.click());
    ui.dictionaryFileInput.addEventListener("change", () => loadCustomDictionary(ui.dictionaryFileInput.files && ui.dictionaryFileInput.files[0]));
    ui.startAutoFillButton.addEventListener("click", () => startAutoFill(false));
    ui.tryAnotherFillButton.addEventListener("click", () => startAutoFill(true));
    ui.cancelAutoFillButton.addEventListener("click", () => cancelAutoFill(false));
    ui.clearButton.addEventListener("click", clearPuzzle);
    ui.deletePuzzleButton.addEventListener("click", deletePuzzle);
    ui.checkCellButton.addEventListener("click", checkCurrentCell);
    ui.checkWordButton.addEventListener("click", checkCurrentWord);
    ui.revealCellButton.addEventListener("click", revealCurrentCell);
    ui.revealWordButton.addEventListener("click", revealCurrentWord);
    ui.checkPuzzleButton.addEventListener("click", checkWholePuzzle);
    ui.revealPuzzleButton.addEventListener("click", revealWholePuzzle);
    ui.clearGuessesButton.addEventListener("click", clearGuesses);
    ui.acrossTab.addEventListener("click", () => setDirection("across"));
    ui.downTab.addEventListener("click", () => setDirection("down"));
    ui.undoButton.addEventListener("click", undo);
    ui.redoButton.addEventListener("click", redo);
    ui.focusGridButton.addEventListener("click", focusSelectedCell);
    ui.grid.addEventListener("click", onGridClick);
    document.addEventListener("keydown", handleKeyboard);
    window.addEventListener("beforeunload", () => saveNow(false));
  }

  bindEvents();
  initialize();
  loadDefaultDictionary();
})();
