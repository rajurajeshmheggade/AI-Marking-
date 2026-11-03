# Admin Dropdowns and Forms

Source: `src/pages/SuperAdminDashboard.tsx`. Field-level validation for the user forms is in
[admin-user-management.md](admin-user-management.md), and the details of the settings controls are in
[admin-configuration.md](admin-configuration.md).

## The dependency chain

The admin area has **two independent chains**.

```text
(A) Year/Cycle chain: shell-owned, shared by all sections
    get-year-data ─▶ Year ─(YearCode)─▶ get-cycle-data ─▶ Cycle
                       │                                   │
                       └──────────────┬────────────────────┘
                                      ▼
              get-subject-data (S&Q, Marks Schema: auto-refetch · Settings: no refetch)
              delete-subject payload (S&Q)

(B) Customer/Org chain: re-created inside every section
    Customer ─(CustCode)─▶ organization-details ─▶ Organization ─(organizationcode | organizationname)─▶ section data
```

The two chains meet only where a call needs both an org and a year/cycle: `get-subject-data` and `delete-subject`.

There is no persistence between sections for chain B. Opening a section always resets it to the first organization.

## Dropdown reference

### Shell / shared

| Dropdown | Data source / API | Initial load | Default | Depends on | onChange → state | APIs triggered | Components affected |
|---|---|---|---|---|---|---|---|
| Select Year (`#header-year-select`) | `GET API_BASE1/get-year-data` | Shell mount | First year | — | `setHeaderSelectedYearCode` | `get-cycle-data`, then (via the cycle) `get-subject-data` in S&Q and Marks Schema | Every section that renders `yearCycleSelector` |
| Select Cycle (`#header-cycle-select`) | `GET API_BASE1/get-cycle-data?YearCode` | On year change | First cycle (cleared to `''` while loading) | Year | `setHeaderSelectedCycleCode` | `get-subject-data` (S&Q, Marks Schema) | S&Q, Marks Schema; Settings receives the value but does not refetch |

### Subject & Question (`SubjectQuestionPanel`)

| Dropdown | Data source / API | Initial load | Default | Depends on | onChange → state | APIs triggered | Affected |
|---|---|---|---|---|---|---|---|
| Select Customer (hidden for admin) | Static `<option>ICME</option>` | — | `ICME` | — | `setSelectedCustomer`. Not used by the org fetch, which is hard-coded to ICME. It **is** used by `isEvaluationStageEnabled` (`CustCode`). | none | — |
| Select Organization (hidden for admin) | `organization-details?CustCode=ICME` | Mount | First org | — | `setSelectedOrg(organizationid)` | `get-subject-data` | Table, delete, preview, status toggle, import |
| Import → Select Year | `get-year-data` (no params) | Panel mount | First year | — | `setImportSelectedYearCode` | `get-cycle-data` (import) | Import payload `YearCode` |
| Import → Select Cycle | `get-cycle-data?YearCode` | Import year change | First cycle | Import year | `setImportSelectedCycleCode` | none | Import payload `CycleCode`; Import button enabled |
| Import → Select Organization | Same `organizations` | — | The current `selectedOrg` | — | **The same `setSelectedOrg` as the page** | `get-subject-data` (the page table behind the dialog) | Import payload `OrgCode` **and** the page |

### Marks Schema (`MarksSchemaSection`)

| Dropdown | Data source / API | Initial load | Default | Depends on | onChange → state | APIs triggered | Affected |
|---|---|---|---|---|---|---|---|
| Select Customer (no admin check) | Static `ICME` | — | `ICME` | — | `setSelectedCustomer` | `organization-details` | Org list |
| Select Organization | `organization-details?CustCode=<customer>` | Mount, customer change | First org | Customer | `setSelectedOrg` | `get-subject-data` | Subject select, cards, upload `orgcode` |
| Select Subject | `subjects` from `get-subject-data` | With subjects | `-- Select Subject --` (none) | Org, Year, Cycle | `setSelectedSubject` | none | Upload button enabled; status line; dialog header |

### Config Settings (`SettingsSection`)

| Dropdown | Data source / API | Initial load | Default | Depends on | onChange → state | APIs triggered | Affected |
|---|---|---|---|---|---|---|---|
| Select Customer (hidden for admin) | Static `ICME` | — | `ICME` | — | `setSelectedCustomer` | `organization-details` → `get-subject-data` → `get-config-info` | Whole section; also `CustCode` in config load and save |
| Select Organization (hidden for admin) | `organization-details?CustCode` (fetch) | Mount, customer change | First org | Customer | `handleOrgChange` → `setSelectedOrg` | `get-subject-data` (direct), `get-config-info` (through the effect) | Whole section |
| Pass mark subject select | `subjects` | — | First subject | Org | `setPassMarkSubjectCode`, `setPassMark` | — | **Unreachable** (subject scope is never enabled) |
| Top N subject select | `subjects` | — | First subject | Org | `setTopQSubjectCode`, `setTopQuestionsCount` | — | **Unreachable** |
| Question N image picker (custom dropdown) | `firstTaggableImage()`…`maxImg` | — | — | Max Images, Candidate Info | `toggleImageForQuestion` | — | `predefinedMapping` |

