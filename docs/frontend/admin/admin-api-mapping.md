# Admin API Mapping

This page lists every HTTP call made from `src/pages/SuperAdminDashboard.tsx`. Base variables:

| Variable | Source | Where declared |
|---|---|---|
| `API_BASE` | `VITE_ICMEPRODUCT_API_BASE` (falls back to a hard-coded host) | Module ~L51; passed to `MarksSchemaSection` as a prop |
| `API_BASE1` | `VITE_AIMARKING_API_BASE` (falls back to a hard-coded host) | Module ~L52; passed to `MarksSchemaSection` and `SettingsSection` as a prop; **re-declared** inside `RoleManagementSection` (~L6492) |
| `REPO_BASE` | `VITE_REPO_BASE` (falls back to a hard-coded host) | Module ~L53 |
| *(inline)* | `VITE_ICMEPRODUCT_API_BASE`, read inline with a **different** fallback host | `MarksSchemaSection` → `handlePdfSelect` (~L2828) |

No call sends an auth header. Identity is passed through query or body fields such as `UserCode` and `userCode`.
Clients: `axios` in most sections; `fetch` in `SettingsSection` and in `RoleManagementSection` (except `delete-user`).

Global behaviour: there is no shared interceptor, retry or timeout. Each call handles its own errors as described in the [Error handling](#error-handling-per-api) section below.

## Call table

| # | API | Section / component | Function | Trigger | Key request fields | Response fields used | State set | UI element |
|---|---|---|---|---|---|---|---|---|
| 1 | `GET API_BASE1/get-year-data` | Shell `SuperAdminDashboard` | effect `fetchHeaderYears` (~L7638) | Mount | none | `[]` or `data[]`: `yearid`, `yearname`, `yearcode` | `headerYears`, `headerSelectedYearCode` | Year select (every section) |
| 2 | `GET API_BASE1/get-cycle-data` | Shell | effect `fetchHeaderCycles` (~L7672) | `headerSelectedYearCode` change | `YearCode` | `cycleid`, `cyclename`, `cyclecode` | `headerCycles`, `headerSelectedCycleCode` | Cycle select |
| 3 | `GET API_BASE1/organization-details` | Shell | effect (~L7701) | Mount, superadmin only | `CustCode=ICME` | `data[]` | `organizations`, `selectedOrg` (unused) | none |
| 4 | `GET API_BASE1/organization-details` | `SubjectQuestionPanel` | effect `fetchOrganizations` (~L667) | Mount | `CustCode=ICME` (fixed) | `data[]`: `organizationid`, `organizationname`, `organizationcode` | `organizations`, `selectedOrg` | Organization select (page and import dialog) |
| 5 | `GET API_BASE1/get-year-data` | `SubjectQuestionPanel` | effect `fetchImportYears` (~L698) | Mount | none (deliberately) | as in #1 | `importYears`, `importSelectedYearCode` | Import dialog → Select Year |
| 6 | `GET API_BASE1/get-cycle-data` | `SubjectQuestionPanel` | effect `fetchImportCycles` (~L735) | `importSelectedYearCode` change | `YearCode` | as in #2 | `importCycles`, `importSelectedCycleCode` | Import dialog → Select Cycle |
| 7 | `GET API_BASE1/get-subject-data` | `SubjectQuestionPanel` | `fetchSubjects` (~L1073) | Org, year or cycle change; after import, delete or status change | `orgCode`, `custCode=ICME`, `yearCode`, `cycleCode`, `userCode`; no-cache headers | `[]`, `data[]` or `subjects[]`: `subjectid`, `subjectcode`, `subjectname`, `kbpath`, `guidelinepath`, `workspacecount`, `status`, `isReady` | `subjects` | Subject table |
| 8 | `POST API_BASE1/import-subject-data-v2` | `SubjectQuestionPanel` | `handleImportSubmit` (~L1010) | Import button | multipart: `File`, `IsType=0`, `OrgCode`, `YearCode`, `CycleCode` | `status`, `message` | `importing`; dialog closes on success | Import dialog |
| 9 | `GET API_BASE1/question-data` | `SubjectQuestionPanel` | `handleOpenQuestionPreview` (~L1348) | Q-Preview eye | `OrgCode`, `CustCode=ICME`, `SubjectCode` | Array or `ref1Data[]`: `questionLabel`, `marks`/`totalMarks`, `questionText[]` {`text`, `marks`, `rubric[]` {`text`, `score`}} | `previewData` | Question preview dialog |
| 10 | `POST API_BASE1/delete-subject` | `SubjectQuestionPanel` | `handleConfirmDeleteSubject` (~L1410), one call per subject | Delete confirm | JSON `{subjectCode, orgCode, yearCode, cycleCode}` | `status`, `message` | Collects failures; clears `selectedRows` | Delete dialog |
| 11 | `GET API_BASE1/get-config-info` | `SubjectQuestionPanel` | `isEvaluationStageEnabled` (~L1459) | Activating a subject | `OrgCode`, `CustCode`, `AppCode=AImarking` | `[0].configSetting.workflowStages.evaluation` | `checkingActivationConfig` (during) | STATUS badge |
| 12 | `POST API_BASE1/update-subject-data` | `SubjectQuestionPanel` | `handleToggleStatus` (~L1484) | Confirm status change | JSON `{subjectCode, isActive, orgCode}` | none | `togglingStatus`, `statusToggleSubject` | Status confirmation dialog |
| 13 | `GET API_BASE1/organization-details` | `MarksSchemaSection` | effect (~L2733) | Mount, customer change | `CustCode` | `data[]` | `organizations`, `selectedOrg` | Organization select |
| 14 | `GET API_BASE1/get-subject-data` | `MarksSchemaSection` | `fetchSubjects` (~L2764) | Org, year or cycle change; after upload | as in #7 | `subjectcode`, `subjectname`, `workspacecount`, `status`, `guidelinepath` | `subjects`, `cards` | Subject select, Uploaded Schemes |
| 15 | `POST <ICMEPRODUCT base>/convert-markscheme-to-md` | `MarksSchemaSection` | `handlePdfSelect` (~L2829) | Word/PDF file chosen | multipart `file` | String, `content` or `markdown` | `previewContent`, `mdFile`, `pdfStep` | Upload dialog, Process → Preview |
| 16 | `POST API_BASE/upload-marking-scheme` | `MarksSchemaSection` | `handleSubmit` (~L2893) | Confirm & Save | multipart `orgcode`, `custcode=ICME`, `subjectcode`, `file` | none | `uploading` | Upload dialog |
| 17 | `POST API_BASE1/save-questions` | `MarksSchemaSection` | `handleSubmit` (~L2949) | After #16, when the markdown parses into questions | JSON `{custcode, orgcode, subjectCode, questions:[{questionLabel, questionText[], marks}]}` | none | none | Toasts |
| 18 | `GET API_BASE1/get-marking-scheme` | `MarksSchemaSection` | `handleViewCard` (~L2985) | Scheme card click | `OrgCode` (**session** org or `ICME01`), `CustCode=ICME`, `SubjectCode`, `FilePath` | `content` or the raw body | `cardContent`, `loadingCard` | View scheme dialog |
| 19 | `GET REPO_BASE/<guidelinepath>` (or an absolute URL) | `MarksSchemaSection` | `handleViewCard` fallback (~L2995) | #18 fails | `responseType: text` | Body text | `cardContent` | View scheme dialog |
| 20 | `GET API_BASE1/organization-details` (fetch) | `SettingsSection` | effect `fetchOrganizations` (~L3835) | Mount, customer change | `CustCode` | `data` or `data.data` | `organizations`, `selectedOrg`; triggers #21 and #22 | Organization select |
| 21 | `GET API_BASE1/get-subject-data` (fetch) | `SettingsSection` | `fetchSubjects(orgCode)` (~L4197) | After #20; org change | as in #7 | `subjectcode`, `subjectname` | `subjects`, `*SubjectCode` | Subject-wise grids |
| 22 | `GET API_BASE1/get-config-info` (fetch) | `SettingsSection` | `loadSettings` (~L4227) | After #20; org change effect; after #23 | `OrgCode`, `CustCode`, `AppCode=AImarking` | `[0].configSetting.*` (see [configuration](admin-configuration.md#loadsettingsorgcode-l4224)) | All settings state; localStorage overrides | Every settings card |
| 23 | `POST API_BASE1/save-config-info` (fetch) | `SettingsSection` | `handleSaveToDB` (~L4795) | Save Settings | JSON `{orgCode, custCode, appCode, configSetting}` (see [payload](admin-configuration.md#request)) | `code`, `status` or `message` | `isSavingToDB` | Save button, toasts |
| 24 | `GET API_BASE1/customer-details` (fetch) | `RoleManagementSection` | effect `fetchCustomers` (~L6553) | Mount | none | `data[]` or `[]`: `customercode`, `customername` | `customerList` | Customer selects (filter bar, Create modal) |
| 25 | `GET API_BASE1/organization-details` (fetch) | `RoleManagementSection` | effect `fetchOrgs` (~L6572) | Mount, customer change | `CustCode` | `data[]` | `organizations`, `selectedOrg` | Organization selects |
| 26 | `GET API_BASE1/get-user-details` (fetch) | `RoleManagementSection` | `fetchUsers` (~L6591) | Customer, org or organizations change; after create or edit | `UserCode` (session), `OrgCode` = **organization name**, `CustCode` | `userDetails[]` (see the [mapping](admin-user-management.md#row-mapping-l6597)) | `roleList` | Users table |
| 27 | `POST API_BASE1/create-user` (fetch) | `RoleManagementSection` | `handleCreate` (~L6923) | Create User | JSON `{userId:0, organizationId:<org name>, customerCode, firstName, lastName, email, contactNumber, address, loginName, userCode, passwordHash, userRole:'User', isSSO:0, fromDate, toDate}` | `status` / `errorCode` / `errorcode` (`E001`), `message` / `Message` | `isSaving`, `showCreateModal` | Create modal |
| 28 | `POST API_BASE1/create-user` (fetch) | `RoleManagementSection` | `handleEditSave` (~L6816) | Save Changes | As #27, but with `userId=<row.userid>` and `passwordHash` (or undefined) | As #27 | `isSaving`, `showModal` | Edit modal |
| 29 | `POST API_BASE1/delete-user` (axios) | `RoleManagementSection` | `handleActionConfirm` (~L6972) | Yes, Delete | JSON `{custCode, orgCode, loginName}` | `statusCode` or `status`, `message` | `roleList` (local filter) | Delete confirmation |
| 30 | `GET API_BASE1/organization-details` | `AdminSubjectView` (**unreachable**) | effect (~L106) | Mount, customer change | `CustCode` | `data[]` | `organizations`, `selectedOrg` | — |
| 31 | `GET API_BASE1/subject-list` | `AdminSubjectView` (**unreachable**) | `fetchSubjects` (~L137) | Org change | `OrgCode`, `CustCode=ICME` | Tolerant: `subjectname`, `subjectcode`, `workspacecount`, `status` | `subjects` | — |
| 32 | `POST <user-entered URL>` | `ExcelInlineEditor` (**never rendered**) | `handleUpload` (~L417) | Button | Sheets as JSON | none | — | — |

Navigation that is not an API call: the scheme card's **Open** link goes to `REPO_BASE/<guidelinepath>` in a new tab
(~L3119). The Subject and Question templates are generated in the browser as CSV files, with no request.

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/admin-network-save-config.png — browser DevTools network tab showing save-config-info payload]

## Error handling per API

| API | HTTP error / exception | Empty response | Status codes |
|---|---|---|---|
| `get-year-data` (shell) | `console.error` only. The Year select stays empty, so sections show "No Year/Cycle…" | No year selected | — |
| `get-year-data` (import) | Toast "Failed to load years" | "No Years Found"; Import disabled | — |
| `get-cycle-data` (shell) | `console.error` only | "No cycles"; select disabled | — |
| `get-cycle-data` (import) | Toast "Failed to load cycles" | "No Cycles for this Year"; Import disabled | — |
| `organization-details` | S&Q, Marks Schema, AdminSubjectView: toast "Failed to load organizations". Settings: log only (the spinner ends with no cards). Role Mgmt: `organizations=[]`. Shell: log only. | "No Organizations Found" (S&Q, Marks Schema). Settings and Role Mgmt render an empty select. Settings never calls `loadSettings`. | — |
| `get-subject-data` | Toast "Failed to load subjects" (all three sections) | Empty table / "No marks schemes yet" / empty subject grids | — |
| `import-subject-data-v2` | Toast `response.data.message`, `err.message`, or "Import failed. Please try again." | No `status` → treated as success | `S001` added; `S002` updated; `F*` → "Failed to import: <message>" |
| `question-data` | Toast "Failed to load question preview" | "No data available." / "No questions found." | — |
| `delete-subject` | The first exception aborts the loop → "Deletion failed. Please try again." | — | `S001` = success; anything else → collected as a per-subject failure toast |
| `get-config-info` (activation) | Returns `true` (evaluation assumed on, so the guideline is required) | Same | — |
| `update-subject-data` | Toast "Failed to update subject status" | Body ignored; any 2xx = success | Not inspected |
| `convert-markscheme-to-md` | Toast `response.data.message` or "Failed to process PDF…"; back to idle | Shorter than 5 chars → "API returned empty markdown…" | — |
| `upload-marking-scheme` | Toast server message or "Upload failed. Please try again." | Body ignored | Not inspected |
| `save-questions` | Warning toast "Marking schema uploaded, but questions could not be saved: <msg>". The generic success toast still follows. | Not called when the parser returns no questions | Not inspected |
| `get-marking-scheme` | Falls back to the REPO_BASE GET; if that also fails → "Failed to load content. Please contact your administrator." | "No content available." | — |
| `get-config-info` (Settings) | Falls back to `localStorage` silently | `[]` or no `configSetting` → localStorage fallback | — |
| `save-config-info` | Non-OK → "Failed to save configuration: <status>". Exception → "Error connecting to the API to save settings". The localStorage mirror runs in both cases. | Any OK body → success toast | `s001` / `s002` (lowercase only); others → `message` or "Configuration saved to database!". `F*` is not handled. |
| `customer-details` | Fallback list `[ICME]` | Fallback list `[ICME]` | — |
| `get-user-details` | `roleList=[]`, log only | No `userDetails` → `[]` | — |
| `create-user` | Toast "An error occurred" (create) or "An error occurred." (edit) | `res.ok` → success | `E001` → "Login name already exists!…"; non-OK → `message` / `Message` or the default |
| `delete-user` | Toast "Failed to delete user" | Treated as failure | `S001` (`statusCode` or `status`) = success; `F001` or anything else → `message` or "Failed to delete user" |

See also the cross-application map in [../api/api-integration-mapping.md](../api/api-integration-mapping.md).
