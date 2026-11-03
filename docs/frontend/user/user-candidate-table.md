# Candidate Table

The candidate table is shown inside a selected workspace in `src/pages/OCREvaluation.tsx` (~L9081–10766). This page covers the data load, columns, status mapping, filters, selection, row actions, the candidate info dialog, polling, deletion and the **Download** (Excel) export.

The review dialogs that open from status badges (Segmentation/Indexing, OCR, Evaluation, Re-evaluation) are documented in [user-review-and-evaluation.md](./user-review-and-evaluation.md).

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-candidate-table.png — Evaluation Results table with status widgets, search, status filter, Delete and Download buttons]
[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-candidate-table-folders.png — Table grouped by folder with an expanded category row]

## 1. Page sections (selected workspace)

```text
Breadcrumb  …› Subject › <Workspace>
Workspace header card  (name · n Candidate(s) · "The page refreshes in Ns" · Upload Additional Files · Workspace ▼)
[hasUploaded && candidates.length>0]  Status widgets: Total | Segmentation/Indexing | OCR | Evaluation
[hasUploaded && candidates.length===0] "Candidate answer scripts getting uploaded." / "System is loading scripts to start evaluation sequentially."
[hasUploaded && candidates.length>0]  "Evaluation Results" card
    Search · Status filter
    "Showing …" · Delete · Download
    Table
```

## 2. Data load: `loadCandidatesForWorkspace`

`loadCandidatesForWorkspace(workspace, { silent?, force? })` (~L4688):

| Aspect | Detail |
|---|---|
| Skip guard | Returns immediately when any loader is active (`pageLoading`, upload/validation flags, `candidateInfoLoading`, review saves, `phase1Loading`, `isUploading`, `isCreatingWorkspace`, `isValidatingName`, `isUploadingAddedFiles`, `isBackgroundUploading`), unless `force` |
| Non-silent | `pageLoading=true`, `hasUploaded=false`, `candidates=[]` |
| Request | `GET ${API_BASE1}/candidate-process-data` params `OrgCode, CustCode, UserCode` (`getFinalCodes`), `SubjectCode` (`'generic'` in standalone, else `resolveSubjectCode() \|\| 'S1'`), `WorkspaceId` (numeric workspace id, else `sessionStorage.workspaceid \| workspacesid`, else 0). No-cache headers. Writes `sessionStorage.workspaceid` |
| `summary[]` fields | `userCode \| usercode \| UserCode \| createdby \| createdBy` (first row → `selectedWorkspace.userCode`, used for ownership); `folderName \| foldername`, `candidateCount`, `totalCandidateCount` (→ `uploadedFolders`); `totalTokenUsage` |
| `details[]` fields | `registrationNumber` (→ `id`, `candidateName`, `registrationName`); `segmentationStatus`, `approvedStatus`, `ocrStatus`, `markingStatus`; `processData \| processdata \| data[0].processdata` → `final_score`; `obtainedScore \| obtainedscore \| score \| final_score.obtained_score \| finalscore`; `maxScore \| maxscore \| final_score.max_score`; `standardCount`, `metStandardCount`; `isReview`, `noqMarker`, `multiqMarker`; `folderName` (→ `category`); `userCode` |
| State | `candidates`, `hasUploaded=true`, `selectedWorkspace` (updated `candidateCount`, `uploadedFolders`, `totalTokenUsage`), `workspaces[i]`, `folderName`/`fileCount`/`totalFileSize`, `inProgressSince` |
| Stop rule | When every `details[].markingStatus === 2` → `stopCandidatePolling()` (see §8 caveat) |
| Error | Non-silent only: toast "Failed to load candidate data, showing sample data instead" and **mock candidates** from `generateMockCandidates`. Silent errors are logged only |
| `centreName` | Always the workspace name; `centreAddress` is `''` |
| `evaluationData` | Always `generateMockEvaluationData()` (placeholder object) |

## 3. Status mapping

### 3.1 Backend code → `PhaseStatus`

`mapStatusCodeToPhaseStatus(code, phase)` (~L4795):

