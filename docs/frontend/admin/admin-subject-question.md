# Subject & Question (`SubjectQuestionPanel`)

Source: `src/pages/SuperAdminDashboard.tsx` → `SubjectQuestionPanel` (~L614–2647).
Props: `yearCode`, `cycleCode` and `yearCycleSelector`, all from the shell. HTTP calls use axios against
`API_BASE1` (the module constant).

Visibility: superadmin only. The menu item is removed for admins (see [admin-overview.md](admin-overview.md#role-differences)).

## Layout

```text
Row 1: [Download Template] [Import Subject File]      [Customer]* [Organization]* [Year] [Cycle]
Row 2: [🔍 Search by subject name or code…]  "N subject(s)"                       [Delete (n)]
Table: ☐ | SL.NO | SUBJECT CODE | SUBJECT NAME | GUIDELINE PATH | WORKSPACES | Q-Preview | STATUS
Footer: "n row(s) selected" | "N total subjects"
(* hidden when isAdmin)
```

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/subject-question-table.png — subject table with one row selected and a disabled checkbox on a row with workspaces]

## Data loading

### Organizations (mount, ~L663)

`GET ${API_BASE1}/organization-details?CustCode=ICME`. The customer is hard-coded: this effect does not depend on
`selectedCustomer`.

- `orgRes.data.data` (array) → `organizations`. The first `organizationid` goes into `selectedOrg`.
- Error → toast "Failed to load organizations".
- `loadingOrgs` → a full `PageLoader`.

### Subjects: `fetchSubjects` (~L1060)

| Item | Value |
|---|---|
| Trigger | Effect on `[fetchSubjects, selectedOrg, organizations]`, which in practice means a change of org, Year or Cycle (all are dependencies of the callback). Also called after an import, a delete or a status change. |
| Guard | When `yearCode` or `cycleCode` is empty: `subjects=[]` and the toast "No Year/Cycle available to load subjects." |
| Request | `GET ${API_BASE1}/get-subject-data` with params `orgCode=<organizationcode>`, `custCode=ICME`, `yearCode`, `cycleCode`, `userCode` (`sessionStorage.userCode` or `username`, with `\x00` stripped) and no-cache headers |
| Response | Rows are read from an array, from `data.data`, or from `data.subjects`. Each row is mapped to a `SubjectRow`: `subjectid`, `subjectcode`, `subjectname`, `kbpath`, `guidelinepath`, `workspacecount`, `status` (default 1) and `isReady`. |
| State | `subjects`, `loadingSubjects` |
| Error | Toast "Failed to load subjects" |

## Table columns

| Column | Source field | Rendering |
|---|---|---|
| Checkbox | `subjectid` in `selectedRows` | Disabled when `workspacecount > 0` (title "Cannot select subject with active workspaces") |
| SL.NO | Index + 1 in `filtered` | Monospace |
| SUBJECT CODE | `subjectcode` | Blue pill |
| SUBJECT NAME | `subjectname` | `—` when empty |
| GUIDELINE PATH | `guidelinepath` | Teal pill with the last path segment (full path in the `title`), or `—` |
| WORKSPACES | `workspacecount` | Bold number |
| Q-Preview | — | Eye button → `handleOpenQuestionPreview(subjectcode)` |
| STATUS | `status` | `1` → **Active** (teal); anything else → **Inactive** (blue). The badge is a button that toggles the status. |

States: 6 skeleton rows while `loadingSubjects`. When `filtered` is empty: "No subjects found / Try a different
search term". This text is used even when there is no search text.

## Search

The `search` input filters `subjects` by `subjectname` or `subjectcode`, case-insensitive substring match (~L1119).
The counter shows "Loading..." or "`filtered.length` subject(s)".

## Row selection

| Rule | Implementation |
|---|---|
| Only rows with `workspacecount === 0` can be selected | `toggleRow` returns early otherwise (~L1130); the checkbox is disabled |
| Clicking the row toggles it (except the checkbox cell, which stops propagation) | `<tr onClick>` |
| Select-all toggles only the **selectable rows in the current filter** | `toggleAll` uses `selectableFiltered` (~L1139) |
| Header checkbox checked | `selectableFiltered.length > 0 && selectedDeletableCount === selectableFiltered.length`; disabled when nothing in the filter can be selected |
| Rows that gain workspaces after a reload are dropped from the selection | Effect on `subjects` (~L1161) |

`selectedDeletableCount` counts the selected rows in the current filter that have `workspacecount === 0`.

## Buttons

### Download Template

| Item | Value |
|---|---|
| Visibility / disabled | Always visible and enabled |
| Handler | `handleDownloadTemplate` → `showDownloadDialog = true` |
| Dialog | "Choose Template". It offers only **Subject Template**; the Question Template button is commented out (~L2305). |
| Subject Template | `downloadSubjectTemplate` builds the CSV `Subject Code,Subject Name\nS1,Broadcast Journalism` in the browser and downloads it as `Subject_Template.csv`. Toast: "Subject template downloaded!". No API call. |

### Import Subject File

Calls `resetImportDialog()` and then sets `importDialogOpen = true`. See [Import dialog](#import-dialog).

### Delete (n)

| Item | Value |
|---|---|
| Disabled | `selectedDeletableCount === 0 \|\| deletingSubjects` |
| Tooltip | "Select inactive subjects to delete" or "Delete n selected subjects". The wording says "inactive", but the actual rule is zero workspaces, regardless of status. |
| Click | Opens the confirmation dialog (`showDeleteDialog`) |
| Dialog content | Built from `filtered ∩ selectedRows`. Blocked rows (with workspaces) appear in an amber list, deletable rows in a red "permanently deleted" list. The confirm button **Delete N Subject(s)** appears only when there are deletable rows and no blocked rows. |
| Confirm | `handleConfirmDeleteSubject` (~L1369) |

`handleConfirmDeleteSubject`:

```text
selectedRows empty → return
sessionStorage.userRole !== 'superadmin' → toast "Only superadmin can delete subjects"; close
blocked (workspaces > 0) → toast "Please unselect subjects with active workspaces before deleting."; close
deletable empty → toast "No valid subjects selected for deletion"; close
for each deletable subject (sequential):
   POST API_BASE1/delete-subject  { subjectCode, orgCode: <organizationcode>, yearCode, cycleCode }
   res.data.status !== 'S001' → failed.push({subjectCode, message: res.data.message || 'Failed to delete'})
success count > 0 → toast.success("Subject(s) deleted successfully") | "<n> subject(s) deleted; <m> failed"
failed.length === 1 → toast.error("Failed to delete <code>: <message>")
failed.length > 1  → toast.error("Failed to delete <m> subject(s): <codes>")
clear selection; await fetchSubjects()
catch → toast "Deletion failed. Please try again."
finally → deletingSubjects=false; close dialog
```

While deleting, a full-screen overlay shows "Deleting subject(s), please wait…".

> **Risk:** If one `delete-subject` call throws (an HTTP error rather than a non-S001 body), the loop aborts. The
> subjects after it are not attempted, and only the generic "Deletion failed" toast is shown, with no list of what
> succeeded.

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/subject-delete-dialog.png — delete confirmation listing subjects to be deleted]

### Status badge (Active / Inactive toggle)

Inline handler at ~L1737:

| Transition | Pre-checks | Outcome |
|---|---|---|
| Active → Inactive | `workspacecount > 0` → toast "Cannot mark inactive. Subject has active workspaces." | Otherwise opens the confirmation dialog |
| Inactive → Active | Ignored while another activation check is running. Sets `checkingActivationConfig = subjectcode` (the badge is disabled and shows a wait cursor). Calls `isEvaluationStageEnabled()`. If Evaluation is on and `guidelinepath` is empty → toast "This subject is not ready to be active." | Otherwise opens the confirmation dialog |

`isEvaluationStageEnabled` (~L1455) calls `GET ${API_BASE1}/get-config-info` with params `OrgCode`,
`CustCode=<selectedCustomer>` and `AppCode=AImarking`. It reads `data[0].configSetting` (or a bare object) and
returns `config.workflowStages.evaluation !== false`. If the request fails it returns `true`, which keeps the
stricter rule.

The confirmation dialog reads "Are you sure you want to mark **<name>** as **Active/Inactive**?". **Confirm** calls
`handleToggleStatus` (~L1472):

`POST ${API_BASE1}/update-subject-data` with `{ subjectCode, isActive: 0|1, orgCode }`. On any non-throwing
response it shows the toast "Subject status updated successfully" and refetches. On an exception it shows "Failed
to update subject status". The response body is **not** inspected.

### Q-Preview (eye)

`handleOpenQuestionPreview(subjectCode)` (~L1339):

1. Opens the dialog in a loading state and resets `previewData`.
2. `GET ${API_BASE1}/question-data` with params `OrgCode=<organizationcode>`, `CustCode=ICME`, `SubjectCode` and
   no-cache headers.
3. `previewData = res.data`. On error: the toast "Failed to load question preview".

Rendering in the "Question(s) & Rubric(s)" dialog (~L1896):

| State | UI |
|---|---|
| Loading | Spinner and "Loading Rubric..." |
| `previewData` is null | "No data available." |
| No questions | "No questions found." (the code reads either `previewData` as an array or `previewData.ref1Data`) |
| A question | Header "Question <label>" with `questionLabel` (or `questionlabel`, or the index), plus a "<marks> marks" pill (`marks` or `totalMarks`) |
| Parts | `questionText[]` (or `questiontext[]`). A part with `marks` is rendered as a bordered block with a marks pill; a part without `marks` is shown as italic stem text. |
| Rubric | `part.rubric[]` → numbered `text` with a "<score> mark(s)" pill |

Clicking outside the dialog does not close it. It closes with the X button or the **Close** button.

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/subject-question-preview.png — question preview dialog with parts and rubric items]

