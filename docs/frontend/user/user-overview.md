# User Overview: Access and Modes

This page sets out what an evaluator can reach, which controls are role-gated or ownership-gated, and how Standalone Mode changes the UI. Every rule below cites the code that enforces it. Note that the frontend gates are UI gates only; whether the backend enforces the same rules was not verified from the frontend source.

## 1. Entry points

| Entry | How reached | Props passed to `OCREvaluation` | Notes |
|---|---|---|---|
| `/subject-dashboard` → subject card | Login for non-admin, non-standalone users | `preselectedSubject`, `selectedSubjectLabel`, `onBack`, `onBackToCycles`, `preselectedYearName`, `preselectedCycleName` (`SubjectDashboard.tsx` ~L664–675) | URL stays `/subject-dashboard`; OCREvaluation is rendered **inline** in place of the dashboard |
| `/ocr-evaluation` | Login for non-admin users when Standalone Mode is on (`Login.tsx` ~L176–178, ~L214–215) | none | `onBack` undefined → no breadcrumb on the workspace list, no subject pill, "change it" text instead of a "go back" link |
| SuperAdmin subject card | Admin console (`SuperAdminDashboard.tsx` ~L211–216) | `preselectedSubject`, `onBack`, `selectedSubjectLabel`, `overrideOrgCode` | Not a user path; see [`../admin/`](../admin/). Included here because `isSuperAdmin` gating lives in OCREvaluation |

A non-standalone user can also type `/ocr-evaluation` by hand. It renders like the standalone entry (no props). The subject then comes from `fetchSubjectsSmart` (sessionStorage `yearcode`/`cyclecode`, or a fan-out across every year × cycle) and `resolveSubjectCode()`. Because `resolveSubjectCode()` prefers sessionStorage `subjectcode`, a stale value from an earlier visit wins over the dropdown selection (`OCREvaluation.tsx` → `resolveSubjectCode` ~L1143, `refreshWorkspaces` ~L4063–4072).

## 2. What a user can and cannot do

### 2.1 Role checks

| Check | Definition | Effect for a normal user (`isSuperAdmin === false`) |
|---|---|---|
| `isSuperAdmin` | `sessionStorage.userRole.toLowerCase() === 'superadmin'` (`OCREvaluation.tsx` ~L955–956) | Sees **Create New Workspace** (~L8689), **Upload Additional Files** (~L8905), the candidate **Delete** button (~L9454), and **Logout** in `HeaderAccountControls` (`showLogout={!isSuperAdmin}` ~L8656). `confirmDeleteSelectedCandidates` refuses with "Superadmin cannot delete candidates" for superadmin (~L3721) |
| `isAdmin` (SubjectDashboard) | `userRole === 'admin'` (`SubjectDashboard.tsx` ~L324) | Only changes header top padding. Admins are never routed to this page by Login |

> Risk: `isSuperAdmin` only matches `superadmin`. An `admin` user who opens a subject from the SuperAdmin console gets normal-user controls (create, delete, upload) inside OCREvaluation.

### 2.2 Ownership checks

Ownership is decided client-side by `isUserCodeMismatch(apiUserCode)` (`OCREvaluation.tsx` ~L418–447):

- An empty or missing `apiUserCode` counts as a **mismatch** ("Require an explicit match to enable").
- Otherwise the user owns the record if `apiUserCode` (trimmed, case-insensitive) equals any of: sessionStorage `userCode`, `usercode`, `username`, `UserNameDetails`, `displayName`, or `userInfo.{username, UserNameDetails, userName, userCode, usercode}`.

| Control | Ownership rule | Message shown |
|---|---|---|
| Candidate row checkbox | `isSelectable(candidate) = !isUserCodeMismatch(candidate.userCode)` (~L9302). `candidate.userCode` comes from `candidate-process-data` `details[].userCode` | Tooltip "This workspace belongs to another user" |
| Header "select all" checkbox | Selects only `filteredSelectableCandidates` (~L9307, ~L9353) | – |
| Upload Additional Files button | Blocked when `isUserCodeMismatch(selectedWorkspace.userCode)`; `selectedWorkspace.userCode` is refreshed from `candidate-process-data` `summary[0].userCode` (~L4758–4767) | Tooltip "This workspace belongs to another user" |
| Opening a workspace card | **No ownership check**: any workspace returned by `list-workspace` opens. The list call itself is filtered by `usercode` | – |

Consequence: when the backend leaves out `userCode` on candidate rows, no row is selectable. The user then cannot delete candidates or export a selection, but can still export **all** rows, because Download with no selection exports everything.

