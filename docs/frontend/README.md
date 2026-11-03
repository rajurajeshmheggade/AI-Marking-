# AI Marking (ICME) — Frontend Documentation

This folder is the technical reference for the React frontend of the AI Marking / OCR Evaluation application. It explains what each page does, who can reach it, which API feeds each part of the UI, when those APIs are called, and how the Admin and User workflows differ.

Everything here was written from the current source code (`src/`). Where the code did not make a behaviour clear, the document says so explicitly instead of guessing. If the code and a document disagree, **the code wins** — please update the document.

> Start here if you are new: [Developer onboarding](./developer-onboarding.md) → [Frontend architecture](./architecture/frontend-architecture.md) → [Page inventory](./pages/page-inventory.md) → [API integration mapping](./api/api-integration-mapping.md).

---

## 1. What the frontend does

Exam answer scripts are uploaded per candidate and pushed through up to four AI stages, then reviewed by people:

```text
Segmentation  →  Indexing  →  OCR  →  Evaluation
(split pages)    (tag pages    (extract    (score each
                  to questions) text)       question)
```

Which stages run is decided per organization in **Config Settings** (Super Admin). An organization can also run in **Standalone Mode**, where exactly one individual stage runs (Segmentation, Indexing or OCR) against a fixed "generic" subject, with no subject dashboard.

There are two kinds of people using the app:

| Role | Lands on | Main job |
|---|---|---|
| **Super Admin** / **Admin** | `/superadmin-dashboard` | Configure stages per organization, import subjects and questions, upload marking schemes, manage users |
| **User** (evaluator) | `/subject-dashboard` | Pick Year → Cycle → Subject, create workspaces, upload scripts, review and approve each stage, export results |

See [Admin vs User comparison](./admin-user-comparison.md) for the full feature matrix.

## 2. Technology

| Area | Choice (from `package.json`) |
|---|---|
| UI | React 18, TypeScript 5, Tailwind CSS 3, shadcn/ui (Radix primitives), lucide-react icons |
| Build / dev server | Vite 5 (dev server on port 8081, dev-only `lovable-tagger` plugin adds `data-lov-id` attributes) |
| Routing | react-router-dom 6 (`BrowserRouter`) |
| HTTP | axios and `fetch`, called directly from page components (there is no separate service layer) |
| Notifications | sonner + shadcn toast |
| Excel | ExcelJS + file-saver (candidate data export), xlsx |
| Markdown | marked (OCR / interpretation rendering) |
| Other | crypto-js (registration email link), jszip |

`@tanstack/react-query`'s provider is mounted in `App.tsx`, but no `useQuery` calls exist — state is plain React `useState`/`useEffect` plus `sessionStorage`/`localStorage`.

## 3. Architecture at a glance

```text
User
 ↓
React UI  (src/App.tsx routes → page component)
 ↓
Page      (src/pages/*.tsx — most logic lives here; two pages are very large)
 ↓
Component (src/components/*, src/components/ocr/*, shadcn primitives in src/components/ui/)
 ↓
API call  (axios/fetch inline in the page, URL = env base + endpoint path)
 ↓
Backend   (AI Marking API, ICME OCR/processing API, image repository, AI apps)
 ↓
Response  → setState(...) → re-render
```

| Page | Size | What it holds |
|---|---|---|
| `src/pages/OCREvaluation.tsx` | ~17,600 lines | Workspaces, uploads, candidate table, every review/approval dialog, export |
| `src/pages/SuperAdminDashboard.tsx` | ~7,900 lines | Admin shell plus all admin sections as in-file components |
| `src/pages/SubjectDashboard.tsx` | ~1,000 lines | User home: Year → Cycle → Subject, then renders OCREvaluation inline |

Details: [Frontend architecture](./architecture/frontend-architecture.md) · [Application flow](./architecture/application-flow.md) · [Component architecture](./architecture/component-architecture.md)

## 4. Admin functionality

Route `/superadmin-dashboard`. Sidebar sections: **Role/User Management**, **Config Settings**, **Subject & Question**, **Marks Schema**. Admins (as opposed to Super Admins) do not get Subject & Question or Marks Schema, and don't see the Customer/Organization selectors. A shared Year/Cycle selector sits next to Customer/Organization in each section.

→ [Admin documentation](./admin/README.md) · [Admin workflow](./workflows/admin-workflow.md) · [Admin API mapping](./admin/admin-api-mapping.md)

## 5. User functionality

Route `/subject-dashboard`. Year dropdown → Cycle cards → Subject grid → the selected subject opens the evaluation workspace view (OCREvaluation rendered inline): workspace list, Create Workspace / upload (mode depends on configured stages), candidate table with live polling, review dialogs per stage, re-evaluation, and Excel export.

→ [User documentation](./user/README.md) · [User workflow](./workflows/user-workflow.md) · [Review & approval workflow](./workflows/review-and-approval-workflow.md)

## 6. Authentication

`Login.tsx` calls `POST /login`, stores identity and role in `sessionStorage`, loads the organization config, and routes by role. Protected routes use a `RequireAuth` wrapper that checks only `sessionStorage.isLogin === 'true'` — **it does not check the role**, and no token is sent on later API calls. See [Known issues](./known-issues.md).

→ [Authentication & authorization](./architecture/authentication-authorization.md) · [Login workflow](./workflows/login-workflow.md) · [API authentication](./api/api-authentication.md)

