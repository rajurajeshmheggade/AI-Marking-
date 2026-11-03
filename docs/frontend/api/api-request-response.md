# API Request / Response Reference

Field-level shapes for every endpoint in [api-integration-mapping.md](./api-integration-mapping.md) (same IDs). The backend contracts are not available in this repository; everything here is derived from what the frontend **sends** and what it **reads**. Fields the backend may return but the frontend ignores are not listed.

Legend for the "Use" column:

| Mark | Meaning |
|---|---|
| **UI** | Read and shown or used to drive UI state |
| **logic** | Read and used in control flow (gating, next request) but not displayed |
| **echo** | Read only to be sent back in a later request |
| **sent** | Request field with a clear purpose |
| **sent (?)** | Sent, but its meaning cannot be determined from the frontend source (constant value, or never explained) |

Common request fields used across many endpoints (not repeated in each table):

| Field (casing varies) | Source | Default when missing |
|---|---|---|
| `orgCode` / `OrgCode` / `orgcode` / `org_code` | `sessionStorage.orgCode` → `orgcode` (or `getFinalCodes()` / override prop in OCREvaluation) | `'ICME01'` (OCR), `'ICMELIVE'` (some OCR config fetches, `student-export`) |
| `custCode` / `CustCode` / `custcode` / `cust_code` | literal | `'ICME'` |
| `userCode` / `UserCode` / `usercode` | `sessionStorage.userCode` → `usercode` | `'icmeuer01'` or `'ICME1'` |
| `subjectCode` / `SubjectCode` / `subjectcode` / `subject_code` | `resolveSubjectCode()` (sessionStorage `subjectcode` …) | `'generic'` in Standalone Mode; else `'S1'` / `'1'` |
| `workspaceid` / `WorkspaceId` / `workspaceId` / `workspace_id` | `selectedWorkspace.id` → `sessionStorage.workspaceid` | `0` |

---

## AI Marking API (`API_BASE1`)

### M01 login

Request (JSON):

| Field | Use |
|---|---|
| `username` | sent (trimmed) |
| `password` | sent (trimmed, plain text over HTTPS) |

Response:

| Field | Use |
|---|---|
| `statusCode` (new) / `status` (old) | logic — `S001` success, `F001` invalid credentials |
| `userData[]` (new) / `data[]` (old) | logic — must be non-empty |
| `[0].usercode` / `userCode` | UI/logic — stored, sent on later calls |
| `[0].organizationcode` / `orgCode` | logic — stored, org scope |
| `[0].customercode` / `customerCode` | logic — must be `ICME` |
| `[0].userrole` / `userRole` | logic — routing and UI trimming |
| `[0].username` | UI — display name |
| `[0].active` (`Active`, `isActive`, …) | logic — `0` not yet active, `2`/`inactive`/… blocked |
| `message` | UI — error text |

### M02 get-config-info

Request query: `OrgCode`, `CustCode`, `AppCode=AImarking` (SD also `_t=<timestamp>` for cache busting).

Response: `[ { configSetting: {...} } ]` (some callers also accept `{ value: [...] }`, `{ Data: [...] }` or the object itself).

| `configSetting` field | Use | Readers |
|---|---|---|
| `workflowStages.{segmentation, indexing, ocr, evaluation}` (bool) | UI/logic | Login, SD, OCR, S&Q, CS |
| `standalone` (bool) | logic | Login, OCR, CS |
| `segmentationConfig.CandidateInfo` (bool) | UI — candidate-number link enabled | OCR, CS |
| `ocrConfig.StandardsMetCount`, `MetadataPresent`, `QuestionNumberExtraction` (bool) | UI | OCR (Standards chip, question-number input), CS |
| `ocrConfig.subjectOverrides[]` `{ subjectCode, …same keys }` | UI | CS, OCR (`QuestionNumberExtraction`) |
| `indexingConfig.type` (`flexible`/`predefined`), `predefinedSettings.{maxQuestions, maxImages, imageFormat, mapping}` | UI | CS; OCR reads `maxQuestions` for the Standalone question count |
| `evaluationConfig.globalThresholds.{passMarkThreshold, topQuestionsCount, selectedPrompt, liveEvaluationAgentEnabled}` | UI | OCR (score colour, Top-N total), CS |
| `evaluationConfig.subjectOverrides[]` | UI | OCR, CS |
| `OrgCode`, `CustCode` (inside `configSetting`) | sent (?) on save; not read | – |

