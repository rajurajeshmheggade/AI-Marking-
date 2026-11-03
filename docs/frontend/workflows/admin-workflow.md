# Admin Setup Workflow (End to End)

This is the full narrative of how an ICME superadmin (and, partially, an admin) prepares an organization for marking.
All screens are in `src/pages/SuperAdminDashboard.tsx`. Per-screen detail is in [../admin/](../admin/README.md),
and every API is listed in [../admin/admin-api-mapping.md](../admin/admin-api-mapping.md).

The frontend does **not** enforce any order between these steps. The order below follows the data dependencies
that the code relies on: subjects must exist before marking schemes, and a subject can only be activated when the
workflow configuration allows it.

## Diagram

```text
 Login (superadmin) ──▶ /superadmin-dashboard (Role Management)
        │
        ▼
 [1] Choose Year + Cycle (shell selector, in any section)
        │
        ▼
 [2] Config Settings ── Customer → Organization ── stages / standalone / indexing / OCR / evaluation ── Save Settings
        │                                                     (save-config-info)
        ▼
 [3] Subject & Question ── Import Subject File (CSV; dialog Year/Cycle/Org) ── import-subject-data-v2
        │
        ▼
 [4] Marks Schema ── select subject ── Word→MD (convert-markscheme-to-md) or .md ── Confirm & Save
        │                                 upload-marking-scheme + save-questions
        ▼
 [5] Subject & Question ── activate subject (guideline required if Evaluation is on) ── update-subject-data
        │
        ▼
 [6] Role/User Management ── Add / Edit / Delete users ── create-user / delete-user
        │
        ▼
 End users log in → Login.tsx reads get-config-info → Subject Dashboard or OCR workspace
```

Admin path: an admin can do only steps 1, 2 and 6, and the org used in steps 2 and 6 is the first org of the
customer (see [Admin caveat](#admin-caveat)).

## Step 0: Arrive

| | |
|---|---|
| Starting point | `/login` → `Login.tsx` stores `userRole`, `orgCode`, `customerCode`, `userCode` and `username` in `sessionStorage` |
| Action | A user with role `superadmin` or `admin` and customer `ICME` is navigated to `/superadmin-dashboard` |
| UI state | `activeSection='role-management'`. The shell starts loading `get-year-data`, then `get-cycle-data`. |
| Next | Step 1 |
| Errors | `RequireAuth` redirects to `/login` if `sessionStorage.isLogin !== 'true'` |

## Step 1: Select Year and Cycle

| | |
|---|---|
| Starting point | The Year/Cycle selects next to the Customer/Org selects in Config Settings, Subject & Question or Marks Schema. Role Management does not show them. |
| Action | Choose a Year. The Cycle list reloads and the first cycle is auto-selected. Optionally choose a different Cycle. |
| API | `GET API_BASE1/get-year-data` (on mount), `GET API_BASE1/get-cycle-data?YearCode=` (on each year change) |
| UI state | `headerSelectedYearCode` and `headerSelectedCycleCode` in the shell. The selection persists across section switches. |
| Next | Step 2 |
| Completion | Both codes are non-empty |
| Errors | Load errors are only logged. With no year or cycle, every subject list shows the toast "No Year/Cycle available to load subjects." and stays empty. The Cycle select shows "No cycles" and is disabled. |

## Step 2: Configure the workflow (Config Settings)

Full reference: [../admin/admin-configuration.md](../admin/admin-configuration.md).

| | |
|---|---|
| Starting point | Sidebar → **Config Settings** |
| Action | 1) Customer (ICME) → Organization. 2) Tick the Workflow Stages, choosing one of the 10 allowed combinations. 3) Optionally turn on Standalone Mode (single Segmentation, Indexing or OCR stage). 4) If Segmentation or Indexing: Candidate Info Extraction. 5) If Indexing: Answer Script Flexible or Predefined; for Predefined, Max Questions, Max Images, Image Format and the image tags for each question. 6) If OCR (not Standalone): Standards Met Count. 7) If Evaluation: Pass Mark, Top N (global and per subject) and Live-evaluation Agent. 8) **Save Settings**. |
| API | Load: `organization-details`, `get-subject-data`, `get-config-info`. Save: `POST API_BASE1/save-config-info`, then `get-config-info` again |
| UI state | `selectedStages`, `isStandaloneMode`, the indexing, OCR and evaluation state, and per-subject overrides in `localStorage` (`org_*_<org>_<subject>`) |
| Next | Step 3 |
| Completion | A success toast ("Settings saved successfully (s001)", "Settings updated successfully (s002)", or the server message), then a reload |
| Errors | An invalid stage combination is rejected immediately with a toast. Save is blocked by an invalid Top N (only when Evaluation is on), blank or too-small Max Questions or Max Images, or untagged questions in Predefined mode. HTTP failure: "Failed to save configuration: <status>". Network failure: "Error connecting to the API to save settings". |

The Standalone switch writes `localStorage.standalone_mode` and `org_standalone_<org>` **as soon as it is
toggled**, even if the user never clicks Save.

## Step 3: Import subjects (Subject & Question)

Full reference: [../admin/admin-subject-question.md](../admin/admin-subject-question.md).

