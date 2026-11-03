# API Mapping — Review, Approval and Evaluation Layer

All endpoints called by the review dialogs, the standalone OCR popup and the related table actions.

Base variables (top of `src/pages/OCREvaluation.tsx`):

| Variable | Env var | Notes |
|---|---|---|
| `API_BASE` | `VITE_ICMEPRODUCT_API_BASE` | hardcoded fallback host if unset |
| `API_BASE1` | `VITE_AIMARKING_API_BASE` | hardcoded fallback host if unset |
| `IMAGE_BASE` | `VITE_REPO_BASE` + `/` | hardcoded fallback host if unset; used to build page image URLs |
| `DEFAULT_ENDPOINT` (`src/lib/extraction.ts`) | `VITE_AIAPPS_API_BASE` + `/AITranscription/extract` | hardcoded fallback host if unset |

Calls that do not go through `API_ENDPOINTS`: `get-config-info` is built inline from `API_BASE1` (~L7809, ~L15616) or directly from `import.meta.env.VITE_AIMARKING_API_BASE` with its own fallback (~L1115, ~L3153); `run-ocr` is called as `${API_BASE}/run-ocr` (~L6280). All axios calls use no explicit auth header.

Global API mapping: [../api/api-integration-mapping.md](../api/api-integration-mapping.md).

---

## 1. Endpoint table

