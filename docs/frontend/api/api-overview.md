# API Overview

How the ICME AI-marking frontend talks to its backends: which base URLs exist, which backend each one points to, how requests are built, and the conventions (envelopes, pagination, uploads, polling) shared by the calls.

Related: [api-integration-mapping.md](./api-integration-mapping.md) (every endpoint, with UI bindings) · [api-request-response.md](./api-request-response.md) · [api-error-handling.md](./api-error-handling.md) · [api-authentication.md](./api-authentication.md) · [unused-or-unmapped-apis.md](./unused-or-unmapped-apis.md) · [../environment-configuration.md](../environment-configuration.md)

---

## 1. Base URLs and the backends behind them

Every base is read from a Vite env variable at **build time**. Each one also has a **hard-coded fallback host** in source (`import.meta.env.X || '<built-in URL>'`), so a missing variable does not break the build: the bundle silently calls the built-in host, which for most bases is a production host. Real host names are not reproduced here; see [../environment-configuration.md](../environment-configuration.md).

| Code constant | Env variable | Backend (role) | Declared in | Endpoint families |
|---|---|---|---|---|
| `API_BASE1` | `VITE_AIMARKING_API_BASE` | **AI Marking API**: master data, configuration, users, workspaces, candidates, read side of the processing data. The value includes the trailing `/api` segment. | `OCREvaluation.tsx` (~L72), `SubjectDashboard.tsx` (~L15), `SuperAdminDashboard.tsx` (~L52, re-declared in `RoleManagementSection` ~L6492), `Login.tsx` (`CONFIG_API_BASE`), `src/api.ts` → `loginUser` (inline) | login, `get-config-info`/`save-config-info`, year/cycle/subject, organization/customer, users, `list-workspace`/`create-workspace`/`delete-workspace`, `candidate-process-data`, `get-process-data`, `get-candidate-info`, `save-candidate-info`, `delete-candidate`, `question-data`, `save-questions`, `get-marking-scheme`, exports |
| `API_BASE` | `VITE_ICMEPRODUCT_API_BASE` | **ICME OCR / processing API**: file uploads, OCR/evaluation triggers and the write side of review (save-*, update-status). | `OCREvaluation.tsx` (~L71, repeated inline in `API_ENDPOINTS.runOcr/ocrImage/evaluateText`), `SuperAdminDashboard.tsx` (~L51), `SubjectDashboard.tsx` (declared, unused) | `upload-pdfs`, `upload-pngs`, `upload-audios`, `transcribe-audio`, `save-ocr-data`, `recalculate-standards`, `run-evaluation`, `run-ocr`, `save-indexing-info`, `save-evaluation-data`, `update-status`, `upload-marking-scheme`, `convert-markscheme-to-md` |
| *(inline)* | `VITE_ICMEPRODUCT_API_BASE` | Same variable, but the mark-scheme conversion call has a **different fallback host and path** | `SuperAdminDashboard.tsx` → `MarksSchemaSection.handlePdfSelect` (~L2828) | `convert-markscheme-to-md` |
| `IMAGE_BASE` | `VITE_REPO_BASE` (+ `/`) | **Image / document repository** (static files) | `OCREvaluation.tsx` (~L61) | answer-script page images (`<scriptPath>/<n>.png`) |
| `REPO_BASE` | `VITE_REPO_BASE` | Same repository | `SuperAdminDashboard.tsx` (~L53) | marking-scheme files (`<guidelinepath>`) |
| `DEFAULT_ENDPOINT` / `API_ENDPOINTS.aiTranscription` | `VITE_AIAPPS_API_BASE` | **AI Apps platform** (AI-Levate): AI transcription ("Master Agent"), registration e-mail, user activation, SSO | `src/lib/extraction.ts` (~L21); `OCREvaluation.tsx` (~L106, unused key); `Register.tsx`; `AppIframe.tsx` (dead) | `/AITranscription/extract`, `/AIProductApi/send-email`, `/AIProductApi/updateActiveRegisteredUser`, `/Login/ssoTokenGen` (dead) |
| `API_BASE_URL` | `VITE_API_BASE_URL` | AI Apps sign-up API. **No fallback** and absent from every `.env.*.example`: when unset the URL is the relative string `undefined/aiapps/AIProductApi/signup`. | `src/api.ts` (~L5) | `/aiapps/AIProductApi/signup` |
| `API_APPS_URL` | `VITE_API_APPS_URL` | Legacy app catalogue. Used only by dead code. | `src/api.ts` (~L7) | `/get_app_details` |

