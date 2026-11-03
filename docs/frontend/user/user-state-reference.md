# User Scope: State Reference

These are the React state variables, refs and derived values that drive visibility and API calls in the user scope. SD = `src/pages/SubjectDashboard.tsx`, OCR = `src/pages/OCREvaluation.tsx`. Review-dialog state (`phase1*`, `ocr*`, `evaluation*`, manual marking, re-evaluation) is in [user-review-and-evaluation.md](./user-review-and-evaluation.md).

## 1. SubjectDashboard

| State | File | Purpose | Updated by | Used by |
|---|---|---|---|---|
| `years` | SD ~L115 | Year options | `fetchYears` | Year `<select>`, breadcrumb/title labels, `preselectedYearName` |
| `selectedYearCode` | SD ~L116 | Current year | restore effect, `fetchYears`, Year `onChange` | year effect → `fetchCycles`; `handleSelect` → sessionStorage |
| `isYearLoading` / `yearError` | SD ~L117–118 | Year card state | `fetchYears` | skeleton / error+Retry |
| `cycles` | SD ~L120 | Cycle cards | `fetchCycles`, Year change | grid, breadcrumb, `preselectedCycleName` |
| `selectedCycleCode` | SD ~L121 | Current cycle; toggles between the Year/Cycle card and the Subjects card | restore effect, `handleCycleSelect`, breadcrumb, `onBackToCycles` | layout, `fetchSubjectsForCycle`, `handleSelect` |
| `isCycleLoading` / `cycleError` | SD ~L122–123 | Cycle state | `fetchCycles` | skeleton / error |
| `subjects` | SD ~L125 | Subject cards (may be mock) | `fetchSubjectsForCycle`, `fetchCycles` (clear) | `filtered`, Student Export visibility |
| `isSubjectLoading` / `subjectError` | SD ~L126–127 | Subject state | `fetchSubjectsForCycle` | skeleton; disables cycle cards |
| `search` | SD ~L129 | Subject filter | Search input | `filtered` |
| `selected` | SD ~L130 | Chosen subject; when set, renders `<OCREvaluation>` | `handleSelect`, `onBack`, `onBackToCycles` | root render; `[selected]` effects |
| `totalTokens` | SD ~L133 | Header token sum | `fetchTokens` | `HeaderAccountControls` |
| `allWorkflowStagesEnabled` | SD ~L610 | All four stages enabled | `fetchWorkflowConfig` | Student Export button |
| `isExportDialogOpen` / `studentRegisterNumber` / `isExporting` | SD ~L134–136 | Student Export dialog | dialog controls, `handleStudentExport` | dialog, overlay |
| `cycleRequestIdRef` / `subjectRequestIdRef` / `configRequestIdRef` | SD ~L140–141, ~L612 | Discard stale responses | each fetch | each fetch |

## 2. OCREvaluation: configuration and mode

| State / derived | File | Purpose | Updated by | Used by |
|---|---|---|---|---|
| `apiConfig` | OCR ~L2129 | Full `configSetting` | `selectedWorkspace` config effect, dialog-open effect | candidate-info gate, standards chip, thresholds, Q-number extraction, Download gate, `config_data` upload field |
| `workflowStages` | OCR ~L2135 | Raw stage flags | mount (localStorage), both config fetches | `questionFlowMode`, upload endpoint choice, `isSegmentationOnly`, `renderQuickApproveToggle` |
| `standaloneMode` | OCR ~L2145 | Standalone flag (seeded from localStorage) | mount, config fetches | breadcrumb/pill, dialog sections, `effectiveWorkflowStages`, filters |
| `effectiveWorkflowStages` | OCR ~L2155 | Stages with Evaluation off in standalone | derived | columns, widgets, `uploadPolicy`, Download readiness |
| `uploadPolicy` | OCR ~L2162 | Accept/validation rules | derived (`getUploadPolicy`) | pickers, `validateWorkspaceStructure`, hints |
| `isSegmentationOnly` | OCR ~L2169 | Only Segmentation configured | derived | status mapping (1 → completed), hide filter/Quick Approve, Download (standalone) |
| `isStandaloneOcrOnlyMode` / `isStandaloneIndexingOnly` | OCR ~L2174 / ~L2187 | Standalone single-stage modes | derived | Quick Approve column; ZIP → save-candidate-info |
| `hideQuickApproveColumn` / `hideStatusFilter` | OCR ~L2182 / ~L2209 | Column/filter visibility | derived | table header/cells, filter row |
| `segmentationLabel` | OCR ~L2213 | "Segmentation" / "Indexing" / "Segmentation Indexing" | derived | column header |
| `supportsAudioUpload` | OCR ~L2202 | OCR without Segmentation/Indexing | derived | Image/Audio toggle, `questionFlowMode` |
| `standaloneUploadMode` | OCR ~L2195 | `'image'` \| `'audio'` | toggle, Upload Additional Files (from `standardCount`), force-image effect | `questionFlowMode`, upload endpoint, `standardCount` sent |
| `questionFlowMode` | OCR ~L2413 | `'images'` \| `'text'` \| null | derived | Candidate Name field, upload column visibility, Next button, popup |
| `isQNumExtractionEnabled` | OCR ~L3838 | Expected Question Numbers field | derived (config → localStorage) | dialog field, `question_numbers` upload field |
| `isConfigLoadingForDialog` / `isConfigLoading` | OCR ~L974 / ~L2130 | Config fetch in flight | config effects | "Loading workflow configuration…", toggle hidden |

