# User Scope: API Mapping (Home → Workspace → Upload → Candidate Table → Export)

Every API called from `src/pages/SubjectDashboard.tsx` and from the workspace-level parts of `src/pages/OCREvaluation.tsx` (plus `src/lib/extraction.ts`). Calls made only by the review dialogs are listed in [user-review-and-evaluation.md](./user-review-and-evaluation.md). The cross-app catalogue is in [../api/api-integration-mapping.md](../api/api-integration-mapping.md).

## Base URLs

| Constant | Env var | Defined in |
|---|---|---|
| `API_BASE` | `VITE_ICMEPRODUCT_API_BASE` | `SubjectDashboard.tsx` ~L15 (unused there); `OCREvaluation.tsx` ~L71 |
| `API_BASE1` | `VITE_AIMARKING_API_BASE` | `SubjectDashboard.tsx` ~L16; `OCREvaluation.tsx` ~L72 |
| `IMAGE_BASE` | `VITE_REPO_BASE` (+ `/`) | `OCREvaluation.tsx` ~L61 |
| `DEFAULT_ENDPOINT` | `VITE_AIAPPS_API_BASE` + `/AITranscription/extract` | `src/lib/extraction.ts` ~L21 |

Calls that do **not** go through `API_BASE`/`API_BASE1`:

- `get-config-info` in OCREvaluation (~L1114, ~L3152) builds its URL from `import.meta.env.VITE_AIMARKING_API_BASE` inline, using `fetch` instead of axios. The base is the same.
- `API_ENDPOINTS.runOcr / ocrImage / evaluateText` (~L103–105) repeat `VITE_ICMEPRODUCT_API_BASE` inline. `handleRunOcr` posts to `${API_BASE}/run-ocr` directly.
- `get-all-data-exports` (~L9545) and SubjectDashboard's `list-workspace`, `get-config-info` and `student-export` are built as `${API_BASE1}/…` template strings, not through `API_ENDPOINTS`.
- Every env var has a **hard-coded production URL fallback** in source. A missing variable in a non-production build therefore silently targets production.

## Main table

