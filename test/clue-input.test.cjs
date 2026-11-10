"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appSource = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const stylesSource = fs.readFileSync(path.join(__dirname, "../styles.css"), "utf8");

test("solution grid PDF has a clearly labeled, visible toolbar button wired to its exporter", () => {
  assert.match(htmlSource, /id="exportSolutionPdfButton"/);
  assert.match(htmlSource, /class="button button-soft format-export-button solution-export-button"/);
  assert.match(htmlSource, /Solution PDF/);
  assert.match(htmlSource, /Sol PDF/);
  assert.match(appSource, /ui\.exportSolutionPdfButton\.addEventListener\("click", exportSolutionPdf\)/);
  assert.match(stylesSource, /\.topbar-actions \{ flex-wrap: wrap; min-width: 0; \}/);
});

test("Space in a clue input is not prevented or bubbled to crossword shortcuts", () => {
  const clueStart = appSource.indexOf('input.className = "clue-input";');
  const inputHandlerStart = appSource.indexOf('input.addEventListener("keydown", (event) => {', clueStart);
  const inputHandlerEnd = appSource.indexOf("        });", inputHandlerStart);
  assert.ok(clueStart >= 0 && inputHandlerStart > clueStart && inputHandlerEnd > inputHandlerStart);
  const spaceHandler = appSource.slice(inputHandlerStart, inputHandlerEnd);
  assert.match(spaceHandler, /event\.key === " "[\s\S]*event\.stopPropagation\(\)/);
  assert.doesNotMatch(spaceHandler, /preventDefault/);
  assert.doesNotMatch(appSource, /row\.addEventListener\("keydown"/);
  assert.match(appSource, /button:not\(\.cell\)/, "global shortcuts should leave normal buttons to the browser");
});
