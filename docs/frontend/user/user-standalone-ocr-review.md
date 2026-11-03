# Standalone OCR Review Popup

In **Standalone Mode** with **OCR as the only enabled stage**, clicking a candidate's OCR badge opens a read-mostly "OCR Review" popup instead of the OCR Preview dialog. It shows every page image of the candidate with the saved AI transcription result rendered in five tabs.

Source:

- `src/pages/OCREvaluation.tsx` → `handleOpenOcrReview` standalone branch (~L6120–L6193), popup mount (~L17652)
- `src/pages/StandaloneOCREvaluation.tsx` → `StandaloneOCREvaluation`
- `src/components/ocr/ScriptExtractorPanel.tsx` → `ScriptExtractorPanel`, `segmentToResult`, `findLatexStartIndex`
- `src/components/ocr/ExtractionOutputTabs.tsx` → `ExtractionOutputTabs`, `DtgBar`, `ExtractionLoader`
- `src/components/ocr/ImageInspectorModal.tsx` → `ImageInspectorModal`
- `src/lib/extraction.ts` → `runExtraction`, `urlToFile`, `DEFAULT_ENDPOINT`, `DEFAULT_OPTIONS`

Back to [overview](./user-review-and-evaluation.md).

---

## 1. When this popup is used

```text
isStandaloneMode   = localStorage.standalone_mode === '1'
isStandaloneOcrOnly = isStandaloneMode && ocr && !segmentation && !indexing && !evaluation
                     (from effectiveWorkflowStages)
```

If `isStandaloneOcrOnly` is false, `handleOpenOcrReview` falls through to the normal [OCR Preview dialog](./user-ocr-review.md).

The saved records it displays are produced by the standalone "Create & Extract" flow (documented in [user-create-workspace-and-upload.md](./user-create-workspace-and-upload.md)), which calls the same `runExtraction` and stores each `ExtractionResult` object under `ocr_extracted_text["1"]["<scriptPath>/<file>"]`.

---

## 2. Data load (`handleOpenOcrReview`, standalone branch)

```text
setPhase1Loading(true)   → full-screen PageLoader
GET {API_BASE1}/get-process-data
    params { orgcode: sessionStorage.orgCode || '', custcode: 'ICME',
             usercode: sessionStorage.userCode || '', type: 2,
             registernumber, subjectcode: 'generic', workspaceid: sessionStorage.workspaceid || '',
             adstatus: 0 }
```

This call bypasses `fetchProcessDataForCandidate` (no debounce, no abort, no stale-response guard).

Envelope: `res.data.data[0]`; `proc = envelope.processData ?? envelope.processdata`. If missing → throws `'Missing process data'`.

### Mapping `ocr_extracted_text` → segments

For every question object in `proc.ocr_extracted_text` (question keys are ignored — all questions are flattened into one list, so an image under two questions appears twice) and every `[fullPath, value]`:

| Segment field | Source | Notes |
|---|---|---|
| `id` | running counter from 1 | |
| `imageUrl` | `` `${IMAGE_BASE}${fullPath without leading /}` `` | plain concatenation (does not use `toDisplayableImageUrl`) |
| `label` | last path segment of `fullPath` | |
| `ocrText` | rich object → `String(value.transcription ?? '')`; legacy string → the string | |
| `ocrBlocks` | `value.blocks ?? []` (rich) / `[]` | |
| `ocrFigureCounts` | `value.figure_counts ?? {}` | |
| `ocrTokens` | `value.tokens ?? {}` | |
| `ocrSubject` | `String(value.subject ?? '')` | |
| `ocrIssues` | `value.issues ?? []` | |
| `ocrTranscriptionLatex` | `String(value.transcription_latex ?? '')` | |
| `ocrInterpretation` | `String(value.interpretation ?? '')` | |
| `ocrHasData` | `true` when value is an object | distinguishes "extracted, nothing found" from "never extracted" |

`setStandaloneOcrPopupData(mappedSegments)` (empty array when none). The popup's `open` prop is `!!standaloneOcrPopupData`, so an **empty array still opens it** and shows "No OCR data found for this candidate.".

