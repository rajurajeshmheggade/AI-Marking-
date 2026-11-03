# Frontend Architecture

> Scope: the React + Vite + TypeScript single-page application in `D:\ICME\full_updated` (product name in `index.html`: **AI-Levate**, customer **ICME**). It supports AI-assisted answer-script marking: OCR, segmentation, indexing, evaluation, plus admin configuration.
>
> Every statement below was checked against the source. Symbols are cited as `src/path/File.tsx` → `symbolName` (approximate line numbers like `(~L123)` go stale quickly; search for the symbol instead).

Related documents:

- [Application flow](./application-flow.md), [Routing](./routing.md), [Authentication & authorization](./authentication-authorization.md)
- [State management](./state-management.md), [Component architecture](./component-architecture.md)
- [Environment configuration](../environment-configuration.md), [Developer onboarding](../developer-onboarding.md)
- API catalogue (owned by another author): [`../api/api-integration-mapping.md`](../api/api-integration-mapping.md)

---

## 1. Technology stack (from `package.json`)

| Concern | Library | Where it is wired |
|---|---|---|
| Build / dev server | Vite 5 with `@vitejs/plugin-react-swc` | `vite.config.ts` |
| Language | TypeScript 5, **non-strict** (`strict: false`, `strictNullChecks: false`, `noImplicitAny: false`) | `tsconfig.json`, `tsconfig.app.json` |
| UI framework | React 18 (`createRoot`) | `src/main.tsx` |
| Routing | `react-router-dom` (`BrowserRouter`, `Routes`, `Route`, `Navigate`) | `src/App.tsx` |
| UI primitives | shadcn/ui (Radix UI + Tailwind), `lucide-react` icons | `src/components/ui/*`, `components.json`, `tailwind.config.ts` |
| Notifications | `sonner` (used by pages) and shadcn `toast` (`@/hooks/use-toast`) | `src/App.tsx` mounts both `<Toaster/>` and `<Sonner/>` |
| HTTP | `axios` and native `fetch` (both, called directly from pages) | pages and `src/api.ts` |
| Server-state cache | `@tanstack/react-query` provider **mounted but unused** | `src/App.tsx` → `queryClient` |
| Files / exports | `jszip`, `exceljs`, `xlsx`, `file-saver` | `src/pages/OCREvaluation.tsx`, `SuperAdminDashboard.tsx`, `SubjectDashboard.tsx` |
| Crypto | `crypto-js` (AES for the registration e-mail link) | `src/pages/Register.tsx` |
| Markdown | `marked` | `src/components/ocr/ExtractionOutputTabs.tsx` |
| Dev-only tagging | `lovable-tagger` (`componentTagger()`) | `vite.config.ts`, only when `mode === 'development'` |

There is **no** Redux, Zustand, MobX, or React Context store for application data. Verified with a search for `createContext`, `useQuery`, `useMutation` in non-`ui` files: the only `@tanstack` reference is the provider in `src/App.tsx`.

---

## 2. Layered view (real files)