### Role / User Management (`RoleManagementSection`)

| Dropdown | Data source / API | Initial load | Default | Depends on | onChange → state | APIs triggered | Affected |
|---|---|---|---|---|---|---|---|
| Select Customer (hidden for admin) | `customer-details` (fallback `[ICME]`) | Mount | Superadmin `ICME`; admin `sessionStorage.customerCode` | — | `setSelectedCustomer` | `organization-details` → `get-user-details` | Table |
| Select Organization (hidden for admin) | `organization-details?CustCode` | Mount, customer change | First org (overwrites the admin's session org) | Customer | `setSelectedOrg` | `get-user-details` | Table |
| Status filter | Static: All Status / Yet to Active / Active / Inactive | — | All | — | `setFilterStatus` | none (client-side) | `filteredRoles` |
| Create → Customer | `customerList` | — | `selectedCustomer` | — | `setFormCustomer` | none (it does **not** reload the org list) | `create-user.customerCode` |
| Create → Organization | `organizations` (of the filter bar's customer) | — | `selectedOrg` | Filter-bar customer | `setFormOrg` | none | `create-user.organizationId` (the name) |

> In the Create modal, the Customer and Organization selects are not linked. Choosing another customer leaves the
> organization list showing the filter bar customer's orgs.

### Unreachable dropdowns

| Dropdown | Location | Why it cannot be reached |
|---|---|---|
| `AdminSubjectView` Customer/Org | ~L237 | The `dashboard` section is never activated |
| AI Prompt selects | ~L5970 | Commented out |

## Forms

| Form | Component | Fields | Submit | API | Detail |
|---|---|---|---|---|---|
| Config Settings | `SettingsSection` | Stages, Standalone, Candidate Info, Answer Script, Max Questions, Max Images, Image Format, tags, Standards, Pass Mark, Top N, Agent | Save Settings | `save-config-info` | [admin-configuration.md](admin-configuration.md) |
| Import Subject | `SubjectQuestionPanel` | Year, Cycle, Organization, CSV file | Import | `import-subject-data-v2` | [admin-subject-question.md](admin-subject-question.md#import-dialog) |
| Delete Subjects (confirmation) | `SubjectQuestionPanel` | — (the selection) | Delete N Subject(s) | `delete-subject` × N | [admin-subject-question.md](admin-subject-question.md#delete-n) |
| Status change (confirmation) | `SubjectQuestionPanel` | — | Confirm | `update-subject-data` | [admin-subject-question.md](admin-subject-question.md#status-badge-active--inactive-toggle) |
| Marks Schema upload | `MarksSchemaSection` | Subject, Word or MD file | Confirm & Save | `convert-markscheme-to-md`, `upload-marking-scheme`, `save-questions` | [admin-marks-schema.md](admin-marks-schema.md) |
| Create User | `RoleManagementSection` | Customer, Org, First/Last Name, Email, Contact, Address, Login Name, Password, From/To | Create User | `create-user` | [admin-user-management.md](admin-user-management.md#create-user-form) |
| Edit User | `RoleManagementSection` | Same, without Customer and Org; Login Name read-only | Save Changes (enabled only after a change) | `create-user` | [admin-user-management.md](admin-user-management.md#edit-user-form) |
| Delete User (confirmation) | `RoleManagementSection` | — | Yes, Delete | `delete-user` | [admin-user-management.md](admin-user-management.md#delete) |
| Predefined change confirmation | `SettingsSection` | — | Remove & Apply | none (local) | [admin-configuration.md](admin-configuration.md#predefined-mapping-panel) |
| Question JSON Creator | `SubjectQuestionPanel` | Questions, sub-questions, rubrics, format | Copy | none | Unreachable |
| Advanced Add User | `RoleManagementSection` | Username, Password, From/To | Save (toast only) | none | Unreachable |

### Numeric input rules (Settings)

| Input | Allowed |
|---|---|
| Max Questions / Max Images | Digits only (`- + e E . ,` blocked; paste is stripped), at most 2 digits, at least 1. Max Images must be ≥ 2 when Candidate Info is active. |
| Global and subject pass mark | `''` or an integer 1–99 (a value with `.` is rejected) |
| Top N numerator / denominator | Up to 2 digits each. Format `N/D`, N > 0, D > 0, D ≥ N. The denominator is locked to Max Questions in Predefined + Indexing. |

### Date inputs (User forms)

| Form | `min` | Past-date guard | Order check |
|---|---|---|---|
| Edit | `getTodayISO()` (local date) | onChange toast "Please select today or a future date. Past dates are not allowed." | To ≥ From (on save) |
| Create | `new Date().toISOString().split('T')[0]` (**UTC date**) | None, beyond the picker's `min` | To ≥ From (on save) |
