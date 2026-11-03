# Candidate Review, Approval and Evaluation — Overview

This section documents the **review layer** of the OCR Evaluation page: the dialogs a reviewer opens from a candidate row to inspect, correct and approve each pipeline stage (Segmentation / Indexing → OCR → Evaluation), plus the Standalone OCR review popup.

> Scope boundary. The workspace list, the Create Workspace / upload dialog, the candidate table columns, polling and export are documented elsewhere:
> [Workspaces](./user-workspaces.md) · [Create workspace & upload](./user-create-workspace-and-upload.md) · [Candidate table](./user-candidate-table.md).

## Documents in this section

| Document | Covers |
|---|---|
| [user-segmentation-indexing-review.md](./user-segmentation-indexing-review.md) | Segmentation / Indexing dialog: page tagging per question, Pages to Review, No Question Marker, Blank Pages, Approve → `save-indexing-info` → OCR sync → `update-status` |
| [user-ocr-review.md](./user-ocr-review.md) | OCR Preview dialog: per-question/per-image text editing, Standards credits, Approve → `save-ocr-data` → `recalculate-standards` → cleanup → `update-status` |
| [user-evaluation-review.md](./user-evaluation-review.md) | Evaluation Preview dialog: score chip colouring, manual marking (question / sub-question / nested), Top-N total recompute, re-evaluation, approval |
| [user-standalone-ocr-review.md](./user-standalone-ocr-review.md) | Standalone OCR review popup (`StandaloneOCREvaluation` → `ScriptExtractorPanel` → `ExtractionOutputTabs`) and the `/AITranscription/extract` contract |
| [../components/ocr-components.md](../components/ocr-components.md) | Component reference for `src/components/ocr/*`, `AudioPlayer`, `AttachedAudioPreview`, `ImageInspectorModal` |
| [user-api-mapping-review.md](./user-api-mapping-review.md) | Every API used by this layer, request/response fields, error handling |
| [../pages/sandbox-dashboard.md](../pages/sandbox-dashboard.md) | `/sandbox` mock workbench page |
| [../workflows/review-and-approval-workflow.md](../workflows/review-and-approval-workflow.md) | End-to-end per-candidate lifecycle diagram and step table |

## Source files

| File | Role in review layer |
|---|---|
| `src/pages/OCREvaluation.tsx` | All review dialogs, handlers and API calls (single ~17,600-line component `OCREvaluation`) |
| `src/pages/StandaloneOCREvaluation.tsx` | Standalone OCR review popup shell (rendered by `OCREvaluation` at ~L17652) |
| `src/components/ocr/*.tsx` | Extraction panel, output tabs, inspector modal, unused controls/metrics/status badge |
| `src/lib/extraction.ts` | `runExtraction` client for `/AITranscription/extract` |
| `src/components/AudioPlayer/AudioPlayer.tsx` | Custom audio player (not referenced by any page — see component doc) |
| `src/pages/SandboxDashboard.tsx` | Separate mock-only route `/sandbox` |

## Phase status model (what makes a dialog openable)

Candidate rows are built in `loadCandidatesForWorkspace` → inner `mapStatusCodeToPhaseStatus` (`src/pages/OCREvaluation.tsx` ~L4795). The raw backend codes map as follows (this is the only place the numeric meaning is explicit):

| Raw code (`segmentationstatus` / `ocrstatus` / `markingstatus`) | `PhaseStatus` | Badge label (`StatusBadge` in OCREvaluation.tsx ~L449) |
|---|---|---|
| `0` (or anything not listed) | `yet-to-segmentation` / `yet-to-ocr` / `yet-to-evaluation` | Yet to Segmentation / Yet to OCR / Yet to Evaluate |
| `1` | `in-progress` (exception: Segmentation in a Segmentation-only workspace → `completed`) | In Progress (spinner) |
| `2` | `completed` | Completed |
| `3` | `pending` ("pending approval") | **Approved** (the local `StatusBadge` maps `pending` to the label "Approved") |
| `segmentationstatus = 3` **and** `approvedstatus = 1` | Phase 1 becomes `approved` | Approved |
| `ocrstatus = 4` / `markingstatus = 4` | (badge unchanged) — a **Rerun** button is shown next to the badge | — |
| `noqMarker = 1` | OCR and Evaluation badges are replaced by a non-clickable **Stopped** badge | Stopped |

A badge is **clickable only** when its phase is `completed`, `pending` or `approved` (`clickable={…}` at ~L10087, ~L10118, ~L10158). Non-clickable badges are wrapped in a `cursor-not-allowed` span with the tooltip "`<label>` - available once this stage is completed".

## Candidate-table action → dialog map

All four table render variants (grouped/category rows, flat rows; ~L10085–L10752) wire the same handlers.

