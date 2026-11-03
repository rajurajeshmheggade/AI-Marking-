# Page-wise UI Documentation

One section per page: what it is for, how its UI is structured, the controls and conditional rendering that matter, and where the full detail lives. This is an index with substance; field-level behaviour is in the area docs linked from each section.

Related: [page-inventory.md](./page-inventory.md) · [navigation-flow.md](./navigation-flow.md) · [../api/api-integration-mapping.md](../api/api-integration-mapping.md) (API IDs used below)

---

## 1. Login — `/login`

| | |
|---|---|
| File | `src/pages/Login.tsx` → `Login` |
| Route / role | `/` and `/login`, everyone |
| Purpose | Authenticate and send each role to its landing page. |
| Business objective | Only active ICME accounts inside their From/To window enter the system. |
| APIs | M01 login, M02 get-config-info (non-admin roles) |

```text
Login page
├─ Left panel: logo and branding (hidden below the lg breakpoint, ~L239)
└─ Right: Login card (small logo below lg)
   ├─ "Username or Email"  <Input>
   ├─ "Password"           <Input type=password>
   ├─ inline error text (red)
   ├─ [Sign In] (disabled until both fields non-empty; label "Signing In..." and the message "Signing in, please wait..." while loading)
   └─ "Sign up" paragraph (rendered with class "hidden", ~L348)
AlertDialog "Access Denied" (no close button) ─ illustration · message · [OK]
```

| Control / condition | Behaviour |
|---|---|
| Sign In | `handleSubmit` → M01 → `getAccountAccess(active)` → customer must be `ICME` → M02 (users) → navigate by role |
| Access Denied OK | `clearAuthSession()` → reset form → `/login` (replace) |
| Visiting `/login` while signed in | Redirect from cached `userRole` / `standalone_mode` (no request) |

Detail: [../architecture/authentication-authorization.md](../architecture/authentication-authorization.md) · [../workflows/login-workflow.md](../workflows/login-workflow.md) · [../user/user-login.md](../user/user-login.md) · [../admin/admin-login.md](../admin/admin-login.md)

---

## 2. Subject Dashboard — `/subject-dashboard`

| | |
|---|---|
| File | `src/pages/SubjectDashboard.tsx` → `SubjectDashboard` |
| Role | user (evaluator) when Standalone Mode is off |
| Purpose | Pick Year → Cycle → Subject, then work on that subject inline. |
| Business objective | Scope all marking work to one examination subject in one cycle. |
| APIs | M04, M05, M06, M18 (token total), M02 (Student Export gate), M27 |

```text
SubjectDashboard
├─ <header> logo · "OCR Evaluation" · HeaderAccountControls (tokens, avatar → Logout)
├─ <main>
│  ├─ [no cycle selected] Year & Cycle card
│  │    ├─ Year <select>
│  │    └─ Cycle card grid | skeleton | error + Retry | "No cycles available…"
│  └─ [cycle selected] Breadcrumb (Year › Cycle) + Subjects card
│       ├─ Search · [Student Export] (only when all 4 workflow stages are on)
│       └─ Subject card grid (name, workspace count) | skeleton | error | empty
├─ <footer>
├─ Student Export Dialog (register number → Download)
└─ [isExporting] "Exporting data..." overlay
[selected subject] → whole page replaced by <OCREvaluation …/> (section 3)
```

| Control / condition | Behaviour |
|---|---|
| Year select | `setSelectedYearCode` → M05 |
| Cycle card | `setSelectedCycleCode` → M06 |
| Subject card | `handleSelect` → sessionStorage `subjectcode/yearcode/cyclecode` → inline OCR Evaluation |
| Breadcrumb Year | Back to the cycle picker |
| Student Export | Visible when `allWorkflowStagesEnabled && subjects.length > 0` |
| Mock data | Empty/failed year/cycle/subject calls show sample data (`USE_MOCK_DATA_WHILE_BACKEND_IN_DEV = true`) |

Detail: [../user/user-dashboard.md](../user/user-dashboard.md)

---

## 3. OCR Evaluation — inline in Subject Dashboard, or `/ocr-evaluation`

| | |
|---|---|
| File | `src/pages/OCREvaluation.tsx` → `OCREvaluation` (≈17,600 lines) |
| Role | user. Rendered inline by SubjectDashboard (with `onBack`, labels) or at `/ocr-evaluation` for Standalone Mode (no props, `subjectcode = 'generic'`). |
| Purpose | Manage workspaces, upload answer scripts, follow processing, review and approve each stage, export results. |
| Business objective | Turn uploaded answer scripts into approved segmentation, OCR text and evaluation marks with human review at each stage. |
| APIs | M06, M10, M18, M02, M19, M21, P01–P05, X01, P06, P07, M22 (30 s poll), M23, M24, M20, P08, M25, P09, P10, P11, M26, R01 |