```text
 ┌────────────┐
 │   User     │  clicks / types in the browser
 └─────┬──────┘
       ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ UI shell         index.html (#root) → src/main.tsx (createRoot)           │
 │                  → src/App.tsx: QueryClientProvider → TooltipProvider     │
 │                    → <Toaster/> + <Sonner/> → BrowserRouter → Routes      │
 └─────┬────────────────────────────────────────────────────────────────────┘
       ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ Route guard      src/App.tsx → RequireAuth (sessionStorage.isLogin)       │
 └─────┬────────────────────────────────────────────────────────────────────┘
       ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ Page             src/pages/Login.tsx, Register.tsx, SubjectDashboard.tsx, │
 │                  OCREvaluation.tsx (~17.6k lines), SuperAdminDashboard.tsx│
 │                  (~7.9k lines), SandboxDashboard.tsx,                     │
 │                  StandaloneOCREvaluation.tsx, NotFound.tsx                │
 │   Pages also EMBED other pages as components:                             │
 │     SubjectDashboard → <OCREvaluation …props/>                            │
 │     SuperAdminDashboard → <SubjectDashboard/>, AdminSubjectView→<OCREval> │
│       (only under activeSection 'dashboard', which no menu item sets)     │
 │     OCREvaluation → <StandaloneOCREvaluation open …/> (popup)             │
 └─────┬────────────────────────────────────────────────────────────────────┘
       ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ Component        src/components/HeaderAccountControls.tsx,                │
 │                  src/components/ocr/* (ScriptExtractorPanel, …),          │
 │                  src/components/ui/* (shadcn primitives)                  │
 └─────┬────────────────────────────────────────────────────────────────────┘
       ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ Hook / service   src/hooks/use-toast.ts, src/lib/session.ts               │
 │                  (getSessionCodes, getAccountAccess, clearAuthSession),   │
 │                  src/lib/extraction.ts (runExtraction),                   │
 │                  src/api.ts (loginUser, registerUser, getAppDetails …)    │
 │   NOTE: most endpoints are NOT behind a service – pages build URLs from   │
 │   their own module-level constants (API_BASE / API_BASE1 / API_ENDPOINTS) │
 │   and call axios/fetch inline.                                            │
 └─────┬────────────────────────────────────────────────────────────────────┘
       ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ API (HTTP)       import.meta.env.VITE_AIMARKING_API_BASE   (AIMarking API)│
 │                  import.meta.env.VITE_ICMEPRODUCT_API_BASE (icmeproduct)  │
 │                  import.meta.env.VITE_AIAPPS_API_BASE      (AI apps)      │
 │                  import.meta.env.VITE_REPO_BASE            (image repo)   │
 └─────┬────────────────────────────────────────────────────────────────────┘
       ▼
 ┌────────────┐   JSON (status codes like "S001"/"F001" inside the body)
 │  Backend   │
 └─────┬──────┘
       ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ Response → State  setState(...) inside the page; cross-page values are    │
 │                   written to sessionStorage / localStorage                │
 └─────┬────────────────────────────────────────────────────────────────────┘
       ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ UI re-render      React re-renders; errors surface via sonner toast(),    │
 │                   inline error text, or AlertDialog/Dialog                │
 └──────────────────────────────────────────────────────────────────────────┘
```

Worked example (login), traced end to end:

```text
User types credentials → Login.tsx <Input> onChange → formData (useState)
 → <form onSubmit=handleSubmit> → api.ts loginUser() → POST {VITE_AIMARKING_API_BASE}/login
 → response.statusCode|status === "S001", userData[0]|data[0]
 → api.ts writes sessionStorage.user/userCode/usercode/orgCode/orgcode/customerCode/custcode/appcode
 → Login.tsx getAccountAccess(rawUser.active) → (blocked) AlertDialog "Access Denied"
                                              → (allowed) writes userInfo, isLogin, username, password, userRole
 → Login.tsx fetchStandaloneMode() → GET {VITE_AIMARKING_API_BASE}/get-config-info
 → localStorage.standalone_mode / workflowStages / org_* cached
 → navigate('/superadmin-dashboard' | '/ocr-evaluation' | '/subject-dashboard')
```

---

## 3. Layer reference

### 3.1 Entry point

| | |
|---|---|
| Responsibility | Mount React into `#root` and load global CSS. |
| Location | `index.html` (loads `/src/main.tsx`), `src/main.tsx`, `src/index.css` (Tailwind layers, CSS variables). |
| Why it exists | Standard Vite SPA entry. |
| Talks to | Renders `src/App.tsx`. No `React.StrictMode` wrapper is used in `main.tsx` (despite a comment in `OCREvaluation.tsx` about StrictMode double-mounts near `sharedListWorkspaceRequest`). `src/App.css` exists but is **not imported** anywhere. |

### 3.2 Providers and router shell — `src/App.tsx`

Provider order (outermost first):

