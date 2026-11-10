# Gridwright US & UK Crossword Studio

An offline crossword studio with a per-puzzle **American / British Cryptic** style switch. This is a separate project folder from the earlier Gridwright FillLab; it has its own local-storage key and does not alter that project. The editor, layout generator, cryptic clue checklist, and crossing-aware solver are original Gridwright code. The Across Lite `.puz` writer adapts the Apache-2.0-licensed `PuzWriter` format implementation from Keiran King's Phil; attribution and the applicable license are included. It does not include CrossFire code, binaries, artwork, or puzzle examples.

## Choose a style

Use the **Style** selector in the top bar. The choice is saved with each puzzle, appears in the puzzle library, and is stored in `.gwx.json` files. Switching styles preserves the current grid, answers, guesses, and clue text.

- **American** keeps the existing general clue-writing workflow and the bundled general English autofill list.
- **British Cryptic** keeps the black-square (blocked) grid—this is not the barred-grid variant—and adds a cryptic clue builder for each answer: choose a main wordplay device, note the definition and wordplay, and set an optional enumeration such as `3,4`. By default, the enumeration is derived from the answer length. Valid enumerations are appended to printed, `.puz`, and `.ipuz` clues. Across Lite `.puz` export refuses a British layout containing a two-cell run, so its inferred clue numbering cannot silently disagree with the British clue list.
- **Generate Layout is style-aware.** British mode uses a distinct blocked-cryptic profile: odd dimensions (commonly 13×13 or 15×15), 180° symmetry, an adjustable 25–35% black-square target (30% by default), single-cell unchecked squares (unches), and no two-cell runs. It also keeps each answer at least half cross-checked, limits consecutive unches, avoids double unches at answer ends, and rejects disconnected layouts, 2×2 black-square clumps, and long streaks of blocks. American mode retains its existing lower-density, fully checked layout generator.
- British manual block editing keeps 180° symmetry enabled. The British grid validator reports the same construction checks before you move on to filling and clueing.
- **Review cryptic clues** checks for missing clue text, device, definition/wordplay notes, or an enumeration whose parts do not add up to the grid entry. This is a drafting checklist, not an automatic judge of clue fairness or correctness.
- In British mode, the bundled dictionary tries a small curated set of common British spellings and UK vocabulary first, then retains the full general word list. It is a preference, not a strict UK-only dictionary; load your own `.txt` list for stricter regional vocabulary.
- The grid remains a black-square crossword in both styles. Existing layout generation, symmetry settings, crossing-aware autofill/backtracking, solving, and solution checking remain available. The NYT submission PDF is shown only in American mode.

## British layout profile

British publications do not all use one grid template; this generator targets a standard daily **blocked cryptic** rather than a barred advanced/variety grid. It creates odd-sized, rotationally symmetric patterns, uses more black squares than the American profile, and allows single-cell unches. Each actual answer must have at least half its letters checked, with no run of three unchecked letters and no double-unch at either end. Two-cell answer runs are rejected. The target is adjustable from 25% to 35% blocks; the exact dimensions, answer list, and clue quality still need setter review.

The profile was informed by [a UK cryptic construction guide](http://crypticcrosswords.net/wp-content/uploads/2015/06/Cryptic-Crossword-Clues_v1-1.pdf), [Times for The Times' grid notes](https://timesforthetimes.co.uk/more-than-you-ever-want-to-know-about-grids), and [The Clue Clinic's setter guidance](https://clueclinic.com/index.php/the-setting-room/). These describe common practices, not universal rules for every newspaper.

## Autofill

- The bundled general word list is compiled from `default.txt` and loads automatically; it is embedded in the standalone and Windows desktop versions so they work offline.
- Use **Load .txt** to replace the current list with your own plain-text dictionary. Put one word per line; blank lines and lines beginning with `#` are ignored. Earlier lines are tried first.
- Existing answer letters are fixed crossing constraints. The solver selects a constrained entry, tries matching words, and backtracks when a choice prevents other entries from fitting.
- Duplicate answers are avoided by default; the checkbox can allow them.
- Search-step, time, and per-slot candidate limits are adjustable. If it reaches a limit or is stopped, it keeps the best partial fill found when the grid has not changed.
- **Try another fill** restores the original letters from before autofill, excludes earlier fill grids, and searches for a different word order. It keeps the current result if it cannot find an equal-or-better alternative within the selected budget.
- The solver is a word-list/crossing solver, **not a clue-answering language model**: it does not interpret cryptic wordplay or verify clue meaning.

`default.txt` has 86,067 unique alphabetic entries between three and fifteen letters. A public-domain common-word set is placed first, followed by additional SCOWL-derived entries. Sources and notices are documented in `THIRD-PARTY-NOTICES.md`. If you edit `default.txt`, rebuild its embedded copy and then the standalone app:

```bash
python scripts/build-default-words.py
python scripts/build-standalone.py
```

## Other features

- Create and edit black-square grids, Across/Down answers and clues, with automatic numbering. Clue text fields accept normal spaces; keyboard selection uses a separate numbered button.
- Generate and validate style-specific black-square layouts: American entries are all checked; British Cryptic uses a higher-density lattice with single-cell unches and British checking rules.
- Solve manually with check/reveal tools and a timer.
- Undo/redo, local autosave, a local puzzle library, portable `.gwx.json` import/export, and browser printing.
- Export Across Lite `.puz`, open-standard `.ipuz`, a blank printable puzzle PDF, and a solution-grid PDF. The solution PDF uses the saved answer key (not solve-mode guesses); unanswered cells stay blank and their count is reported.
- Create a New York Times-style submission PDF in American mode. It asks for constructor name, email, and mailing address; those details are included only in the PDF, not saved with puzzle data. It checks layout, answers, and clues but cannot guarantee acceptance. Review the current [NYT submission guidelines](https://www.nytimes.com/article/submit-crossword-puzzles-the-new-york-times.html) before sending.
- PDF exports use bundled jsPDF and AutoTable and work offline. No account, cloud service, trial, watermark, or subscription feature gate.

Gridwright's `.gwx.json` format is its own format and does not import CrossFire `.cfp` files. The manual grid ceiling is 60 × 60; automatic layout generation supports up to 31 × 31.

## Try it offline

Open `Gridwright-US-UK-Crossword.html` in a modern browser, or open `index.html` from this folder. Autosave is local to this app/browser profile; export `.gwx.json` files for portable backups. The bundled dictionary is embedded in the standalone file.

## Run as a Windows desktop app

Install Node.js 22.12 or newer. Double-click `run-windows.bat`, or open PowerShell in this directory and run:

```powershell
npm install
npm start
```

To package a Windows x64 app folder:

```powershell
npm run package:win
```

The output is under `release/Gridwright-US-UK-Crossword-win32-x64`. A Windows `.exe` package was not built in this Linux workspace.

## Tests

```bash
npm test
```