Errors → `toast.error(e.response.data.message || e.message || 'Failed to fetch process data for standalone OCR')`; popup not opened. `finally` → `setPhase1Loading(false)`.

---

## 3. `StandaloneOCREvaluation` (popup shell)

Props: `open: boolean`, `onClose: () => void`, `segments: SegmentImage[]`.

```text
Dialog (max 95vw × 1400px, 90vh, z-[100]; outside click/pointer-down prevented; default close hidden)
├─ Header: "OCR Review"  ·  X button (tooltip "Close", z-[120])
├─ Body (ScrollArea)
│   ├─ segments.length > 0 → <ScriptExtractorPanel segments onInspectImage={setPopupImage}/>
│   └─ else "No OCR data found for this candidate."
└─ Nested Dialog (z-[110], full screen, transparent) when popupImage
    └─ <ImageInspectorModal imageUrl label onClose/>
```

- Close: X button or Esc (`onOpenChange` → `onClose` → `setStandaloneOcrPopupData(null)`).
- The file also defines `MOCK_SEGMENTS`, `readStoredOcrResult` (reads/expires `sessionStorage.standalone_ocr_result` after 24 h) and `buildSegmentsFromStoredResult`, but none are used by the component, and nothing in `src/` writes `standalone_ocr_result`.
- `App.tsx` also routes `/standalone-ocr` (behind `RequireAuth`) to this component **without props** — `open` is `undefined`, so the route renders an empty page.

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/standalone-ocr-review-popup.png — OCR Review popup with page pills, zoomed image and the OCR transcription tab]

---

## 4. `ScriptExtractorPanel` behaviour

Layout: two columns on `lg` (5fr / 7fr), stacked below.

```text
Left: "Extraction Input"
├─ <ExtractionControls showButton={false}/>   → renders nothing (see §4.5)
├─ "Script page image(s) *"
├─ Page pills (one per segment; teal = active, none active while an upload replaces the page)
└─ Drop zone / preview
    ├─ Bar: file name · Zoom out · {zoom}% · Zoom in · Reset · Inspect · [upload] Remove (X)
    └─ Viewport 380px (460px ≥sm): drag to pan, double-click → inspector
Right
├─ Error banner (red, dismissible X)       when error
└─ <ExtractionOutputTabs result onCopy isRunning/>
```

### 4.1 State

| State | Initial | Purpose |
|---|---|---|
| `activeSegmentId` | first segment id | selected page |
| `subject` | `"General"` | sent to extraction (no UI to change it — §4.5) |
| `options` | `DEFAULT_OPTIONS` | extraction flags |
| `zoomLevel` | 100 | image width % |
| `isRunning` | false | extraction in flight |
| `error` | null | banner text |
| `result` | `segmentToResult(segments[0])` | data shown in tabs |
| `upload` | null | `{file, url}` replacement page |
| `isDragOver`, `isPanning` | false | drop-zone ring, cursor |

### 4.2 Segment switching

- **Pill click:** clears upload, sets active id, zoom 100, `result = segmentToResult(segment)`, clears error.
- **Effect on `activeSegment` change:** if the segment has `ocrHasData` or `ocrText`, the result is rebuilt with a LaTeX split:
  - `findLatexStartIndex(ocrText)` = character offset of the first line matching `\square`, `\hline`, `\begin{`, `\end{` or `\cmd &`.
  - If offset > 0: `transcription` = text before it (trimEnd), `transcription_latex` = segment's `ocrTranscriptionLatex` **or** the tail. Offset 0 or −1: whole text stays in `transcription`.
  - `subject` = `ocrSubject ?? 'General'`; `insertions_placed` = 0; counts/tokens default to 0.
  - Otherwise `result = null`.
- `segmentToResult` returns `null` unless `ocrHasData`, `ocrText`, `ocrTranscriptionLatex`, `ocrInterpretation`, non-empty `ocrBlocks` or non-empty `ocrIssues`.

### 4.3 Zoom and pan

| Control | Effect |
|---|---|
| Zoom out / in | 40 %…400 %, step 25 |
| Reset | 100 % |
| Mouse drag in viewport | scrolls the viewport (pan) |
| Double-click / **Inspect** | `onInspectImage({url, label})` → `ImageInspectorModal` |

### 4.4 Drag-and-drop replacement image