1. `QueryClientProvider` with `new QueryClient()` — no `useQuery`/`useMutation` exists in `src/`, so this provider is inert.
2. `TooltipProvider` (shadcn/Radix) — required by every `Tooltip` and by the customised `src/components/ui/dialog.tsx`, which imports tooltip parts.
3. `<Toaster />` from `@/components/ui/toaster` (shadcn toast; fed by `@/hooks/use-toast`).
4. `<Sonner />` from `@/components/ui/sonner` (position `bottom-right`, `expand`). Calls `useTheme()` from `next-themes`; there is no `ThemeProvider`, so the theme resolves to the default `"system"`.
5. `BrowserRouter` → `Routes` (see [routing.md](./routing.md)).

`RequireAuth` (defined in `App.tsx`) checks `sessionStorage.getItem('isLogin') === 'true'` and otherwise renders `<Navigate to="/login" replace />`.

There is **no shared layout route** (no `<Outlet/>`). Each page renders its own header, sidebar, and footer.

### 3.3 Pages — `src/pages/`

| File | Routed at | Role | Notes |
|---|---|---|---|
| `Login.tsx` | `/`, `/login` | everyone | See [authentication-authorization.md](./authentication-authorization.md). |
| `Register.tsx` | `/register` (imported as `./pages/register`) | public | Link to it on the Login page is hidden (`className="hidden …"`). The form currently cannot pass validation (required `organizationName` has no input). See [../pages/register-page.md](../pages/register-page.md). |
| `SubjectDashboard.tsx` | `/subject-dashboard` | user (evaluator) | Year → Cycle → Subject picker; selecting a subject renders `<OCREvaluation>` **in place** (no route change). |
| `OCREvaluation.tsx` | `/ocr-evaluation` | user in Standalone Mode; also embedded | Main workspace (upload, OCR, segmentation, indexing, evaluation). Docs: `../user/`. |
| `SuperAdminDashboard.tsx` | `/superadmin-dashboard` | superadmin, admin | Section switcher (`activeSection`): Role/User Management, Config Settings, Subject & Question, Marks Schema. Docs: `../admin/`. |
| `SandboxDashboard.tsx` | `/sandbox` | — | Self-guarded on `sessionStorage.sandboxLogin`, which **no code writes**; effectively unreachable. |
| `StandaloneOCREvaluation.tsx` | `/standalone-ocr` | — | Is a **Dialog component** with required props `open/onClose/segments`; routed with no props, it renders a closed dialog (blank page). Used for real as a popup inside `OCREvaluation`. |
| `NotFound.tsx` | `*` | everyone | 404 with "Back to Login". |
| `AppIframe.tsx` | **not routed** | — | Dead code (no importer). See [../pages/misc-pages.md](../pages/misc-pages.md). |

### 3.4 Components

| Folder | Content | Used by (verified by import search) |
|---|---|---|
| `src/components/ui/` | 50 files: shadcn/ui primitives, a custom `loader.tsx` (`Loader`, `PageLoader`), and `use-toast.ts` (a re-export of `@/hooks/use-toast`). | 22 of them are imported; see [component-architecture.md](./component-architecture.md). |
| `src/components/HeaderAccountControls.tsx` | Tokens button + avatar menu with name, e-mail, Logout. | `OCREvaluation.tsx`, `SubjectDashboard.tsx`. |
| `src/components/ocr/` | `ScriptExtractorPanel`, `ExtractionControls`, `ExtractionOutputTabs`, `ImageInspectorModal` (used); `ExtractionMetrics`, `StatusBadge` (unused – `OCREvaluation.tsx` defines its own local `StatusBadge`). | `StandaloneOCREvaluation.tsx`. |
| `src/components/icons/AudiotrackOutlinedIcon.tsx` | SVG icon. | `OCREvaluation.tsx`. |
| `src/components/{SessionTimeout,AppSidebar,SuperAdminSidebar,ProfileDropdown,StandaloneAppHeader,Footer,BackToTop}.tsx`, `AudioPlayer/` | Legacy / template components. | **Not imported anywhere.** `SessionTimeout` in particular is never mounted. |

### 3.5 API layer

There is no central HTTP client, no axios instance, and no interceptor. Two patterns coexist:

