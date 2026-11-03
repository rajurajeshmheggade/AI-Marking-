# OCR Review Dialog ("OCR Preview")

The OCR Preview dialog shows, per question, each answer-sheet image (or audio recording) mapped to that question beside its extracted OCR text, lets a reviewer correct the text, and approves the OCR stage.

Source: `src/pages/OCREvaluation.tsx` — `<Dialog open={!!ocrReviewCandidate}>` (~L12437–L13073), handlers `handleOpenOcrReview` (~L6120, non-standalone branch), `fetchProcessDataForCandidate` (~L6492), `mapOcrExtractedToSegments` (~L5274), `commitOcrEdit` (~L5225), `handleApprove` (~L8128), helpers `getChangedQuestionNumbersFromOcrText` (~L769), `postRecalculateStandards` (~L852), `saveFilteredEvaluationDataWithoutImagePaths` (~L3439).

In **Standalone Mode with OCR as the only stage**, the same badge opens a different popup — see [user-standalone-ocr-review.md](./user-standalone-ocr-review.md).

Back to [overview](./user-review-and-evaluation.md).

---

## 1. Opening the dialog

**Trigger:** OCR badge in the candidate table (clickable when phase2 ∈ completed/pending/approved and `noqMarker ≠ 1`).

`handleOpenOcrReview(candidate)` (non-standalone path):

1. `ocrActiveFetchKeyRef = "<reg>::2"`.
2. Clears: `phase1IndexingRecord`, `answerSheets`, `ocrExtractedTextByQuestion`, `standardsEvaluation`, `standardsSummary`, `editedSegmentData`, `editedOcrData`; `phase2VisitedQuestions={0}`, `ocrActiveQuestionIndex=0`; `resetOcrSegmentEditingState()` (clears `editingSegmentId`, `editedSegmentOcrText`, `segmentOcrTexts`).
3. `await fetchProcessDataForCandidate(candidate, 2)` → then `setOcrReviewCandidate(candidate)`, `setIsEditing(false)`.

### Request

```text
GET {API_BASE1}/get-process-data
params: orgcode, custcode='ICME', usercode, type=2, registernumber,
        subjectcode ('generic' in Standalone Mode), workspaceid, adstatus=0
```

### Response handling (type 2)

Same envelope parsing as type 1 (`data[0].processData ?? processdata`, else `res.data`). In addition to the page mapping (stored in `phase1IndexingRecord`):

| Response field | Transformation | State |
|---|---|---|
| `data[0].candidateId`, `workspaceid`, `remainingCount`, `totalCandidateCount`, `scriptPath` (camel or lower case) | numbers / string | `ocrSaveMeta` (sent back on save) |
| `processData.ocr_extracted_text` `{ "<qid>": { "<rawImagePath>": string \| richObject } }` | For each entry: `url = toDisplayableImageUrl(rawPath)`; value kept as-is (string or object) | `ocrExtractedTextByQuestion[q][url]` (display), `ocrExtractedTextByQuestionRaw[q][rawPath]` (save), deep copy → `ocrOriginalExtractedTextByQuestionRaw`, `ocrImageUrlToRawPathByQuestion[q][url] = rawPath` |
| `standards_evaluation` | as-is | `standardsEvaluation` |
| `summary` (object) | as-is | `standardsSummary` |

A rich object has the `ExtractionResult` shape written by the standalone create flow (`transcription`, `blocks`, `figure_counts`, `tokens`, `subject`, `issues`, `transcription_latex`, `interpretation`, …). The OCR Preview dialog only reads `transcription` from it.

Errors: same as type 1 — `toast.error('Failed to load segmentation data')` / `'Empty segmentation response'`.

---

## 2. UI structure

```text
Dialog (95vw × 95vh)
├─ Header
│  ├─ Title: <ScanLine> "OCR Preview"
│  ├─ [Approve condition] "N/M reviewed" progress + Approve button ("Saving..." spinner while saving)
│  └─ Close (X) tooltip "Close OCR review dialog"
├─ Mobile question strip (circles: amber current, teal visited ✓, amber-outline = no OCR) + Prev/Next
├─ Desktop left rail ("Questions", visited N/M, progress bar; question text hidden in Standalone Mode)
└─ Right content (scroll)
   ├─ Candidate name · "Standard's evaluation credits : marks/max"  (standardsSummary && ocrConfig.StandardsMetCount !== false)
   ├─ Active question card: Q{id}, text or parts (hidden in Standalone Mode), Max Score
   │   └─ Credits / Expand / Collapse button (standards per question)
   ├─ [expanded] "Standards Evaluation (1–4)": standard_1…standard_4 with Credit or "Not evaluated" + reason
   └─ One card per image segment of the active question
       ├─ Header: #id · file name · [quickApprove] Update | Save + Cancel
       ├─ Left: "Answer Sheet Segment" <img> (click → fullscreen popup) OR "Answer Recording" <audio>
       └─ Right: "Extracted OCR Text" <pre> or <Textarea> while editing
```

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/ocr-review-dialog.png — OCR Preview with one image segment in edit mode and the Standards credits expanded]

