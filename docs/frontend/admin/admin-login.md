# Signing In — Super Admin and Admin Roles

This page describes sign-in for the `superadmin` and `admin` roles. The full technical flow and error handling are in [../workflows/login-workflow.md](../workflows/login-workflow.md); the security model is in [../architecture/authentication-authorization.md](../architecture/authentication-authorization.md).

## 1. Sign in

1. Open `/login`, enter **Username or Email** and **Password**, click **Sign In**.
2. The login response's `userrole` / `userRole` is compared case-insensitively. `superadmin` and `admin` both go to **`/superadmin-dashboard`**, regardless of the organisation's Standalone Mode (`src/pages/Login.tsx` → `handleSubmit`).
3. The customer code must be `ICME`; otherwise "Access denied." is shown.

The same account-validity rules apply as for evaluators (Access Denied dialog for "not yet active" and "expired" accounts) — see [../workflows/login-workflow.md §2](../workflows/login-workflow.md#2-failure-branches).

## 2. What each role sees after login

Source: `src/pages/SuperAdminDashboard.tsx` → `SuperAdminDashboard`.

| | Super Admin | Admin |
|---|---|---|
| First section shown | **Role Management** | **User Management** (same section, different label) |
| Menu | Role Management, Config Settings, Subject & Question, Marks Schema | User Management, Config Settings |
| Header subtitle / role label | "Super Admin Dashboard" / "Super Admin" | "Admin Dashboard" / "Admin" |
| Customer / Organisation scope | Organisation list loaded from `organization-details?CustCode=ICME`; first organisation pre-selected | Fixed to the admin's own `customerCode` and `orgCode` from the session; organisation list is not loaded |
| Year / Cycle selectors | Loaded on entry from `get-year-data` and `get-cycle-data`; first of each pre-selected | Same |

If the session has no role value, the page treats the user as Super Admin (`sessionStorage.userRole || 'superadmin'`).

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/superadmin-landing.png — Super Admin dashboard immediately after login, Role Management section active, full four-item menu]

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/admin-landing.png — Admin dashboard immediately after login, "User Management" active, two-item menu]

The sidebar can be collapsed to icons with the chevron next to the logo. Section guides: the other documents in this folder (`../admin/`).

## 3. Signing out

Click your name/avatar at the top right → **Logout**. You return to `/login`. There is no automatic inactivity sign-out; sign out on shared machines.

## 4. Notes for administrators

- Role checks happen in the browser only. Any signed-in user who types `/superadmin-dashboard` reaches the page; protection of admin operations depends on the backend. Implementation behavior could not be conclusively determined from the current frontend source as to whether the backend enforces roles (no token or authorization header is sent).
- Configuration values edited in Config Settings are also cached in this browser's `localStorage` (`org_*`, `standalone_mode`, `workflowStages`). Evaluators' browsers pick up the server values at their next sign-in, through `get-config-info`.