1. **Service module `src/api.ts`** — only three exports are actually consumed:
   - `loginUser` (`Login.tsx`, `Register.tsx`)
   - `registerUser` (`Register.tsx`)
   - `getAppDetails` / `AppDetail` (`AppIframe.tsx`, which is itself dead)

   Everything else in `src/api.ts` (`getLearningObjectives`, `fetchUsageStats`, `getBookWiseUsage`, `getChapters`, `fetchDropdownOptions`, `generateItem`, `getFromDB`, `deleteQuestion`, `subscribeToApp`, `updateQuestion`, `sendStep1API/2/3` simulators) is unused leftover from an item-generation product.

2. **Inline calls in pages** — each big page declares its own bases at module scope and calls `axios`/`fetch` directly:
   - `src/pages/OCREvaluation.tsx` → `API_BASE` (`VITE_ICMEPRODUCT_API_BASE`), `API_BASE1` (`VITE_AIMARKING_API_BASE`), `IMAGE_BASE` (`VITE_REPO_BASE` + `/`), `API_ENDPOINTS` map (~30 endpoints, e.g. `subjectList`, `listWorkspace`, `uploadPdfs`, `runOcr`, `runEvaluation`, `aiTranscription`).
   - `src/pages/SubjectDashboard.tsx` → `API_BASE`, `API_BASE1`, `API_ENDPOINTS` (`yearData`, `cycleData`, `subjectData`) plus inline `list-workspace` and `get-config-info`.
   - `src/pages/SuperAdminDashboard.tsx` → `API_BASE`, `API_BASE1`, `REPO_BASE`; passes `API_BASE`/`API_BASE1` down as props to `MarksSchemaSection` / `SettingsSection`.
   - `src/pages/Login.tsx` → `CONFIG_API_BASE` for `get-config-info`.
   - `src/pages/Register.tsx` → inline `send-email` and `updateActiveRegisteredUser` calls.
   - `src/lib/extraction.ts` → `DEFAULT_ENDPOINT` (`VITE_AIAPPS_API_BASE` + `/AITranscription/extract`), `runExtraction()` (multipart `FormData`).

Every base has a **hard-coded fallback URL** after `||`, so a missing env var silently points the app at a built-in host. See [../environment-configuration.md](../environment-configuration.md).

Backend status is carried in the JSON body (e.g. `statusCode`/`status` = `"S001"` success, `"F001"` failure). HTTP status codes are only checked as `response.ok` in a few `fetch` calls.

Full endpoint catalogue: [`../api/api-integration-mapping.md`](../api/api-integration-mapping.md).

### 3.6 State

Local `useState`/`useEffect`/`useMemo`/`useCallback` inside pages, plus `sessionStorage` (identity, current subject/year/cycle/workspace) and `localStorage` (org configuration cache, `standalone_mode`, `workflowStages`, `org_*` keys). Details: [state-management.md](./state-management.md).

### 3.7 Hooks — `src/hooks/`

| Hook | Used by | Notes |
|---|---|---|
| `use-toast.ts` (`useToast`, `toast`) | `src/components/SessionTimeout.tsx` only (which is unmounted); re-exported by `src/components/ui/use-toast.ts`; consumed by `src/components/ui/toaster.tsx`. | `TOAST_LIMIT = 1`, `TOAST_REMOVE_DELAY = 2000`. In practice no live code calls it, so the shadcn `<Toaster/>` stays empty. |
| `use-mobile.tsx` (`useIsMobile`) | only `src/components/ui/sidebar.tsx` (itself unused). | |

Pages do not define custom hooks in separate files; logic sits inline in the page components.

### 3.8 Utilities and libraries