| # | API | File / function | Trigger | Key request fields | Response fields used | State written | UI element |
|---|---|---|---|---|---|---|---|
| 1 | `GET {API_BASE1}/get-process-data` **type 1** | `OCREvaluation.tsx` → `fetchProcessDataForCandidate(c, 1)` | Phase 1 badge → `handleOpenPhase1Review`; refresh after Phase 1 approve; dialog-open effect | `orgcode, custcode='ICME', usercode, type:1, registernumber, subjectcode ('generic' in standalone), workspaceid, adstatus:0` | `data[0].processData\|processdata`: `segmentdata`/`segment_data`, `blank_pages`, `noqMarker`, `pages_to_review`, `auto_mapped_pages`, `total_pages`, `status`, `registration_number`, `unanswered_questions`, `questions_answered`, `ocr_extracted_text`, `standards_evaluation`, `summary` | `phase1IndexingRecord`, `phase1OriginalIndexingRecord`, `answerSheets`, OCR maps, standards | Segmentation/Indexing dialog |
| 2 | `GET … get-process-data` **type 1** (no-cache) | `handleApprove` (OCR) | OCR Approve | same | `segment_data[] {qid, image_path[]}` | local `alignedOcrText` | — |
| 3 | `GET … get-process-data` **type 2** | `fetchProcessDataForCandidate(c, 2)` | OCR badge → `handleOpenOcrReview`; refresh after OCR approve | `type:2` | envelope `candidateId, workspaceid, remainingCount, totalCandidateCount, scriptPath`; `processData.ocr_extracted_text`, `standards_evaluation`, `summary`, mapping | `ocrSaveMeta`, `ocrExtractedTextByQuestion(Raw)`, `ocrOriginalExtractedTextByQuestionRaw`, `ocrImageUrlToRawPathByQuestion`, standards | OCR Preview dialog |
| 4 | `GET … get-process-data` **type 2** | `handleOpenOcrReview` (standalone branch) | OCR badge in Standalone OCR-only | `orgcode (''), custcode, usercode (''), type:2, registernumber, subjectcode:'generic', workspaceid (string), adstatus:0` | `processData.ocr_extracted_text` (string or rich object) | `standaloneOcrPopupData` | Standalone OCR Review popup |
| 5 | `GET … get-process-data` **type 2** (no-cache) | `handlePhase1Approve` | Phase 1 Approve when `ocr` stage enabled | `type:2` | `ocr_extracted_text`, `summary`, `standards_evaluation`, envelope counters | — (used to build save-ocr-data) | — |
| 6 | `GET … get-process-data` **type 2** | `handleRunEvaluation` | Evaluation **Rerun** (markingstatus 4) | `type:2` | `ocr_extracted_text` (built into a `questionsArray` that is never sent) | — | — |
| 7 | `GET … get-process-data` **type 3** | `fetchProcessDataForCandidate(c, 3)` | Evaluation badge/chip; refresh after score save and re-evaluation | `type:3` | whole `processData`; `eval_data`, `all_questions_ranked[q].manual_marking`, `final_score.obtained_score/max_score`, mapping | `evaluationProcessData`, `evaluationSaveMeta`, `evaluationDataMap`, `evaluationReviewCandidate.evaluationMarks/maxMarks` | Evaluation Preview |
| 8 | `GET … get-process-data` **type 3** (no-cache) | `handlePhase1Approve`, `handleApprove` cleanup | after recalc when changed questions lost images, or none had images | `type:3` | whole `processData` | — | — |
| 9 | `POST {API_BASE}/save-indexing-info` | `savePhase1Mapping(record, true)` | Phase 1 Approve (mapping changed) | `orgcode, custcode, usercode, type:1, registrationnumber, subjectcode, workspaceid, metstandardcount, is_review, indexdata{status:'completed', orgcode, custcode, is_update:0, workspace_id, blank_pages, segment_data[{qid,image_path,segment_id:[0]}], subjectcode, total_pages, pages_to_review, total_questions, auto_mapped_pages, questions_answered, unanswered_questions}` | none | — | toast "Mappings saved" |
| 10 | `POST {API_BASE}/save-ocr-data` | `handlePhase1Approve` | Phase 1 Approve with OCR stage | `custcode, orgcode, usercode, registrationnumber, workspaceid, ocrdata{summary, ocr_extracted_text (rebuilt for new mapping), standards_evaluation}, remainingcount, totalcandidatecount, scriptpath` | none | sessionStorage phase2 key | — (silent) |
| 11 | `POST {API_BASE}/save-ocr-data` | `handleApprove` | OCR Approve | same shape; `ocr_extracted_text` aligned to type 1 `segment_data`; counters from `ocrSaveMeta` | HTTP status (200/201/204) | — | toast on failure |
| 12 | `POST {API_BASE}/recalculate-standards` | `postRecalculateStandards` (called by `handlePhase1Approve`, `handleApprove`) | after #10/#11 when **not** `standaloneMode` | `orgcode, custcode, usercode, isall (0 if changed questions with images exist else 1), registrationnumber, subjectcode, workspaceid, questions[], userprompt:'', processdata (=ocrdata)`; skipped entirely when `isall=0` and no question has images | none | — | — |
| 13 | `POST {API_BASE}/save-evaluation-data` | `saveFilteredEvaluationDataWithoutImagePaths` | cleanup after #12 (see #8) | `orgcode, custcode, obtainedscore (Top-N), evaluateddata (processData with filtered+ranked eval_data, final_score.obtained_score), questiondetails[{Qid,maxscore,obtainedscore,rank}], maxscore (final_score.max_score), registrationnumber, subjectcode, workspaceid` | none | — | — |
| 14 | `POST {API_BASE}/save-evaluation-data` | `saveEvaluationScoreOnServer` | Evaluation **Confirm & Save** | as #13 plus updated question `marks_awarded`/`manual_marking`, `maxscore` = question max, `manual_marking` string | none | — | toast on failure |
| 15 | `POST {API_BASE}/update-status` | `handlePhase1Approve` | end of Phase 1 Approve | `{registrationnumber, workspaceid, type:1, status:1}` | none | — | — |
| 16 | `POST {API_BASE}/update-status` | `handleApprove` | after OCR recalc/cleanup | `{…, type:2, status:1}` | none | — | toast on failure |
| 17 | `POST {API_BASE}/update-status` | Confirm & Save handler (~L15829) | after #14 | `{…, type:3, status:1}` | none | — | — |
| 18 | `POST {API_BASE}/update-status` | `submitReEvaluationRequest` | after re-evaluation submit + refreshes | `{…, type:3, status:1}`, header `Content-Type: application/json` | none | — | — |
| 19 | `POST {API_BASE}/update-status` | `handleRestartEvaluation` | "Stalled" button (never rendered) | `{…, type:3, status:2}` | none | — | — |
| 20 | `POST {API_BASE}/run-evaluation` | `submitReEvaluationRequest` | Re-evaluation dialog **Submit** | `orgcode, custcode, usercode, isall (1 all / 0 one), registrationnumber, subjectcode, workspaceid, questions ([] or [qid]), userprompt` | HTTP status (200/201/204) | — | toasts |
| 21 | `POST {API_BASE}/run-evaluation` | `handleRunEvaluation` | Evaluation **Rerun** | `isall:1, questions:[], userprompt:''` (+ codes; subjectcode 'generic' in standalone) | none | — | toasts |
| 22 | `POST {API_BASE}/run-evaluation` | `handleRestartEvaluation` | unreachable | `isall:1` | none | — | — |
| 23 | `POST ${API_BASE}/run-ocr` | `handleRunOcr` | OCR **Rerun** (ocrstatus 4) | `orgcode, custcode, usercode, subjectcode, workspaceid, regnumber` | none | — | toasts |
| 24 | `GET {API_BASE1}/get-config-info?OrgCode&CustCode&AppCode=AImarking` (fetch, `no-store`) | `handlePhase1Approve` | Phase 1 Approve | query only | array / `.value` / `.Data` → `[0].configSetting.workflowStages` | local `latestWorkflowStages` (decides OCR sync) | — |
| 25 | same, fetch `no-store` | Confirm & Save handler (~L15616) | Evaluation Confirm & Save | query only | `evaluationConfig.globalThresholds.topQuestionsCount`, `evaluationConfig.subjectOverrides[].topQuestionsCount` | local `newTotal` | header score / table chip (optimistic) |
| 26 | same, fetch | effects at ~L3146 (workspace selected) and ~L1102 (create dialog opened) — owned by [workspaces](./user-workspaces.md) | — | query only | `[0].configSetting` → `apiConfig`, `workflowStages`, `standalone` | `apiConfig` (pass-mark thresholds, Top-N, `ocrConfig.StandardsMetCount`, `segmentationConfig.CandidateInfo`), localStorage `workflowStages`, `standalone_mode` | chip colour, Standards credits visibility |
| 27 | `GET {API_BASE1}/get-candidate-info` | `loadSegmentationOnlyPages` | Phase 1 badge in Segmentation-only workspace | `registrationnumber, workspaceid` | `[0].scriptPath\|scriptpath` (array or `data[]`) | `answerSheets` (after image probing) | Segmentation dialog |
| 28 | `GET {IMAGE_BASE}<scriptPath>/<n>.png` (via `Image()`) | `probeSequentialImages` | after #27 | — | load/error only | `answerSheets` | page viewer |
| 29 | `fetch(<image URL>)` (+ dev-proxy same-origin path) | `fetchImageBlob` | Segmentation-only Download buttons | — | blob | — | ZIP / file download |
| 30 | `POST {DEFAULT_ENDPOINT}` (`/AITranscription/extract`) multipart | `src/lib/extraction.ts` → `runExtraction` | `ScriptExtractorPanel.handleExtract` (no UI trigger in current source); also the standalone create flow | `subject, file, verify, interpret, line_mode, insertion_pass, strict_maths, q_filter` | `<fileName>.{subject, blocks, transcription, transcription_latex, interpretation, issues, insertions_placed, figure_counts}`, top-level `tokens` | `result` | Output tabs |
| 31 | `GET <image URL>` (same-origin path first, then absolute) | `urlToFile` | before #30 when no file given | — | blob | — | — |
| 32 | `GET {API_BASE1}/candidate-process-data` | `loadCandidatesForWorkspace(ws, {silent:true})` — owned by [candidate table](./user-candidate-table.md) | after every approve/save/re-eval/rerun and on Evaluation dialog close | — | — | `candidates` | table |

