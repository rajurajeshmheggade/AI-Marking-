# Segmentation / Indexing Review Dialog

The Phase 1 review dialog lets a reviewer check which answer-sheet pages were mapped to which question, fix the mapping, and approve it. Its title is `segmentationLabel` — **"Segmentation"**, **"Indexing"** or **"Segmentation Indexing"** depending on which of `workflowStages.segmentation` / `workflowStages.indexing` is enabled (~L2213).

Source: `src/pages/OCREvaluation.tsx` — dialog JSX `<Dialog open={!!phase1ReviewCandidate}>` (~L13280–L14271), Blank Pages dialog (~L14274), handlers `handleOpenPhase1Review` (~L6417), `fetchProcessDataForCandidate` (~L6492), `handleAssignPagesToQuestion` (~L7624), `untagImage` (~L7244), `moveImageToPagesToReview` (~L7284), `moveBlankPageToReview` (~L7392), `reorderPhase1Pages` (~L7434), `savePhase1Mapping` (~L7481), `handlePhase1Approve` (~L7701).

Back to [overview](./user-review-and-evaluation.md).

---

## 1. Opening the dialog

**Trigger:** clicking the Phase 1 badge in the candidate table (clickable when phase1 ∈ completed/pending/approved). See [user-candidate-table.md](./user-candidate-table.md).

`handleOpenPhase1Review(candidate, requestType = 1)`:

1. `setPhase1RequestType(1)`; sets `phase1ActiveFetchKeyRef = "<reg>::1"`.
2. Clears dialog state: `phase1IndexingRecord`, `answerSheets`, `ocrExtractedTextByQuestion`, `standardsEvaluation`, `standardsSummary`; `phase1ViewMode='question'`, `activeQuestionIndex=0`, `phase1VisitedQuestions={0}`, `activeAnswerSheetIndex=0`, `zoomLevel=50`.
3. **Segmentation-only branch** (`isSegmentationOnly` = segmentation on and indexing/ocr/evaluation all off): calls `loadSegmentationOnlyPages` instead of process data (see §6), then opens.
4. **Normal branch:** `await fetchProcessDataForCandidate(candidate, 1)`, then `setPhase1ReviewCandidate(candidate)` (dialog opens after data arrives, also on failure).

A `useEffect` (~L6955) refetches if the dialog is open but `phase1IndexingRecord.registration_number` differs from the candidate (skipped for Segmentation-only).

### Request

```text
GET {API_BASE1}/get-process-data
params: orgcode, custcode='ICME', usercode, type=1, registernumber,
        subjectcode ('generic' when localStorage.standalone_mode==='1'),
        workspaceid (number), adstatus=0
```

`orgcode` = `sessionStorage.orgCode || orgcode || 'ICME01'`; `usercode` = `sessionStorage.userCode || usercode || 'icmeuer01'`; `subjectcode` from `resolveSubjectCode()`; `workspaceid` from `selectedWorkspace.id` or `sessionStorage.workspaceid`.

### Response handling (type 1)

Envelope: `res.data.data[0]`; process object = `envelope.processData ?? envelope.processdata`, else the whole `res.data`.

| Response field | Transformation | Stored in |
|---|---|---|
| `segmentdata[] {Qid, imagepath[]}` (legacy) and `segment_data[] {qid, image_path[]}` (Jan-2026) | Merged; per question key a de-duplicated array of trimmed paths | `question_page_mapping[<qid>]` |
| `blank_pages[]` | as-is | `question_page_mapping.blank_pages` |
| `noqMarker[]` | as-is | `question_page_mapping.noqMarker` |
| `pages_to_review[]` (strings or `{path, reason}` objects) | strings kept; objects reduced to `.path` | `question_page_mapping.pages_to_review`; full array also in `pages_to_review_data` (used for the red **Reason** box) |
| `auto_mapped_pages`, `total_pages`, `status` | as-is | `question_page_mapping.*` |
| `registration_number`, `orgcode`, `custcode`, `subjectcode`, `workspace`/`workspace_id`/`workspaceid` | fallback to request values | `SegmentationIndexingApiRecord` |
| `unanswered_questions` / `unansweredQuestions`, `questions_answered` | stringified / numeric | record |
| `ocr_extracted_text`, `standards_evaluation`, `summary` | also stored (shared state with OCR dialog) | `ocrExtractedTextByQuestion(Raw)`, `standardsEvaluation`, `standardsSummary` |

