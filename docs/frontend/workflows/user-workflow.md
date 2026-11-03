# User (Evaluator) Workflow: Full Narrative

This document follows an evaluator from sign-in to export. It is derived from `src/pages/Login.tsx`, `src/pages/SubjectDashboard.tsx` and `src/pages/OCREvaluation.tsx`. Field-level details live in the user docs:

- [../user/user-dashboard.md](../user/user-dashboard.md)
- [../user/user-workspaces.md](../user/user-workspaces.md)
- [../user/user-create-workspace-and-upload.md](../user/user-create-workspace-and-upload.md)
- [../user/user-candidate-table.md](../user/user-candidate-table.md)
- [../user/user-review-and-evaluation.md](../user/user-review-and-evaluation.md)
- [../user/user-api-mapping-workspace.md](../user/user-api-mapping-workspace.md)
- API catalogue: [../api/api-integration-mapping.md](../api/api-integration-mapping.md)

Base constants: `API_BASE` = `VITE_ICMEPRODUCT_API_BASE`, `API_BASE1` = `VITE_AIMARKING_API_BASE`.

```text
┌────────┐   ┌──────────────┐   ┌──────────────┐   ┌───────────┐   ┌────────────────┐   ┌──────────────┐   ┌────────┐
│ Login  │──►│ Year / Cycle │──►│   Subject    │──►│ Workspace │──►│ Create+Upload  │──►│ Stage polling│──►│ Review │──► Export
└────────┘   └──────────────┘   └──────────────┘   └───────────┘   └────────────────┘   └──────────────┘   └────────┘
   │ standalone ────────────────────────────────────────►┘
```

---

## Step 1: Login

| Item | Detail |
|---|---|
| Start point | `/` or `/login` (`Login.tsx`) |
| Action | Submit credentials |
| API | Login API (see [../architecture/](../architecture/)); then `GET ${VITE_AIMARKING_API_BASE}/get-config-info?OrgCode&CustCode&AppCode=AImarking` (`fetchStandaloneMode`) |
| Backend dependency | User record with `customerCode='ICME'`, `userRole`, `orgCode`, `userCode`; organisation `configSetting` |
| UI state | sessionStorage `isLogin`, `userInfo`, `username`, `password`, `userCode`, `orgCode`, `customerCode`, `userRole`. localStorage `workflowStages`, `org_selected_stages_<org>`, `standalone_mode`, `org_standalone_<org>` |
| Next | `superadmin`/`admin` → admin console. Standalone → **Step 4** at `/ocr-evaluation`. Otherwise → **Step 2** at `/subject-dashboard` |
| Errors | customerCode ≠ ICME → "Access denied."; inactive account messages (`src/lib/session.ts` → `getAccountAccess`) |

## Step 2: Year and Cycle (normal mode only)

| Item | Detail |
|---|---|
| Start point | `SubjectDashboard` mount |
| Action | The first year is auto-selected; the user can change the Year dropdown and then click a Cycle card |
| API | `GET ${API_BASE1}/get-year-data` (no params) → `GET ${API_BASE1}/get-cycle-data?YearCode=`. In parallel: `list-workspace` (header tokens) and `get-config-info` (Student Export gate) |
| Backend dependency | Year and cycle master data. **While `USE_MOCK_DATA_WHILE_BACKEND_IN_DEV` is true, an empty or failed response shows mock years and cycles** |
| UI state | `years`, `selectedYearCode`, `cycles`, `selectedCycleCode`; skeletons via `isYearLoading` / `isCycleLoading` |
| Next | Cycle click → **Step 3** |
| Completion | Subjects card visible, with breadcrumb `<Year> › <Cycle>` |
| Errors | Only reachable with the mock flag off: "Failed to load years/cycles. Please try again." with Retry |

Optional side task: **Student Export**. Visible only when `get-config-info` enables all four stages and subjects exist. `GET ${API_BASE1}/student-export?CustCode&OrgCode&RegistrationNumber` produces a 2-sheet `.xlsx` (`ObtainedScore`, `Evaluation Details`).

## Step 3: Subject

| Item | Detail |
|---|---|
| Start point | Subjects card |
| Action | Optional search, then click a subject card |
| API | `GET ${API_BASE1}/get-subject-data` params `orgCode, custCode, yearCode, cycleCode, userCode` (mock fallback as above) |
| UI state | `handleSelect` writes sessionStorage `subjectcode/subjectCode`, `yearcode/yearCode`, `cyclecode/cycleCode` and sets `selected` |
| Next | `<OCREvaluation>` replaces the dashboard **in place** (URL unchanged) → **Step 4** |
| Errors | "Failed to load subjects. Please try again." (mock flag off only) |

## Step 4: Workspace list