`topQuestionsCount` is a string such as `"4/8"`; OCREvaluation uses the integer before `/`.

### M03 save-config-info

Request (JSON, `Content-Type: application/json`):

```jsonc
{
  "orgCode": "<org code>",
  "custCode": "<selected customer>",
  "appCode": "AImarking",
  "configSetting": {
    "OrgCode": "<org code>",
    "CustCode": "<selected customer>",
    "workflowStages": { "segmentation": true, "indexing": false, "ocr": true, "evaluation": true },
    "standalone": false,
    "segmentationConfig": { "CandidateInfo": true },                     // only if segmentation || indexing
    "ocrConfig": {                                                       // only if ocr
      "StandardsMetCount": true, "MetadataPresent": false, "QuestionNumberExtraction": false,
      "subjectOverrides": [ { "subjectCode": "...", "StandardsMetCount": false } ]
    },
    "indexingConfig": {                                                  // only if indexing
      "type": "flexible",
      "predefinedSettings": { "maxQuestions": 1, "maxImages": 1, "imageFormat": "png", "mapping": { "q1": [2, 3] } }
    },
    "evaluationConfig": {                                                // only if evaluation
      "globalThresholds": { "passMarkThreshold": 40, "selectedPrompt": "generic", "topQuestionsCount": "5", "liveEvaluationAgentEnabled": false },
      "subjectOverrides": [ { "subjectCode": "...", "passMarkThreshold": 50 } ]
    }
  }
}
```

