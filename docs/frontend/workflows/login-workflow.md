# Login, Logout, Registration and Session-Expiry Workflow

Audience: developers, QA and support. Role-specific summaries: [../user/user-login.md](../user/user-login.md), [../admin/admin-login.md](../admin/admin-login.md). Technical reference: [../architecture/authentication-authorization.md](../architecture/authentication-authorization.md).

---

## 1. Login — step by step

| # | Actor / code | What happens | State / UI |
|---|---|---|---|
| 1 | User opens `/` or `/login` | `Login` renders. If not signed in and the path is `/`, `useEffect` pushes `/login`. If signed in and path is `/login`, user is redirected to their role page (step 12 rules, cached values). | Login card |
| 2 | User types | `handleInputChange('username' / 'password')` | `formData` |
| 3 | Button state | `submitDisabled = !username.trim() \|\| !password.trim() \|\| loading` | "Sign In" disabled until both fields have non-space text |
| 4 | Submit (`Enter` or click) | `handleSubmit`: `setError('')`, `setLoading(true)` | "Signing in, please wait..." text, inputs disabled, button "Signing In..." |
| 5 | Request | `loginUser(trimmedUser, trimmedPassword)` → `POST {VITE_AIMARKING_API_BASE}/login` body `{username, password}` | — |
| 6 | HTTP check | `!response.ok` → throw `"Network error during login"` | → Failure F2 |
| 7 | Body check | `statusCode`/`status` must be `"S001"` with a non-empty `userData`/`data` array; else throw `data.message` or `"Invalid username or password"` | → Failure F1 |
| 8 | Session (partial) | `loginUser` writes `user`, `userCode`, `usercode`, `orgCode`, `orgcode`, `customerCode`, `custcode`, `appcode` | sessionStorage |
| 9 | Normalise | `Login.tsx` builds `userData = {userCode, orgCode, customerCode, userRole, username}` from either key casing | — |
| 10 | Validity window | `getAccountAccess(rawUser.active …)` | blocked → Failure F3/F4 |
| 11 | Session (complete) | write `userInfo`, `isLogin='true'`, `username`, `password`, `userCode`, `orgCode`, `customerCode`, `userRole` | sessionStorage |
| 12 | Standalone check | `fetchStandaloneMode(orgCode, CUSTOMERCODE)` → `GET {VITE_AIMARKING_API_BASE}/get-config-info?OrgCode=…&CustCode=…&AppCode=AImarking`; caches `workflowStages`, `org_selected_stages_<org>`, `standalone_mode`, `org_standalone_<org>` in localStorage. Failure → `null` → cached `standalone_mode` used | localStorage |
| 13 | Customer check | `customerCode.toUpperCase() === 'ICME'` else Failure F5 | — |
| 14 | Route | superadmin/admin → `/superadmin-dashboard`; other + standalone → `/ocr-evaluation`; other → `/subject-dashboard` (all `replace: true`) | New page |
| 15 | Cleanup | `finally { setLoading(false) }` | — |

### Flow diagram

```text
                ┌──────────────┐
                │ /login form  │
                └──────┬───────┘
                       │ submit (both fields non-blank)
                       ▼
          POST {AIMARKING}/login  (src/api.ts loginUser)
                       │
     fetch rejects ────┼──── !response.ok ──── status != S001 / empty user
          │            │            │                    │
          ▼            │            ▼                    ▼
   F0 browser error    │   F2 "Network error      F1 data.message or
   (e.g. "Failed to    │      during login"          "Invalid username
    fetch")            │                              or password"
                       ▼ S001 + user
          write partial session (api.ts)
                       │
          getAccountAccess(active)
            ├── "0"  → clearAuthSession → F3 Access Denied (not yet active)
            ├── "2"… → clearAuthSession → F4 Access Denied (expired/inactive)
            └── ok
                       ▼
          write full session (Login.tsx), isLogin='true'
                       │
          GET {AIMARKING}/get-config-info  → standalone? (null → cached)
                       │
          customerCode == ICME ?
            ├── no  → F5 "Access denied." (session NOT cleared)
            └── yes
                       ▼
          role superadmin|admin ──▶ /superadmin-dashboard
          else standalone      ──▶ /ocr-evaluation
          else                 ──▶ /subject-dashboard
```

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/login-signing-in.png — Login form during submit showing "Signing in, please wait..." and the disabled "Signing In..." button]

---

## 2. Failure branches

