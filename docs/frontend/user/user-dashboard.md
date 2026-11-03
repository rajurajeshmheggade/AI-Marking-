# User Home Page: `SubjectDashboard.tsx`

- **Route:** `/subject-dashboard` (`src/App.tsx` ~L41, wrapped in `RequireAuth`)
- **Component:** `src/pages/SubjectDashboard.tsx` → `SubjectDashboard`
- **Reached from:** Login, for non-admin users when Standalone Mode is off (see [user-overview.md](./user-overview.md#1-entry-points))
- **Hands off to:** `<OCREvaluation>` rendered inline (see [§8](#8-handoff-to-ocrevaluation) and [user-workspaces.md](./user-workspaces.md))

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-dashboard-cycles.png — Home page showing the Year dropdown and Cycle cards]
[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-dashboard-subjects.png — Subjects grid with breadcrumb, search box and Student Export button]

## 1. Constants and base URLs

| Constant | Value | Line |
|---|---|---|
| `API_BASE` | `VITE_ICMEPRODUCT_API_BASE` (hard-coded fallback). Declared but not used in this file | ~L15 |
| `API_BASE1` | `VITE_AIMARKING_API_BASE` (hard-coded fallback) | ~L16 |
| `API_ENDPOINTS.yearData / cycleData / subjectData` | `${API_BASE1}/get-year-data`, `/get-cycle-data`, `/get-subject-data` | ~L20–24 |
| `USE_MOCK_DATA_WHILE_BACKEND_IN_DEV` | **`true`** | ~L36 |
| `MOCK_YEARS`, `MOCK_CYCLES_BY_YEAR`, `MOCK_SUBJECTS_BY_CYCLE` | Fixed sample data (years 2024/2025; cycles C1–C4; subjects `S1_10`…`S1_17`) | ~L38–74 |

> **Mock fallback is live.** While `USE_MOCK_DATA_WHILE_BACKEND_IN_DEV` is `true`, an empty response *or* a failed request for years, cycles or subjects silently shows the mock data instead (`console.warn` only). The error states and Retry buttons in §6 therefore cannot be reached in the current build. Subject codes from the mock (`S1_10`…) are then written to sessionStorage and sent to every OCREvaluation API.

## 2. UI structure

```text
SubjectDashboard (h-screen flex column)
├── <header>
│   ├── logo + "OCR Evaluation" / "AI-powered Essay Marking"
│   └── HeaderAccountControls(displayName, tokenCount=totalTokens, onLogout=handleLogout)
├── <main>
│   ├── [selectedCycleCode] Breadcrumb  <Year button> › <Cycle name>
│   ├── [!selectedCycleCode] Year & Cycle card
│   │   ├── title "Cycle <yearname>" | "Select Year & Cycle"
│   │   ├── Year <select>
│   │   └── body: skeleton | year error+Retry | "No year(s) found" | skeleton | cycle error+Retry
│   │             | "No cycles available for the selected year." | Cycle card grid
│   └── [selectedCycleCode] Subjects card
│       ├── header: "Subjects" + Search input + [Student Export button → Dialog]
│       └── body: skeleton ×9 | subject error+Retry | empty text | Subject card grid
├── <footer> "Copyright © 2026 | Excelsoft Technologies Ltd. | Version: V.1.0.0"
└── [isExporting] full-screen overlay "Exporting data..."
```

The Year/Cycle card and the Subjects card are mutually exclusive. Which one shows depends only on whether `selectedCycleCode` is set (~L741, ~L858).

## 3. Header

| Element | Source | Behaviour |
|---|---|---|
| Display name | `displayName` IIFE (~L313): `userInfo.username`, else `sessionStorage.username`, else `'Evaluator'` | Read on every render |
| Token count | `totalTokens`, set by `fetchTokens` (~L546) | Sum of `totaltokenusage \| totalTokenUsage \| totaltoken` across every workspace returned by `list-workspace` |
| Logout | `handleLogout` (~L328) | Removes `isLogin, userInfo, username, password, userCode, orgCode, customerCode, userRole` from sessionStorage, then `navigate('/login')`. Does **not** clear `yearcode`/`cyclecode`/`subjectcode`, lowercase variants or localStorage |

`fetchTokens` request: `GET ${API_BASE1}/list-workspace` with `fromdate='2024-12-01'`, `todate=<today>`, `orgcode=getSessionCodes().orgcode || sessionStorage.orgCode || 'ICME01'`, `custcode='ICME'`, `usercode=sessionStorage.userCode || 'ICME1'`, `subject_code=''`, plus no-cache headers. On error it only logs to the console. Note the parameter name `subject_code` here; OCREvaluation sends `SubjectCode` to the same endpoint.

## 4. Year → Cycle → Subject chain

### 4.1 Lifecycle effects

| Effect | Deps | What it does |
|---|---|---|
| Restore selection (~L146) | `[selected]` | Reads sessionStorage `yearcode \| yearCode` and `cyclecode \| cycleCode`. Sets each only if the matching state is empty |
| Load (~L579) | `[selected]` | When `selected` is null (on mount, and on every return from a subject): `fetchYears()`; if year and cycle are already in state, `fetchSubjectsForCycle(year, cycle)`; `fetchTokens()`; `fetchWorkflowConfig()` |
| Year change (~L600) | `[selectedYearCode]` | `fetchCycles(selectedYearCode)` when non-empty |
| Outside-click (~L162) | `[]` | Closes `dropdownOpen` (a leftover; no dropdown uses it in the current JSX) |

### 4.2 `fetchYears` (~L373)

| Step | Detail |
|---|---|
| Request | `GET API_ENDPOINTS.yearData` with **no params** (a comment notes that `yearName=''` returned nothing) and no-cache headers |
| Response parsing | `extractArray`: the array itself, or `data.subjects \| data.data \| data.items` |
| Fields used | `yearid \| yearId`, `yearname \| yearName`, `yearcode \| yearCode`. Rows without `yearcode` are dropped |
| State | `years`. Keeps the current `selectedYearCode` if it is in the list, else selects the first year, else `''`. An empty list also clears cycles, cycle and subjects |
| Empty or error | Mock years (flag on). With the flag off: `yearError` = toast "Failed to load years. Please try again." and everything is cleared |
| Loading | `isYearLoading` (initially `true`) → 4 skeleton tiles |

### 4.3 `fetchCycles(yearCode)` (~L436)

| Step | Detail |
|---|---|
| Guard | `cycleRequestIdRef` request-id. A response that arrives after a newer year change is discarded |
| Pre-state | Clears `subjects` and `subjectError`. Keeps `selectedCycleCode` |
| Request | `GET API_ENDPOINTS.cycleData` params `{ YearCode }`, no-cache headers |
| Fields used | `cycleid \| cycleId`, `cyclename \| cycleName`, `cyclecode \| cycleCode`, `yearid`, `yearcode` (defaults to the requested year). Rows without `cyclecode` are dropped |
| State | `cycles`. Clears `selectedCycleCode` if it is not in the new list |
| Empty or error | `MOCK_CYCLES_BY_YEAR[yearCode]` (flag on). With the flag off: `cycleError` and toast "Failed to load cycles. Please try again." |

### 4.4 `fetchSubjectsForCycle(yearCode, cycleCode)` (~L494)

| Step | Detail |
|---|---|
| Guard | `subjectRequestIdRef` |
| Request | `GET API_ENDPOINTS.subjectData` params `orgCode` (session codes → `orgCode` → `'ICMELIVE'`), `custCode` (`'ICME'`), `yearCode`, `cycleCode`, `userCode` (session codes → `userCode` → `username` → `''`). Null bytes are stripped from each |
| Mapping | `mapSubjectItem` (~L337): label from `subjectname \| subjectName \| SName \| label \| name`; code from `subjectcode \| subjectCode \| value \| code \| id`; `workspaceCount` from `workspacecount \| workspaceCount`; `status` defaults to `1` |
| State | `subjects` |
| Empty or error | `MOCK_SUBJECTS_BY_CYCLE[cycleCode]` (flag on). With the flag off: `subjectError` and toast "Failed to load subjects. Please try again." |
| Loading | `isSubjectLoading` → 9 skeleton tiles. Cycle cards are disabled while it is true |

## 5. Controls

| Control | Visible when | Disabled when | Handler | Effect |
|---|---|---|---|---|
| Year `<select>` | `!selectedCycleCode` | `isYearLoading \|\| years.length === 0` | inline `onChange` (~L764) | Sets `selectedYearCode`; clears `cycles`, `selectedCycleCode`, `subjects`, `subjectError`. The year effect then calls `fetchCycles` |
| Cycle card | cycles loaded | `isSubjectLoading` | `handleCycleSelect` (~L540) | Ignored if subjects are loading or the same cycle is clicked. Sets `selectedCycleCode`, calls `fetchSubjectsForCycle` |
| Cycle card badge | – | – | – | "Selected" when it is the current cycle, else "Active" |
| Breadcrumb year button | `selectedCycleCode` | – | `backToCycleSelection` (~L710) | Clears `selectedCycleCode`, `subjects`, `subjectError`. The cycle list stays in state, so there is no refetch. Label: year name → year code → "Select Year & Cycle" |
| Breadcrumb cycle label | `selectedCycleCode` | – | – | Cycle name, else code (current page) |
| Search input | Subjects card | – | `setSearch` | Case-insensitive substring match on `label` |
| Subject card | in `filtered` | – | `handleSelect` (~L651) | See §8 |
| Student Export button | `allWorkflowStagesEnabled && subjects.length > 0` | – | opens dialog | §7 |

`filtered` (~L644): drops `status === 0`, then applies the search and `selectedSubject` (always null; there is no UI that sets it). Every card shows an "Active" badge, the label, "Code: <code>" and "<workspaceCount> Workspace(s)".

## 6. Loading, empty and error states

| Card | State | Rendering |
|---|---|---|
| Year/Cycle | `isYearLoading` | 4 pulse skeletons |
| Year/Cycle | `yearError` | Amber triangle, message, **Retry** → `fetchYears()` *(unreachable while the mock flag is on)* |
| Year/Cycle | `years.length === 0` | "No year(s) found" |
| Year/Cycle | `isCycleLoading` | 4 pulse skeletons |
| Year/Cycle | `cycleError` | Message, **Retry** → `fetchCycles(selectedYearCode)` *(unreachable while the mock flag is on)* |
| Year/Cycle | `cycles.length === 0` | "No cycles available for the selected year." |
| Subjects | `isSubjectLoading` | 9 pulse skeletons |
| Subjects | `subjectError` | Message, **Retry** → `fetchSubjectsForCycle` *(unreachable while the mock flag is on)* |
| Subjects | `filtered.length === 0` | "No subjects available for the selected cycle." when `subjects` is empty, else "No subject(s) found" |

## 7. Student Export dialog

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-dashboard-student-export.png — Student Export dialog with the register number field]

### 7.1 Visibility: `fetchWorkflowConfig` (~L614)

- Runs on every return to the list (the `[selected]` effect) and is guarded by `configRequestIdRef`. It resets `allWorkflowStagesEnabled` to `false` first, so the button is hidden while loading.
- Request: `GET ${API_BASE1}/get-config-info` params `OrgCode` (session codes → `orgCode` → `'ICME01'`), `CustCode` (`'ICME'`), `AppCode='AImarking'`, `_t=Date.now()`, plus no-cache headers.
- Response: `data[0].configSetting` when an array, else `data.configSetting ?? data`.
- `areAllWorkflowStagesEnabled(config.workflowStages)` (~L83) is true only when `ocr`, `indexing`, `evaluation` and `segmentation` are each strictly `=== true`. Errors set it to false.
- Button condition: `allWorkflowStagesEnabled && subjects.length > 0` (~L894). Because of the mock fallback, `subjects` can hold mock rows.

### 7.2 Dialog behaviour

| Element | Behaviour |
|---|---|
| Outside click | Blocked (`onInteractOutside` preventDefault) |
| "Student Register Number" input | `studentRegisterNumber` |
| Cancel / close | Clears the input, closes |
| Download | Disabled when the trimmed input is empty or `isExporting`. Calls `handleStudentExport` |

### 7.3 `handleStudentExport` (~L172)

1. Closes the dialog and sets `isExporting` (full-screen "Exporting data..." overlay).
2. `GET ${API_BASE1}/student-export?CustCode=<sessionStorage.custCode || 'ICME'>&OrgCode=<sessionStorage.orgCode || 'ICMELIVE'>&RegistrationNumber=<input>`. The query string is concatenated **without URL-encoding**. Login never writes `custCode`, so `'ICME'` is always used.
3. Empty `candidateData` → toast error "No data found for this register number."
4. For each `candidateData[]` row it parses `processdata` (a JSON string; parse failures are logged) and reads `eval_data[q].marks_awarded`, `missing_points[].how_to_improve`, `feedback`, and `final_score.obtained_score`.
5. Builds an ExcelJS workbook:

| Sheet | Columns | Notes |
|---|---|---|
| `ObtainedScore` | `Subject Name`, `Q1…Qmax`, `Total Score` | `max` = largest question number seen, at least 8 |
| `Evaluation Details` | `Subject Name`, `Workspace Name`, then `Qn_Score`, `Qn_Missing Points`, `Qn_Feedback` per question | Missing values become `"N/A"`; workspace name from `workspacename \| workspace_name \| workspaceid` |

   Header row: bold white text on `FF1F4E78`, centred. File name `<registerNumber>.xlsx` (via `file-saver`).
6. Toast "Export successful!". Any thrown error → toast "An error occurred during export."

## 8. Handoff to OCREvaluation

`handleSelect(subject)` (~L651) writes to sessionStorage:

| Key(s) | Value |
|---|---|
| `subjectcode`, `subjectCode` | `subject.code` |
| `yearcode`, `yearCode` | `selectedYearCode` |
| `cyclecode`, `cycleCode` | `selectedCycleCode` |

It then sets `selected = subject`, and the component returns (~L664):

```tsx
<OCREvaluation
  preselectedSubject={selected.value}
  onBack={() => setSelected(null)}                      // back to this cycle's subjects
  selectedSubjectLabel={selected.label}
  preselectedYearName={years.find(...)?.yearname}
  preselectedCycleName={cycles.find(...)?.cyclename}
  onBackToCycles={() => { setSelected(null); setSelectedCycleCode(''); setSubjects([]) }}
/>
```

No `override*Code` props are passed; OCREvaluation resolves codes from sessionStorage (`getFinalCodes`). The URL does not change, so a browser refresh lands back on the Home page with `selected` reset.

When OCREvaluation calls `onBack` (after `goBackToHome` refreshes its own subject list) or `onBackToCycles`, `selected` becomes null. The `[selected]` effect then re-runs `fetchYears`, `fetchSubjectsForCycle` (when year and cycle are still set), `fetchTokens` and `fetchWorkflowConfig`, so workspace counts and the Student Export visibility stay current.

## 9. Known risks (documentation only)

| Risk | Detail |
|---|---|
| Mock data in production paths | `USE_MOCK_DATA_WHILE_BACKEND_IN_DEV = true` masks backend failures and can route real users into mock subject codes |
| Fresh-mount restore race | On a fresh mount with `yearcode`/`cyclecode` already in sessionStorage, the restore effect and the load effect run in the same commit. `fetchYears` sees the stale empty `selectedYearCode` in its closure and may auto-select the first year over the restored one, and subjects are not fetched for the restored cycle. A likely result is a Subjects card showing "No subjects available for the selected cycle." until the user clicks the year breadcrumb. **Needs runtime verification.** |
| Unencoded query string | `student-export` builds its URL by string concatenation |
| Incomplete logout | `handleLogout` leaves the year/cycle/subject keys and the lowercase identity keys in place; `src/lib/session.ts` → `clearAuthSession` is not used |
