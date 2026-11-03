# Known Issues and Risk Register

Consolidated, de-duplicated register of bugs and risks found while documenting the frontend. **Every item was re-verified against the current `src/`** before inclusion; items from the first documentation pass that did not hold were dropped or corrected (see [§9](#9-verification-notes--corrections-to-the-first-pass)). Nothing here has been fixed in code — this is a register, not a changelog.

Severity:

- **High** — security/access exposure, data loss or corruption, a feature that cannot work, or a failure that is reported to the user as success.
- **Medium** — wrong behaviour with a workaround, misleading UI, or a likely support incident.
- **Low** — hygiene, latent defects in rarely used paths, maintainability.

Line numbers are approximate (`~L`). Support-facing playbooks: [Troubleshooting](./support/troubleshooting.md).

## Summary

| Area | High | Medium | Low | Total |
|---|---|---|---|---|
| 1. Security & access | 6 | 4 | 0 | 10 |
| 2. Build & configuration | 2 | 2 | 4 | 8 |
| 3. Mock data in production | 2 | 1 | 1 | 4 |
| 4. Registration | 1 | 2 | 1 | 4 |
| 5. Routes | 0 | 1 | 1 | 2 |
| 6. Administration | 3 | 4 | 5 | 12 |
| 7. Workspace & candidates | 0 | 6 | 4 | 10 |
| 8. Review & evaluation | 4 | 2 | 3 | 9 |
| **Total** | **18** | **22** | **19** | **59** |

---

## 1. Security & access

| ID | Sev | File → function | Symptom | Suggested fix direction |
|---|---|---|---|---|
| SEC-01 | High | `src/App.tsx` → `RequireAuth`; `src/pages/SuperAdminDashboard.tsx` → `loggedInRole` (~L7617), `isAdmin` | Route guard checks only `sessionStorage.isLogin === 'true'`. Any signed-in user can open `/superadmin-dashboard` by URL. Role defaults to `'superadmin'` and only `'admin'` is restricted, so a `user` (or a missing role) gets the **full Super Admin UI** (all orgs' config, subjects, schemes, users). | Role-aware guard (allow-list per route); never default a missing role to the most privileged one; enforce authorisation on the backend. |
| SEC-02 | High | all pages (no `Authorization` header, no interceptor) | No token is sent on any API call and there is no 401/403 handling. The backend cannot distinguish an authenticated caller from anyone who knows the URL; if the backend begins enforcing auth, the UI has no recovery path (no redirect to login). | Issue a session/JWT at login, attach it via a shared axios instance, handle 401 → clear session → `/login`. |
| SEC-03 | High | `src/pages/Login.tsx` → `handleSubmit`; `src/pages/Register.tsx` (~L356) | Plain-text password stored in `sessionStorage.password` (readable by any script on the origin). Its only reader is the dead `AppIframe.tsx`. | Stop storing the password. |
| SEC-04 | High | `src/pages/Login.tsx` → `handleSubmit` (customer check after session writes) | A non-ICME user gets "Access denied." but `isLogin='true'`, `userInfo`, `userRole`, codes are already written and **not cleared** (only the inactive-account branch calls `clearAuthSession`). Reloading `/login` or opening a protected URL then lets that user into ICME pages. | Perform the customer check before writing session keys, or call `clearAuthSession()` in that branch. |
| SEC-05 | High | `src/pages/SuperAdminDashboard.tsx` → `RoleManagementSection` (`password: u.password_hash …` ~L6619, `openEdit` ~L6681, `handleEditSave`) | Edit-user form pre-fills the stored password **hash** into the password field, requires a password, and sends it back as `passwordHash` on every edit — exposing the hash in the DOM and risking a double-hashed (unusable) password. | Never return hashes to the client; make password optional on edit and send only when changed. |
| SEC-06 | High | `src/components/ocr/ExtractionOutputTabs.tsx` → `renderMarkdown` (~L16), used at ~L166, ~L234 | OCR/interpretation text from the API is rendered with `marked` into `dangerouslySetInnerHTML` without sanitising; the `catch` path injects the raw text as HTML. Stored XSS if OCR output contains HTML/script. | Sanitise (e.g. DOMPurify) after `marked.parse`; render plain text on failure. |
| SEC-07 | Medium | logout in `OCREvaluation.tsx` (~L921), `SubjectDashboard.tsx` (~L328), `SuperAdminDashboard.tsx` (~L7750); `src/lib/session.ts` → `clearAuthSession` | Logout removes 8 camel-case session keys only. It does not call `clearAuthSession()` and leaves `user`, `orgcode`, `usercode`, `custcode`, `appcode`, `subjectcode`, `workspaceid`, `icme_ocr.*` drafts and all localStorage (`standalone_mode`, `workflowStages`, `org_*`). | One shared logout that calls `clearAuthSession()` plus workflow/draft keys. |
| SEC-08 | Medium | `src/components/SessionTimeout.tsx` (never imported) | No idle timeout; a session lasts until the tab closes. | Mount an idle timer that performs a real logout. |
| SEC-09 | Medium | `src/pages/Register.tsx` → `sendRegistrationEmail` (~L299) | Login link payload is "encrypted" with a hard-coded AES key `'Excelsoft'` in client code — trivially reversible / forgeable. | Server-generated, signed, expiring tokens. |
| SEC-10 | Medium | `src/pages/SuperAdminDashboard.tsx` → `SettingsSection` (~L3817), `RoleManagementSection` (~L6491), `SubjectQuestionPanel`/`MarksSchemaSection` org fetch | Customer is hard-coded to `ICME` for organisation lookups (`organization-details?CustCode=ICME`, `custCode: 'ICME'`), ignoring the signed-in customer. Combined with ADM-01 this lets an Admin act outside their own org. | Scope by the signed-in customer/org; enforce on the backend. |

## 2. Build & configuration

| ID | Sev | File → function | Symptom | Suggested fix direction |
|---|---|---|---|---|
| CFG-01 | High | `src/App.tsx` (import `./pages/register`) | File is `src/pages/Register.tsx`. Works on Windows/macOS (case-insensitive), **fails to build on Linux/CI**. | Fix the import casing. |
| CFG-02 | High | `src/api.ts` → `registerUser` (`API_BASE_URL = import.meta.env.VITE_API_BASE_URL`) | `VITE_API_BASE_URL` is in no loaded env template (only in the non-standard `.envIsh`) and has no fallback → signup POSTs to `undefined/aiapps/AIProductApi/signup`. | Add to templates or derive from `VITE_AIAPPS_API_BASE`. |
| CFG-03 | Medium | constants in `Login.tsx` (~L19), `OCREvaluation.tsx` (~L61–106, ~L1114, ~L3152), `SubjectDashboard.tsx` (~L15), `SuperAdminDashboard.tsx` (~L51–53, ~L2828, ~L6492), `src/api.ts`, `src/lib/extraction.ts`, `Register.tsx`, `AppIframe.tsx` | Every `VITE_*` read has a hard-coded host fallback, so a missing variable silently targets another environment. Fallbacks are inconsistent: the marks-scheme conversion (`convert-markscheme-to-md`) uses a different host/path fallback for `VITE_ICMEPRODUCT_API_BASE`; `VITE_REPO_BASE` fallbacks differ in path case between OCREvaluation and SuperAdminDashboard. | One `config.ts` that reads each variable once and fails loudly when missing. |
| CFG-04 | Medium | `vite.config.ts` | Dev-only proxies (`/api`, `/ICMEOcrRepo`) have hard-coded targets; the image-download fallback in `fetchImageBlob` only works in dev and only for paths starting with the proxy prefix. Production downloads depend on the repo sending CORS headers. | Serve images same-origin or add CORS on the repo; make proxy targets env-driven. |
| CFG-05 | Low | `.env.development` | Defines only `VITE_API_BASE`, which no live code reads. | Remove or replace with the real variable set. |
| CFG-06 | Low | `src/App.tsx` → `QueryClientProvider` | React Query provider mounted, no `useQuery`/`useMutation` anywhere. | Remove, or adopt it for data fetching. |
| CFG-07 | Low | repository | `eslint .` reports **697 problems (655 errors, 42 warnings)**. | Fix incrementally; gate new code. |
| CFG-08 | Low | `src/pages/OCREvaluation.tsx`, `SuperAdminDashboard.tsx` | ~17,600- and ~7,900-line files with ~180 `useState` each; high regression risk for any change. | Split into feature components and a service layer. |

## 3. Mock data in production

| ID | Sev | File → function | Symptom | Suggested fix direction |
|---|---|---|---|---|
| MOCK-01 | High | `src/pages/SubjectDashboard.tsx` → `USE_MOCK_DATA_WHILE_BACKEND_IN_DEV = true` (~L36); `fetchYears`, `fetchCycles`, `fetchSubjectsForCycle`, `handleSelect` | When year/cycle/subject APIs fail **or return empty**, mock years (`2024`/`2025`), cycles (`C1`–`C4`) and subjects (e.g. `S1_10`) are shown with no error. The mock codes are then sent to real APIs (`get-cycle-data`, `get-subject-data`) and written to session keys used by `list-workspace` / `create-workspace`. Mock subjects also satisfy the Student Export visibility check. | Set the flag to `false` (or gate on `import.meta.env.DEV`); show an error/empty state. |
| MOCK-02 | High | `src/pages/OCREvaluation.tsx` → `loadCandidatesForWorkspace` catch (~L4977), `generateMockCandidates` (~L4646); `generateMockEvaluationData` (~L4467) used at ~L4898 | A non-silent `candidate-process-data` failure shows "…showing sample data instead" and **fake candidate rows** the user can click. Every real row is also initialised with mock `evaluationData` (score 7), which the evaluation review uses as a fallback when `marks_awarded` is absent (~L14574, ~L15338). | Show an error state; never attach sample data to real rows. |
| MOCK-03 | Medium | `src/pages/OCREvaluation.tsx` → `defaultMockQuestionsList` (~L4333), question load (~L4613) | Five sample questions are the initial state and the fallback when `question-data` is empty or fails. | Empty state + error. |
| MOCK-04 | Low | `src/pages/OCREvaluation.tsx` → OCR preview (`generateMockSegmentImages`, ~L12760) | Bundled sample page images are used only when the candidate has no `segmentImages` (real rows have `[]`, so in practice only mock rows show them). | Remove with MOCK-02. |

## 4. Registration (`src/pages/Register.tsx`)

| ID | Sev | Function | Symptom | Suggested fix direction |
|---|---|---|---|---|
| REG-01 | High | `handleSubmit` validation (~L211) | `organizationName` is required but the form has no input for it → the form **can never submit**. | Remove the rule or add the field (Customer/Organization selects already exist). |
| REG-02 | Medium | `sendRegistrationEmail` (~L346) | Right after the e-mail is sent, the code calls `updateActiveRegisteredUser` and logs in — the account is activated **before** the e-mail link is clicked. | Activate only from the link. |
| REG-03 | Medium | `sendRegistrationEmail` (~L350–362) | Auto-login checks the old response shape (`loginRes.status`, `loginRes.data`). With the current `{statusCode, userData}` shape nothing happens; with the old shape it navigates to `/dashboard`, which is a 404. | Use the shared login handling and route to a real page. |
| REG-04 | Low | error branches (~L372, ~L380) | `setSaveAllDialogType("Failed to send email…")` is used where `setSaveAllDialogMessage` was intended → the "Save Failed" dialog shows an empty/stale message. | Call `setSaveAllDialogMessage`. |

## 5. Routes

| ID | Sev | File | Symptom | Suggested fix direction |
|---|---|---|---|---|
| RTE-01 | Medium | `src/App.tsx` → `/standalone-ocr`; `src/pages/StandaloneOCREvaluation.tsx` | Renders the popup with no props → `open` undefined → blank page. | Remove the route or give it a data-loading wrapper. |
| RTE-02 | Low | `src/pages/SandboxDashboard.tsx` | Guard key `sandboxLogin` is written nowhere → always redirects to `/login`. The page is entirely mock (`MOCK_MODE = true`), defaults the user to `'rajesh'`, and the guard runs in `useEffect` (after first paint). | Remove, or wire a real entry point. |

## 6. Administration (`src/pages/SuperAdminDashboard.tsx`)

| ID | Sev | Function | Symptom | Suggested fix direction |
|---|---|---|---|---|
| ADM-01 | High | `SettingsSection.fetchOrganizations` (~L3830); `RoleManagementSection.fetchOrgs` (~L6568), `fetchUsers` (~L6584) | For Admins (org selector hidden), Settings and User Management operate on the **first organisation returned** for customer ICME, not the Admin's `orgCode`. Settings ignores session org entirely; User Management starts with the session org code but overwrites it with the first org id. `get-user-details` is called with the organisation **name** as `OrgCode`. | Pre-select and lock the Admin's own org; use codes consistently. |
| ADM-02 | High | `SettingsSection.handleSaveToDB` (~L4644, fetch ~L4795) | Any 2xx = success. Recognises only lowercase `s001`/`s002`; uppercase `S001` or an `F…` code still shows `toast.success`. `finally` **always** writes the values to localStorage (`org_*`, global `standalone_mode`) even after HTTP failure or exception, so the admin's browser looks updated. A non-JSON 2xx body throws and shows an error although the save succeeded. | Check the envelope case-insensitively; mirror to localStorage only on confirmed success. |
| ADM-03 | High | `MarksSchemaSection.handleSubmit` (~L2961–2964) | If `save-questions` fails, a warning toast is followed by an unconditional "Marks schema and questions uploaded successfully!". | Return after the failure; show one accurate outcome. |
| ADM-04 | Medium | `SettingsSection.loadSettings` (~L4224) | State is not reset between orgs; any config section missing from the new org's response keeps the **previous org's** values (and Save would then write them to the new org). Runs twice per org load. | Reset to defaults before applying a response; load once. |
| ADM-05 | Medium | `SubjectQuestionPanel.handleConfirmDeleteSubject` (~L1369) | Sequential `delete-subject` calls in one `try`: the first error aborts the rest, earlier successes aren't reported, list not refreshed, selection kept. | Per-item results, then refresh. |
| ADM-06 | Medium | `SubjectQuestionPanel` import dialog (~L2130, checks ~L871–966, upload ~L1007) | The dialog's org select changes the page table (shared `selectedOrg`). Duplicate / "already exists" checks compare against subjects loaded for the **shell** Year/Cycle, while the upload uses the dialog's Year/Cycle. | Separate dialog state; validate against the target Year/Cycle. |
| ADM-07 | Medium | `MarksSchemaSection` — `handleViewCard` (~L2979), file input (~L3358), `handlePdfSelect` (~L2812–2846) | Viewer uses `getSessionCodes().orgcode \|\| 'ICME01'`, not the selected org. The picker accepts only `.doc,.docx` although the handler and message allow PDF (PDFs can't be chosen in the dialog). The synthetic file name strips only `.pdf`, so `x.docx` → `x.docx.md`. | Use selected org; align `accept` with the handler; strip any extension. |
| ADM-08 | Low | `SubjectQuestionPanel` / `MarksSchemaSection` `fetchSubjects` (e.g. ~L1068, ~L2759); `SettingsSection` | On Year change the shell blanks the cycle while cycles load, so these sections show "No Year/Cycle available to load subjects." and empty the table before reloading. `SettingsSection` does not reload subjects on Year/Cycle change at all. | Skip fetching while cycle is loading; add the dependency in Settings. |
| ADM-09 | Low | `RoleManagementSection` — create (~L6886) vs edit (~L6784) | Contact number: create `^\+?\d{10,13}$`, edit `^\+?\d{8,20}$`. | One shared validator. |
| ADM-10 | Low | `RoleManagementSection` create modal (~L7512) / `handleCreate` (~L6842) | Date `min` uses `toISOString()` (UTC — wrong day near midnight in IST); no past-date check on submit (the edit modal does it correctly). | Use the local-date helper and validate on submit. |
| ADM-11 | Low | `SubjectQuestionPanel.handleToggleStatus` (~L1472); delete user (~L6967) | Subject status toggle treats any 2xx as success and sends no Year/Cycle; delete-user falls back to `orgCode: selectedOrg` (an id, not a code). | Check envelope; send codes. |
| ADM-12 | Low (UI/UX) | `RoleManagementSection` — Edit modal (~L8530-8596), Create modal (~L8710-8812), Advanced Add User modal (~L8872-8876) | Three separate "add/edit a user" surfaces use three different visual treatments for the same task. Edit: gradient header (`from-[#2563eb] to-purple-600`), each field group in a shadowed white card on a gray body, a matching gradient accent bar beside every section label, gradient Save button. Create: the **same** gradient header, but no card wrapper, no gray body, no accent bars (plain `border-gray-200` inputs directly on white), and a flat `bg-[#2563eb]` button instead of a gradient one. Advanced Add User: drops the gradient header entirely for a plain white header with a bottom border and no icon badge. The Edit modal's password field is also where SEC-05 is visible on screen — it is pre-filled with the stored password **hash**, shown as dots behind the eye-toggle. | Pick one header/section/button treatment and reuse it across all three modals, or consolidate to fewer "add a user" entry points if three was not intentional; see SEC-05 for the password-hash field itself. |

## 7. Workspace & candidates (`src/pages/OCREvaluation.tsx` unless stated)

| ID | Sev | Function | Symptom | Suggested fix direction |
|---|---|---|---|---|
| WS-01 | Medium | `loadCandidatesForWorkspace` (~L4688, `setSelectedWorkspace` ~L4928), dialog-pause effect (~L5150), config effect (~L3146) | Each load replaces `selectedWorkspace`, which re-triggers the polling effect (interval restarted) and `get-config-info` (≈ every 30 s, `CustCode=ICME` hard-coded). The "all marked → stop polling" branch is immediately undone, so polling never stops while a workspace is open. | Depend on the workspace id, not the object. |
| WS-02 | Medium | `confirmDeleteSelectedCandidates` (~L3711) | `delete-candidate` succeeds if `res.data.success \|\| res.status === 200` → a failure body with HTTP 200 removes rows locally and shows "Successfully deleted". `isDeletable` (~L9273) is defined but unused, so any selected row can be submitted. | Check the envelope; use `isDeletable`. |
| WS-03 | Medium | `mapStatusCodeToPhaseStatus` (~L4795), `StatusBadge` (~L449), filter (~L9244) | Status 3 → `pending`, which the badge labels "Approved"; the "Approved" filter matches only `approved`, so OCR/Evaluation rows showing "Approved" are excluded. | Align labels and filter values. |
| WS-04 | Medium | workspace switch (card ~L8761, dropdown ~L9044, reset effect ~L5200); `allDownloadable` (~L9509) | `selectedCandidates` is not cleared on workspace switch; ids not found in the new table make `allDownloadable` false → Download disabled with no explanation. | Clear selection on switch. |
| WS-05 | Medium | inline Standalone "Create & Extract" handler (~L11862–12032) | Only checks that a workspace id came back from `create-workspace` (no status check) and ignores the `save-candidate-info` response; continues to upload and extract. | Use `assertStepSucceeded` like the evaluation chain (~L2684). |
| WS-06 | Medium | upload routing (~L1948, ~L5783, ~L5981) | `seg \|\| indexing ? upload-pdfs : ocr ? ocr-image : evaluate-text` — with an empty or missing stage config, files are posted to `evaluate-text`. | Refuse to upload when no stage is configured. |
| WS-07 | Low | `isSuperAdmin` (~L956) | Only `'superadmin'` is treated as super admin; an `admin` reaching `/ocr-evaluation` or `/subject-dashboard` by URL gets full evaluator controls (Create, Delete, Add files). | Central role helper. |
| WS-08 | Low | `src/pages/SubjectDashboard.tsx` → `handleStudentExport` (~L179) | Register number interpolated into the URL unencoded/untrimmed; `CustCode` read from never-written `custCode` (always `ICME`); `OrgCode` falls back to `ICMELIVE`. | `encodeURIComponent`; use `getSessionCodes()`. |
| WS-09 | Low | Download `onClick` catch (~L9906) | Any error (5xx, network) shows "No evaluation data available to export", hiding outages. | Distinguish "no data" from "request failed". |
| WS-10 | Low | Per-question upload dialog header (`DialogTitle`/`DialogDescription` ~L19616-19622) | Title/description read `questionFlowMode === 'images' ? 'Upload Images per Question' / 'upload its image' : …`, but `questionFlowMode` is `'images'` for Image, Audio, **and** Video upload modes alike. In Audio or Video mode the header still says "Upload Images per Question" / "upload its image" while the body below correctly asks for an audio/video file — the header text never reflects `isAudioUploadMode`/`isVideoUploadMode`. | Branch the title/description on `isVideoUploadMode`/`isAudioUploadMode` in addition to `questionFlowMode`. |

## 8. Review & evaluation (`src/pages/OCREvaluation.tsx` unless stated)

| ID | Sev | Function | Symptom | Suggested fix direction |
|---|---|---|---|---|
| REV-01 | High | `handleApprove` OCR path (~L8239–8306); `imageToTextForPayload`, `readQuestionOcrText` (~L242–254) | On OCR approve, rich OCR objects are reduced to `.transcription`; `transcription_latex`, `interpretation`, `blocks`, `issues`, `tokens` are lost from the saved record (except in the fallback path where type-1 data is unavailable). The "edited?" check also compares only `.transcription`. | Preserve the object and replace only the edited field. |
| REV-02 | High | `handleApprove` OCR path (~L8338–8451) | `update-status` (type 2) is inside the recalculation `try`: if `recalculate-standards` throws, status is never updated, yet the row and dialog are set to `approved` locally and "OCR approved and saved…" follows the error toast. | Stop on failure; don't patch local state until all steps succeed. |
| REV-03 | High | `handlePhase1Approve` (~L7701, ~L8020–8045) | OCR sync, recalculation and `update-status` (type 1) failures are only `console.warn`ed (error toasts commented out); the row is marked approved and a success toast shown. | Surface and stop on failure. |
| REV-04 | High | evaluation "Confirm & Save" (~L15611–15879); `saveEvaluationScoreOnServer` (~L3547) | (a) On save failure an error toast is shown, then pending edits are cleared and "Evaluation score updated to N" is shown; local state was already updated before the request. (b) `maxscore` sends the active question's max, not the candidate total (the sibling helper sends `final_score.max_score`). (c) `questiondetails` uses `all_questions_ranked \|\| eval_data`, ignoring edited `eval_data` when a stale ranked list exists. (d) Two Top-N totals: the UI computes one from all questions; the server function recomputes from image-mapped `eval_data` and that one is sent. | Single source of truth for totals; update UI only after success; send the correct fields. |
| REV-05 | Medium | `src/components/ocr/ScriptExtractorPanel.tsx` (~L242) → `ExtractionControls` | `showButton={false}` is passed to a component whose only output is the button → no Extract button and no subject/options UI. A dropped replacement image clears the result and can never be extracted; subject stays "General". | Render the button (and `CategoryDropdown`) in the panel. |
| REV-06 | Medium | `handlePhase1Approve` (~L7707–7758); OCR approve (~L8180–8229) | **Observed behaviour:** approval is refused unless something was edited ("No changes made. Please update the page mapping before approving." / "OCR data has not been edited…"). A correct AI result cannot be approved unchanged; the Quick-Approve "skip save if unchanged" branch (~L7772) is unreachable. Whether this is intended is a product question. | Confirm the rule with product; if unintended, allow approve-as-is. |
| REV-07 | Low | `handleRunEvaluation` (~L6306) | Fetches type-2 process data and builds `questionsArray` that is never used (payload sends `questions: []`, `isall: 1`); if that fetch fails, `run-evaluation` is never sent. | Drop the fetch. |
| REV-08 | Low | `handleOpenOcrReview` standalone branch (~L6154) | Image URLs built as `IMAGE_BASE + path` without encoding (unlike `toDisplayableImageUrl`), so paths with spaces/special characters break in the standalone popup. | Reuse `toDisplayableImageUrl`. |
| REV-09 | Low (UI/UX) | Evaluation Preview — Manual Marking Note popover (~L17458-17520) and the active-question sidebar highlight (~L17192-17200, duplicated for the horizontal strip ~L17066+) | (a) The "Manual Marking Note" card is `absolute right-0 top-9 …`, floating over the Evaluation Score / Save controls beneath it instead of sitting in the normal layout flow — on a question with a long note, it visually overlaps the score panel. (b) The current question's sidebar background is one of three unrelated colors depending on state: teal (normal), `#d97706` amber (missing evaluation), or `indigo-600` (has a manual marking note) — the indigo choice is disconnected from the teal "Manual Marks" badge/popover used for the same concept elsewhere in this same dialog, so the two "this question has a manual mark" indicators don't visually read as the same thing. | Give the popover a non-overlapping anchor (or constrain its height/position relative to the score panel); pick one accent color for "has manual marking" and reuse it for both the badge and the sidebar highlight. |

---

## Appendix A — Dead code

Verified by import/JSX search and by reading the guarding conditions.

**Modules never imported by live code**

`src/api_ish.ts`, `src/api/base.ts`, `src/api/base_ish.ts`, `src/api/updateQuestion.ts`, `src/utils/api.ts`, `src/utils/Aigapi.ts`, `src/utils/config.ts`, `src/utils/getTFOptions.ts`, `src/config.js`, `src/hooks/use-mobile.tsx` (only via unused `ui/sidebar`); `src/api.ts` → `getLearningObjectives`, `getAppDetails` (only from dead `AppIframe`); 28 shadcn primitive files with no importer, plus `sheet`, `skeleton`, `toggle` used only by those (see [component inventory §4](./components/component-inventory.md#4-shadcnui-primitives--srccomponentsui)).

**Components never rendered**

- Files: `AppSidebar`, `SuperAdminSidebar`, `SessionTimeout`, `ProfileDropdown`, `BackToTop`, `Footer`, `StandaloneAppHeader`, `AudioPlayer/AudioPlayer` (caps playback at 20 s via `Math.min(20, …)` — irrelevant while unused), `ocr/ExtractionMetrics`, `ocr/StatusBadge`; export `CategoryDropdown`.
- Page not routed: `src/pages/AppIframe.tsx`.
- In `SuperAdminDashboard.tsx`: `ImportPanel` (fake 1.2 s import), `ExcelInlineEditor`; `AdminSubjectView` and embedded `SubjectDashboard` (only in the `activeSection === 'dashboard'` branch, which no menu item sets); `SandboxDashboard` import; shell `organizations`/`sharedProps` (fetched, never passed); User Management Approve/Reject handlers (no UI trigger; would only change local state).
- In `StandaloneOCREvaluation.tsx`: `readStoredOcrResult`, `buildSegmentsFromStoredResult`, `MOCK_SEGMENTS`, unused `useMemo` import.

**Unused handlers / values in `OCREvaluation.tsx`**

`handleFolderUpload`, `handleZipUpload`, `handlePdfUpload` (never bound) → the mock upload chain `handle*UploadConfirmed` (~L5329–5611), `handleCreateWorkspaceUploadConfirm` and its AlertDialog (~L17527) are unreachable; `generateMockAnswerSheets`, `openUploadedFolder`, `handleRepositionPages`, `handleReorderPage`, `handleUpdate`, `handleSaveEdits`, `handleCancelEdits`; values `isBlockingPageLoader`, `isLogoutDisabled`, `isAnyUploadInProgress`, `isDeletable`, `isExportable`, `hasDownloadableSelected`, `hasAnyDownloadable`, an inner CSV `handleDownload` (~L9337–9428), `selectedEvaluated` / `hasEvaluatedSelected` (only in a commented-out button); props `overrideCustCode`, `overrideUserCode` (never passed); session keys read but never written (`custCode`, `workspacesid`, `fromdate`, `todate`, `org`, `UserNameDetails`, `displayName`, several subject spellings — see [state management](./architecture/state-management.md)).

## Appendix B — Questions for the backend team

1. Do any endpoints authenticate the caller today? If not, is a token (session/JWT) planned, and what 401/403 shape should the UI handle? (SEC-02)
2. Envelope status codes: is the canonical form `S001`/`S002`/`F001` (upper case)? Does `save-config-info` ever return lowercase `s001`/`s002`, and can it return HTTP 200 with a failure code? Same question for `delete-candidate`, `update-subject-data`, `update-status`, `save-questions`. (ADM-02, WS-02)
3. `get-user-details`: should `OrgCode` be the organisation **code** or **name**? `delete-user`: code or id? (ADM-01, ADM-11)
4. `create-user` on edit: is `passwordHash` re-hashed when it already contains a hash? Should the client ever receive `password_hash`? (SEC-05)
5. Are `get-year-data`, `get-cycle-data`, `get-subject-data` live and populated in every environment, so the frontend mock fallback can be removed? (MOCK-01)
6. Candidate status codes: please confirm the meaning of `0/1/2/3/4` for segmentation/OCR/marking and of `approvedstatus` — is `3` "pending approval" for every stage, and should approved OCR/evaluation rows carry a distinct value? (WS-03)
7. `save-ocr-data` / OCR approve: should the saved record keep the full extraction object (`transcription_latex`, `interpretation`, `blocks`, `tokens`), or only `transcription`? (REV-01)
8. Evaluation score save: what should `maxscore` contain (question max or candidate total), and which of `all_questions_ranked` / `eval_data` is authoritative for `questiondetails`? Should the server compute the Top-N total instead of the client? (REV-04)
9. `get-all-data-exports`: what is the server page size, and is `totalcount` guaranteed on every record? (Download loop)
10. Should `get-config-info` be scoped by the user's real customer code rather than `ICME`, and can it return an empty array for a valid org (currently treated as "unknown, use cache")? (SEC-10, troubleshooting §16)
11. Can the image repository (`VITE_REPO_BASE`) send `Access-Control-Allow-Origin` for the app's origins, so downloads work in production builds? (CFG-04)
12. Registration: which base should signup use (`VITE_API_BASE_URL` is undefined in all templates), and should activation happen only from the e-mail link? (CFG-02, REG-02)

---

## 9. Verification notes — corrections to the first pass

| First-pass claim | Outcome |
|---|---|
| `HeaderAccountControls` unused | **Wrong** — rendered by OCREvaluation and SubjectDashboard. |
| `AudioPlayer` caps playback at 20 s | Confirmed, but the component is unused → moved to Appendix A. |
| OCR preview falls back to bundled mock segments (StandaloneOCREvaluation) | **Corrected** — `MOCK_SEGMENTS` is only reachable from helpers that are never called (dead). OCREvaluation's own sample pages appear only for rows without `segmentImages` (MOCK-04, Low). |
| Marks Schema "picker accepts .doc/.docx while handler accepts .pdf" | **Corrected direction** — the picker accepts only `.doc,.docx`; the handler accepts `.pdf`, `.doc`, `.docx` (ADM-07). |
| Settings "briefly shows No Year/Cycle toast on Year/Cycle change" | **Corrected** — the toast on Year change comes from Subject & Question and Marks Schema; Settings simply doesn't reload subjects (ADM-08). |
| Register "navigates to `/dashboard` after auto-login" | **Refined** — only with the old login response shape; with the current shape the auto-login branch doesn't run (REG-03). |
| Phase 1 / OCR approve "require an edit" | Confirmed; phrased as observed behaviour (REV-06). |
| Mock candidates on table load failure | Confirmed, and extended: real rows also carry mock `evaluationData` used as a score fallback (MOCK-02). |
| All other first-pass items | Confirmed as listed above (some merged: no-token + no-401 → SEC-02; score-save sub-issues → REV-04). |