- Stale response (key ≠ `phase1ActiveFetchKeyRef`) is discarded.
- `setPhase1IndexingRecord(record)` **and** a deep copy into `phase1OriginalIndexingRecord` (baseline for "changed?" checks).
- `answerSheets` = `buildAnswerSheetsFromPaths(mapping[<active question key>])` — each page gets `imageUrl = toDisplayableImageUrl(path)` (relative repo paths are prefixed with `IMAGE_BASE`; Windows/UNC paths become `file://` URLs), `label` = file name.

| Failure | UI |
|---|---|
| `res.data` empty | `toast.error('Empty segmentation response')`, record cleared |
| HTTP/network error | `toast.error('Failed to load segmentation data')`, record and pages cleared |
| Aborted (`CanceledError`) | silent |

---

## 2. UI structure

```text
Dialog (95vw × 95vh, no default close button)
├─ Header
│  ├─ Title: <Image icon> {segmentationLabel}
│  ├─ [quickApprove && !isSegmentationOnly] Progress "N/M reviewed" + bar
│  ├─ [quickApprove && !isSegmentationOnly] Approve button
│  ├─ [isSegmentationOnly] Download (ZIP of all pages)
│  └─ Close (X)  tooltip "Close segmentation dialog"
├─ Mobile question strip (md:hidden; hidden when isSegmentationOnly)
│  ├─ Question circles 1..N (amber = no pages, teal = has pages, ✓ = visited)
│  ├─ "To review" pill (only when unassigned pages_to_review exist)
│  └─ Prev / Next arrows
├─ Desktop left rail (hidden when isSegmentationOnly; narrow in Standalone Mode)
│  ├─ Header: "Questions" + visited count + progress bar
│  ├─ Question buttons (text, or "Q{n} · k page(s)" in Standalone Mode)
│  ├─ "R  Pages to review · k page(s)"   (when unassigned review pages exist)
│  └─ "NQ No Question Marker · k page(s)" (when unassigned NQ pages exist)
└─ Right content
   ├─ Candidate name + ⋮ menu → "Blank Pages (n)"   (menu hidden when isSegmentationOnly)
   ├─ [quickApprove && question view && !isSegmentationOnly] Reposition panel
   │   ├─ one or more "Select page" dropdowns (allPageOptions)
   │   │   └─ "Assigned to Qx, …" + Untag (when owned by active question)
   │   └─ Reposition button
   ├─ Active question card (hidden for Segmentation-only and Standalone Indexing-only)
   │   └─ Q label / R / NQ, question text or parts with marks, Max Score or Type
   └─ Answer sheet viewer
       ├─ Toolbar: "Page i of n" · Zoom −/+ (25–300 %, step 25) · [Seg-only] Download page · Fit (fullscreen popup) · Prev/Next page
       ├─ Image area (width = zoom %) · red "Reason" box in Pages-to-review view · orange "Not answered / Not tagged" when no pages
       └─ Quick Nav column: one tile per page (drag to reorder, ✕ = Move to Pages to Review)
```

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/segmentation-review-dialog.png — Indexing dialog with Quick Approve on: left rail with R/NQ entries, Reposition panel, page viewer and Quick Nav]

---

## 3. View modes

`phase1ViewMode`: `'question' | 'pages_to_review' | 'noqMarker'`.

| Mode | Entered by | Pages shown | Card label |
|---|---|---|---|
| `question` | clicking any question button (sets mode back to `question`) | `mapping[<qKey>]` (effect ~L7084 rebuilds on question change) | `Q{index+1}`, question text, Max Score |
| `pages_to_review` | "R" rail button / "To review" pill | `pages_to_review` minus any page assigned to a numeric question; reasons from `pages_to_review_data` | `R`, "Pages to review", Type: Review |
| `noqMarker` | "NQ" rail button (desktop only — no mobile pill) | `noqMarker` (from mapping or top-level record) minus assigned and minus review pages | `NQ`, "No Question Marker" |

The question key is `getQuestionKey(question.id, index)` = first run of digits in the id, else `index+1`.

---

## 4. Buttons and controls

### 4.1 Header

| Control | Visible | Disabled | Handler | Effect |
|---|---|---|---|---|
| **Approve** | `phase1ReviewCandidate.quickApprove && !isSegmentationOnly` | `phase1ApproveSaving \|\| phase1Loading` | `handlePhase1Approve` | See §5 |
| **Download** | `isSegmentationOnly` | `downloadingAllImages \|\| phase1Loading \|\| answerSheets.length === 0` | `downloadAllSegmentationImages` (~L2339) | Fetches each page via `fetchImageBlob`, zips with JSZip, saves `<registration>.zip`. Toasts: success "Downloaded N image(s)", error "Failed to download images", "No segmented images available." |
| **Close (X)** | always | — | inline | Clears `phase1ActiveFetchKeyRef`, `phase1Loading`, candidate, record, pages, question index, visited set. No save. |

