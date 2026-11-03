# Routing

Router: `react-router-dom` `BrowserRouter` declared in `src/App.tsx` → `App`. There are no nested routes, no layout route (`<Outlet/>`), no lazy-loaded routes, and no route-level data loaders. Every page is bundled eagerly.

See also: [application-flow.md](./application-flow.md), [authentication-authorization.md](./authentication-authorization.md).

---

## 1. Route table

| Path | Element | Guard | Who reaches it | How |
|---|---|---|---|---|
| `/` | `Login` | none | everyone | Typed URL / app root. `Login`'s `useEffect` immediately does `navigate('/login')` (push) when not signed in. |
| `/login` | `Login` | none (Login self-redirects a signed-in user) | everyone | Every logout handler; `RequireAuth`; `NotFound` link; `SandboxDashboard` guard. |
| `/register` | `Register` (imported from `./pages/register`) | none | public | **Typed URL only.** The "Sign up" link in `Login.tsx` is rendered with `className="hidden …"`. `Register` itself does `navigate("/register")` after the e-mail step. |
| `/ocr-evaluation` | `RequireAuth` → `OCREvaluation` | `isLogin === 'true'` | user in Standalone Mode | `Login.tsx` → `handleSubmit` and redirect `useEffect`. |
| `/subject-dashboard` | `RequireAuth` → `SubjectDashboard` | `isLogin === 'true'` | user (normal mode) | `Login.tsx` → `handleSubmit` and redirect `useEffect`. |
| `/superadmin-dashboard` | `RequireAuth` → `SuperAdminDashboard` | `isLogin === 'true'` (no role check) | superadmin, admin | `Login.tsx` → `handleSubmit` and redirect `useEffect`. |
| `/standalone-ocr` | `RequireAuth` → `StandaloneOCREvaluation` | `isLogin === 'true'` | nobody in practice | Nothing navigates here. The component requires `open`, `onClose`, `segments` props; routed without them, `open` is `undefined`, so its `<Dialog>` is closed and the page is **blank**. |
| `/sandbox` | `SandboxDashboard` | Self-guard: `useEffect` → if `sessionStorage.sandboxLogin !== 'true'` → `navigate('/login', { replace: true })` | nobody in practice | No code in `src/` writes `sandboxLogin`, so every visit bounces to `/login`. |
| `*` | `NotFound` | none | everyone | Any unknown path, including `/dashboard` (see §3). |

### `RequireAuth` (src/App.tsx)

```text
RequireAuth({children})
  sessionStorage.getItem('isLogin') === 'true' ? children : <Navigate to="/login" replace />
```

- Checks only the flag; no role, no expiry, no token.
- Does not remember the requested URL (no `state.from`), so after login the user goes to the role default, not the page they asked for.
- The flag is read on each render of the route element, so clearing `isLogin` in DevTools takes effect at the next navigation.

---

## 2. Programmatic navigation inventory

Result of searching every `navigate(`, `<Link`, `window.location` and `window.open` in `src/` (excluding `src/components/ui`):

