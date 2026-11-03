# Admin Area: Overview

Source: `src/pages/SuperAdminDashboard.tsx`. The shell component is `SuperAdminDashboard` (~L7607–7923).

## Layout

```text
┌──────────────┬──────────────────────────────────────────────────────────────┐
│ Sidebar      │ Header: <section label>  /  "Admin Dashboard"|"Super Admin…" │
│  logo        │                                   [profile ▾ → Logout]       │
│  "Admin      ├──────────────────────────────────────────────────────────────┤
│   Panel"     │ <main>: one section component, chosen by activeSection        │
│  [collapse]  │   each section draws its own selector row:                    │
│  nav items   │   [Customer][Organization][Year][Cycle]  (+ section controls) │
│              ├──────────────────────────────────────────────────────────────┤
│              │ Footer: "Copyright © 2026 | Excelsoft … | Version: V.1.0.0"   │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

| Region | Implementation | Notes |
|---|---|---|
| Sidebar | `SuperAdminDashboard` (~L7774–7812) | `isSidebarCollapsed` switches the width between `w-20` and `w-16 lg:w-56`. The collapse button appears only at the `lg` breakpoint. Item labels are hidden below `lg` and whenever the sidebar is collapsed. |
| Nav items | `allNavItems` / `navItems` (~L7759–7767) | Clicking an item calls `setActiveSection(item.key)`. The active item is shown with a blue background. |
| Header | (~L7818–7864) | Title = label of the active nav item. Subtitle = `Admin Dashboard` or `Super Admin Dashboard`. On the right is the profile dropdown. |
| Main | (~L7867–7914) | Renders exactly one section, conditionally. |
| Footer | (~L7916) | Static text. |

## Navigation

The initial section is `activeSection = 'role-management'` (~L7610).

| Order | `activeSection` key | Label (superadmin) | Label (admin) | Component |
|---|---|---|---|---|
| 1 | `role-management` | Role Management | **User Management** | `RoleManagementSection` |
| 2 | `settings` | Config Settings | Config Settings | `SettingsSection` |
| 3 | `subject-question` | Subject & Question | *(hidden)* | `SubjectQuestionPanel` |
| 4 | `marks-schema` | Marks Schema | *(hidden)* | `MarksSchemaSection` |
| — | `dashboard` | not in the menu | not in the menu | `AdminSubjectView` (superadmin) / `SubjectDashboard` (admin). **Unreachable**: nothing calls `setActiveSection('dashboard')`. |

Switching sections **unmounts** the previous component. Every section re-fetches its organizations and data each
time it is opened, and its local state (selected org, search text, open dialogs) is lost. Only the Year/Cycle
selection survives, because it is held in the shell.

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/admin-sidebar-admin-vs-superadmin.png — side-by-side sidebar for admin (2 items) and superadmin (4 items)]

## Role differences

The role is resolved as described in [README.md](README.md#who-counts-as-admin-and-who-counts-as-superadmin).

| Feature | Superadmin | Admin | Source |
|---|---|---|---|
| Menu: Subject & Question | Shown | Hidden | `navItems` (~L7765) |
| Menu: Marks Schema | Shown | Hidden | `navItems` (~L7765) |
| Label of the first menu item | Role Management | User Management | `allNavItems` (~L7760) |
| Header subtitle / profile role text | "Super Admin Dashboard" / "Super Admin" | "Admin Dashboard" / "Admin" | (~L7823, L7839, L7850) |
| Shell organization fetch | Runs (the result is unused) | Skipped | `SuperAdminDashboard` effect (~L7694) |
| Config Settings: Customer + Organization dropdowns | Shown | Hidden (Year/Cycle still shown) | `SettingsSection` (~L4854) |
| Config Settings: organization actually edited | Chosen in the dropdown (default: first org) | **The first org returned by `organization-details`**. There is no code path that uses `sessionStorage.orgCode`. | `SettingsSection` `fetchOrganizations` (~L3840) |
| User Management: Customer + Organization dropdowns | Shown | Hidden | `RoleManagementSection` (~L7016) |
| User Management: initial customer | `ICME` | `sessionStorage.customerCode` (default `ICME`) | (~L6499) |
| User Management: initial org | `''` | `sessionStorage.orgCode`, but this is **overwritten** by the first org's `organizationid` once `organization-details` returns | (~L6502, L6577) |
| User Management: rows with role `admin` | Already removed when mapping (`userrole !== 'admin'`) | Also removed in `filteredRoles` (`matchRole`) | (~L6598, L6647) |
| Subject & Question: Customer/Org dropdowns | Shown | Hidden (the section is not reachable for an admin anyway) | `SubjectQuestionPanel` (~L1550) |
| Subject delete | Allowed | Blocked with the toast "Only superadmin can delete subjects" | `handleConfirmDeleteSubject` (~L1373) |
| Marks Schema: Customer/Org dropdowns | Shown | Shown (no role check; the section is unreachable for an admin) | `MarksSchemaSection` (~L3024) |
| `dashboard` section | `AdminSubjectView` | `SubjectDashboard` | (~L7868–7874) |

> **Risk:** For an admin, both Config Settings and User Management act on the first organization of the
> customer, not on the admin's own organization, and the organization dropdown that would reveal this is
> hidden. See [admin-configuration.md](admin-configuration.md) and [admin-user-management.md](admin-user-management.md).

## Shared selectors and how their state flows

There is **no single shared Customer/Organization state**. The shell declares `selectedCustomer`,
`selectedOrg`, `organizations` and `loadingOrgs`, and bundles them into `sharedProps` (~L7721), but
`sharedProps` is never passed to any child. Each section owns its own Customer and Organization state and makes
its own `organization-details` call.

**Year and Cycle are shared.** They are held in the shell and passed down to each section in two ways: as plain
codes, and as an already-rendered selector element.

```text
SuperAdminDashboard
 ├─ headerYears / headerSelectedYearCode   ◀── GET API_BASE1/get-year-data            (mount)
 ├─ headerCycles / headerSelectedCycleCode ◀── GET API_BASE1/get-cycle-data?YearCode (year change)
 ├─ renderYearCycle(variant) → <YearCycleDropdowns …/>
 │
 ├─▶ SubjectQuestionPanel  yearCode, cycleCode, yearCycleSelector=renderYearCycle('compact')
 ├─▶ MarksSchemaSection    yearCode, cycleCode, yearCycleSelector=renderYearCycle('compact'), API_BASE, API_BASE1
 ├─▶ SettingsSection       yearCode, cycleCode, yearCycleSelector=renderYearCycle('settings'), API_BASE1
 └─▶ RoleManagementSection (no props; re-declares API_BASE1 locally from VITE_AIMARKING_API_BASE)