## Import dialog

Opened by **Import Subject File**. Title: "Import Subject". Clicking outside does not close it. Closing by any
route calls `resetImportDialog`, which clears the file, headers, rows and preview.

`importTab` is fixed at `'subject'`. `setImportTab` is never called, because the category picker was removed
(~L2063). The questions-import validation branch is therefore unreachable.

### Steps

| Step | Control | Data source | Default | Behaviour |
|---|---|---|---|---|
| 1a Select Year | `<select>` bound to `importSelectedYearCode` | `GET ${API_BASE1}/get-year-data`, called once on panel mount with **no params** (~L698) | First year | Changing it triggers the cycles effect. Disabled while loading or when the list is empty. Error toast: "Failed to load years". |
| 1b Select Cycle | `<select>` bound to `importSelectedCycleCode` | `GET ${API_BASE1}/get-cycle-data?YearCode=<importSelectedYearCode>` (~L735) | First cycle | Cleared before each fetch. Empty states: "No Cycles for this Year". Error toast: "Failed to load cycles". |
| 2 Select Organization | `<select>` bound to **the panel's own `selectedOrg`** | The panel's `organizations` | The current page org | **Changing it also changes the org of the subject table behind the dialog**, which triggers a refetch |
| 3 Upload File | Hidden `<input type=file accept=".csv,text/csv">` behind a dropzone you click (there is no drag-and-drop handler) | — | — | `handleImportFileChange` |
| 3 Data Preview | Table of the parsed rows | `importHeaders`, `importRows` | — | Shown automatically when `showPreview && rows > 0`. Header chips show the column and row counts. |