## 3. OCREvaluation: subject, workspace list and selection

| State | File | Purpose | Updated by | Used by |
|---|---|---|---|---|
| `subjects` | OCR ~L3826 | Subject list (placeholder until fetched) | subject effect, `refreshSubjects` | `resolveSubjectCode/Name`, `currentSubjectLabel`, `subjectName` in uploads |
| `selectedSubject` | OCR ~L3274 | Current subject value | prop, subject effect, Create button (`'generic'` in standalone) | `refreshWorkspaces` trigger, question-data trigger |
| `activeSubjectData` | OCR ~L1040 | Subject with `guidelinepath` | subject effect | "Mark schema not uploaded" empty state |
| `subjectsLoaded` / `workspacesLoaded` / `pageLoading` | OCR ~L1029–1030 / ~L1022 | Initial page loader | subject effect, `refreshWorkspaces`, derived effect, many actions | `<PageLoader>`, `loadCandidatesForWorkspace` skip guard |
| `questions` | OCR ~L4382 | Question list (mock default; synthesised in standalone) | question-data effect, standalone effect | per-question popup, export question columns |
| `questionsEmpty` / `questionListLoading` | OCR ~L1041 / ~L1032 | No questions / loading | question-data effect, `refreshWorkspaces` | empty state / loader |
| `workspaces` | OCR ~L960 | Workspace list | `refreshWorkspaces`, create flows (local insert), `loadCandidatesForWorkspace`, delete | cards, Workspace ▼, header tokens |
| `selectedWorkspace` | OCR ~L961 | Open workspace (null = list view) | card click / ▼ via `loadCandidatesForWorkspace`, create flows, back-to-list, delete candidates | whole in-workspace view; config effect; polling effect; ownership (`userCode`) |
| `selectedWorkspaceIds` | OCR ~L1045 | Workspaces checked for delete | card checkbox, Select All, Create, card click | Delete (n), delete dialog |
| `pendingDeleteWorkspace` | OCR ~L1044 | Single-delete target (never set to a value) | – | delete dialog / handler |
| `showWorkspaceDeleteConfirm` / `isDeletingWorkspace` | OCR ~L1046–1047 | Delete dialog | toolbar / handler | dialog |
| `isRefreshingWorkspaces` / `listWorkspaceRefreshLoading` | OCR ~L4038 / ~L1039 | list-workspace in flight | `refreshWorkspaces` / Workspace ▼ | Subject crumb disabled / PageLoader |
| `listWorkspaceInFlightRef`, `listWorkspaceLastKeyRef/AtRef`, module `sharedListWorkspaceRequest` | OCR ~L4033–4037, ~L118 | De-duplicate list-workspace | `refreshWorkspaces` | `refreshWorkspaces` |

## 4. OCREvaluation: create / upload dialog

