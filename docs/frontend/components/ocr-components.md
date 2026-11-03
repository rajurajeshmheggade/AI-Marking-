# OCR and Review Components

Reference for the presentational components used by the review layer.

| Component | File | Used by | Status |
|---|---|---|---|
| `ScriptExtractorPanel` | `src/components/ocr/ScriptExtractorPanel.tsx` | `StandaloneOCREvaluation` | Active |
| `ExtractionOutputTabs` | `src/components/ocr/ExtractionOutputTabs.tsx` | `ScriptExtractorPanel` | Active |
| `ExtractionControls` (+ `CategoryDropdown`) | `src/components/ocr/ExtractionControls.tsx` | `ScriptExtractorPanel` (with `showButton={false}` → renders nothing) | Effectively inert |
| `ImageInspectorModal` | `src/components/ocr/ImageInspectorModal.tsx` | `StandaloneOCREvaluation` | Active |
| `ExtractionMetrics` | `src/components/ocr/ExtractionMetrics.tsx` | none | Unused |
| `StatusBadge` (ocr folder) | `src/components/ocr/StatusBadge.tsx` | none (OCREvaluation defines its own `StatusBadge`) | Unused |
| `AudioPlayer` | `src/components/AudioPlayer/AudioPlayer.tsx` | none | Unused |
| `AttachedAudioPreview` | `src/pages/OCREvaluation.tsx` (~L322) | per-question upload popup (audio mode) | Active |
| `StatusBadge` (page-local) | `src/pages/OCREvaluation.tsx` (~L449) | candidate table, preview dialog | Active |
| `StandaloneOCREvaluation` | `src/pages/StandaloneOCREvaluation.tsx` | `OCREvaluation` (~L17652); route `/standalone-ocr` (no props) | Active (popup) |

```text
OCREvaluation
├─ StatusBadge (local)                     candidate table badges
├─ AttachedAudioPreview                    question-flow upload popup
└─ StandaloneOCREvaluation (popup)
   ├─ ScriptExtractorPanel
   │  ├─ ExtractionControls (showButton=false → empty)
   │  └─ ExtractionOutputTabs
   │     ├─ DtgBar
   │     └─ ExtractionLoader
   └─ ImageInspectorModal (nested dialog)
```

Behavioural detail for the popup lives in [user-standalone-ocr-review.md](../user/user-standalone-ocr-review.md).

---

## ScriptExtractorPanel

**Purpose.** Page viewer + extraction result viewer for one candidate's script pages.

**Props**

| Prop | Type | Required | Description |
|---|---|---|---|
| `segments` | `ExtractorSegment[]` | yes | Pages. Panel returns `null` when there is no source (empty array and no upload). |
| `onInspectImage` | `(image: {url, label}) => void` | yes | Called by Inspect and double-click. |

`ExtractorSegment`: `id`, `imageUrl`, `label`, `ocrText`, optional `ocrBlocks`, `ocrFigureCounts {graph, diagram, table}`, `ocrTokens {input, output, thinking, total, calls}`, `ocrSubject`, `ocrIssues`, `ocrTranscriptionLatex`, `ocrInterpretation`, `ocrHasData`.

**State:** `activeSegmentId`, `subject` ("General"), `options` (`DEFAULT_OPTIONS`), `zoomLevel` (100; 40–400), `isRunning`, `error`, `result`, `upload {file, url}`, `isDragOver`, `isPanning`; refs `fileInputRef` (unused), `viewportRef`, `panStart`.

**Events / internal handlers:** pill click, `acceptFile` (drop), `handleExtract` (no trigger in UI), `handleCopy`, `startPan`/`movePan`, zoom buttons, remove upload.

**Helpers:** `segmentToResult(segment)` (null when the page carries nothing), `findLatexStartIndex(text)` (splits trailing LaTeX from Markdown).

**API dependency:** `runExtraction` from `src/lib/extraction.ts` (only via `handleExtract`, which has no UI trigger).

**Children:** `ExtractionControls`, `ExtractionOutputTabs`. **Parent:** `StandaloneOCREvaluation`.