- Drop a file on the preview card → `acceptFile(file)`: `upload = {file, url: URL.createObjectURL(file)}`, zoom 100, `result = null`, error cleared. No type check.
- While an upload is active the preview shows the uploaded file; no pill is highlighted.
- **Remove (X)** clears upload, result, error, zoom. Because `activeSegment` did not change, the effect does not re-run, so the tabs show the "never extracted" placeholder until another pill is clicked.
- Object URLs are never revoked.

### 4.5 Extract button

`ExtractionControls` is rendered with `showButton={false}` and that component renders **only** the Extract button — no subject picker, no option toggles. No other element calls `handleExtract`. Consequently, in the current source **the popup cannot run an extraction**: the drag-and-drop replacement image can be viewed and inspected but not extracted, and `subject`/`options` stay at their defaults.

`handleExtract` (dead path, documented for completeness): sets `isRunning`, calls `runExtraction({subject, file: upload?.file, imageUrl: upload ? undefined : source.url, options})`; success → `result`; failure → `error` banner + `toast.error(message)`.

### 4.6 Copy

`handleCopy(text, label)` → `navigator.clipboard.writeText`; `toast.success('<label> copied to clipboard')` or `toast.error('Failed to copy text')`.

---

## 5. `ExtractionOutputTabs` — tab-by-tab rendering

Props: `result: ExtractionResult | null`, `onCopy`, `isRunning`.

Tabs (default **OCR transcription**): `OCR transcription` · `Raw LaTeX` · `Interpretation` · `Protocol audit (n)` · `JSON`.

While `isRunning`, the first four tabs are replaced by `ExtractionLoader` ("Extracting script…"). The JSON tab is outside that branch, so with JSON active both the loader and the JSON block render.

The **D/T/G bar** (`DtgBar`) on the first three tabs shows Diagram / Table / Graph chips: present (teal) when `figure_counts[key] > 0` or `blocks` contains the key; count shown in brackets when a result exists; tooltips "awaiting extraction" / "`n` detected" / "not present on page".

| Tab | Content when data present | Actions | Placeholder — `result === null` ("never extracted") | Placeholder — result present, field empty ("extracted but empty") |
|---|---|---|---|---|
| OCR transcription | `result.transcription` parsed by `marked` (Markdown tables styled) via `dangerouslySetInnerHTML` | Copy text | `Select a subject and click "Extract script" to begin extraction…` | `No transcription text was returned for this page.` |
| Raw LaTeX | `result.transcription_latex` in `<pre>` | Copy LaTeX, Download .txt (`raw-latex.txt`) | `LaTeX view will be displayed here…` | `No LaTeX was returned for this page.` |
| Interpretation | `result.interpretation` via `marked` | Copy interpretation | `Visual element descriptions will appear here…` | `No visual elements were described for this page.` |
| Protocol audit (n) | one amber card per `result.issues[]` | — | `No protocol audit issues flagged.` | same |
| JSON | `JSON.stringify(result, null, 2)` on dark `<pre>` | Copy JSON | `Select a page to see its data, or run an extraction…` | (always renders JSON when result exists) |

`marked` output is injected unsanitised (`renderMarkdown`); on parse error the raw text is injected.

`ExtractionMetrics` (token cards) is not rendered by this panel or any other component.

---

## 6. `runExtraction` contract (`src/lib/extraction.ts`)

### 6.1 Endpoint

`DEFAULT_ENDPOINT = ${VITE_AIAPPS_API_BASE}/AITranscription/extract`. If the env var is missing, a **hardcoded non-env fallback host** is used (same pattern for `API_ENDPOINTS.aiTranscription` in OCREvaluation).

### 6.2 Request

```text
POST {DEFAULT_ENDPOINT}
Content-Type: multipart/form-data (built by FormData)

subject         string   e.g. "General" (ALLOWED_SUBJECTS: Mathematics, Physics, Chemistry, Biology, English, Social Science, General)
file            File     uploaded page
verify          "true"|"false"   default true
interpret       "true"|"false"   default true
line_mode       "true"|"false"   default true
insertion_pass  "true"|"false"   default true
strict_maths    "true"|"false"   default false
q_filter        string   default ""
```