| # | API (method · path · base) | File → function | Trigger | Key request fields | Response fields used | State written | UI element |
|---|---|---|---|---|---|---|---|
| 1 | GET `get-year-data` · `API_BASE1` | SD → `fetchYears` | Home mount / return from subject | none (no-cache headers) | array or `data/items/subjects`; `yearid, yearname, yearcode` | `years`, `selectedYearCode` | Year `<select>` |
| 2 | GET `get-cycle-data` · `API_BASE1` | SD → `fetchCycles` | `selectedYearCode` change | `YearCode` | `cycleid, cyclename, cyclecode, yearid, yearcode` | `cycles`, `selectedCycleCode` | Cycle cards |
| 3 | GET `get-subject-data` · `API_BASE1` | SD → `fetchSubjectsForCycle` | Cycle click / return from subject | `orgCode, custCode, yearCode, cycleCode, userCode` | `subjectname, subjectcode, workspacecount, status` | `subjects` | Subject cards |
| 4 | GET `list-workspace` · `API_BASE1` | SD → `fetchTokens` | Home mount / return | `fromdate='2024-12-01', todate, orgcode, custcode='ICME', usercode, subject_code=''` | `totaltokenusage` (sum) | `totalTokens` | Header token count |
| 5 | GET `get-config-info` · `API_BASE1` | SD → `fetchWorkflowConfig` | Home mount / return | `OrgCode, CustCode, AppCode='AImarking', _t` | `[0].configSetting.workflowStages` | `allWorkflowStagesEnabled` | Student Export button |
| 6 | GET `student-export` · `API_BASE1` | SD → `handleStudentExport` | Student Export → Download | query `CustCode, OrgCode, RegistrationNumber` (unencoded) | `candidateData[].{subjectname, workspacename, processdata(JSON)}`, `registration_number` | `isExporting` | `.xlsx` download |
| 7 | GET `get-subject-data` · `API_BASE1` | OCR → `fetchSubjectsForYearCycle` / `fetchAllSubjectsAcrossYearsAndCycles` (via `fetchSubjectsSmart`) | OCREvaluation mount; `refreshSubjects` (back to Home, after workspace delete) | `orgCode, custCode, yearCode, cycleCode, userCode` | `subjectcode, subjectname, subjectid, guidelinepath, status` | `subjects`, `selectedSubject`, `activeSubjectData`, `subjectsLoaded` | Breadcrumb label, empty-state schema warning |
| 8 | GET `get-year-data`, `get-cycle-data` · `API_BASE1` | OCR → `fetchAllSubjectsAcrossYearsAndCycles` | Fallback when sessionStorage has no year/cycle | none / `YearCode` | year/cycle codes | – | – |
| 9 | GET `get-config-info` · `VITE_AIMARKING_API_BASE` (fetch) | OCR → effect on `selectedWorkspace` (~L3146) | Every `selectedWorkspace` change | `OrgCode, CustCode=ICME, AppCode` | `[0].configSetting` | `apiConfig`, `workflowStages`, `standaloneMode`, localStorage | Columns, gates |
| 10 | GET `get-config-info` · same (fetch) | OCR → dialog-open effect (~L1102) | Create/Upload dialog opens | `OrgCode, CustCode=sessionStorage.customerCode, AppCode` | same | same + `isConfigLoadingForDialog` | "Loading workflow configuration…", upload policy |
| 11 | GET `list-workspace` · `API_BASE1` | OCR → `refreshWorkspaces` | Subjects loaded / subject change; back to list; Workspace ▼; after delete | `fromdate, todate, orgcode, custcode, usercode, SubjectCode` | `workspaceid, workspacename, createddate, filecount, totalsize, candidatecount, standardcount, totaltokenusage, usercode, status` | `workspaces`, `workspacesLoaded`, `isRefreshingWorkspaces` | Workspace cards, Workspace ▼ |
| 12 | GET `question-data` · `API_BASE1` | OCR → `refreshWorkspaces` (empty list) | `list-workspace` returned nothing | `OrgCode, CustCode, SubjectCode` | `ref1Data[]` or array length | `questionsEmpty` | "No questions found…" |
| 13 | GET `question-data` · `API_BASE1` | OCR → question-list effect (~L4506) | `selectedSubject` / `subjectsLoaded` | `OrgCode, CustCode, SubjectCode` | `questionLabel, marks, questionText[].{text, marks, rubric}, rubric` | `questions` (mock fallback), `questionsEmpty`, `questionListLoading` | Per-question popup, export Q columns |
| 14 | POST `delete-workspace` · `API_BASE1` | OCR → `handleConfirmDeleteWorkspace` | Delete Workspace → Confirm | `{ workspaceId: "id,id" }` | `status/responseCode/ResponseCode`, `message/responseMessage` | `isDeletingWorkspace`, list refresh | Delete dialog |
| 15 | POST `create-workspace` · `API_BASE1` | OCR → `createWorkspaceAsync`, `submitOcrWorkflow`, `submitEvaluationWorkflow`, Standalone Create & Extract | Create flows | `orgCode, custCode, userCode, subjectCode, workspaceId:0, workspaceName, candidateCount:0, standardCount (0/1)` | `status/sp_status/spStatus` (`S001`/`SUCCESS`/`F001`), `outWorkspaceId \| outworkspaceid \| workspaceId \| workspace_id`, `message` | `workspaceNameExistsError`, `sessionStorage.workspaceid` | Dialog banner/toasts |
| 16 | POST `save-candidate-info` · `API_BASE1` | OCR → same chains + Standalone Indexing ZIP | After create | `firstName, lastName, registrationNumber, centerName, centerAddress, subjectCode, orgCode, custCode, numberOfQuestions, scriptPath, dateOfExamination, countryName, workspaceId, folderName, userCode, isValid` | `status` (`S001`), `message` | – | step label |
| 17 | POST `upload-pdfs` · `API_BASE` (multipart) | OCR → `createWorkspaceAsync`, `uploadAddedFiles` | Segmentation/Indexing create & additional | `org_code, cust_code, usercode, subject_code, subject_name, number_of_questions, workspace_name, folder_name, workspace_id, config_data, [question_numbers], file[]` | HTTP status only | `firstUploadPdfsLoading`, `uploadCompletedFiles`, cooldowns | Upload overlay, Upload Error popup |
| 18 | POST `ocr-image` / `evaluate-text` · `API_BASE` | OCR → same functions as #17 | Only when no stage enables Segmentation/Indexing on those paths (edge case) | same as #17 | – | – | – |
| 19 | POST `upload-pngs` · `API_BASE` (multipart) | OCR → `submitOcrWorkflow`, Standalone Create & Extract | OCR image submit | `target_path, files[]` | HTTP 2xx | – | step label |
| 20 | POST `upload-audios` · `API_BASE` (multipart) | same | Audio submit | `target_path, files[]` | HTTP 2xx | – | step label |
| 21 | POST `transcribe-audio` · `API_BASE` | OCR → `submitOcrWorkflow` (background) | After audio rows are shown | `orgcode, custcode, usercode, registrationnumber, workspaceid, processdata.segment_data[{qid, image_path}], scriptpath, subjectcode` | HTTP 2xx | – | toast on failure |
| 22 | POST `AITranscription/extract` · `VITE_AIAPPS_API_BASE` (fetch, multipart) | `src/lib/extraction.ts` → `runExtraction` (from Create & Extract) | Standalone OCR-only, once per image | `subject='General', file, verify, interpret, line_mode, insertion_pass, strict_maths, q_filter` | per-file object: `transcription, transcription_latex, blocks, interpretation, issues, …`; `tokens` | `standaloneOcrStep` | button label |
| 23 | POST `save-ocr-data` · `API_BASE` | OCR → `submitOcrWorkflow`, `submitEvaluationWorkflow`, Standalone Create & Extract | After upload / text entry | `custcode, orgcode, usercode, registrationnumber, workspaceid, ocrdata{summary, ocr_extracted_text, standards_evaluation}, [scriptpath], [remainingcount, totalcandidatecount]` | HTTP 2xx; Evaluation chain checks `S001`/`S002` | – | step label |
| 24 | POST `recalculate-standards` · `API_BASE` | OCR → `postRecalculateStandards` (from #23 chains; skipped in Standalone OCR-only) | After save-ocr-data | `orgcode, custcode, usercode, isall, registrationnumber, subjectcode, workspaceid, questions, userprompt, processdata` (with `isall=0` the questions are filtered to those with images; nothing is sent if none remain) | HTTP 2xx | – | "Running ..." / "Recalculating standards..." |
| 25 | POST `run-evaluation` · `API_BASE` | OCR → `submitEvaluationWorkflow`; `handleRunEvaluation` (Rerun) | Evaluation-only submit; Rerun button (`markingStatus 4`) | `orgcode, custcode, usercode, isall:1, registrationnumber, subjectcode, workspaceid, questions:[], userprompt:''` | HTTP 2xx | `runningEvalCandidates` | Rerun button |
| 26 | GET `candidate-process-data` · `API_BASE1` | OCR → `loadCandidatesForWorkspace`, `ensureCandidateIsNew`, submit chains | Open workspace, poll (30 s), after uploads, duplicate check | `OrgCode, CustCode, UserCode, SubjectCode, WorkspaceId` | `summary[]`, `details[]` (see [user-candidate-table.md §2](./user-candidate-table.md#2-data-load-loadcandidatesforworkspace)) | `candidates`, `selectedWorkspace`, `hasUploaded` | Table, widgets |
| 27 | GET `get-candidate-info` · `API_BASE1` | OCR → `openCandidateDetails` | Candidate-number click | `registrationnumber, workspaceid` | `firstName, lastName, centerName, centerAddress, dateOfExamination, countryName` | `candidateInfoDetails`, `candidateInfoLoading` | Candidate Details dialog |
| 28 | POST `delete-candidate` · `API_BASE1` | OCR → `confirmDeleteSelectedCandidates` | Delete → Confirm | `orgcode, custcode, usercode, workspaceid, subject_id, registrationnumber ("a,b")` | `success` / HTTP 200 | `candidates`, `selectedWorkspace.candidateCount` | Delete dialog |
| 29 | POST `run-ocr` · `API_BASE` | OCR → `handleRunOcr` | Rerun (`ocrStatus 4`) | `orgcode, custcode, usercode, subjectcode, workspaceid, regnumber` | – | `runningOcrCandidates`, `pageLoading` | Rerun button |
| 30 | GET `get-process-data` · `API_BASE1` | OCR → `handleRunEvaluation` | Rerun Evaluation | `orgcode, custcode, usercode, type:2, registernumber, subjectcode, workspaceid, adstatus:0` | `data[0].processdata.ocr_extracted_text` (built into an array that is not sent) | – | – |
| 31 | GET `get-all-data-exports` · `API_BASE1` | OCR → Download `onClick` (~L9529) | Download | `OrgCode, CustCode, SubjectCode, WorkspaceId, PageNumber` | `data[]`: `registrationnumber, candidateid, workspacename, activestage, indexingdata, ocrdata, evaluationdata, totalcount` | `downloadExportLoading` | `.xlsx` download |
| 32 | POST `evaluate-text` · `API_BASE` | OCR → `handleManualEvaluation` | **Unreachable** (see [create doc §6](./user-create-workspace-and-upload.md#6-unreachable-or-legacy-paths-present-in-source)) | `org_code, cust_code, subject_code, subject_name, workspace_name, workspace_id:9999, folder_name, questions[{qid,text}]` | raw | `manualEvalResult` | – |

SD = `SubjectDashboard.tsx`, OCR = `OCREvaluation.tsx`.

## Error handling per API

Envelope codes seen in this scope: **S001** = created/success, **S002** = updated (accepted only by the Evaluation chain's `save-ocr-data`), **F001** = workspace name already exists (`create-workspace`). `assertStepSucceeded(res, msg, codes=['S001'])` (~L2593) accepts a response with no `status`/`statusCode` field, and otherwise throws `data.message || msg`.

| API | HTTP error | Empty data | Envelope handling | User feedback |
|---|---|---|---|---|
| get-year/cycle/subject-data (SD) | Mock fallback (flag on); else error state + toast | Mock fallback (flag on) | – | console warn; "Failed to load years/cycles/subjects. Please try again." (flag off) |
| list-workspace (SD) | console only | total 0 | – | – |
| get-config-info (SD) | Student Export hidden | hidden | – | – |
| student-export | toast | toast | – | "No data found for this register number." / "An error occurred during export." / "Export successful!" |
| get-subject-data (OCR) | toast (initial load only) | keeps placeholder list | – | "Failed to load subjects" |
| get-config-info (OCR) | console only | ignored (keeps cached stages) | – | – |
| list-workspace (OCR) | toast unless silent; aborts ignored | `workspaces=[]` + question-data probe | – | "Failed to load workspaces" |
| question-data | `questions` = mock list (popup/export then use mock questions) | mock list, `questionsEmpty=true` | – | empty-state message on the list |
| delete-workspace | toast | – | `S001`/`success` → success, else server message | "Workspace(s) "…" deleted successfully" / "Cannot delete workspace(s) "…"." / "An error occurred while deleting…" |
| create-workspace (`createWorkspaceAsync`) | toast | – | `F001` → banner; not `SUCCESS`/`S001` → toast | "Workspace name already exists. Please provide another name." / "Failed to create workspace. Please try again." |
| create-workspace (OCR/Eval chains) | toast with server message | – | `assertStepSucceeded` `['S001']` | server message / "Failed to create workspace" / "Workspace id missing from the create-workspace response" |
| create-workspace (Standalone Create & Extract) | toast | – | **none**; only `outWorkspaceId` required | "Workspace ID missing from response" |
| save-candidate-info | toast | – | `S001` (chains, Standalone Indexing); **unchecked** in Standalone Create & Extract | server message / "Failed to save candidate information" |
| upload-pdfs | Upload Error popup | – | – | "Please upload correct data" (400/404/413/Network Error) / "Failed to upload batch. Please try again." |
| upload-pngs / upload-audios | toast | – | HTTP 2xx only | "Failed to upload images/audio files" |
| transcribe-audio | toast (background) | – | HTTP 2xx | server message / "Failed to transcribe the audio" |
| AITranscription/extract | toast (`payload.detail`) | fields default to empty | – | "Extraction request failed." / CORS message |
| save-ocr-data | toast | – | HTTP 2xx (OCR & Standalone); `S001`/`S002` (Evaluation) | "Failed to save OCR data" |
| recalculate-standards | toast | null response when no questions qualify (`isall=0` only) | HTTP 2xx | "Failed to run evaluation" (OCR chain label) / "Failed to recalculate standards" |
| run-evaluation | toast | – | HTTP 2xx | "Failed to run evaluation" / "Failed to trigger evaluation for <reg>. Please try again." |
| candidate-process-data (table) | non-silent: toast + mock candidates; silent: console | "Candidate answer scripts getting uploaded." | – | "Failed to load candidate data, showing sample data instead" |
| candidate-process-data (duplicate check) | toast, blocks | treated as no duplicate | – | "Unable to verify the candidate right now. Please try again." / "Candidate already exists…" |
| get-candidate-info | fields "N/A" | fields "N/A" | – | – |
| delete-candidate | toast | – | `success` or HTTP 200 → success (body not checked) | "Successfully deleted" / "Failed to delete candidates" |
| run-ocr | toast | – | – | "OCR triggered for <reg>" / "Failed to trigger OCR for <reg>. Please try again." |
| get-all-data-exports | toast | toast | – | "No data available to export" / "No evaluation data available to export" / "Downloaded …" |

No global axios interceptor was found in these files. Each call handles its own errors as above.