### 2.3 Workspace and candidate deletion rules

| Action | Client-side rule | Code |
|---|---|---|
| Delete workspace | Only workspaces with `candidateCount === 0` can be checked (checkbox disabled otherwise, tooltip "This workspace cannot be deleted while scripts are associated with it"). `handleConfirmDeleteWorkspace` skips any with candidates ("Cannot delete workspace "X" — it has candidates.") | ~L8772–8787, ~L4989 |
| Delete candidates | Any selected (owned) candidate can be submitted. `isDeletable()` is computed (~L9273) but **never used**, so stage completion is not checked client-side. A "Download & Delete rules" dialog exists (~L16752) but nothing opens it | ~L9452–9498, ~L3711 |

## 3. Standalone vs normal mode

Standalone Mode comes from `get-config-info` → `configSetting.standalone`. It is cached in `localStorage.standalone_mode` (`'1'`/`'0'`) by Login (`fetchStandaloneMode`) and by OCREvaluation's two config fetches. The `standaloneMode` state is seeded from that cache on mount (~L2145). Several code paths read `localStorage.standalone_mode` directly instead of the state.

`effectiveWorkflowStages = standaloneMode ? { ...workflowStages, evaluation: false } : workflowStages` (~L2155). In Standalone Mode, Evaluation is hidden in the UI even when the configuration enables it.

| Area | Normal mode | Standalone Mode | Code |
|---|---|---|---|
| Landing page | `/subject-dashboard` (Year → Cycle → Subject) | `/ocr-evaluation` directly | `Login.tsx` ~L173–181 |
| Subject code sent to APIs | sessionStorage `subjectcode` → matched subject → `selectedSubject` | Always `'generic'` (`resolveSubjectCode`, `refreshWorkspaces`, `loadCandidatesForWorkspace`, `ensureCandidateIsNew`, submit chains) | ~L1147, ~L4071, ~L4713 |
| Breadcrumb on workspace list | `Year › Cycle › Subject` (or `Home › Subject`) | Hidden (`onBack && !standaloneMode`) | ~L8673 |
| Breadcrumb inside workspace | `Year › Cycle › Subject › Workspace` | `Subject › Workspace` (no base crumbs because `onBack` is undefined) | ~L8856–8869 |
| Header subject pill | Shown when `onBack` set | Hidden | ~L8644 |
| Create dialog: subject hint and "I confirm…" checkbox | Shown; checkbox required | Hidden; not required (`needsSubjectConfirm = !standaloneMode`) | ~L11186, ~L12073 |
| Create dialog: workflow-stage summary panel | Only in Upload Additional Files mode | Always shown | ~L11139 |
| "Confirm File Upload" alert before create | Shown | Skipped (`runWorkspaceAction` called directly) | ~L12061 |
| Image/Audio toggle | Shown when OCR without Segmentation/Indexing | Hidden; effect forces `standaloneUploadMode='image'` | ~L10920, ~L2508 |
| OCR-only create flow | Per-question popup (`submitOcrWorkflow`) | Inline 1–3 image picker, **Create & Extract** (AI transcription in browser flow) | ~L10996, ~L11862 |
| Per-question popup sidebar | Question text + number | Narrow rail, numbers only; question text hidden | ~L17108–17151 |
| Question list | `question-data` for the subject (mock fallback) | Synthesised `Question 1..N`, N = `apiConfig.indexingConfig.predefinedSettings.maxQuestions` or 10 | ~L4396–4417 |
| Evaluation column, widget, filter option | Per config | Hidden (effective evaluation = false) | ~L10023, ~L9145, ~L9230 |
| Status filter dropdown | Shown unless Segmentation-only | Hidden (`hideStatusFilter`) | ~L2209 |
| Quick Approve column | Shown unless Segmentation-only | Also hidden for Standalone OCR-only (`hideQuickApproveColumn`) | ~L2182 |
| Candidate-name link (candidate info) | Clickable unless `segmentationConfig.CandidateInfo === false` | Never clickable (`apiConfig.standalone`) | ~L10075 |
| Download button | Always rendered | Hidden for Standalone + Segmentation-only; disabled when config evaluation is off | ~L9505–9517 |
| `recalculate-standards` after Standalone OCR-only save | – | Skipped | ~L11963 |
| Standalone + Indexing-only ZIP | – | One `save-candidate-info` per top-level ZIP folder before upload | ~L1848 |

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-standalone-workspace-list.png — Standalone Mode workspace list with no breadcrumb and no subject pill]