---

## 2. Error handling per API

Legend: **T** = toast shown, **W** = `console.warn` only (silent to user), **E** = `console.error` only.

| API (row #) | HTTP / network error | Empty / unexpected data | Status codes (S001/S002/F001) |
|---|---|---|---|
| get-process-data via `fetchProcessDataForCandidate` (1, 3, 7) | **T** "Failed to load segmentation data" (same text for OCR and Evaluation); record/pages cleared. Abort (`CanceledError`) silent. | `res.data` falsy → **T** "Empty segmentation response". No `data[]` → whole body treated as processData. Stale responses dropped silently. | not checked |
| get-process-data standalone (4) | **T** `response.data.message` \|\| message \|\| "Failed to fetch process data for standalone OCR" | missing processData → **T** "Missing process data"; no OCR → popup with "No OCR data found for this candidate." | not checked |
| get-process-data type 1 in OCR approve (2) | **W** "Failed to fetch indexing mapping…" → falls back to raw OCR map | empty `segment_data` → raw map | not checked |
| get-process-data type 2 in Phase 1 approve (5) | **W** "Indexing saved but OCR sync failed" (toast commented out) — save-ocr-data, recalc and cleanup are skipped, `update-status` still sent | missing OCR → empty rebuilt texts are saved | not checked |
| get-process-data type 3 cleanup (8) | **W** "Failed to save filtered evaluation data…" | no processData → `saveFiltered…` returns without request | not checked |
| save-indexing-info (9) | **W** + **T** "Failed to save mappings"; approval aborts | — | response not read |
| save-ocr-data in Phase 1 approve (10) | **W** (silent) | — | not read |
| save-ocr-data in OCR approve (11) | **E** + **T** "Failed to save OCR data. Please try again." | non-2xx (200/201/204) → **T** "Failed to save OCR data (status N)" | not read (unlike the create flow, which accepts S001/S002) |
| recalculate-standards (12) | Phase 1: **W** "OCR saved but recalculation failed". OCR approve: **W** + **T** "OCR saved, but recalculation failed. Please try again." and `update-status` skipped | `null` (no request) when nothing to recalc | not read |
| save-evaluation-data cleanup (13) | **W** | — | not read |
| save-evaluation-data score (14) | **E** + **T** "Failed to save evaluation score to server. Please try again." (optimistic UI stays; success toast still shown afterwards) | missing processData → thrown → same toast | not read |
| update-status (15) | **W** "Failed to update status (type=1)" | — | not read |
| update-status (16) | **W** + **T** "Recalculation succeeded but updating status failed. Please try again." | — | not read |
| update-status (17) | **W** "Manual marking saved but update-status (approved) failed" | — | not read |
| update-status (18) | **E** "Failed to  update status" | — | not read |
| run-evaluation re-eval (20) | **E** + **T** "Failed to submit re-evaluation request. Please try again." | non-2xx (200/201/204) → **T** "Failed to submit re-evaluation (status N)" | not read |
| run-evaluation rerun (21), run-ocr (23) | **E** + **T** "Failed to trigger evaluation/OCR for `<reg>`. Please try again." | — | not read |
| get-config-info (24) | **W** "Failed to fetch latest workflow stages during approve" → uses in-memory `workflowStages` | non-OK → in-memory value | — |
| get-config-info (25) | **E** "Failed to calculate top N total, falling back to sum" → `baseTotal + delta` | `res.json()` called without `ok` check | — |
| get-candidate-info (27) | **E** + **T** "Failed to load candidate information" | no scriptPath / no pages → **T** "No segmented images available." | — |
| image fetch (29) | **E** + **T** "Failed to download image(s)"; per-page failures in ZIP **W** "Skipped image…" | `text/*` blob rejected | — |
| AITranscription/extract (30/31) | thrown `Error(payload.detail \|\| 'Extraction request failed.')`; CORS → explicit message; panel shows red banner + **T** | non-JSON body → `{detail: text \|\| "HTTP <status>: <statusText>"}`; missing fields default to empty | — |

### Status codes found in source

| Code | Where | Meaning in code |
|---|---|---|
| `S001` | `assertStepSucceeded` (~L2593), create-workspace (~L1825), delete (~L5022) | success / created |
| `S002` | create flow `save-ocr-data` (~L3016) | "OCR record already existed and was updated" — success |
| `F001` | create-workspace (~L1819) | workspace name already exists |

None of these codes are checked by any API call in the review layer.

### `update-status` numeric values used

| `type` | `status` | Sent from | Meaning (as evidenced by code / comments) |
|---|---|---|---|
| 1 | 1 | Phase 1 Approve | Segmentation/Indexing approved (comment "segmentation/indexing approved") |
| 2 | 1 | OCR Approve | OCR approved (comment "OCR approved") |
| 3 | 1 | Score save, re-evaluation submit | Evaluation approved (comment "Evaluation Approved (type=3, status=1)") |
| 3 | 2 | `handleRestartEvaluation` (unreachable) | Implementation behavior could not be conclusively determined from the current frontend source. The adjacent comment says "status=0 = rerun" while the code sends `2`; commented-out code elsewhere labels `status: 2` as "in-progress". |

---

## 3. Silent-failure hot spots

These catches log to the console only and leave the user believing the step succeeded:

1. Phase 1 Approve → entire OCR sync block (type 2 fetch, `save-ocr-data`, `recalculate-standards`, type 3 cleanup) — `console.warn`, toasts commented out (~L8022–L8029).
2. Phase 1 Approve → `update-status type 1` (~L8040).
3. Score save → `update-status type 3` (~L15835).
4. Re-evaluation → `update-status type 3` (~L6898).
5. `saveFilteredEvaluationDataWithoutImagePaths` failures in both approve flows.
6. `savePhase1Mapping` sessionStorage write failure (`console.warn`) — later causes the Approve pre-check to fail with "Please Modify at least one image…".

See also: [overview](./user-review-and-evaluation.md) · [workflow](../workflows/review-and-approval-workflow.md).