```text
OCREvaluation
├─ Header: logo · [subject pill (inline only)] · HeaderAccountControls (tokens; Logout hidden for superadmin)
├─ Breadcrumb: Year › Cycle › Subject › Workspace (inline only; none in Standalone)
├─ [no workspace selected] Workspace list
│   ├─ [Create New Workspace] (hidden for superadmin) · Select All · Delete (n)
│   ├─ Workspace cards (image/audio icon, status pill, candidates, delete checkbox)
│   └─ Empty states: "No questions found…" | "Mark schema not uploaded…" | "No workspaces found…"
├─ [workspace selected] Workspace view
│   ├─ Header card: name · candidate count · "The page refreshes in Ns" · [Upload Additional Files] · Workspace ▼
│   ├─ Status widgets: Total | Segmentation/Indexing | OCR | Evaluation
│   └─ "Evaluation Results" card: Search · Status filter · Delete · Download · Candidate table
│        columns per enabled stage: StatusBadge (opens review) · Rerun (status 4) · score chip · Quick Approve
└─ Dialogs
    ├─ Create Workspace / Upload Additional Files (mode chosen by workflow stages)
    ├─ Per-question flow popup (OCR images / Evaluation text) · Confirm File Upload · Upload Error
    ├─ Delete Workspace · Delete Candidates · Candidate Details
    ├─ Segmentation/Indexing review · OCR Preview · Evaluation Preview · Re-evaluation
    └─ StandaloneOCREvaluation popup (Standalone OCR-only)
```

| Control / condition | Behaviour |
|---|---|
| Columns, widgets, create-dialog mode | Driven by `workflowStages` from M02 (`segmentation`, `indexing`, `ocr`, `evaluation`) and `standalone` |
| Upload Additional Files | Blocked when the workspace belongs to another user (`isUserCodeMismatch`), during 30 s cooldowns, or while scripts are in progress |
| Row checkbox | Only rows whose `userCode` matches the session (`isSelectable`) |
| Status badge | Clickable when completed / pending / approved → opens the stage's review dialog |
| Rerun | OCR status 4 → P08; marking status 4 → P07 |
| Quick Approve | Unlocks editing/approval inside dialogs; eligibility from row markers |
| Download | Enabled when selected rows are download-ready; Standalone requires Evaluation |
| Superadmin in this page | Create Workspace, Upload Additional Files, Delete candidates and Logout are hidden (`isSuperAdmin`) |

Detail: [../user/user-workspaces.md](../user/user-workspaces.md) · [../user/user-create-workspace-and-upload.md](../user/user-create-workspace-and-upload.md) · [../user/user-candidate-table.md](../user/user-candidate-table.md) · [../user/user-review-and-evaluation.md](../user/user-review-and-evaluation.md) · [../user/user-state-reference.md](../user/user-state-reference.md)

### 3.1 Review dialogs (inside OCR Evaluation)

| Dialog | Opened by | Key UI | Approve / save chain | Detail |
|---|---|---|---|---|
| Segmentation / Indexing | Segmentation/Indexing badge | Page viewer, question navigator, blank pages, pages to review, reposition/untag (Quick Approve) | P09 → (OCR on) M25 t2 → P05 → P06 → P10 → P11 t1 | [../user/user-segmentation-indexing-review.md](../user/user-segmentation-indexing-review.md) |
| OCR Preview | OCR badge | Per-question, per-page OCR text; Update/Save/Cancel; Standards credits | M25 t1 → P05 → P06 → (cleanup P10) → P11 t2 | [../user/user-ocr-review.md](../user/user-ocr-review.md) |
| Evaluation Preview | Evaluation badge / score chip | Score input, key points, missing items, rationale, Manual Marking, Re-evaluate all / Q | Confirm & Save: M02 → P10 → P11 t3; Re-evaluate: P07 → P11 t3 | [../user/user-evaluation-review.md](../user/user-evaluation-review.md) |
| Standalone OCR Review | OCR badge (Standalone OCR-only) | Segment list, image zoom, output tabs (transcription, LaTeX, blocks, issues) | none (read-only) | [../user/user-standalone-ocr-review.md](../user/user-standalone-ocr-review.md) |

All dialogs are read-only until Quick Approve is enabled for the row (see [../user/user-review-and-evaluation.md](../user/user-review-and-evaluation.md)).

---

## 4. Super Admin / Admin Console — `/superadmin-dashboard`

| | |
|---|---|
| File | `src/pages/SuperAdminDashboard.tsx` → `SuperAdminDashboard` (shell, ~L7607) |
| Role | superadmin, admin (any signed-in user by URL — no role guard) |
| Purpose | Administer users, organisation configuration, subjects/questions and marking schemes. |
| Business objective | Prepare an organisation (configuration, subjects, schemes, evaluators) so users can mark scripts. |
| APIs | Shell: M04, M05, M07 (superadmin only, unused result). Sections below. |