The dialog has no `onOpenChange`; it closes only via the X button.

### 4.2 Navigation

| Control | Rule |
|---|---|
| Question button (rail / mobile circle) | Quick Approve OFF → always clickable. ON → current, previous, or next **if current already visited**. Click sets view `question`, index, adds to visited. |
| Mobile **Next** arrow | Disabled at last question or when current not visited — applied regardless of Quick Approve (desktop rail uses the Quick Approve rule). |
| Mobile **Prev** arrow | Disabled at first question. |
| Page **Prev/Next** | Disabled at bounds or when no pages; resets zoom to 50 %. |
| Zoom − / + | 25 %…300 %, step 25. |
| **Fit** | Opens the shared image popup (`popupImage`, ~L13183) at 100 % with label = file name and `sourcePath`. The popup refuses to load Windows/UNC/`file://` paths and shows "Unable to load the mapped image" with the source path. |

### 4.3 Mapping edits (all require Quick Approve; otherwise `toast.error('Enable Quick Approve to edit mappings')` or the control is hidden)

| Control | Visible | Handler | Validation / toasts | State change | Persistence |
|---|---|---|---|---|---|
| **Select page** dropdown(s) | Reposition panel | `updateRepositionSelection` | — | `repositionSelections[i]` | — |
| Options list | — | `allPageOptions` (memo ~L7167) | Lists every mapped page + blank pages, de-duplicated, **excluding** blank pages and pages already on the active question (selected values are always kept visible). Label = decoded file name. | — | — |
| ✕ next to a dropdown | more than one row | `removeRepositionRow` | — | removes row | — |
| "Assigned to Qx…" + **Untag** | a selected page is owned by some key; Untag only if owned by the active question | `untagImage(path)` | "No segmentation data available"; success "Image untagged"; not found "Image not assigned" | Removes path from active question; rebuilds `answerSheets` | `savePhase1Mapping(newRecord)` (local only) |
| **Reposition** | Reposition panel | `handleAssignPagesToQuestion` | Duplicate selection → "Please remove duplicate selections. The same image cannot be assigned multiple times."; none → "Please select at least one page"; success "Pages assigned to question" | Merges selected pages into active question (keeps existing); removes them from `pages_to_review` and `noqMarker` (also top-level `noqMarker`); resets rows to `['']` | `savePhase1Mapping` (local only) |
| Quick Nav **drag & drop** | `answerSheets.length > 1 && quickApprove` | `reorderPhase1Pages(from, to)` | — | Reorders the array under the current key (`pages_to_review`, `noqMarker` or question); keeps selected page active | `savePhase1Mapping` (local only) |
| Quick Nav **✕** (Move to Pages to Review) | active tile, not in Pages-to-review view, has `sourcePath`, Quick Approve | `moveImageToPagesToReview(path)` | If page also tagged to other questions: only detached from active key → "Removed from this question. Still tagged to Question x, y."; else "Moved image to pages to review" | Removes from question keys (or only active key); appends to `pages_to_review` unless blank or still tagged elsewhere; refreshes visible list for the current view | `savePhase1Mapping` (local only) |
| Blank Pages ✕ ("Not blank - move to Pages to Review") | Blank Pages dialog, Quick Approve | `moveBlankPageToReview(path)` | "Moved to Pages to Review. Tag it to a question, then Approve to save." | Removes from `blank_pages`, appends to `pages_to_review` | **Not** persisted to sessionStorage (no `savePhase1Mapping` call) |

`handleRepositionPages`, `handleReorderPage`, `addRepositionRow` exist in source but are not referenced by any JSX.

### 4.4 Blank Pages dialog (~L14274)

Opened from the ⋮ menu. Grid of `question_page_mapping.blank_pages` thumbnails (`toDisplayableImageUrl`). Page number derived from file name (`page_N`/`pg_N` or first digits); **page 1 is never shown**. Clicking a tile opens the image popup. Closes with X or Close (outside click ignored). Empty state: "No blank pages found".

---

## 5. Approve — `handlePhase1Approve` (~L7701)

### 5.1 Pre-checks (in order; each aborts with a toast)

| # | Check | Toast |
|---|---|---|
| 1 | `question_page_mapping.noqMarker` non-empty | error "Please tag all No Question Marker pages before approving." |
| 2 | `sessionStorage['icme_ocr.phase1.mapping.<ws>.<reg>']` must exist and contain ≥1 tagged image on some question | error "Please Modify at least one image to a question before approving." |
| 2b | sessionStorage read throws | error "Unable to verify mapping; please try again." |
| 3 | `normalizeQuestionPageMapping(current) === normalizeQuestionPageMapping(original)` (key-order and page-order insensitive) | warning "No changes made. Please update the page mapping before approving." |