### Base → endpoint families

```text
VITE_AIMARKING_API_BASE  (API_BASE1)  "AI Marking API"
 ├─ auth & config ........ POST login · GET get-config-info · POST save-config-info
 ├─ master data .......... GET get-year-data · get-cycle-data · get-subject-data
 │                         GET organization-details · customer-details
 ├─ subject admin ........ POST import-subject-data-v2 · delete-subject · update-subject-data
 │                         GET question-data · POST save-questions · GET get-marking-scheme
 ├─ users ................ GET get-user-details · POST create-user · delete-user
 ├─ workspaces ........... GET list-workspace · POST create-workspace · delete-workspace
 ├─ candidates ........... POST save-candidate-info · GET candidate-process-data (polled)
 │                         GET get-candidate-info · POST delete-candidate
 ├─ processing (read) .... GET get-process-data  (type 1 | 2 | 3)
 └─ exports .............. GET get-all-data-exports (paged) · GET student-export

VITE_ICMEPRODUCT_API_BASE  (API_BASE)  "ICME OCR / processing API"
 ├─ uploads (multipart) .. POST upload-pdfs · upload-pngs · upload-audios · upload-marking-scheme
 │                         POST convert-markscheme-to-md
 ├─ triggers ............. POST run-ocr · run-evaluation · transcribe-audio · recalculate-standards
 └─ review writes ........ POST save-ocr-data · save-indexing-info · save-evaluation-data · update-status

VITE_REPO_BASE  (IMAGE_BASE / REPO_BASE)  "image repository"
 └─ GET <scriptPath>/<n>.png · GET <guidelinepath>

VITE_AIAPPS_API_BASE  "AI Apps"
 ├─ POST /AITranscription/extract   (Standalone OCR-only Create & Extract)
 └─ POST /AIProductApi/send-email · /AIProductApi/updateActiveRegisteredUser  (Register, blocked by validation)

VITE_API_BASE_URL   → POST /aiapps/AIProductApi/signup   (Register, blocked by validation)
VITE_API_APPS_URL   → GET /get_app_details               (dead: AppIframe)
```