| Id | Trigger | Where shown | Message | Session after |
|---|---|---|---|---|
| F0 | Network down, DNS, CORS block | red text under the password field (`error`) | Browser's `TypeError` message (commonly "Failed to fetch") | unchanged (nothing written) |
| F1 | Wrong username/password (`F001`) or any non-`S001` status, or `S001` with no user rows | red text | Backend `message`, else "Invalid username or password" | unchanged |
| F2 | HTTP 4xx/5xx from `/login` | red text | "Network error during login" | unchanged |
| F3 | `active = "0"` (before From Date) | "Access Denied" `AlertDialog` | "Your account is still yet to active. Please contact the administrator." | cleared by `clearAuthSession()`; OK resets the form and replaces to `/login` |
| F4 | `active = "2"` (after To Date) or legacy `false/n/no/inactive/expired` | "Access Denied" `AlertDialog` | "Your account has expired or is inactive. Please contact the administrator." | cleared; OK as above |
| F5 | Valid login but `customerCode` ≠ `ICME` | red text | "Access denied." | **left signed in** (`isLogin='true'`) — known defect; the user can open protected URLs directly |
| — | `get-config-info` fails | not shown (only `console.warn`) | — | Login continues using the cached Standalone flag |

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/login-invalid-credentials.png — Login form with the red inline error after a wrong password]

---

## 3. Returning to the app while signed in

- Refresh on any protected page: `sessionStorage` survives, `RequireAuth` passes, page reloads its data.
- Opening `/login` while signed in: redirected by the `Login` `useEffect` using cached `userRole` and `localStorage.standalone_mode` (no API call).
- Opening `/` while signed in: the login form is shown (no redirect) — submitting logs in again.
- New browser tab (not "Duplicate"): `sessionStorage` is empty → `/login`.
- Closing the tab ends the session.

---

## 4. Logout

```text
User → avatar / account menu → "Logout"
  SubjectDashboard / OCREvaluation: HeaderAccountControls → onLogout → handleLogout
  SuperAdminDashboard: header DropdownMenu → handleLogout
     remove sessionStorage: isLogin, userInfo, username, password,
                            userCode, orgCode, customerCode, userRole
     (OCREvaluation also removes localStorage.userName)
     navigate('/login')   (push – Back returns to the protected URL,
                           where RequireAuth redirects to /login again)
```

Not removed: `user`, `usercode`, `orgcode`, `custcode`, `appcode`, Year/Cycle/Subject/Workspace keys, `icme_ocr.*` drafts, all `localStorage` caches. No backend call is made. See [authentication-authorization.md §6](../architecture/authentication-authorization.md#6-logout-paths).

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/logout-menu.png — the account dropdown on the Super Admin header with name, role label and red Logout item]

---

## 5. Session expiry

- **Inactivity:** none. `src/components/SessionTimeout.tsx` (60 s inactivity → toast "Session expired" → `/login`) exists but is never rendered.
- **Server-side expiry:** not applicable on the client — there is no token. If the backend ever rejects a request with 401/403, there is no global handler; the calling screen shows its own generic error and the user remains "signed in".
- **Account validity window:** enforced only at login time (step 10). An account that expires while a user is working is not signed out.

---

## 6. Registration (summary)

Full page reference: [../pages/register-page.md](../pages/register-page.md).

> Important: in the current source the form **cannot pass client validation**. `formData.organizationName` is required, but no input renders it, so `handleSubmit` always stops at `if (hasErrors)` and the error is never displayed. The flow below is what the code would do once that is fixed.

```text
/register (typed URL – the Login "Sign up" link is hidden)
  fill form → client validation (names, e-mail, username 4–20 alnum,
              strong password, confirm, contact 10–12 digits, activation dates,
              Customer, Organization, EULA)
  → registerUser()  POST {VITE_API_BASE_URL}/aiapps/AIProductApi/signup
       FL001 / O001 / LO001 / EM001 / other → error banner
       S001 →
         sendRegistrationEmail()  POST {VITE_AIAPPS_API_BASE}/AIProductApi/send-email
            status 'success' → success dialog
               → POST {VITE_AIAPPS_API_BASE}/AIProductApi/updateActiveRegisteredUser
               → loginUser() → (old response shape only) write session → navigate('/dashboard') → 404 page
            otherwise → error dialog (message text not set – defect)
         then navigate('/register')
  dialog OK → navigate('/')
```

---

## 7. QA checklist

| Case | Expected |
|---|---|
| Blank username or password | Sign In disabled |
| Wrong password | Inline backend message / "Invalid username or password" |
| Backend down | "Failed to fetch" or "Network error during login" |
| `active = 0` user | Access Denied (not yet active); OK returns to empty login |
| `active = 2` user | Access Denied (expired); OK returns to empty login |
| Superadmin | `/superadmin-dashboard`, Role Management first |
| Admin | `/superadmin-dashboard`, "User Management", no Subject & Question / Marks Schema |
| User, Standalone off | `/subject-dashboard` |
| User, Standalone on | `/ocr-evaluation`, no "Back to subjects" pill |
| Logout then Back | Returns to `/login` via `RequireAuth` |
| Non-ICME customer | "Access denied." — then verify (defect) that `/subject-dashboard` is still reachable |