A setting of a disabled stage is omitted, not sent as `false`. `subjectOverrides` lists only subjects that have at least one subject-level localStorage key. Full assembly rules: [../admin/admin-configuration.md — Request](../admin/admin-configuration.md#request).

Response: `code` or `status` (`s001` saved / `s002` updated, compared in lower case only) and `message` — **UI** (toast text).

### M04 get-year-data / M05 get-cycle-data

| Endpoint | Request | Response field | Use |
|---|---|---|---|
| M04 | none | `yearid`/`yearId` | logic (key) |
| | | `yearname`/`yearName` | UI — option label |
| | | `yearcode`/`yearCode` | logic — selection value, sent to M05/M06, stored as `sessionStorage.yearcode` |
| M05 | `YearCode` (sent) | `cycleid` | logic |
| | | `cyclename` | UI — cycle card / option label |
| | | `cyclecode` | logic — sent to M06, stored as `sessionStorage.cyclecode` |

### M06 get-subject-data

Request query: `orgCode`, `custCode`, `yearCode`, `cycleCode` — sent; `userCode` — sent (?) (it is unclear from the frontend whether the backend filters by user).

| Response field | Use |
|---|---|
| `subjectcode` | logic — selection value, `sessionStorage.subjectcode` |
| `subjectname` | UI — card / table / option label |
| `subjectid` | logic |
| `workspacecount` | UI — "n Workspaces" on cards, S&Q table |
| `status` (1 active) | UI/logic — S&Q STATUS badge; OCR keeps only `status === 1` |
| `guidelinepath` | UI/logic — "Mark schema not uploaded" warning; MS cards; activation guard |
| `kbpath` | not used by live UI |
| `isReady` | UI — S&Q table readiness |

### M07 organization-details / M08 customer-details

| Endpoint | Request | Response | Use |
|---|---|---|---|
| M07 | `CustCode` | `data[].organizationid`, `organizationname`, `organizationcode` | UI — Organization select (label name, value code; RM uses the **name** as `OrgCode` for M15) |
| M08 | none | `data[].customercode`, `customername` | UI — Customer selects |

### M09 import-subject-data-v2 (multipart)

| Field | Use |
|---|---|
| `File` | sent — the CSV/XLSX selected |
| `IsType` | sent — `0` (subject import). The code maps `questions` → `1`, but nothing ever switches the import tab, so `0` is always sent |
| `OrgCode`, `YearCode`, `CycleCode` | sent |

Response: `status` (`S001` added / `S002` updated / `F*` failure) — logic; `message` — UI.

### M10 question-data

Request query: `OrgCode`, `CustCode`, `SubjectCode`.

| Response field | Use |
|---|---|
| top-level array or `ref1Data[]` | logic — length decides `questionsEmpty` |
| `questionLabel` | UI — question label in popups / export columns |
| `marks` / `totalMarks` | UI — max marks |
| `questionText[].text`, `.marks` | UI — preview / info popup |
| `questionText[].rubric[] {text, score}`, `rubric` | UI — rubric display |

### M11 delete-subject / M12 update-subject-data / M13 save-questions

| Endpoint | Request (JSON) | Response | Use |
|---|---|---|---|
| M11 | `subjectCode, orgCode, yearCode, cycleCode` | `status`, `message` | `S001` → success; else message shown |
| M12 | `subjectCode, isActive, orgCode` | – | Not read |
| M13 | `custcode, orgcode, subjectCode, questions:[{ questionLabel, questionText[], marks }]` | – | Not read |

### M14 get-marking-scheme

Request query: `OrgCode` (session org, not the selected one), `CustCode`, `SubjectCode`, `FilePath` (the subject's `guidelinepath`). Response: `content` or the raw body (markdown) — **UI** (View scheme dialog).

### M15 get-user-details

Request query: `UserCode` — sent (?) (the logged-in user; purpose not evident); `OrgCode` — **organization name**; `CustCode`.

Response `userDetails[]` (UI — Users table): `usercode`, `userid`, `customercode`, `organizationcode`, `organizationname`, `username`, `fromdate`, `todate`, `active`/`activestatus`, `userrole`, `firstname`, `lastname`, `gmail`/`email`/`emailid`, `contact_number`/…, `password_hash`/`passwordHash`/`password` (pre-fills the Edit modal), `address`. Mapping: [../admin/admin-user-management.md](../admin/admin-user-management.md#row-mapping-l6597).

### M16 create-user

| Field | Use |
|---|---|
| `userId` | sent — `0` create, row `userid` edit |
| `organizationId` | sent — the organization **name** despite the field name |
| `customerCode`, `firstName`, `lastName`, `email`, `contactNumber`, `address`, `loginName`, `userCode`, `fromDate`, `toDate` | sent |
| `passwordHash` | sent — the plain password typed in the form (not hashed client-side). Create: code falls back to the literal `'defaultPass123'` when empty (`handleCreate` ~L6915), but validation (~L6843) already requires a password, so the fallback is not reached; edit: `undefined` when empty (~L6809) |
| `userRole` | sent — always `'User'` |
| `isSSO` | sent (?) — always `0` |

Response: `status` / `errorCode` / `errorcode` (`E001` login exists) — logic; `message` / `Message` — UI.

### M17 delete-user

Request: `custCode, orgCode, loginName`. Response: `statusCode`/`status` (`S001`) — logic; `message` — UI.

### M18 list-workspace

| Request field | Use |
|---|---|
| `fromdate` | sent — `sessionStorage.fromdate` or the constant `2024-12-01` |
| `todate` | sent — today |
| `orgcode`, `custcode`, `usercode` | sent |
| `SubjectCode` (OCR) / `subject_code=''` (SD) | sent — two different parameter names for the same endpoint |

| Response field | Use |
|---|---|
| `workspaceid` (+ variants) | logic — selection, `sessionStorage.workspaceid` |
| `workspacename` | UI — card title, Workspace ▼ |
| `createddate` | UI — "Created: …"; sort key |
| `candidatecount` | UI — count, status pill, delete eligibility |
| `standardcount` | UI — `1` = audio workspace icon / upload mode |
| `totaltokenusage` | UI — header token count |
| `usercode` / `createdby` | logic — ownership |
| `status` (0 active, 1 completed) | UI — status pill |
| `filecount`, `totalsize` | logic — stored on the workspace object |

### M19 create-workspace

| Request field | Use |
|---|---|
| `orgCode`, `custCode`, `userCode`, `subjectCode`, `workspaceName` | sent |
| `workspaceId` | sent — always `0` (create) |
| `candidateCount` | sent (?) — always `0` |
| `standardCount` | sent — `1` for an audio workspace, else `0` |

| Response field | Use |
|---|---|
| `status` / `sp_status` / `spStatus` | logic — `S001`/`SUCCESS` ok, `F001` name exists |
| `outWorkspaceId` / `workspaceId` / `workspace_id` | logic — id for the following steps |
| `message` | UI — error toast |

### M20 delete-workspace

Request: `{ workspaceId: "<id>,<id>" }` (comma-separated string). Response: `status` / `responseCode` / `ResponseCode` (`S001` or `success`), `message` / `responseMessage` — UI.

### M21 save-candidate-info

| Field | Use |
|---|---|
| `registrationNumber`, `workspaceId`, `subjectCode`, `orgCode`, `custCode`, `userCode`, `folderName` | sent |
| `scriptPath` | sent — repository path built by `buildCandidateScriptPath(cust, org, subjectName, workspaceName, folder)` |
| `firstName`, `lastName`, `centerName`, `centerAddress`, `dateOfExamination`, `countryName` | sent — usually `'N/A'` (the UI has a candidate-name field only in the per-question flows) |
| `numberOfQuestions` | sent (?) — `0` in the Standalone ZIP path |
| `isValid` | sent (?) — `0` |

Response: `status` (`S001`) — logic; `message` — UI on failure.

### M22 candidate-process-data

Request query: `OrgCode`, `CustCode`, `UserCode`, `SubjectCode`, `WorkspaceId`.

Response `{ summary: [...], details: [...] }`:

| `summary[]` field | Use |
|---|---|
| `userCode` / `usercode` / `UserCode` / `createdby` / `createdBy` (first row) | logic — workspace owner → `isUserCodeMismatch` |
| `folderName` / `foldername` | UI — folder grouping |
| `candidateCount`, `totalCandidateCount` | UI — folder counts |
| `totalTokenUsage` | UI — header token count |

| `details[]` field | Use |
|---|---|
| `registrationNumber` | UI — row id / candidate number |
| `segmentationStatus`, `approvedStatus`, `ocrStatus`, `markingStatus` | UI — phase badges (0/1/2/3/4 mapped by `mapStatusCodeToPhaseStatus`: 3 = pending approval, 2 = completed, 4 = failed → Rerun) |
| `obtainedScore` / `obtainedscore` / `score` / `final_score.obtained_score` / `finalscore` | UI — score chip |
| `maxScore` / `maxscore` / `final_score.max_score` | UI — score chip |
| `processData` / `processdata` | logic — fallback for `final_score` |
| `standardCount`, `metStandardCount` | UI — standards chip |
| `isReview`, `noqMarker`, `multiqMarker` | UI — markers, Quick Approve eligibility |
| `folderName` | UI — row category |
| `userCode` | logic — row selectability |

Status code meanings: [../user/user-candidate-table.md §3](../user/user-candidate-table.md#3-status-mapping).

### M23 get-candidate-info

Request: `registrationnumber`, `workspaceid`. Response (array or `data[]`), first row:

| Field | Use |
|---|---|
| `firstName`, `lastName`, `registrationNumber`, `centerName`/`centreName`, `centerAddress`, `dateOfExamination`, `countryName` | UI — Candidate Details dialog (`N/A` when missing) |
| `scriptPath` / `scriptpath` | logic — base for page-image probing (Segmentation-only review) |

### M24 delete-candidate

Request: `orgcode, custcode, usercode, workspaceid, subject_id` (the subject **code**), `registrationnumber` (comma-separated). Response: `success` (or HTTP 200) — logic.

### M25 get-process-data

Request query:

| Field | Use |
|---|---|
| `type` | sent — `1` segmentation/indexing, `2` OCR, `3` evaluation |
| `registernumber` | sent — candidate registration number |
| `orgcode`, `custcode`, `usercode`, `subjectcode`, `workspaceid` | sent |
| `adstatus` | sent — always `0`; source comment: "0 = normal flow, 1 = quick approve flow" |

Response envelope (all types):

```jsonc
{
  "data": [
    {
      "candidateId": 123,            // echo (ocrSaveMeta / evaluationSaveMeta)
      "workspaceid": 45,             // echo
      "remainingCount": 3,           // echo → save-ocr-data.remainingcount
      "totalCandidateCount": 10,     // echo → save-ocr-data.totalcandidatecount
      "scriptPath": "ICME/…/REG001", // echo → save-ocr-data.scriptpath
      "processData": { ... }         // or "processdata"
    }
  ]
}
```

If `data[]` is missing, the whole body is treated as `processData`. Both camelCase and lower-case envelope keys are accepted.

`processData` fields by type:

| Field | Type | Use |
|---|---|---|
| `segment_data[] {qid, image_path[], segment_id}` (new) / `segmentdata[] {Qid, imagepath, segmentid}` (legacy) | 1 (also present in 2/3) | UI — question → page mapping |
| `blank_pages[]`, `noqMarker[]`, `pages_to_review[]` (strings or `{path}`) | 1 | UI — blank / review page lists |
| `auto_mapped_pages`, `total_pages`, `status`, `questions_answered`, `unanswered_questions[]`, `registration_number` | 1 | UI — counters, "Not answered" |
| `ocr_extracted_text` `{ "<qid>": { "<rawImagePath>": string \| ExtractionResult } }` | 2 | UI — OCR text per question per page (rich objects: only `transcription` is displayed) |
| `standards_evaluation` `{ "<qid>": { marks_awarded, standards_met: { standard_n: { marks, reason } } } }` | 2 | UI — Standards credits panel |
| `summary` (object) | 2 | echo — sent back in `save-ocr-data` |
| `eval_data` `{ "<qkey>": { marks_awarded, marks_max, extracted_text, key_points_covered, missing_points[], feedback, subquestion_evaluations, manual_marking } }` | 3 | UI — Evaluation Preview |
| `all_questions_ranked[] {…, manual_marking}` | 3 | UI/echo — merged into eval map; source of `questiondetails` |
| `final_score.{obtained_score, max_score}` | 3 | UI — header score |

Field-by-field UI mapping: [../user/user-ocr-review.md](../user/user-ocr-review.md) · [../user/user-evaluation-review.md](../user/user-evaluation-review.md) · [../user/user-segmentation-indexing-review.md](../user/user-segmentation-indexing-review.md).

### M26 get-all-data-exports

Request query: `OrgCode`, `CustCode`, `SubjectCode`, `WorkspaceId`, `PageNumber` (0-based).

Response `data[]` (one record per candidate):

| Field | Format | Use |
|---|---|---|
| `registrationnumber` | string | UI — row key; selection filter |
| `candidateid` | number | fallback for `registrationnumber` |
| `workspacename` | string | UI — sheet column |
| `activestage` | `"indexing"` \| `"ocr"` \| `"evaluation"` | UI — "Stage" column |
| `indexingdata` | **JSON string** (or object / null) | UI — parsed with `JSON.parse`; parse failure → `null` |
| `ocrdata` | **JSON string** (or object / null) | UI |
| `evaluationdata` | **JSON string** (or object / null) | UI — scores, feedback columns |
| `totalcount` | number (on each row; read from the first row of each page) | logic — stops paging |

### M27 student-export

Request query (not URL-encoded): `CustCode`, `OrgCode`, `RegistrationNumber`.

| Response field | Use |
|---|---|
| `candidateData[].subjectname` | UI — sheet rows |
| `candidateData[].workspacename` / `workspace_name` / `workspaceid` | UI |
| `candidateData[].processdata` | **JSON string** → `eval_data[q].marks_awarded`, `missing_points[].how_to_improve`, `feedback`, `final_score.obtained_score` — UI |
| `registration_number` | UI |

---

## ICME OCR / processing API (`API_BASE`)

### P01 upload-pdfs (multipart, batched)

| Field | Use |
|---|---|
| `org_code`, `cust_code`, `usercode`, `subject_code`, `subject_name`, `workspace_name`, `workspace_id` | sent |
| `folder_name` | sent — ZIP name / folder name / candidate name in the per-question flow |
| `number_of_questions` | sent (?) — always `'0'` |
| `config_data` | sent — `JSON.stringify(apiConfig \|\| { workflowStages })` |
| `question_numbers` | sent — only when OCR + Question Number Extraction is on and the field is filled |
| `file` (repeated) | sent — PDFs, images or a single ZIP |

Response: HTTP status only.

### P02 upload-pngs / P03 upload-audios (multipart)

`target_path` (repository folder for the candidate) and `files` (repeated). Response: HTTP status only.

### P04 transcribe-audio

```jsonc
{ "orgcode": "", "custcode": "ICME", "usercode": "", "registrationnumber": "", "workspaceid": 0,
  "processdata": { "segment_data": [ { "qid": "1", "image_path": ["<audio path>"] } ] },
  "scriptpath": "", "subjectcode": "" }
```

Response: HTTP status only.

**Video only**: `submitOcrWorkflow`'s `persistAudioTranscription` does not call this endpoint for video (`standaloneUploadMode === 'video'`) — reading the saved record back afterwards showed an empty `ocr_extracted_text`. Instead each uploaded video file is sent directly, one request per file, to `transcribeAudioDirect` (`${VITE_VIDEO_TRANSCRIBE_API_BASE}/transcribe`, default `http://127.0.0.1:8002/v1/transcribe` — a local transcription service, not a public host; multipart `file`, `language` (`VITE_VIDEO_TRANSCRIBE_LANGUAGE`, default `en`), `diarization:'true'`, `keyterms:''`). The frontend then builds `ocr_extracted_text` from its response — per path, `{ text, segments }` (`VideoTranscriptionResult`: `segments` is the response's own speaker-diarized array of `{text, start, end, confidence, speaker, words}`, kept as-is) rather than a plain string — and calls **P05 save-ocr-data** (below), followed by a `candidate-process-data` re-fetch so the table/preview pick up the transcript.

### P05 save-ocr-data

```jsonc
{
  "custcode": "ICME", "orgcode": "", "usercode": "", "registrationnumber": "", "workspaceid": 0,
  "ocrdata": {
    "summary": { },                                                // echo from type 2
    "ocr_extracted_text": { "<qid>": { "<rawImagePath>": "text or ExtractionResult" } },
    // Video: value is `{ text, segments }` (VideoTranscriptionResult) instead — see
    // the P04 note above.
    "standards_evaluation": { }                                   // echo from type 2
  },
  "scriptpath": "…",              // optional (echo)
  "remainingcount": 3,            // optional (echo)
  "totalcandidatecount": 10       // optional (echo)
}
```

Response: HTTP status; only the Evaluation-only create chain reads `status` (`S001`/`S002`).

### P06 recalculate-standards

| Field | Use |
|---|---|
| `isall` | sent — `0` only the changed questions that have images, `1` all |
| `questions[]` | sent — question ids (filtered when `isall=0`) |
| `processdata` | sent — the `ocrdata` object just saved |
| `userprompt` | sent (?) — always `''` |
| codes, `registrationnumber`, `subjectcode`, `workspaceid` | sent |

### P07 run-evaluation

| Field | Use |
|---|---|
| `isall` | sent — `1` all questions, `0` one question |
| `questions` | sent — `[]` or `[qid]` |
| `userprompt` | sent — re-evaluation dialog text; `''` elsewhere |
| codes, `registrationnumber`, `subjectcode`, `workspaceid` | sent |

### P08 run-ocr

`orgcode, custcode, usercode, subjectcode, workspaceid, regnumber` (note `regnumber`, not `registrationnumber`). Response not read.

### P09 save-indexing-info

| Field | Use |
|---|---|
| `type` | sent — `1` |
| `indexdata.segment_data[] {qid, image_path[], segment_id:[0]}` | sent — the edited mapping; `segment_id` is always `[0]` — sent (?) |
| `indexdata.blank_pages`, `pages_to_review`, `total_pages`, `total_questions`, `auto_mapped_pages`, `questions_answered`, `unanswered_questions` | sent |
| `indexdata.status` | sent — `'completed'` |
| `indexdata.is_update` | sent (?) — `0` |
| `metstandardcount`, `is_review` | sent (?) |
| codes, `registrationnumber`, `subjectcode`, `workspaceid` | sent |

### P10 save-evaluation-data

| Field | Use |
|---|---|
| `obtainedscore` | sent — Top-N total after the edit |
| `maxscore` | sent — `final_score.max_score` (cleanup) or the question max (score save) |
| `evaluateddata` | sent — the type 3 `processData` with updated `eval_data[q].marks_awarded`, `rank`, `manual_marking`, `final_score.obtained_score` |
| `questiondetails[] {Qid, maxscore, obtainedscore, rank}` | sent |
| `manual_marking` | sent — `"Previous marks: x Updated marks: y Comment: …"` (score save only) |
| codes, `registrationnumber`, `subjectcode`, `workspaceid` | sent |

### P11 update-status

`{ registrationnumber, workspaceid, type, status }` — `type` 1/2/3 = stage, `status` 1 = approved. `status: 2` (only in unreachable `handleRestartEvaluation`) — sent (?). Response not read.

### P12 upload-marking-scheme / P13 convert-markscheme-to-md

| Endpoint | Request | Response |
|---|---|---|
| P12 | multipart `orgcode`, `custcode`, `subjectcode`, `file` (`.md`) | not read |
| P13 | multipart `file` (Word/PDF) | markdown as a string, or `{ content }`, or `{ markdown }` — UI (preview) |

---

## AI Apps

### X01 /AITranscription/extract

Request (multipart):

| Field | Value sent | Use |
|---|---|---|
| `subject` | `'General'` (Create & Extract) | sent |
| `file` | page image | sent |
| `verify`, `interpret`, `line_mode`, `insertion_pass` | `"true"` (defaults) | sent |
| `strict_maths` | `"false"` | sent |
| `q_filter` | `""` | sent |

Response — page fields are nested under a key named after the uploaded file; only `tokens` (and `allowed_subjects`) are top-level:

```jsonc
{
  "page_1.png": {
    "subject": "General",
    "blocks": ["…"],
    "transcription": "…",          // UI — saved as OCR text, shown in the Standalone popup
    "transcription_latex": "…",
    "interpretation": "…",
    "issues": [],
    "insertions_placed": 0,
    "figure_counts": { "graph": 0, "diagram": 0, "table": 0 }
  },
  "tokens": { "input": 0, "output": 0, "thinking": 0, "total": 0, "calls": 0 },
  "allowed_subjects": ["…"]
}
```

`runExtraction` looks up `payload[file.name]`, else the first non-array object value that is not `tokens`/`allowed_subjects`/`detail`, else the payload itself. Errors use `detail`.

### X02–X04 registration

| Endpoint | Request | Response |
|---|---|---|
| X02 signup | `firstname, lastname, email, contactnumber, activationDateFrom, activationDateTo, orgname, username, password, createdBy:'', userID:0` | `status` (`S001`, `FL001`, `O001`, `LO001`, `EM001`), `message`, `data` |
| X03 send-email | `to, subject, body` (HTML) | `status === 'success'` |
| X04 updateActiveRegisteredUser | `username, email` | not read |

All three are unreachable from the UI; see [../pages/register-page.md](../pages/register-page.md).