**Reusability:** self-contained (no global state, no router). Unused imports `Loader2`, `Sparkle`, `Upload` and the unused `fileInputRef` indicate a removed Extract button / file picker.

---

## ExtractionOutputTabs

**Purpose.** Five-tab view of one `ExtractionResult`.

| Prop | Type | Default | Description |
|---|---|---|---|
| `result` | `ExtractionResult \| null` | — | `null` = never extracted |
| `onCopy` | `(text, label) => void` | — | Copy handler |
| `isRunning` | `boolean` | `false` | Shows `ExtractionLoader` in tabs 1–4 |

**State:** `activeTab` (`ocr` \| `latex` \| `interpret` \| `issues` \| `json`; default `ocr`).

**Events:** tab click; Copy text/LaTeX/interpretation/JSON → `onCopy`; Download .txt → local `downloadTxt` (`raw-latex.txt`).

**Rendering:** Markdown via `marked.parse(..., {async:false})` into `dangerouslySetInnerHTML` (not sanitised). Placeholders differ for `result === null` vs empty field — full table in [user-standalone-ocr-review.md §5](../user/user-standalone-ocr-review.md#5-extractionoutputtabs--tab-by-tab-rendering).

**Sub-components:** `DtgBar` (Diagram/Table/Graph chips from `figure_counts` and `blocks`), `ExtractionLoader`.

**API dependency:** none (type import only). **Reusability:** pure; reusable anywhere an `ExtractionResult` exists.

---

## ExtractionControls / CategoryDropdown

**ExtractionControls props:** `subject`, `onSubjectChange`, `options?`, `onOptionsChange?`, `onExtract`, `isRunning`, `disabled?` (false), `showButton?` (true).

Despite the prop list, the component renders **only** the Extract button: label "Extract script" (Sparkle icon) or "Extracting script…" (spinner); disabled when `disabled || isRunning || !subject`. `subject`, `onSubjectChange`, `options`, `onOptionsChange` are accepted but unused. With `showButton={false}` (the only call site) it renders an empty `div`.

**CategoryDropdown** (exported, not used anywhere): inline, non-portaled listbox of `options ?? ALLOWED_SUBJECTS`; closes on outside mousedown or Esc; props `subject`, `onSubjectChange`, `options?`.

**API dependency:** none (imports `ALLOWED_SUBJECTS`).

---

## ExtractionMetrics (unused)

Props: `result: ExtractionResult | null`. Renders three cards — Input tokens, Output tokens, Total tokens (highlighted) — from `result.tokens` (zeros when null). Not imported by any file.

---

## ImageInspectorModal

**Purpose.** Full-screen image inspector.

| Prop | Type | Description |
|---|---|---|
| `imageUrl` | string | image source |
| `label` | string | title and download file name |
| `onClose` | `() => void` | close callback |

**State:** `zoom` (100; 40–500), `isPanning`; refs `viewportRef`, `panStart`.

**Events**

| Input | Effect |
|---|---|
| Zoom out / in buttons, `-` / `+` or `=` keys | ±25 % |
| Mouse wheel over viewport | ±15 % (`preventDefault`) |
| **Fit** | zoom 100 %, scroll to top-left |
| **Download** | `<a href=imageUrl download=label>` — for cross-origin URLs browsers typically navigate instead of downloading |
| Drag | pan |
| Esc (window listener), backdrop click, X | `onClose` |

Footer hints: "Drag to pan · Mouse wheel to zoom · Esc to close". **Parent:** `StandaloneOCREvaluation` (inside a nested full-screen `Dialog` at `z-[110]`). **API dependency:** none. **Reusability:** generic.

---

## StatusBadge

Two implementations exist.

| | `src/components/ocr/StatusBadge.tsx` | `src/pages/OCREvaluation.tsx` (~L449) |
|---|---|---|
| Used | no | yes (table, preview dialog) |
| Props | `status`, `clickable?`, `onClick?` | same + `afterLabel?: ReactNode` |
| `pending` label | "Pending" (amber) | **"Approved"** (teal) |
| `stopped` | — | "Stopped" (red) |
| Icon | always | spinner only for `in-progress` |
| Not clickable | `cursor-default` | wrapped in a `cursor-not-allowed` span with tooltip "`<label>` - available once this stage is completed" |
| Unknown status | "Unknown" (grey) | "Unknown" (grey) |

Status values: `yet-to-segmentation`, `yet-to-ocr`, `yet-to-evaluation`, `in-progress`, `completed`, `pending`, `approved` (+ `stopped` in the page-local version). Numeric mapping: [overview](../user/user-review-and-evaluation.md#phase-status-model-what-makes-a-dialog-openable).

---

## AttachedAudioPreview (OCREvaluation.tsx ~L322)

**Purpose.** Shows the single audio file attached to a question in the per-question upload popup (audio mode), replacing the upload box.

| Prop | Type | Description |
|---|---|---|
| `file` | `File` | attached recording |
| `onRemove` | `() => void` | clears the question's files |

**State:** `url` — created with `URL.createObjectURL(file)` in an effect and revoked on unmount / file change.

**Renders:** file name, size in KB, remove (X) button (`aria-label="Remove <name>"`), native `<audio controls controlsList="nodownload noplaybackrate">` with context menu blocked.

**Parent:** question-flow dialog (`standaloneUploadMode === 'audio' && attached.length > 0`, ~L17271) — upload flow documented in [user-create-workspace-and-upload.md](../user/user-create-workspace-and-upload.md). **API dependency:** none.

## Per-question file preview dialog (`qFlowPreviewFile`, ~L17401)

Opened by the eye icon next to an attached image in the question-flow popup (`setQFlowPreviewFile(file)`).

| Element | Behaviour |
|---|---|
| Object URL | created when `qFlowPreviewFile` changes, revoked on change/close; zoom reset to 1 |
| Title | file name, "Preview of the selected file" |
| Zoom − / reset (`NN%`) / + | images only; 0.5×…3×, step 0.25 |
| Sizing | on load reads natural size; portrait (h ≥ w) scales **height** = zoom×100 %, landscape scales width |
| Audio file | native `<audio>` (nodownload, no playback rate) instead of image |
| Close | X button or Esc; outside click/pointer-down ignored; auto-focus suppressed (avoids tooltip pop) |

---

## AudioPlayer (unused)

`src/components/AudioPlayer/AudioPlayer.tsx` + `AudioPlayer.css`. Not imported anywhere in `src/`.

| Prop | Type |
|---|---|
| `audioTrack` | string (URL, blob: or data:) |

Behaviour:

- Hidden `<audio>`; custom play/pause circle (Enter/Space), range slider (`--range-progress` CSS var), elapsed / total `mm:ss`.
- **Duration is capped at 20 seconds** for the UI (`Math.min(20, …)`); for blob recordings reporting `Infinity`/0 it seeks to 24 h to force a duration.
- A 200 ms interval stops playback when `currentTime ≥ duration` (so playback halts at 20 s even for longer files).
- Download (⬇): blob/data URLs downloaded directly as `my-audio.mp3`; otherwise `fetch(audioTrack, {credentials:'include'})` → blob → `my-audio.mp3`; on failure navigates the current window to the URL (`window.open(url, '_self')`).

---

## StandaloneOCREvaluation

| Prop | Type | Description |
|---|---|---|
| `open` | boolean | dialog visibility |
| `onClose` | `() => void` | X / Esc |
| `segments` | `SegmentImage[]` (structurally `ExtractorSegment[]`) | pages |

State: `popupImage {url, label} | null`. Children: `ScriptExtractorPanel`, `ImageInspectorModal`. Unused module-level helpers: `MOCK_SEGMENTS`, `readStoredOcrResult` (sessionStorage `standalone_ocr_result`, 24 h expiry), `buildSegmentsFromStoredResult`. See [user-standalone-ocr-review.md §3](../user/user-standalone-ocr-review.md#3-standaloneocrevaluation-popup-shell).
