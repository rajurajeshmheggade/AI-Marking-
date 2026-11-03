# Workspaces: `OCREvaluation.tsx` (Workspace Level)

- **Component:** `src/pages/OCREvaluation.tsx` → `OCREvaluation` (~L697)
- **Rendered by:** `/ocr-evaluation` (no props), `SubjectDashboard` (inline), `SuperAdminDashboard` (inline)
- **Scope of this page:** props, subject resolution, configuration loading, breadcrumb, workspace list, selection, workspace switching, deletion, page loaders
- **Related:** [user-create-workspace-and-upload.md](./user-create-workspace-and-upload.md), [user-candidate-table.md](./user-candidate-table.md), [user-review-and-evaluation.md](./user-review-and-evaluation.md)

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-workspace-list.png — Workspace list with breadcrumb, Create New Workspace button and workspace cards]
[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-workspace-selected.png — Inside a workspace: breadcrumb, header row, countdown, Upload Additional Files, Workspace dropdown]

## 1. Props

| Prop | Type | Used for |
|---|---|---|
| `preselectedSubject` | string | Initial `selectedSubject` (default `"broadcast-journalism"` when absent, ~L3274) |
| `onBack` | fn | "Back to the subject list". Its presence enables the list-view breadcrumb, the header subject pill and the "go back" link in the create dialog |
| `selectedSubjectLabel` | string | Fallback label for the breadcrumb and pill (`currentSubjectLabel`, ~L4293) |
| `overrideOrgCode`, `overrideCustCode`, `overrideUserCode` | string | Win over session codes in `getFinalCodes()` (~L726). Only the SuperAdmin console passes `overrideOrgCode` |
| `preselectedYearName`, `preselectedCycleName` | string | Breadcrumb labels only |
| `onBackToCycles` | fn | Year crumb → back to the Home page's Cycle picker |

`getFinalCodes()` returns `orgCode` (override → `getSessionCodes().orgcode` → `sessionStorage.orgCode` → `'ICME01'`), `custCode` (override → `'ICME'`) and `userCode` (override → session codes → `sessionStorage.userCode` → `'ICME1'`). It is used by `refreshWorkspaces`, `loadCandidatesForWorkspace`, `ensureCandidateIsNew`, the question-data load and the subject fetches. Many other calls (create, upload, delete, export) read `sessionStorage.orgCode`/`userCode` directly and **ignore the override props**.

## 2. Subject resolution

| Function | Logic | Line |
|---|---|---|
| `resolveSubjectCode()` | When `localStorage.standalone_mode === '1'` → `'generic'`. Otherwise the first non-empty of: sessionStorage `subjectcode \| subjectCode \| subject_code \| subject`, matched subject `.code`, `.value`, sessionStorage `subjectid…`, matched `.id`, `selectedSubject` | ~L1143 |
| `resolveSubjectName()` | Matched subject label → sessionStorage `subjectname…` → title-cased `selectedSubject` | ~L1189 |
| `currentSubjectLabel` | Matched label → `selectedSubjectLabel` prop → `'Subject'` | ~L4293 |

### Subject list (`subjects` state)

The initial value is a hard-coded list of 8 placeholder subjects (~L3826). On mount (~L3970) `fetchSubjectsSmart()` runs:

1. When sessionStorage holds both `yearcode` and `cyclecode` → `GET API_ENDPOINTS.subjectData` params `{ orgCode, custCode, yearCode, cycleCode, userCode }` (`fetchSubjectsForYearCycle`, ~L3877).
2. Otherwise, or if (1) throws, it falls back to a **fan-out** (`fetchAllSubjectsAcrossYearsAndCycles`, ~L3894): `GET get-year-data` → `GET get-cycle-data?YearCode=` per year → `GET get-subject-data` per year×cycle. Results are merged and de-duplicated by subject code. Standalone users usually hit this path, because they never pass through the Home page.

`mapSubjectApiItems` keeps items whose `status === 1` (or that carry no status) and maps `subjectcode`, `subjectname`, `subjectid` and `guidelinepath`. When the result is non-empty: `subjects` = mapped, `selectedSubject` = the current value if present else the first, and `activeSubjectData` = that subject. Any error → toast "Failed to load subjects". `subjectsLoaded` is always set to true.

There is a Subject `<select>` inside the workspace header (~L9011), but it is rendered with `className="hidden"` and is not reachable.

## 3. Configuration loading