The dialog's Year and Cycle are **independent** of the shell's Year/Cycle. They decide where the import is
written. The page table keeps showing the shell's Year/Cycle.

### `handleImportFileChange` (~L759)

1. If the extension is not `.csv`: toast "Only .csv files are allowed. Please upload a CSV template." and the input is reset.
2. `importFile = f`, and the previous preview is reset.
3. The first sheet is parsed with `XLSX.read` and `sheet_to_json` to produce headers and rows. On success
   `showPreview=true` and the file card shows "<n> rows loaded". On failure: toast "Failed to parse file. Ensure it
   is a valid Excel or CSV."

### Import button

Disabled when `!importFile || importing || !importSelectedYearCode || !importSelectedCycleCode`.

`handleImportSubmit` (~L857), in order:

| # | Check | Toast on failure |
|---|---|---|
| 1 | Year and Cycle are selected | "Please select a Year and a Cycle before importing." |
| 2 | `validateImportHeaders`: for a CSV, the first sheet; the headers must be exactly `Subject Code`, `Subject Name` | "Missing column(s) in "Subject" sheet: …" / "Unexpected column(s) in "Subject" sheet: … Please use the downloaded template." / "Could not read the file for header validation…" |
| 3 | Duplicate Subject Code within the file (case-insensitive) | "Duplicate Subject Code in file: Row r: "X" (duplicate of row s); …" (first 3, then "and N more") |
| 4 | Duplicate Subject Name within the file | "Duplicate Subject Name in file: …" |
| 5 | Subject Code already in `subjects` | "Subject Code(s) already exist: … Use a different code or update via edit." |
| 6 | Subject Name already in `subjects` | "Subject Name(s) already exist: … Use a different name." |