| Backend code (`segmentationStatus` / `ocrStatus` / `markingStatus`) | `PhaseStatus` |
|---|---|
| `3` | `pending` |
| `2` | `completed` |
| `1` | `in-progress`. Exception: Segmentation-only configuration, phase1 → `completed` |
| `0`, `4`, missing or other | `yet-to-segmentation` / `yet-to-ocr` / `yet-to-evaluation` |

Phase 1 override: `approvedStatus === 1` **and** base `pending` → `approved`.

Display overrides: when `noqMarker === 1`, the OCR and Evaluation cells show `stopped` regardless of status.

### 3.2 `PhaseStatus` → badge (`StatusBadge`, ~L449)

| Status | Label | Colour | Icon |
|---|---|---|---|
| `yet-to-segmentation` | Yet to Segmentation | slate | none |
| `yet-to-ocr` | Yet to OCR | slate | none |
| `yet-to-evaluation` | Yet to Evaluate | slate | none |
| `in-progress` | In Progress | blue | spinner |
| `pending` | **Approved** | teal | none |
| `approved` | Approved | teal | none |
| `completed` | Completed | emerald | none |
| `stopped` | Stopped | red | none |
| anything else | Unknown | gray | none |

A badge is **clickable** only for `completed`, `pending` or `approved`. Otherwise it is a disabled button wrapped in a span with the tooltip "<label> - available once this stage is completed".

> Note: backend status `3` (`pending`) and `approved` both read "Approved". The status filter's **Approved** option matches only `approved`, so rows showing "Approved" because of status 3 are not returned by that filter.

### 3.3 Other chips and markers

