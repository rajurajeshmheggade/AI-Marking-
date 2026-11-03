# Component Data Flow

How data and callbacks move between components, and where they are handed over through browser storage instead of props. This app has no global store or context; data moves by **props**, **callbacks**, and **storage keys** (see [State management](../architecture/state-management.md)).

Related: [Component inventory](./component-inventory.md) · [Reusable components](./reusable-components.md) · [API data flow](../workflows/api-data-flow.md) · [Navigation flow](../pages/navigation-flow.md)

---

## 1. SubjectDashboard → OCREvaluation

`SubjectDashboard` does not navigate to a route when a subject is chosen. It writes context to `sessionStorage`, sets `selected`, and on the next render **returns `<OCREvaluation …/>` instead of its own UI** (`src/pages/SubjectDashboard.tsx` → `handleSelect` ~L651, render ~L664).

```text
SubjectDashboard (route /subject-dashboard)
 │  state: years, selectedYearCode, cycles, selectedCycleCode, subjects, selected
 │
 │  handleSelect(subject)
 │   ├─ sessionStorage.subjectcode / subjectCode  = subject.code
 │   ├─ sessionStorage.yearcode    / yearCode     = selectedYearCode
 │   ├─ sessionStorage.cyclecode   / cycleCode    = selectedCycleCode
 │   └─ setSelected(subject)
 │
 ▼  if (selected) return
OCREvaluation
   props (all optional):
   ├─ preselectedSubject     = selected.value          (data)
   ├─ selectedSubjectLabel   = selected.label          (breadcrumb)
   ├─ preselectedYearName    = years[...].yearname      (breadcrumb only)
   ├─ preselectedCycleName   = cycles[...].cyclename    (breadcrumb only)
   ├─ onBack()               → setSelected(null)        back to subject grid
   └─ onBackToCycles()       → setSelected(null); setSelectedCycleCode(''); setSubjects([])
   not passed here: overrideOrgCode / overrideCustCode / overrideUserCode
```

Inside `OCREvaluation`, `getFinalCodes` (~L725) resolves the codes every API call uses:

```text
orgCode  = overrideOrgCode  ?? getSessionCodes().orgcode  ?? sessionStorage.orgCode  ?? 'ICME01'
custCode = overrideCustCode ?? 'ICME'
userCode = overrideUserCode ?? getSessionCodes().usercode ?? sessionStorage.userCode ?? 'ICME1'
subject  = resolveSubjectCode(): 'generic' if localStorage.standalone_mode === '1',
           else sessionStorage subjectcode/subjectCode (…fallbacks), else selection
```

Back navigation: when `onBack` fires, `SubjectDashboard`'s `[selected]` effect re-runs `fetchYears`, `fetchSubjectsForCycle`, `fetchTokens` and `fetchWorkflowConfig`, so stage changes made while inside the subject are picked up.

When `OCREvaluation` is reached directly at `/ocr-evaluation` (Standalone Mode login, or a refresh), it receives **no props** and relies entirely on storage keys.

Mock-data caveat: if the Home lists fell back to mock data (`USE_MOCK_DATA_WHILE_BACKEND_IN_DEV`), the mock year/cycle/subject codes are written to these keys and sent to real APIs by OCREvaluation.

---

## 2. SuperAdminDashboard shell → sections

The shell (`src/pages/SuperAdminDashboard.tsx` → `SuperAdminDashboard`, ~L7607) owns Year/Cycle; each section owns its own organisation list and everything else.

```text
SuperAdminDashboard (route /superadmin-dashboard)
 │ state: activeSection ('role-management' default)
 │        headerYears, headerSelectedYearCode   ← GET {AIMARKING}/get-year-data   (mount; first auto-selected)
 │        headerCycles, headerSelectedCycleCode ← GET {AIMARKING}/get-cycle-data?YearCode=  (on year change;
 │                                                 cycle reset to '' while loading, first auto-selected)
 │        organizations, selectedOrg            ← GET organization-details (super admin only) — UNUSED
 │                                                 (sharedProps built, never passed)
 │
 │ renderYearCycle(variant) ─▶ <YearCycleDropdowns … onYearChange onCycleChange/>   (a ReactNode)
 │
 ├─ 'role-management' ─▶ <RoleManagementSection/>                     no props
 ├─ 'settings'        ─▶ <SettingsSection API_BASE1 yearCode cycleCode yearCycleSelector={renderYearCycle('settings')}/>
 ├─ 'subject-question'─▶ <SubjectQuestionPanel yearCode cycleCode yearCycleSelector={renderYearCycle('compact')}/>
 ├─ 'marks-schema'    ─▶ <MarksSchemaSection API_BASE API_BASE1 yearCode cycleCode yearCycleSelector={…}/>
 └─ 'dashboard' (unreachable) ─▶ Admin: <SubjectDashboard/> | Super Admin: <AdminSubjectView/> ─▶ <OCREvaluation overrideOrgCode/>
```

| Prop | Value | Consumers |
|---|---|---|
| `yearCode`, `cycleCode` | `headerSelectedYearCode`, `headerSelectedCycleCode` | All three sections: `get-subject-data` params, import duplicate checks |
| `yearCycleSelector` | Pre-rendered `YearCycleDropdowns` node | Rendered in each section's toolbar; changing it updates shell state, which flows back as new `yearCode`/`cycleCode` |
| `API_BASE1` | `VITE_AIMARKING_API_BASE` (or fallback) | `SettingsSection`, `MarksSchemaSection` (`RoleManagementSection` redefines its own copy) |
| `API_BASE` | `VITE_ICMEPRODUCT_API_BASE` (or fallback) | `MarksSchemaSection` (upload marking scheme) |

