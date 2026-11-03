# Troubleshooting

Issue-by-issue playbooks. Each entry: **Problem · Possible cause · How to verify · Relevant file · Relevant API · Expected behavior · Resolution.** Causes were verified in the current source; line numbers are approximate (`~L`).

Before starting, read the [Support guide](./support-guide.md) (triage flow, which env var controls which host) and check [Known issues](../known-issues.md). For the UI ↔ Network mapping per action see [API failure handling](./api-failure-handling.md).

Index:
[1 Login failure](#1-login-failure) ·
[2 "Access denied."](#2-access-denied) ·
[3 Wrong dashboard](#3-landing-on-the-wrong-dashboard) ·
[4 API not called](#4-api-not-called) ·
[5 API returns error](#5-api-returns-an-error) ·
[6 UI not showing API data](#6-ui-not-showing-api-data) ·
[7 Dropdown empty](#7-dropdown-empty-years--cycles--subjects--organisations) ·
[8 Table empty](#8-table-empty) ·
[9 Button not visible](#9-button-not-visible) ·
[10 Button disabled](#10-button-disabled) ·
[11 Navigation failure / blank page](#11-navigation-failure--blank-page) ·
[12 Session / auth](#12-session-and-auth-issues) ·
[13 Incorrect status badge](#13-incorrect-status-badge) ·
[14 Incorrect data binding](#14-incorrect-data-binding) ·
[15 Environment configuration](#15-environment-configuration-issue) ·
[16 Standalone settings not taking effect](#16-standalone-mode-settings-not-taking-effect) ·
[17 Excel export missing sheets / columns](#17-excel-export-missing-sheets-or-columns) ·
[18 Images not loading](#18-images-not-loading)

---

## 1. Login failure

| | |
|---|---|
| **Problem** | User cannot sign in; message under the form or a modal. |
| **Possible cause** | (a) Wrong credentials → `F001`. (b) Backend unreachable or wrong host → "Network error during login". (c) Account outside its validity window → modal (`active` = `0` not yet active, `2` expired). (d) Username/password with surrounding spaces are trimmed before sending. |
| **How to verify** | Network: `POST …/login`. Check HTTP status, then body `statusCode`/`status` and `userData[0].active`. Check the request host matches the intended environment. |
| **Relevant file** | `src/pages/Login.tsx` → `handleSubmit`; `src/api.ts` → `loginUser`; `src/lib/session.ts` → `getAccountAccess`, `ACCOUNT_MESSAGES` |
| **Relevant API** | `POST {VITE_AIMARKING_API_BASE}/login` |
| **Expected behavior** | `S001` with `userData[0]` → session written → redirect by role. |
| **Resolution** | (a) Reset password in User Management. (b) Check backend health / `VITE_AIMARKING_API_BASE` used at build time. (c) Adjust the user's From/To active dates in User Management. |

## 2. "Access denied."

| | |
|---|---|
| **Problem** | Credentials accepted, but "Access denied." appears under the login form. |
| **Possible cause** | The login record's customer code is not `ICME` (compared after `trim().toUpperCase()`). Only ICME users are routed. |
| **How to verify** | Network: `login` response → `userData[0].customercode` (or `customerCode`). |
| **Relevant file** | `src/pages/Login.tsx` → `handleSubmit` (the `customerCode === 'ICME'` branch) |
| **Relevant API** | `POST …/login` |
| **Expected behavior** | ICME users are routed; others are refused. |
| **Resolution** | Correct the user's customer in the backend. Note: before this check `isLogin='true'` and identity keys are already written and **not cleared**, so a page reload while on `/login` redirects the refused user to `/subject-dashboard`. Ask the user to close the tab. (Logged as a known issue.) |

## 3. Landing on the wrong dashboard

| | |
|---|---|
| **Problem** | Evaluator lands on the admin dashboard, admin lands on the evaluator page, or user skips the Home page (or doesn't). |
| **Possible cause** | Routing uses `userRole` and Standalone Mode: `superadmin`/`admin` → `/superadmin-dashboard`; Standalone → `/ocr-evaluation`; else `/subject-dashboard`. (a) Wrong role in the backend. (b) `get-config-info` failed / returned `[]` → falls back to the browser's cached `localStorage.standalone_mode` (possibly from another org/user). (c) Returning to `/login` while signed in uses only the cached value, not a fresh config read. (d) Any role other than `admin` (including empty) is shown the **Super Admin** UI if the user opens `/superadmin-dashboard` by URL. |
| **How to verify** | Network: `login` → `userData[0].userrole`; `get-config-info` → `configSetting.standalone`. Application ▸ Session Storage `userRole`; Local Storage `standalone_mode`, `org_standalone_<org>`. |
| **Relevant file** | `src/pages/Login.tsx` → `handleSubmit`, `fetchStandaloneMode`, redirect `useEffect`; `src/pages/SuperAdminDashboard.tsx` → `loggedInRole` (default `'superadmin'`), `isAdmin` |
| **Relevant API** | `POST …/login`, `GET …/get-config-info?OrgCode&CustCode&AppCode=AImarking` |
| **Expected behavior** | Fresh config decides Standalone Mode; role decides admin vs evaluator. |
| **Resolution** | Fix role/config in the backend; clear the browser's Local Storage and sign in again. Route guards do not check roles — report misuse as a security issue (see known issues). |

## 4. API not called

| | |
|---|---|
| **Problem** | User clicks / selects and nothing appears in the Network tab. |
| **Possible cause** | (a) Validation failed (a toast should explain). (b) Guard: a loader flag is active — candidate loads are skipped while any upload/save/approve flag is set (`loadCandidatesForWorkspace`). (c) Polling paused because a dialog is open. (d) Handler requires context that is missing: no workspace selected ("Please select a workspace first"), empty Year/Cycle ("No Year/Cycle available to load subjects."). (e) The control has no trigger at all — e.g. the standalone popup's Extract (the button is hidden by `showButton={false}`). (f) Request deduplicated: concurrent `list-workspace` calls share one in-flight request (`sharedListWorkspaceRequest`). |
| **How to verify** | Console for toasts/warnings; Application ▸ Session Storage for `workspaceid`, `subjectcode`, `yearcode`, `cyclecode`. |
| **Relevant file** | `src/pages/OCREvaluation.tsx` → `loadCandidatesForWorkspace` (~L4688), dialog-pause effect (~L5150); `src/components/ocr/ScriptExtractorPanel.tsx` (~L242) |
| **Relevant API** | depends on action |
| **Expected behavior** | Each user action fires its request once preconditions are met. |
| **Resolution** | Satisfy the precondition (select workspace/year/cycle, close dialogs, wait for the loader). For (e) there is no workaround; it is a known issue. |

## 5. API returns an error

| | |
|---|---|
| **Problem** | Request fires and fails (non-2xx, `(failed)`, or 200 with `F001`). |
| **Possible cause** | Backend fault, validation error, wrong parameters (default org codes `ICME01` / `ICMELIVE` / `ICME1` sent because a session key is missing), wrong host. |
| **How to verify** | Network: status, response body, request params. Compare `OrgCode`/`UserCode` to the user's real codes. |
| **Relevant file** | the page owning the action (see [API integration mapping](../api/api-integration-mapping.md)) |
| **Relevant API** | — |
| **Expected behavior** | Errors surface as a toast with the server message where available. |
| **Resolution** | 5xx/4xx with correct params → backend team with request + timestamp. Wrong params → re-login to rewrite session keys (both casings). Note some handlers show success on failure (see [API failure handling](./api-failure-handling.md) ⚠ rows). |

## 6. UI not showing API data

| | |
|---|---|
| **Problem** | The response contains data but the screen shows nothing, old data, or different data. |
| **Possible cause** | (a) **Mock fallback** replaced it: Home lists (`USE_MOCK_DATA_WHILE_BACKEND_IN_DEV = true`), candidate table on failure (`generateMockCandidates`), question list (`defaultMockQuestionsList`, 5 questions) when `question-data` is empty/fails. (b) Field-name mismatch — the mappers accept specific spellings (e.g. `yearcode`/`yearCode`, `segmentationstatus`/`segmentationStatus`); a new spelling becomes empty. (c) Stale-response guard discarded a slow answer (request-id refs in SubjectDashboard). (d) Response shape: lists accept a bare array or `data.data` (some also `workspaces`). (e) Settings: a section missing from the new org's config keeps the **previous org's** values. |
| **How to verify** | Compare the response body with what is displayed; look for console warnings "…showing mock … data…". |
| **Relevant file** | `src/pages/SubjectDashboard.tsx` (~L36, fetch functions); `src/pages/OCREvaluation.tsx` → `loadCandidatesForWorkspace` mapping (~L4795–4930); `src/pages/SuperAdminDashboard.tsx` → `loadSettings` (~L4224) |
| **Relevant API** | `get-year-data`, `get-cycle-data`, `get-subject-data`, `candidate-process-data`, `question-data`, `get-config-info` |
| **Expected behavior** | Real data shown; errors visible. |
| **Resolution** | Fix the backend response/data; for Settings, reload the page after switching org. Report new field spellings to developers. |

## 7. Dropdown empty (years / cycles / subjects / organisations)

| | |
|---|---|
| **Problem** | A selector has no options, "No cycles", or "Loading..." forever. |
| **Possible cause** | **Admin dashboard:** `get-year-data` / `get-cycle-data` failed or returned nothing → errors only logged; Year select then has **no options at all**; Cycle shows "No cycles". Organisation lists come from `organization-details?CustCode=ICME` (hard-coded customer). Admin role: the org dropdown is hidden by design. **Evaluator Home:** never empty for years/cycles/subjects — mock data fills it (see 6). Subjects with `status === 0` are filtered out. **OCREvaluation subject dropdown:** depends on `yearcode`/`cyclecode` session keys from the Home page. |
| **How to verify** | Network: the list request status and body; Session Storage `yearcode`, `cyclecode`, `orgCode`. |
| **Relevant file** | `src/pages/SuperAdminDashboard.tsx` → shell `fetchHeaderYears` / `fetchHeaderCycles` (~L7634–7695), `YearCycleDropdowns` (~L548), sections' `fetchOrganizations`; `src/pages/SubjectDashboard.tsx` → `fetchYears`, `fetchCycles`, `fetchSubjectsForCycle` |
| **Relevant API** | `get-year-data`, `get-cycle-data?YearCode`, `get-subject-data`, `organization-details` |
| **Expected behavior** | First item auto-selected after load. |
| **Resolution** | Create the missing Year/Cycle/Subject/Org data in the backend; check `VITE_AIMARKING_API_BASE`. |

## 8. Table empty

| | |
|---|---|
| **Problem** | Candidate table, subject table or user table shows no rows. |
| **Possible cause** | **Candidates:** `candidate-process-data` returned no `details` → "No candidates found matching your filters"; filters still set (status/phase/search); wrong `SubjectCode` (standalone forces `generic`), wrong `WorkspaceId` in session. **Subjects (admin):** empty Year/Cycle during cycle reload (toast "No Year/Cycle available to load subjects."), wrong org selected (first org auto-selected). **Users:** fetched for the first organisation, using its **name** as `OrgCode`. |
| **How to verify** | Network: params and body of the list call. Clear filters. |
| **Relevant file** | `src/pages/OCREvaluation.tsx` → `loadCandidatesForWorkspace`, filter (~L9244); `src/pages/SuperAdminDashboard.tsx` → `SubjectQuestionPanel.fetchSubjects`, `RoleManagementSection.fetchOrgs` (~L6568) |
| **Relevant API** | `candidate-process-data`, `get-subject-data`, `get-user-details` |
| **Expected behavior** | Rows for the selected context. |
| **Resolution** | Correct the context (org/year/cycle/subject/workspace) or the backend data. For users of a non-first org, see known issues. |

## 9. Button not visible

| | |
|---|---|
| **Problem** | Expected button is missing. |
| **Possible cause** | **Student Export** (Home): only when **all four** stages are `true` in `get-config-info` **and** at least one subject is listed (mock subjects count). **Download** (candidate toolbar): hidden in Standalone Mode with Segmentation only. **Create New Workspace**, **Delete**, **Add Missing Files**: hidden when `userRole === 'superadmin'`. **Rerun** (OCR/Evaluation): only when the stage's raw status is `4` and the no-question marker is not `1`. **Logout** in OCREvaluation header: hidden for `superadmin`. **Subject & Question / Marks Schema** menus: hidden for `admin`. **Extract** in the standalone OCR popup: never visible (known issue). |
| **How to verify** | `get-config-info` → `configSetting.workflowStages`; Session Storage `userRole`; candidate row raw statuses in `candidate-process-data`. |
| **Relevant file** | `src/pages/SubjectDashboard.tsx` → `areAllWorkflowStagesEnabled` (~L83), `fetchWorkflowConfig`; `src/pages/OCREvaluation.tsx` → `isSuperAdmin` (~L956), toolbar (~L8689, ~L8905, ~L9478–9529), Rerun cells; `src/pages/SuperAdminDashboard.tsx` → `navItems` |
| **Relevant API** | `get-config-info`, `candidate-process-data` |
| **Expected behavior** | As above. |
| **Resolution** | Enable the stages in Config Settings, or use the correct role. |

## 10. Button disabled

| | |
|---|---|
| **Problem** | Button visible but greyed out. |
| **Possible cause** | **Download:** any selected candidate not found in the current table (e.g. **selection carried over from another workspace** — selection is not cleared on workspace switch), or a selected candidate has an enabled stage below Completed; Standalone with Evaluation off; export in progress. **Delete:** nothing selected. **Sign in:** username or password empty, or loading. **Student Export → Download:** register number empty or exporting. **Rerun:** that row is already running. **Cycle select (admin):** loading or no cycles. **Add Missing Files:** not the workspace owner, 30 s cooldown, or a stage incomplete. |
| **How to verify** | Check selection count vs visible rows; candidate statuses. |
| **Relevant file** | `src/pages/OCREvaluation.tsx` → `allDownloadable` (~L9509), Download button (~L9529); `src/pages/Login.tsx` → `submitDisabled` |
| **Relevant API** | — |
| **Expected behavior** | Enabled when preconditions are met. |
| **Resolution** | Clear the selection (select-all toggle or reload) after switching workspace; wait for stages to complete. |

## 11. Navigation failure / blank page

| | |
|---|---|
| **Problem** | White page, nothing renders, or 404 "Not Found". |
| **Possible cause** | **`/standalone-ocr`**: route renders `StandaloneOCREvaluation` with no props → its dialog `open` is undefined → blank. **`/sandbox`**: requires `sessionStorage.sandboxLogin === 'true'`, which nothing writes → redirected to `/login`. **`/dashboard`** after registration: `Register` navigates there after auto-login, but the route does not exist → NotFound. **Stuck white overlay**: `PageLoader` is a solid white full-screen overlay; if a flag stays true the page looks blank. **Deep link on the server**: the app uses `BrowserRouter`, so the web server must rewrite unknown paths to `index.html`; otherwise a refresh on `/subject-dashboard` returns a server 404. **Case-sensitive build**: `App.tsx` imports `./pages/register` but the file is `Register.tsx` — builds on Linux/CI fail. **JS error**: check the console. |
| **How to verify** | URL, console errors, Network (is `index.html` served for the deep link?). |
| **Relevant file** | `src/App.tsx` (routes, `RequireAuth`); `src/pages/StandaloneOCREvaluation.tsx`; `src/pages/SandboxDashboard.tsx` (~L507); `src/pages/Register.tsx` (~L362); `src/components/ui/loader.tsx` |
| **Relevant API** | — |
| **Expected behavior** | Every route renders; unknown routes show NotFound. |
| **Resolution** | Use `/ocr-evaluation` instead of `/standalone-ocr`; after registering, go to `/login`; configure SPA fallback on the host; fix the import casing (developer). |

## 12. Session and auth issues

| | |
|---|---|
| **Problem** | "Never logged out", "logged out when opening a new tab", "other user's settings appear", "can open admin page as evaluator". |
| **Possible cause** | Session is a `sessionStorage` flag: per tab, cleared on tab close, **no idle timeout** (`SessionTimeout` component is never mounted), **no token**, **no 401 handling**. Logout handlers remove only 8 session keys; they do not call `clearAuthSession()` and leave lowercase variants (`orgcode`, `usercode`, `custcode`, `user`), `subjectcode`, `workspaceid`, `icme_ocr.*` drafts and all localStorage (`standalone_mode`, `workflowStages`, `org_*`). `RequireAuth` checks only `isLogin`, not role. Plain-text password is kept in `sessionStorage.password`. |
| **How to verify** | Application ▸ Storage after logout. |
| **Relevant file** | `src/App.tsx` → `RequireAuth`; `src/lib/session.ts`; logout handlers in `OCREvaluation.tsx` (~L921), `SubjectDashboard.tsx` (~L328), `SuperAdminDashboard.tsx` (~L7750); `src/components/SessionTimeout.tsx` |
| **Relevant API** | — |
| **Expected behavior** | (Current design) logout returns to `/login`. |
| **Resolution** | Ask users on shared machines to close the browser after logout and clear site data. Escalate role-guard concerns as security issues ([known issues](../known-issues.md)). |

## 13. Incorrect status badge

| | |
|---|---|
| **Problem** | Badge says "Approved" but the row isn't approved, or the "Approved" filter misses rows that say Approved, or "Yet to …" for a failed/stopped stage. |
| **Possible cause** | Status mapping: `3 → 'pending'`, `2 → 'completed'`, `1 → 'in-progress'` (`'completed'` for segmentation-only), anything else (`0`, `4`) → `'yet-to-…'`. The badge renders **both `pending` and `approved` as "Approved"**, but the filter compares the internal value, so status-3 OCR/Evaluation rows display "Approved" yet are excluded by the Approved filter. Phase 1 becomes `'approved'` only when `approvedstatus === 1` and segmentation status is 3. After an approve whose backend calls failed, the row is set to `approved` **locally** until the next poll. Raw status `4` maps to `yet-to-…` (so the badge reads "Yet to OCR/Evaluation") and a **Rerun** button appears beside it. The "Stopped" badge is driven by a different field: it is shown for OCR/Evaluation when the candidate's no-question marker (`noqMarker`) is `1`. |
| **How to verify** | Network: `candidate-process-data` → `details[].segmentationstatus/ocrstatus/markingstatus/approvedstatus`. |
| **Relevant file** | `src/pages/OCREvaluation.tsx` → `mapStatusCodeToPhaseStatus` (~L4795), `StatusBadge` (~L449), filter (~L9244) |
| **Relevant API** | `candidate-process-data` |
| **Expected behavior** | Badge reflects backend status. |
| **Resolution** | Trust the backend status; wait for the next poll (30 s) or reopen the workspace. |

## 14. Incorrect data binding

| | |
|---|---|
| **Problem** | Values belong to another org/subject/year, or obviously sample values appear. |
| **Possible cause** | (a) Mock year/cycle/subject codes from the Home page leaked into session keys and real API calls. (b) Dual-case keys out of sync (`orgCode` vs `orgcode`). (c) Admin sections act on the **first organisation** returned, not the admin's own. (d) Marks Schema viewer uses the session org, not the selected org. (e) Settings keeps previous org's values for missing sections. (f) Student Export always sends `CustCode=ICME` (reads never-written `custCode`) and falls back to `OrgCode=ICMELIVE`. (g) Score save sends the question max as `maxscore` and may send stale `all_questions_ranked`. |
| **How to verify** | Compare request params with the user's real codes; check Session Storage both casings. |
| **Relevant file** | `src/pages/SubjectDashboard.tsx` → `handleSelect`, `handleStudentExport`; `src/pages/SuperAdminDashboard.tsx` → `SettingsSection.fetchOrganizations`, `MarksSchemaSection.handleViewCard` (~L2979); `src/pages/OCREvaluation.tsx` → `saveEvaluationScoreOnServer` (~L3547) |
| **Relevant API** | various |
| **Expected behavior** | All calls use the signed-in user's org and the selected context. |
| **Resolution** | Re-login; fix missing backend data so mocks aren't used; report as known issues. |

## 15. Environment configuration issue

| | |
|---|---|
| **Problem** | App talks to the wrong environment, or some calls go to `undefined/…`. |
| **Possible cause** | (a) Vite **bakes `VITE_*` at build time** — editing `.env` on the server after build does nothing. (b) Wrong template copied to `.env` before build. (c) Missing variables fall back to **hard-coded hosts**, and fallbacks differ by call site (e.g. the marks-scheme conversion's `VITE_ICMEPRODUCT_API_BASE` fallback differs from the page-level one; `VITE_REPO_BASE` fallbacks differ in path case between `OCREvaluation.tsx` and `SuperAdminDashboard.tsx`). (d) `VITE_API_BASE_URL` (signup) is in **no** loaded env template and has no fallback → `undefined/aiapps/AIProductApi/signup`. (e) `.env.development` defines only `VITE_API_BASE`, which no live code reads, so `npm run build:dev` / `vite --mode development` rely on `.env` or fallbacks. (f) Dev-only proxies (`/api`, `/ICMEOcrRepo`) in `vite.config.ts` do not exist in production builds. |
| **How to verify** | Network request hosts; ask the deploy owner which `.env` was present at build time. Search the built bundle (`dist/assets/*.js`) for the expected host. |
| **Relevant file** | `.env*` templates; `vite.config.ts`; constants at the top of `Login.tsx`, `OCREvaluation.tsx` (~L61–106), `SubjectDashboard.tsx` (~L15), `SuperAdminDashboard.tsx` (~L51–53, ~L2828, ~L6492); `src/api.ts`; `src/lib/extraction.ts` |
| **Relevant API** | all |
| **Expected behavior** | All hosts match the target environment. |
| **Resolution** | Set every variable listed in [Environment configuration](../environment-configuration.md), rebuild, redeploy. |

## 16. Standalone-mode settings not taking effect

| | |
|---|---|
| **Problem** | Admin turned Standalone Mode on/off or changed stages, but the evaluator still sees the old behaviour. |
| **Possible cause** | (a) Save didn't really persist (`save-config-info` treats any 2xx as success; only lowercase `s001`/`s002` recognised) while **the admin's** browser localStorage was updated anyway. (b) Evaluator's browser uses cached `localStorage.standalone_mode` / `workflowStages` until the next config read: login, opening Create Workspace, or switching workspace. The redirect on returning to `/login` uses the cached value only. (c) `get-config-info` returned `[]` or no `standalone` field → cached value kept. (d) Admin saved for the **wrong org** (first org auto-selected for admins). (e) Login requires `customerCode` exactly `ICME` for the config call. |
| **How to verify** | `get-config-info?OrgCode=<org>&CustCode=ICME&AppCode=AImarking` from the evaluator's browser; compare with Local Storage. |
| **Relevant file** | `src/pages/SuperAdminDashboard.tsx` → `handleSaveToDB` (~L4644); `src/pages/Login.tsx` → `fetchStandaloneMode`; `src/pages/OCREvaluation.tsx` → dialog config fetch (~L1108), config effect (~L3146), `resolveSubjectCode` |
| **Relevant API** | `save-config-info`, `get-config-info` |
| **Expected behavior** | After saving, the next login reflects the new mode. |
| **Resolution** | Confirm the server value via `get-config-info`; have the evaluator log out, clear Local Storage, and log in. |

## 17. Excel export missing sheets or columns

| | |
|---|---|
| **Problem** | Downloaded workbook lacks a sheet, a column, or candidates. |
| **Possible cause** | **Download (workspace):** each sheet (`ObtainedScore`, `Evaluation Details`, `Indexing & OCR Data`) is added **only if it has data rows**; the `OCR` column of `Indexing & OCR Data` is dropped when no row has OCR text; candidates without evaluation data are skipped in the score sheets; when candidates are selected, records are filtered by registration number (mismatched numbers drop rows); paging stops at an empty page, `totalcount`, or 200 pages. **Student Export (Home):** two sheets; question columns `Q1…Qn` with at least 8; values from `processdata.eval_data`; rows with unparsable `processdata` get Total 0. |
| **How to verify** | Network: every `get-all-data-exports?PageNumber=` response; check `totalcount` and parsed `indexingdata`/`ocrdata`/`evaluationdata`. |
| **Relevant file** | `src/pages/OCREvaluation.tsx` → Download `onClick` (~L9529–9911); `src/pages/SubjectDashboard.tsx` → `handleStudentExport` |
| **Relevant API** | `get-all-data-exports`, `student-export` |
| **Expected behavior** | One sheet per data type that exists. |
| **Resolution** | Ensure the stage completed and data was saved; re-run Download after processing. |

## 18. Images not loading

| | |
|---|---|
| **Problem** | Page images are broken, or images display but "Download" fails. |
| **Possible cause** | (a) Relative repo paths are prefixed with `IMAGE_BASE` = `${VITE_REPO_BASE}/` (fallback host if unset) and `encodeURI`d; a wrong `VITE_REPO_BASE` breaks every image. (b) The standalone popup concatenates `IMAGE_BASE + path` **without encoding**, so paths with spaces/special characters can fail there. (c) **CORS:** the repository does not send CORS headers — `<img>` works, but `fetch()` used for downloads is blocked. In development `fetchImageBlob` retries the same path same-origin, which only works when the path starts with the dev proxy prefix `/ICMEOcrRepo`; in production builds there is no proxy. (d) Windows/UNC paths become `file://` URLs, which browsers block. (e) Mixed content (http image on https site). |
| **How to verify** | Network ▸ Img: status of the image request and its full URL; console CORS errors on download. |
| **Relevant file** | `src/pages/OCREvaluation.tsx` → `IMAGE_BASE` (~L61), `toDisplayableImageUrl` (~L128), `fetchImageBlob` (~L2294), `handleOpenOcrReview` (~L6154); `vite.config.ts` (proxy) |
| **Relevant API** | image repository (`VITE_REPO_BASE`) |
| **Expected behavior** | Images load from the repo; downloads succeed where CORS allows. |
| **Resolution** | Correct `VITE_REPO_BASE` and rebuild; ask infrastructure to add `Access-Control-Allow-Origin` on the repo or host the app on the same origin. |