| Element | Rule |
|---|---|
| Phase 1 markers (after the label, eligible phases only) | `isReview===1` → red triangle "Review Required"; `noqMarker===1` → orange `?` "No Question Marker"; `multiqMarker===1` → indigo "Multi Question Marker" |
| Standards chip (OCR cell) | Phase 2 in completed/approved/pending and `apiConfig.ocrConfig.StandardsMetCount !== false` → `met/total` from `metStandardCount/standardCount` |
| Score chip (Evaluation cell) | `evaluationMarks` is set only when phase3 is completed/approved/pending and a score exists → `marks/maxMarks`. Colour from `getEvaluationScoreChipClasses` (~L553): threshold = `evaluationConfig.subjectOverrides[subjectCode].passMarkThreshold` → `globalThresholds.passMarkThreshold`; `% ≥ threshold` → emerald, below → red, no threshold → slate. It is a button opening Evaluation review in the folder-grouped branches, and a plain `<div>` in the flat (no-folder) branch |
| Workspace status pill | see [user-workspaces.md §6.2](./user-workspaces.md#62-workspace-card) |

## 4. Status widgets

| Widget | Visible when (effective stages) | Value |
|---|---|---|
| Total | always | With summary folder totals: `Σ folder.candidateCount / max(folder.totalCandidateCount)`; else `n / n` |
| Segmentation / Indexing / Segmentation Indexing | `segmentation \|\| indexing` | count with phase1 ∈ {completed, pending, approved} / n |
| OCR | `ocr` | phase2 ∈ {completed, pending, approved} / n |
| Evaluation | `evaluation` | phase3 ∈ {completed, pending, approved} / n |

## 5. Columns

| Column | Visible when | Content | Source |
|---|---|---|---|
| ☐ (select) | always | Row checkbox; disabled with tooltip "This workspace belongs to another user" when `!isSelectable` | `details[].userCode` |
| Candidate Number(s) | always | `candidateName` (= registration number). Button → `openCandidateDetails` when `!apiConfig.standalone && apiConfig.segmentationConfig.CandidateInfo !== false`, plain text otherwise | `registrationNumber` |
| `segmentationLabel` ("Segmentation" / "Indexing" / "Segmentation Indexing") | effective `segmentation \|\| indexing` | phase1 badge + markers → `handleOpenPhase1Review` | `segmentationStatus`, `approvedStatus` |
| Video file / Length | `isVideoCandidateTable`: workspace is video-kind (`standardCount===2`) **and** effective stages are exactly `{ocr:true, evaluation:true, segmentation:false, indexing:false}` | File name and `mm:ss` length (both `—` if absent) of the candidate's first video answer | Read from this same `candidate-process-data` response's `processData.ocr_extracted_text` — first `.mp4` path found, length from that entry's last `segments[].end` |
| OCR | effective `ocr` | phase2 badge (or Stopped) → `handleOpenOcrReview`; standards chip; **Rerun** when `rawOcrStatus === 4` | `ocrStatus`, standards |
| Evaluation | effective `evaluation` | phase3 badge (or Stopped) → `handleOpenEvaluationReview`; **Rerun** when `rawMarkingStatus === 4`; score chip | `markingStatus`, score fields |
| Quick Approve | `!hideQuickApproveColumn` (hidden for Segmentation-only and Standalone OCR-only) | `renderQuickApproveToggle` | see §7.3 |

`TableCell colSpan={6}` is fixed for the empty and folder rows even when fewer columns are shown (now potentially 2 short when the Video file/Length columns are also visible).

### Row grouping

| `selectedWorkspace.uploadedFolders` | Candidates with `category` | Rendering |
|---|---|---|
| empty | – | Flat list |
| non-empty | none | Flat list |
| non-empty | some | One collapsible folder row per category (colour cycles amber/purple/blue by index; auto-expanded while a search is typed), then uncategorised rows |

Expansion state is `expandedCategories`. Empty filter result → "No candidates found matching your filters".

## 6. Search and filter

| Control | Visible | Logic |
|---|---|---|
| Search ("Search by candidate number...") | always | `candidateName.toLowerCase().includes(searchQuery)` |
| Status filter | hidden when `hideStatusFilter` (Segmentation-only or Standalone) | Options: All Status, Completed, In Progress, Approved, and per effective stage "Yet to Indexing" (`yet-to-segmentation`), "Yet to OCR", "Yet to Evaluate". A row matches when **any** phase equals the value (`phaseFilter` is always `'all'`; its dropdown is commented out) |
| Marks sort | shown only when effective `evaluation` is on | Options: None (table order unchanged), Ascending, Descending — sorts the already-filtered rows by `evaluationMarks`. Candidates with no score yet (not completed/pending/approved, so `evaluationMarks` is `undefined`) always sink to the end regardless of direction |

The Status filter and Marks sort both reset (`'all'` / `'none'`) when the workspace changes or, for Marks sort, whenever `evaluation` turns off.

## 7. Selection and row actions

### 7.1 Selection

| Element | Behaviour |
|---|---|
| Header checkbox | `allSelected` = every filtered selectable row is selected; toggles `selectedCandidates` over `filteredSelectableCandidates` |
| Row checkbox | Adds/removes the id; ignored for non-selectable rows |
| Counter | "Showing n candidate(s)" (or "Showing k folder(s) of n candidate(s)") + "(m selected)" |

`selectedCandidates` is **not** cleared on workspace switch or back-to-list. It is cleared after delete or export.

### 7.2 Row actions

| Action | Trigger | API | Doc |
|---|---|---|---|
| Open Segmentation/Indexing review | phase1 badge (clickable states) | get-process-data etc. | [user-review-and-evaluation.md](./user-review-and-evaluation.md) |
| Open OCR review | phase2 badge | get-process-data type 2 | [user-review-and-evaluation.md](./user-review-and-evaluation.md) |
| Open Evaluation review | phase3 badge / score chip | get-process-data type 3 | [user-review-and-evaluation.md](./user-review-and-evaluation.md) |
| **Rerun OCR** | `rawOcrStatus === 4` and not NOQ | `POST ${API_BASE}/run-ocr` `{ orgcode, custcode, usercode, subjectcode, workspaceid, regnumber }` (`handleRunOcr`, ~L6252) → toast "OCR triggered for <reg>" → silent reload. Error toast "Failed to trigger OCR for <reg>. Please try again." Sets `pageLoading` during the call | – |
| **Rerun Evaluation** | `rawMarkingStatus === 4` and not NOQ | `GET get-process-data` (`type:2, adstatus:0`), then `POST ${API_BASE}/run-evaluation` `{ isall:1, questions:[], userprompt:'', … }` (`handleRunEvaluation`, ~L6306). The questions array is built from OCR text but **not sent** | – |
| Stalled restart | `isCandidateStalled()` | Always returns `false`, so it never shows | – |
| Candidate details | candidate-number link | §9 | – |

### 7.3 Quick Approve toggle

`renderQuickApproveToggle` (~L5073) and `handleQuickApproveChange` (~L5053):

| Rule | Detail |
|---|---|
| Initial value | `eligible = rawMarkingStatus >= 2 \|\| isReview \|\| noqMarker \|\| multiqMarker`; `quickApprove = eligible ? persisted : false`; `noqMarker===1` → forced `true` |
| Persistence | sessionStorage `icme_ocr.quickApprove.<workspaceId>` (JSON map id→true). Ineligible ids are pruned on refresh |
| Disabled | Any enabled stage incomplete (`yet-to-*`/`in-progress`, NOQ excepted), a rerun in flight, or NOQ. Tooltips: "Not available: No Question Marker detected", "Not available while phase(s) are incomplete", "Not available during rerun" |

What Quick Approve unlocks inside the review dialogs is covered in [user-review-and-evaluation.md](./user-review-and-evaluation.md).

## 8. Polling

| Item | Detail |
|---|---|
| Interval | `CANDIDATE_POLL_INTERVAL_MS = 30_000` (~L888) |
| Start | `startCandidatePolling(ws)` (~L5117): clears any existing interval and calls `loadCandidatesForWorkspaceRef.current(ws, {silent:true})` every 30 s. Called on workspace card click, Workspace dropdown change, first upload response and Standalone Create & Extract. Also called by the dialog effect (~L5155) whenever `selectedWorkspace` changes and no dialog is open |
| Countdown | A 1 s interval computes `pollCountdown` from `candidateNextPollAtRef`. Shown as "The page refreshes in N second(s)" |
| Pause | While any of: create dialog, upload confirm, added-files, folder-files, re-upload, re-evaluation, save-confirm, eval-info, phase1/OCR/evaluation review, candidate details or standards dialog is open |
| Stop | `stopCandidatePolling()` on back-to-list, unmount, `cancelUpload`, all `markingStatus === 2`, or `uploadCompletedFiles >= uploadTotalFiles` |
| Skips | A tick does nothing while any loader is active (§2 skip guard) |

> Caveat: every load calls `setSelectedWorkspace(updatedWorkspace)` (a new object), which re-runs the dialog/polling effect and **restarts** polling. A "stop" from the all-marked rule or the upload-complete rule is likely undone on the next render, and each restart also re-fetches `get-config-info`. Needs runtime verification.

## 9. Candidate info dialog

`openCandidateDetails(candidate)` (~L7097) → `<Dialog open={!!detailCandidate}>` (~L12323)

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-candidate-details.png — Candidate Details dialog]

