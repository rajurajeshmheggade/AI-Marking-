# API Data Flow

How a user action turns into an HTTP request and back into rendered UI in this codebase, followed by three fully traced examples.

There is **no service layer**: handlers inside page components build URLs from `VITE_*` base constants and call `axios` or `fetch` directly. There is no request interceptor, no auth header, no retry and no shared error handler.

Related: [API integration mapping](../api/api-integration-mapping.md) · [API error handling](../api/api-error-handling.md) · [Component data flow](../components/component-data-flow.md) · [State management](../architecture/state-management.md)

---

## 1. The generic request lifecycle

```text
 ┌──────────────┐
 │ User event   │ click / select / dialog open / mount / timer (polling)
 └──────┬───────┘
        ▼
 ┌──────────────────────────────┐
 │ Handler in the page          │ e.g. handleSaveToDB, loadCandidatesForWorkspace
 │  - guard checks (validation, │ early return + toast.error on invalid input
 │    "is a loader active?")    │
 └──────┬───────────────────────┘
        ▼
 ┌──────────────────────────────┐
 │ Build params                 │ getSessionCodes() / getFinalCodes()
 │  sessionStorage (dual-case)  │ orgCode|orgcode, userCode|usercode, subjectcode, workspaceid
 │  localStorage                │ standalone_mode → subject 'generic'
 │  props                       │ overrideOrgCode, preselectedSubject, yearCode/cycleCode
 │  hard-coded fallbacks        │ 'ICME', 'ICME01', 'ICMELIVE', 'ICME1'
 └──────┬───────────────────────┘
        ▼
 ┌──────────────────────────────┐
 │ Set loading flag             │ setPageLoading(true) / setIsSavingToDB(true) / setIsYearLoading(true)
 │                              │ → <PageLoader/> (OCREvaluation, SuperAdminDashboard)
 │                              │ → inline Loader2 spinners (SubjectDashboard)
 └──────┬───────────────────────┘
        ▼
 ┌──────────────────────────────┐
 │ axios.get/post or fetch      │ URL = `${API_BASE1}/path` etc.; many GETs add no-cache headers
 └──────┬───────────────────────┘
        ▼
 ┌──────────────────────────────┐
 │ Response check (varies!)     │ (a) HTTP only: response.ok / any 2xx
 │                              │ (b) envelope: status/statusCode === 'S001' | 'S002'; 'F001' = failure
 │                              │ (c) shape only: Array.isArray(data) | data.data | data.summary
 └──────┬───────────────────────┘
        ▼
 ┌──────────────────────────────┐
 │ Map + setState               │ normalise field casing (yearcode ?? yearCode …)
 │                              │ mirror some values into storage (localStorage org_*, workspaceid)
 └──────┬───────────────────────┘
        ▼
 ┌──────────────────────────────┐
 │ catch                        │ toast.error(...)  |  console.warn only  |  MOCK DATA fallback
 └──────┬───────────────────────┘
        ▼
 ┌──────────────────────────────┐
 │ finally: clear loading flag  │ → React re-renders with new state
 └──────────────────────────────┘
```

### 1.1 Response-check styles in use

| Style | Where | Consequence |
|---|---|---|
| Envelope `S001` (and `F001`) | `src/api.ts` → `loginUser`, `registerUser`; create-workspace (F001 = name exists); evaluation / question-flow chains via `assertStepSucceeded` (S001/S002) | Correct handling of "200 but failed". |
| Any 2xx = success | `SettingsSection.handleSaveToDB` (`save-config-info`), `confirmDeleteSelectedCandidates` (`delete-candidate`, OCREvaluation ~L3711), `handleToggleStatus` (`update-subject-data`) | A failure body with HTTP 200 is shown as success. |
| Shape only | Year / cycle / subject lists, `candidate-process-data`, `get-all-data-exports`, `get-config-info` | Empty or unexpected shapes become "no data", not an error. |

### 1.2 Error-path styles in use

| Style | Example |
|---|---|
| `toast.error` | Most user-triggered actions. |
| `console.warn` only, then continue as success | Phase 1 approve: OCR sync, recalculation and `update-status` failures (`handlePhase1Approve`). |
| Mock-data fallback | Home lists (`SubjectDashboard` — `USE_MOCK_DATA_WHILE_BACKEND_IN_DEV`), candidate table (`generateMockCandidates`), question list (`defaultMockQuestionsList`, 5 questions). |
| Silent | Polling refreshes (`silent: true`) swallow errors entirely. |

