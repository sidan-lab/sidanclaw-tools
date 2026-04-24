---
name: gsheets-formatting
description: Base skill for Google Sheets authoring. Before any create or edit call, sample the user's existing sheets, learn their formatting conventions (headers, freeze rows, column widths, number formats, tab colors, dropdown vocabularies, banding, naming), and reapply them to the new work. Use whenever the assistant is about to call googleSheetsCreate, googleSheetsWriteRange, googleSheetsFormat, or googleSheetsBatchUpdate — it is the formatting guide every other sheets operation inherits from.
license: MIT
compatibility: Designed for sidanclaw
metadata:
  author: sidanclaw
  category: productivity
  when_to_use: Activate before any Google Sheets create or edit — creating a new tracker, appending to an existing sheet, polishing after a write, or running a batchUpdate. Skip when the user is only reading data, only needs a link, or has given an explicit, self-contained formatting spec that overrides convention.
  requires_connectors: gdrive
  tags: official, base
---

# Google Sheets Formatting

A base skill that wraps every Google Sheets write. The job is simple and strict: **observe first, then write**. Before any `googleSheetsCreate` / `googleSheetsWriteRange` / `googleSheetsFormat` / `googleSheetsBatchUpdate` call, sample the user's existing sheets, distill a style profile, and apply it. The longer a user works with the assistant, the more their sheets should look like a coherent set — not a bag of independently-styled outputs.

## Core principle

The user has a taste they may not be able to articulate. They can describe *content* ("track my deals with stage + amount") but rarely *style* ("bold header row, frozen top, 140px wide name column, light-grey banding, date as `YYYY-MM-DD`"). Treat their prior sheets as the spec. If there are no prior sheets, fall back to the defaults in this skill.

**Never** ship a sheet whose styling was picked without evidence when evidence was reachable. One `findGDriveFiles` + one `googleSheetsReadRange` is cheap; a mismatched sheet the user has to re-style by hand is expensive.

## What this skill does NOT do

- **Decide what data belongs in a sheet.** That's the user's call — this skill owns the *look*, not the *content*.
- **Create non-sheet artifacts.** Docs go to `googleDocsCreate`, Slides to `googleSlidesCreatePresentation`. A "tracker" in a Doc table is a different skill.
- **Edit a user-owned file the assistant didn't create without picker consent.** The `gdrive` connector uses `drive.file` scope — unpicked files return 404. If the user references a sheet you can't read, ask them to add it via the picker.
- **Parse *cell-level* visual formatting from the typed read path today.** Sheet-level formatting (theme, tab color, freezes, banding, conditional rules, Tables) IS returned by the default `spreadsheets.get` and is the primary "learn" source — see below. Only per-cell `userEnteredFormat` (individual fills, fonts, borders) needs `includeGridData=true` or a `fields` mask, which sidanclaw's `googleSheetsGetInfo(id)` wrapper does not expose yet.

## Tool map

| Tool | Role in this skill |
|---|---|
| `findGDriveFiles` | Discover prior assistant-created sheets by `kind: 'sheet'` + optional `query`. Read-only, concurrency-safe. Primary source for convention inheritance. |
| `googleSheetsGetInfo` | Inspect sheet metadata — titles, tab colors, dimensions, frozen rows/columns. |
| `googleSheetsReadRange` | Inspect rendered values. Use for header wording, data shape, enum vocabularies, number/date rendering. |
| `googleSheetsCreate` | Create a new spreadsheet. Auto-authorized — no picker needed. |
| `googleSheetsWriteRange` | Overwrite a range. Values are parsed as if typed (formulas, dates, numbers). |
| `googleSheetsFormat` | Typed polish: `boldHeader`, `freezeRows`, `freezeColumns`, `autoResizeColumns`, `columnWidths`, `wrapText`, `dataValidations`. Covers the 80%. |
| `googleSheetsBatchUpdate` | Raw Sheets API for everything else — banding, borders, conditional formatting, merged cells, charts, pivot tables, protected ranges, **and `copyPaste` (see Style inheritance below)**. Requires a one-line `summary` shown in the approval prompt. Destructive request types need `allowDestructive: true` and always prompt. |

