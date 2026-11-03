# Page Inventory

Every page of the frontend: routed pages, the in-page "pages" that switch with component state rather than the URL, and pages that exist in source but cannot be reached. API IDs (M01, P05 …) refer to [../api/api-integration-mapping.md](../api/api-integration-mapping.md).

Related: [page-wise-ui-documentation.md](./page-wise-ui-documentation.md) · [navigation-flow.md](./navigation-flow.md) · [../architecture/routing.md](../architecture/routing.md) · [../admin-user-comparison.md](../admin-user-comparison.md)

---

## 1. Routed pages

All routes are declared in `src/App.tsx` (`BrowserRouter`, flat, eager imports). `RequireAuth` checks only `sessionStorage.isLogin === 'true'`; there is **no role guard** on any route.

| Page | File | Role | Route | Guard | Purpose | APIs used | Main components / sections |
|---|---|---|---|---|---|---|---|
| Login | `src/pages/Login.tsx` | everyone | `/`, `/login` | none (self-redirects a signed-in user on `/login`) | Sign in; route by role and Standalone Mode | M01 login, M02 get-config-info | Login card (username, password, Sign In), Access Denied `AlertDialog`, hidden "Sign up" link |
| Register | `src/pages/Register.tsx` (imported as `./pages/register`) | public | `/register` | none | Self-registration (AI-Levate legacy). Form can never pass validation. | X02 signup, X03 send-email, X04 updateActiveRegisteredUser, M01 (all unreachable) | Create Account card, Customer/Organization `<select>`, EULA checkbox, result `Dialog` |
| Subject Dashboard | `src/pages/SubjectDashboard.tsx` | user (Standalone off) | `/subject-dashboard` | `RequireAuth` | Year → Cycle → Subject picker; hosts OCR Evaluation inline | M04, M05, M06, M18 (tokens), M02, M27 student-export | Header (`HeaderAccountControls`), Year select, Cycle cards, Subject cards + search, Student Export dialog |
| OCR Evaluation (standalone route) | `src/pages/OCREvaluation.tsx` | user (Standalone on) | `/ocr-evaluation` | `RequireAuth` | Workspaces, uploads, candidate table and review dialogs without the subject picker (`subjectcode = 'generic'`) | Same as §2 "OCR Evaluation (inline)" | Same as inline, without breadcrumb/subject pill |
| Super Admin / Admin Console | `src/pages/SuperAdminDashboard.tsx` | superadmin, admin | `/superadmin-dashboard` | `RequireAuth` | Administration: users, configuration, subjects/questions, marks schemes | M04, M05, M07 (shell) + section APIs (§2) | Sidebar, header with profile menu, shared Year/Cycle selectors, `<main>` section switch |
| Standalone OCR (route) | `src/pages/StandaloneOCREvaluation.tsx` | – | `/standalone-ocr` | `RequireAuth` | None in practice: the component is a controlled `Dialog` that needs `open/onClose/segments`; the route passes none, so the page is **blank** | none | – |
| Sandbox Workbench | `src/pages/SandboxDashboard.tsx` | – | `/sandbox` | own guard on `sessionStorage.sandboxLogin` (never written) | Mock OCR/Evaluation workbench; always redirects to `/login` | none (`MOCK_MODE = true`) | Mode select, OCR / Evaluation / Combo panels |
| Not Found | `src/pages/NotFound.tsx` | everyone | `*` | none | 404 with "Back to Login" | none | Heading, link button |

---

## 2. In-page "pages" (no route of their own)

