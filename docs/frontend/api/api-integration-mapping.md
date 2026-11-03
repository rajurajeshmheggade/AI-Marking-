# API Integration Mapping (master reference)

Every HTTP endpoint the frontend calls, de-duplicated across pages, with the UI that triggers it and the UI it feeds. Use the [master table](#master-table) at the end to answer "which API feeds this UI element?".

- Bases and conventions: [api-overview.md](./api-overview.md)
- Field-level shapes: [api-request-response.md](./api-request-response.md)
- Error behaviour in one table: [api-error-handling.md](./api-error-handling.md)
- Endpoints that exist only in dead code: [unused-or-unmapped-apis.md](./unused-or-unmapped-apis.md)

Per-area detail (the source of most line references here): [../admin/admin-api-mapping.md](../admin/admin-api-mapping.md) · [../user/user-api-mapping-workspace.md](../user/user-api-mapping-workspace.md) · [../user/user-api-mapping-review.md](../user/user-api-mapping-review.md) · [../architecture/authentication-authorization.md](../architecture/authentication-authorization.md) · [../pages/register-page.md](../pages/register-page.md)

**Conventions in this document**

| Abbreviation | Meaning |
|---|---|
| `API_BASE1` | `VITE_AIMARKING_API_BASE` (AI Marking API) |
| `API_BASE` | `VITE_ICMEPRODUCT_API_BASE` (ICME OCR / processing API) |
| `IMAGE_BASE` / `REPO_BASE` | `VITE_REPO_BASE` (image repository) |
| `AIAPPS` | `VITE_AIAPPS_API_BASE` |
| OCR | `src/pages/OCREvaluation.tsx` |
| SD | `src/pages/SubjectDashboard.tsx` |
| SA | `src/pages/SuperAdminDashboard.tsx` |
| S&Q / MS / CS / RM | SA sections `SubjectQuestionPanel` / `MarksSchemaSection` / `SettingsSection` / `RoleManagementSection` |

No request sends an auth header. Every base has a hard-coded fallback host when its env var is unset (except `VITE_API_BASE_URL`). Line numbers are approximate (`~L`).

---

## Contents

**AI Marking API (`API_BASE1`)**
[M01 login](#m01-post-login) · [M02 get-config-info](#m02-get-get-config-info) · [M03 save-config-info](#m03-post-save-config-info) · [M04 get-year-data](#m04-get-get-year-data) · [M05 get-cycle-data](#m05-get-get-cycle-data) · [M06 get-subject-data](#m06-get-get-subject-data) · [M07 organization-details](#m07-get-organization-details) · [M08 customer-details](#m08-get-customer-details) · [M09 import-subject-data-v2](#m09-post-import-subject-data-v2) · [M10 question-data](#m10-get-question-data) · [M11 delete-subject](#m11-post-delete-subject) · [M12 update-subject-data](#m12-post-update-subject-data) · [M13 save-questions](#m13-post-save-questions) · [M14 get-marking-scheme](#m14-get-get-marking-scheme) · [M15 get-user-details](#m15-get-get-user-details) · [M16 create-user](#m16-post-create-user) · [M17 delete-user](#m17-post-delete-user) · [M18 list-workspace](#m18-get-list-workspace) · [M19 create-workspace](#m19-post-create-workspace) · [M20 delete-workspace](#m20-post-delete-workspace) · [M21 save-candidate-info](#m21-post-save-candidate-info) · [M22 candidate-process-data](#m22-get-candidate-process-data) · [M23 get-candidate-info](#m23-get-get-candidate-info) · [M24 delete-candidate](#m24-post-delete-candidate) · [M25 get-process-data](#m25-get-get-process-data) · [M26 get-all-data-exports](#m26-get-get-all-data-exports) · [M27 student-export](#m27-get-student-export)

**ICME OCR / processing API (`API_BASE`)**
[P01 upload-pdfs](#p01-post-upload-pdfs) · [P02 upload-pngs](#p02-post-upload-pngs) · [P03 upload-audios](#p03-post-upload-audios) · [P04 transcribe-audio](#p04-post-transcribe-audio) · [P05 save-ocr-data](#p05-post-save-ocr-data) · [P06 recalculate-standards](#p06-post-recalculate-standards) · [P07 run-evaluation](#p07-post-run-evaluation) · [P08 run-ocr](#p08-post-run-ocr) · [P09 save-indexing-info](#p09-post-save-indexing-info) · [P10 save-evaluation-data](#p10-post-save-evaluation-data) · [P11 update-status](#p11-post-update-status) · [P12 upload-marking-scheme](#p12-post-upload-marking-scheme) · [P13 convert-markscheme-to-md](#p13-post-convert-markscheme-to-md) · [P14 ocr-image / evaluate-text](#p14-post-ocr-image--evaluate-text-conditional-fallback)

**Image repository (`VITE_REPO_BASE`)**
[R01 script page images](#r01-get-image_basescriptpathnpng-and-other-page-images) · [R02 marking-scheme file](#r02-get-repo_baseguidelinepath)

**AI Apps and registration**
[X01 AITranscription/extract](#x01-post-aiappsaitranscriptionextract) · [X02 signup](#x02-post-vite_api_base_urlaiappsaiproductapisignup) · [X03 send-email](#x03-post-aiappsaiproductapisend-email) · [X04 updateActiveRegisteredUser](#x04-post-aiappsaiproductapiupdateactiveregistereduser)

[Master table](#master-table)

---

# AI Marking API (`API_BASE1`)

## M01 `POST /login`

| | |
|---|---|
| Purpose | Authenticate a user and return the identity record. |
| Called from | `Login.tsx` → `handleSubmit` (~L92) → `src/api.ts` → `loginUser(userName, password)` (~L48). Also `Register.tsx` → `sendRegistrationEmail` (auto-login, unreachable — see X02). |
| Trigger | Login form submit ("Login" button / Enter). |
| Client | `fetch`, headers `Content-Type: application/json`, `accept: */*`, no-cache headers. |
| Request | JSON `{ username, password }`, both `.trim()`-ed. |
| Response | `{ statusCode \| status, userData[] \| data[], message }`. Fields read from `userData[0]`: `usercode`, `organizationcode`, `customercode`, `userrole`, `username`, `active` (and camelCase variants). |

```text
userData[0]  → loginUser writes sessionStorage.user/userCode/usercode/orgCode/orgcode/customerCode/custcode/appcode
             → handleSubmit writes userInfo, isLogin='true', username, password, userRole
customercode ≠ 'ICME'         → inline error "Access denied."
active ∈ {0, 2, inactive…}    → setAccessDeniedMessage → "Access Denied" AlertDialog
userrole superadmin|admin     → navigate('/superadmin-dashboard')
other role + standalone (M02) → navigate('/ocr-evaluation')   else → navigate('/subject-dashboard')
```

| Error case | Behaviour |
|---|---|
| HTTP non-OK | `loginUser` throws "Network error during login" → red inline error. |
| `F001` / any non-`S001` / `S001` with empty array | Throws `message` or "Invalid username or password". |
| Network / CORS | Browser `TypeError` message (e.g. "Failed to fetch") shown as-is. |

Detail: [../architecture/authentication-authorization.md §1](../architecture/authentication-authorization.md#1-login-api) · [api-authentication.md](./api-authentication.md)

---

## M02 `GET /get-config-info`

| | |
|---|---|
| Purpose | Read the organisation's configuration (`configSetting`): workflow stages, standalone mode, segmentation/OCR/indexing/evaluation settings. The single source for workflow gating across the app. |
| Request | Query `OrgCode`, `CustCode`, `AppCode=AImarking` (SD adds `_t`). |
| Response | Array; only `[0].configSetting` is used (some callers also accept `.value` / `.Data`). |

Called from 8 places:

| # | Caller | Trigger | `CustCode` | Fields used → state → UI |
|---|---|---|---|---|
| a | `Login.tsx` → `fetchStandaloneMode` (~L33), `fetch` | After successful login (non-admin path) | upper-cased login `customerCode` | `standalone`, `workflowStages` → `localStorage.standalone_mode`, `workflowStages`, `org_selected_stages_<org>`, `org_standalone_<org>` → landing route |
| b | SD → `fetchWorkflowConfig` (~L614), axios | Mount / return from a subject | `'ICME'` | `workflowStages` (all four `=== true`) → `allWorkflowStagesEnabled` → **Student Export** button visibility |
| c | OCR → effect on `selectedWorkspace` (~L3146), `fetch` | Every `selectedWorkspace` change (≈ every 30 s poll) | `'ICME'` | `configSetting` → `apiConfig`, `workflowStages`, `standaloneMode`, localStorage → table columns, status widgets, score-chip colour, Standards chip, Download gating |
| d | OCR → create/upload dialog effect (~L1102), `fetch` | Create Workspace / Upload Additional Files dialog opens | `sessionStorage.customerCode` | same + `isConfigLoadingForDialog` → "Loading workflow configuration…", upload policy, question-flow mode |
| e | OCR → `handlePhase1Approve` (~L7809), `fetch` `no-store` | Segmentation/Indexing **Approve** | `'ICME'` | `workflowStages.ocr` → local `latestWorkflowStages` → whether the OCR sync block runs |
| f | OCR → Evaluation Confirm & Save handler (~L15616), `fetch` `no-store` | Evaluation **Confirm & Save** | `'ICME'` | `evaluationConfig.globalThresholds.topQuestionsCount`, `subjectOverrides[].topQuestionsCount` → `newTotal` → header score and table chip |
| g | S&Q → `isEvaluationStageEnabled` (~L1455), axios | Activating a subject (status toggle) | `'ICME'` | `workflowStages.evaluation` → requires a guideline before activation |
| h | CS → `loadSettings` (~L4224), `fetch` | After `organization-details` (M07); org change; after M03 | selected customer | all of `configSetting` → every Config Settings card (localStorage overrides applied) |

```text
[0].configSetting.workflowStages → setWorkflowStages / localStorage.workflowStages
      → OCR table columns (Segmentation/Indexing/OCR/Evaluation), create-dialog mode, Download enablement
[0].configSetting.standalone     → setStandaloneMode / localStorage.standalone_mode → login landing, subjectcode 'generic'
[0].configSetting.evaluationConfig.globalThresholds.passMarkThreshold → getPassMarkThresholdFor → score chip colour
```

| Error case | Behaviour |
|---|---|
| a | Any failure → `null` → cached `localStorage.standalone_mode` used; `console.warn`. |
| b | Error → Student Export hidden. |
| c, d | Non-OK / empty ignored; exception `console.error` only; cached stages kept. |
| e | `console.warn`; in-memory `workflowStages` used. |
| f | `console.error`; falls back to `baseTotal + delta`. `res.json()` called without `ok` check. |
| g | Error → returns `true` (evaluation assumed on). |
| h | Error / empty → silent fallback to localStorage values. |

Detail: [../user/user-workspaces.md §3](../user/user-workspaces.md#3-configuration-loading) · [../admin/admin-configuration.md](../admin/admin-configuration.md#loadsettingsorgcode-l4224)

---

## M03 `POST /save-config-info`

| | |
|---|---|
| Purpose | Persist the organisation configuration. |
| Called from | SA → CS → `handleSaveToDB` (~L4644), `fetch`. |
| Trigger | **Save Settings** button, after client-side validation. |
| Request | JSON `{ orgCode, custCode, appCode:'AImarking', configSetting:{ OrgCode, CustCode, workflowStages, standalone, segmentationConfig?, ocrConfig?, indexingConfig?, evaluationConfig? } }` — stage-specific blocks only when that stage is on. Full payload: [api-request-response.md](./api-request-response.md#m03-save-config-info). |
| Response | `code \| status \| message`. |

```text
result.code|status === 's001' → toast "Settings saved successfully (s001)"
                     's002' → toast "Settings updated successfully (s002)"
                     other  → toast result.message || "Configuration saved to database!"
then loadSettings(orgCode) (M02-h) → every settings card re-rendered
finally: localStorage mirror (org_* keys, standalone_mode) always written
```

| Error case | Behaviour |
|---|---|
| HTTP non-OK | Toast "Failed to save configuration: <status>". |
| Network | Toast "Error connecting to the API to save settings". |
| Envelope `F*` / `S001` upper-case | Not handled → generic success toast. |
| Any outcome | localStorage mirror still written, so the browser shows the new values even when the save failed. |

Detail: [../admin/admin-configuration.md — Save](../admin/admin-configuration.md#save-handlesavetodb-l4644)

---

## M04 `GET /get-year-data`

| | |
|---|---|
| Purpose | List examination years. |
| Request | No params (SD sends no-cache headers). |
| Response | Array or `data` / `items` / `subjects`; rows `yearid`, `yearname`, `yearcode`. |

| Caller | Trigger | State → UI |
|---|---|---|
| SD → `fetchYears` (~L373) | Mount; return from a subject | `years`, `selectedYearCode` (first if none) → Year `<select>` |
| SA shell → `fetchHeaderYears` (~L7635) | Mount | `headerYears`, `headerSelectedYearCode` → Year select in S&Q, MS, CS |
| S&Q → `fetchImportYears` (~L693) | Mount | `importYears`, `importSelectedYearCode` → Import dialog "Select Year" |
| OCR → `fetchAllSubjectsAcrossYearsAndCycles` (~L3894) | OCR mount when sessionStorage has no year/cycle (typical for Standalone users) | used only to fan out M05/M06 |

```text
data[].yearcode/yearname → setYears → Year <select> options → onChange setSelectedYearCode → M05
```

| Error case | Behaviour |
|---|---|
| SD empty or error | **Mock years** (`USE_MOCK_DATA_WHILE_BACKEND_IN_DEV = true`), `console.warn`. With the flag off: error state + Retry + toast. |
| SA shell | `console.error` only; sections show no year. |
| S&Q import | Toast "Failed to load years"; "No Years Found" disables Import. |

Detail: [../user/user-dashboard.md §4.2](../user/user-dashboard.md#42-fetchyears-l373) · [../admin/admin-dashboard.md](../admin/admin-dashboard.md#effects)

---

## M05 `GET /get-cycle-data`

| | |
|---|---|
| Purpose | List cycles of a year. |
| Request | `YearCode`. |
| Response | Rows `cycleid`, `cyclename`, `cyclecode` (`yearid`, `yearcode`). |

| Caller | Trigger | State → UI |
|---|---|---|
| SD → `fetchCycles` (~L436) | `selectedYearCode` change | `cycles` → Cycle cards |
| SA shell → `fetchHeaderCycles` (~L7667) | `headerSelectedYearCode` change | `headerCycles`, `headerSelectedCycleCode` → Cycle select |
| S&Q → `fetchImportCycles` (~L728) | `importSelectedYearCode` change | `importCycles` → Import dialog "Select Cycle" |
| OCR → fan-out (~L3906) | as M04 | – |

```text
data[].cyclecode/cyclename → setCycles → Cycle card grid → click → setSelectedCycleCode → M06
```

Errors: SD → mock cycles (flag on); SA shell → `console.error`; S&Q → toast "Failed to load cycles", "No Cycles for this Year".

---

## M06 `GET /get-subject-data`

| | |
|---|---|
| Purpose | List subjects for an org/year/cycle (with workspace counts and readiness). |
| Request | `orgCode, custCode=ICME, yearCode, cycleCode, userCode` (SA sends no-cache headers). |
| Response | Array, `data[]` or `subjects[]`; rows `subjectid, subjectcode, subjectname, kbpath, guidelinepath, workspacecount, status, isReady`. |

| Caller | Trigger | State → UI |
|---|---|---|
| SD → `fetchSubjectsForCycle` (~L494) | Cycle click; return from a subject | `subjects` → Subject cards (name, workspace count) |
| OCR → `fetchSubjectsForYearCycle` / fan-out via `fetchSubjectsSmart` (~L3955); `refreshSubjects` (~L4007) | OCR mount; `goBackToHome`; after workspace delete | `subjects` (status 1 only), `selectedSubject`, `activeSubjectData`, `subjectsLoaded` → breadcrumb label, "Mark schema not uploaded" warning, triggers M18/M10 |
| S&Q → `fetchSubjects` (~L1060) | Org/year/cycle change; after import/delete/status change | `subjects` → Subject table |
| MS → `fetchSubjects` (~L2750) | Org/year/cycle change; after upload | `subjects`, `cards` → Subject select, Uploaded Schemes grid |
| CS → `fetchSubjects` (~L4184), `fetch` | After M07; org change | `subjects` → subject-wise override grids |

```text
data[].subjectname/workspacecount → setSubjects → Subject card → click handleSelect
      → sessionStorage subjectcode/yearcode/cyclecode → <OCREvaluation preselectedSubject…/>
data[].guidelinepath (OCR) → activeSubjectData → empty-state "Mark schema not uploaded…"
```

Errors: SD → mock subjects (flag on); OCR → toast "Failed to load subjects" (placeholder list kept); SA sections → toast "Failed to load subjects".

---

## M07 `GET /organization-details`

| | |
|---|---|
| Purpose | List organisations of a customer. |
| Request | `CustCode` (literal `ICME` in shell and S&Q; selected customer in MS, CS, RM). |
| Response | `data[]` (CS also accepts `data.data`): `organizationid, organizationname, organizationcode`. |

| Caller | Trigger | State → UI |
|---|---|---|
| SA shell effect (~L7698) | Mount, superadmin only | `organizations` — **not consumed** |
| S&Q → `fetchOrganizations` (~L664) | Mount | `organizations`, `selectedOrg` → Organization select (page + import dialog) |
| MS effect (~L2730) | Mount; customer change | Organization select |
| CS → `fetchOrganizations` (~L3832), `fetch` | Mount; customer change | Organization select → triggers M06 + M02-h |
| RM → `fetchOrgs` (~L6569), `fetch` | Mount; customer change | Organization selects → triggers M15 |

Admin users never see the Customer/Organization selects; their org is pre-scoped from `sessionStorage.orgCode`.

Errors: S&Q/MS → toast "Failed to load organizations"; CS, shell → log only (CS then never calls `loadSettings`); RM → `organizations=[]`.

---

## M08 `GET /customer-details`

| | |
|---|---|
| Called from | RM → `fetchCustomers` (~L6551), `fetch`, on mount. |
| Request | none. |
| Response | `data[]` or array: `customercode, customername` → `customerList` → Customer selects (filter bar, Create modal). |
| Errors | Error or empty → fallback list `[ICME]`. |

---

## M09 `POST /import-subject-data-v2`

| | |
|---|---|
| Purpose | Bulk-import subjects/questions from a file into an org/year/cycle. |
| Called from | S&Q → `handleImportSubmit` (~L857). |
| Trigger | Import dialog → **Import**. |
| Request | multipart `File`, `IsType=0`, `OrgCode`, `YearCode`, `CycleCode`. |
| Response | `status`, `message`. |

```text
status S001 → toast "added" · S002 → toast "updated" · no status → treated as success
→ dialog closes → fetchSubjects (M06) → Subject table
```

Errors: `F*` → "Failed to import: <message>"; HTTP error → toast server message / "Import failed. Please try again.". `importing` drives the overlay.

Detail: [../admin/admin-subject-question.md — Import](../admin/admin-subject-question.md#import-dialog)

---

## M10 `GET /question-data`

| | |
|---|---|
| Purpose | Question list (labels, marks, rubric) for a subject. |
| Request | `OrgCode, CustCode, SubjectCode`. |
| Response | Array or `ref1Data[]`: `questionLabel, marks/totalMarks, questionText[] {text, marks, rubric[] {text, score}}, rubric`. |

| Caller | Trigger | State → UI |
|---|---|---|
| OCR question-list effect (~L4506) | `selectedSubject` / `subjectsLoaded` change | `questions`, `questionsEmpty`, `questionListLoading` → per-question info popup (rubric), per-question create flow, Excel export Q columns |
| OCR → `refreshWorkspaces` (~L4176) | `list-workspace` returned no rows | `questionsEmpty` → "No questions found. Please contact administrator." |
| S&Q → `handleOpenQuestionPreview` (~L1339) | Q-Preview (eye) icon | `previewData` → Question preview dialog |

Errors: OCR effect → `questions = defaultMockQuestionsList` (**mock questions**) on error or empty; OCR probe error → `questionsEmpty=false`; S&Q → toast "Failed to load question preview".

---

## M11 `POST /delete-subject`

| | |
|---|---|
| Called from | S&Q → `handleConfirmDeleteSubject` (~L1369); one request per selected subject. |
| Trigger | Delete (n) → confirm. Client guard: only `userRole === 'superadmin'` (toast "Only superadmin can delete subjects"). |
| Request | JSON `{ subjectCode, orgCode, yearCode, cycleCode }`. |
| Response | `status` (`S001` = success), `message`. |
| UI | Failures collected → per-subject toast; `selectedRows` cleared; M06 refresh. |
| Errors | First exception aborts the loop → "Deletion failed. Please try again." |

---

## M12 `POST /update-subject-data`

| | |
|---|---|
| Called from | S&Q → `handleToggleStatus` (~L1472). |
| Trigger | Status badge → confirm Active/Inactive (activation first checks M02-g and the guideline). |
| Request | JSON `{ subjectCode, isActive, orgCode }`. |
| Response | Not read; any 2xx = success → M06 refresh → STATUS badge. |
| Errors | Toast "Failed to update subject status". |

---

## M13 `POST /save-questions`

| | |
|---|---|
| Called from | MS → `handleSubmit` (~L2872, call ~L2949), after P12. |
| Trigger | **Confirm & Save** in the upload dialog, when the markdown parses into questions (`src/utils/mdQuestionParser.ts`). |
| Request | JSON `{ custcode, orgcode, subjectCode, questions:[{ questionLabel, questionText[], marks }] }`. |
| Response | Not read. |
| Errors | Warning toast "Marking schema uploaded, but questions could not be saved: <msg>"; the generic success toast still follows. |

---

## M14 `GET /get-marking-scheme`

| | |
|---|---|
| Called from | MS → `handleViewCard` (~L2979). |
| Trigger | Click on an Uploaded Schemes card. |
| Request | `OrgCode` (**session** org or `ICME01`, not the selected org), `CustCode=ICME`, `SubjectCode`, `FilePath`. |
| Response | `content` or raw body → `cardContent` → View scheme dialog (markdown). |
| Errors | Falls back to R02; if that fails → "Failed to load content. Please contact your administrator."; empty → "No content available." |

---

## M15 `GET /get-user-details`

| | |
|---|---|
| Called from | RM → `fetchUsers` (~L6584), `fetch`. |
| Trigger | Customer/org change; after create/edit. |
| Request | `UserCode` (session), `OrgCode` = **organization name** (not code), `CustCode`. |
| Response | `userDetails[]` → mapped rows → `roleList` → Users table (admins do not see `admin` rows). |
| Errors | `roleList=[]`, log only. |

Detail: [../admin/admin-user-management.md](../admin/admin-user-management.md#row-mapping-l6597)

---

## M16 `POST /create-user`

| | |
|---|---|
| Called from | RM → `handleCreate` (~L6842) and `handleEditSave` (~L6744), `fetch`. |
| Trigger | Create modal **Create User**; Edit modal **Save Changes**. |
| Request | JSON `{ userId (0 create / row.userid edit), organizationId:<org name>, customerCode, firstName, lastName, email, contactNumber, address, loginName, userCode, passwordHash, userRole:'User', isSSO:0, fromDate, toDate }`. |
| Response | `status \| errorCode \| errorcode`, `message \| Message`. |
| UI | `res.ok` → success toast, modal closes, M15 refresh. |
| Errors | `E001` → "Login name already exists!…"; non-OK → server message; exception → "An error occurred". |

Note: every user created from the UI gets `userRole:'User'`; there is no UI to create admins.

---

## M17 `POST /delete-user`

| | |
|---|---|
| Called from | RM → `handleActionConfirm` (~L6953), **axios**. |
| Trigger | Row action Delete → **Yes, Delete**. |
| Request | JSON `{ custCode, orgCode, loginName }`. |
| Response | `statusCode \| status` (`S001` = success), `message` → row removed from `roleList` locally. |
| Errors | `F001`/other → message or "Failed to delete user"; exception → "Failed to delete user". |

---

## M18 `GET /list-workspace`

| | |
|---|---|
| Purpose | Workspaces of the user for a subject (and token usage). |
| Response | Array, `data.data` or `data.workspaces`: `workspaceid, workspacename, createddate, filecount, totalsize, candidatecount, standardcount, totaltokenusage, usercode, status`. |

| Caller | Trigger | Request | State → UI |
|---|---|---|---|
| OCR → `refreshWorkspaces` (~L4052) | `subjectsLoaded`/`selectedSubject` change; back to list; Workspace ▼ change; after delete | `fromdate` (session or `2024-12-01`), `todate` (today), `orgcode, custcode, usercode, SubjectCode` (`generic` in standalone) | `workspaces`, `workspacesLoaded` → Workspace cards, Workspace ▼, header token count |
| SD → `fetchTokens` (~L546) | Mount; return from a subject | same dates, `orgcode, custcode=ICME, usercode, subject_code=''` | sum of `totaltokenusage` → `totalTokens` → header token chip |

```text
data[] (sorted by createddate desc) → map → setWorkspaces → Workspace card (name, status pill, candidate count)
      → card click → syncWorkspaceIdToSession → M22 + startCandidatePolling
```

Errors: OCR → toast "Failed to load workspaces" (non-silent only), aborts ignored, empty → M10 probe; SD → `console` only.

Detail: [../user/user-workspaces.md §6](../user/user-workspaces.md#6-workspace-list)

---

## M19 `POST /create-workspace`

| | |
|---|---|
| Purpose | Register a workspace before files/candidates are attached. |
| Called from | OCR → `createWorkspaceAsync` (~L1734, Segmentation/Indexing), `submitOcrWorkflow` (~L2638), `submitEvaluationWorkflow` (~L2925), Standalone **Create & Extract** (~L11885). |
| Trigger | Create Workspace dialog primary button (or per-question popup **Submit**). |
| Request | JSON `{ orgCode, custCode:'ICME', userCode, subjectCode, workspaceId:0, workspaceName, candidateCount:0, standardCount (1 = audio) }`. |
| Response | `status \| sp_status \| spStatus` (`S001`/`SUCCESS`/`F001`), `outWorkspaceId \| workspaceId \| workspace_id`, `message`. |

```text
F001 → setWorkspaceNameExistsError("Workspace name already exists…") → banner in the Create dialog
S001 → outWorkspaceId → sessionStorage.workspaceid → next step (M21 / P01 / P02)
```

| Error case | Behaviour |
|---|---|
| `createWorkspaceAsync` non-`SUCCESS`/`S001` | Toast "Failed to create workspace. Please try again." |
| OCR / Evaluation chains | `assertStepSucceeded(['S001'])` → toast server message; missing id → "Workspace id missing from the create-workspace response". |
| Standalone Create & Extract | Envelope **not checked**; only `outWorkspaceId` required ("Workspace ID missing from response"). |

Detail: [../user/user-create-workspace-and-upload.md §5](../user/user-create-workspace-and-upload.md#5-api-chains-per-mode)

---

## M20 `POST /delete-workspace`

| | |
|---|---|
| Called from | OCR → `handleConfirmDeleteWorkspace` (~L4989). |
| Trigger | Workspace checkboxes → Delete (n) → **Confirm Deletion**. Workspaces with candidates are skipped client-side. |
| Request | JSON `{ workspaceId: "<id>,<id>" }`. |
| Response | `status \| responseCode \| ResponseCode` (`S001` or `success`), `message \| responseMessage`. |
| UI | Success toast → `refreshWorkspaces({force})` (M18) → `refreshSubjects()` (M06). |
| Errors | Other status → toast server message / "Cannot delete workspace(s)…"; exception → "An error occurred while deleting…". |

---

## M21 `POST /save-candidate-info`

| | |
|---|---|
| Called from | OCR → `createWorkspaceAsync` (Standalone Indexing ZIP, ~L1861), `submitOcrWorkflow` (~L2693), `submitEvaluationWorkflow` (~L2976), Standalone Create & Extract (~L11898). |
| Trigger | Automatically after M19 in the same create chain. |
| Request | JSON `{ firstName, lastName, registrationNumber, centerName, centerAddress, subjectCode, orgCode, custCode, numberOfQuestions, scriptPath, dateOfExamination, countryName, workspaceId, folderName, userCode, isValid }` (`'N/A'` placeholders are common). |
| Response | `status` (`S001`), `message`. Not shown in UI except as a step label. |
| Errors | `assertStepSucceeded` → toast server message / "Failed to save candidate information"; **unchecked** in Standalone Create & Extract. |

---

## M22 `GET /candidate-process-data`

| | |
|---|---|
| Purpose | Candidate rows and per-stage statuses of a workspace. The table's only data source. |
| Called from | OCR → `loadCandidatesForWorkspace` (~L4688); `ensureCandidateIsNew` (~L2447, duplicate check); create chains after upload (~L2876, ~L3065). |
| Trigger | Workspace card click / Workspace ▼; **poll every 30 s** (silent); after every approve, save, re-evaluation, rerun, delete; Evaluation dialog close; before creating a candidate (duplicate check). |
| Request | `OrgCode, CustCode, UserCode` (`getFinalCodes`), `SubjectCode` (`generic` in standalone), `WorkspaceId`; no-cache headers. |
| Response | `{ summary[], details[] }` — see [api-request-response.md](./api-request-response.md#m22-candidate-process-data). |

```text
summary[0].userCode         → selectedWorkspace.userCode → isUserCodeMismatch → Upload Additional Files lock,
                                                            row checkbox (isSelectable)
summary[].folderName        → selectedWorkspace.uploadedFolders → folder grouping rows
details[].registrationNumber→ candidates[].id/candidateName → table row
details[].segmentationStatus/approvedStatus/ocrStatus/markingStatus → mapStatusCodeToPhaseStatus
                            → candidates[].phase1/2/3 → StatusBadge per column, status widgets, Rerun buttons (status 4)
details[].obtainedScore/maxScore/final_score → score chip
all markingStatus === 2     → stopCandidatePolling()
```

| Error case | Behaviour |
|---|---|
| Non-silent load | Toast "Failed to load candidate data, showing sample data instead" + **mock candidates** (`generateMockCandidates`). |
| Silent (poll) | `console.error` only. |
| Duplicate check | Toast "Unable to verify the candidate right now. Please try again." (blocks); found → "Candidate already exists…". |
| Empty summary/details | "Candidate answer scripts getting uploaded." |

Detail: [../user/user-candidate-table.md §2](../user/user-candidate-table.md#2-data-load-loadcandidatesforworkspace)

---

## M23 `GET /get-candidate-info`

| | |
|---|---|
| Request | `registrationnumber, workspaceid`. |
| Response | Array or `data[]`: `firstName, lastName, registrationNumber, centerName, centerAddress, dateOfExamination, countryName, scriptPath`. |

| Caller | Trigger | State → UI |
|---|---|---|
| OCR → `openCandidateDetails` (~L7097) | Candidate-number link (when Candidate Info is enabled) | `candidateInfoDetails` → Candidate Details dialog (missing → "N/A") |
| OCR → `loadSegmentationOnlyPages` (~L2388) | Phase-1 badge in a Segmentation-only workspace | `[0].scriptPath` → R01 probing → `answerSheets` → Segmentation dialog page viewer |

Errors: details → all fields "N/A" (`console.error`); segmentation → toast "Failed to load candidate information" / "No segmented images available.".

---

## M24 `POST /delete-candidate`

| | |
|---|---|
| Called from | OCR → `confirmDeleteSelectedCandidates` (~L3711). |
| Trigger | Select rows → Delete → Confirm. Hidden and blocked for `superadmin` ("Superadmin cannot delete candidates"). |
| Request | JSON `{ orgcode, custcode, usercode, workspaceid, subject_id, registrationnumber:"a,b" }`. |
| Response | `success` or HTTP 200 → rows removed from `candidates`; `selectedWorkspace.candidateCount` decremented. |
| Errors | Toast "Failed to delete candidates". |

---

## M25 `GET /get-process-data`

| | |
|---|---|
| Purpose | Full processing record of one candidate for one stage: `type=1` segmentation/indexing, `type=2` OCR, `type=3` evaluation. |
| Request | `orgcode, custcode='ICME', usercode, type, registernumber, subjectcode ('generic' in standalone), workspaceid, adstatus:0`. |
| Response | `data[0]` envelope `{ candidateId, workspaceid, remainingCount, totalCandidateCount, scriptPath, processData }` — see [api-request-response.md](./api-request-response.md#m25-get-process-data). |

| Caller | Type | Trigger | State → UI |
|---|---|---|---|
| `fetchProcessDataForCandidate(c, 1)` (~L6492) via `handleOpenPhase1Review` (~L6417) | 1 | Segmentation/Indexing badge; refresh after Phase 1 approve | `phase1IndexingRecord`, `answerSheets` → Segmentation/Indexing dialog (page→question mapping, blank pages, pages to review) |
| `fetchProcessDataForCandidate(c, 2)` via `handleOpenOcrReview` (~L6120) | 2 | OCR badge | `ocrSaveMeta`, `ocrExtractedTextByQuestion*` → OCR Preview dialog text per question; standards chips |
| `handleOpenOcrReview` standalone branch | 2 | OCR badge in Standalone OCR-only | `standaloneOcrPopupData` → `<StandaloneOCREvaluation>` popup |
| `fetchProcessDataForCandidate(c, 3)` via `handleOpenEvaluationReview` (~L6220) | 3 | Evaluation badge / score chip; refresh after save / re-evaluation | `evaluationProcessData`, `evaluationSaveMeta`, `evaluationDataMap` → Evaluation Preview (marks, feedback, missing points) |
| `handleApprove` (~L8258) | 1 | OCR **Approve** | `segment_data` → aligns OCR text before P05 |
| `handlePhase1Approve` (~L7853) | 2 | Segmentation/Indexing **Approve** with OCR stage on | builds P05 payload |
| `handlePhase1Approve` / `handleApprove` cleanup (~L7981, ~L8373) | 3 | After P06 when questions lost images | builds P10 payload |
| `handleRunEvaluation` (~L6336) | 2 | Evaluation **Rerun** (markingstatus 4) | builds an array that is **not sent** |

```text
data[0].processData.segment_data[{qid,image_path[]}] → question_page_mapping → phase1IndexingRecord
      → Segmentation/Indexing dialog thumbnails per question
data[0].processData.ocr_extracted_text → ocrExtractedTextByQuestion → OCR Preview text editor per question
data[0].{remainingCount,totalCandidateCount,scriptPath} → ocrSaveMeta → echoed back in P05
data[0].processData.eval_data / final_score → evaluationDataMap → Evaluation Preview marks and header score
```

Errors: dialog loads → toast "Failed to load segmentation data" (same text for OCR and Evaluation), "Empty segmentation response"; abort silent; standalone → "Failed to fetch process data for standalone OCR" / "Missing process data"; approve-time fetches → `console.warn` only.

Detail: [../user/user-api-mapping-review.md §1](../user/user-api-mapping-review.md#1-endpoint-table)

---

## M26 `GET /get-all-data-exports`

| | |
|---|---|
| Purpose | Export all stage data for a workspace (paged). |
| Called from | OCR → candidate table **Download** button `onClick` (~L9545). |
| Trigger | Download (enabled when every selected candidate is download-ready; in Standalone requires the Evaluation stage). |
| Request | `OrgCode, CustCode='ICME', SubjectCode, WorkspaceId, PageNumber` (0, 1, … until `totalcount` reached; max 200 pages). |
| Response | `data[]`: `registrationnumber, candidateid, workspacename, activestage, indexingdata, ocrdata, evaluationdata` (JSON strings), `totalcount`. |

```text
data[] pages → allRecords → filter by selectedCandidates (registrationnumber) → JSON.parse stage fields
      → ExcelJS workbook → file download; downloadExportLoading → button spinner
```

Errors: no records → toast "No data available to export"; no evaluation data → "No evaluation data available to export"; exception → toast.

Detail: [../user/user-candidate-table.md §11](../user/user-candidate-table.md#11-download-excel-export)

---

## M27 `GET /student-export`

| | |
|---|---|
| Called from | SD → `handleStudentExport` (~L172). |
| Trigger | **Student Export** (visible only when M02-b reports all four stages on) → dialog → **Download**. |
| Request | Query string concatenated without encoding: `CustCode` (`sessionStorage.custCode` — never written — so `'ICME'`), `OrgCode` (`sessionStorage.orgCode` or `'ICMELIVE'`), `RegistrationNumber`. |
| Response | `candidateData[]`: `subjectname, workspacename, processdata` (JSON string), `registration_number`. |

```text
candidateData[].processdata.eval_data[q].marks_awarded/feedback/missing_points, final_score.obtained_score
      → ExcelJS sheets "ObtainedScore" + "Evaluation Details" → <registerNumber>.xlsx; isExporting → overlay
```

Errors: empty → "No data found for this register number."; exception → "An error occurred during export."

---

# ICME OCR / processing API (`API_BASE`)

## P01 `POST /upload-pdfs`

| | |
|---|---|
| Called from | OCR → `createWorkspaceAsync` (~L1734) and `uploadAddedFiles` (~L5710). |
| Trigger | Create Workspace (Segmentation/Indexing modes) → Confirm File Upload; **Upload Additional Files**. |
| Request | multipart `org_code, cust_code, usercode, subject_code, subject_name, number_of_questions, workspace_name, folder_name, workspace_id, config_data, [question_numbers], file[]` (batched). |
| Response | HTTP status only. |
| UI | `firstUploadPdfsLoading`, `uploadCompletedFiles` → upload overlay; 30 s cooldowns → Upload Additional Files lock; then M22. |
| Errors | 400/404/413/Network Error → Upload Error popup "Please upload correct data"; other → "Failed to upload batch. Please try again." |

---

## P02 `POST /upload-pngs`

| | |
|---|---|
| Called from | OCR → `submitOcrWorkflow` (~L2741), Standalone Create & Extract (~L11912). |
| Trigger | OCR image-mode create (per-question popup Submit / Create & Extract). |
| Request | multipart `target_path, files[]`. |
| Response | HTTP 2xx → next step (P05 / X01). |
| Errors | Toast "Failed to upload images". |

## P03 `POST /upload-audios`

Same callers and shape as P02 when the Image/Audio toggle is **Audio** (`standardCount=1` workspace). Errors: toast "Failed to upload audio files". Next step: P04.

## P04 `POST /transcribe-audio`

| | |
|---|---|
| Called from | OCR → `submitOcrWorkflow` (~L2779), in the background after the audio rows are shown. |
| Request | JSON `{ orgcode, custcode, usercode, registrationnumber, workspaceid, processdata:{ segment_data:[{qid, image_path}] }, scriptpath, subjectcode }`. |
| Response | HTTP 2xx only. Progress appears through M22. |
| Errors | Toast server message / "Failed to transcribe the audio". |

---

## P05 `POST /save-ocr-data`

| | |
|---|---|
| Purpose | Save (or overwrite) OCR text per question for a candidate. |
| Request | JSON `{ custcode, orgcode, usercode, registrationnumber, workspaceid, ocrdata:{ summary, ocr_extracted_text, standards_evaluation }, [scriptpath], [remainingcount, totalcandidatecount] }` (sanitised). |

| Caller | Trigger | Success rule | Errors |
|---|---|---|---|
| `submitOcrWorkflow` (~L2818) | OCR create chain | HTTP 2xx | Toast "Failed to save OCR data" |
| `submitEvaluationWorkflow` (~L3003) | Evaluation-only create (typed text) | `S001` / `S002` | Same |
| Standalone Create & Extract (~L11940) | After X01 per image | HTTP 2xx | Same |
| `handlePhase1Approve` (~L7944) | Segmentation/Indexing Approve with OCR on (OCR text rebuilt for the new mapping) | not read | `console.warn` only (silent) |
| `handleApprove` (~L8331) | OCR Preview **Approve** (edited text) | HTTP 200/201/204 | Toast "Failed to save OCR data (status N)" / "…Please try again." |

```text
OCR Preview edits → ocrExtractedTextByQuestionRaw → ocrdata.ocr_extracted_text → P05 → P06 → P11(type 2) → M22 refresh
```

---

## P06 `POST /recalculate-standards`

| | |
|---|---|
| Called from | `postRecalculateStandards` (~L852), from the create chains (not in Standalone OCR-only) and from `handlePhase1Approve` / `handleApprove` (not when `standaloneMode`). |
| Request | JSON `{ orgcode, custcode, usercode, isall (0 changed-only / 1 all), registrationnumber, subjectcode, workspaceid, questions[], userprompt:'', processdata }`. With `isall=0` and no question having images, **no request is sent**. |
| Response | HTTP 2xx only. |
| Errors | Create chain toast "Failed to run evaluation"/"Failed to recalculate standards"; Phase 1 approve → `console.warn`; OCR approve → toast "OCR saved, but recalculation failed. Please try again." and P11 skipped. |

---

## P07 `POST /run-evaluation`

| Caller | Trigger | Request | Errors |
|---|---|---|---|
| `submitEvaluationWorkflow` (~L3045) | Evaluation-only create | `{ orgcode, custcode, usercode, isall:1, registrationnumber, subjectcode, workspaceid, questions:[], userprompt:'' }` | Toast "Failed to run evaluation" |
| `handleRunEvaluation` (~L6306) | **Rerun** on Evaluation column (markingstatus 4) | same (`subjectcode='generic'` in standalone); `runningEvalCandidates` | Toast "Failed to trigger evaluation for <reg>. Please try again." |
| `submitReEvaluationRequest` (~L6827) | Evaluation Preview → Re-evaluate all / Re-evaluate Q → **Submit** | `isall` 1/0, `questions` `[]`/`[qid]`, `userprompt` from dialog | Non-2xx → "Failed to submit re-evaluation (status N)"; exception → "Failed to submit re-evaluation request. Please try again." |
| `handleRestartEvaluation` (~L6783) | "Stalled" button — never rendered (`isCandidateStalled` returns `false`) | `isall:1` | – |

Response: HTTP status only; results arrive via M22 polling and M25 type 3.

---

## P08 `POST /run-ocr`

| | |
|---|---|
| Called from | OCR → `handleRunOcr` (~L6252) as `${API_BASE}/run-ocr` (not via `API_ENDPOINTS.runOcr`). |
| Trigger | **Rerun** on the OCR column (`ocrStatus === 4`). |
| Request | JSON `{ orgcode, custcode, usercode, subjectcode, workspaceid, regnumber }`. |
| UI | `runningOcrCandidates`, `pageLoading` → toast "OCR triggered for <reg>" → silent M22. |
| Errors | Toast "Failed to trigger OCR for <reg>. Please try again." |

---

## P09 `POST /save-indexing-info`

| | |
|---|---|
| Called from | OCR → `savePhase1Mapping(record, true)` (~L7481, call ~L7597) from `handlePhase1Approve`. |
| Trigger | Segmentation/Indexing dialog **Approve** when the mapping changed. |
| Request | JSON `{ orgcode, custcode, usercode, type:1, registrationnumber, subjectcode, workspaceid, metstandardcount, is_review, indexdata:{ status:'completed', segment_data[{qid, image_path, segment_id:[0]}], blank_pages, pages_to_review, total_pages, total_questions, auto_mapped_pages, questions_answered, unanswered_questions, … } }`. |
| UI | Toast "Mappings saved". |
| Errors | `console.warn` + toast "Failed to save mappings"; approval aborts. |

---

## P10 `POST /save-evaluation-data`

| Caller | Trigger | Request | Errors |
|---|---|---|---|
| `saveEvaluationScoreOnServer` (~L3547) | Evaluation Preview **Confirm & Save** (manual marks) | `{ orgcode, custcode, obtainedscore (Top-N), evaluateddata (processData with updated marks_awarded/manual_marking), questiondetails[{Qid,maxscore,obtainedscore,rank}], maxscore, registrationnumber, subjectcode, workspaceid }` | Toast "Failed to save evaluation score to server. Please try again." (optimistic UI remains) |
| `saveFilteredEvaluationDataWithoutImagePaths` (~L3439) | Cleanup after P06 in approve flows | same shape with filtered `eval_data` | `console.warn` only |

---

## P11 `POST /update-status`

| | |
|---|---|
| Purpose | Mark a stage approved for a candidate. |
| Request | JSON `{ registrationnumber, workspaceid, type, status }`. |

| `type`/`status` | Caller | Trigger | Errors |
|---|---|---|---|
| 1 / 1 | `handlePhase1Approve` (~L8034) | Segmentation/Indexing Approve | `console.warn` only |
| 2 / 1 | `handleApprove` (~L8416) | OCR Approve (after P05/P06) | Toast "Recalculation succeeded but updating status failed…" |
| 3 / 1 | Confirm & Save handler (~L15829) | Evaluation Confirm & Save (after P10) | `console.warn` only |
| 3 / 1 | `submitReEvaluationRequest` (~L6890) | After re-evaluation submit | `console.error` only |
| 3 / 2 | `handleRestartEvaluation` (~L6806) | Unreachable | – |

Response not read. UI effect is via the next M22 refresh (badge turns "Approved").

---

## P12 `POST /upload-marking-scheme`

| | |
|---|---|
| Called from | MS → `handleSubmit` (~L2872). |
| Trigger | Upload dialog → **Confirm & Save** (after P13 preview or a direct `.md`). |
| Request | multipart `orgcode, custcode=ICME, subjectcode, file` (markdown). |
| Response | Not read → then M13 → M06 refresh → Uploaded Schemes grid. |
| Errors | Toast server message / "Upload failed. Please try again." |

## P13 `POST /convert-markscheme-to-md`

| | |
|---|---|
| Called from | MS → `handlePdfSelect` (~L2813). Base read inline with a **different fallback host/path**. |
| Trigger | Upload Document (AI Auto-Convert): Word/PDF file chosen. |
| Request | multipart `file`. |
| Response | String, `content` or `markdown` → `previewContent`, `mdFile`, `pdfStep` → Process → Preview step. |
| Errors | Toast server message / "Failed to process PDF…"; < 5 chars → "API returned empty markdown…". |

## P14 `POST /ocr-image` / `evaluate-text` (conditional fallback)

`createWorkspaceAsync` and `uploadAddedFiles` choose `targetEndpoint = (segmentation || indexing) ? upload-pdfs : (ocr ? ocr-image : evaluate-text)` (~L1948, ~L5783, ~L5981). In the live UI these functions run only for Segmentation/Indexing workspaces, so the `ocr-image` / `evaluate-text` branches are not expected to execute. `evaluate-text` is also called by `handleManualEvaluation` (~L1696), which is unreachable. See [unused-or-unmapped-apis.md](./unused-or-unmapped-apis.md).

---

# Image repository (`VITE_REPO_BASE`)

## R01 `GET {IMAGE_BASE}<scriptPath>/<n>.png` and other page images

| Caller | Trigger | Mechanism | UI |
|---|---|---|---|
| `probeSequentialImages` (~L2232) | After M23 in Segmentation-only review | `new Image()` load/error for 1.png, 2.png, … | `answerSheets` → page viewer |
| Review dialogs | Rendering pages from `image_path` | `<img src={IMAGE_BASE + path}>` | thumbnails / zoom (`ImageInspectorModal`) |
| `fetchImageBlob` (~L2294) | Segmentation-only Download buttons | `fetch` absolute URL; in dev also same-origin `/ICMEOcrRepo/...` via proxy | ZIP / file download |
| `extraction.ts` → `urlToFile` | Before X01 when only an image URL is known | `fetch` same-origin path, then absolute | – |

Errors: toast "Failed to download image(s)"; per-page ZIP failures `console.warn`; CORS → explicit message from `urlToFile`.

## R02 `GET {REPO_BASE}/<guidelinepath>`

MS → `handleViewCard` fallback when M14 fails (`responseType: text`) → `cardContent`. The scheme card **Open** link also points to `REPO_BASE/<guidelinepath>` (new tab, not an API call).

---

# AI Apps and registration

## X01 `POST {AIAPPS}/AITranscription/extract`

| | |
|---|---|
| Purpose | AI transcription of one answer-script page image ("Master Agent"). |
| Called from | OCR → Standalone OCR-only **Create & Extract** (~L11918–11924) → dynamic import of `src/lib/extraction.ts` → `runExtraction({ subject:'General', file, options: DEFAULT_OPTIONS })`. `ScriptExtractorPanel.handleExtract` also calls it, but its button is rendered with `showButton={false}`, so it has no UI trigger. |
| Trigger | Create & Extract, once per image. |
| Client | `fetch`, multipart. |
| Request | `subject, file, verify, interpret, line_mode, insertion_pass, strict_maths, q_filter`. |
| Response | `{ "<fileName>": { subject, blocks, transcription, transcription_latex, interpretation, issues, insertions_placed, figure_counts }, tokens:{ input, output, thinking, total, calls } }`. |

```text
payload[file.name].transcription → ocr_extracted_text in P05 → later shown in the Standalone OCR popup (M25 type 2)
progress → setStandaloneOcrStep → Create & Extract button label
```

Errors: non-OK → `Error(payload.detail || 'Extraction request failed.')` → toast; non-JSON body → `"HTTP <status>: <statusText>"`; missing fields default to empty.

## X02 `POST {VITE_API_BASE_URL}/aiapps/AIProductApi/signup`

`Register.tsx` → `handleSubmit` → `src/api.ts` → `registerUser`. **Effectively unreachable**: the form always fails client validation because `organizationName` has no input. `VITE_API_BASE_URL` also has no fallback. Status codes `S001`, `FL001`, `O001`, `LO001`, `EM001`. Detail: [../pages/register-page.md §2](../pages/register-page.md#2-registration-request).

## X03 `POST {AIAPPS}/AIProductApi/send-email`

`Register.tsx` → `sendRegistrationEmail`, after X02 `S001`. Body `{ to, subject, body:<HTML with AES-encrypted login link> }`; success when `response.data.status === 'success'`. Unreachable for the same reason as X02.

## X04 `POST {AIAPPS}/AIProductApi/updateActiveRegisteredUser`

`Register.tsx` → `sendRegistrationEmail`, after X03 succeeds. Body `{ username, email }`. Errors swallowed. Unreachable for the same reason as X02.

---

## Master table

Rows are grouped by page. "Key fields" are abbreviated; see the sections above.

| API | Page | Trigger | Request (key fields) | Response (key fields) | State | UI element |
|---|---|---|---|---|---|---|
| M01 `POST login` | Login | Form submit | `username, password` | `statusCode, userData[0].{usercode, organizationcode, customercode, userrole, active}` | sessionStorage identity keys, `accessDeniedMessage` | Login form error, Access Denied dialog, redirect |
| M02 `GET get-config-info` | Login | After login | `OrgCode, CustCode, AppCode` | `[0].configSetting.{standalone, workflowStages}` | `localStorage.standalone_mode`, `workflowStages` | Landing route |
| M04 `GET get-year-data` | SubjectDashboard | Mount / return | – | `yearcode, yearname` | `years`, `selectedYearCode` | Year `<select>` |
| M05 `GET get-cycle-data` | SubjectDashboard | Year change | `YearCode` | `cyclecode, cyclename` | `cycles` | Cycle cards |
| M06 `GET get-subject-data` | SubjectDashboard | Cycle click | `orgCode, yearCode, cycleCode, userCode` | `subjectcode, subjectname, workspacecount` | `subjects` | Subject cards |
| M18 `GET list-workspace` | SubjectDashboard | Mount / return | `orgcode, usercode, subject_code=''` | `totaltokenusage` | `totalTokens` | Header token chip |
| M02 `GET get-config-info` | SubjectDashboard | Mount / return | `OrgCode, CustCode, AppCode, _t` | `workflowStages` | `allWorkflowStagesEnabled` | Student Export button |
| M27 `GET student-export` | SubjectDashboard | Student Export → Download | `CustCode, OrgCode, RegistrationNumber` | `candidateData[].processdata` | `isExporting` | `.xlsx` download, overlay |
| M06 `GET get-subject-data` | OCREvaluation | Mount; back to home | `orgCode, yearCode, cycleCode, userCode` | `subjectcode, subjectname, guidelinepath, status` | `subjects`, `activeSubjectData` | Breadcrumb, "Mark schema not uploaded" |
| M04/M05 | OCREvaluation | Mount without year/cycle | – / `YearCode` | codes | – | – |
| M10 `GET question-data` | OCREvaluation | Subject change; empty workspace list | `OrgCode, CustCode, SubjectCode` | `questionLabel, marks, questionText[].rubric` | `questions`, `questionsEmpty` | Question info popup, per-question flow, export columns, empty state |
| M18 `GET list-workspace` | OCREvaluation | Subject loaded; back; Workspace ▼; after delete | `fromdate, todate, orgcode, usercode, SubjectCode` | `workspaceid, workspacename, candidatecount, standardcount, usercode, status` | `workspaces` | Workspace cards, Workspace ▼, token count |
| M02 `GET get-config-info` | OCREvaluation | Workspace selected / dialog open / approve / save | `OrgCode, CustCode, AppCode` | `configSetting.*` | `apiConfig`, `workflowStages`, `standaloneMode` | Table columns, create dialog mode, score chip colour |
| M19 `POST create-workspace` | OCREvaluation | Create dialog submit | `workspaceName, subjectCode, standardCount` | `status, outWorkspaceId` | `workspaceNameExistsError`, `sessionStorage.workspaceid` | Create dialog banner |
| M21 `POST save-candidate-info` | OCREvaluation | Create chain | `registrationNumber, scriptPath, workspaceId` | `status` | – | Step label |
| P01 `POST upload-pdfs` | OCREvaluation | Create (Seg/Idx); Upload Additional Files | multipart files + codes | HTTP status | `uploadCompletedFiles`, cooldowns | Upload overlay, Upload Error popup |
| P02/P03 `POST upload-pngs/audios` | OCREvaluation | OCR create | `target_path, files[]` | HTTP status | – | Step label |
| P04 `POST transcribe-audio` | OCREvaluation | After audio upload | `processdata.segment_data` | HTTP status | – | Toast on failure |
| X01 `POST AITranscription/extract` | OCREvaluation (Standalone) | Create & Extract | `subject, file, options` | `<file>.transcription`, `tokens` | `standaloneOcrStep` | Button label |
| P05 `POST save-ocr-data` | OCREvaluation | Create chain; Phase 1 / OCR Approve | `ocrdata.{ocr_extracted_text, summary, standards_evaluation}` | HTTP / `S001`,`S002` | – | Toasts |
| P06 `POST recalculate-standards` | OCREvaluation | After P05 | `isall, questions, processdata` | HTTP status | – | Toasts |
| P07 `POST run-evaluation` | OCREvaluation | Eval create; Rerun; Re-evaluate Submit | `isall, questions, userprompt` | HTTP status | `runningEvalCandidates` | Rerun button, Re-evaluation dialog |
| M22 `GET candidate-process-data` | OCREvaluation | Workspace open; 30 s poll; after actions | `OrgCode, UserCode, SubjectCode, WorkspaceId` | `summary[].userCode/folderName`, `details[].*Status, obtainedScore` | `candidates`, `selectedWorkspace` | Candidate table, status widgets, badges, Rerun buttons, countdown |
| M23 `GET get-candidate-info` | OCREvaluation | Candidate number click; Seg-only review | `registrationnumber, workspaceid` | `firstName…countryName`, `scriptPath` | `candidateInfoDetails`, `answerSheets` | Candidate Details dialog, page viewer |
| M24 `POST delete-candidate` | OCREvaluation | Delete → Confirm | `registrationnumber:"a,b"` | `success` / 200 | `candidates` | Table rows |
| M20 `POST delete-workspace` | OCREvaluation | Delete (n) → Confirm | `workspaceId:"a,b"` | `status` | list refresh | Workspace cards |
| P08 `POST run-ocr` | OCREvaluation | OCR Rerun | `regnumber, workspaceid` | – | `runningOcrCandidates` | Rerun button |
| M25 `GET get-process-data` t=1 | OCREvaluation | Seg/Idx badge | `type:1, registernumber, workspaceid` | `processData.segment_data, blank_pages, pages_to_review` | `phase1IndexingRecord`, `answerSheets` | Segmentation/Indexing dialog |
| M25 `GET get-process-data` t=2 | OCREvaluation | OCR badge | `type:2` | `processData.ocr_extracted_text`, `remainingCount, scriptPath` | `ocrExtractedTextByQuestion`, `ocrSaveMeta` / `standaloneOcrPopupData` | OCR Preview / Standalone OCR popup |
| M25 `GET get-process-data` t=3 | OCREvaluation | Evaluation badge / chip | `type:3` | `processData.eval_data, final_score` | `evaluationProcessData`, `evaluationDataMap` | Evaluation Preview |
| P09 `POST save-indexing-info` | OCREvaluation | Seg/Idx Approve | `indexdata.segment_data` | – | – | Toast "Mappings saved" |
| P10 `POST save-evaluation-data` | OCREvaluation | Evaluation Confirm & Save | `obtainedscore, evaluateddata, questiondetails` | – | optimistic score | Header score, table chip |
| P11 `POST update-status` | OCREvaluation | After each approval | `type, status:1` | – | – | Badge after next poll |
| M26 `GET get-all-data-exports` | OCREvaluation | Download | `WorkspaceId, PageNumber` | `data[].{registrationnumber, indexingdata, ocrdata, evaluationdata, totalcount}` | `downloadExportLoading` | `.xlsx` download |
| R01 `GET` page images | OCREvaluation | Review dialogs, downloads | path | image / blob | `answerSheets` | Page viewer, ZIP download |
| M04/M05 | SuperAdmin shell | Mount / year change | – / `YearCode` | codes | `headerYears`, `headerCycles` | Year/Cycle selects in S&Q, MS, CS |
| M07 `GET organization-details` | SuperAdmin (shell, S&Q, MS, CS, RM) | Mount / customer change | `CustCode` | `organizationcode, organizationname` | `organizations`, `selectedOrg` | Organization select |
| M06 `GET get-subject-data` | SuperAdmin S&Q / MS / CS | Org/year/cycle change | `orgCode, yearCode, cycleCode` | `subjectcode, subjectname, guidelinepath, status, workspacecount` | `subjects`, `cards` | Subject table, scheme grid, override grids |
| M09 `POST import-subject-data-v2` | S&Q | Import | multipart `File, OrgCode, YearCode, CycleCode` | `status, message` | `importing` | Import dialog |
| M10 `GET question-data` | S&Q | Q-Preview eye | `OrgCode, SubjectCode` | `questionText[].rubric` | `previewData` | Question preview dialog |
| M11 `POST delete-subject` | S&Q | Delete confirm (superadmin) | `subjectCode, orgCode, yearCode, cycleCode` | `status` | `selectedRows` | Subject table |
| M02 + M12 | S&Q | Status toggle | `workflowStages.evaluation`; `{subjectCode, isActive, orgCode}` | – | `togglingStatus` | STATUS badge |
| P13 `POST convert-markscheme-to-md` | MS | Word/PDF chosen | multipart `file` | markdown | `previewContent` | Upload dialog preview |
| P12 + M13 | MS | Confirm & Save | multipart `file`; `questions[]` | – | `uploading` | Upload dialog, scheme grid |
| M14 / R02 | MS | Scheme card click | `SubjectCode, FilePath` | `content` / text | `cardContent` | View scheme dialog |
| M02 `GET get-config-info` | CS | Org loaded / change | `OrgCode, CustCode` | `configSetting.*` | all settings state | Every settings card |
| M03 `POST save-config-info` | CS | Save Settings | `configSetting` | `code/status` | `isSavingToDB` | Save button, toasts |
| M08 `GET customer-details` | RM | Mount | – | `customercode, customername` | `customerList` | Customer selects |
| M15 `GET get-user-details` | RM | Customer/org change | `UserCode, OrgCode(name), CustCode` | `userDetails[]` | `roleList` | Users table |
| M16 `POST create-user` | RM | Create / Save Changes | user fields, `userRole:'User'` | `status/errorCode` | `isSaving` | Create/Edit modal |
| M17 `POST delete-user` | RM | Yes, Delete | `custCode, orgCode, loginName` | `statusCode` | `roleList` | Users table |
| X02–X04 | Register | Submit (blocked by validation) | registration fields | `status` | dialog state | Result dialog |

**Distinct endpoints in this document:** 27 AI Marking + 15 processing (counting `ocr-image` and `evaluate-text` separately) + 4 AI Apps/registration = **46 endpoints**, plus 2 static repository fetch families (R01, R02).