Re-fetch behaviour on Year/Cycle change:

- `SubjectQuestionPanel` and `MarksSchemaSection` re-run `fetchSubjects` when `cycleCode` changes. Because the shell blanks the cycle while cycles load, they briefly run with an empty cycle, show a "No Year/Cycle" toast and empty the table, then reload.
- `SettingsSection` has **no** effect on `yearCode`/`cycleCode`; its subject list only reloads on org change.

Organisation: each section fetches `organization-details?CustCode=ICME` itself and auto-selects the **first** organisation. For Admins the org dropdown is hidden, so they act on that first organisation rather than their own (see [known issues](../known-issues.md)).

---

## 3. OCREvaluation → StandaloneOCREvaluation → ScriptExtractorPanel → ExtractionOutputTabs

```text
OCREvaluation
 │ state: standaloneOcrPopupData : ExtractorSegment[] | null
 │   set only by handleOpenOcrReview (~L6120) when Standalone Mode is on AND
 │   the only enabled stage is OCR:
 │     GET {AIMARKING}/get-process-data?type=2&subjectcode=generic&workspaceid=…
 │     → processData.ocr_extracted_text → segments (imageUrl = IMAGE_BASE + path)
 │   on failure: toast.error(...) and the popup stays closed
 ▼
<StandaloneOCREvaluation
    open     = {!!standaloneOcrPopupData}
    onClose  = {() => setStandaloneOcrPopupData(null)}
    segments = {standaloneOcrPopupData || []} />
 │ state: popupImage {url,label} | null
 │ segments.length === 0 → "No OCR data found for this candidate."
 ├─▶ <ScriptExtractorPanel segments onInspectImage={setPopupImage}/>
 │     state: activeSegmentId, subject('General'), options(DEFAULT_OPTIONS),
 │            result (from segmentToResult / active segment), upload, zoomLevel, isRunning
 │     ├─▶ <ExtractionControls subject onSubjectChange options onOptionsChange
 │     │        onExtract={handleExtract} isRunning showButton={false}/>
 │     │        → renders an empty <div>; handleExtract has no trigger
 │     └─▶ <ExtractionOutputTabs result onCopy={handleCopy} isRunning/>
 │              tabs: OCR (marked → HTML) · LaTeX · Interpretation · Issues · JSON
 └─▶ nested <Dialog open={!!popupImage}> ─▶ <ImageInspectorModal imageUrl label onClose/>
```

Data contract: `ExtractorSegment` (exported from `src/components/ocr/ScriptExtractorPanel.tsx`). Results flow **down only** — nothing the user does inside the popup is passed back to `OCREvaluation` (there is no save callback). Approving OCR happens in OCREvaluation's own OCR review dialog, not in this popup.

The route `/standalone-ocr` renders `<StandaloneOCREvaluation/>` with no props → `open` is `undefined` → nothing visible.

---

## 4. Login → dashboards (storage hand-off)

```text
Login.handleSubmit
 ├─ loginUser()  (src/api.ts)  → sessionStorage: user, userCode, usercode, orgCode, orgcode,
 │                                customerCode, custcode, appcode
 ├─ access check (getAccountAccess) → denied: clearAuthSession(), modal
 ├─ sessionStorage: userInfo, isLogin='true', username, password, userCode, orgCode,
 │                  customerCode, userRole
 ├─ fetchStandaloneMode() → GET get-config-info → localStorage: workflowStages,
 │                  org_selected_stages_<org>, standalone_mode, org_standalone_<org>
 └─ navigate by customerCode/role/standalone:
      ICME + superadmin|admin → /superadmin-dashboard
      ICME + standalone       → /ocr-evaluation
      ICME + other            → /subject-dashboard
      not ICME                → "Access denied." (isLogin already 'true')
```

Readers on the other side:

| Reader | Keys read |
|---|---|
| `RequireAuth` (`src/App.tsx`) | `isLogin` |
| `getSessionCodes()` (`src/lib/session.ts`) | `user`/`userInfo`, `usercode`/`userCode`, `orgcode`/`orgCode`, `appcode` (custcode fixed `'ICME'`) |
| `SuperAdminDashboard` | `userRole` (default `'superadmin'`), `customerCode`, `orgCode`, `userInfo`, `username` |
| `SubjectDashboard` | `userRole`, `userInfo`, `username`, `orgCode`, `userCode`, `custCode` (never written), `yearcode`, `cyclecode` |
| `OCREvaluation` | everything above plus `subjectcode`, `workspaceid`, `standalone_mode`, `workflowStages`, `icme_ocr.*` drafts |

---

## 5. OCREvaluation internal flow (summary)

```text
workspace card / dropdown click
   └─ syncWorkspaceIdToSession → sessionStorage.workspaceid
   └─ loadCandidatesForWorkspace(ws) ── GET candidate-process-data ──▶ setCandidates, setSelectedWorkspace(new object)
   └─ startCandidatePolling(ws)  every CANDIDATE_POLL_INTERVAL_MS (30 s)
         └─ effect on [selectedWorkspace] restarts the interval and refetches get-config-info

candidate table row ── StatusBadge onClick ──▶ review dialog
   Phase 1 (segmentation/indexing): draft in sessionStorage icme_ocr.phase1.mapping.<ws>.<reg>
   OCR:                             draft in sessionStorage icme_ocr.phase2.ocr.<ws>.<reg>
   Evaluation:                      pendingScoresMap (state) → saveEvaluationScoreOnServer
   Approve → save + update-status → local row patched to 'approved'

selection (selectedCandidates) ──▶ Download / Delete toolbar
```

Details per stage: [Review & approval workflow](../workflows/review-and-approval-workflow.md), [User candidate table](../user/user-candidate-table.md).
