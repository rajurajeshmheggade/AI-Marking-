# Create Workspace and Upload

One dialog in `src/pages/OCREvaluation.tsx` (`<Dialog open={showCreateWorkspaceDialog}>`, ~L10829–12144) serves both **Create New Workspace** and **Upload Additional Files** (`isAdditionalUploadMode`). What it renders and which API chain the primary button starts depend on the configured workflow stages, Standalone Mode and the Image/Audio choice. OCR and Evaluation inputs are collected in a second dialog, the **per-question popup** (~L17064).

- Opened from: workspace list → **Create New Workspace** ([user-workspaces.md §6.3](./user-workspaces.md#63-toolbar)); inside a workspace → **Upload Additional Files** ([user-workspaces.md §7](./user-workspaces.md#7-selecting-a-workspace))
- APIs: see [user-api-mapping-workspace.md](./user-api-mapping-workspace.md)

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-create-workspace-segmentation.png — Create New Workspace dialog for a Segmentation configuration (PDF/ZIP dropzone, subject confirmation)]
[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-create-workspace-ocr.png — Create dialog for OCR with Image/Audio toggle and Candidate Name]
[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-question-flow-popup.png — Per-question popup (Upload Images per Question)]
[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-standalone-create-extract.png — Standalone OCR-only dialog with 1–3 image picker and Create & Extract button]

## 1. Inputs that drive the dialog

| Derived value | Definition | Line |
|---|---|---|
| `workflowStages` | Raw stage flags from config / localStorage | ~L2135 |
| `effectiveWorkflowStages` | `standaloneMode ? {...workflowStages, evaluation:false} : workflowStages` | ~L2155 |
| `uploadPolicy` | `getUploadPolicy(effectiveWorkflowStages)`: the first enabled stage in pipeline order wins | ~L610, ~L2162 |
| `supportsAudioUpload` | `effective.ocr && !effective.segmentation && !effective.indexing` | ~L2202 |
| `questionFlowMode` | `'images'` if Audio is chosen and supported and not standalone; else `null` if raw `segmentation \|\| indexing`; else `'images'` if raw `ocr`; else `'text'` if raw `evaluation`; else `null` | ~L2413 |
| `isStandaloneOcrOnly` (button handler) | `localStorage.standalone_mode==='1'` and effective stages = OCR only | ~L11850 |
| `isStandaloneIndexingOnly` | `standaloneMode` and effective stages = Indexing only | ~L2187 |
| `isQNumExtractionEnabled` | `apiConfig.ocrConfig.QuestionNumberExtraction === true`, else localStorage `org_ocr_qnum_<org>_<subject>` / `org_ocr_qnum_<org>` | ~L3838 |

### 1.1 Upload policy (`getUploadPolicy`)

| First enabled (effective) stage | `mode` | `accept` | Loose files allowed | ZIP allowed / content | Folder | Hint text |
|---|---|---|---|---|---|---|
| Segmentation | files | `.pdf,.zip` | pdf | yes / pdf only | yes | "Supports PDF files, ZIP archives, or folders containing PDFs" |
| Indexing | files | `.zip` | none | yes / png, jpg only | no | "Supports a ZIP archive containing Folder(s) -> PNG and JPG images only" |
| OCR | files | `.png,.jpg ` | png, jpg | no | no | "Supports single or multiple PNG, JPG image(s)" |
| Evaluation | text | – | – | – | – | "Paste the OCR extracted text that needs to be evaluated" |
| none | files | `.pdf,.zip` | pdf | yes / pdf only | yes | as Segmentation |

`allowedStructures` is listed under the dialog title as "Allowed structures: • …". While the dialog's config fetch runs, "Loading workflow configuration…" shows instead.

## 2. Decision table: which UI renders

Evaluated top to bottom in the dialog body (~L10915–11818).

| Section | Render condition |
|---|---|
| Title | "Upload Additional Files" if `isAdditionalUploadMode`, else "Create New Workspace" |
| `workspaceNameExistsError` amber banner | Set (only by `createWorkspaceAsync` on `F001`) |
| **Upload Mode** toggle (Image / Audio) | `!standaloneMode && !isAdditionalUploadMode && !isConfigLoadingForDialog && supportsAudioUpload` |
| Workspace Name * (max 60) | Always. Disabled in additional mode (prefilled) |
| Candidate Name * (max 60; "Candidate Name / Reg.No" in additional mode) | `questionFlowMode` truthy |
| Standalone OCR-only image/audio picker (1–3 images) | `standaloneMode` and effective stages = OCR only |
| Workflow-stage summary ("Workflow stage(s)" chips; in additional mode "Files are added to <workspace> in <subject>.") | `standaloneMode \|\| isAdditionalUploadMode` and at least one effective stage |
| Subject hint ("New Workspace Subject: <name>", "If this is incorrect, please go back / change it…") + **I confirm that <subject> is correct** checkbox | `!standaloneMode && !isAdditionalUploadMode` |
| Expected Question Numbers input | `(effective.ocr \|\| effective.evaluation) && isQNumExtractionEnabled` |
| Right-hand upload column | `!questionFlowMode` |
| → OCR Text textarea + Question Numbers (legacy evaluation input) | `uploadPolicy.mode === 'text'`. Not reachable in practice: text mode implies `questionFlowMode === 'text'` outside standalone |
| → Additional mode dropzone / "n file(s) selected" summary | `uploadPolicy.mode==='files' && isAdditionalUploadMode` |
| → "Manual Evaluation Input" panel (QID + text) | `newWorkspaceFiles` empty and effective = Evaluation only. Not reachable (see §6) |
| → Create dropzone (file picker + "Upload Folder(s)" when `allowFolder`) / "n file(s) selected · x MB total" | `uploadPolicy.mode==='files'` and not additional |

The layout is one column when `questionFlowMode` is set, two otherwise.

## 3. Decision table: primary button

Handler ~L11848. Label and disabled logic ~L12069–12139. Branches are checked in this order:

| # | Condition | Label | Disabled when | Click action |
|---|---|---|---|---|
| 0 | `isAdditionalUploadMode && newWorkspaceCandidateName.trim()` (pre-step for every branch) | – | `isCheckingCandidateDuplicate` | `ensureCandidateIsNew(name)`; stop when false |
| 1 | Standalone OCR-only | **Create & Extract** (spinner + `standaloneOcrStep` while running) | name empty, candidate empty, 0 images, or `standaloneOcrLoading` | §5.6 chain |
| 2 | `questionFlowMode` set | **Next** | name empty, candidate empty, `!subjectConfirmed` (non-standalone) or `isCreatingWorkspace` | Validates name/candidate → `qFlowActiveIndex=0` → opens the per-question popup |
| 3 | `isAdditionalUploadMode` | **Upload Files** ("Uploading files..." while busy) | no `addedFilesInfo` files, `!subjectConfirmed` (auto-true in this mode) or `isUploadingAddedFiles` | `runWorkspaceAction('additional')` immediately (no confirm) |
| 4 | effective = Evaluation only | **Run Evaluation** | `isManualEvalLoading`, empty QID/text or subject not confirmed | `handleManualEvaluation()` (not reachable, §6) |
| 5 | otherwise (create with files) | **Create Workspace** ("Creating workspace..." while busy) | name empty, no files, subject not confirmed or `isCreatingWorkspace` | Standalone → `runWorkspaceAction('create')`. Otherwise opens **Confirm File Upload** ("We will add the file to <subject>. Please confirm to proceed." No/Yes) → Yes → `runWorkspaceAction('create')` |

**Cancel** sets `allowDialogCloseRef`. If an upload is running it calls `cancelUpload()` (aborts controllers, clears intervals, toast "Upload cancelled"); otherwise it closes and resets the name, files, additional mode and standalone images. Outside clicks are blocked at the Radix layer (`onPointerDownOutside`/`onInteractOutside` preventDefault).

Opening the dialog (effect ~L1102) clears `workspaceNameExistsError`, sets `subjectConfirmed = isAdditionalUploadMode` and re-fetches `get-config-info`. A second effect (~L1095) holds `subjectConfirmed=true` for as long as additional mode is open.

## 4. Validation rules and messages

### 4.1 Form fields

| Field | Rule | Message |
|---|---|---|
| Workspace name | Required; truncated to 60 chars (`slice(0,60)` + `maxLength`) | "Please enter a workspace name" |
| Candidate name | Required when `questionFlowMode`; max 60 | "Please enter a candidate name" |
| Subject confirmation | Required outside standalone and additional mode (button disabled) | – |
| Duplicate workspace name | Server-side only: `create-workspace` returns `sp_status \| spStatus \| status === 'F001'` → banner "Workspace name already exists. Please provide another name." (**only in `createWorkspaceAsync`**). The OCR/Evaluation chains turn a non-`S001` status into a toast carrying the server message. The Standalone OCR-only chain does not check status at all | – |
| Duplicate candidate (additional mode) | `ensureCandidateIsNew` (~L2447): `GET candidate-process-data` with `OrgCode, CustCode, UserCode, SubjectCode ('generic' in standalone), WorkspaceId`; compares `details[].registrationNumber` trimmed and case-insensitive | "Candidate already exists. Please enter another name and try." / on error "Unable to verify the candidate right now. Please try again." |
| File name vs existing candidate (additional mode, file picking) | `findPdfNameConflict` (~L3326): file base name equals a candidate name | "File name "<file>" matches an existing candidate name. Rename the file and try again." |

### 4.2 File structure: `validateWorkspaceStructure(files, isFolder)` (~L1555)

Limits (`UPLOAD_CONFIG`, ~L1270): 100 MB per file, 5,000 MB per ZIP, 2,000 files, folder depth 15, 10,000 MB extracted (ZIP bomb check). Magic bytes are checked for pdf/png/jpg/bmp/webp/tiff/zip. Duplicate files are detected by SHA-256.

| Situation | Message |
|---|---|
| No files | "No valid Images or PDF files found." |
| Over 2,000 files | "Too many files (n). Maximum allowed is 2000." |
| Indexing without Segmentation, loose files given | "Please upload a ZIP file containing images only." |
| Single file: corrupted / blocked / too big / other | "The uploaded file appears to be corrupted." / "Unsupported file type detected. Only Images and PDF files are allowed." / "File too large (x MB > 100 MB): name" |
| ZIP mixed with loose files | "Mixing files and ZIP uploads is not allowed. Use either ZIP or loose files/folders." |
| ZIP too large / not a ZIP / unreadable / encrypted / empty | "ZIP too large (n MB). Maximum is 5000 MB." / "<zip>: The uploaded file appears to be corrupted." / "<zip>: Could not read ZIP file." / "Password-protected ZIP files are not supported." / "<zip>: No valid Images or PDF files found." |
| ZIP bomb | "ZIP extraction would exceed 10000 MB. Possible ZIP bomb detected." |
| ZIP holds a file outside `zipOnly` | "<zip>: contains <file>. Expected <policy.expected>." |
| ZIP with no valid entries | "No valid Images or PDF files found." |
| Indexing ZIP containing PDFs | "PDFs are not allowed under current configuration. Please upload a ZIP file containing images only." |
| Folder upload without relative paths / malicious path / too deep / several top folders | "Folder upload missing path information…" / "Malicious file paths detected in folder." / "Folder nesting exceeds maximum depth of 15." / "Please upload a single folder. Multiple top-level folders found." |
| Picker or drop with nothing matching the policy | "No valid files found. Expected <policy.expected>." / "No valid files found in folder. Expected …" |

### 4.3 Per-question popup and standalone picker

| Input | Rule | Message |
|---|---|---|
| Image per question | `.png/.jpg/.jpeg`; at most `QFLOW_MAX_IMAGES_PER_QUESTION = 5`; the same file (name+size+lastModified) cannot be attached twice to one question | "Only PNG, JPG and JPEG images are allowed." / "You can upload a maximum of 5 images per question." / "<file> is already added to this question." |
| Audio per question | `.mp3/.wav`; `QFLOW_MAX_AUDIO_PER_QUESTION = 1` | "Only MP3 and WAV audio files are allowed." / "Only one audio file is allowed per question. Remove the current one to replace it." |
| Submit All | At least one answered question | "Please upload at least one image for a question." / "Please enter OCR text for at least one question." |
| Standalone OCR-only images | PNG/JPG/JPEG, **1–3**; an over-limit selection keeps the first N that fit | "Only PNG, JPG, or JPEG images are accepted." / "You can upload a maximum of 3 images. Only the first N were kept." / "…Remove one to add another." / "The same image cannot be selected twice." / on click "Please upload at least 1 image (PNG/JPG/JPEG)." |

## 5. API chains per mode

All bases: `API_BASE` = `VITE_ICMEPRODUCT_API_BASE`, `API_BASE1` = `VITE_AIMARKING_API_BASE`. Codes: `orgCode = sessionStorage.orgCode`, `custCode = 'ICME'`, `userCode = sessionStorage.userCode`, `subjectCode = resolveSubjectCode()` (`'generic'` in standalone).

### 5.1 Segmentation and/or Indexing: create (`createWorkspaceAsync`, ~L1734)

Reached via `runWorkspaceAction('create')`.

| Step | Call | Payload | Response used / on failure |
|---|---|---|---|
| 0 | – | Validates name, files and `validateWorkspaceStructure` again | toast with the validation message |
| 1 | `POST ${API_BASE1}/create-workspace` | `{ orgCode, custCode:'ICME', userCode, subjectCode \|\| 'S1', workspaceId:0, workspaceName, candidateCount:0, standardCount:0 }` | `F001` → name banner and dialog reopened. Status other than `SUCCESS`/`S001` → toast "Failed to create workspace. Please try again.". `outWorkspaceId \| workspaceId \| workspace_id` → `sessionStorage.workspaceid` |
| 1b | *(Standalone + Indexing-only + single ZIP)* `POST ${API_BASE1}/save-candidate-info` once per top-level ZIP folder (`readZipCandidateFolders`) | `{ firstName:'N/A', lastName:'N/A', registrationNumber:<folder>, centerName/centerAddress:'N/A', subjectCode \|\| 'generic', orgCode, custCode, numberOfQuestions:0, scriptPath: Cust/Org/Subject/Workspace/<zipName>/<folder>, dateOfExamination/countryName:'N/A', workspaceId, folderName:<folder>, userCode, isValid:0 }` | non-`S001` → toast with the server message, stop. No folders → "No candidate folders found in the ZIP…" |
| 2 | – | Adds a local `Workspace` (id = backend id) to the top of `workspaces`, selects it and closes the dialog | – |
| 3 | `POST ${API_BASE}/upload-pdfs` (multipart), in the background | Single ZIP: one request with `file=<zip>`. Otherwise batches of `MAX_UPLOAD_WORKERS=10` files under repeated `file`. Fields: `org_code, cust_code, usercode, subject_code, subject_name, number_of_questions='0', workspace_name, folder_name (ZIP name / first file's top folder), workspace_id, config_data=JSON(apiConfig \|\| {workflowStages}), [question_numbers when OCR && isQNumExtractionEnabled]` | 400/404/413/"Network Error" → **Upload Error** popup "Please upload correct data". Other errors → "Failed to upload batch. Please try again." (later batches stop) |
| 4 | After the **first** response | `loadCandidatesForWorkspace(ws, {silent, force})` → `startCandidatePolling(ws)` → `additionalUploadCooldown` and `uploadApiResponseCooldown` for 30 s | Later batch responses → silent reload |

Loaders: `preparingFilesLoading`, then `workspaceValidationLoading`/`isValidatingName` during create-workspace, then `firstUploadPdfsLoading` until the first upload response, with `isBackgroundUploading` throughout.

> `upload-pdfs` is chosen when raw `segmentation || indexing`. Otherwise the code would pick `ocr-image` (OCR) or `evaluate-text`. With current `questionFlowMode` rules, those two targets are only reached when no stage is configured at all (then `evaluate-text` receives the files). That is an edge-case risk.

### 5.2 Segmentation/Indexing: Upload Additional Files (`uploadAddedFiles`, ~L5710)

| Step | Call | Notes |
|---|---|---|
| 1 | `POST ${API_BASE}/upload-pdfs` in batches of 10 | `workspace_name = selectedWorkspace.name`, `folder_name` = top folder from `webkitRelativePath` or `''`, `workspace_id = sessionStorage.workspaceid`, `subject_code = resolveSubjectCode()` (no fallback), same `config_data` |
| 2 | After the first batch | Clears additional mode; bumps the local file count; `loadCandidatesForWorkspace(selectedWorkspace)` (non-silent); 30 s cooldowns; toast "First 10 files uploaded, continuing in background..." when there are more than 10 |
| 3 | Later batches | Silent reload. At the end: toast "Files uploaded successfully" / "All additional files uploaded successfully" |

`runWorkspaceAction('additional')` does not await the batch loop, so the dialog closes right after the first `upload-pdfs` request starts.

### 5.3 OCR (± Evaluation), Image mode: `submitOcrWorkflow` (~L2638)

Dialog **Next** → popup → **Submit All**. Step labels appear on the button (`evalWorkflowStep`).

| Step | Call | Payload | Success test |
|---|---|---|---|
| 1 | `POST ${API_BASE1}/create-workspace` *(skipped in additional mode, which reuses `selectedWorkspace.id`)* | `{ orgCode, custCode, userCode, subjectCode, workspaceId:0, workspaceName, candidateCount:0, standardCount:0 }` | `assertStepSucceeded` (status `S001`, or no status field); `outWorkspaceId \| outworkspaceid` required |
| 2 | `POST ${API_BASE1}/save-candidate-info` | as §5.1 step 1b with `registrationNumber = candidate name`, `scriptPath = ICME/<org>/<subjectName>/<workspace>/<candidate>`, `folderName:''` | `S001` |
| 3 | `POST ${API_BASE}/upload-pngs` (multipart) | `target_path = scriptPath`, `files` = every attached image, de-duplicated by name across questions | HTTP 2xx |
| 4 | `POST ${API_BASE}/save-ocr-data` | `{ custcode, orgcode, usercode, registrationnumber, workspaceid, ocrdata:{ summary:{}, ocr_extracted_text:{ "<q>": { "<scriptPath>/<file>": "" } }, standards_evaluation:{} }, scriptpath }` | HTTP 2xx (any envelope) |
| 5 | `POST ${API_BASE}/recalculate-standards` (via `postRecalculateStandards`) | `{ orgcode, custcode, usercode, isall:1, registrationnumber, subjectcode, workspaceid, questions:[], userprompt:'', processdata:{ registration_number, question_page_mapping:{q:[paths]}, ocr_extracted_text } }` | HTTP 2xx |
| 6 | `GET ${API_BASE1}/candidate-process-data` | `OrgCode, CustCode, UserCode, SubjectCode, WorkspaceId` | `details.length` → local `candidateCount` |
| 7 | – | `sessionStorage.workspaceid`; closes both dialogs; selects the new workspace (create) or stays (additional); `loadCandidatesForWorkspace(ws, {silent, force})`; toast "Submitted successfully" | – |

No `run-ocr` or `run-evaluation` is called by this chain. OCR text is sent empty, so any OCR processing after this point is a backend responsibility. Errors → toast `response.data.message || error.message || 'Submission failed'` and the chain stops.

### 5.4 OCR, Audio mode (Image/Audio toggle = Audio)

Same as §5.3 steps 1–2 (create-workspace sends `standardCount: 1`), then:

| Step | Call | Notes |
|---|---|---|
| 3 | `POST ${API_BASE}/upload-audios` (multipart `target_path`, `files`) | HTTP 2xx |
| 4 | `GET candidate-process-data`, then select the workspace and reload rows | Rows appear before transcription |
| 5 | `POST ${API_BASE}/transcribe-audio` in the background (not awaited) | `{ orgcode, custcode, usercode, registrationnumber, workspaceid:Number, processdata:{ segment_data:[{ qid, image_path:"<scriptPath>/<file>" }] }, scriptpath, subjectcode }`. Failure → toast only |

**Nothing is called after `transcribe-audio`**: no save-ocr-data, recalculate-standards, run-evaluation or poll (code comment ~L2776). The comment at ~L2748–2752 still describes a longer chain and is out of date.

Audio needs `supportsAudioUpload` (OCR without Segmentation/Indexing) and is offered only outside Standalone Mode. In additional mode the choice follows the workspace (`standardCount === 1` → audio).

**Video mode (Image/Audio/Video toggle = Video) diverges at step 5**: `transcribe-audio` persists nothing for video, so step 5 is instead, per uploaded file: `POST ${VITE_VIDEO_TRANSCRIBE_API_BASE}/transcribe` directly — a local transcription service (`http://127.0.0.1:8002/v1/transcribe` by default), not a public host; multipart `file, language, diarization:'true', keyterms:''` → build `ocr_extracted_text` from each response's `text` → `POST ${API_BASE}/save-ocr-data` → `loadCandidatesForWorkspace(ws, {silent, force})` again so the rows shown at step 4 (saved before transcription) are replaced with the real transcript. Failure at any point → toast only, same as audio.

### 5.5 Evaluation only (`questionFlowMode === 'text'`): `submitEvaluationWorkflow` (~L2925)

| Step | Call | Payload | Success test |
|---|---|---|---|
| 1 | `create-workspace` *(skipped in additional mode)* | `standardCount:0` | `S001` |
| 2 | `save-candidate-info` | `scriptPath:'N/A'` | `S001` |
| 3 | `save-ocr-data` | `ocrdata.ocr_extracted_text = { "<q>": "<typed text>" }` (no `scriptpath`) | `S001` or `S002` |
| 4 | `recalculate-standards` | `question_page_mapping:{}` | HTTP 2xx |
| 5 | `POST ${API_BASE}/run-evaluation` | `{ orgcode, custcode, usercode, isall:1, registrationnumber, subjectcode, workspaceid, questions:[], userprompt:'' }` | HTTP 2xx |
| 6 | `candidate-process-data` → select / reload, toast "Submitted successfully" | | |

### 5.6 Standalone OCR-only: **Create & Extract** (~L11862)

| Step | Call | Notes |
|---|---|---|
| 1 | `create-workspace` *(skipped in additional mode)* | `subjectCode:'generic'`, `standardCount` 1 for audio / 0 for image. **No status check**; only requires `outWorkspaceId` ("Workspace ID missing from response") |
| 2 | `save-candidate-info` | `scriptPath = ICME/<org>/Generic/<workspace>/<candidate>`. Response not checked |
| 3 | `upload-pngs` (image) or `upload-audios` (audio) | HTTP 2xx |
| 4 | `runExtraction()` from `src/lib/extraction.ts`, once per file, in sequence | `POST <VITE_AIAPPS_API_BASE>/AITranscription/extract` multipart `subject='General', file, verify, interpret, line_mode, insertion_pass, strict_maths, q_filter`. Step label "Extracting image i of n..." |
| 5 | `save-ocr-data` (through `sanitizePayload`) | `ocr_extracted_text = { "1": { "<scriptPath>/<file>": <ExtractionResult> } }`, `scriptpath`, `remainingcount:0`, `totalcandidatecount:1` |
| 5b | `recalculate-standards` | **Skipped** (`if (!standaloneMode)`, always false on this path) |
| 6 | Closes the dialog; adds the workspace to the list; `syncWorkspaceIdToSession`; `loadCandidatesForWorkspace(ws, {silent, force})`; `startCandidatePolling(ws)`; toast "OCR extraction completed successfully!" | Errors → toast server message or "Failed to process OCR" |

Audio on this path: the toggle is hidden in standalone and an effect forces `'image'`. However, **Upload Additional Files** on a workspace with `standardCount===1` sets `'audio'` after that effect has run, so audio files would be passed to `runExtraction`. That is an edge-case risk.

**Video on this path** (`standaloneUploadMode === 'video'`) replaces steps 3–5b: `upload-audios` still carries the file (`isAudioUpload = isAudioUploadMode || isVideoUploadMode`), but instead of `transcribe-audio` or `runExtraction`, each uploaded video is sent directly to `POST ${VITE_VIDEO_TRANSCRIBE_API_BASE}/transcribe` — a local transcription service (`http://127.0.0.1:8002/v1/transcribe` by default), not a public host (multipart `file, language, diarization:'true', keyterms:''`); the responses' `text` fields become `ocr_extracted_text["1"]`, saved via the same `save-ocr-data` call shape as step 5. `recalculate-standards` is skipped, same as audio and (in Standalone Mode) the image branch.

### 5.7 Mode summary

| Configuration (effective) | Standalone | Dialog input | Primary flow |
|---|---|---|---|
| Segmentation (any combination) | no | PDF / folder / ZIP of PDFs + subject confirm | Confirm File Upload → §5.1 |
| Segmentation (any) | yes | same, no subject confirm | §5.1 immediately |
| Indexing (no Segmentation) | no / yes | single ZIP of image folders | §5.1 (+1b in standalone Indexing-only) |
| OCR (± Evaluation), Image | no | Name + Candidate → popup images | §5.3 |
| OCR (± Evaluation), Audio | no | Name + Candidate → popup audio | §5.4 |
| OCR only | yes | Name + Candidate + 1–3 images | §5.6 |
| Evaluation only | no | Name + Candidate → popup text | §5.5 |
| Additional upload, Segmentation/Indexing | any | dropzone | §5.2 |
| Additional upload, OCR/Evaluation | any | Candidate (duplicate-checked) → popup (or standalone picker) | §5.3–5.6 reusing the open workspace |

## 6. Unreachable or legacy paths (present in source)

| Item | Why it is not reached |
|---|---|
| `handleManualEvaluation` → `POST ${API_BASE}/evaluate-text` with `workspace_id: 9999` (~L1696) | Needs effective = Evaluation only, but then `questionFlowMode==='text'` is checked first |
| `submitQuestionFlow` → `pendingQuestionFlowSubmit` → `createWorkspaceAsync` (~L3107, ~L3139) | The popup button uses it only when `questionFlowMode` is null, and the popup opens only when it is set |
| `handleFolderUpload` / `handleZipUpload` / `handlePdfUpload` and their `*Confirmed` mock flows, the "Create Workspace Upload Confirmation" and "Additional Files Upload Confirmation" alerts, the "Files Added Successfully" dialog | Not wired to any JSX input |

The `StandaloneOCREvaluation` popup is **not** in this list: it is not opened from the create/upload dialog, but it is reachable — `handleOpenOcrReview` (standalone OCR-only branch, ~L6186) fetches `get-process-data` type 2 and calls `setStandaloneOcrPopupData(mappedSegments)`. See [user-standalone-ocr-review.md](./user-standalone-ocr-review.md).

## 7. After success

| Flow | Selection | Polling | List refresh |
|---|---|---|---|
| §5.1 create | New local workspace selected immediately | Started after the first upload response; also by the dialog-close effect once `selectedWorkspace` is set | Local insert only; `list-workspace` is not re-called until the user goes back to the list |
| §5.2 additional | Unchanged | Restarted by the dialog-close effect | Reload of candidate rows |
| §5.3–5.5 | New workspace selected (create) / unchanged (additional) | Started by the dialog-close effect (`selectedWorkspace` changed, no dialog open) | Reload with `force` |
| §5.6 | New workspace selected | `startCandidatePolling` explicitly | Local insert |