| Trigger | Request | State written | Line |
|---|---|---|---|
| Mount | none. Reads `localStorage.workflowStages` (JSON) and `localStorage.standalone_mode` (Login primes both) | `workflowStages`, `standaloneMode` | ~L3179 |
| `selectedWorkspace` changes (every non-null change, including the object replacement `loadCandidatesForWorkspace` does on each poll) | `fetch(<VITE_AIMARKING_API_BASE>/get-config-info?OrgCode=<sessionStorage.orgCode \| 'ICMELIVE'>&CustCode=ICME&AppCode=AImarking)` | `apiConfig`, `workflowStages`, `standaloneMode`, and `localStorage.workflowStages` / `standalone_mode` | ~L3146 |
| Create/Upload dialog opens | Same endpoint, but `CustCode = sessionStorage.customerCode \| custcode \| 'ICME'` | Same, plus `isConfigLoadingForDialog` | ~L1102 |

Only `data[0].configSetting` is used. Non-OK responses and empty arrays are ignored silently; exceptions only reach `console.error`.

Config fields read in this scope:

| Field | Used by |
|---|---|
| `workflowStages.{segmentation, indexing, ocr, evaluation}` | Columns, widgets, upload policy, question-flow mode, Download gating |
| `standalone` | `standaloneMode`; candidate-name link gating (`apiConfig.standalone`) |
| `segmentationConfig.CandidateInfo` | Candidate info link (`=== false` disables it) |
| `ocrConfig.StandardsMetCount` | Standards chip in the OCR column (`!== false` shows it) |
| `ocrConfig.QuestionNumberExtraction` | `isQNumExtractionEnabled` (falls back to localStorage `org_ocr_qnum_<org>[_<subject>]`) |
| `evaluationConfig.subjectOverrides[]`, `globalThresholds.{passMarkThreshold, topQuestionsCount}` | Score-chip colour (`getPassMarkThresholdFor`), score recompute |
| `indexingConfig.predefinedSettings.maxQuestions` | Standalone question count (default 10) |

> Risks: (a) `apiConfig` stays `null` until a workspace is opened or the dialog is opened, so gating that reads `apiConfig?.…` uses its "undefined" branch until then. (b) The dialog fetch sends `customerCode` exactly as Login stored it (not trimmed or upper-cased), while Login's own config call upper-cases it. A differently cased value can return `[]` and leave the dialog on cached stages. (c) Every poll replaces the `selectedWorkspace` object, which makes this effect re-fetch `get-config-info` about every 30 s.

## 4. Breadcrumb

`buildBaseCrumbs()` (~L4279) and `renderBreadcrumbNav(crumbs, leafLabel)` (~L4294):

| Situation | Base crumbs | Click behaviour |
|---|---|---|
| `onBack` undefined (standalone or direct route) | none | – |
| `onBack` and `onBackToCycles` (from SubjectDashboard) | `[Year (calendar icon)]` when `preselectedYearName` is set, `[Cycle]` when `preselectedCycleName` is set | Year → `goBackToCycles()` → `onBackToCycles()`. Cycle → `goBackToHome()` |
| `onBack` only (SuperAdmin) | `[Home (home icon)]` | `goBackToHome()` |

`goBackToHome()` (~L4234): sets `pageLoading`, awaits `refreshSubjects()` (get-subject-data again), then calls `onBack()`.

| View | Rendered crumbs | Leaf |
|---|---|---|
| Workspace list | `onBack && !standaloneMode` → base crumbs | `currentSubjectLabel` |
| Inside a workspace | base crumbs + `Subject` crumb (Layers icon when there are no base crumbs; disabled while `isRefreshingWorkspaces`) → `handleBackToWorkspaceList()` | `selectedWorkspace.name` |

`handleBackToWorkspaceList()` (~L4256), guarded by a ref against double clicks: `pageLoading` on, `stopCandidatePolling()`, `selectedWorkspace = null`, `hasUploaded = false`, `candidates = []`, `await refreshWorkspaces({ silent: true, force: true })`, then `pageLoading` off. It does **not** clear `selectedCandidates`.

## 5. Header

| Element | Rule |
|---|---|
| Subject pill | `onBack && !standaloneMode`. Shows the subject label; styled as a button but has no `onClick` |
| `HeaderAccountControls` | `displayName` (`userInfo.username \| UserNameDetails \| userName` → `username` → `'Evaluator'`), `tokenCount = headerTokenCount` (selected workspace `totalTokenUsage`, else the sum across `workspaces`), `showLogout={!isSuperAdmin}` |
| Logout | `handleLogout` (~L921): removes `isLogin, userInfo, username, password, userCode, orgCode, customerCode, userRole` and `localStorage.userName`, then navigates to `/login` |

