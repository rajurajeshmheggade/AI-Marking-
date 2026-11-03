# Unused or Unmapped APIs

Endpoints that are defined in the source but never called from reachable UI, endpoints reachable only from dead code, and whole API modules that nothing imports. Verified by searching `src/` for each symbol and its call sites.

"Reachable" means: a user of the running app can trigger the call through rendered UI. See [api-integration-mapping.md](./api-integration-mapping.md) for everything that is reachable.

---

## 1. Endpoints defined but never called

| Endpoint | Where defined | Why it is never called | Recommendation |
|---|---|---|---|
| `GET {API_BASE1}/subject-list` | `OCREvaluation.tsx` → `API_ENDPOINTS.subjectList` (~L75) | The key is never referenced. Comments at ~L3888 and ~L4239 say the dropdown was moved from this org-wide call to `get-subject-data`. | Remove the key. |
| `POST {API_BASE}/update-question-mapping` | `OCREvaluation.tsx` → `API_ENDPOINTS.updateQuestionMapping` (~L97), comment "optional endpoint … backend may implement this" | Never referenced. Mapping changes are saved through `save-indexing-info`. | Remove, or implement if the backend exists. |
| `POST {API_BASE}/run-ocr` (via the map) | `OCREvaluation.tsx` → `API_ENDPOINTS.runOcr` (~L103) | The key is unused; `handleRunOcr` builds `${API_BASE}/run-ocr` inline (~L6280). Same URL, so the endpoint **is** called — only the map entry is dead. | Use the map entry or delete it. |
| `POST {VITE_AIAPPS_API_BASE}/AITranscription/extract` (via the map) | `OCREvaluation.tsx` → `API_ENDPOINTS.aiTranscription` (~L106) | Unused; calls go through `src/lib/extraction.ts` → `DEFAULT_ENDPOINT`. The endpoint itself is live (X01). | Delete the map entry. |
| `POST {API_BASE1}/import-subject-data` (non-v2) | `SuperAdminDashboard.tsx` ~L2946 | Commented out ("TODO: Uncomment original import-subject-data call once backend issue is resolved"). The live import uses `import-subject-data-v2`. | Remove the comment block or track it as a ticket. |
| `POST {API_BASE}/update-status` (three extra calls) | `OCREvaluation.tsx` ~L6272, ~L6374, ~L6386 | Commented out in `handleRunOcr` / `handleRunEvaluation`. | Remove. |
| `IsType=1` questions import | `SuperAdminDashboard.tsx` → `IMPORT_IS_TYPE.questions` (~L817) | `importTab` is initialised to `'subject'` and `setImportTab` is never called, so `IsType` is always `0`. | Remove the questions branch or add the tab. |

---

## 2. Endpoints reachable only from dead or unreachable code

| Endpoint | Caller | Why unreachable | Recommendation |
|---|---|---|---|
| `GET {API_BASE1}/subject-list` | `SuperAdminDashboard.tsx` → `AdminSubjectView.fetchSubjects` (~L131/137) | `AdminSubjectView` renders only when `activeSection === 'dashboard'` and the user is not an admin. No menu item sets `'dashboard'` (sidebar items: role-management, settings, subject-question, marks-schema; initial state `'role-management'`). | Delete `AdminSubjectView` and the `dashboard` section, or restore a menu entry. |
| `GET {API_BASE1}/organization-details` (AdminSubjectView copy) | `AdminSubjectView` effect (~L103) | Same as above. (The endpoint is live elsewhere.) | Same. |
| `<SubjectDashboard/>` inside SuperAdmin (admin role) | `SuperAdminDashboard.tsx` ~L7871 | Same `dashboard` section; admins can never reach it. | Same. |
| `POST {API_BASE}/evaluate-text` | `OCREvaluation.tsx` → `handleManualEvaluation` (~L1696, call ~L1721) | Called only when `isManualEvalMode` (~L12051). In that configuration (Evaluation only) `questionFlowMode` is `'text'`, and the handler returns earlier at `if (questionFlowMode)` (~L12038) to open the per-question popup. | Delete `handleManualEvaluation` and `manualEvalResult`. |
| `POST {API_BASE}/evaluate-text` and `POST {API_BASE}/ocr-image` (upload target fallback) | `createWorkspaceAsync` (~L1948), `uploadAddedFiles` (~L5783, ~L5981): `targetEndpoint = (segmentation \|\| indexing) ? upload-pdfs : (ocr ? ocr-image : evaluate-text)` | These functions are used for Segmentation/Indexing workspaces; OCR and Evaluation use `submitOcrWorkflow` / `submitEvaluationWorkflow`. The fallback branches are not expected to run in the live UI. Full certainty would require proving that no stage combination reaches these functions without Segmentation/Indexing; Implementation behavior could not be conclusively determined from the current frontend source. | Replace the ternary with `upload-pdfs` and an explicit error. |
| `POST {API_BASE}/run-evaluation` + `update-status` (`type:3, status:2`) | `OCREvaluation.tsx` → `handleRestartEvaluation` (~L6783) | Its "Stalled" button renders only when `isCandidateStalled()` is true, and that function always returns `false` (~L6780, "Stalled condition removed as per request"). | Delete the button and handler. |
| `POST <user-entered URL>` | `SuperAdminDashboard.tsx` → `ExcelInlineEditor.handleUpload` (~L417) | `ExcelInlineEditor` is never rendered. | Delete. |
| `POST {AIAPPS}/AITranscription/extract` from the panel | `components/ocr/ScriptExtractorPanel.tsx` → `handleExtract` | The panel passes `showButton={false}` to `ExtractionControls`, so there is no button that calls `handleExtract`. (The endpoint is live through Standalone Create & Extract.) | Decide whether re-extraction from the popup is wanted; otherwise remove `handleExtract`. |
| `POST {VITE_API_BASE_URL}/aiapps/AIProductApi/signup` | `Register.tsx` → `handleSubmit` → `src/api.ts` → `registerUser` | The form always fails validation: `organizationName` is required but has no input field. `VITE_API_BASE_URL` also has no fallback and is in no env template. Route `/register` is reachable only by typing the URL. | Fix or remove the page (see [../pages/register-page.md](../pages/register-page.md)). |
| `POST {AIAPPS}/AIProductApi/send-email` | `Register.tsx` → `sendRegistrationEmail` | Runs only after a successful signup. | Same. |
| `POST {AIAPPS}/AIProductApi/updateActiveRegisteredUser` | `Register.tsx` → `sendRegistrationEmail` | Same. | Same. |
| `POST {API_BASE1}/login` (auto-login after registration) | `Register.tsx` → `sendRegistrationEmail` | Same; also only handles the old response shape and navigates to the non-existent `/dashboard`. | Same. |
| `GET {VITE_API_APPS_URL}/get_app_details` | `src/api.ts` → `getAppDetails`, called by `src/pages/AppIframe.tsx` | `AppIframe` is not in the router and not imported. | Delete `AppIframe.tsx` and `getAppDetails`. |
| `POST {AIAPPS}/Login/ssoTokenGen` | `src/pages/AppIframe.tsx` (`SSO_ENDPOINT`) | Same. Would also send `sessionStorage.email` (never written) and the plain-text password. | Delete. |