| Source (file → symbol) | Target | Options / state | Trigger |
|---|---|---|---|
| `Login.tsx` → `handleSubmit` | `/superadmin-dashboard` | `{ replace: true }` | Login OK, ICME customer, role superadmin/admin |
| `Login.tsx` → `handleSubmit` | `/ocr-evaluation` | `{ replace: true }` | Login OK, other role, Standalone Mode |
| `Login.tsx` → `handleSubmit` | `/subject-dashboard` | `{ replace: true }` | Login OK, other role |
| `Login.tsx` → `useEffect([location])` | same three targets | `{ replace: true }` | Visiting `/login` while `isLogin === 'true'` |
| `Login.tsx` → `useEffect([location])` | `/login` | none (push) | Not signed in and path is not `/login` (i.e. `/`) |
| `Login.tsx` → `handleAccessDeniedOk` | `/login` | `{ replace: true }` | OK on the "Access Denied" dialog |
| `Login.tsx` hidden "Sign up" button | `/register` | none | Hidden in UI |
| `Register.tsx` "Sign in" button | `/` | none | Click |
| `Register.tsx` → `sendRegistrationEmail` | `/dashboard` | none | After send-email + activation + auto-login succeed, **and only if the login response uses the old `status`/`data` shape** (with the current `statusCode`/`userData` shape this branch is skipped) — **route does not exist → NotFound**. See [known-issues.md](../known-issues.md) REG-03. |
| `Register.tsx` → `handleSubmit` `.then()` | `/register` | none | After `sendRegistrationEmail` resolves |
| `Register.tsx` result dialog OK | `/` | none | Click OK |
| `SubjectDashboard.tsx` → `handleLogout` | `/login` | none | Logout from `HeaderAccountControls` |
| `OCREvaluation.tsx` → `handleLogout` | `/login` | none | Logout from `HeaderAccountControls` |
| `SuperAdminDashboard.tsx` → `handleLogout` | `/login` | none | Logout in avatar dropdown |
| `SandboxDashboard.tsx` guard / `handleLogout` | `/login` | `{ replace: true }` | Missing `sandboxLogin` / Logout |
| `NotFound.tsx` | `/login` | `<Link>` | "Back to Login" |
| `SessionTimeout.tsx` | `/login` | none | Inactivity timer — **component is never mounted** |
| `AppIframe.tsx` | `/login`, `<Link to="/dashboard">` | — | **File is not routed or imported** |
| `ProfileDropdown.tsx` | `/` | — | **Not imported** |
| `StandaloneAppHeader.tsx` | `/`, `<Link to="/dashboard">` | — | **Not imported** |
| `AppSidebar.tsx` | `<Link>` to `/dashboard` etc. | — | **Not imported** |
| `SuperAdminSidebar.tsx` | `<Link to="/superadmin-dashboard">` | — | **Not imported** |

No code passes router `state`, query strings, or URL params between pages. `useParams` is used only in the dead `AppIframe.tsx` (`appCode`). Cross-page data is handed over through `sessionStorage`/`localStorage` instead — see [state-management.md](./state-management.md).

---

## 3. In-page "routing" (views that do not change the URL)

Large parts of the app switch screens with component state rather than routes:

```text
/subject-dashboard  SubjectDashboard
   selected == null → Year / Cycle / Subject picker
   selected != null → <OCREvaluation preselectedSubject selectedSubjectLabel
                         preselectedYearName preselectedCycleName
                         onBack={()=>setSelected(null)}
                         onBackToCycles={…reset cycle…}/>

/superadmin-dashboard  SuperAdminDashboard
   activeSection: 'role-management' (initial) | 'settings' | 'subject-question'
                  | 'marks-schema' | 'dashboard' (no menu item sets this)
   'dashboard' → admin: <SubjectDashboard/> ; superadmin: <AdminSubjectView/>
                 AdminSubjectView → <OCREvaluation overrideOrgCode …/>

/ocr-evaluation  OCREvaluation
   … internal phases / dialogs …
   <StandaloneOCREvaluation open={!!standaloneOcrPopupData} …/> (popup)
```

Consequences:

- Browser Back from inside a subject on `/subject-dashboard` leaves the page entirely (to whatever was before), rather than returning to the subject list. The in-app "Back" controls (`onBack`, `onBackToCycles`) must be used.
- A refresh while inside a subject returns to the subject picker (the `selected` state is lost; Year/Cycle are restored from `sessionStorage`).
- Deep links to a specific subject or workspace are not possible.

Dead links: `/dashboard` is referenced by `Register.tsx`, `AppIframe.tsx`, `StandaloneAppHeader.tsx` and `AppSidebar.tsx` but is not a route; only the `Register.tsx` reference is in live code.

---

## 4. Case-sensitivity build risk

`src/App.tsx`:

```ts
import Register from "./pages/register";
```

The file on disk is `src/pages/Register.tsx`. Windows (NTFS) and default macOS (APFS, case-insensitive) resolve this. On Linux (most CI runners, Docker images, Azure/GitHub hosted Linux agents) Vite/Rollup fails with "Could not resolve './pages/register'". `tsconfig` does not set `forceConsistentCasingInFileNames`, so `tsc` will not warn either.

Fix (not applied – documentation only): change the import to `./pages/Register`.

---

## 5. Hosting requirement

`BrowserRouter` needs the host to return `index.html` for every non-asset path (SPA fallback). Without it, refreshing `/subject-dashboard` returns a server 404. No rewrite config file is present in the repository.