## 6. Workspace list

### 6.1 `refreshWorkspaces(options)` (~L4052)

| Aspect | Detail |
|---|---|
| Auto trigger | Effect (~L4212): once `subjectsLoaded`, and on every `selectedSubject` change. With no subject, it just marks `workspacesLoaded` |
| Explicit triggers | Back to list (silent, force); Workspace dropdown (silent, force); after a workspace delete (force) |
| Request | `GET API_ENDPOINTS.listWorkspace` params `fromdate` (sessionStorage `fromdate` or `'2024-12-01'`), `todate` (sessionStorage `todate` or today), `orgcode`, `custcode`, `usercode` (from `getFinalCodes`), `SubjectCode` (`'generic'` in standalone, else session subject → matched subject → `selectedSubject`) |
| De-duplication | Hard guard: no concurrent calls (`listWorkspaceInFlightRef`). Soft guard: the same key within 1.5 s is skipped unless `force`. A module-level `sharedListWorkspaceRequest` shares one promise across StrictMode remounts |
| Response | The array itself, or `data.data`, or `data.workspaces`. Sorted by `createddate` descending |
| Mapping → `Workspace` | `id` ← `workspaceid \| workspace_id \| id \| workspaceId \| workspaceID`; `name` ← `workspacename…`; `createdAt` (YYYY-MM-DD); `fileCount`, `totalSize`, `candidateCount` ← `candidatecount…`; `standardCount` ← `standardcount` (1 = audio workspace); `totalTokenUsage`; `userCode` ← `usercode \| userCode \| UserCode \| user_code \| Usercode \| createdby \| createdBy`; `status`: numeric `0 → 'active'`, `1 → 'completed'`, else `'archived'` |
| Empty list | `workspaces = []`, then `GET API_ENDPOINTS.questionList` (`question-data`) params `OrgCode, CustCode, SubjectCode` → `questionsEmpty = (ref1Data or array).length === 0`. A question-data error sets `questionsEmpty = false` |
| Error | Abort/cancel ignored. Otherwise toast "Failed to load workspaces" (non-silent only); returns null |
| Loading | Non-silent sets `workspacesLoaded=false` (page loader); `isRefreshingWorkspaces` while in flight |

### 6.2 Workspace card

| Element | Rule |
|---|---|
| Icon | `standardCount === 1` → indigo audio icon ("Audio workspace"), else teal folder ("Image workspace") |
| Status pill | `candidateCount === 0` → **Yet to Start** (slate). `status === 'active'` → **In Progress** (emerald). `'completed'` → **Completed** (blue). Otherwise **Archived** (slate) |
| Text | Name, "Created: <createdAt>", "<candidateCount> Candidate(s)" |
| Delete checkbox | Bottom-right. Disabled when `candidateCount > 0` (tooltip "This workspace cannot be deleted while scripts are associated with it"). Clicking it does not open the card |
| Card click | Clears `selectedWorkspaceIds` → `syncWorkspaceIdToSession(workspace)` (writes `sessionStorage.workspaceid` when numeric) → `loadCandidatesForWorkspace(workspace)` (non-silent; page loader) → `startCandidatePolling(workspace)` |

### 6.3 Toolbar

| Control | Visible | Disabled | Action |
|---|---|---|---|
| **Create New Workspace** | `!isSuperAdmin` | – | Resets the create form (`selectedWorkspaceIds`, name, candidate entry, files, `addedFilesInfo`, `isAdditionalUploadMode=false`). In standalone also sets `selectedSubject='generic'`. Opens the dialog → [user-create-workspace-and-upload.md](./user-create-workspace-and-upload.md) |
| **Select All / Deselect All** | `selectedWorkspaceIds.size > 0` | – | Toggles every workspace with `candidateCount === 0` |
| **Delete (n)** | `selectedWorkspaceIds.size > 0` | `deletableCount === 0` | Opens the Delete Workspace confirmation |

### 6.4 Empty states (`workspaces.length === 0`)

| Condition (in order) | Message |
|---|---|
| `questionsEmpty` | "No questions found. Please contact administrator." / "No questions are configured for this subject yet." |
| `activeSubjectData && !activeSubjectData.guidelinepath` | Amber panel "Mark schema not uploaded. Please contact administrator." |
| otherwise | "No workspaces found for this subject." |