### Segment list for the active question

```text
activeQuestionKey = getQuestionKey(questions[ocrActiveQuestionIndex].id, index)
segments = ocrExtractedTextByQuestion
             ? mapOcrExtractedToSegments(activeQuestionKey)    // one per image URL
             : candidate.segmentImages || generateMockSegmentImages()   // mock fallback
```

`mapOcrExtractedToSegments` yields `{id: idx+1, imageUrl, label: fileName, ocrText: transcription, ocrBlocks, ocrFigureCounts, ocrTokens, ocrSubject, ocrIssues}`. Note the **mock fallback**: when `ocr_extracted_text` is absent entirely, three bundled sample images with sample text (`generateMockSegmentImages`, ~L5298) are rendered.

Displayed text per segment = `segmentOcrTexts["<qKey>::<imageUrl>"] ?? segment.ocrText`.

An audio segment (`label` or `imageUrl` ends in `.mp3`/`.wav`) renders `<audio controls controlsList="nodownload noplaybackrate">` with the context menu blocked.

### Empty states (no segments for the question)

| Condition | Message |
|---|---|
| Mapping loaded and no pages mapped for the question | orange "Not answered / Not tagged — No pages mapped for this question." |
| Mapping has pages but no OCR segments | amber "Unable to load the mapped image(s)…" (local Windows path hint) |
| Otherwise | "No data found — No images or OCR text available for this question." |

### Standards credits

Hidden when there are no segments or `apiConfig.ocrConfig.StandardsMetCount === false`. Button label: "Collapse" when open; "Credits : `<standards_evaluation[q].marks_awarded>`" when data exists; else "Expand". The four criteria texts come from the constant `OCR_STANDARDS_EVALUATION_CRITERIA` (~L42); each row reads `standards_evaluation[q].standards_met[standard_n].marks ?? marks_awarded` and `.reason`.

---

## 3. Controls

| Control | Visible | Disabled | Handler / effect |
|---|---|---|---|
| **Approve** | `quickApprove && (phase2 === 'pending' \|\| (phase2 !== 'approved' && rawOcrStatus !== 3))` — effectively: Quick Approve on and not yet approved locally | `ocrApproveSaving` | `handleApprove` (§4) |
| **Close (X)** | always | — | Clears `ocrActiveFetchKeyRef`, `phase1Loading`, candidate, `isEditing`, index, visited, `editingSegmentId`, `segmentOcrTexts`, both OCR maps, URL→path map, `ocrSaveMeta`, standards, pages, record. **Unsaved edits are discarded without warning.** |
| Question button / circle | always | Quick Approve ON: only current, previous, or next-after-visited | sets index, `resetOcrSegmentEditingState()`, adds to visited |
| Prev / Next (mobile) | always | bounds; Next also when Quick Approve ON and current not visited | same |
| **Update** (per segment) | `quickApprove` and not editing this segment | — | `editingSegmentId = "<qKey>::<imageUrl>"`, `editedSegmentOcrText = current text` |
| **Save** (per segment) | editing this segment | `!editedSegmentOcrText.trim()` (empty text cannot be saved) | `commitOcrEdit(qKey, imageUrl, text)` → updates display map and raw map (raw only if a raw path is known); `segmentOcrTexts[key] = text`; exits edit; `toast.success('OCR text for <label> saved')` (local only — no API) |
| **Cancel** (per segment) | editing | — | exits edit, clears draft |
| Image click | image segments | — | `setPopupImage({url, label})`, zoom 100 % |
| Credits / Expand / Collapse | see above | — | toggles `questionCompactOpen` |

Switching question resets any in-progress edit (draft lost). `handleUpdate`, `handleSaveEdits`, `handleCancelEdits` (~L8087–L8126) are not referenced by JSX.

---

## 4. Approve — `handleApprove` (~L8128)

### 4.1 Auto-commit

If a segment is still in edit mode with non-empty text, it is committed first (same as Save) and written to `sessionStorage['icme_ocr.phase2.ocr.<ws>.<reg>']`.

### 4.2 Pre-checks

| # | Check | Toast |
|---|---|---|
| 1 | `ocrExtractedTextByQuestionRaw` is null | error "No OCR extracted text available to save." |
| 2 | Neither sessionStorage OCR key has entries nor the in-memory raw map has any image | error "No OCR edits found. Please update OCR text before approving." |
| 3 | No actual edit: `segmentOcrTexts` empty **and** every current transcription equals the original (rich objects compared by `.transcription`). If no original was captured, treated as edited. | warning "OCR data has not been edited. Please edit the OCR data before approving." |
| 3b | sessionStorage read throws | error "Unable to verify OCR edits; please try again." |

As with Phase 1, **unedited OCR cannot be approved**. Saving a segment with unchanged text still counts as an edit (check 3 looks only at `segmentOcrTexts` being non-empty first).

### 4.3 API sequence

