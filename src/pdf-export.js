/*
 * Gridwright US & UK Crossword Studio PDF export helpers.
 * PDF construction uses jsPDF and jsPDF-AutoTable; see vendor/ and THIRD-PARTY-NOTICES.md.
 * The page sequence is inspired by Phil's printable and NYT submission exports,
 * updated for the current NYT technical checklist and Gridwright's puzzle model.
 */
(function (root, factory) {
  const isCommonJs = typeof module === "object" && module.exports;
  const model = isCommonJs ? require("./model.js") : root.GridwrightModel;
  const jspdf = isCommonJs ? require("../vendor/jspdf.umd.min.js") : root.jspdf;
  const tablePlugin = isCommonJs ? require("../vendor/jspdf.plugin.autotable.min.js") : null;
  if (isCommonJs && tablePlugin && typeof tablePlugin.applyPlugin === "function") {
    tablePlugin.applyPlugin(jspdf.jsPDF);
  }
  const api = factory(model, jspdf && jspdf.jsPDF);
  if (isCommonJs) module.exports = api;
  else root.GridwrightPdfExport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Model, JsPDF) {
  "use strict";

  const A4 = "a4";
  const LETTER = "letter";
  const MARGIN = 42;
  const SMALL_PAGE_BOTTOM = 34;

  function normalize(source) {
    if (!Model) throw new Error("The crossword model is required to create PDFs.");
    return Model.normalizePuzzle(source);
  }

  function requirePdfTools() {
    if (typeof JsPDF !== "function") throw new Error("The PDF library is missing. Rebuild the standalone app or restore vendor/jspdf.umd.min.js.");
    if (!JsPDF.API || typeof JsPDF.API.autoTable !== "function") throw new Error("The PDF table plugin is missing. Rebuild the standalone app or restore vendor/jspdf.plugin.autotable.min.js.");
  }

  function sizeOf(doc) {
    const size = doc.internal.pageSize;
    return {
      width: typeof size.getWidth === "function" ? size.getWidth() : size.width,
      height: typeof size.getHeight === "function" ? size.getHeight() : size.height,
    };
  }

  function makeDocument(puzzle, paper, subject) {
    requirePdfTools();
    const doc = new JsPDF({ orientation: "portrait", unit: "pt", format: paper, compress: true, putOnlyUsedFonts: true });
    doc.setProperties({
      title: puzzle.title || "Untitled crossword",
      author: puzzle.author || "",
      subject,
      creator: "Gridwright US & UK Crossword Studio",
    });
    return doc;
  }

  function cleanText(value, fallback = "") {
    return String(value == null ? fallback : value).replace(/\r\n?/g, "\n").replace(/\0/g, "");
  }

  function titleLines(doc, title, maxWidth, fontSize = 20) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(cleanText(title || "Untitled crossword"), maxWidth);
    return Array.isArray(lines) ? lines : [lines];
  }

  function drawGrid(doc, puzzle, options) {
    const { x, y, cellSize, filled = false } = options;
    const numbers = Model.getEntries(puzzle).cellNumbers;
    const lineWidth = Math.max(0.25, Math.min(0.7, cellSize / 36));
    const labelSize = Math.max(3.5, Math.min(8, cellSize * 0.28));
    const letterSize = Math.max(5, Math.min(16, cellSize * 0.57));

    doc.setDrawColor(0, 0, 0);
    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        const index = row * puzzle.cols + col;
        const left = x + col * cellSize;
        const top = y + row * cellSize;
        doc.setLineWidth(lineWidth);
        if (puzzle.blocks[index]) {
          doc.setFillColor(0, 0, 0);
          doc.rect(left, top, cellSize, cellSize, "FD");
          continue;
        }
        doc.setFillColor(255, 255, 255);
        doc.rect(left, top, cellSize, cellSize, "FD");
        if (numbers[index]) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(labelSize);
          doc.setTextColor(0, 0, 0);
          doc.text(String(numbers[index]), left + Math.max(1, cellSize * 0.08), top + labelSize + Math.max(0.5, cellSize * 0.04));
        }
        if (filled && puzzle.answers[index]) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(letterSize);
          doc.setTextColor(0, 0, 0);
          doc.text(String(puzzle.answers[index]), left + cellSize / 2, top + cellSize * 0.72, { align: "center" });
        }
      }
    }
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(Math.max(0.8, Math.min(1.7, cellSize / 18)));
    doc.rect(x, y, puzzle.cols * cellSize, puzzle.rows * cellSize, "S");
  }

  function drawSmallHeader(doc, puzzle, subtitle) {
    const { width } = sizeOf(doc);
    const left = MARGIN;
    doc.setTextColor(27, 47, 52);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(cleanText(puzzle.title || "Untitled crossword"), left, 27, { maxWidth: width - 2 * MARGIN });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(cleanText(subtitle || puzzle.author || ""), left, 41, { maxWidth: width - 2 * MARGIN });
    doc.setDrawColor(182, 190, 186);
    doc.setLineWidth(0.45);
    doc.line(left, 50, width - MARGIN, 50);
  }

  function addPageNumbers(doc) {
    const count = doc.internal.getNumberOfPages();
    for (let page = 1; page <= count; page += 1) {
      doc.setPage(page);
      const { width, height } = sizeOf(doc);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(105, 112, 112);
      doc.text(`Page ${page} of ${count}`, width - MARGIN, height - 17, { align: "right" });
    }
    return count;
  }

  function bytesFrom(doc) {
    return new Uint8Array(doc.output("arraybuffer"));
  }

  function clueRows(puzzle, across, down) {
    const count = Math.max(across.length, down.length);
    const body = [];
    for (let index = 0; index < count; index += 1) {
      const format = (entry) => {
        if (!entry) return "";
        const clue = Model.formatClue(puzzle, entry);
        const fallback = puzzle.crosswordStyle === "british"
          ? `[no clue] (${Model.getEnumeration(puzzle, entry)})`
          : "[no clue]";
        return `${entry.number}. ${cleanText(clue || fallback)}`;
      };
      body.push({ across: format(across[index]), down: format(down[index]) });
    }
    return body;
  }

  function createPrintablePuzzlePdf(source) {
    const puzzle = normalize(source);
    const entries = Model.getEntries(puzzle);
    const doc = makeDocument(puzzle, A4, "Printable crossword puzzle");
    const { width, height } = sizeOf(doc);
    const margin = MARGIN;
    const contentWidth = width - 2 * margin;
    const heading = titleLines(doc, puzzle.title || "Untitled crossword", contentWidth, 19);
    let y = 36;
    doc.setTextColor(22, 43, 48);
    doc.text(heading, margin, y);
    y += heading.length * 22 + 2;
    if (puzzle.author.trim()) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(63, 75, 76);
      doc.text(`By ${cleanText(puzzle.author)}`, margin, y);
      y += 15;
    }
    const gridY = y + 8;
    const maxGridHeight = Math.min(430, height * 0.52);
    const cellSize = Math.min(28, contentWidth / puzzle.cols, maxGridHeight / puzzle.rows);
    const gridWidth = cellSize * puzzle.cols;
    const gridHeight = cellSize * puzzle.rows;
    const gridX = (width - gridWidth) / 2;
    drawGrid(doc, puzzle, { x: gridX, y: gridY, cellSize, filled: false });

    const startY = gridY + gridHeight + 18;
    if (entries.across.length + entries.down.length) {
      const columnWidth = contentWidth / 2;
      const body = clueRows(puzzle, entries.across, entries.down);
      doc.autoTable({
        columns: [
          { header: "ACROSS", dataKey: "across" },
          { header: "DOWN", dataKey: "down" },
        ],
        body,
        startY,
        margin: { top: 66, left: margin, right: margin, bottom: SMALL_PAGE_BOTTOM },
        tableWidth: contentWidth,
        theme: "plain",
        styles: {
          font: "helvetica",
          fontSize: 8.5,
          textColor: [35, 43, 43],
          cellPadding: { top: 3, right: 5, bottom: 4, left: 5 },
          overflow: "linebreak",
          valign: "top",
          lineColor: [220, 223, 219],
          lineWidth: 0.18,
        },
        headStyles: { fontStyle: "bold", fontSize: 8.5, textColor: [20, 44, 49], fillColor: [244, 245, 241] },
        columnStyles: {
          across: { cellWidth: columnWidth },
          down: { cellWidth: columnWidth },
        },
        didDrawPage: ({ pageNumber }) => {
          if (pageNumber > 1) drawSmallHeader(doc, puzzle, "Clues");
        },
      });
    }
    const pageCount = addPageNumbers(doc);
    return { bytes: bytesFrom(doc), pageCount, warnings: [] };
  }

  function createSolutionGridPdf(source) {
    const puzzle = normalize(source);
    const open = Model.openIndices(puzzle);
    if (!open.length) throw new Error("There are no open cells to export as a solution grid.");
    const blankCount = open.filter((index) => !puzzle.answers[index]).length;

    const doc = makeDocument(puzzle, A4, "Crossword solution grid");
    const { width, height } = sizeOf(doc);
    const contentWidth = width - 2 * MARGIN;
    const heading = titleLines(doc, puzzle.title || "Untitled crossword", contentWidth, 21);
    let y = 44;
    doc.setTextColor(22, 43, 48);
    doc.text(heading, MARGIN, y);
    y += heading.length * 24 + 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(76, 91, 90);
    doc.text("SOLUTION GRID", MARGIN, y);
    if (puzzle.author.trim()) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(`By ${cleanText(puzzle.author)}`, width - MARGIN, y, { align: "right", maxWidth: contentWidth * 0.55 });
    }

    const gridY = y + 20;
    const maxGridWidth = contentWidth;
    const maxGridHeight = height - gridY - 40;
    const cellSize = Math.min(32, maxGridWidth / puzzle.cols, maxGridHeight / puzzle.rows);
    const gridWidth = cellSize * puzzle.cols;
    drawGrid(doc, puzzle, { x: (width - gridWidth) / 2, y: gridY, cellSize, filled: true });
    const pageCount = addPageNumbers(doc);
    const warnings = blankCount
      ? [blankCount === 1
        ? "1 open cell has no answer letter and is shown blank."
        : `${blankCount} open cells have no answer letter and are shown blank.`]
      : [];
    return { bytes: bytesFrom(doc), pageCount, warnings };
  }

  function validateNytSubmission(puzzle, contact) {
    const entries = Model.getEntries(puzzle);
    if (!entries.across.length || !entries.down.length) {
      throw new Error("The NYT submission PDF needs both Across and Down entries.");
    }
    const layout = Model.validateLayout(puzzle, { minimumLength: 3, requireSymmetry: true });
    if (!layout.valid) {
      throw new Error(`The NYT submission layout needs attention first: ${layout.issues.join(" ")}`);
    }
    const blankCells = [];
    for (let index = 0; index < puzzle.answers.length; index += 1) {
      if (!puzzle.blocks[index] && !puzzle.answers[index]) blankCells.push(index);
    }
    if (blankCells.length) {
      throw new Error(`Fill the answer grid before making an NYT submission PDF (${blankCells.length} open cell${blankCells.length === 1 ? "" : "s"} blank).`);
    }
    const missingClues = entries.across.concat(entries.down).filter((entry) => !String(puzzle.clues[entry.id] || "").trim());
    if (missingClues.length) {
      const examples = missingClues.slice(0, 6).map((entry) => `${entry.number}${entry.direction === "across" ? "A" : "D"}`).join(", ");
      throw new Error(`Add a clue for every entry before preparing the NYT PDF. Missing: ${examples}${missingClues.length > 6 ? ", …" : ""}.`);
    }
    const author = cleanText(contact && contact.name).trim();
    const email = cleanText(contact && contact.email).trim();
    const address = cleanText(contact && contact.address).trim();
    if (!author) throw new Error("Enter the constructor name or names for the submission.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address for the submission.");
    if (!address) throw new Error("Enter a mailing address for the submission.");
    return { entries, contact: { name: author, email, address }, layout };
  }

  function clueAnswer(puzzle, entry) {
    return entry.indices.map((index) => puzzle.answers[index]).join("");
  }

  function nytTableRows(puzzle, entries) {
    return entries.map((entry) => ({
      number: String(entry.number),
      clue: cleanText(puzzle.clues[entry.id] || ""),
      answer: clueAnswer(puzzle, entry),
    }));
  }

  function addNytClueTable(doc, puzzle, section, entries, startY) {
    if (!entries.length) return startY;
    const { width, height } = sizeOf(doc);
    const left = 58;
    const right = 58;
    const usable = width - left - right;
    const labelWidth = 30;
    const answerWidth = 130;
    const clueWidth = usable - labelWidth - answerWidth;
    let y = startY;
    if (y + 54 > height - 45) {
      doc.addPage(LETTER, "portrait");
      y = 80;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(18, 38, 43);
    doc.text(section.toUpperCase(), left, y);
    y += 7;
    doc.autoTable({
      columns: [
        { header: "No.", dataKey: "number" },
        { header: "Clue", dataKey: "clue" },
        { header: "Answer", dataKey: "answer" },
      ],
      body: nytTableRows(puzzle, entries),
      startY: y,
      margin: { top: 80, left, right, bottom: 44 },
      tableWidth: usable,
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 10,
        textColor: [22, 29, 31],
        cellPadding: { top: 6, right: 5, bottom: 7, left: 5 },
        overflow: "linebreak",
        valign: "top",
        lineWidth: 0,
      },
      headStyles: {
        fontStyle: "bold",
        fontSize: 9,
        textColor: [60, 66, 68],
        fillColor: [255, 255, 255],
        cellPadding: { top: 4, right: 5, bottom: 6, left: 5 },
      },
      columnStyles: {
        number: { cellWidth: labelWidth, halign: "right" },
        clue: { cellWidth: clueWidth },
        answer: { cellWidth: answerWidth, font: "courier", fontSize: 9.5, overflow: "linebreak" },
      },
    });
    return doc.lastAutoTable ? doc.lastAutoTable.finalY : y;
  }

  function createNytSubmissionPdf(source, contact) {
    const puzzle = normalize(source);
    const validation = validateNytSubmission(puzzle, contact || {});
    const doc = makeDocument(puzzle, LETTER, "New York Times crossword submission");
    doc.setProperties({ author: validation.contact.name });
    const { width, height } = sizeOf(doc);
    const margin = 58;

    // Page 1: completed, numbered answer grid and constructor contact details.
    let y = 36;
    const heading = titleLines(doc, puzzle.title || "Untitled crossword", width - 2 * margin, 20);
    doc.setTextColor(18, 38, 43);
    doc.text(heading, margin, y);
    y += heading.length * 23 + 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(validation.contact.name, margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Email: ${validation.contact.email}`, margin, y, { maxWidth: width - 2 * margin });
    y += 12;
    const addressLines = doc.splitTextToSize(`Address: ${validation.contact.address}`, width - 2 * margin);
    doc.text(addressLines, margin, y);
    y += addressLines.length * 11 + 10;
    doc.setDrawColor(170, 177, 175);
    doc.setLineWidth(0.5);
    doc.line(margin, y - 3, width - margin, y - 3);

    const gridTop = y + 12;
    const maxGridWidth = width - 2 * margin;
    const maxGridHeight = height - gridTop - 48;
    const cellSize = Math.min(31, maxGridWidth / puzzle.cols, maxGridHeight / puzzle.rows);
    const gridWidth = cellSize * puzzle.cols;
    drawGrid(doc, puzzle, { x: (width - gridWidth) / 2, y: gridTop, cellSize, filled: true });

    // Page 2: a clean, numbered blank grid, matching Phil's useful paper layout.
    doc.addPage(LETTER, "portrait");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(18, 38, 43);
    doc.text(cleanText(puzzle.title || "Untitled crossword"), margin, 42, { maxWidth: width - 2 * margin });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`${validation.contact.name} · Blank grid`, margin, 60, { maxWidth: width - 2 * margin });
    const blankCellSize = Math.min(31, (width - 2 * margin) / puzzle.cols, (height - 120) / puzzle.rows);
    const blankWidth = blankCellSize * puzzle.cols;
    const blankHeight = blankCellSize * puzzle.rows;
    drawGrid(doc, puzzle, { x: (width - blankWidth) / 2, y: Math.max(88, (height - blankHeight) / 2), cellSize: blankCellSize, filled: false });

    // Page 3+: double-spaced clue lists with answers in a far-right column.
    doc.addPage(LETTER, "portrait");
    let clueY = 86;
    clueY = addNytClueTable(doc, puzzle, "Across", validation.entries.across, clueY);
    const { height: cluePageHeight } = sizeOf(doc);
    if (clueY > cluePageHeight - 108) {
      doc.addPage(LETTER, "portrait");
      clueY = 78;
    } else {
      clueY += 18;
    }
    addNytClueTable(doc, puzzle, "Down", validation.entries.down, clueY);

    const pageCount = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      const pageSize = sizeOf(doc);
      if (page >= 3) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(20, 42, 47);
        doc.text(cleanText(puzzle.title || "Untitled crossword"), margin, 29, { maxWidth: pageSize.width - 2 * margin });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(validation.contact.name, margin, 43);
        doc.setDrawColor(180, 185, 182);
        doc.setLineWidth(0.4);
        doc.line(margin, 51, pageSize.width - margin, 51);
      }
    }
    const finalPageCount = addPageNumbers(doc);
    const warnings = [];
    if (!((puzzle.rows === 15 && puzzle.cols === 15) || (puzzle.rows === 21 && puzzle.cols === 21))) {
      warnings.push("The PDF is formatted, but this grid is not the typical NYT 15×15 daily or 21×21 Sunday size.");
    }
    if (puzzle.rows === 15 && puzzle.cols === 15 && validation.layout.entryCount > 72) {
      warnings.push(validation.layout.entryCount > 78
        ? "This 15×15 grid exceeds the NYT's usual 72-entry themeless and 78-entry themed maximums; only limited exceptions are typical."
        : "This 15×15 grid is above the NYT's usual 72-entry themeless maximum (the themed maximum is usually 78). Check the current guidelines.");
    }
    if (puzzle.rows === 21 && puzzle.cols === 21 && validation.layout.entryCount > 140) {
      warnings.push("This 21×21 grid exceeds the NYT's usual 140-entry maximum.");
    }
    return { bytes: bytesFrom(doc), pageCount: finalPageCount, warnings };
  }

  return {
    createPrintablePuzzlePdf,
    createSolutionGridPdf,
    createNytSubmissionPdf,
    validateNytSubmission,
  };
});