| Table element | Visible when | Clickable when | Handler | Opens |
|---|---|---|---|---|
| Phase 1 badge (Segmentation / Indexing column) | `workflowStages.segmentation \|\| workflowStages.indexing` | phase1 ∈ {completed, pending, approved} | `handleOpenPhase1Review(candidate)` (~L6417) | Segmentation / Indexing dialog ("`segmentationLabel`" title) |
| OCR badge | `effectiveWorkflowStages.ocr` and `noqMarker ≠ 1` | phase2 ∈ {completed, pending, approved} | `handleOpenOcrReview(candidate)` (~L6120) | **Standalone OCR popup** if Standalone OCR-only, otherwise **OCR Preview** dialog |
| OCR **Rerun** button | `rawOcrStatus === 4` and `noqMarker ≠ 1` | not already running | `handleRunOcr` (~L6252) | No dialog — `POST run-ocr` |
| Evaluation badge | `effectiveWorkflowStages.evaluation` and `noqMarker ≠ 1` | phase3 ∈ {completed, pending, approved} | `handleOpenEvaluationReview(candidate)` (~L6220) | Evaluation Preview dialog |
| Evaluation score chip `X/Y` | `evaluationMarks !== undefined` and `noqMarker ≠ 1` | always (except the variant at ~L10737 where `onClick` is commented out) | `handleOpenEvaluationReview` | Evaluation Preview dialog |
| Evaluation **Rerun** button | `rawMarkingStatus === 4` and `noqMarker ≠ 1` | not already running | `handleRunEvaluation` (~L6306) | No dialog — `GET get-process-data type 2` then `POST run-evaluation` |
| "Stalled" restart button | `isCandidateStalled(candidate) && phase3 === 'in-progress'` | — | `handleRestartEvaluation` (~L6783) | Never shown: `isCandidateStalled` always returns `false` (~L6779) |
| Quick Approve switch | `!hideQuickApproveColumn` | see below | `handleQuickApproveChange` (~L5053) | No dialog — toggles editing rights inside the dialogs |

`effectiveWorkflowStages` = `workflowStages` with `evaluation` forced to `false` when Standalone Mode is on (~L2155), so the Evaluation column and dialog are never reachable in Standalone Mode.

## Quick Approve — the edit gate

Every editing action inside the review dialogs is gated on `candidate.quickApprove`:

| Dialog | With Quick Approve **OFF** | With Quick Approve **ON** |
|---|---|---|
| Segmentation / Indexing | Read-only; free question navigation; no Approve button | Approve button, progress indicator, Reposition controls, Untag, drag-reorder, "Move to Pages to Review", "Not blank" actions; guided navigation (next question only after current visited) |
| OCR Preview | Read-only; free navigation | Approve button + progress indicator (when not yet approved locally), per-image **Update/Save/Cancel**; guided navigation |
| Evaluation Preview | Read-only; free navigation; Manual Marking switch, "Re-evaluate all" and "Re-evaluate Q" disabled with tooltip | Manual Marking switch enabled, re-evaluation enabled; guided navigation |

Switch state (`renderQuickApproveToggle`, ~L5073):

- **Disabled** when any enabled stage is in `yet-to-*`/`in-progress` (unless `noqMarker = 1`), while a Rerun is in flight, or when `noqMarker = 1` (tooltip "Not available: No Question Marker detected").
- Persisted per workspace in `sessionStorage['icme_ocr.quickApprove.<workspaceId>']` (`readQuickApproveMap` / `writeQuickApproveMap`, ~L891–L909) so the 30 s candidate poll does not reset it.
- Hidden column when `isSegmentationOnly || isStandaloneOcrOnlyMode` (`hideQuickApproveColumn`, ~L2182).

## Loader and polling behaviour common to all dialogs

- `fetchProcessDataForCandidate` debounces by **800 ms** (`FETCH_DEBOUNCE_MS`) and de-duplicates per `registrationnumber::type` key; it aborts a previous in-flight request for the same key and drops stale responses using per-dialog "active fetch key" refs (`phase1ActiveFetchKeyRef`, `ocrActiveFetchKeyRef`, `evaluationActiveFetchKeyRef`).
- While `phase1Loading`, `phase1ApproveSaving`, `ocrApproveSaving`, `evaluationScoreSaving` or `reEvaluationSubmitting` is true, the full-screen `PageLoader` is shown (~L8475–L8532).
- Candidate polling (30 s) is **paused** while any review dialog is open and restarted when all close (effect at ~L5155).

## Dialogs present in source but not reachable

| Dialog | Location | Why unreachable |
|---|---|---|
| Candidate preview (`previewCandidate`) | ~L12279 | No call site sets `previewCandidate` to a candidate |
| Standards Met Details (`standardsDialogCandidate`) | ~L13076 | No opener; only the Close button sets it |
| Evaluation Info (`showEvalInfoDialog`) | ~L16549 | The only opener (~L15011) is inside a commented-out block |
| Evaluation "Evaluation Details" rubric dropdown | ~L14425 | `DropdownMenuTrigger` has no child element |

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/review-candidate-row-actions.png — a candidate row showing clickable Phase 1/OCR/Evaluation badges, the score chip and the Quick Approve switch]

## Related

- API reference for this layer: [user-api-mapping-review.md](./user-api-mapping-review.md)
- Global API mapping: [../api/api-integration-mapping.md](../api/api-integration-mapping.md)
- Architecture: [../architecture/](../architecture/)
- Admin configuration that drives `workflowStages`, `standalone`, `evaluationConfig`: [../admin/](../admin/)
