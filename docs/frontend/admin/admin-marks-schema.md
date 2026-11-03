# Marks Schema (`MarksSchemaSection`)

Source: `src/pages/SuperAdminDashboard.tsx` → `MarksSchemaSection` (~L2701–3392).
Props: `API_BASE` and `API_BASE1` (the module constants, passed in by the shell), plus `yearCode`, `cycleCode`
and `yearCycleSelector`. It also uses the module-level `REPO_BASE`, `parseMarkdownToQuestions` (from
`src/utils/mdQuestionParser`) and `getSessionCodes` (from `src/lib/session`).

Visibility: superadmin only. The menu item is hidden for admins. The Customer/Org selects in this component have
**no** `isAdmin` check.

## Layout

```text
Header "Marks Schema"                       [Customer] [Organization] [Year] [Cycle]
Upload Marking Scheme card:  [Select Subject ▾]  [Upload Marking Scheme]
                              status line (select / will update / ready)
"Uploaded Schemes" card grid  (one card per subject that has a guidelinepath)
Dialogs: Upload flow (Choose → Process → Preview), View scheme
```

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/marks-schema-main.png — Marks Schema page with subject selected and uploaded scheme cards]

## Data loading

| Load | Trigger | Request | State |
|---|---|---|---|
| Organizations | Mount and `selectedCustomer` change | `GET ${API_BASE1}/organization-details?CustCode=<selectedCustomer>` | `organizations`; first org → `selectedOrg`. Error toast: "Failed to load organizations". |
| Subjects | Effect on `[fetchSubjects, selectedOrg, organizations]`; the callback depends on org, Year and Cycle | `GET ${API_BASE1}/get-subject-data` with params `orgCode`, `custCode=ICME`, `yearCode`, `cycleCode`, `userCode`, plus no-cache headers | `subjects` (mapped as `value=code`, `label=name`, `code`, `workspaceCount`, `status`, `guidelinepath`/`guidelinePath`) and `cards` = subjects that have a `guidelinepath` |

Guard: when Year or Cycle is empty, `subjects` and `cards` are cleared and the toast "No Year/Cycle available to
load subjects." is shown. A request error shows "Failed to load subjects".

## Upload card

| Element | Behaviour |
|---|---|
| Select Subject | Options are `"<name> (<code>)"`. Disabled while `loadingSubjects`. Sets `selectedSubject`. |
| Upload Marking Scheme button | Disabled when `!selectedSubject`. `handleOpenUploadDialog` resets `pdfFile`, `mdFile`, `previewContent` and `pdfStep='idle'`, then opens the dialog. If no subject is selected, it shows the toast "Please select a subject first". |
| Status line | No subject: red "Please select a subject before uploading a file." The subject already has a card: amber "⚠ This subject already has a marking scheme. Uploading will update it." Otherwise: teal "✓ Ready to upload for <name>". |

## Upload dialog

`showUploadTypeDialog` controls the dialog. `onOpenChange` is a no-op and clicking outside is prevented, so it
closes only with X or Cancel, both of which call `resetUploadDialog`. X is disabled while uploading or processing.

The header shows "Subject: <label>" and, when a card already exists for the subject, a **Will update existing**
badge.

The step indicator is driven by `pdfStep`:

| Step | `pdfStep` | UI |
|---|---|---|
| 1 Choose | `idle` | Two option tiles |
| 2 Process | `processing` | Overlay "Processing Document… Converting <file> to Markdown" |
| 3 Preview | `preview` | Dark code-style `<pre>` with `previewContent` (max 50vh) and the footer actions |

### Option A: Upload Document (AI Auto-Convert)

The tile clicks the hidden `pdfRef` input, which has `accept=".doc,.docx"` (~L3358). Its handler is
`handlePdfSelect` (~L2813):

```text
reject unless name ends .pdf/.doc/.docx → toast "Only PDF and Word documents are allowed here"
pdfStep='processing'; pdfProcessing=true
POST <VITE_ICMEPRODUCT_API_BASE | hard-coded fallback>/convert-markscheme-to-md
     multipart: file=<file>
mdContent = res.data (string) | res.data.content | res.data.markdown | JSON.stringify(res.data)
mdContent shorter than 5 chars → toast "API returned empty markdown. Please try again or upload .md directly."; back to idle
else previewContent=mdContent; mdFile = new File(<md>, "<name without .pdf>.md"); pdfStep='preview'
catch → toast err.response.data.message || "Failed to process PDF. Please try uploading .md directly."; idle
```