| Aspect | Detail |
|---|---|
| Gate | Link active only when `!apiConfig.standalone && apiConfig.segmentationConfig.CandidateInfo !== false` |
| Request | `GET ${API_BASE1}/get-candidate-info` params `registrationnumber`, `workspaceid` |
| Fields | `firstName`, `lastName`, `centerName \| centreName`, `centerAddress`, `dateOfExamination`, `countryName` (camel- or lower-case) |
| UI | First Name, Last Name, Centre Name (fallback: workspace name), Centre Address, Date Of Examination, Country. "Loading..." while `candidateInfoLoading`, "N/A" when empty. Close button (X) only |
| Errors | Empty `{}` → all "N/A". No toast |

## 10. Delete candidates

| Step | Detail |
|---|---|
| Button | **Delete** (destructive), hidden for superadmin, disabled with tooltip "Please select at least one candidate to delete." when nothing is selected |
| Confirm | `AlertDialog showDeleteConfirmDialog` (~L16690): "Delete selected candidate(s)? This action cannot be undone. It will permanently delete N candidate(s) from this workspace." plus a list. Cannot be closed while deleting |
| Call | `confirmDeleteSelectedCandidates` (~L3711): `POST ${API_BASE1}/delete-candidate` `{ orgcode, custcode:'ICME', usercode, workspaceid, subject_id: resolveSubjectCode(), registrationnumber: "<reg>,<reg>" }` |
| Success | `res.data.success \|\| res.status === 200` → removes rows locally, decrements `candidateCount`, toast "Successfully deleted". Because any HTTP 200 counts, a backend-side refusal inside a 200 body still shows success |
| Failure | toast "Failed to delete candidates" |

## 11. Download (Excel export)

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-candidate-download.png — Download button with tooltip, and the resulting workbook tabs]