The dev server proxies only `/ICMEOcrRepo` (used by the dev-only image fallback in `fetchImageBlob`) and `/api` (not used by app code). Every other request goes straight to the absolute base URL, so the backend hosts must allow CORS from the dev origin. See [../environment-configuration.md §5](../environment-configuration.md#5-dev-server-proxy-viteconfigts).

---

## 2. No service layer: calls are inline in pages

There is no API client module, repository layer, React Query or SWR. Calls are written inline in page components and their handlers:

| File | HTTP client | Approx. call sites | Notes |
|---|---|---|---|
| `src/pages/OCREvaluation.tsx` | `axios` (63 `axios.*` calls) + `fetch` (7) | Module-level `API_ENDPOINTS` map (~L74–107) for most URLs; some built inline | `fetch` is used for `get-config-info` and image downloads |
| `src/pages/SuperAdminDashboard.tsx` | `axios` (24) + `fetch` (9) | URLs built inline (`${API_BASE1}/…`) | `fetch` in `SettingsSection` and `RoleManagementSection` (except `delete-user`) |
| `src/pages/SubjectDashboard.tsx` | `axios` (6) | Small `API_ENDPOINTS` map for year/cycle/subject (~L19) | |
| `src/pages/Login.tsx` | `fetch` | `fetchStandaloneMode` (~L33); `loginUser` from `src/api.ts` | |
| `src/pages/Register.tsx` | `axios` (2) + `src/api.ts` | `registerUser`, `loginUser` | |
| `src/lib/extraction.ts` | `fetch` | `runExtraction`, `urlToFile` | The only reusable API helper in live code |
| `src/api.ts` | `fetch`/`axios` | `loginUser`, `registerUser` are live; ~15 other exports are unused | See [unused-or-unmapped-apis.md](./unused-or-unmapped-apis.md) |

Consequences:

- No shared interceptor, timeout, retry, cancellation policy or error mapping. Each call site handles its own errors (see [api-error-handling.md](./api-error-handling.md)).
- No `axios.create()` instance and no `axios.defaults` changes anywhere in `src/`.
- The same endpoint is often called from several places with slightly different parameters (for example `get-config-info` is called from 8 places with three `CustCode` sources). [api-integration-mapping.md](./api-integration-mapping.md) consolidates them.
- `src/api/base.ts`, `src/api/base_ish.ts` and `src/api/updateQuestion.ts` exist but are **0-byte files**.

---

## 3. Authentication on requests

No request carries an `Authorization` header, bearer token, cookie-based session or API key. A search of `src/` for `Authorization`, `Bearer`, `interceptors` and `withCredentials` returns nothing. Identity travels only as ordinary query or body fields (`orgCode`/`OrgCode`/`orgcode`, `custCode`, `userCode`/`UserCode`/`usercode`), read from `sessionStorage` at call time, often with hard-coded defaults (`'ICME01'`, `'ICME'`, `'icmeuer01'`). There is no HTTP 401/403 handling. Details: [api-authentication.md](./api-authentication.md).

---

## 4. Request conventions

| Convention | Detail |
|---|---|
| Parameter casing | Not consistent across endpoints: PascalCase query params (`OrgCode`, `CustCode`, `SubjectCode`, `WorkspaceId`) on most AI Marking GETs; lower-case (`orgcode`, `custcode`, `usercode`, `registernumber`) on `get-process-data`, `list-workspace` and the processing API; camelCase JSON bodies on `create-workspace`, `save-candidate-info`, `create-user`. Each call matches what its endpoint expects. |
| `CustCode` | Nearly always the literal `'ICME'`. Exceptions: the Settings and Role Management sections use the selected customer; OCREvaluation's create-dialog config fetch uses `sessionStorage.customerCode`. |
| `AppCode` | `'AImarking'` on every `get-config-info` / `save-config-info` call. |
| Cache busting | `get-year-data`, `get-subject-data`, `candidate-process-data`, `list-workspace` (SubjectDashboard) and some `get-process-data` calls send `Cache-Control: no-cache`, `Pragma: no-cache`, `Expires: 0`. SubjectDashboard's `get-config-info` adds `_t=Date.now()`. Review-time `get-config-info` calls use `fetch(..., { cache: 'no-store' })`. |
| Payload sanitising | OCREvaluation wraps large POST bodies in `sanitizePayload()` (~L64), which strips `\x00` characters from every string to avoid backend `WIN1252` encoding errors. |
| URL encoding | Mixed. `Login.tsx` encodes query values; `SubjectDashboard.handleStudentExport` and several SuperAdmin `organization-details`/`get-config-info` URLs concatenate raw values. |

---

## 5. Response envelope conventions

There is no single envelope. The shapes seen in code:

| Shape | Seen on | How the frontend reads it |
|---|---|---|
| Bare array `[...]` | `get-config-info` (`[0].configSetting`), year/cycle/subject lists, `list-workspace` | `Array.isArray(data) ? data : data.data …` — most readers accept several fallbacks (`data`, `items`, `subjects`, `workspaces`) |
| `{ data: [...] }` | `organization-details`, `customer-details`, `get-process-data`, `get-all-data-exports` | `res.data.data` |
| `{ status \| statusCode, message, ... }` | login, `create-workspace`, `save-candidate-info`, `delete-*`, `import-subject-data-v2`, `create-user` | Status code compared to strings below |
| `{ summary: [...], details: [...] }` | `candidate-process-data` | Separate arrays |
| `{ userDetails: [...] }`, `{ candidateData: [...] }`, `{ ref1Data: [...] }` | `get-user-details`, `student-export`, `question-data` | Endpoint-specific |
| Per-file object + top-level `tokens` | `/AITranscription/extract` | `payload[<fileName>]` |

Status codes found in source:

| Code | Meaning in code | Where checked |
|---|---|---|
| `S001` | Success / created | login, `create-workspace`, `save-candidate-info` (via `assertStepSucceeded`, ~L2593), `delete-workspace`, `delete-subject`, `delete-user`, `import-subject-data-v2` |
| `S002` | Updated (record already existed) | `save-ocr-data` in the Evaluation-only create chain; `import-subject-data-v2` ("updated") |
| `F001` | Failure; on `create-workspace` = workspace name already exists | `create-workspace`, login (`F001` → "Invalid username or password"), `delete-user` |
| `s001` / `s002` (lower case) | Saved / updated | `save-config-info` only — upper-case replies fall through to the generic success toast |
| `E001` | Login name already exists | `create-user` (`status` / `errorCode` / `errorcode`) |
| `SUCCESS` | Success | `create-workspace` in `createWorkspaceAsync` |
| `FL001`, `O001`, `LO001`, `EM001` | User / organization / username / e-mail already exists | `registerUser` (unreachable from the UI) |

Many calls do not read the body at all and treat **any HTTP 2xx as success** (all processing-API triggers, `update-status`, `save-evaluation-data`, `upload-*`, `update-subject-data`). See [api-error-handling.md §2](./api-error-handling.md#2-cross-cutting-patterns).

---

## 6. Pagination

Only one endpoint is paged: `GET ${API_BASE1}/get-all-data-exports` (Download button in the candidate table, `OCREvaluation.tsx` ~L9545).

```text
pageNumber = 0; expectedTotal = ∞; allRecords = []
while pageNumber < 200 (MAX_PAGES safety net):
    GET get-all-data-exports ?OrgCode&CustCode=ICME&SubjectCode&WorkspaceId&PageNumber=<pageNumber>
    page = res.data.data (array) ; if empty → stop
    allRecords += page
    if page[0].totalcount is a positive number → expectedTotal = totalcount
    pageNumber++
    if allRecords.length >= expectedTotal → stop
then filter by selected candidates (registrationnumber), build the .xlsx in the browser
```

Pages are **0-based**. Every other list (workspaces, candidates, users, subjects) is fetched in one request and filtered/sorted in the browser.

---

## 7. Multipart uploads

All uploads use `FormData`; axios sets the multipart boundary (some calls also set `Content-Type: multipart/form-data` explicitly).

| Endpoint | Base | Fields | Caller |
|---|---|---|---|
| `upload-pdfs` | `API_BASE` | `org_code, cust_code, usercode, subject_code, subject_name, number_of_questions, workspace_name, folder_name, workspace_id, config_data, [question_numbers], file` (repeated) | `createWorkspaceAsync`, `uploadAddedFiles` — batched; cooldowns of 30 s after each response |
| `upload-pngs` / `upload-audios` | `API_BASE` | `target_path, files` (repeated) | `submitOcrWorkflow`, Standalone Create & Extract |
| `/AITranscription/extract` | `VITE_AIAPPS_API_BASE` | `subject, file, verify, interpret, line_mode, insertion_pass, strict_maths, q_filter` | `runExtraction` (one request per image) |
| `import-subject-data-v2` | `API_BASE1` | `File, IsType=0, OrgCode, YearCode, CycleCode` | `SubjectQuestionPanel.handleImportSubmit` |
| `convert-markscheme-to-md` | inline ICME product base | `file` | `MarksSchemaSection.handlePdfSelect` |
| `upload-marking-scheme` | `API_BASE` | `orgcode, custcode=ICME, subjectcode, file` | `MarksSchemaSection.handleSubmit` |

No upload reports progress (`onUploadProgress` is not used); the UI shows step labels and overlays instead.

---

## 8. Polling and background refresh

| What | Interval | Mechanism | Stops when |
|---|---|---|---|
| Candidate table (`candidate-process-data`, silent) | 30 s (`CANDIDATE_POLL_INTERVAL_MS`, ~L888) | `startCandidatePolling` (~L5117) `setInterval` + 1 s countdown ("The page refreshes in N seconds") | Every `details[].markingStatus === 2`; back to list; workspace switch; unmount |
| `get-config-info` (OCREvaluation) | ~30 s, as a side effect | The `selectedWorkspace` effect (~L3146) re-runs because each poll replaces the `selectedWorkspace` object | Same as above |
| Upload cooldowns | 30 s | Timers after each `upload-pdfs` response block "Upload Additional Files" | Timer expiry |

There is no WebSocket, SSE or long-polling. OCR, evaluation and transcription run asynchronously on the backend; the frontend only learns about progress from the next `candidate-process-data` poll.

---

## 9. Request de-duplication and cancellation

| Mechanism | Where |
|---|---|
| Module-level `sharedListWorkspaceRequest` shares one in-flight `list-workspace` promise across React StrictMode remounts; in-flight ref + 1.5 s same-key skip | `OCREvaluation.refreshWorkspaces` (~L4052) |
| `AbortController` per candidate+type, plus a debounce timeout; stale responses are dropped | `fetchProcessDataForCandidate` (~L6492) |
| `AbortController` for the question list | question-data effect (~L4541) |
| Request-id refs that ignore late responses | `SubjectDashboard.fetchWorkflowConfig` (`configRequestIdRef`) |

No other call is cancellable; leaving a page does not abort in-flight requests.