## 7. Selecting a workspace

`loadCandidatesForWorkspace` (~L4688) is the selection routine. It sets `selectedWorkspace`, calls `candidate-process-data` and fills the table. Full details are in [user-candidate-table.md](./user-candidate-table.md#2-data-load-loadcandidatesforworkspace). Selecting also triggers the `selectedWorkspace` config fetch (§3) and the polling effect.

### Inside the workspace: header row

| Element | Rule |
|---|---|
| Name chip | Audio or folder icon + `selectedWorkspace.name` |
| Candidate count | `hasUploaded ? selectedWorkspace.candidateCount : 0` |
| Countdown | "The page refreshes in {pollCountdown} second(s)" |
| **Upload Additional Files** | Hidden for superadmin. Blocked (`aria-disabled`, click ignored) when `isUserCodeMismatch(selectedWorkspace.userCode)`, `additionalUploadCooldown`, `uploadApiResponseCooldown` (each 30 s after an upload response) or `hasIncompleteScripts` (any candidate with an enabled stage in `yet-to-*` or `in-progress`; with no `apiConfig`, every stage counts). Tooltips: "Scripts are still being uploaded, please wait" (no rows yet), "This workspace belongs to another user", "Scripts are in process, please wait a few minutes", "Script in progress, please wait", "Please wait, script is in progress". On click: sets `standaloneUploadMode` from the workspace (`standardCount===1` → audio), `isAdditionalUploadMode=true`, prefills the name, clears inputs and opens the dialog |
| **Workspace** `<select>` | Lists `workspaces`. `onChange`: `listWorkspaceRefreshLoading` on → `refreshWorkspaces({silent, force})` → finds the target in the fresh list → `syncWorkspaceIdToSession`, clears `searchQuery`, `loadCandidatesForWorkspace`, `startCandidatePolling` |

Switching workspaces resets `statusFilter`/`phaseFilter` to `'all'` (effect ~L5200).

## 8. Deleting workspaces

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-workspace-delete-confirm.png — Delete Workspace confirmation dialog]

Dialog `showWorkspaceDeleteConfirm` (~L10773): "Are you sure you want to delete "<names>"? This action cannot be undone." When any selected workspace has candidates it adds "One or more selected workspaces have candidates and cannot be deleted." **Confirm Deletion** is disabled while deleting or when every selected workspace has candidates.

`handleConfirmDeleteWorkspace` (~L4989):

1. `idsToDelete` = `[pendingDeleteWorkspace.id]` or the selected IDs. `pendingDeleteWorkspace` is never set to a workspace anywhere, so the multi-select path is the only live one.
2. Skips any workspace with `candidateCount > 0` and toasts "Cannot delete workspace "X" — it has candidates."
3. `POST API_ENDPOINTS.deleteWorkspace` body `{ workspaceId: "<id>,<id>" }`.
4. Success when `status === 'S001'`, `responseCode`/`ResponseCode === 'S001'` or `status === 'success'` → toast with the server message or "Workspace(s) "…" deleted successfully". Anything else → toast the server message or "Cannot delete workspace(s) "…"." An exception → "An error occurred while deleting "…". Please try again."
5. Resets the dialog state. On success: `refreshWorkspaces({ force: true })` then `refreshSubjects()`.

## 9. Page loaders

| Flag | Composition (~L8475–8518) | Rendering |
|---|---|---|
| `isPageLoaderActive` | `pageLoading`, `downloadExportLoading`, `workspaceValidationLoading`, `preparingFilesLoading`, `firstUploadPdfsLoading`, `candidateInfoLoading`, review saves, `isUploadingAddedFiles`, `isSubmittingEvalWorkflow`, `isCheckingCandidateDuplicate`, `questionListLoading`, `listWorkspaceRefreshLoading` | `<PageLoader />` |
| `isPopupLoaderActive` | Any dialog open **and** any dialog-loading flag | `<PageLoader />` |
| `standaloneOcrOverlayLoading` | Standalone Create & Extract | `<PageLoader />` |
| `phase1Loading` | get-process-data fetches | `<PageLoader />` |
| `isUploading \|\| isCreatingWorkspace \|\| isValidatingName` (when no PageLoader) | – | White "upload in progress" overlay with an overall % bar and "Sending file X of Y…" |

`pageLoading` starts `true` and is derived by an effect (~L4223): false once `subjectsLoaded && (workspacesLoaded \|\| !selectedSubject)`.
