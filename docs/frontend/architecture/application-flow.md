# Application Flow — Boot to First Screen

This document traces what happens from the moment the browser loads the app until each role sees its first usable screen. All behaviour was read from source; symbol names are given so you can search for them.

See also: [routing.md](./routing.md), [authentication-authorization.md](./authentication-authorization.md), [../workflows/login-workflow.md](../workflows/login-workflow.md).

---

## 1. Boot sequence (all users)

```text
Browser GET /<any-path>
  │  (production host must rewrite unknown paths to index.html – BrowserRouter
  │   uses real URL paths, not #hash; see "Hosting note" below)
  ▼
index.html  ── <div id="root"> + <script type="module" src="/src/main.tsx">
  ▼
src/main.tsx  ── createRoot(#root).render(<App/>) ; import './index.css'
  ▼
src/App.tsx
  QueryClientProvider (inert) → TooltipProvider → <Toaster/> + <Sonner/>
  → BrowserRouter → <Routes>
  ▼
Route match on window.location.pathname
  ├─ "/" or "/login"        → <Login/>
  ├─ "/register"            → <Register/>
  ├─ "/ocr-evaluation"      → RequireAuth → <OCREvaluation/>
  ├─ "/subject-dashboard"   → RequireAuth → <SubjectDashboard/>
  ├─ "/superadmin-dashboard"→ RequireAuth → <SuperAdminDashboard/>
  ├─ "/standalone-ocr"      → RequireAuth → <StandaloneOCREvaluation/> (blank – see routing.md)
  ├─ "/sandbox"             → <SandboxDashboard/> → own guard → /login
  └─ anything else          → <NotFound/>
```

Nothing is fetched before a route renders: there is no bootstrap request, no config file fetch (`public/env.json` exists but nothing in `src/` reads it), and no token refresh.

**Hosting note.** Because `BrowserRouter` is used, a hard refresh on `/subject-dashboard` requires the web server to serve `index.html` for that path. No server rewrite configuration (e.g. `staticwebapp.config.json`, `web.config`, `_redirects`) exists in this repository. Implementation behavior could not be conclusively determined from the current frontend source for the production host's rewrite rules; checked the repo root, `public/`, and `vite.config.ts`.

---

## 2. Login page first render

`src/pages/Login.tsx` → `Login` component, `useEffect([location, navigate])`:

| Condition at mount | Result |
|---|---|
| `isLogin !== 'true'` and path is `/` | `navigate('/login')` (push) — URL changes to `/login`, the same component re-renders. |
| `isLogin !== 'true'` and path is `/login` | Login form shown. |
| `isLogin === 'true'` and path is `/login` | Auto-redirect using **cached** values only: `userRole` superadmin/admin → `/superadmin-dashboard`; else `localStorage.standalone_mode === '1'` → `/ocr-evaluation`; else `/subject-dashboard`. |
| `isLogin === 'true'` and path is `/` | No redirect (the first branch requires `/login`); the login form is shown although a session exists. |

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/login-page.png — the Login page at /login with the Username/Password card and the left-side illustration on a desktop width]

---

## 3. Post-login routing decision

After a successful login (`handleSubmit`, detailed in [authentication-authorization.md](./authentication-authorization.md)):

```text
loginUser() OK (statusCode|status "S001")
  → getAccountAccess(active) allowed?
      no  → clearAuthSession(); "Access Denied" AlertDialog; stay on /login
      yes → write session keys
  → fetchStandaloneMode(orgCode, CUSTOMERCODE)   GET get-config-info
        → caches workflowStages, standalone_mode, org_selected_stages_<org>, org_standalone_<org>
        → returns true/false, or null on any failure (then cached localStorage.standalone_mode is used)
  → customerCode.toUpperCase() === 'ICME' ?
      no  → inline error "Access denied." (session keys are NOT cleared – see risks)
      yes → userRole.toLowerCase()
              'superadmin' | 'admin'  → /superadmin-dashboard
              anything else, standalone → /ocr-evaluation
              anything else            → /subject-dashboard
```

All three navigations use `{ replace: true }`, so Back does not return to the login form.

`isStandaloneOcrOnly` is computed in both `handleSubmit` and the redirect `useEffect` but **never used** — the "OCR-only" variant does not change the destination.

---

## 4. First screen per role

### 4.1 Superadmin

Lands on `/superadmin-dashboard` → `SuperAdminDashboard`:

| Step | Code | Effect |
|---|---|---|
| Initial section | `useState<ActiveSection>('role-management')` | **Role Management** panel is shown first (comment: "Dashboard is no longer in the menu"). |
| Role from storage | `loggedInRole = sessionStorage.userRole || 'superadmin'` | Missing role defaults to superadmin. |
| Years | `useEffect([])` → `GET {AIMARKING}/get-year-data` | `headerYears`; first year auto-selected into `headerSelectedYearCode`. |
| Cycles | `useEffect([headerSelectedYearCode])` → `GET {AIMARKING}/get-cycle-data?YearCode=…` | `headerCycles`; first cycle auto-selected. |
| Organisations | `useEffect([isAdmin])` → `GET {AIMARKING}/organization-details?CustCode=ICME` (skipped for admin) | `organizations`; first org's `organizationid` → `selectedOrg`. |
| Menu | `allNavItems` | Role Management, Config Settings, Subject & Question, Marks Schema. |
| Header | `displayName` from `userInfo.username` → `username` → `'Super Admin'` | Avatar menu with **Logout**. |

### 4.2 Admin

Same page, with `isAdmin = (userRole === 'admin')`:

- Menu label becomes **User Management**; *Subject & Question* and *Marks Schema* are filtered out (`navItems`).
- `selectedCustomer` = `sessionStorage.customerCode || 'ICME'`, `selectedOrg` = `sessionStorage.orgCode` (pre-scoped; the organisation list is not loaded).
- Header subtitle "Admin Dashboard", role label "Admin".

Detailed admin docs: [`../admin/admin-login.md`](../admin/admin-login.md) and the other files in `../admin/`.

### 4.3 User (evaluator), normal mode

Lands on `/subject-dashboard` → `SubjectDashboard`:

| Step | Code | Effect |
|---|---|---|
| Restore context | `useEffect([selected])` reads `yearcode`/`yearCode`, `cyclecode`/`cycleCode` | Restores last Year/Cycle if present. |
| Years | `fetchYears()` → `GET {AIMARKING}/get-year-data` | First year auto-selected. Because `USE_MOCK_DATA_WHILE_BACKEND_IN_DEV = true`, an empty response **or a failed request** shows **mock data** (`MOCK_YEARS`; the same applies to cycles via `MOCK_CYCLES_BY_YEAR` and subjects via `MOCK_SUBJECTS_BY_CYCLE`). |
| Cycles | `useEffect([selectedYearCode])` → `fetchCycles()` → `GET {AIMARKING}/get-cycle-data` | Cycle cards. |
| Subjects | `handleCycleSelect` → `fetchSubjectsForCycle()` → `GET {AIMARKING}/get-subject-data` | Subject cards. |
| Tokens | `fetchTokens()` → `GET {AIMARKING}/list-workspace` | `totalTokens` → tokens button in `HeaderAccountControls`. |
| Workflow config | `fetchWorkflowConfig()` → `GET {AIMARKING}/get-config-info` | `allWorkflowStagesEnabled` → shows/hides *Student Export*. |

Selecting a subject (`handleSelect`) writes `subjectcode`, `subjectCode`, `yearcode`, `yearCode`, `cyclecode`, `cycleCode` to `sessionStorage` and sets `selected`, which renders `<OCREvaluation preselectedSubject … onBack onBackToCycles/>` **in place**. The URL stays `/subject-dashboard`.

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/subject-dashboard-landing.png — SubjectDashboard after login showing Year selector, cycle cards and subject cards]

### 4.4 User (evaluator), Standalone Mode

When `fetchStandaloneMode` returns `true` (or, on failure, `localStorage.standalone_mode === '1'`), the user lands directly on `/ocr-evaluation` → `OCREvaluation` with **no props**:

- `standaloneMode` state initialises from `localStorage.standalone_mode`.
- Org/customer/user codes come from `getFinalCodes()` → `getSessionCodes()` with hard-coded fallbacks (`'ICME01'`, `'ICME'`, `'ICME1'`).
- The "Back to subjects" pill is hidden (`onBack && !standaloneMode`).
- Logout is available via `HeaderAccountControls` → `handleLogout`.

Detailed user docs: [`../user/user-login.md`](../user/user-login.md) and the rest of `../user/`.

### 4.5 Unrecognised customer

A login with `customerCode` other than `ICME` stays on `/login` with "Access denied." See risk below.

---

## 5. Flow risks discovered

| Risk | Detail |
|---|---|
| Session left behind for non-ICME customers | `isLogin='true'` and identity keys are written **before** the `customerCode === 'ICME'` check, and the "Access denied." branch does not clear them. That user can then open `/subject-dashboard` directly and `RequireAuth` lets them in. |
| No server-enforced authorization | Role is read from `sessionStorage.userRole`, which the user can edit in DevTools to reach `/superadmin-dashboard`. Real enforcement must happen on the backend; Implementation behavior could not be conclusively determined from the current frontend source as to whether the backend checks roles (no auth header is sent). |
| Mock data in production | `SubjectDashboard.tsx` → `USE_MOCK_DATA_WHILE_BACKEND_IN_DEV = true` is a constant, not tied to `import.meta.env.DEV`; empty or failed Year/Cycle/Subject responses show sample data in any build, including production. |