**File source.** `file` param if given; otherwise `urlToFile(imageUrl)`:

1. Candidates: same-origin path (URL with scheme+host stripped) **first**, then the absolute URL.
2. `fetch` each; skip on non-OK or a `text/*` blob (proxy HTML error page).
3. File name = last URL segment without query; `.png` appended unless it ends in png/jpg/jpeg/webp/tif/tiff; type = blob type or `image/png`.
4. A `TypeError` (CORS) → `Error('The image host blocks cross-origin downloads …')`.
5. Nothing → `Error('No script page image to extract.')`.

### 6.3 Response

- `content-type` contains `application/json` → `payload = await res.json()`; else `payload = { detail: text || "HTTP <status>: <statusText>" }`.
- `!res.ok` → `throw new Error(payload.detail || 'Extraction request failed.')`.

**Shape:** page fields are nested under a key named after the uploaded file; `tokens` (and `allowed_subjects`) are top level:

```json
{
  "page_03.png": {
    "subject": "Mathematics",
    "blocks": ["text", "table"],
    "transcription": "…",
    "transcription_latex": "…",
    "interpretation": "…",
    "issues": ["…"],
    "insertions_placed": 1,
    "figure_counts": { "graph": 0, "diagram": 1, "table": 1 }
  },
  "tokens": { "input": 1200, "output": 800, "thinking": 300, "total": 2300, "calls": 3 },
  "allowed_subjects": ["…"]
}
```

**Page object resolution** (in order):

1. `payload[upload.name]` if it is an object.
2. Else the first value whose key is not `tokens` / `allowed_subjects` / `detail` and which is a non-array object.
3. Else `payload` itself (flat response).

### 6.4 Field mapping

| API field | `ExtractionResult` field | Default | UI element |
|---|---|---|---|
| `<file>.subject` | `subject` | request `subject` | JSON tab |
| `<file>.blocks` | `blocks` | `[]` | D/T/G bar presence; JSON |
| `<file>.transcription` | `transcription` | `""` | OCR transcription tab |
| `<file>.transcription_latex` | `transcription_latex` | `""` | Raw LaTeX tab |
| `<file>.interpretation` | `interpretation` | `""` | Interpretation tab |
| `<file>.issues` | `issues` | `[]` | Protocol audit tab + tab count |
| `<file>.insertions_placed` | `insertions_placed` | `0` | JSON |
| `<file>.figure_counts` | `figure_counts {graph, diagram, table}` | all 0 | D/T/G bar counts |
| `tokens.input/output/thinking/total/calls` (top level) | `tokens.*` | 0 each | JSON (`ExtractionMetrics` would show input/output/total but is unused) |

### 6.5 Saved record → popup mapping (round trip)

| Saved `ocr_extracted_text` object field | Segment field | `ExtractionResult` field in the panel |
|---|---|---|
| `transcription` | `ocrText` | `transcription` (Markdown part) and, if no `transcription_latex`, the LaTeX tail |
| `transcription_latex` | `ocrTranscriptionLatex` | `transcription_latex` |
| `interpretation` | `ocrInterpretation` | `interpretation` |
| `blocks` | `ocrBlocks` | `blocks` |
| `figure_counts` | `ocrFigureCounts` | `figure_counts` |
| `tokens` | `ocrTokens` | `tokens` |
| `subject` | `ocrSubject` | `subject` |
| `issues` | `ocrIssues` | `issues` |
| (object present) | `ocrHasData: true` | selects "extracted but empty" placeholders |
| `insertions_placed` | — | always 0 in the panel |

---

## 7. Error handling summary

| Failure | Where | User sees |
|---|---|---|
| get-process-data HTTP error / missing envelope | `handleOpenOcrReview` | toast, popup stays closed |
| No OCR entries | — | popup opens with "No OCR data found for this candidate." |
| Image 404 in preview | `<img>` | broken image (no fallback) |
| Copy fails | `handleCopy` | toast "Failed to copy text" |
| Extraction errors | `handleExtract` (unreachable) | red banner + toast |

See also: [Components](../components/ocr-components.md) · [API mapping](./user-api-mapping-review.md) · [workflow](../workflows/review-and-approval-workflow.md).
