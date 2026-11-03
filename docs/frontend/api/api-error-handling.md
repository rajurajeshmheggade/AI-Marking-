# API Error Handling

How each API call reacts to failures, and the recurring patterns (silent catches, mock fallbacks, any-2xx-is-success) that a developer must know before trusting what the UI shows.

Related: [api-integration-mapping.md](./api-integration-mapping.md) (IDs used below) · [../admin/admin-api-mapping.md](../admin/admin-api-mapping.md#error-handling-per-api) · [../user/user-api-mapping-workspace.md](../user/user-api-mapping-workspace.md#error-handling-per-api) · [../user/user-api-mapping-review.md](../user/user-api-mapping-review.md#2-error-handling-per-api)

---

## 1. Global facts

| Topic | Behaviour (verified in `src/`) |
|---|---|
| Interceptors / wrappers | None. No `axios.interceptors`, no `axios.create`, no `fetch` wrapper. |
| Timeouts | None. No `timeout:` option on any axios call and no `AbortSignal.timeout` on `fetch`. A hung request keeps its spinner until the browser gives up. |
| Retries | None automatic. Some views offer a **Retry** button (SubjectDashboard error states, only when the mock flag is off). |
| 401 / 403 | Not handled specifically. They land in the same `catch` as any other HTTP error. No redirect to login. See [api-authentication.md](./api-authentication.md). |
| User feedback | `sonner` `toast.error/success/warning` in every page; Login shows an inline error and an `AlertDialog`; Register shows a red banner and a result dialog. |
| Network vs HTTP error | Not distinguished by any call except `upload-pdfs` (`Network Error` → "Please upload correct data") and `extraction.ts` (`TypeError` → CORS message). |
| Error message source | Usually `err.response.data.message` → `err.message` → a fixed default string. |

---

## 2. Cross-cutting patterns

### 2.1 Any HTTP 2xx is treated as success (body ignored)

| Endpoint | Caller |
|---|---|
| P01 `upload-pdfs`, P02 `upload-pngs`, P03 `upload-audios` | create / upload flows |
| P04 `transcribe-audio` | `submitOcrWorkflow` |
| P05 `save-ocr-data` | OCR and Standalone create chains, both approve flows (only the Evaluation-only chain checks `S001`/`S002`) |
| P06 `recalculate-standards`, P07 `run-evaluation`, P08 `run-ocr` | all callers |
| P09 `save-indexing-info`, P10 `save-evaluation-data`, P11 `update-status` | review flows |
| P12 `upload-marking-scheme`, M13 `save-questions`, M12 `update-subject-data` | SuperAdmin |
| M24 `delete-candidate` | `success` **or** HTTP 200 |
| M03 `save-config-info` | Any OK body → success toast; `F*` codes not handled; upper-case `S001` falls to the generic success message |
| M16 `create-user` | `res.ok` → success (only `E001` is checked) |
| M19 `create-workspace` in Standalone Create & Extract | Envelope not checked; only `outWorkspaceId` required |
| M21 `save-candidate-info` in Standalone Create & Extract | Not checked |
| M09 `import-subject-data-v2` | A body without `status` counts as success |

If the backend reports a logical failure with HTTP 200 on any of these, the UI shows success.

### 2.2 Errors swallowed with `console.warn` / `console.error` only

| Where | What fails silently | Visible consequence |
|---|---|---|
| `handlePhase1Approve` OCR sync block (~L8022–8029, toasts commented out) | M25 type 2, P05, P06, M25 type 3 + P10 | Segmentation/Indexing approved, but OCR text for the new mapping may not be saved or re-scored |
| `handlePhase1Approve` → P11 type 1 (~L8040) | update-status | Badge may stay "pending approval" after the next poll |
| Confirm & Save → P11 type 3 (~L15835) | update-status | Same for Evaluation |
| `submitReEvaluationRequest` → P11 type 3 (~L6898) | update-status | Same |
| `saveFilteredEvaluationDataWithoutImagePaths` (both approve flows) | P10 cleanup | Evaluation totals may still include questions without pages |
| `savePhase1Mapping` sessionStorage write | – | Later Approve pre-check fails with "Please Modify at least one image…" |
| M02 config fetches in OCREvaluation (~L1102, ~L3146) | get-config-info | Cached workflow stages used |
| M02 in `handlePhase1Approve` / Confirm & Save | get-config-info | In-memory stages / `baseTotal + delta` used |
| M02 in Login (`fetchStandaloneMode`) | get-config-info | Cached `standalone_mode` decides the landing page |
| M02 in Config Settings (`loadSettings`) | get-config-info | localStorage values shown as if they were the server configuration |
| M04/M05 in the SuperAdmin shell | year/cycle | Year/Cycle selects empty; sections show nothing |
| M07 in the shell and Config Settings | organization-details | Settings spinner ends with no cards; `loadSettings` never runs |
| M15 `get-user-details` | users | Empty table, no message |
| M18 in SubjectDashboard (`fetchTokens`) | list-workspace | Token count shows 0 |
| M22 silent poll | candidate-process-data | Table freezes on the last good data |
| M23 in `openCandidateDetails` | get-candidate-info | All fields "N/A" |
| X04 and auto-login in Register | – | Unreachable path |

### 2.3 Mock / placeholder data fallbacks

| Fallback | Location | Condition | Effect |
|---|---|---|---|
| Mock years / cycles / subjects | `SubjectDashboard.tsx`: `USE_MOCK_DATA_WHILE_BACKEND_IN_DEV = true` (~L36), `MOCK_YEARS`, `MOCK_CYCLES_BY_YEAR`, `MOCK_SUBJECTS_BY_CYCLE` | M04/M05/M06 return **no rows or fail** (the flag is on in the committed code, so this also applies to production builds) | Users see fixed sample years/cycles/subjects; `console.warn` only. Opening a mock subject drives real API calls with mock codes. Student Export can appear because `subjects.length > 0`. |
| Mock candidates | `OCREvaluation.tsx` → `generateMockCandidates` (~L4646), used by `loadCandidatesForWorkspace` (~L4978) | Non-silent M22 load throws | Toast "Failed to load candidate data, showing sample data instead" and fake rows appear in the table |
| Mock questions | `OCREvaluation.tsx` → `defaultMockQuestionsList` (~L4333), set at ~L4614/~L4623 | M10 fails or returns empty | Per-question popup, create flow and export columns use generic sample questions (e.g. photosynthesis) |
| Placeholder subjects | `OCREvaluation.tsx` initial `subjects` state (8 hard-coded subjects, ~L3826) | M06 fails or returns nothing | Placeholder list kept; `selectedSubject` default `"broadcast-journalism"` when no prop |
| Placeholder evaluation data | `generateMockEvaluationData()` on each candidate row | Always | Not displayed in place of real evaluation; real data comes from M25 type 3 |
| Mock OCR segments | `StandaloneOCREvaluation.tsx` → `MOCK_SEGMENTS` (~L21) | Only via the unused `buildSegmentsFromStoredResult` helper | Not reachable in the running app |
| Local mock workspaces | `handleFolderUploadConfirmed` / `handleZipUploadConfirmed` / `handlePdfUploadConfirmed` (`mockCandidates`, ~L5355/5468/5579) | Their entry handlers are not wired to any input | Not reachable |
| Sandbox mock engine | `SandboxDashboard.tsx` `MOCK_MODE = true` | Always | No network at all; page itself is unreachable |

### 2.4 Toast conventions

- Success toasts are shown after optimistic UI updates even when a follow-up call failed (Evaluation Confirm & Save shows the success toast after the P10 error toast; Marks Schema shows success after the M13 warning).
- The OCR and Evaluation review dialogs both show **"Failed to load segmentation data"** when M25 fails, regardless of type.
- Some error strings include server text (`response.data.message`), so backend wording reaches users verbatim.

---

## 3. Per-endpoint error table

Columns: **HTTP error** (non-2xx; axios rejects, `fetch` returns `!ok`) · **Empty** (2xx with no usable data) · **Envelope failure** (2xx with a failure code) · **Network / timeout** · **What the user sees**.

### AI Marking API

| API | HTTP error | Empty | Envelope failure | Network / timeout | What the user sees |
|---|---|---|---|---|---|
| M01 login | throw "Network error during login" | throw "Invalid username or password" | `F001`/other → throw `message` | browser `TypeError` text | Red inline error under the form |
| M02 config (Login) | `null` | `null` | – | `null`, `console.warn` | Nothing; cached mode decides route |
| M02 config (SD) | Student Export hidden | hidden | – | hidden | Button absent |
| M02 config (OCR effects) | ignored | ignored | – | `console.error` | Nothing; cached stages |
| M02 config (approve / save) | in-memory fallback | same | – | same | Nothing |
| M02 config (S&Q activation) | returns `true` | `true` | – | `true` | Guideline required for activation |
| M02 config (CS) | localStorage fallback | same | – | same | Settings look loaded |
| M03 save-config-info | "Failed to save configuration: <status>" | success toast | `F*` not handled | "Error connecting to the API to save settings" | Toast; localStorage still updated |
| M04/M05 (SD) | mock data | mock data | – | mock data | Sample years/cycles |
| M04/M05 (SA shell) | `console.error` | empty select | – | same | "No cycles" / empty sections |
| M04/M05 (S&Q import) | "Failed to load years/cycles" | "No Years Found" / "No Cycles for this Year" | – | toast | Import disabled |
| M06 (SD) | mock subjects | mock subjects | – | mock | Sample subjects |
| M06 (OCR) | "Failed to load subjects" (initial) | placeholder list | – | toast | Placeholder subjects |
| M06 (SA sections) | "Failed to load subjects" | empty table / "No marks schemes yet" | – | toast | Toast + empty view |
| M07 organization-details | S&Q/MS toast "Failed to load organizations"; CS/shell log; RM `[]` | "No Organizations Found" / empty select | – | same | Toast or silent empty select |
| M08 customer-details | fallback `[ICME]` | `[ICME]` | – | `[ICME]` | ICME only |
| M09 import-subject-data-v2 | toast server message / "Import failed. Please try again." | success | `F*` → "Failed to import: <message>" | toast | Toast; dialog stays open |
| M10 question-data (OCR) | mock questions | mock questions + `questionsEmpty` | – | mock | Sample questions / "No questions found…" |
| M10 question-data (S&Q) | "Failed to load question preview" | "No data available." / "No questions found." | – | toast | Toast / empty dialog |
| M11 delete-subject | first exception aborts → "Deletion failed. Please try again." | – | non-`S001` → per-subject failure toast | same as HTTP | Toasts |
| M12 update-subject-data | "Failed to update subject status" | success | not read | toast | Toast |
| M13 save-questions | warning "Marking schema uploaded, but questions could not be saved: <msg>" | – | not read | same | Warning then success toast |
| M14 get-marking-scheme | falls back to R02 → "Failed to load content. Please contact your administrator." | "No content available." | – | same | Message in dialog |
| M15 get-user-details | `roleList=[]` (log) | `[]` | – | same | Empty table |
| M16 create-user | non-OK → `message`/default | success | `E001` → "Login name already exists!…" | "An error occurred" / "An error occurred." | Toast; modal stays |
| M17 delete-user | "Failed to delete user" | failure | `F001`/other → `message` | same | Toast |
| M18 list-workspace (OCR) | "Failed to load workspaces" (non-silent) | `[]` + M10 probe | – | same; aborts ignored | Toast / empty-state message |
| M18 list-workspace (SD) | console only | total 0 | – | same | Token count 0 |
| M19 create-workspace | toast "Failed to create workspace…" / server message | "Workspace id missing…" | `F001` → banner "Workspace name already exists…"; other non-`S001` → toast (not checked in Standalone) | toast | Banner or toast |
| M20 delete-workspace | "An error occurred while deleting…" | – | other → server message / "Cannot delete workspace(s)…" | same | Toast |
| M21 save-candidate-info | toast server message / "Failed to save candidate information" | – | non-`S001` → same (not checked in Standalone) | same | Toast; chain stops |
| M22 candidate-process-data (load) | toast + **mock candidates** | "Candidate answer scripts getting uploaded." | – | same | Fake rows |
| M22 (poll) | `console.error` | same text | – | same | Nothing |
| M22 (duplicate check) | "Unable to verify the candidate right now…" (blocks) | treated as no duplicate | – | same | Toast |
| M23 get-candidate-info (details) | "N/A" fields | "N/A" | – | same | Dialog with N/A |
| M23 (Seg-only pages) | "Failed to load candidate information" | "No segmented images available." | – | same | Toast |
| M24 delete-candidate | "Failed to delete candidates" | – | no `success` and not 200 → same | same | Toast |
| M25 get-process-data (dialogs) | "Failed to load segmentation data" | "Empty segmentation response" | not checked | same; abort silent | Toast; dialog empty |
| M25 (standalone) | server message / "Failed to fetch process data for standalone OCR" | "Missing process data" / "No OCR data found for this candidate." | – | same | Toast / popup text |
| M25 (approve-time) | `console.warn` | raw map / no-op | – | same | Nothing |
| M26 get-all-data-exports | toast | "No data available to export" / "No evaluation data available to export" | – | toast | Toast |
| M27 student-export | "An error occurred during export." | "No data found for this register number." | – | same | Toast |

### ICME OCR / processing API

| API | HTTP error | Empty | Envelope failure | Network / timeout | What the user sees |
|---|---|---|---|---|---|
| P01 upload-pdfs | 400/404/413 → Upload Error popup "Please upload correct data"; other → "Failed to upload batch. Please try again." | – | – | `Network Error` → "Please upload correct data" | Popup |
| P02/P03 upload-pngs/audios | "Failed to upload images/audio files" | – | – | same | Toast |
| P04 transcribe-audio | server message / "Failed to transcribe the audio" | – | – | same | Toast (background) |
| P05 save-ocr-data (create) | "Failed to save OCR data" | – | Evaluation chain: non-`S001`/`S002` → same | same | Toast |
| P05 (Phase 1 approve) | `console.warn` | – | not read | same | Nothing |
| P05 (OCR approve) | "Failed to save OCR data (status N)" / "…Please try again." | – | not read | same | Toast; approval stops |
| P06 recalculate-standards | create: "Failed to run evaluation"/"Failed to recalculate standards"; OCR approve: "OCR saved, but recalculation failed…"; Phase 1: warn | no request when nothing qualifies | – | same | Toast or nothing |
| P07 run-evaluation | "Failed to trigger evaluation for <reg>…" / "Failed to submit re-evaluation…" / "Failed to run evaluation" | – | non-2xx in re-eval → "(status N)" | same | Toast |
| P08 run-ocr | "Failed to trigger OCR for <reg>. Please try again." | – | – | same | Toast |
| P09 save-indexing-info | warn + "Failed to save mappings" | – | not read | same | Toast; approval aborted |
| P10 save-evaluation-data (score) | "Failed to save evaluation score to server. Please try again." | – | not read | same | Toast, then success toast; optimistic score stays |
| P10 (cleanup) | `console.warn` | – | – | same | Nothing |
| P11 update-status | type 2: "Recalculation succeeded but updating status failed…"; others `console.warn/error` | – | not read | same | Toast or nothing |
| P12 upload-marking-scheme | server message / "Upload failed. Please try again." | – | not read | same | Toast |
| P13 convert-markscheme-to-md | server message / "Failed to process PDF…" | < 5 chars → "API returned empty markdown…" | – | same | Toast; back to idle |

### Repository and AI Apps

| API | HTTP error | Empty | Envelope failure | Network / timeout | What the user sees |
|---|---|---|---|---|---|
| R01 page images (download) | "Failed to download image(s)"; per-page `console.warn` "Skipped image…" | `text/*` blob rejected | – | CORS → message from `urlToFile` | Toast |
| R01 (probing) | image `error` event ends the sequence | "No segmented images available." | – | same | Toast |
| R02 marking-scheme file | "Failed to load content. Please contact your administrator." | "No content available." | – | same | Dialog text |
| X01 AITranscription/extract | throw `payload.detail` / "Extraction request failed." | fields default to empty | – | CORS message | Toast; Create & Extract stops |
| X02 signup | throw server `message` / "Registration failed" | – | `FL001`/`O001`/`LO001`/`EM001` → specific messages | same | Red banner (unreachable) |
| X03 send-email | dialog "Save Failed" with empty description (defect) | – | `status !== 'success'` → same | same | (unreachable) |
| X04 updateActiveRegisteredUser | swallowed | – | – | swallowed | (unreachable) |

---

## 4. Recommendations (documentation only, not applied)

1. Add an axios instance with a timeout and a response interceptor that maps HTTP and envelope failures (`F*`, `E*`) to one error type.
2. Check envelope codes on every write (`status`/`statusCode`), not only HTTP status.
3. Replace `console.warn`-only catches in approve flows with user-visible warnings; those steps change persisted data.
4. Set `USE_MOCK_DATA_WHILE_BACKEND_IN_DEV` to `false` (or gate it on `import.meta.env.DEV`) and remove the mock-candidate / mock-question fallbacks from production paths, so users never act on sample data.
5. Use distinct error messages for OCR and Evaluation dialog loads.