## 7. Navigation

| Route | Page | Guard |
|---|---|---|
| `/`, `/login` | Login | — |
| `/register` | Register | — |
| `/subject-dashboard` | SubjectDashboard (User home) | `RequireAuth` |
| `/ocr-evaluation` | OCREvaluation (direct entry) | `RequireAuth` |
| `/superadmin-dashboard` | SuperAdminDashboard | `RequireAuth` |
| `/standalone-ocr` | StandaloneOCREvaluation | `RequireAuth` (renders blank when opened directly — see known issues) |
| `/sandbox` | SandboxDashboard | own `sandboxLogin` key |
| `*` | NotFound | — |

→ [Routing](./architecture/routing.md) · [Navigation flow](./pages/navigation-flow.md) · [Page inventory](./pages/page-inventory.md)

## 8. API integration

Each page builds URLs from environment base variables and calls axios/fetch directly. Responses often carry an envelope status: `S001` success, `S002` updated, `F001` failure. Several calls treat any HTTP 2xx as success.

→ [API overview](./api/api-overview.md) · [API integration mapping (master)](./api/api-integration-mapping.md) · [Request/response shapes](./api/api-request-response.md) · [Error handling](./api/api-error-handling.md) · [Unused / unmapped APIs](./api/unused-or-unmapped-apis.md)

## 9. Components

→ [Component inventory](./components/component-inventory.md) · [Reusable components](./components/reusable-components.md) · [Component data flow](./components/component-data-flow.md) · [OCR components](./components/ocr-components.md)

## 10. State management

Component-local `useState`/`useEffect`, plus storage keys used to hand data between pages (`orgCode`, `userCode`, `userRole`, `subjectcode`, `yearcode`, `cyclecode`, `workspaceid`, `standalone_mode`, `workflowStages`, and the `org_*` config cache). Several keys are written in two casings (e.g. `subjectcode` and `subjectCode`).

→ [State management](./architecture/state-management.md) · [User state reference](./user/user-state-reference.md)

## 11. Error handling

User-facing errors are shown as toasts. Some failures are only logged with `console.warn`, and a few screens fall back to built-in mock data when the backend fails (notably the Home page, where `USE_MOCK_DATA_WHILE_BACKEND_IN_DEV` is `true`). Support should know this, because a backend outage can look like "wrong data" rather than an error.

→ [API error handling](./api/api-error-handling.md) · [API failure handling (support)](./support/api-failure-handling.md)

## 12. Environment variables

Configured through `.env` (baked in at **build** time by Vite). Templates: `.env.example`, `.env.production.example`, `.env.demo.example`, `.env.testing.example`.

| Variable | Used for |
|---|---|
| `VITE_AIMARKING_API_BASE` | AI Marking API: login, config, years/cycles/subjects, workspaces, candidates, process data, admin APIs |
| `VITE_ICMEPRODUCT_API_BASE` | OCR/processing API: uploads, save OCR/indexing/evaluation data, run OCR/evaluation, status updates |
| `VITE_REPO_BASE` | Image repository for script page images |
| `VITE_AIAPPS_API_BASE` | AI transcription `/AITranscription/extract`, registration email/activation |
| `VITE_AIAPPS_WEB_BASE`, `VITE_AI_EXCELSOFT_BASE` | Registration links, EULA/help links |

Real values are never written in these docs. → [Environment configuration](./environment-configuration.md)

## 13. Documentation map

```text
docs/frontend/
├── README.md                       ← you are here
├── developer-onboarding.md
├── environment-configuration.md
├── admin-user-comparison.md
├── known-issues.md
├── architecture/   frontend-architecture · application-flow · routing ·
│                   authentication-authorization · state-management · component-architecture
├── admin/          README · overview · dashboard · configuration · subject-question ·
│                   marks-schema · user-management · dropdowns-and-forms · workflow · api-mapping · login
├── user/           README · overview · dashboard · workspaces · create-workspace-and-upload ·
│                   candidate-table · review-and-evaluation · segmentation-indexing-review ·
│                   ocr-review · evaluation-review · standalone-ocr-review · workflow ·
│                   state-reference · api-mapping-workspace · api-mapping-review · login
├── pages/          page-inventory · page-wise-ui-documentation · navigation-flow ·
│                   register-page · sandbox-dashboard · misc-pages
├── api/            api-overview · api-integration-mapping · api-request-response ·
│                   api-error-handling · api-authentication · unused-or-unmapped-apis
├── components/     component-inventory · reusable-components · component-data-flow · ocr-components
├── workflows/      login · admin · user · review-and-approval · api-data-flow · end-to-end-frontend-flow
└── support/        support-guide · troubleshooting · common-issues · api-failure-handling
```

## 14. Developer onboarding

```text
npm install
copy the right .env.*.example to .env   (values come from the team)
npm run dev        → http://localhost:8081
npm run build      → dist/
npm run lint
```

No automated test runner is configured. Full guide: [Developer onboarding](./developer-onboarding.md)

## 15. Support

→ [Support guide](./support/support-guide.md) · [Troubleshooting](./support/troubleshooting.md) · [Common issues](./support/common-issues.md) · [Known issues & risks](./known-issues.md)

## Screenshots

No screenshots are checked in yet. Documents mark where one is needed with `[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/<name>.png — …]`. Add the image at that path and replace the marker.
