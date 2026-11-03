# End-to-End Frontend Flow

One master narrative from login to export, for the three journeys the app supports. Each step names the screen, the source location and the main API, and links to the detailed workflow document instead of repeating it.

| Journey | Who | Detailed docs |
|---|---|---|
| A. Super Admin / Admin setup | `userRole` = `superadmin` or `admin` | [Login workflow](./login-workflow.md) · [Admin workflow](./admin-workflow.md) |
| B. Evaluator, normal multi-stage flow | `userRole` = anything else, Standalone Mode off | [User workflow](./user-workflow.md) · [Review & approval](./review-and-approval-workflow.md) |
| C. Evaluator, Standalone OCR flow | Standalone Mode on, only the OCR stage enabled | [User workflow §5f](./user-workflow.md#5f-standalone-ocr-only) · [Standalone OCR review](../user/user-standalone-ocr-review.md) |

Request mechanics behind every step: [API data flow](./api-data-flow.md). Component wiring: [Component data flow](../components/component-data-flow.md).

---

## 0. The common entry: login

```text
/login  (src/pages/Login.tsx → handleSubmit)
  POST {VITE_AIMARKING_API_BASE}/login         → S001 / F001 envelope (src/api.ts → loginUser)
  active flag check (getAccountAccess)         → "not yet active" / "expired" modal, session cleared
  sessionStorage: isLogin, userInfo, userRole, orgCode, userCode, customerCode, username, password …
  GET get-config-info (fetchStandaloneMode)    → localStorage standalone_mode, workflowStages, org_*
  route:
     customerCode ≠ ICME          → "Access denied." (stays on /login)
     superadmin | admin           → /superadmin-dashboard           ── Journey A
     Standalone Mode on           → /ocr-evaluation                 ── Journey C
     otherwise                    → /subject-dashboard              ── Journey B
```

Details, failure branches and logout: [Login workflow](./login-workflow.md). All protected routes only check `isLogin` (`src/App.tsx` → `RequireAuth`).

---

## A. Super Admin / Admin setup

Goal: make an organisation ready for evaluators — stages configured, subjects and questions imported, marking schemes uploaded, users created.

```text
/superadmin-dashboard (SuperAdminDashboard)
  mount: GET get-year-data → first Year; GET get-cycle-data?YearCode → first Cycle
  default section: Role / User Management
  │
  ├─1. Config Settings (SettingsSection)
  │     GET organization-details?CustCode=ICME → first org auto-selected
  │     GET get-config-info?OrgCode&CustCode&AppCode=AImarking → form state
  │     choose stages (Segmentation / Indexing / OCR / Evaluation), Standalone Mode,
  │     OCR / indexing / evaluation options, pass mark, Top-N
  │     Save → POST save-config-info (+ localStorage org_* mirror)
  │
  ├─2. Subject & Question (SubjectQuestionPanel) — Super Admin only
  │     pick Year/Cycle (shared selector) and org
  │     Import Excel → POST import-subject-data-v2 ; list GET get-subject-data
  │     activate/deactivate → update-subject-data ; delete → delete-subject
  │     preview questions → question-data
  │
  ├─3. Marks Schema (MarksSchemaSection) — Super Admin only
  │     Word file → POST convert-markscheme-to-md  |  .md file directly
  │     parseMarkdownToQuestions → upload-marking-scheme + save-questions
  │     view uploaded → get-marking-scheme / file from VITE_REPO_BASE
  │
  └─4. Role / User Management (RoleManagementSection)
        customer-details, organization-details, get-user-details
        create / edit → create-user ; delete → delete-user
```

| Step | What finishes it | Detailed doc |
|---|---|---|
| 1 | Toast "Settings saved/updated" and the form reloads from `get-config-info` | [Admin configuration](../admin/admin-configuration.md) |
| 2 | Subjects listed for the Year/Cycle and set Active | [Admin subject & question](../admin/admin-subject-question.md) |
| 3 | Scheme card appears in the list | [Admin marks schema](../admin/admin-marks-schema.md) |
| 4 | User row listed with status Active | [Admin user management](../admin/admin-user-management.md) |

What reaches evaluators: the saved `configSetting` (read by `Login`, `SubjectDashboard.fetchWorkflowConfig` and `OCREvaluation`), the subjects of the Year/Cycle (`get-subject-data`), the questions and marking schemes (used server-side by evaluation), and the user accounts. See [Admin workflow → How the configuration reaches user pages](./admin-workflow.md#how-the-configuration-reaches-user-pages).

Admin differences: Admins see only User Management and Config Settings, and both act on the **first organisation returned** for customer `ICME`, not necessarily their own (see [known issues](../known-issues.md)). The evaluation workspace is not reachable from the admin dashboard (its `dashboard` section has no menu item).

---

## B. Evaluator — normal multi-stage flow

Goal: upload candidates' answer scripts, let the AI stages run, review and approve each stage, export results.

```text
/subject-dashboard (SubjectDashboard)
  1. Year dropdown   ← GET get-year-data         (mock data if empty/failing!)
  2. Cycle cards     ← GET get-cycle-data         (mock data if empty/failing!)
  3. Subject grid    ← GET get-subject-data       (mock data if empty/failing!)
     also: GET list-workspace (token total), GET get-config-info (Student Export visibility)
     click subject → sessionStorage subjectcode/yearcode/cyclecode → renders <OCREvaluation/>
        │
OCREvaluation (embedded)
  4. Workspace list  ← GET list-workspace
  5. Create Workspace (dialog re-reads get-config-info) → upload path depends on stages:
       Segmentation/Indexing → create-workspace → upload-pdfs batches
       OCR (± Evaluation)    → per-question images/audio → create-workspace → save-candidate-info
                               → upload → save-ocr-data → recalculate-standards → run-evaluation
       Evaluation only       → OCR text per question → … → run-evaluation
  6. Open workspace  → GET candidate-process-data, then every 30 s (polling)
       badges per stage: Yet to … / In Progress / Completed / Approved / Stopped (+ Rerun)
  7. Review & approve (badge click; polling pauses while a dialog is open)
       Segmentation/Indexing → edit question→page mapping → save indexing → update-status (type 1)
       OCR                   → edit OCR text → save OCR → recalculate-standards → update-status (type 2)
       Evaluation            → adjust marks → save evaluation score; re-evaluation
  8. Export
       Download (toolbar)    → paginated get-all-data-exports → ExcelJS workbook
       Student Export (Home, only when all four stages enabled) → student-export → ExcelJS
  9. Back / Logout
       onBack → subject grid (lists re-fetched) ; Logout → /login
```

| Step | Detailed doc |
|---|---|
| 1–3 | [User dashboard](../user/user-dashboard.md) |
| 4 | [User workspaces](../user/user-workspaces.md) |
| 5 | [Create workspace and upload](../user/user-create-workspace-and-upload.md) |
| 6 | [Candidate table](../user/user-candidate-table.md) |
| 7 | [Review & approval workflow](./review-and-approval-workflow.md), [Segmentation/indexing review](../user/user-segmentation-indexing-review.md), [OCR review](../user/user-ocr-review.md), [Evaluation review](../user/user-evaluation-review.md) |
| 8 | [User workflow → Export](./user-workflow.md#step-8-export), [API data flow §4](./api-data-flow.md#4-traced-example-c--download--paginated-get-all-data-exports--exceljs) |

Things that commonly confuse users in this journey (all confirmed in source, see [known issues](../known-issues.md)): placeholder subjects when the backend returns nothing; the "Approved" filter missing rows that display as Approved; Download disabled after switching workspace with an old selection; a success toast on score save even when the save failed.

---

## C. Evaluator — Standalone OCR flow

Applies when the organisation's config has `standalone: true` and only the OCR stage enabled. Subject code is fixed to `generic`; there is no Home page.

```text
/login → /ocr-evaluation  (OCREvaluation with no props; context from storage only)
  1. Workspace list   ← GET list-workspace (subject 'generic')
  2. Create & Extract  (workspace name + candidate name + 1–3 page images)
       create-workspace → save-candidate-info → upload-pngs
       → POST {VITE_AIAPPS_API_BASE}/AITranscription/extract once per image (runExtraction)
       → save-ocr-data (results under question "1")      recalculate-standards skipped
  3. Open workspace    → candidate-process-data + 30 s polling
  4. OCR badge click   → GET get-process-data?type=2 → StandaloneOCREvaluation popup
       ScriptExtractorPanel: page thumbnails, zoom/pan, saved result in tabs
       (OCR Markdown · LaTeX · Interpretation · Issues · JSON); copy / download text;
       view only — no approve, no edit, no visible Extract button
  5. Export            → Download is disabled when the config has Evaluation off
  6. Logout            → /login
```

| Step | Detailed doc |
|---|---|
| 2 | [User workflow §5f](./user-workflow.md#5f-standalone-ocr-only), [Create workspace and upload](../user/user-create-workspace-and-upload.md) |
| 4 | [Standalone OCR review popup](../user/user-standalone-ocr-review.md), [OCR components](../components/ocr-components.md) |
| Mode rules | [Review & approval §3](./review-and-approval-workflow.md#3-standalone-mode-differences) |

Note: Standalone Mode is decided at login from `get-config-info` (cached in `localStorage.standalone_mode`). If the admin changes the mode while the user is signed in, the user only follows the new mode after the next config read (Create Workspace dialog / workspace change) or the next login.

---

## Cross-journey diagram

```text
                 ┌─────────────┐
                 │   /login    │ POST login, GET get-config-info
                 └──────┬──────┘
      superadmin|admin  │  standalone            other
     ┌──────────────────┼───────────────────┐
     ▼                  ▼                   ▼
/superadmin-dashboard  /ocr-evaluation    /subject-dashboard
  config, subjects,     Create & Extract    Year → Cycle → Subject
  schemes, users        OCR popup (view)          │
     │                       │                    ▼
     │ (config read by)      │              OCREvaluation (embedded)
     └──────────────────────►│◄──────────── workspaces → upload → poll
                             │              → review/approve → Download
                             ▼
                      Logout → /login
```