### 1.3 Loading flags

- `OCREvaluation`: `isPageLoaderActive` (~L8475) ORs ~15 flags (`pageLoading`, `downloadExportLoading`, `questionListLoading`, `listWorkspaceRefreshLoading`, upload / create flags, …) plus `isPopupLoaderActive`; any true flag shows `<PageLoader/>`.
- `SuperAdminDashboard` sections: `loadingOrgs`, `uploading`, `loadingSettings`, `isSavingToDB`, `isSaving`.
- `SubjectDashboard`: `isYearLoading`, `isCycleLoading`, `isSubjectLoading` (inline spinners), `isExporting` (overlay).

### 1.4 The candidate polling loop

```text
open workspace ─▶ loadCandidatesForWorkspace(ws)              (non-silent: PageLoader, table cleared)
              └─▶ startCandidatePolling(ws)
                     stopCandidatePolling(); setInterval(every CANDIDATE_POLL_INTERVAL_MS = 30_000 ms)
                        └─▶ loadCandidatesForWorkspace(ws, { silent: true })
                               ├─ skipped if ANY loader/saving flag is active (unless force)
                               ├─ GET candidate-process-data
                               ├─ setCandidates(...); setSelectedWorkspace(NEW object)
                               └─ every detail markingstatus === 2 → stopCandidatePolling()

effect [dialog flags…, selectedWorkspace]
   ├─ any review/upload dialog open → stopCandidatePolling()
   └─ otherwise → startCandidatePolling(selectedWorkspace)   ← re-fires after EVERY load,
                                                                because selectedWorkspace is replaced
effect [selectedWorkspace] → GET get-config-info              ← therefore also ~every 30 s
1-second effect → pollCountdown (UI countdown)
```

Source: `src/pages/OCREvaluation.tsx` → `CANDIDATE_POLL_INTERVAL_MS` (~L888), `stopCandidatePolling` (~L1007), `loadCandidatesForWorkspace` (~L4688), `startCandidatePolling` (~L5117), dialog-pause effect (~L5150), config effect (~L3146).

Observable consequences: polling effectively never stops while a workspace is open (the "all marked" stop is immediately undone by the restart), and `get-config-info` is re-requested on every poll. See [known issues](../known-issues.md).

---

## 2. Traced example A — opening a workspace → `candidate-process-data` → table

**Trigger:** user clicks a workspace card (~L8761) or picks one in the workspace dropdown (~L9044; that path first refreshes `list-workspace`).

```text
click workspace card
 └─ syncWorkspaceIdToSession(ws)           sessionStorage.workspaceid = ws.id
 └─ loadCandidatesForWorkspace(ws)
     ├─ guard: return if any loader flag is active
     ├─ setPageLoading(true) → <PageLoader/>
     ├─ setSelectedWorkspace(ws); setHasUploaded(false); setCandidates([])
     ├─ params
     │    OrgCode    ← getFinalCodes(): overrideOrgCode ?? session orgcode/orgCode ?? 'ICME01'
     │    CustCode   ← 'ICME'
     │    UserCode   ← overrideUserCode ?? session usercode/userCode ?? 'ICME1'
     │    SubjectCode← 'generic' if localStorage.standalone_mode==='1' else resolveSubjectCode() || 'S1'
     │    WorkspaceId← numeric ws.id, else sessionStorage.workspaceid/workspacesid
     ├─ GET {VITE_AIMARKING_API_BASE}/candidate-process-data   (no-cache headers)
     ├─ response: { summary: [...], details: [...] }   — no S001/F001 check
     │    summary[0].userCode → ownership check (mismatch flag)
     │    details[] → realCandidates:
     │         segmentationstatus / ocrstatus / markingstatus → mapStatusCodeToPhaseStatus
     │             3 → 'pending' (badge text "Approved"), 2 → 'completed',
     │             1 → 'in-progress' ('completed' for segmentation-only), else 'yet-to-…'
     │         approvedstatus 1 + segmentation 3 → phase1 'approved'
     ├─ setSelectedWorkspace(updatedWorkspace); setWorkspaces(...); setFolderName/FileCount/TotalFileSize
     ├─ setCandidates(realCandidates); setHasUploaded(true); setInProgressSince(...)
     ├─ catch (non-silent): toast.error('Failed to load candidate data, showing sample data instead')
     │                      setCandidates(generateMockCandidates(...))      ← MOCK ROWS
     └─ finally: setPageLoading(false)
 └─ startCandidatePolling(ws)  → §1.4
render: candidate table rows → StatusBadge per stage; empty → "No candidates found matching your filters"
```