| Page | File / component | Role | Reached by | URL | Purpose | APIs used | Main components / sections |
|---|---|---|---|---|---|---|---|
| OCR Evaluation (inline) | `OCREvaluation` rendered by `SubjectDashboard` when `selected != null` | user | Subject card click → `handleSelect` (writes `sessionStorage.subjectcode/yearcode/cyclecode`) | stays `/subject-dashboard` | Workspace list for a subject → workspace → candidate table → review dialogs | M06, M04/M05 (fallback), M10, M18, M02, M19, M21, P01–P05, X01, P06, P07, M22 (polled), M23, M24, M20, P08, M25 (types 1/2/3), P09, P10, P11, M26, R01 | Breadcrumb (Year › Cycle › Subject › Workspace), workspace cards and toolbar, Create Workspace dialog, workspace header card, status widgets, candidate table, review dialogs |
| Workspace view | state `selectedWorkspace != null` inside `OCREvaluation` | user | Workspace card click / Workspace ▼ | unchanged | Candidate processing and review for one workspace | M22, M02, M23, M24, P08, P07, M26, M25 … | Workspace header card, status widgets, "Evaluation Results" table, Download, Delete |
| Segmentation / Indexing review | dialog in `OCREvaluation` | user | Segmentation/Indexing badge → `handleOpenPhase1Review` | unchanged | Verify page→question mapping, approve | M25 t1, M23 + R01 (Segmentation-only), M02, P09, M25 t2, P05, P06, M25 t3, P10, P11 t1 | Page viewer, question navigator, blank pages, Approve |
| OCR Preview | dialog in `OCREvaluation` | user | OCR badge → `handleOpenOcrReview` | unchanged | Review/edit OCR text per question, approve | M25 t2, M25 t1, P05, P06, M25 t3, P10, P11 t2 | Per-question text editor, Standards credits, Approve |
| Evaluation Preview | dialog in `OCREvaluation` | user | Evaluation badge / score chip → `handleOpenEvaluationReview` | unchanged | Review marks, manual marking, re-evaluate | M25 t3, M02, P10, P11 t3, P07 | Score input, key points, missing items, rationale, Manual Marking, Re-evaluate dialog |
| Standalone OCR Review popup | `StandaloneOCREvaluation` rendered by `OCREvaluation` with `open={!!standaloneOcrPopupData}` | user (Standalone OCR-only) | OCR badge in a Standalone OCR-only workspace | unchanged | Show AI transcription per page | M25 t2 (standalone branch) | `ScriptExtractorPanel`, `ExtractionOutputTabs`, `ImageInspectorModal` |
| Role / User Management | `RoleManagementSection` in `SuperAdminDashboard` | superadmin ("Role Management"), admin ("User Management") | Sidebar; initial section | `/superadmin-dashboard` | List, create, edit, delete users | M08, M07, M15, M16, M17 | Filter bar, users table, Create/Edit modals, delete confirmation |
| Config Settings | `SettingsSection` | superadmin, admin | Sidebar | same | Organisation workflow and stage configuration | M07, M06, M02, M03 | Workflow Stages, Standalone Mode, Segmentation/Indexing, OCR, Evaluation thresholds, Save Settings |
| Subject & Question | `SubjectQuestionPanel` | superadmin only | Sidebar (hidden for admin) | same | Import subjects, preview questions, activate/deactivate, delete | M07, M04, M05, M06, M09, M10, M11, M02, M12 | Subject table, Import dialog, Q-Preview dialog, status confirmation, delete dialog |
| Marks Schema | `MarksSchemaSection` | superadmin only | Sidebar (hidden for admin) | same | Upload marking schemes (AI conversion), view schemes | M07, M06, P13, P12, M13, M14, R02 | Upload card/dialog, Uploaded Schemes grid, View dialog |

---

## 3. Unreachable pages and views in source

| Item | File | Why unreachable | Detail |
|---|---|---|---|
| SuperAdmin `dashboard` section → `AdminSubjectView` (superadmin) / `SubjectDashboard` (admin) | `SuperAdminDashboard.tsx` (~L82, ~L7868) | No menu item sets `activeSection = 'dashboard'` | [../admin/admin-dashboard.md](../admin/admin-dashboard.md#the-dashboard-section-and-adminsubjectview) |
| `AppIframe` | `src/pages/AppIframe.tsx` | Not routed or imported | [misc-pages.md §2](./misc-pages.md#2-appiframe--srcpagesappiframetsx-not-routed) |
| `/standalone-ocr` as a page | `StandaloneOCREvaluation.tsx` | Renders a closed dialog | [misc-pages.md §3](./misc-pages.md#3-other-unrouted-or-blank-routes) |
| `/sandbox` | `SandboxDashboard.tsx` | `sandboxLogin` never written | [sandbox-dashboard.md](./sandbox-dashboard.md) |
| `/dashboard` | – | Not a route; `Register.tsx` navigates there → NotFound | [../architecture/routing.md §3](../architecture/routing.md#3-in-page-routing-views-that-do-not-change-the-url) |
| Dormant dialogs: Advanced Add User, Question JSON Creator, `ExcelInlineEditor`, `ImportPanel` | `SuperAdminDashboard.tsx` | Openers missing or commented out | [../admin/admin-dashboard.md](../admin/admin-dashboard.md#other-components-in-the-file-that-are-never-rendered) |
