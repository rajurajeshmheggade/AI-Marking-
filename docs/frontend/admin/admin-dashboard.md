# Admin Dashboard Shell (`SuperAdminDashboard`)

Source: `src/pages/SuperAdminDashboard.tsx` → `SuperAdminDashboard` (~L7607–7923). This is the default export,
mounted at `/superadmin-dashboard`.

## Module-level constants used by the shell

| Constant | Value | Line |
|---|---|---|
| `API_BASE` | `import.meta.env.VITE_ICMEPRODUCT_API_BASE`, with a hard-coded fallback host | ~L51 |
| `API_BASE1` | `import.meta.env.VITE_AIMARKING_API_BASE`, with a hard-coded fallback host | ~L52 |
| `REPO_BASE` | `import.meta.env.VITE_REPO_BASE`, with a hard-coded fallback host | ~L53 |
| `ActiveSection` | `'dashboard' \| 'subject-question' \| 'marks-schema' \| 'settings' \| 'role-management'` | ~L55 |

> If a `VITE_*` variable is missing, the fallback hosts are compiled into the bundle and used silently.

## State

| State | Initial value | Purpose |
|---|---|---|
| `activeSection` | `'role-management'` | Which section `<main>` renders |
| `isSidebarCollapsed` | `false` | Sidebar width and label visibility |
| `organizations`, `loadingOrgs` | `[]`, `false` | Filled by the organization effect. **Not used by any child.** |
| `selectedCustomer` | admin: `sessionStorage.customerCode` (or `'ICME'`); otherwise `'ICME'` | Only placed in `sharedProps`, which is unused |
| `selectedOrg` | admin: `sessionStorage.orgCode`; otherwise `''` | Only placed in `sharedProps`, which is unused |
| `headerYears`, `headerSelectedYearCode`, `headerYearsLoading` | `[]`, `''`, `false` | Shared Year selector |
| `headerCycles`, `headerSelectedCycleCode`, `headerCyclesLoading` | `[]`, `''`, `false` | Shared Cycle selector |

Derived values computed on every render: `loggedInRole`, `loggedInCustomer`, `loggedInOrg` and `isAdmin`
(from `sessionStorage`), plus `displayName`, `allNavItems` and `navItems`.

## Effects

| # | Trigger | Request | Response handling | State |
|---|---|---|---|---|
| 1 | Mount | `GET ${API_BASE1}/get-year-data` (no params) | Accepts a bare array or `data.data`. Maps `yearid/yearId`, `yearname/yearName` and `yearcode/yearCode`, then drops rows without a code. | `headerYears`. The first `yearcode` goes into `headerSelectedYearCode`. On error, only `console.error` (no toast). |
| 2 | `headerSelectedYearCode` changes | `GET ${API_BASE1}/get-cycle-data?YearCode=<code>` | Same tolerant mapping for `cycleid`, `cyclename` and `cyclecode` | Before the call it clears `headerCycles` and `headerSelectedCycleCode`. Afterwards it sets the list and the first `cyclecode`. On error, only `console.error`. If the year is `''`, both are cleared and no call is made. |
| 3 | Mount (`[isAdmin]`), **superadmin only** | `GET ${API_BASE1}/organization-details?CustCode=ICME` | Uses `orgRes.data.data` when it is an array | `organizations`, and `selectedOrg` = first `organizationid`. The result is not consumed anywhere. |

## Year/Cycle selector factory

`renderYearCycle(variant)` (~L7723) returns `<YearCycleDropdowns>` bound to the shell state. `onYearChange`
is `setHeaderSelectedYearCode` and `onCycleChange` is `setHeaderSelectedCycleCode`. The `'compact'` variant
is used in Subject & Question and Marks Schema, and the `'settings'` variant in Config Settings.

`YearCycleDropdowns` (~L548–606):

| Control | DOM id | Disabled when | Options |
|---|---|---|---|
| Select Year | `header-year-select` | `yearsLoading` | While loading: a single "Loading...". Otherwise one option per year, labelled `yearname` (or `yearcode` when the name is empty) |
| Select Cycle | `header-cycle-select` | `cyclesLoading \|\| cycles.length === 0` | "Loading..." / "No cycles" / one option per cycle |