| File | Purpose | Live? |
|---|---|---|
| `src/lib/session.ts` | `clearAuthSession`, `ACCOUNT_MESSAGES`, `getAccountAccess`, `getSessionCodes`. | Yes (Login, OCREvaluation, SubjectDashboard, SuperAdminDashboard, api.ts). |
| `src/lib/utils.ts` | `cn()` = `clsx` + `tailwind-merge`. | Yes (shadcn primitives, `components/ocr`). |
| `src/lib/extraction.ts` | Master-agent transcription client (`runExtraction`, `ALLOWED_SUBJECTS`, `DEFAULT_OPTIONS`). | Yes (`ScriptExtractorPanel`; dynamically imported in `OCREvaluation.tsx` near `await import('@/lib/extraction')`). |
| `src/utils/mdQuestionParser.ts` | `parseMarkdownToQuestions`. | Yes (`SuperAdminDashboard.tsx`). |
| `src/utils/getTFOptions.ts` | True/false option helper. | No importer. |
| `src/utils/config.ts` | `getApiBaseUrl()`. | No importer. |
| `src/utils/api.ts`, `src/utils/Aigapi.ts`, `src/api_ish.ts`, `src/config.js`, `src/api/base.ts`, `src/api/base_ish.ts`, `src/api/updateQuestion.ts` (all three 0 bytes) | Older API modules. | **Dead code** – a search for imports of each path returns nothing. |

### 3.9 Authentication

Client-side only: a successful `/login` response sets `sessionStorage.isLogin = 'true'`; `RequireAuth` checks that flag. No token, no `Authorization` header on any request, no 401 handling. Details: [authentication-authorization.md](./authentication-authorization.md).

### 3.10 Configuration

- `VITE_*` variables are **baked in at build time** by Vite (`import.meta.env`). Changing `.env` after `vite build` has no effect on the built `dist/`.
- `vite.config.ts`: port `8081`, host `::`; dev-only proxy `/api` → AI-apps static host (rewritten to `/ai-apps/api`) and `/ICMEOcrRepo` → image repo host. A search of `src/` finds **no request to `/api/…`**; only `/ICMEOcrRepo` is used, through the `import.meta.env.DEV` fallback in `OCREvaluation.tsx` → `fetchImageBlob`.
- Path alias `@` → `./src` (in both `vite.config.ts` and `tsconfig*.json`).

### 3.11 Error handling

| Mechanism | Where | Behaviour |
|---|---|---|
| `toast` from `sonner` | `OCREvaluation.tsx` (~196 calls), `SuperAdminDashboard.tsx` (~137), `SandboxDashboard.tsx`, `SubjectDashboard.tsx`, `ScriptExtractorPanel.tsx`, `AppIframe.tsx` | `toast.success / error / info / warning`, bottom-right. |
| shadcn `useToast` | `SessionTimeout.tsx` only | Not mounted → never fires. |
| Inline text | `Login.tsx` (`error` state, red text under the form), `Register.tsx` (`errors.*` per field + `errors.general`) | |
| Modal dialogs | `Login.tsx` "Access Denied" `AlertDialog`; `Register.tsx` result `Dialog`; many `AlertDialog`s in OCREvaluation | |
| `try/catch` + `console.error` | everywhere | Many failures are only logged. |
| Global | none | No React error boundary, no `window.onerror`, no axios interceptor, no retry policy. An uncaught render error unmounts the whole app to a blank screen. |

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/toast-error-example.png — a sonner error toast in the bottom-right corner of the OCR Evaluation page]

---

## 4. Known architectural risks

| # | Risk | Evidence |
|---|---|---|
| 1 | Case-sensitive import: `App.tsx` imports `./pages/register`, file is `src/pages/Register.tsx`. Works on Windows/macOS default FS; **fails `vite build` on Linux/CI**. | `src/App.tsx` line `import Register from "./pages/register";` |
| 2 | Monolithic pages (17.6k and 7.9k lines) mix data fetching, state, and rendering. Hard to test and review. | `wc -l src/pages/*.tsx` |
| 3 | No session timeout in practice: `SessionTimeout` is never rendered. | search for `<SessionTimeout` returns nothing |
| 4 | Plain-text password kept in `sessionStorage.password`. | `Login.tsx` → `handleSubmit` |
| 5 | Hard-coded fallback hosts mean a mis-configured build quietly calls production. | every `import.meta.env.X || '…'` |
| 6 | Dead modules and unused providers increase bundle size and confuse new developers. | §3.8, §3.2 |