```

| Selector | State owner | Data source | What consumes it |
|---|---|---|---|
| Year | Shell: `headerSelectedYearCode` | `get-year-data` (first year is auto-selected) | `get-subject-data` in Subject & Question, Marks Schema and Settings; the payload of `delete-subject` |
| Cycle | Shell: `headerSelectedCycleCode` | `get-cycle-data?YearCode=` (first cycle is auto-selected; reset to `''` while loading) | Same as Year |
| Customer | Each section's `selectedCustomer` | Hard-coded `<option value="ICME">` in every section except Role Management, which uses `customer-details` | That section's `organization-details` call (`CustCode`). In Settings it also goes into `get-config-info` / `save-config-info` |
| Organization | Each section's `selectedOrg` (an `organizationid` string) | That section's `organization-details` (first org is auto-selected) | That section's data calls, which receive `organizationcode`. Role Management instead sends `organizationname`. |

Effect of the shared Year/Cycle per section:

| Section | Reloads when Year/Cycle changes? | Why |
|---|---|---|
| Subject & Question | Yes | `fetchSubjects` is a `useCallback` with `yearCode` and `cycleCode` in its dependencies, and the effect at ~L1112 depends on it |
| Marks Schema | Yes | Same pattern (~L2795–2799) |
| Config Settings | **No** | `fetchSubjects(orgCode)` is called only from `fetchOrganizations` (mount or customer change) and from `handleOrgChange` (~L3845, L4433) |
| Role Management | n/a | Does not use Year/Cycle; no selector is rendered |

> Because changing the year clears `headerSelectedCycleCode` to `''` before the new cycles arrive, Subject &
> Question and Marks Schema briefly run `fetchSubjects` with an empty cycle. Each time, this shows the toast
> "No Year/Cycle available to load subjects." and empties the table.

Full dropdown behaviour is in [admin-dropdowns-and-forms.md](admin-dropdowns-and-forms.md).

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/admin-selector-row.png — Customer / Organization / Year / Cycle row in Subject & Question]