> The base for this call is read directly from `import.meta.env.VITE_ICMEPRODUCT_API_BASE`, with a fallback host
> that is **different** from the `API_BASE` fallback (~L2828). When the variable is set, it equals `API_BASE`.
> The picker accepts only `.doc/.docx`, but the handler also accepts `.pdf`. The synthetic name strips only
> `.pdf`, so a Word file `x.docx` becomes `x.docx.md`.

### Option B: Upload .md File (Direct Upload)

The tile clicks the hidden `fileRef` input (`accept=".md"`). Its handler is `handleMdSelect` (~L2857):

- Not `.md` → toast "Only .md files are allowed".
- Trimmed text shorter than 10 characters → toast "File is empty or too short. Please add meaningful content."
- Otherwise `mdFile = f`, `previewContent = text` and `pdfStep = 'preview'`.

### Preview footer actions

| Button | Disabled | Behaviour |
|---|---|---|
| Download .md | `uploading` | Downloads `previewContent` in the browser as `mdFile.name` or `marking_scheme.md` |
| Cancel | `uploading` | `resetUploadDialog` |
| Confirm & Save | `uploading` | `handleSubmit` |

### `handleSubmit` (~L2872)

```text
guard: mdFile && selectedSubject, else toast "Please select a subject and a file"
text = await mdFile.text(); shorter than 10 chars → toast "Cannot upload blank or empty file."; clear file
uploading=true (PageLoader + in-dialog overlay "Uploading Scheme… Saving for <subject>")
orgcode = selected org's organizationcode || sessionStorage.orgCode || 'ICME01';  custcode='ICME'

1) POST API_BASE/upload-marking-scheme   (multipart)
     orgcode, custcode, subjectcode=<selectedSubject.code>, file=<mdFile>
   (an error here goes to the outer catch → toast err.response.data.message || "Upload failed. Please try again.")

2) parsedQuestions = parseMarkdownToQuestions(text, subjectCode)
   if non-empty:
     questions = parsed.map(q => ({
        questionLabel: String(q['Question Label']),
        questionText:  cleanData(JSON.parse(q['Question JSON']))   // keeps text, marks, subQuestions only
        marks:         q['Max Score'] || 0 }))
     POST API_BASE1/save-questions  (JSON)
        { custcode, orgcode, subjectCode, questions }
     toast.success("✅ N question(s) saved successfully for <code>!")
   inner catch → toast.warning("⚠️ Marking schema uploaded, but questions could not be saved: <msg>")

toast.success("Marks schema and questions uploaded successfully!")   ← shown even after the warning, or when 0 questions were parsed
close dialog; clear files; pdfStep='idle'; selectedSubject=null; await refreshSubjects()
```

The response bodies of `upload-marking-scheme` and `save-questions` are not inspected for status codes. Only an
HTTP error counts as a failure.

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/marks-schema-upload-preview.png — upload dialog at step 3 with markdown preview and Confirm & Save]

## Uploaded Schemes grid

Rendered only when `!loadingSubjects`. If `cards` is empty, the page shows "No marks schemes yet / Select a subject
and upload a file to get started".

| Card element | Behaviour |
|---|---|
| Card click | `handleViewCard(card)` |
| **Open** link | Plain `<a target="_blank">` to `guidelinepath` when it starts with `http`, otherwise to `${REPO_BASE}/<guidelinepath without leading slashes>`. It stops propagation so the viewer does not open. |

### `handleViewCard` (~L2979)

1. Sets `viewCard`, empties `cardContent` and sets `loadingCard = true`.
2. `GET ${API_BASE1}/get-marking-scheme` with params `OrgCode=<getSessionCodes().orgcode \|\| 'ICME01'>`,
   `CustCode=ICME`, `SubjectCode` and `FilePath=guidelinepath`.
3. `cardContent = res.data.content || res.data || 'No content available.'`.
4. On error, it falls back to `GET <guidelinepath or REPO_BASE/guidelinepath>` with `responseType: 'text'`.
5. If that also fails: `'Failed to load content. Please contact your administrator.'`

> The viewer uses the **logged-in session's** org code, not the organization selected on the page. A superadmin
> viewing another org's scheme therefore depends on the REPO_BASE fallback.

The view dialog shows "<subject> — Marking Scheme" and "Subject Code: …" with a monospace `pre-wrap` body. It
closes only with the X button.

## Year/Cycle usage

Year and Cycle only scope the `get-subject-data` list. They are **not** sent to `upload-marking-scheme`,
`save-questions` or `get-marking-scheme`.