```text
1  GET  {API_BASE1}/get-process-data type=1  (no-cache)      → current indexing mapping
2  POST {API_BASE}/save-ocr-data                                → status must be 200/201/204
3  POST {API_BASE}/recalculate-standards                        (skipped when standaloneMode)
4  [cleanup] GET get-process-data type=3 → POST {API_BASE}/save-evaluation-data
5  POST {API_BASE}/update-status {type:2, status:1}
6  GET  get-process-data type=2  (refresh dialog)
7  candidate-process-data (silent table refresh)
```

**Step 1 — align to indexing.** Reads `segment_data[] {qid, image_path[]}` from the type 1 response. If non-empty, `ocr_extracted_text` is rebuilt so that every `(qid, image)` in the indexing mapping gets: that question's own text for the image (`readQuestionOcrText`) → else any question's text for that image → else `''`. Questions/images not in `segment_data` are dropped. If `segment_data` is empty or the call fails (`console.warn`), the raw map is sent as-is.

> Rich objects are flattened: the aligned map holds **plain strings** (`.transcription` only). Saving through this dialog therefore discards `blocks`, `figure_counts`, `tokens`, `transcription_latex`, `interpretation`, etc. for every image of the candidate. In the fallback path (raw map sent as-is), edited images are strings and untouched images keep their objects.

**Step 2 — `save-ocr-data` payload:**

```json
{
  "custcode": "ICME", "orgcode": "...", "usercode": "...",
  "registrationnumber": "...", "workspaceid": 123,
  "ocrdata": {
    "summary": { },
    "ocr_extracted_text": { "1": { "<rawImagePath>": "corrected text" } },
    "standards_evaluation": { }
  },
  "remainingcount": 0, "totalcandidatecount": 10, "scriptpath": "..."
}
```

`summary`/`standards_evaluation` come from dialog state (`standardsSummary`/`standardsEvaluation`, from the type 2 load); counters from `ocrSaveMeta`. Passed through `sanitizePayload`. Response codes are **not** inspected (no S001/S002 check here — unlike the create-workspace flow). Non-2xx status → `toast.error('Failed to save OCR data (status N)')` and stop; thrown error → `toast.error('Failed to save OCR data. Please try again.')`.

**Step 3 — recalculate standards.** `recalcQuestions = getChangedQuestionNumbersFromOcrText(raw, original)` (numeric question keys whose sorted `(path, text)` entries differ); `withImages` = those present in the saved `ocr_extracted_text`. When `!standaloneMode`:

```json
POST recalculate-standards
{ "orgcode","custcode","usercode",
  "isall": 0 | 1,           // 0 when withImages non-empty
  "registrationnumber","subjectcode","workspaceid",
  "questions": [2, 5],
  "userprompt": "",
  "processdata": { ...ocrdata } }
```

`postRecalculateStandards` skips the request (returns `null`) when `isall=0` and no requested question has images.

**Step 4 — cleanup** (same rule as Phase 1): when some changed questions have no images (mixed) or none have images → fetch type 3 → `saveFilteredEvaluationDataWithoutImagePaths` → `save-evaluation-data` with eval_data limited to questions that still have pages, re-ranked and Top-N total recomputed. Errors → `console.warn` only.

**Step 5 — `update-status`** `{registrationnumber, workspaceid, type: 2, status: 1}`. Failure → `toast.error('Recalculation succeeded but updating status failed. Please try again.')`.

Steps 3–5 share one `try`: if recalculation throws, `toast.error('OCR saved, but recalculation failed. Please try again.')` and **update-status is skipped**, yet the code continues to mark the candidate approved locally (below).

**Local state after save:** candidate row and `ocrReviewCandidate` get `phase2='approved'` (+ `segmentData`/`ocrData` from the legacy edit fields); `isEditing=false`; `toast.success('OCR approved and saved for <name>')`. The dialog stays open, re-fetches type 2 (resetting the "original" baseline) and the table refreshes silently. Because the Approve visibility condition becomes false after local approval, the button disappears until the dialog is reopened.

`ocrApproveSaving` drives the button spinner and the full-screen loader.

---

## 5. Data transformations summary

| Stage | From | To |
|---|---|---|
| Load | `ocr_extracted_text[q][rawPath]` | display map keyed by URL, raw map keyed by raw path, URL→raw-path map, original copy |
| Edit | Textarea | `commitOcrEdit` writes the string into both maps (raw only when the URL→path lookup succeeds) |
| Approve | raw map + type 1 `segment_data` | aligned `{q: {path: string}}` (rich objects flattened) |
| Recalc scope | raw vs original | changed question numbers ∩ questions with images |

## 6. Storage keys

| Key | Written | Read |
|---|---|---|
| `sessionStorage['icme_ocr.phase2.ocr.<ws>.<reg>']` | auto-commit in approve; Phase 1 approve OCR sync | approve pre-check 2 |

Never cleared; a value from an earlier visit can satisfy pre-check 2 (pre-check 3 still applies).

See also: [Segmentation / Indexing review](./user-segmentation-indexing-review.md) · [Evaluation review](./user-evaluation-review.md) · [API mapping](./user-api-mapping-review.md) · [Components](../components/ocr-components.md).