| Item | Detail |
|---|---|
| Start point | OCREvaluation mount (inline, or `/ocr-evaluation` in standalone) |
| Action | View workspaces, open one, select empty ones for deletion, or create one |
| API | `get-subject-data` (single call using the stored year/cycle; otherwise a fan-out over `get-year-data` + `get-cycle-data` + `get-subject-data`) → `GET ${API_BASE1}/list-workspace` (`fromdate, todate, orgcode, custcode, usercode, SubjectCode`). When empty → `GET ${API_BASE1}/question-data`. Also `question-data` for the question list |
| Backend dependency | Subject has questions (`question-data`) and a mark schema (`guidelinepath`), otherwise the empty-state warnings appear |
| UI state | `subjects`, `selectedSubject`, `workspaces`, `questions`, `pageLoading`; breadcrumb `Year › Cycle › Subject` (hidden in standalone) |
| Next | **Create New Workspace** → **Step 5**; card click → **Step 6** |
| Errors | "Failed to load workspaces"; "Failed to load subjects"; empty-state messages "No questions found. Please contact administrator." / "Mark schema not uploaded. Please contact administrator." / "No workspaces found for this subject." |

Delete workspace: only workspaces with 0 candidates → `POST ${API_BASE1}/delete-workspace` `{ workspaceId: "id,id" }` (success `S001`), then the list and subjects refresh.

## Step 5: Create workspace and upload (per configuration)

The dialog fetches `get-config-info` again on open. What follows depends on the **effective** stages (Standalone removes Evaluation).

### 5a. Segmentation present (with any other stages)

1. Enter the workspace name, add PDFs / a folder / a ZIP of PDFs, and tick "I confirm that <subject> is correct" (not shown in standalone).
2. **Create Workspace** → (normal mode) "Confirm File Upload" → Yes.
3. `POST ${API_BASE1}/create-workspace` → on `F001`, the name-exists banner shows and the user stays in the dialog.
4. The dialog closes; the workspace is selected locally.
5. Background `POST ${API_BASE}/upload-pdfs` (one request for a ZIP, else batches of 10).
6. First response → `candidate-process-data` and 30 s polling start → **Step 6**.

Backend dependency: the upload-pdfs pipeline creates the candidates and runs Segmentation (and later stages) server-side. The candidate table shows "Candidate answer scripts getting uploaded." until rows exist.

### 5b. Indexing without Segmentation

As 5a, but the input is **one ZIP of candidate folders containing PNG/JPG only**. In Standalone + Indexing-only, the frontend first calls `POST ${API_BASE1}/save-candidate-info` once per top-level ZIP folder.

### 5c. OCR (± Evaluation): images, normal mode

1. Enter the workspace name and candidate name, tick the subject confirmation, then click **Next**.
2. In the per-question popup, attach up to 5 images per question, then click **Submit All**.
3. `create-workspace` → `save-candidate-info` (scriptPath `ICME/<org>/<subject>/<workspace>/<candidate>`) → `POST ${API_BASE}/upload-pngs` → `POST ${API_BASE}/save-ocr-data` (empty text per image path) → `POST ${API_BASE}/recalculate-standards` → `candidate-process-data`.
4. The new workspace is selected → **Step 6**.

Backend dependency: OCR itself is not triggered by the frontend in this chain. The backend must run it after the save/recalculate calls.

### 5d. OCR (± Evaluation): audio, normal mode

Choose **Audio** in the Upload Mode toggle and attach one MP3/WAV per question. Chain: `create-workspace (standardCount 1)` → `save-candidate-info` → `POST ${API_BASE}/upload-audios` → `candidate-process-data` (rows shown) → background `POST ${API_BASE}/transcribe-audio`. **Nothing is called after transcribe-audio.**

Choosing **Video** instead follows the same chain through the upload and first `candidate-process-data`, but the background step differs: `transcribe-audio` leaves the saved record's OCR text empty for video, so each uploaded video is transcribed directly against `POST ${VITE_VIDEO_TRANSCRIBE_API_BASE}/transcribe` (a local transcription service, `http://127.0.0.1:8002/v1/transcribe` by default — not a public host), the resulting text is assembled into `ocr_extracted_text`, saved via `POST ${API_BASE}/save-ocr-data`, and the candidate rows are reloaded again so the transcript appears.

### 5e. Evaluation only

**Next** → popup with OCR text per question → `create-workspace` → `save-candidate-info` → `save-ocr-data` (`S001`/`S002`) → `recalculate-standards` → `POST ${API_BASE}/run-evaluation` → `candidate-process-data`.

### 5f. Standalone OCR only