Consequence: an **unchanged mapping cannot be approved**. Check 2 is satisfied only after at least one edit that calls `savePhase1Mapping` (Reposition, Untag, drag-reorder, Move to Pages to Review) in this browser session.

### 5.2 API sequence

```text
1  POST {API_BASE}/save-indexing-info            (savePhase1Mapping(record, true))
2  GET  {API_BASE1}/get-config-info?OrgCode&CustCode&AppCode=AImarking   (fetch, no-store)
   └─ if latest workflowStages.ocr is true  (skipOcrAndEvalSync = !ocr):
3     GET  {API_BASE1}/get-process-data  type=2  (no-cache headers)
4     POST {API_BASE}/save-ocr-data              (OCR text rebuilt for the new mapping)
5     POST {API_BASE}/recalculate-standards      (skipped when standaloneMode)
6     [cleanup] GET get-process-data type=3 → POST {API_BASE}/save-evaluation-data
7  POST {API_BASE}/update-status  {type:1, status:1}   (always attempted)
8  GET  get-process-data type=1   (refresh dialog)
9  candidate-process-data         (loadCandidatesForWorkspace silent refresh)
```

`setPhase1ApproveSaving(true)` for the whole sequence → full-screen loader.

**Step 1 — `save-indexing-info` payload** (`savePhase1Mapping`, ~L7565):

```json
{
  "orgcode": "...", "custcode": "ICME", "usercode": "...",
  "type": 1,
  "registrationnumber": "...", "subjectcode": "...", "workspaceid": 123,
  "metstandardcount": 0,
  "is_review": 1,
  "indexdata": {
    "status": "completed", "orgcode": "...", "custcode": "ICME", "is_update": 0,
    "workspace_id": 123,
    "blank_pages": ["..."],
    "segment_data": [{ "qid": 1, "image_path": ["..."], "segment_id": [0] }],
    "subjectcode": "...",
    "total_pages": 12,
    "pages_to_review": ["..."],
    "total_questions": 8,
    "auto_mapped_pages": 10,
    "questions_answered": 7,
    "unanswered_questions": ["5"]
  }
}
```

| Field | Derivation |
|---|---|
| `segment_data` | numeric keys of the mapping with ≥1 path, sorted by qid; `segment_id` always `[0]` |
| `unanswered_questions` / `questions_answered` / `total_questions` | recomputed from the current mapping against the `questions` list (not from the API record) |
| `total_pages` | `mapping.total_pages` if > 0, else (sum of mapped paths + blank pages) |
| `auto_mapped_pages` | `mapping.auto_mapped_pages` if ≥ 0, else sum of mapped paths |
| `metstandardcount` | `phase1ReviewCandidate.standardsMet.met` coerced to an integer (0 if absent) |
| `is_review` | `1` when `pages_to_review` non-empty, else `0` |

Payload passes through `sanitizePayload` (strips `\x00`). On success `toast.success('Mappings saved')`; on failure `toast.error('Failed to save mappings')` and approval aborts. In Quick Approve mode the save is skipped when the mapping JSON equals the original — but that path is unreachable because pre-check 3 already rejected unchanged mappings.

**Steps 3–6 — OCR sync** (only when the freshly fetched `workflowStages.ocr` is true; falls back to in-memory `workflowStages` if config fetch fails):

1. Fetch type 2 process data.
2. Flatten existing OCR into `imageToText[path]` (first occurrence wins; rich objects reduced to `.transcription`).
3. Rebuild `ocr_extracted_text` from the **new** mapping: for each question and each mapped image, text = the question's own entry for that image (`readQuestionOcrText`) → else any text for that image → else `''`.
4. Write `sessionStorage['icme_ocr.phase2.ocr.<ws>.<reg>']`.
5. `POST save-ocr-data`:
   ```json
   { "custcode", "orgcode", "usercode", "registrationnumber", "workspaceid",
     "ocrdata": { "summary": {...}, "ocr_extracted_text": {"1": {"<path>": "text"}}, "standards_evaluation": {...} },
     "remainingcount", "totalcandidatecount", "scriptpath" }
   ```
   `summary` / `standards_evaluation` from the type 2 response, else from dialog state; the three counters from the type 2 envelope (`remainingCount`, `totalCandidateCount`, `scriptPath`).
