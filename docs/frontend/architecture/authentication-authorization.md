# Authentication & Authorization

Summary: authentication is a single `POST /login` call. On success the frontend writes identity values to `sessionStorage` and sets `isLogin = 'true'`. Route protection, role routing and logout are all client-side. No token is issued or sent, and no HTTP 401/403 handling exists.

Related: [../workflows/login-workflow.md](../workflows/login-workflow.md) (step-by-step), [routing.md](./routing.md), [state-management.md](./state-management.md), [../pages/register-page.md](../pages/register-page.md).

---

## 1. Login API

| Item | Value |
|---|---|
| Caller | `src/pages/Login.tsx` → `handleSubmit` → `loginUser(userName, password)` in `src/api.ts` |
| Method / URL | `POST {VITE_AIMARKING_API_BASE}/login` (fallback: hard-coded AIMarking API host) |
| Headers | `Content-Type: application/json`, `accept: */*`, `Cache-Control: no-cache`, `Pragma: no-cache`, `Expires: 0` |
| Body | `{ "username": <trimmed>, "password": <trimmed> }` |
| Credentials | Not sent (`fetch` default `credentials: 'same-origin'`; cross-origin cookies are not used). |

Both inputs are `.trim()`-ed before sending, so passwords with leading/trailing spaces cannot be used.

### Response handling in `loginUser`

Two response shapes are accepted:

| Shape | Status field | User array |
|---|---|---|
| New | `statusCode` | `userData` |
| Old | `status` | `data` |

```text
!response.ok                                 → throw "Network error during login"
statusCode|status === 'S001' && array non-empty
     → sessionStorage writes (see §3) → return data
statusCode|status === 'F001'                 → throw data.message || 'Invalid username or password'
anything else (incl. S001 with empty array)  → throw data.message || 'Invalid username or password'
```

A network/CORS failure makes `fetch` reject with the browser's `TypeError` (e.g. "Failed to fetch"); that message is shown as-is.

### Fields read from `userData[0]` (Login.tsx → `handleSubmit`)

| Normalised field | Accepted source keys | Use |
|---|---|---|
| `userCode` | `usercode`, `userCode` | `sessionStorage.userCode` |
| `orgCode` | `organizationcode`, `orgCode` | `sessionStorage.orgCode`; `get-config-info` `OrgCode` |
| `customerCode` | `customercode`, `customerCode` | `sessionStorage.customerCode`; must equal `ICME` (case-insensitive) |
| `userRole` | `userrole`, `userRole` | `sessionStorage.userRole`; routing |
| `username` | `username`, else typed name | `userInfo.username` (display name) |
| `active` | `active`, `Active`, `ACTIVE`, `isActive`, `isactive` | `getAccountAccess()` |

`Login.tsx` also re-checks `status !== 'S001'` after `loginUser` returns; because `loginUser` already throws on every non-`S001` value, that branch cannot be reached.

---

## 2. Account `active` states — `src/lib/session.ts` → `getAccountAccess`

| `active` value (trimmed, lower-cased) | Allowed | Message shown (in "Access Denied" `AlertDialog`) |
|---|---|---|
| missing / empty | yes | — |
| `"0"` | no | `ACCOUNT_MESSAGES.notYetActive`: "Your account is still yet to active. Please contact the administrator." |
| `"1"` | yes | — |
| `"2"`, `"false"`, `"n"`, `"no"`, `"inactive"`, `"expired"` | no | `ACCOUNT_MESSAGES.inactive`: "Your account has expired or is inactive. Please contact the administrator." |
| any other value | yes | — |

Meaning (from the source comments): `0` = before the user's From Date; `1` = inside the From/To window; `2` = after the To Date.

When blocked, `Login.tsx` calls `clearAuthSession()` (because `loginUser` has already written identity keys), sets `accessDeniedMessage`, and opens the dialog. The dialog has no close/cancel; **OK** → `handleAccessDeniedOk` → `clearAuthSession()`, reset form, `navigate('/login', { replace: true })`.

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/login-access-denied.png — the "Access Denied" AlertDialog with the illustration, message text and blue OK button]

---

## 3. Session and storage keys written during authentication