| State | File | Purpose | Updated by | Used by |
|---|---|---|---|---|
| `showCreateWorkspaceDialog` | OCR ~L962 | Dialog open | Create, Upload Additional Files, Cancel, success paths, F001 | dialog, config effect, polling pause |
| `isAdditionalUploadMode` | OCR ~L970 | Additional vs create | Upload Additional Files / resets | title, name disabled, sections, button branch, chains reuse workspace id |
| `newWorkspaceName` | OCR ~L965 | Name (≤ 60) | input, additional prefill, resets | create-workspace, scriptPath, validation |
| `newWorkspaceCandidateName` | OCR ~L2426 | Registration number for OCR/Evaluation/Standalone | input, `resetCandidateEntry` | save-candidate-info, scriptPath, duplicate check |
| `newWorkspaceFiles` / `newWorkspaceIsFolder` | OCR ~L966 / ~L2109 | Create-mode files | dropzone/pickers | `createWorkspaceAsync` |
| `addedFilesInfo` | OCR ~L3323 | Additional-mode files | additional dropzone | `uploadAddedFiles`, button disabled |
| `subjectConfirmed` | OCR ~L972 | "I confirm…" checkbox | checkbox, dialog-open effect, additional-mode effect | primary button disabled |
| `workspaceNameExistsError` | OCR ~L964 | F001 banner | `createWorkspaceAsync`, name input, dialog open | banner |
| `questionNumbers` | OCR ~L973 | Expected question numbers | input | `question_numbers` upload field |
| `standaloneOcrImages` | OCR ~L2497 | 1–3 files for Create & Extract | standalone picker | Create & Extract chain |
| `standaloneOcrLoading` / `standaloneOcrOverlayLoading` / `standaloneOcrStep` | OCR ~L2499–2502 | Create & Extract progress | chain | button label, PageLoader |
| `showQuestionFlowDialog` / `qFlowActiveIndex` | OCR ~L2512–2513 | Per-question popup | Next, Cancel/close | popup |
| `qFlowImages` / `qFlowTexts` | OCR ~L2514–2515 | Per-question answers | popup inputs, reset | `submitOcrWorkflow` / `submitEvaluationWorkflow` |
| `isSubmittingEvalWorkflow` / `evalWorkflowStep` | OCR ~L2579–2580 | Submit chain progress | chains | Submit All label, PageLoader |
| `isCheckingCandidateDuplicate` (+ `candidateCheckInFlightRef`) | OCR ~L2431 | Duplicate-candidate check | `ensureCandidateIsNew` | button disabled, PageLoader |
| `isCreatingWorkspace` / `isValidatingName` / `isUploading` | OCR ~L967–968 / ~L981 | Create/upload busy | create & upload flows, `cancelUpload` | buttons, upload overlay, Cancel → `cancelUpload` |
| `preparingFilesLoading` / `workspaceValidationLoading` / `firstUploadPdfsLoading` | OCR ~L1024–1027 | Create pipeline phases | `createWorkspaceAsync` | PageLoader |
| `isBackgroundUploading` / `uploadTotalFiles` / `uploadCompletedFiles` | OCR ~L988 / ~L1017–1018 | Background batch progress | upload loops | overlay %, stop-polling effect |
| `isUploadingAddedFiles` | OCR ~L983 | Additional upload busy | `uploadAddedFiles` | button label, PageLoader |
| `additionalUploadCooldown` / `uploadApiResponseCooldown` | OCR ~L984 / ~L986 | 30 s lockout after an upload response | upload flows (`setTimeout` 30000) | Upload Additional Files blocked |
| `uploadErrorPopup` | OCR ~L1050 | Upload Error alert | upload catch blocks | AlertDialog |
| `allowDialogCloseRef` / `closingForStartRef` / `uploadCancelledRef` / `uploadControllersRef` | OCR ~L994–999 | Close guard and cancellation | Cancel, flows | dialog `onOpenChange`, `cancelUpload` |
| `pendingWorkspaceAction` / `showWorkspaceActionConfirm` | OCR ~L3257–3258 | "Confirm File Upload" (normal-mode create) | primary button | `handleWorkspaceActionConfirmYes/No` |

## 5. OCREvaluation: candidate table, polling, export

