# Review and Approval Workflow (per candidate)

How one candidate moves through Segmentation / Indexing → OCR → Evaluation → approval in the OCR Evaluation page, which dialog the reviewer uses at each step, and which APIs fire. Implementation: `src/pages/OCREvaluation.tsx`. Detailed pages: [overview](../user/user-review-and-evaluation.md), [Segmentation/Indexing](../user/user-segmentation-indexing-review.md), [OCR](../user/user-ocr-review.md), [Evaluation](../user/user-evaluation-review.md), [Standalone OCR](../user/user-standalone-ocr-review.md), [API mapping](../user/user-api-mapping-review.md).

Which stages exist is driven by `get-config-info → configSetting.workflowStages {segmentation, indexing, ocr, evaluation}` and `configSetting.standalone` (see [../admin/](../admin/)). Upload and processing that produce the statuses are covered in [user-create-workspace-and-upload.md](../user/user-create-workspace-and-upload.md); the table in [user-candidate-table.md](../user/user-candidate-table.md).

---

## 1. Lifecycle diagram

```text
                     backend processing (outside this layer)
                     candidate-process-data status codes:
                     0 yet-to · 1 in-progress · 2 completed · 3 pending · 4 stopped
                                         │
                                         ▼
 ┌──────────────────────────── Phase 1: Segmentation / Indexing ───────────────────────────┐
 │ badge clickable (completed|pending|approved)                                              │
 │   └─ handleOpenPhase1Review ─► GET get-process-data type=1 ─► dialog                      │
 │        [Quick Approve ON] edit mapping (local + sessionStorage)                            │
 │        Approve ─► checks (no NQ pages, session mapping exists, mapping changed)           │
 │           ├─ POST save-indexing-info                                                       │
 │           ├─ GET  get-config-info  ──► ocr stage on?                                       │
 │           │     yes ─► GET type=2 ─► POST save-ocr-data ─► [!standalone] POST recalculate  │
 │           │            ─► [cleanup] GET type=3 ─► POST save-evaluation-data                │
 │           ├─ POST update-status {type:1,status:1}                                          │
 │           └─ GET type=1 (refresh) ─► candidate-process-data (silent)                       │
 └───────────────────────────────────────────────┬──────────────────────────────────────────┘
                                                 ▼
 ┌──────────────────────────────────── Phase 2: OCR ────────────────────────────────────────┐
 │ Standalone OCR-only? ── yes ─► GET type=2 ─► Standalone OCR Review popup (view only)      │
 │        │ no                                                                                │
 │        ▼                                                                                   │
 │ handleOpenOcrReview ─► GET type=2 ─► OCR Preview                                           │
 │   [Quick Approve ON] Update/Save text per image (local)                                    │
 │   Approve ─► checks (OCR exists, edited)                                                   │
 │      ├─ GET type=1 (align to indexing)                                                     │
 │      ├─ POST save-ocr-data                                                                 │
 │      ├─ [!standalone] POST recalculate-standards                                           │
 │      ├─ [cleanup] GET type=3 ─► POST save-evaluation-data                                  │
 │      ├─ POST update-status {type:2,status:1}                                               │
 │      └─ GET type=2 (refresh) ─► candidate-process-data (silent)                            │
 │ ocrstatus=4 ─► Rerun ─► POST run-ocr                                                       │
 └───────────────────────────────────────────────┬──────────────────────────────────────────┘
                                                 ▼   (hidden in Standalone Mode)
 ┌────────────────────────────────── Phase 3: Evaluation ───────────────────────────────────┐
 │ handleOpenEvaluationReview ─► GET type=3 ─► Evaluation Preview                            │
 │   [Quick Approve ON + Manual Marking ON] edit score ─► Confirm & Save                      │
 │      ├─ GET get-config-info (Top-N)                                                        │
 │      ├─ POST save-evaluation-data                                                          │
 │      ├─ POST update-status {type:3,status:1}                                               │
 │      └─ candidate-process-data (silent) ─► GET type=3 (refresh)                            │
 │   [Quick Approve ON] Re-evaluate all / Q ─► POST run-evaluation (userprompt)              │
 │      └─ GET type=3 ─► candidate-process-data ─► POST update-status {type:3,status:1}      │
 │ markingstatus=4 ─► Rerun ─► GET type=2 ─► POST run-evaluation (isall=1)                    │
 └───────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Step table

| # | Start point | Action | API(s) | UI state | Next step | Completion / error |
|---|---|---|---|---|---|---|
| 1 | Table, Phase 1 badge `completed`/`pending`/`approved` | Click badge | `GET get-process-data type=1` (Segmentation-only: `get-candidate-info` + image probing) | Loader → Segmentation/Indexing dialog | 2 or close | Load error → toast "Failed to load segmentation data"; dialog still opens empty |
| 2 | Phase 1 dialog | Turn on Quick Approve (table), then Reposition / Untag / drag / Move to Pages to Review / Not blank | none (sessionStorage `icme_ocr.phase1.mapping.*`, except "Not blank") | Mapping updated in place | 3 | Validation toasts (duplicates, nothing selected, Quick Approve off) |
| 3 | Phase 1 dialog | **Approve** | `save-indexing-info` → `get-config-info` → (OCR on) `get-process-data type=2` → `save-ocr-data` → `recalculate-standards` (not in standalone) → (cleanup) `get-process-data type=3` → `save-evaluation-data` → `update-status 1/1` → `get-process-data type=1` → `candidate-process-data` | Full-screen loader; row and dialog show **Approved**; dialog stays open | 4 (after backend OCR completes) | Pre-check toasts (NQ pages, no session mapping, no changes); "Failed to save mappings" aborts; OCR sync / status failures silent; other → "Failed to approve. Please try again." |
| 4a | Table, OCR badge (Standalone OCR-only) | Click badge | `get-process-data type=2` | Standalone OCR Review popup | close | Toast on fetch error; empty → "No OCR data found for this candidate." No approval in this popup. |
| 4b | Table, OCR badge (other configs) | Click badge | `get-process-data type=2` | OCR Preview dialog | 5 | Toast on load error |
| 5 | OCR dialog | Quick Approve ON → **Update** → edit → **Save** per image | none | Text replaced locally | 6 | Save disabled on empty text |
| 6 | OCR dialog | **Approve** | `get-process-data type=1` → `save-ocr-data` → `recalculate-standards` (not in standalone) → (cleanup) `get-process-data type=3` → `save-evaluation-data` → `update-status 2/1` → `get-process-data type=2` → `candidate-process-data` | Loader; Approve button shows "Saving..."; row/dialog **Approved**; button disappears | 7 (after backend evaluation) | "No OCR edits found…", "OCR data has not been edited…", "Failed to save OCR data (status N)", "OCR saved, but recalculation failed…" (status not updated), "Recalculation succeeded but updating status failed…" |
| 6r | Table, OCR `Rerun` (ocrstatus 4) | Click | `run-ocr` → `candidate-process-data` | Button "Running..." + page loader | 4 | "OCR triggered for `<reg>`" / "Failed to trigger OCR…" |
| 7 | Table, Evaluation badge or score chip | Click | `get-process-data type=3` | Evaluation Preview at last-viewed question | 8 / 9 | Toast on load error; "Data not found" per question |
| 8 | Evaluation dialog | Quick Approve ON → Manual Marking ON → edit → **Save** → **Confirm & Save** | `get-config-info` → `save-evaluation-data` → `update-status 3/1` → `candidate-process-data` → `get-process-data type=3` | Optimistic score/total; Manual Marking switches off; row chip updates | close or 9 | Validation errors under inputs; "Failed to save evaluation score to server…" |
| 9 | Evaluation dialog | Quick Approve ON → **Re-evaluate all** / **Re-evaluate Q** → instructions → **Submit** | `run-evaluation` → `get-process-data type=3` → `candidate-process-data` → `update-status 3/1` | Loader; dialog closes; data refreshed | 7 / 8 | "Please provide re-evaluation instructions", "Failed to submit re-evaluation (status N)", "Failed to submit re-evaluation request…" |
| 9r | Table, Evaluation `Rerun` (markingstatus 4) | Click | `get-process-data type=2` → `run-evaluation {isall:1}` → `candidate-process-data` | Button "Running..." | 7 | "Evaluation triggered for `<reg>`" / "Failed to trigger evaluation…" |
| 10 | Evaluation dialog | Close (X) | `candidate-process-data` (silent) | Dialog closed, table polling resumes | — | Outside click/Esc closes without refresh |

---

## 3. Standalone Mode differences

`localStorage.standalone_mode === '1'` (from `configSetting.standalone`).

| Area | Behaviour |
|---|---|
| Evaluation stage | Column, badge, chip and dialog hidden (`effectiveWorkflowStages.evaluation = false`). Backend evaluation calls from approve cleanup (`save-evaluation-data`) still run. |
| Subject code | Every review API sends `subjectcode = 'generic'` (`resolveSubjectCode`). |
| `recalculate-standards` | Skipped after both Phase 1 and OCR approval (`if (!standaloneMode)`). Cleanup and `update-status` still run. |
| OCR-only configuration | OCR badge opens the Standalone OCR Review popup (view only, no approval, no edits); Quick Approve column hidden. |
| Indexing-only configuration | Phase 1 dialog shows a narrow rail with `Q{n} · k page(s)` entries and hides the question card. |
| Question text | Hidden in all three dialogs (number-only rail entries). |
| Status filter | Hidden in the table (`hideStatusFilter`). |

## 4. Segmentation-only differences

`segmentation` on, all other stages off: Phase 1 status `1` counts as completed; the dialog loads pages from the repo via `get-candidate-info` + sequential image probing, shows Download (per page and ZIP), and has **no Approve**, no mapping edits and no Quick Approve column. There is no further stage.

## 5. Approval rules at a glance

| Stage | Who can approve | Must change something first? | Status update |
|---|---|---|---|
| Segmentation / Indexing | Quick Approve ON, not Segmentation-only, no untagged NQ pages | **Yes** — mapping must differ from what was loaded, and at least one edit must have been saved to sessionStorage | `type 1, status 1` |
| OCR | Quick Approve ON, not Standalone OCR-only | **Yes** — at least one OCR text edit | `type 2, status 1` (skipped if recalculation throws) |
| Evaluation | Quick Approve ON | Approval is implicit in saving a manual mark or submitting a re-evaluation | `type 3, status 1` |

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/review-workflow-approved-row.png — a candidate row after all three stages are approved]