| Key | Storage | Written by | Read by | Purpose |
|---|---|---|---|---|
| `user` | session | `api.ts` → `loginUser` (raw `userData[0]` JSON) | `lib/session.ts` → `getSessionCodes`; `api.ts` → `getAppDetails` | Raw login record. |
| `userCode` | session | `loginUser`; `Login.tsx` → `handleSubmit`; `Register.tsx` | `getSessionCodes`, `OCREvaluation.tsx`, `SubjectDashboard.tsx`, `SuperAdminDashboard.tsx` | Current user code for API params. |
| `usercode` | session | `loginUser` | `getSessionCodes`, `OCREvaluation.tsx` | Same value, lower-case key. |
| `orgCode` | session | `loginUser`; `handleSubmit`; `Register.tsx` | `getSessionCodes`, `Login.tsx` redirect effect, all dashboards | Organisation code. |
| `orgcode` | session | `loginUser` | `getSessionCodes`, `OCREvaluation.tsx`, `api.ts` → `fetchDropdownOptions` | Same value, lower-case key. |
| `customerCode` | session | `loginUser`; `handleSubmit`; `Register.tsx` | `OCREvaluation.tsx`, `SuperAdminDashboard.tsx` | Customer code (expected `ICME`). |
| `custcode` | session | `loginUser` | `OCREvaluation.tsx` | Same value, lower-case key. Note `getSessionCodes` ignores it and always returns `custcode: 'ICME'`. |
| `appcode` | session | `loginUser` (keeps existing or sets `'IG'`) | `getSessionCodes`, `api.ts` | Legacy app code from the item-generation product. |
| `userInfo` | session | `handleSubmit` (normalised `{userCode, orgCode, customerCode, userRole, username}`); `Register.tsx` | `HeaderAccountControls` (`email`), dashboards (`displayName`), `getSessionCodes` (fallback) | Display name, e-mail lookup. |
| `isLogin` | session | `handleSubmit` (`'true'`); `Register.tsx` | `App.tsx` → `RequireAuth`; `Login.tsx` redirect effect | The authentication flag. |
| `username` | session | `handleSubmit` (typed name); `Register.tsx` | dashboards (display-name fallback) | Display name. |
| `password` | session | `handleSubmit` (**plain text**); `Register.tsx` | `AppIframe.tsx` (dead) | Kept for a legacy SSO flow; security risk. |
| `userRole` | session | `handleSubmit`; `Register.tsx` | `Login.tsx` redirect effect, `SuperAdminDashboard.tsx` (`isAdmin`), `SubjectDashboard.tsx`, `OCREvaluation.tsx` | Role routing / UI trimming. |
| `standalone_mode` | local | `Login.tsx` → `fetchStandaloneMode` (`'1'`/`'0'`); also OCREvaluation, SuperAdminDashboard | `Login.tsx`, `OCREvaluation.tsx` | Standalone Mode cache used as fallback. |
| `workflowStages` | local | `fetchStandaloneMode`; OCREvaluation | `OCREvaluation.tsx` | Enabled workflow stages cache. |
| `org_selected_stages_<orgCode>` | local | `fetchStandaloneMode`; SuperAdminDashboard | `Login.tsx` (`isStandaloneOcrOnly`, unused result), SuperAdminDashboard | Per-org stage cache. |
| `org_standalone_<orgCode>` | local | `fetchStandaloneMode`; SuperAdminDashboard | SuperAdminDashboard | Per-org standalone cache. |

Keys removed by `clearAuthSession()` (`src/lib/session.ts`):

- `sessionStorage`: `isLogin`, `userInfo`, `user`, `username`, `password`, `userCode`, `usercode`, `orgCode`, `orgcode`, `customerCode`, `custcode`, `userRole`, `appcode`
- `localStorage`: `user`, `userInfo`, `userName`, `authToken`, `userSession`

---

## 4. Role detection and routing

Implemented in `Login.tsx` → `handleSubmit` (fresh login) and the `useEffect([location, navigate])` (revisit of `/login` while signed in):

| Check | Value | Destination |
|---|---|---|
| `customerCode.trim().toUpperCase() !== 'ICME'` | — | Stay on login, inline error "Access denied." (fresh login only) |
| `userRole.trim().toLowerCase()` | `superadmin` or `admin` | `/superadmin-dashboard` |
| other role and Standalone Mode on | e.g. `user`, `evaluator`, empty | `/ocr-evaluation` |
| other role | | `/subject-dashboard` |

Standalone Mode on a fresh login comes from `GET {VITE_AIMARKING_API_BASE}/get-config-info?OrgCode=<org>&CustCode=<CUSTOMERCODE>&AppCode=AImarking` (`fetchStandaloneMode`), reading `data[0].configSetting.standalone` and `.workflowStages`. On any failure (non-OK, empty array, missing field, exception) it returns `null` and the cached `localStorage.standalone_mode` is used. The redirect `useEffect` uses only the cached value (no request).

### Role-based UI inside pages (not route protection)