6. `recalcQuestions = getChangedQuestionNumbersFromMappings(current, original)`; `recalcQuestionsWithImages` = those still having images in the rebuilt OCR.
   - If **not** `standaloneMode`: `postRecalculateStandards({isall: withImages.length ? 0 : 1, questions: withImages, userprompt: '', processdata: ocrdata, …})`. `postRecalculateStandards` (~L852) further filters `questions` to ones present in `processdata.ocr_extracted_text` and returns `null` (no request) if `isall=0` and nothing remains.
   - Cleanup: if some changed questions lost all images (mixed case) **or** no changed question has images → `GET get-process-data type=3` then `saveFilteredEvaluationDataWithoutImagePaths` → `POST save-evaluation-data` with eval_data restricted to questions that still have image paths, re-ranked, and `final_score.obtained_score` recomputed with Top-N (see [evaluation review §6](./user-evaluation-review.md#6-rank-and-total-recomputation)).

All errors in steps 3–6 are caught and logged with `console.warn` only ("Indexing saved but OCR sync failed", "OCR saved but recalculation failed", "Failed to save filtered evaluation data…"). The related toasts are commented out — **the user is not told**.

**Step 7 — `update-status`** `{ registrationnumber, workspaceid, type: 1, status: 1 }`. Failure → `console.warn` only.

**Local state after success:** candidate row `phase1='approved'`, `rawApprovedStatus=1`, `answerSheets` copied; same on `phase1ReviewCandidate`; `toast.success('<segmentationLabel> approved for <candidateName>')`. The dialog **stays open** and is refreshed (step 8), then the table is silently reloaded (step 9).

Any uncaught error → `toast.error('Failed to approve. Please try again.')`.

---

## 6. Segmentation-only mode

When only Segmentation is enabled:

- No process data is fetched. `loadSegmentationOnlyPages` calls `GET {API_BASE1}/get-candidate-info?registrationnumber&workspaceid`, reads `scriptPath`, and probes `IMAGE_BASE/<scriptPath>/1.png, 2.png, …` with `Image()` in batches of 10 (max 300), stopping at the first missing page (`probeSequentialImages`, ~L2232).
- Rail, mobile strip, question card, ⋮ menu, Reposition panel and Approve are hidden; header shows **Download** (ZIP) and the toolbar gets a per-page **Download** button.
- Empty result → `toast.error('No segmented images available.')`; failure → `toast.error('Failed to load candidate information')`.
- `fetchImageBlob` tries the absolute URL first and, only in dev (`import.meta.env.DEV`), the same-origin path (Vite proxy). A `TypeError` is reported as a CORS message.

---

## 7. Conditional rendering summary

| Element | Condition |
|---|---|
| Approve | `quickApprove && !isSegmentationOnly` |
| Progress indicator | `quickApprove && !isSegmentationOnly` |
| Download (header) | `isSegmentationOnly` |
| Left rail / mobile strip | `!isSegmentationOnly` |
| Rail width / entry layout | narrow `w-20` with "Q{n} · k page(s)" in Standalone Mode |
| R entry | `phase1IndexingRecord` and ≥1 `pages_to_review` path not assigned to a question |
| NQ entry | ≥1 `noqMarker` path not assigned and not in review list (desktop only) |
| ⋮ Blank Pages menu | `!isSegmentationOnly` |
| Reposition panel | `quickApprove && !isSegmentationOnly && viewMode === 'question'` |
| Question card | `!isSegmentationOnly && !isStandaloneIndexingOnly` |
| Question text | not Standalone Mode |
| "Not answered / Not tagged" | record loaded and no pages for current view |
| Reason box | Pages-to-review view and the page has a `reason` |
| Quick Nav ✕ | active tile, not review view, has `sourcePath`, Quick Approve |
| Drag handles | >1 page and Quick Approve |

---

## 8. Storage keys

| Key | Store | Written | Read |
|---|---|---|---|
| `icme_ocr.phase1.mapping.<workspaceid>.<registrationnumber>` | sessionStorage | every `savePhase1Mapping` call: `{question_page_mapping, savedAt, pending}` | `handlePhase1Approve` pre-check 2 |
| `icme_ocr.phase2.ocr.<workspaceid>.<registrationnumber>` | sessionStorage | OCR sync in approve | OCR review approve |
| `icme_ocr.quickApprove.<workspaceid>` | sessionStorage | Quick Approve toggle | candidate load |
| `standalone_mode`, `workflowStages` | localStorage | config fetch | subject code, stage flags |

None of the `icme_ocr.phase*` keys are cleared on close, approval or logout.

See also: [OCR review](./user-ocr-review.md) · [API mapping](./user-api-mapping-review.md) · [workflow](../workflows/review-and-approval-workflow.md).