Checks 5 and 6 compare against `subjects`, which are the subjects of the **shell's** Year/Cycle and org. They are
not compared against the Year/Cycle chosen in the dialog.

Upload:

```text
importing = true   (full-screen overlay "Uploading file, please wait…")
re-read workbook; strip \x00 from every string cell in every sheet
re-serialise: CSV → XLSX.write(csv) → File(text/csv) | otherwise XLSX.write(xlsx)
FormData:
   File       = sanitized file
   IsType     = "0"            (IMPORT_IS_TYPE.subject)
   OrgCode    = <organizationcode of selectedOrg>
   YearCode   = importSelectedYearCode
   CycleCode  = importSelectedCycleCode
POST API_BASE1/import-subject-data-v2   (multipart/form-data)
```

| `res.data.status` | Result |
|---|---|
| `S001` | Toast "Subject added successfully!", refetch, reset and close |
| `S002` | Toast (info) "Subject already exists and updated successfully.", refetch, reset and close |
| Starts with `F` | Toast "Failed to import: <message \| 'Please check your file and try again.'>". The dialog stays open. |
| Anything else (including no status) | Toast "Import completed successfully!", refetch, reset and close |
| Exception | Toast `err.response.data.message`, or `err.message`, or "Import failed. Please try again." |

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/subject-import-dialog.png — import dialog with year/cycle/org selected and a CSV preview]

## Question JSON Creator (dormant)

A dialog for building question, sub-question and rubric JSON in three formats (`main-rubric`,
`main-sub-rubric` and `sub-only`), with a live `generatedJson` view and a **Copy** button (Clipboard API with an
`execCommand` fallback). Its opener button is commented out (~L1539), so `jsonDialogOpen` can never become `true`.
It makes no API calls.

## Loading and blocking overlays

| Condition | UI |
|---|---|
| `loadingOrgs` | `PageLoader` |
| `importing \|\| deletingSubjects` | Fixed full-screen overlay with a spinner and an "Uploading…" or "Deleting…" message |
| `loadingSubjects` | Skeleton rows and a "Loading..." counter |
| `togglingStatus` | The Confirm button is disabled and shows a spinner |
| `checkingActivationConfig === code` | That row's status badge is disabled |