Not API calls but related dormant UI: the SuperAdmin "Advanced Add User" modal (toast only, no request), the Question JSON Creator (opener commented out), `ImportPanel` (no requests). See [../admin/admin-dashboard.md](../admin/admin-dashboard.md#other-components-in-the-file-that-are-never-rendered).

---

## 3. Dead API modules

| Module | Content | Evidence | Recommendation |
|---|---|---|---|
| `src/api.ts` (partly) | Live: `loginUser`, `registerUser` (and `getAppDetails` for dead `AppIframe`). Unused exports: `getLearningObjectives` (`/lo`), `fetchUsageStats` / `getBookWiseUsage` (`/get_usage`), `getChapters` (`/chapter`), `fetchDropdownOptions` (`/dropdownloader`), `generateItem` (`/item_gen`), `getFromDB` (`/get_from_db`), `deleteQuestion` (`/delete-question`), `updateQuestion` (`/update-question`) — all on `VITE_ITEM_GEN_API_URL`; `subscribeToApp` (`/subscribe_app` on `VITE_API_APPS_URL`); `sendStep1API`–`sendStep3API` (`setTimeout` simulations, no network); `API_QUIZ_URL`. | Only `Login.tsx`, `Register.tsx`, `AppIframe.tsx` import `@/api`, and only for `loginUser`, `registerUser`, `getAppDetails`. | Move `loginUser` into a small auth module; delete the item-generation functions. |
| `src/api_ish.ts` | Older copy of `src/api.ts` (`VITE_LOGIN_API_BASE`). | No importer. | Delete. |
| `src/utils/api.ts` | Another copy (`VITE_LOGIN_API_BASE`). | No importer. | Delete. |
| `src/utils/Aigapi.ts` | Copy for an "AIG" item generator (`VITE_AIG_ITEM_GEN_API_URL`). | No importer. | Delete. |
| `src/config.js` | `API_ENDPOINTS` map for a Knowledge Base and Quiz-Gen product (`get-customer-data`, `get-existing-knowledgebase`, `list_kb_files`, `save-guideline`, …) with **hard-coded hosts** (not env vars). | No importer. | Delete; it also leaks host names into the repository. |
| `src/utils/config.ts` | `getApiBaseUrl()` (`VITE_LOCAL_PROXY`, `VITE_AI_EXCELSOFT_BASE`). | No importer. | Delete. |
| `src/api/base.ts`, `src/api/base_ish.ts`, `src/api/updateQuestion.ts` | 0-byte files. | Empty. | Delete, or use `src/api/` for a real service layer. |

Risk of keeping these: a developer searching for "api" finds four near-identical modules and may edit the wrong one; `src/config.js` also exports a second, unrelated `API_ENDPOINTS` symbol.

---

## 4. Env variables that only feed dead code

| Variable | Dead consumer |
|---|---|
| `VITE_API_APPS_URL` | `getAppDetails`, `subscribeToApp` |
| `VITE_ITEM_GEN_API_URL`, `VITE_API_QUIZ_URL` | unused `src/api.ts` exports |
| `VITE_LOGIN_API_BASE`, `VITE_AIG_ITEM_GEN_API_URL` | `src/api_ish.ts`, `src/utils/api.ts`, `src/utils/Aigapi.ts` |
| `VITE_LOCAL_PROXY` | `src/utils/config.ts` |
| `VITE_API_BASE` (`.env.development`) | nothing |

Details: [../environment-configuration.md §3.2](../environment-configuration.md#32-variables-used-in-code-but-missing-from-every-example-file).