Workspace name + candidate name + 1–3 images → **Create & Extract**: `create-workspace` (subject `generic`) → `save-candidate-info` → `upload-pngs` → `POST <VITE_AIAPPS_API_BASE>/AITranscription/extract` once per image (`runExtraction`) → `save-ocr-data` with the transcription results under question `"1"`. **recalculate-standards is skipped.** Then `candidate-process-data` and polling.

With **Video** chosen instead of Image, the same flow uploads via `upload-audios` and then transcribes each file directly against `POST ${VITE_VIDEO_TRANSCRIBE_API_BASE}/transcribe` (a local service, not `AITranscription/extract` and not a public host), builds `ocr_extracted_text["1"]` from the returned text, and saves it with `save-ocr-data` the same way — `recalculate-standards` is skipped here too.

### 5g. Upload Additional Files (inside a workspace)

Enabled only for the owner, after 30 s cooldowns, and when no enabled stage is incomplete. Segmentation/Indexing → dropzone → `upload-pdfs` batches. OCR/Evaluation → candidate name (checked against `candidate-process-data` for duplicates) → popup → the same chain as 5c–5f, reusing the open workspace id (no `create-workspace`).

| Completion | Error conditions |
|---|---|
| Dialog closed, workspace selected, rows loading | Validation toasts; "Workspace name already exists…" (5a/5b); chain toasts with the server message (5c–5f); Upload Error popup "Please upload correct data" / "Failed to upload batch. Please try again." |

## Step 6: Open workspace and monitor stages

| Item | Detail |
|---|---|
| Start point | Workspace card click, Workspace dropdown, or post-create |
| API | `GET ${API_BASE1}/candidate-process-data` (`OrgCode, CustCode, UserCode, SubjectCode, WorkspaceId`), repeated every 30 s; `get-config-info` on each `selectedWorkspace` change |
| Backend dependency | `details[]` statuses: `segmentationStatus`, `ocrStatus`, `markingStatus` (0/1/2/3/4), `approvedStatus`, markers, scores, `userCode` |
| UI state | `candidates`, status widgets, badges (Yet to … / In Progress / Completed / Approved / Stopped), countdown |
| Next | Badge click → **Step 7**; Rerun buttons for status 4 (`run-ocr`, `run-evaluation`) |
| Completion | All enabled stages ≥ 2 for the candidates of interest |
| Errors | Non-silent load error → toast plus **mock sample candidates** shown |

## Step 7: Review and approval

Clickable badges (`completed`/`pending`/`approved`) open the Segmentation/Indexing, OCR or Evaluation review dialogs. Quick Approve (per candidate, kept in sessionStorage) governs what can be approved there. Polling pauses while a dialog is open. See [../user/user-review-and-evaluation.md](../user/user-review-and-evaluation.md).

## Step 8: Export

| Item | Detail |
|---|---|
| Action | Optionally select candidates (owner rows only), then click **Download** |
| Enabled | All selected candidates have every enabled stage ≥ 2 (no selection = all rows); hidden for Standalone + Segmentation-only; disabled in Standalone when config evaluation is off |
| API | `GET ${API_BASE1}/get-all-data-exports` with `PageNumber` 0..n until `totalcount` is reached |
| Output | `<subjectcode>_<workspace>.xlsx` with the sheets that have data: `ObtainedScore`, `Evaluation Details`, `Indexing & OCR Data` (OCR column dropped when empty; Stage column) |
| Errors | "No data available to export"; "No evaluation data available to export" |

---

## Behaviour per stage combination (summary)

| Effective stages | Step 5 path | Table columns | Quick Approve column | Status filter | Download |
|---|---|---|---|---|---|
| Segmentation only | 5a | Segmentation (status 1 shows Completed) | hidden | hidden | shown (hidden if standalone) |
| Segmentation + Indexing (+…) | 5a | "Segmentation Indexing" + others | shown | shown (hidden if standalone) | shown |
| Indexing only | 5b | Indexing | shown | shown / hidden in standalone | shown |
| Indexing + OCR (+ Eval) | 5b | Indexing, OCR (+ Eval) | shown | shown | shown |
| OCR only | 5c / 5d; standalone 5f | OCR | shown; hidden in standalone | shown / hidden | shown; disabled in standalone when config evaluation is off |
| OCR + Evaluation | 5c / 5d (standalone: 5f, Evaluation hidden) | OCR, Evaluation | shown | shown | shown |
| Evaluation only | 5e | Evaluation | shown | shown | shown |
| All four | 5a | all | shown | shown | shown; Home also shows Student Export |

## Standalone Mode summary

No Home page and no breadcrumb on the list; the subject code is always `generic`; Evaluation is hidden everywhere in the UI; no subject confirmation or "Confirm File Upload"; the OCR-only create flow runs AI extraction from the browser; candidate info is disabled; status filter hidden. See [../user/user-overview.md §3](../user/user-overview.md#3-standalone-vs-normal-mode).