Both DOM ids are fixed, and the selector is rendered once per section. Only one section is mounted at a time, so
the ids do not collide.

## Header and profile menu

| Element | Content / behaviour |
|---|---|
| Title `<h1>` | `navItems.find(n => n.key === activeSection)?.label`. For `dashboard` this would be empty, because that key is not in `navItems`. |
| Subtitle | `Admin Dashboard` or `Super Admin Dashboard` |
| Profile trigger | Shows `displayName` and the role text (hidden below the `sm` breakpoint), an avatar with the first letter, and a chevron |
| `displayName` | `JSON.parse(sessionStorage.userInfo).username` (trimmed). Falls back to `sessionStorage.username`, then `'Super Admin'`. |
| Dropdown | A label (name + role), a separator, and a **Logout** item |

### Logout

`handleLogout` (~L7750):

```text
click "Logout"
  → sessionStorage.removeItem for: isLogin, userInfo, username, password, userCode, orgCode, customerCode, userRole
  → navigate('/login')
```

There is no API call. `localStorage` is **not** cleared, so keys such as `standalone_mode`, `workflowStages` and
all the `org_*` keys survive logout and are seen by the next user of the same browser.

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/admin-profile-menu.png — open profile dropdown with Logout]

## `<main>` routing

| `activeSection` | Rendered | `<main>` classes |
|---|---|---|
| `role-management` | `<RoleManagementSection />` | `flex flex-col p-0` |
| `settings` | `<SettingsSection API_BASE1 yearCode cycleCode yearCycleSelector />` | `flex flex-col p-0` |
| `subject-question` | `<SubjectQuestionPanel yearCode cycleCode yearCycleSelector />` | `flex flex-col p-4` |
| `marks-schema` | `<MarksSchemaSection API_BASE API_BASE1 yearCode cycleCode yearCycleSelector />` | `flex flex-col p-6` |
| `dashboard` | admin: `<SubjectDashboard />` (imported from `./SubjectDashboard`); superadmin: `<AdminSubjectView />` | `flex flex-col` |

## The `dashboard` section and `AdminSubjectView`

**Status: unreachable.** `'dashboard'` is not in `allNavItems`, the initial section is `'role-management'`, and
a search for `setActiveSection(` finds only the nav-item handler. The code is kept, but no user can get to it.

What `AdminSubjectView` (~L82–386) would do if it were reachable:

| Aspect | Behaviour |
|---|---|
| Organizations | `GET ${API_BASE1}/organization-details?CustCode=<selectedCustomer>`, re-run on customer change. The first org is auto-selected. On error: toast "Failed to load organizations". |
| Subjects | `GET ${API_BASE1}/subject-list` with params `OrgCode=<organizationcode>`, `CustCode=ICME` and no-cache headers. Very tolerant parsing (array / `subjects` / `data` / `items` / `result` / `subjectList`). Keeps only `status === 1`. Errors are only logged. |
| UI | A card grid (name, code, Active/Inactive badge, workspace count) with search. Customer/Org selects are shown only to a superadmin. |
| Empty states | "no subject yet / please contact to admin" when there are no subjects; "No matching subjects found" when the search matches nothing |
| Card click | `handleSelect` writes `sessionStorage.subjectcode` and `sessionStorage.subjectCode`, then renders `<OCREvaluation preselectedSubject … overrideOrgCode onBack/>` inline |

## Other components in the file that are never rendered

| Component | Notes |
|---|---|
| `ExcelInlineEditor` (~L395) | Editable sheet grid that POSTs to an API URL typed in by the user. Never rendered. |
| `ImportPanel` (~L2650) | Simulated import: waits 1.2 s, then shows a success toast. No API call. Never rendered. |
| Question JSON Creator dialog (inside `SubjectQuestionPanel`) | Its only opener button is commented out (~L1539) |
| Advanced Add User modal (inside `RoleManagementSection`) | `setShowAdvancedAddUser(true)` is never called |
| `SandboxDashboard` import (~L31) | Imported but not used |