---

## 3. Traced example B — Config Settings "Save" → `save-config-info`

**Trigger:** Super Admin / Admin clicks Save in Config Settings (`src/pages/SuperAdminDashboard.tsx` → `SettingsSection.handleSaveToDB`, ~L4644).

```text
click Save
 └─ handleSaveToDB()
     ├─ org = organizations.find(id === selectedOrg)  → none: toast.error('No organization selected')
     ├─ validation (each → toast.error + return):
     │    Top N / Total errors (only if Evaluation stage on)
     │    Predefined indexing: blank Max Questions / Max Images, Max Images minimum
     │    untagged questions in the predefined mapping
     ├─ setIsSavingToDB(true) → <PageLoader/>
     ├─ payload = { orgCode: org.organizationcode, …configSetting built from state
     │              and per-subject values read back from localStorage org_* keys }
     ├─ fetch POST {VITE_AIMARKING_API_BASE}/save-config-info  (JSON)
     ├─ response.ok (any 2xx):
     │     code = result.code || result.status
     │     's001' → toast "Settings saved successfully (s001)"
     │     's002' → toast "Settings updated successfully (s002)"
     │     anything else (incl. uppercase 'S001' or an F-code) → toast.success(result.message || 'Configuration saved…')
     │     await loadSettings(org.organizationcode)   → GET get-config-info → setState per present section
     ├─ !response.ok → toast.error(`Failed to save configuration: ${status}`)
     ├─ catch → toast.error('Error connecting to the API to save settings')
     └─ finally: setIsSavingToDB(false)
                 handleSavePassMark(true) … handleSaveStandalone(true)
                 → ALWAYS writes org_* keys and global standalone_mode to localStorage
```

Effect on other pages: the evaluator's `OCREvaluation` re-reads `get-config-info` when the Create Workspace dialog opens and on workspace changes; `Login` re-reads it on every login. The localStorage mirror only affects **this** browser.

---

## 4. Traced example C — Download → paginated `get-all-data-exports` → ExcelJS

**Trigger:** evaluator selects candidates (or none = all) and clicks **Download** in the candidate toolbar (`src/pages/OCREvaluation.tsx`, inline `onClick` ~L9529).

Visibility: hidden when Standalone Mode is segmentation-only. Disabled unless every selected id is found in the current `candidates` and has each enabled stage at least completed, also disabled when Standalone Mode has no Evaluation stage, and while `downloadExportLoading`.

```text
click Download
 ├─ ids = Array.from(selectedCandidates)
 ├─ setDownloadExportLoading(true) → <PageLoader/>
 ├─ params: WorkspaceId (selectedWorkspace.id | session workspaceid), CustCode 'ICME',
 │          OrgCode (session orgCode|orgcode|org | 'ICME01'), SubjectCode (resolveSubjectCode() | 'S1')
 ├─ loop PageNumber = 0,1,2…  (MAX_PAGES 200; no page size sent)
 │     GET {VITE_AIMARKING_API_BASE}/get-all-data-exports
 │     page = res.data.data ([] → stop); totalcount from first record; stop when reached
 ├─ no records → toast.error('No data available to export')
 ├─ filter to selected registration numbers (if any selected)
 ├─ parse JSON fields: indexingdata, ocrdata, evaluationdata
 ├─ ExcelJS workbook — each sheet only if it has data rows:
 │     'ObtainedScore'        (per-question marks + total)
 │     'Evaluation Details'   (score / missing points / feedback per question)
 │     'Indexing & OCR Data'  (page mapping and OCR text per question)
 │   none → toast.error('No data available to export')
 ├─ saveAs(blob, `${subCode}_${workspaceName}.xlsx`)
 ├─ toast.success('Downloaded N candidates data' | 'Downloaded all candidate data')
 ├─ catch (ANY error, incl. network/5xx) → toast.error('No evaluation data available to export')
 └─ finally: setDownloadExportLoading(false)
```

Support note: the catch-all message means a backend outage during Download looks like "no evaluation data". Check the Network tab for the `get-all-data-exports` status.

The **Student Export** on the Home page is a separate flow (`SubjectDashboard.handleStudentExport` → `GET student-export?CustCode&OrgCode&RegistrationNumber`, single request, sheets `ObtainedScore` and `Evaluation Details`, file `<registerNumber>.xlsx`).
