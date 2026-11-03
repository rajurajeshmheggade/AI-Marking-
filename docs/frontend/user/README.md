# User (Evaluator) Documentation

This folder documents the **evaluator-facing** side of the ICME AI answer-script marking frontend, from the Home page (Year → Cycle → Subject) through the workspace list, workspace creation and upload, to the candidate table and its Excel export.

Review/approval dialogs (Segmentation/Indexing review, OCR review and approve, Evaluation review and score editing, Re-evaluation) and `StandaloneOCREvaluation.tsx` / `src/components/ocr/*` are documented separately in [`./user-review-and-evaluation.md`](./user-review-and-evaluation.md).

## Who is a "user"

A "user" in these documents is any signed-in account whose `userRole` is **not** `superadmin` or `admin`. Role routing happens in `src/pages/Login.tsx` → `handleLogin` (~L173–181) and in the already-logged-in redirect effect (~L193–223):

| Condition (customerCode must be `ICME`, else "Access denied.") | Route |
|---|---|
| `userRole` is `superadmin` or `admin` | `/superadmin-dashboard` (see [`../admin/`](../admin/)) |
| Standalone Mode on (`get-config-info` → `configSetting.standalone`, cached in `localStorage.standalone_mode`) | `/ocr-evaluation` (directly into the workspace list, no Home page) |
| Otherwise | `/subject-dashboard` (Home page) |

All three routes are wrapped in `RequireAuth` (`src/App.tsx` ~L25), which only checks `sessionStorage.isLogin === 'true'`.

```text
Login ──► /subject-dashboard (SubjectDashboard) ── subject click ──► <OCREvaluation …props> (rendered inline, same URL)
  │
  └──► /ocr-evaluation (OCREvaluation, no props)   ← Standalone Mode users
```

## Document index

| Document | Covers |
|---|---|
| [user-overview.md](./user-overview.md) | What a user can and cannot do; ownership rules; Standalone vs normal mode |
| [user-dashboard.md](./user-dashboard.md) | `SubjectDashboard.tsx`: Year dropdown, Cycle cards, Subjects grid, Student Export, handoff to OCREvaluation |
| [user-workspaces.md](./user-workspaces.md) | `OCREvaluation.tsx` workspace level: props, subject resolution, config loading, breadcrumb, workspace list, selection, deletion |
| [user-create-workspace-and-upload.md](./user-create-workspace-and-upload.md) | Create Workspace / Upload Additional Files dialog in every configured mode, per-question popup, audio, Standalone OCR-only |
| [user-candidate-table.md](./user-candidate-table.md) | Candidate table, status badges, selection, row actions, candidate info dialog, polling, Download/Excel export |
| [user-workflow.md](./user-workflow.md) | Concise end-to-end flow |
| [../workflows/user-workflow.md](../workflows/user-workflow.md) | Full narrative per stage combination and Standalone Mode |
| [user-api-mapping-workspace.md](./user-api-mapping-workspace.md) | Every API in this scope, with error handling |
| [user-state-reference.md](./user-state-reference.md) | Important React state variables and what drives them |
| [user-review-and-evaluation.md](./user-review-and-evaluation.md) | Review dialogs (separate author) |

Related: [`../api/api-integration-mapping.md`](../api/api-integration-mapping.md), [`../architecture/`](../architecture/), [`../workflows/`](../workflows/), [`../admin/`](../admin/).

## Source files in scope

| File | Size | Role |
|---|---|---|
| `src/pages/SubjectDashboard.tsx` | ~1,040 lines | Home page for evaluators (`/subject-dashboard`) |
| `src/pages/OCREvaluation.tsx` | ~17,660 lines | Workspace list, create/upload, candidate table, review dialogs (`/ocr-evaluation`, and rendered inline by SubjectDashboard and SuperAdminDashboard) |
| `src/lib/session.ts` | – | `getSessionCodes()` (org/cust/user codes; `custcode` is always `'ICME'`) |
| `src/lib/extraction.ts` | – | `runExtraction()` used by the Standalone OCR-only create flow |

## Environment variables referenced

| Variable | Constant | Used for |
|---|---|---|
| `VITE_ICMEPRODUCT_API_BASE` | `API_BASE` | upload, OCR, evaluation, standards, status endpoints |
| `VITE_AIMARKING_API_BASE` | `API_BASE1` | year/cycle/subject, workspace, candidate, config, export endpoints |
| `VITE_REPO_BASE` | `IMAGE_BASE` (OCREvaluation only) | building image URLs for repo-relative paths |
| `VITE_AIAPPS_API_BASE` | `DEFAULT_ENDPOINT` in `src/lib/extraction.ts`, `API_ENDPOINTS.aiTranscription` | AI transcription (`/AITranscription/extract`) |

Every one of these has a hard-coded production URL fallback in source when the variable is unset. That is a configuration risk; see [user-api-mapping-workspace.md](./user-api-mapping-workspace.md#base-urls).