| Page | Check | Effect |
|---|---|---|
| `SuperAdminDashboard.tsx` | `isAdmin = sessionStorage.userRole === 'admin'` (default role `'superadmin'` when missing) | Admin: "User Management" label, no Subject & Question / Marks Schema, organisation pre-scoped, no org list fetch. |
| `SubjectDashboard.tsx` | `isAdmin` | Header top padding only. |

---

## 5. Route protection

`RequireAuth` in `src/App.tsx` guards `/ocr-evaluation`, `/subject-dashboard`, `/superadmin-dashboard`, `/standalone-ocr` using only `isLogin === 'true'`. **There is no role guard**: any signed-in user can open `/superadmin-dashboard` by URL. Whether the backend rejects admin calls from non-admin users could not be determined — Implementation behavior could not be conclusively determined from the current frontend source (no `Authorization` header or token is sent on any request, checked `src/api.ts`, all `axios`/`fetch` calls in pages).

`/sandbox` has its own guard on `sessionStorage.sandboxLogin`, which is never written.

---

## 6. Logout paths

| Location | Handler | Keys removed | Then |
|---|---|---|---|
| `SubjectDashboard.tsx` | `handleLogout` (via `HeaderAccountControls` → `onLogout`) | session: `isLogin`, `userInfo`, `username`, `password`, `userCode`, `orgCode`, `customerCode`, `userRole` | `navigate('/login')` |
| `OCREvaluation.tsx` | `handleLogout` (via `HeaderAccountControls`) | same 8 session keys + `localStorage.userName` | `navigate('/login')` |
| `SuperAdminDashboard.tsx` | `handleLogout` (avatar dropdown → Logout) | same 8 session keys | `navigate('/login')` |
| `Login.tsx` | `handleAccessDeniedOk` / blocked login | `clearAuthSession()` (full list) | `navigate('/login', {replace:true})` |
| `SandboxDashboard.tsx` | `handleLogout` | `sandboxLogin`, `sandboxUsername`, `sandboxDisplayName` | `/login` (replace) |
| `ProfileDropdown.tsx`, `AppIframe.tsx` | — | — | Not mounted (dead). |

Observations:

- The three live logout handlers do **not** use `clearAuthSession()`, so `user`, `usercode`, `orgcode`, `custcode`, `appcode`, all `localStorage` caches, and workflow keys (`subjectcode`, `yearcode`, `cyclecode`, `workspaceid`, `icme_ocr.*`) survive logout. A different user signing in on the same tab inherits stale values until they are overwritten; `getSessionCodes()` prefers `usercode`/`orgcode` (lower-case) only after the camel-case keys, so stale lower-case keys mostly matter when the new login lacks a field.
- No backend logout endpoint is called.

---

## 7. Session timeout

`src/components/SessionTimeout.tsx` implements an inactivity timer (default `timeoutMs = 60_000`; resets on `mousemove`, `mousedown`, `keydown`, `scroll`, `touchstart`, `wheel`, `visibilitychange`; on expiry shows a destructive shadcn toast "Session expired" and `navigate('/login')`, without clearing storage).

**It is not rendered anywhere** (search for `<SessionTimeout` and `import SessionTimeout` returns nothing). In the running app:

- There is no inactivity timeout.
- The session lasts as long as the browser tab's `sessionStorage`: it survives refreshes, ends when the tab is closed, and is not shared with new tabs (a tab opened with "Duplicate tab" copies it).

---

## 8. Unauthorized / expired responses

There is no handling of HTTP 401/403: no axios interceptor, no `fetch` wrapper, no check for `status === 401` anywhere in `src/` (searched `interceptors`, `401`). A rejected request surfaces only as that call site's generic `catch` (usually a sonner `toast.error` or `console.error`). The user stays on the page with `isLogin='true'`.

---

## 9. Security observations (documentation only, nothing changed)

| # | Observation | Location |
|---|---|---|
| 1 | Plain-text password in `sessionStorage.password` (readable by any script on the origin, e.g. via XSS). | `Login.tsx` → `handleSubmit`; `Register.tsx` |
| 2 | Client-only role routing; `/superadmin-dashboard` reachable by any signed-in user. | `App.tsx` → `RequireAuth` |
| 3 | Non-ICME customers keep a valid client session after "Access denied." | `Login.tsx` → `handleSubmit` (keys written before the customer check, not cleared) |
| 4 | No inactivity timeout (component unmounted). | `SessionTimeout.tsx` |
| 5 | Logout leaves identity keys behind. | §6 |
| 6 | Hard-coded AES key `'Excelsoft'` for the registration link. | `Register.tsx` → `sendRegistrationEmail` |