## The pre-flight inspection workflow

Run before **every** sheets write. Keep it short — the goal is a small, reusable style profile, not an audit.

### Step 1 — Decide the reference set

Three cases, in order of priority:

1. **Editing an existing sheet.** The target sheet itself *is* the reference. Read it, use its conventions, do not drift.
2. **Creating a new sheet on a recurring topic** ("another CRM update", "weekly metrics", "deals this month"). Find the user's prior sheet in the same domain via `findGDriveFiles({ kind: 'sheet', query: '<domain keyword>' })` and use it as the canonical template.
3. **Creating a new sheet with no clear topic match.** Sample the 2–3 most recently-created assistant sheets via `findGDriveFiles({ kind: 'sheet' })` to learn the user's generic defaults (how they like headers, freezes, date formats).

If `findGDriveFiles` returns nothing, skip to [Defaults](#defaults-when-no-reference-exists).

### Step 2 — Inspect each reference sheet

For every reference:

- Call `googleSheetsGetInfo(spreadsheetId)` — capture sheet names, `gridProperties.frozenRowCount`, `gridProperties.frozenColumnCount`, `tabColor`, row/column count.
- Call `googleSheetsReadRange(spreadsheetId, 'Sheet1!A1:Z3')` (or whichever tab matters) — enough to see the header row and 1–2 data rows.
- If there are enum-like columns (Status, Type, Priority), widen to `'Sheet1!<col>2:<col>50'` to sample the vocabulary.

That's usually all you need. Do **not** read thousands of rows to learn a pattern — the first 2–3 rows after the header tell you everything.

### Step 3 — Distill a style profile

Fill in this table in working memory. Skip any field you have no evidence for — don't invent.

| Dimension | Source of signal | How to apply |
|---|---|---|
| **Header row** | Row 1 of references. Are headers terse (`Amount`) or prose (`Deal Amount (USD)`)? Capitalized or sentence-case? | Match the user's voice when you write new headers. |
| **Freeze rows** | `gridProperties.frozenRowCount` | Pass same value to `googleSheetsFormat({ freezeRows })`. Default to `1` if unseen. |
| **Freeze columns** | `gridProperties.frozenColumnCount` | Pass to `googleSheetsFormat({ freezeColumns })`. Default to `0`. |
| **Column widths** | Visible content length in reference + eyeball pattern (identifier cols narrow, description cols wide). | Map to `columnWidths: [{ column: 'A', pixelSize: N }]`. |
| **Wrap text** | Long prose in cells of reference? | `wrapText: true` for description-heavy sheets, else skip. |
| **Date format** | Render of date-typed cells in `googleSheetsReadRange`. | When writing, use the same string form (`2026-04-24` vs `24 Apr 2026` vs `4/24/2026`). |
| **Number formats** | Currency symbol, decimal places, thousand separators in reference. | Match in `userEnteredFormat.numberFormat` via `googleSheetsBatchUpdate` (request kind: `repeatCell`). |
| **Enum vocabulary** | Column values in references labeled like Status / Stage / Type / Priority. | Pass to `dataValidations: [{ range, values, strict: true }]`. **Reuse exact spellings** — `"Active"` and `"active"` are not the same enum. |
| **Tab color** | `sheets[].properties.tabColor` | Reapply via `googleSheetsBatchUpdate` (`updateSheetProperties`). |
| **Bold header** | Can't read directly from typed tools. Assume `true` if the user has accepted it in prior assistant-created sheets, else default `true`. | `googleSheetsFormat({ boldHeader: true })`. |
| **Banding** | Not directly readable; treat as a user preference once set. | Reapply via `googleSheetsBatchUpdate` `addBanding` when you know the user wants it. |
| **Sheet naming** | Does the user prefer `Sheet1` (default) or renamed tabs (`Deals`, `Notes`, `Archive`)? | When creating, rename the first tab to match the topic if that matches the pattern. |
| **File naming** | Pattern in `findGDriveFiles` results: `Deals — 2026 Q2`, `Weekly Metrics (W17)`, etc. | Follow the same pattern for the new title. |
| **Theme, banding, conditional rules, Tables** | Sheet-level fields on `spreadsheets.get` — see **Mode 1** below for the full list and how to replay. | Replay via `batchUpdate` rebound to destination ranges — do not use `PASTE_FORMAT`. |
| **Cell fills, fonts, borders** | Needs `includeGridData` / fields mask — see **Mode 3**. | Blocked on tool lift today. |

## Style inheritance — the four modes

Sheets exposes several layers of style abstraction. Pick the mode that matches the target's shape and the reference's structure. **Prefer higher-abstraction modes** — they generalize across shapes; cell-level transfer does not.

### Mode 1 — Semantic extraction (primary path, works today)

The default `spreadsheets.get` response returns sheet-level style abstractions **without** `includeGridData`:

- `properties.spreadsheetTheme` — `primaryFontFamily` + `themeColors[]` (TEXT, BACKGROUND, ACCENT1..6, LINK mapped to concrete colors). Spreadsheet-wide.
- `properties.locale`, `properties.timeZone`, `properties.defaultFormat` — localization + base number/text defaults.
- `sheets[].properties.tabColor`, `.gridProperties.frozenRowCount` / `.frozenColumnCount`.
- `sheets[].bandedRanges[]` — banding schemes (header/footer colors + alternating body colors, with an `A1`-like `range`).
- `sheets[].conditionalFormats[]` — rules with `booleanRule` / `gradientRule` and their target `ranges`.
- `sheets[].tables[]` — any Sheets Tables (see Mode 2).

**Apply to destination:**

1. `batchUpdate` → `updateSpreadsheetProperties` with `{ spreadsheetTheme }` and `fields: "spreadsheetTheme"`. Single call carries font + palette to the new spreadsheet.
2. `googleSheetsFormat({ freezeRows, freezeColumns })` from the reference's `gridProperties`.
3. `batchUpdate` → `updateSheetProperties` with `tabColor` + `fields: "tabColor"` per tab where relevant.
4. `batchUpdate` → `addBanding` / `addConditionalFormatRule`, each **rebound to the destination `range`** (the rules' logic travels; the anchor is rewritten).

This is genuine learn-then-apply — you extracted abstractions, not pixels, and replayed them over a differently-shaped destination without breakage.

### Mode 2 — Table-first creation (the power move for new sheets)

When creating a new sheet, wrap the data region in a **Sheets Table**. Tables are semantic: they auto-apply formatted header + banding, carry typed column formats + validations, and **auto-extend formatting on append** (via `AppendCellsRequest` with `tableId`).

```json
{
  "addTable": {
    "table": {
      "name": "Deal Pipeline",
      "range": { "sheetId": <id>, "startRowIndex": 0, "endRowIndex": N, "startColumnIndex": 0, "endColumnIndex": M },
      "columnProperties": [
        { "columnIndex": 0, "columnName": "Name",   "columnType": "TEXT" },
        { "columnIndex": 1, "columnName": "Amount", "columnType": "NUMERIC" },
        { "columnIndex": 2, "columnName": "Close",  "columnType": "DATE" },
        { "columnIndex": 3, "columnName": "Stage",  "columnType": "DROPDOWN",
          "dataValidationRule": { "condition": { "type": "ONE_OF_LIST", "values": [...] } } }
      ]
    }
  }
}
```

Column types: `TEXT`, `NUMERIC`, `DATE`, `DROPDOWN` (requires `ONE_OF_LIST`), `PERCENT`, `CHECKBOX`, `RATING`, `SMART_CHIP`. `RATING` and `CHECKBOX` auto-default to 0 and FALSE.

If the user's reference sheet was itself built as a Table, copy its `columnProperties` directly — the schema *is* the profile. Even if references are plain ranges, promoting the destination to a Table is usually an upgrade: future appends self-style.

### Mode 3 — Cell-level extraction (blocked on tool lift)

For fine-grained per-cell fidelity (cell fills, bold headers, borders, custom per-column number formats):

```
GET /v4/spreadsheets/{id}?fields=sheets(properties,data.rowData.values(userEnteredFormat)),sheets.bandedRanges
```

or `?includeGridData=true` for the full grid. `userEnteredFormat` is the `CellFormat` resource: `numberFormat`, `backgroundColorStyle`, `borders`, `padding`, `horizontalAlignment`, `verticalAlignment`, `wrapStrategy`, `textFormat.{bold, italic, strikethrough, underline, fontFamily, fontSize, foregroundColorStyle}`. `effectiveFormat` shows conditional-rule-composed rendering (read-only).

Replay via `repeatCell` (for uniform ranges like a header row) or `updateCells` (per-cell). **Blocked today** by sidanclaw's `googleSheetsGetInfo` not accepting `fields`/`includeGridData` — see Gaps to flag upstream.

### Mode 4 — Mechanical transfer (`copyPaste PASTE_FORMAT`) — limited shortcut

`copyPaste` with `pasteType: "PASTE_FORMAT"` copies `userEnteredFormat` + data validation from source cells to destination cells 1:1 by position, with **tiling** when the destination is larger and **truncation** when smaller. It does *not* abstract — a 5-row intro block tiled across 100 rows produces nonsense.

Safe uses:

- **Header row → header row (1:1)**: shapes always match, output is clean.
- **One representative body row tiled across a uniform destination body range**: works when every body row should look the same.

Unsafe uses (use Mode 1 instead):

- Multi-row template headers, whole-sheet templating, banding-sensitive layouts, conditional rules bound to varying ranges, different column counts.

Limited to **same-spreadsheet** source + destination. Cross-file transfer requires `spreadsheets.sheets.copyTo` (not wrapped today). PasteType siblings exist (`PASTE_VALUES`, `PASTE_FORMULA`, `PASTE_DATA_VALIDATION`, `PASTE_CONDITIONAL_FORMATTING`, `PASTE_NO_BORDERS`, `PASTE_NORMAL`) but rarely beat Mode 1 for style work.

### Mode 5 — Value-based inference (last-resort fallback)

When Modes 1–4 are all unavailable (no references, cross-file, no tool lift), infer from rendered values in `googleSheetsReadRange` output: number format from strings like `"$1,234.50"`, date format from `"2026-04-24"` vs `"24 Apr 2026"`, enum vocabulary from distinct values in a column, column width proxy from max content length. Apply via `googleSheetsFormat` + targeted `repeatCell` number formats.

### Step 4 — Apply the profile

Order: **spreadsheet-wide style → tab structure → semantic shape (Table) → values → remaining polish.**

1. `googleSheetsCreate({ title })` — new sheet.
2. `googleSheetsBatchUpdate` with `updateSpreadsheetProperties` (set `spreadsheetTheme` from the reference — Mode 1). One-line `summary`: `"Apply theme from <reference name>"`.
3. `googleSheetsFormat({ freezeRows, freezeColumns, autoResizeColumns, columnWidths })` — structural defaults inherited from the reference's `gridProperties` or the baseline defaults.
4. `googleSheetsWriteRange` — headers + any seed data.
5. `googleSheetsBatchUpdate` with `addTable` — promote the header + body range to a Sheets Table (Mode 2). Carries banding + validation + auto-extend for free.
6. `googleSheetsBatchUpdate` — remaining polish: `addBanding` / `addConditionalFormatRule` rebound from the reference, `updateSheetProperties` for `tabColor`, per-column number formats via `repeatCell`. Skip any dimension the Table already handles.

Prefer `googleSheetsFormat` over raw `batchUpdate` whenever a typed option exists (auto-authorized for assistant-owned files; raw `batchUpdate` prompts on destructive kinds).

### Step 5 — Brief the user

After the last write, tell the user:

- What you created / edited and the URL.
- Which conventions you inherited ("I matched the header style and date format from your **Deals — 2026 Q1** sheet").
- One invitation to revise ("Want different column widths, or the status dropdown expanded?").

Keep it to 3–5 lines. Don't list every formatting choice — the user will see the sheet.

## Conflict resolution

Explicit user instructions override convention. Ambiguous ones ("make it look nice") fall through to convention — and say so, so the user can redirect. When an override sounds durable ("every tracker should have a yellow tab from now on"), save it via `saveMemory`; one-off overrides don't need saving.

## Defaults when no reference exists

Boring baseline — safe because invisibly correct:

- `boldHeader: true`, `freezeRows: 1`, `autoResizeColumns: true`
- `freezeColumns: 1` only when col A is an identifier (name, ID, date), else `0`
- `wrapText: false` unless a description column exists
- `dataValidations` only for columns whose header implies an enum — `Status → [Active, Paused, Done]`, `Priority → [P0, P1, P2]`; ask for any other vocabulary
- Banding / tab color / borders: **skip.** Don't add ornament uninvited.

Title the file `<Topic> — <Scope>` (e.g. `Deal Pipeline — 2026 Q2`). Never `Untitled spreadsheet`.

## Destructive operations

Any `googleSheetsBatchUpdate` request in `DESTRUCTIVE_SHEETS_REQUEST_TYPES` (`deleteSheet`, `deleteRange`, `deleteDimension`, `deleteDuplicates`, `deleteEmbeddedObject`, `deleteNamedRange`, `deleteProtectedRange`, `deleteDeveloperMetadata`) needs `allowDestructive: true` and always prompts. Write a `summary` that spells out what disappears (`"Delete sheet 'Archive' (rows A1:Z500)"`, not `"Clean up"`). Prefer non-destructive alternatives — clearing a range via `updateCells` with empty values, or renaming/archiving a tab — when the user goal allows.

## Pitfalls

1. **Skipping inspection.** One `findGDriveFiles` + one read is cheap; a mismatched sheet the user re-styles by hand is expensive.
2. **Copying reference *content* instead of *style*.** The reference is for headers, formats, and vocabulary — not last quarter's data.
3. **Inventing enum values.** If Status is `["Active", "Paused", "Done"]`, do not silently widen it. Ask.
4. **Over-polishing.** A grocery list doesn't need banding, freezes, and validations. Match the ambition of the task.
5. **Using `googleSheetsBatchUpdate` for things `googleSheetsFormat` handles.** The typed path is auto-authorized; raw `batchUpdate` prompts more.
6. **Multiple `googleSheetsFormat` calls where one would batch.** One call with every option is cheaper than several.
7. **Writing values before inheriting format.** `PASTE_FORMAT` can overwrite freshly written rows' styling. Inherit structure first, then write values.
8. **Retrying on a 404 from `googleSheetsGetInfo`.** `drive.file` scope — the user hasn't picked that file. Ask for picker consent; don't loop.
9. **Forgetting the post-write brief.** Without a one-line "inherited X from Y", the sheet just looks OK, which is indistinguishable from lucky.

## Extending this skill

Other sheets skills (CRM-tracker, meeting-notes-log, weekly-metrics) should **invoke this skill first** and then layer their domain-specific headers/columns on top. The style profile is portable; the schema is not. Keep the split clean.

## Gaps to flag upstream

Two sidanclaw tool lifts would materially increase this skill's confidence on visual polish. Record them in an issue, don't pretend the skill has them:

1. **`googleSheetsGetInfo` should accept `fields?: string` and `includeGridData?: boolean`.** The underlying `spreadsheets.get` already supports both; exposing them lets the skill read `userEnteredFormat`, `bandedRanges`, and `conditionalFormats` without any workaround.
2. **A `googleSheetsCopyTabTo` (or equivalent) wrapping `spreadsheets.sheets.copyTo`.** Enables cross-spreadsheet template duplication — the highest-fidelity way to seed a new file from a reference in another file.

Until those land, the skill's ceiling is: typed structural formatting + same-spreadsheet `copyPaste` inheritance. That's a high ceiling — but name the gap honestly rather than over-claiming.
