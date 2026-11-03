# Admin / Super Admin Area

This folder documents the administration area. All of it lives in one source file,
`src/pages/SuperAdminDashboard.tsx` (about 7,900 lines). That file holds the dashboard shell and every admin
section as local components.

## Documents

| Document | Covers |
|---|---|
| [admin-overview.md](admin-overview.md) | Layout, navigation, a table of differences between the two roles, and how the shared Year/Cycle/Customer/Organization selectors pass state to each section |
| [admin-dashboard.md](admin-dashboard.md) | The shell component `SuperAdminDashboard`: its state, effects, header, profile menu, logout, and the unreachable `dashboard` section (`AdminSubjectView`) |
| [admin-configuration.md](admin-configuration.md) | Config Settings (`SettingsSection`): workflow stages, Standalone Mode, Candidate Info, Answer Script / predefined mapping, OCR, evaluation thresholds, and the load and save payloads |
| [admin-subject-question.md](admin-subject-question.md) | Subject & Question (`SubjectQuestionPanel`): subject table, status toggle, delete, question preview, templates, and the import dialog |
| [admin-marks-schema.md](admin-marks-schema.md) | Marks Schema (`MarksSchemaSection`): upload of the marking scheme, conversion from Word to Markdown, saving questions, and the scheme viewer |
| [admin-user-management.md](admin-user-management.md) | Role/User Management (`RoleManagementSection`): user list, create, edit, delete, and the form rules |
| [admin-workflow.md](admin-workflow.md) | A short end-to-end setup checklist. The full narrative is in [../workflows/admin-workflow.md](../workflows/admin-workflow.md) |
| [admin-api-mapping.md](admin-api-mapping.md) | Every HTTP call made from `SuperAdminDashboard.tsx` and how each handles errors |
| [admin-dropdowns-and-forms.md](admin-dropdowns-and-forms.md) | Every dropdown and form, including the Customer → Organization → Year → Cycle dependency chain |

Related documentation (written by other authors): [../architecture/](../architecture/),
[../api/api-integration-mapping.md](../api/api-integration-mapping.md), [../workflows/](../workflows/), [../user/](../user/).

## Who counts as admin and who counts as superadmin

The role comes from `sessionStorage.userRole`, which `src/pages/Login.tsx` writes from the login response.
Each component works it out independently, with the same expression:

```ts
const loggedInRole = (sessionStorage.getItem('userRole') || 'superadmin').toLowerCase();
const isAdmin = loggedInRole === 'admin';
```

| `userRole` value | UI rendered |
|---|---|
| `admin` (any case) | Admin UI. The menu is reduced and the Customer/Organization selectors are hidden. See [admin-overview.md](admin-overview.md#role-differences). |
| `superadmin` | Super Admin UI (everything) |
| **Missing, empty, or any other value (for example `user`)** | **Super Admin UI.** The default in the expression is `'superadmin'`. |

The only explicit superadmin check is in `SubjectQuestionPanel` → `handleConfirmDeleteSubject` (~L1373). There,
the role must equal `superadmin` before subjects can be deleted.

## How users arrive here

| Step | Source |
|---|---|
| Route `/superadmin-dashboard` → `<RequireAuth><SuperAdminDashboard/></RequireAuth>` | `src/App.tsx` (~L42) |
| `RequireAuth` checks only that `sessionStorage.isLogin === 'true'`. It does **not** check the role. | `src/App.tsx` (~L25) |
| After login, if `customerCode` is `ICME` and `userRole` is `superadmin` or `admin`, the user is sent to `/superadmin-dashboard` | `src/pages/Login.tsx` (~L173–175) |
| A logged-in user who lands on `/login` again is redirected the same way | `src/pages/Login.tsx` (~L212) |

```text
Login.tsx ──(userRole ∈ {superadmin, admin}, customerCode = ICME)──▶ /superadmin-dashboard
                                                                   │
                                                 RequireAuth (isLogin only)
                                                                   ▼
                                       SuperAdminDashboard (opens on 'role-management')
```

> **Risk:** A logged-in user with role `user` can open `/superadmin-dashboard` directly. Neither the route nor the
> component checks for that, and the component renders the Super Admin UI for any role other than `admin`.
> Any protection depends on the backend.

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/admin-landing.png — Super Admin landing on Role Management with the full sidebar]

## Known issues and risks (as implemented)

These are documented here and have **not** been fixed. Each one is explained in the linked page.

| # | Issue | Where |
|---|---|---|
| 1 | Any logged-in non-admin role, including `user`, gets the Super Admin UI at `/superadmin-dashboard` | `App.tsx` `RequireAuth`; role default `'superadmin'` |
| 2 | An admin's Config Settings and User Management act on the **first** org of the customer, not on `sessionStorage.orgCode`, and the org select is hidden | [configuration](admin-configuration.md), [user mgmt](admin-user-management.md) |
| 3 | `save-config-info`: only lowercase `s001`/`s002` are recognised, any 2xx counts as success, and the localStorage mirror runs even after a failed save | [configuration](admin-configuration.md#response-handling) |
| 4 | `loadSettings` does not reset fields that are missing from the loaded config, so the previous org's values carry over | [configuration](admin-configuration.md#loadsettingsorgcode-l4224) |
| 5 | Config Settings does not reload subjects when Year/Cycle changes | [overview](admin-overview.md#shared-selectors-and-how-their-state-flows) |
| 6 | Each year change briefly empties the cycle, which shows a "No Year/Cycle…" toast in S&Q and Marks Schema | [overview](admin-overview.md#shared-selectors-and-how-their-state-flows) |
| 7 | A thrown `delete-subject` error aborts the remaining deletions | [subject & question](admin-subject-question.md#delete-n) |
| 8 | The import dialog's Organization select is shared with the page; the duplicate checks use the shell's Year/Cycle, not the dialog's | [subject & question](admin-subject-question.md#import-dialog) |
| 9 | Marks Schema: the viewer uses the session org; the convert endpoint has a different fallback host; picker and handler accept different file types; a generic success toast is shown after a question-save failure | [marks schema](admin-marks-schema.md) |
| 10 | User mgmt: `OrgCode` and `organizationId` carry the org **name**; edit goes through `create-user`; contact validation differs (8–20 vs 10–13); the stored password is pre-filled in the Edit form; the Create date `min` uses UTC | [user mgmt](admin-user-management.md) |
| 11 | Logout does not clear `localStorage` (`standalone_mode`, `org_*`) | [dashboard](admin-dashboard.md#logout) |
| 12 | Dead or unreachable code: `dashboard` / `AdminSubjectView`, `ImportPanel`, `ExcelInlineEditor`, JSON Creator, Advanced Add User, Approve/Reject, subject-scope branches of Pass Mark and Top N, `sharedProps`, `ROLE_OPTIONS` | [dashboard](admin-dashboard.md#other-components-in-the-file-that-are-never-rendered) |