| | |
|---|---|
| Starting point | Sidebar → **Subject & Question** (superadmin only) |
| Action | Optional: **Download Template** → Subject Template (`Subject Code,Subject Name`). Then **Import Subject File**: 1) Year and Cycle (the dialog's own selectors, defaulting to the first year and cycle, **not** the shell selection). 2) Organization (shared with the page). 3) Choose a `.csv` file; the preview appears automatically. 4) **Import**. |
| API | `POST API_BASE1/import-subject-data-v2` (multipart: `File`, `IsType=0`, `OrgCode`, `YearCode`, `CycleCode`) |
| UI state | `importFile`, `importRows`, `importing` (full-screen overlay). The table refetches through `get-subject-data` using the shell's Year/Cycle. |
| Next | Step 4 |
| Completion | `S001` "Subject added successfully!", `S002` "Subject already exists and updated successfully.", or no status "Import completed successfully!". The dialog closes. |
| Errors | Non-CSV file; wrong headers; duplicate codes or names in the file; codes or names that already exist in the currently listed subjects; Year/Cycle not chosen; `F…` status → "Failed to import: <message>" (the dialog stays open); HTTP error → the server message |

If the Year/Cycle chosen in the dialog differs from the shell's, the imported subjects will not appear in the table
until the shell selector is changed to match.

## Step 4: Upload marking schemes (Marks Schema)

Full reference: [../admin/admin-marks-schema.md](../admin/admin-marks-schema.md).

| | |
|---|---|
| Starting point | Sidebar → **Marks Schema** (superadmin only). Customer, Organization, Year and Cycle must match the subjects that were imported. |
| Action | Select a subject, then **Upload Marking Scheme**. Choose **Upload Document** (`.doc/.docx`, converted by AI) or **Upload .md File**. Review the preview (optionally **Download .md**), then **Confirm & Save**. |
| API | Optional `POST <ICMEPRODUCT base>/convert-markscheme-to-md`, then `POST API_BASE/upload-marking-scheme`, then (if the markdown parses into questions) `POST API_BASE1/save-questions` |
| UI state | `pdfStep` idle → processing → preview; `uploading` overlay; afterwards the subject list refreshes and a card appears under "Uploaded Schemes" once the subject has a `guidelinepath` |
| Next | Step 5 |
| Completion | "Marks schema and questions uploaded successfully!" (plus "✅ N question(s) saved…" when questions were parsed) |
| Errors | Wrong file type; empty or short markdown; conversion failure → "Failed to process PDF…"; upload failure → server message or "Upload failed. Please try again."; question save failure → a warning toast, followed by the generic success toast anyway |

## Step 5: Activate subjects

| | |
|---|---|
| Starting point | Subject & Question table, STATUS badge on an **Inactive** row |
| Action | Click the badge. The app checks `get-config-info`. If Evaluation is enabled, the subject must have a `guidelinepath` (from step 4). Confirm. |
| API | `GET API_BASE1/get-config-info` (check), `POST API_BASE1/update-subject-data` `{subjectCode, isActive:1, orgCode}` |
| UI state | The badge is disabled during the check. A confirmation dialog follows, then a refetch. |
| Next | Step 6 |
| Completion | "Subject status updated successfully" and the badge shows **Active** |
| Errors | "This subject is not ready to be active." (Evaluation on and no guideline). Deactivation is blocked when the subject has workspaces. Request exception: "Failed to update subject status". |

## Step 6: Manage users (Role / User Management)

Full reference: [../admin/admin-user-management.md](../admin/admin-user-management.md).

| | |
|---|---|
| Starting point | Sidebar → **Role Management** (superadmin) or **User Management** (admin) |
| Action | Choose Customer and Org (superadmin only). Then **+ Add User** (name, email, login, password, active From/To dates), **Edit** an existing user, or **Delete**. |
| API | `customer-details`, `organization-details`, `get-user-details` (list), `create-user` (create and edit), `delete-user` |
| UI state | `roleList` / `filteredRoles`. The status is derived from the From/To dates (Yet to Active, Active or Inactive). |
| Next | Done. Users can now log in. |
| Completion | "User created successfully!" / "User updated successfully!" / "User deleted successfully" |
| Errors | Field validation toasts; `E001` "Login name already exists!…"; delete with a non-`S001` status → the server message, and the row is kept |

## How the configuration reaches user pages

```text
SettingsSection ── save-config-info ──▶ backend config (AppCode=AImarking)
      │                                         │
      │ localStorage (same browser only)        │ get-config-info
      ▼                                         ▼
 standalone_mode, org_standalone_<org>,     Login.tsx  → writes workflowStages, org_selected_stages_<org>,
 org_selected_stages_<org>, org_*_<org>…               standalone_mode, org_standalone_<org>; picks route
                                            OCREvaluation.tsx → re-reads config; writes workflowStages, standalone_mode;
                                                                falls back to org_ocr_qnum_* in localStorage
                                            SubjectDashboard.tsx → reads config.workflowStages
```

The backend config is the source of truth for end users. The `localStorage` keys written by the admin screens
only affect the **same browser**. They act as a cache and fallback, and they are not cleared on logout.

## Admin caveat

For an `admin`, Config Settings and User Management hide the Organization select and default to the **first**
organization returned by `organization-details` for the customer. They do not use the admin's
`sessionStorage.orgCode`. If the admin's org is not first in that list, the admin views and changes another org's
configuration and users. This is a frontend defect; see [Known issues](../admin/README.md#known-issues-and-risks-as-implemented).