```text
SuperAdminDashboard
├─ Sidebar (collapsible): logo · "Admin Panel"
│   ├─ Role Management | User Management (admin)
│   ├─ Config Settings
│   ├─ Subject & Question   (superadmin only)
│   └─ Marks Schema         (superadmin only)
├─ Header: section title · "Super Admin Dashboard" | "Admin Dashboard" · profile menu → Logout
└─ <main> by activeSection (initial 'role-management')
    ├─ RoleManagementSection
    ├─ SettingsSection        (Year/Cycle selector variant 'settings')
    ├─ SubjectQuestionPanel   (Year/Cycle selector 'compact')
    ├─ MarksSchemaSection     (Year/Cycle selector 'compact')
    └─ 'dashboard' → AdminSubjectView / SubjectDashboard   (unreachable)
```

| Control / condition | Behaviour |
|---|---|
| `isAdmin` (`userRole === 'admin'`) | Hides Subject & Question and Marks Schema; renames Role → User Management; hides Customer/Organization selects; pre-scopes org from session; hides `admin` rows in the users table |
| Missing `userRole` | Treated as `superadmin` |
| Logout | Removes 8 session keys → `/login` |

Detail: [../admin/admin-dashboard.md](../admin/admin-dashboard.md) · [../admin/admin-overview.md](../admin/admin-overview.md)

### 4.1 Role / User Management section

```text
Filter bar: [Customer] [Organization] (superadmin only) … [+ Add User] [All Status ▾] [Search user…]
            "Total User(s): N"
Users table: Username | From Active Date | To Active Date | Status | Actions (Edit, Delete)
Modals: Create User · Edit User · Confirm Delete
```

APIs: M08, M07, M15, M16, M17. Every user created here gets role `User`. Detail: [../admin/admin-user-management.md](../admin/admin-user-management.md)

### 4.2 Config Settings section

```text
[Customer] [Organization] (superadmin) · Year/Cycle
Workflow Stages card (combinations) · Standalone Mode card
Segmentation/Indexing card (Candidate Info, Answer Script Structure, predefined mapping)
OCR Configuration card (Standards Met Count, Metadata, Question Number Extraction) — hidden in Standalone
Evaluation Thresholds (Pass mark, Top N, Live-evaluation agent, AI prompt) · subject-wise overrides
[Save Settings]
```

APIs: M07, M06, M02, M03. Detail: [../admin/admin-configuration.md](../admin/admin-configuration.md)

### 4.3 Subject & Question section (superadmin)

```text
[Download Template] [Import Subject File] … [Customer] [Organization] [Year] [Cycle]
[Search by subject name or code…] "N subject(s)" … [Delete (n)]
Table: ☐ | SL.NO | SUBJECT CODE | SUBJECT NAME | GUIDELINE PATH | WORKSPACES | Q-Preview | STATUS
Import dialog (Year, Cycle, file) · Question preview dialog · Status confirm · Delete confirm
```

APIs: M07, M04, M05, M06, M09, M10, M11, M02, M12. Detail: [../admin/admin-subject-question.md](../admin/admin-subject-question.md)

### 4.4 Marks Schema section (superadmin)

```text
[Customer] [Organization] · Year/Cycle · Subject select
Upload card → Upload dialog: Option A (Word/PDF → AI convert → preview) | Option B (.md direct) → [Confirm & Save]
Uploaded Schemes grid → card click → View dialog · Open (new tab)
```

APIs: M07, M06, P13, P12, M13, M14, R02. Detail: [../admin/admin-marks-schema.md](../admin/admin-marks-schema.md)

---

## 5. Register — `/register`

| | |
|---|---|
| File | `src/pages/Register.tsx` (imported as `./pages/register`, case-sensitive build risk) |
| Role | public; reachable only by typing the URL |
| Purpose | Legacy AI-Levate self-registration. |
| Business objective | Not part of the ICME flow (ICME users are created in User Management). |
| APIs | X02, X03, X04, M01 — all unreachable (validation always fails) |

```text
Create Account card
├─ First/Last name · Email · Username · Password · Confirm Password · Contact number
├─ Activation From / To
├─ Customer <select> · Organization <select>
├─ EULA checkbox · red errors.general banner
├─ [Create Account] · "Already have an account? Sign in" → /
Result Dialog ("Save Successful!" / "Save Failed") → OK → /
```

Detail: [register-page.md](./register-page.md)

---

## 6. Not Found — `*`

Heading "404", "Page not found.", **Back to Login** (`/login`). No state or APIs. Detail: [misc-pages.md §1](./misc-pages.md#1-notfound--srcpagesnotfoundtsx).

---

## 7. Blank and unreachable routes

| Route | What renders | Detail |
|---|---|---|
| `/standalone-ocr` | Nothing (closed dialog) | [misc-pages.md §3](./misc-pages.md#3-other-unrouted-or-blank-routes) |
| `/sandbox` | One paint, then redirect to `/login` | [sandbox-dashboard.md](./sandbox-dashboard.md) |