### 11.1 Visibility and enablement (~L9500–9952)

| Rule | Detail |
|---|---|
| Hidden | `standaloneMode && isSegmentationOnly` |
| `isDownloadReady(c)` | For each enabled effective stage the raw status must be ≥ 2 (seg/idx → `rawSegmentationStatus`, OCR → `rawOcrStatus`, evaluation → `rawMarkingStatus`) |
| `allDownloadable` | No selection → true; otherwise every selected id must exist in `candidates` and be download-ready |
| `requireEvaluation` | `standaloneMode && !(apiConfig.workflowStages.evaluation ?? true)` |
| Disabled | `!allDownloadable \|\| requireEvaluation \|\| downloadExportLoading` |
| Tooltip | Enabled: "Download". Disabled: "Download is only available when evaluation is enabled." / "Download all candidates data." / "Download is enabled only when segmentation, OCR, and marking statuses are 2 or 3." |

> Because the selection survives a workspace switch, stale ids that are not in the new `candidates` make `allDownloadable` false and leave the button disabled until the selection is cleared.

### 11.2 Request (paginated)

`GET ${API_BASE1}/get-all-data-exports` params `OrgCode` (`sessionStorage.orgCode \| orgcode \| org` → `'ICME01'`), `CustCode='ICME'`, `SubjectCode = resolveSubjectCode() \|\| selectedSubject \|\| 'S1'`, `WorkspaceId`, `PageNumber` from 0. It loops until a page is empty, the collected count reaches the first page's `totalcount`, or `MAX_PAGES = 200`. Rows: `res.data.data[]` with `registrationnumber`, `candidateid`, `workspacename`, `activestage`, `indexingdata`, `ocrdata`, `evaluationdata` (JSON strings; parse failures → null).

With a selection, records are filtered by `registrationnumber`. Empty → toast "No data available to export".

### 11.3 Workbook (ExcelJS)

Question columns come from the current `questions` state (sorted ids). Sheets are added **only when they have data rows**.

| Sheet | Header | Row source | Notes |
|---|---|---|---|
| `ObtainedScore` | `Reg Number`, `Q<id>…`, `Total Score` | Records with `evaluationdata`; `questions[].questionid → obtainedscore` (text before "/" parsed as number); `totalscore` | Column width 15, centred |
| `Evaluation Details` | `Reg Number`, `Workspace Name`, then `Q<id>_Score`, `Q<id>_Missing Points`, `Q<id>_Feedback` | `evaluationdata.evaluateddata.eval_data[q]`: `marks_awarded`, `missing_points[].how_to_improve` (newline-joined), `feedback`; missing → "N/A" | Text columns width 40, wrapped |
| `Indexing & OCR Data` | `PDFName`, `PageName`, `Tagged QID`, `OCR`, `Stage` | One row per page: `indexingdata` (`segment_data \| segmentdata \| array` with `qid \| Qid`, `image_path \| imagepath`), then `ocrdata.ocr_extracted_text` keys for untagged images, then `pages_to_review` and `blank_pages` as `none`. Sorted by page number | **OCR column dropped** when every OCR cell is blank. `Stage` = `activestage` → "Indexing" / "OCR" / "Evaluation". OCR text via `readQuestionOcrText` (`.transcription` for objects) |

Header style: white bold on `FF1F384C`, thin grey borders. If no sheet has data → toast "No data available to export". File name: `<sessionStorage.subjectcode \| subjectCode \| selectedSubject>_<workspace name>.xlsx`. Success toast "Downloaded N candidate(s) data" / "Downloaded all candidate data"; selection cleared. Any exception → toast "No evaluation data available to export". Loader: `downloadExportLoading` (PageLoader).

A CSV `handleDownload` helper (~L9373) is defined but not wired to any button.

## 12. Empty, loading and error states

| State | Rendering |
|---|---|
| Opening a workspace (non-silent load) | `<PageLoader />` |
| `hasUploaded && candidates.length === 0` | "Candidate answer scripts getting uploaded." card (also shown when the backend simply returns no rows) |
| Filters exclude all rows | "No candidates found matching your filters" |
| Load error (non-silent) | toast + **sample (mock) candidates** |
| Export / delete / rerun errors | toasts as listed above |
