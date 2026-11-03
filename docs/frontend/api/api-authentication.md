# API Authentication

How identity reaches the backends. Short version: one `POST /login`, identity copied into `sessionStorage`, and every later request carries that identity as **ordinary query or body fields**. There is no token, no `Authorization` header and no 401 handling.

The full login flow, storage keys, role routing and logout are documented in [../architecture/authentication-authorization.md](../architecture/authentication-authorization.md); this page covers only what matters at the API layer.

---

## 1. Login API

| | |
|---|---|
| Endpoint | `POST {VITE_AIMARKING_API_BASE}/login` ([M01](./api-integration-mapping.md#m01-post-login)) |
| Caller | `src/pages/Login.tsx` → `handleSubmit` → `src/api.ts` → `loginUser` |
| Body | `{ username, password }` (trimmed) |
| Success | `statusCode` (or `status`) `=== 'S001'` and a non-empty `userData` (or `data`) array |
| Returned credential | **None.** The response contains the user record only; no token, cookie or expiry is used by the frontend. |

A second call, `GET get-config-info` ([M02](./api-integration-mapping.md#m02-get-get-config-info)), runs right after login for non-admin roles to decide whether to land on `/ocr-evaluation` (Standalone Mode) or `/subject-dashboard`.

---

## 2. Identity stored after login

| Key (`sessionStorage`) | Value | Used later as |
|---|---|---|
| `userCode`, `usercode` | `userData[0].usercode` | `userCode` / `UserCode` / `usercode` params |
| `orgCode`, `orgcode` | `userData[0].organizationcode` | `orgCode` / `OrgCode` / `orgcode` params |
| `customerCode`, `custcode` | `userData[0].customercode` | Rarely sent; most calls hard-code `'ICME'` |
| `userRole` | `userData[0].userrole` | Client-side UI trimming only (never sent) |
| `userInfo`, `user`, `username` | normalised / raw record, display name | Display name |
| `password` | the typed password, **plain text** | Not sent by live code (used only by the dead `AppIframe` SSO flow) |
| `isLogin` | `'true'` | `RequireAuth` route guard |

Full table: [../architecture/authentication-authorization.md §3](../architecture/authentication-authorization.md#3-session-and-storage-keys-written-during-authentication).

---

## 3. How later requests identify the user

No request in `src/` sets an `Authorization` header, bearer token, API key or `withCredentials` (searched `Authorization`, `Bearer`, `interceptors`, `withCredentials`). Instead, each call reads codes from `sessionStorage` at call time and sends them as fields:

| Field family | Example endpoints | Fallback when the key is missing |
|---|---|---|
| `orgCode` / `OrgCode` / `orgcode` / `org_code` | almost every call | `'ICME01'` (most OCREvaluation calls), `'ICMELIVE'` (workspace config fetch, `student-export`) |
| `custCode` / `CustCode` / `custcode` / `cust_code` | almost every call | Literal `'ICME'` (not read from storage in most calls) |
| `userCode` / `UserCode` / `usercode` | `get-subject-data`, `list-workspace`, `create-workspace`, `candidate-process-data`, `get-process-data`, processing-API calls, `get-user-details` | `'icmeuer01'` or `'ICME1'` |
| `loginName`, `userId` | `delete-user`, `create-user` | – |

OCREvaluation centralises some of this in `getFinalCodes()` (~L726: override prop → `getSessionCodes()` → `sessionStorage` → default), but many calls (create, upload, delete, export, review saves) read `sessionStorage.orgCode` / `userCode` directly.

The SuperAdmin console can scope requests to another organisation simply by sending a different `OrgCode` (selected in a dropdown). The frontend does not prove to the backend that the caller is allowed to do so.

---

## 4. Unauthorized and expired sessions

| Situation | Frontend behaviour |
|---|---|
| Backend returns 401/403 | Treated like any other HTTP error by that call's `catch` (toast or `console` only). No redirect, no session clearing. |
| Session expiry | None. `SessionTimeout.tsx` exists but is never mounted. The session lasts as long as the tab's `sessionStorage`. |
| Logout | Client-only; removes 8 `sessionStorage` keys. No backend logout endpoint. Lower-case duplicates and `localStorage` caches survive (see [../architecture/authentication-authorization.md §6](../architecture/authentication-authorization.md#6-logout-paths)). |
| Role checks | Client-only. `RequireAuth` checks `isLogin === 'true'` only, so any signed-in user can open `/superadmin-dashboard` by URL and the page will issue admin API calls (`get-user-details`, `create-user`, `save-config-info`, …) with the user's own codes. |

Whether the backends reject such calls: **Implementation behavior could not be conclusively determined from the current frontend source.**

---

## 5. Implications

| # | Implication |
|---|---|
| 1 | Any client that knows the base URLs and a valid `OrgCode`/`UserCode` pair can call the APIs directly; security depends entirely on backend-side controls (network restrictions, gateway, server checks) that are not visible here. |
| 2 | Changing `sessionStorage.orgCode` / `userCode` in DevTools changes whose data the UI requests. |
| 3 | Hard-coded fallbacks (`'ICME01'`, `'icmeuer01'`, `'ICME1'`) mean a partially cleared session still sends plausible identities instead of failing. |
| 4 | Workspace ownership (`isUserCodeMismatch`) is enforced only in the UI, by comparing `summary[0].userCode` from `candidate-process-data` with the session codes. |
| 5 | Introducing token auth later requires touching every call site, because there is no shared HTTP client. A shared axios instance would be the first step. |

See also: [api-overview.md §3](./api-overview.md#3-authentication-on-requests) · [../admin-user-comparison.md](../admin-user-comparison.md)