| State | File | Purpose | Updated by | Used by |
|---|---|---|---|---|
| `candidates` | OCR ~L3192 | Rows | `loadCandidatesForWorkspace`, delete, back-to-list | table, widgets, `hasIncompleteScripts`, duplicate-file check |
| `hasUploaded` | OCR ~L2110 | Data loaded for this workspace | `loadCandidatesForWorkspace`, back-to-list | widgets/table vs "getting uploaded" card, header count |
| `searchQuery` / `statusFilter` / `phaseFilter` | OCR ~L3244–3246 | Filters (phase is always `'all'`) | inputs; reset on workspace change | `filteredCandidates` |
| `expandedCategories` | OCR ~L3252 | Expanded folder rows | folder row click | grouped rendering |
| `selectedCandidates` | OCR ~L3313 | Row selection (not cleared on workspace switch) | checkboxes; cleared after delete/export | Delete, Download enablement and filter |
| `pendingDeleteCandidates` / `showDeleteConfirmDialog` / `isDeletingCandidates` | OCR ~L3361–3363 | Delete flow | Delete button / handler | dialog |
| `detailCandidate` / `candidateInfoDetails` / `candidateInfoLoading` | OCR ~L3194 / ~L3200 / ~L3209 | Candidate Details dialog | `openCandidateDetails`, close | dialog, polling pause |
| `runningOcrCandidates` / `runningEvalCandidates` | OCR ~L3309 / ~L3311 | Rerun in flight | `handleRunOcr` / `handleRunEvaluation` | Rerun buttons, Quick Approve disabled |
| `inProgressSince` / `restartingCandidates` | OCR ~L3306–3307 | Stall tracking (stall check disabled) | `loadCandidatesForWorkspace` | none effective |
| `pollCountdown` | OCR ~L1005 | Seconds to next poll | 1 s ticker, start/stop | "The page refreshes in N second(s)" |
| `candidatePollIntervalRef` / `candidateNextPollAtRef` | OCR ~L1003–1004 | Poll timer | `startCandidatePolling` / `stopCandidatePolling` | polling |
| `loadCandidatesForWorkspaceRef` | OCR ~L5048 | Latest loader for interval callbacks | effect | polling, submit chains |
| `downloadExportLoading` | OCR ~L1023 | Export in flight | Download handler | button disabled, PageLoader |

## 6. Storage keys in scope

| Key | Store | Read by | Written by |
|---|---|---|---|
| `isLogin` | session | `RequireAuth` | Login; removed on logout |
| `userInfo`, `username`, `userCode`, `usercode`, `orgCode`, `orgcode`, `customerCode`, `custcode`, `userRole`, `user`, `appcode`, `UserNameDetails`, `displayName` | session | `getSessionCodes`, `getFinalCodes`, `isUserCodeMismatch`, display name, role checks, config fetches | Login (subset); logout removes a subset |
| `custCode` | session | `handleStudentExport` | never written (falls back to `'ICME'`) |
| `subjectcode`, `subjectCode` | session | `resolveSubjectCode`, `refreshWorkspaces`, export file name | SD `handleSelect`; hidden OCR Subject select |
| `subject_code`, `subject`, `subjectid/subjectId/subject_id`, `subjectname/subjectName/subject_name` | session | `resolveSubjectCode/Name` fallbacks | not written in this scope |
| `yearcode`, `yearCode`, `cyclecode`, `cycleCode` | session | SD restore effect, OCR `fetchSubjectsSmart` | SD `handleSelect` |
| `workspaceid` | session | most workspace-scoped calls | `loadCandidatesForWorkspace`, `syncWorkspaceIdToSession`, create flows |
| `workspacesid` | session | fallback reads | never written |
| `fromdate`, `todate` | session | `refreshWorkspaces` | not written in this scope |
| `icme_ocr.quickApprove.<workspaceId>` | session | `loadCandidatesForWorkspace` | `handleQuickApproveChange`, prune on refresh |
| `standalone_mode` | local | `standaloneMode` seed, `resolveSubjectCode`, many `=== '1'` checks | Login, OCR config fetches, SuperAdmin |
| `workflowStages` | local | OCR mount | Login, OCR config fetches |
| `org_ocr_qnum_<org>` / `org_ocr_qnum_<org>_<subject>` | local | `isQNumExtractionEnabled` fallback | SuperAdmin |
| `userName` | local | – | removed by OCR logout |
