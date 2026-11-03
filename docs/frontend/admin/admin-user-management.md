# Role / User Management (`RoleManagementSection`)

Source: `src/pages/SuperAdminDashboard.tsx` → `RoleManagementSection` (~L6491–7605). This is the landing section.
The menu label is "Role Management" for a superadmin and "User Management" for an admin.

The component takes no props. It **re-declares** `API_BASE1` locally from `import.meta.env.VITE_AIMARKING_API_BASE`
(with the same fallback as the module constant) at ~L6492. HTTP calls use `fetch`, except `delete-user`, which uses axios.

Module constants it uses: `CONFIG_PRIVILEGES` (~L6476; used only by `configLabel` for an "admin" table type that is
never rendered), `ROLE_OPTIONS` (~L6486; **unused**), `USER_STATUS`, `resolveUserStatus`, `formatDateDDMMYYYY`,
`toDateInputValue`, `getTodayISO` and `PAST_DATE_MESSAGE`.

## Layout

```text
Filter bar: [Customer]* [Organization]*   ……   [+ Add User] [All Status ▾] [🔍 Search user…]
            "Total User(s): N"
Users table: Username | From Active Date | To Active Date | Status | Actions (Edit, Delete)
Modals: Edit User, Create User, Confirm Delete, (Advanced Add User - unreachable)
(* hidden when isAdmin)
```

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-management-table.png — users table with status badges and Edit/Delete actions]

## Data loading

| Load | Trigger | Request | Response → state | Errors |
|---|---|---|---|---|
| Customers | Mount | `GET ${API_BASE1}/customer-details` | `data.data \|\| data` (a non-empty array) → `customerList`. Otherwise `[{customercode:'ICME', customername:'ICME'}]`. | Silent fallback to ICME |
| Organizations | Mount and `selectedCustomer` change | `GET ${API_BASE1}/organization-details?CustCode=<selectedCustomer \|\| 'ICME'>` | `organizations`; **`selectedOrg` ← first `organizationid`** | `organizations=[]` |
| Users | `fetchUsers` effect; the callback depends on customer, org and organizations | `GET ${API_BASE1}/get-user-details?UserCode=<sessionStorage.username \|\| userCode \|\| 'superadmin'>&OrgCode=<encodeURIComponent(organizationname)>&CustCode=<selectedCustomer>` | `data.userDetails` → rows with `userrole === 'admin'` removed → mapped → `roleList` | `roleList=[]` (logged only) |

`fetchUsers` returns early unless both `selectedCustomer` and `selectedOrg` are set. Note that `OrgCode` is sent as
the organization **name**.

### Row mapping (~L6597)

| Row field | API field(s) |
|---|---|
| `id`, `usercode` | `usercode` |
| `userid` | `userid` / `userId` / `user_id` (default 0) |
| `customer` | `customercode` |
| `orgId` / `orgName` | `organizationcode` / `organizationname` |
| `username` | `username` (trimmed) |
| `fromDate`, `toDate` | `fromdate`, `todate` |
| `status` | `resolveUserStatus(fromdate, todate, active ?? activestatus)` |
| `role` | `userrole` (lowercased) |
| `firstName`, `lastName` | `firstname`/`firstName`, `lastname`/`lastName` |
| `email` | `gmail` / `email` / `emailid` |
| `contactNumber` | `contact_number` / `contactnumber` / `contactNumber` / `contact` / `phone` |
| `password` | `password_hash` / `passwordHash` / `password` |
| `address` | `address` |

### Status derivation (`resolveUserStatus`, ~L3603)

| Condition (compared by calendar day; dates are parsed as text, not with `new Date`) | Status |
|---|---|
| No usable From or To date | `active == '1'` → **Active**, otherwise **Inactive** |
| Today is before From | **Yet to Active** |
| Today is after To | **Inactive** |
| Otherwise (both ends inclusive) | **Active** |

The badge is teal for `Active` and grey for everything else.

## Filtering (`filteredRoles`, ~L6644)

A row is shown when **all** of the following hold:

- `customer` equals `selectedCustomer` (both trimmed).
- `selectedOrg === ''`, or `orgId` equals any of `selectedOrg`, the current org name, `sessionStorage.orgCode` or `''`.
- It is not (`isAdmin` and role is `admin`). This is redundant, because admins are already removed when mapping.
- The status filter is empty or equals `status`.
- The search text is empty, or `username` or `usercode` contains it (case-insensitive).

Only one table is rendered: `renderTable(filteredRoles, '', 'user')`. The "Configuration" column and the
administrators table are therefore never shown. Empty state: "No user(s) found".

## Table actions

| Button | Visible / enabled | Handler |
|---|---|---|
| + Add User | Always | `openCreate` |
| Edit | Every row, whatever its status | `openEdit(item)` |
| Delete | Every row | `setActionConfirm({type:'Delete', id})` → confirmation modal |

### Delete

The confirmation modal reads "Confirm Delete / Are you sure you want to delete this user? This action cannot be
undone." **Yes, Delete** calls `handleActionConfirm` (~L6953):

```text
POST API_BASE1/delete-user   (axios, JSON)
   { custCode: row.customer || selectedCustomer,
     orgCode:  row.orgId    || selectedOrg,
     loginName: row.usercode || row.username || row.id }
statusCode = data.statusCode ?? data.status
'S001' → remove the row locally (no refetch); toast data.message || "User deleted successfully"
other (e.g. F001) → toast data.message || "Failed to delete user"; row kept
exception → toast "Failed to delete user"
```

The handler also has `Approve` and `Reject` branches that only change the row's status locally, but no button opens them.

## Create User form

Opened by `openCreate`. This resets every field, sets `formCustomer=''` and `formOrg=selectedOrg`, and masks the password.

| Field | Type | Required | Validation (in `handleCreate`, in this order) | Default | API dependency |
|---|---|---|---|---|---|
| Customer | select | Yes (*) | — | `formCustomer \|\| selectedCustomer` | `customer-details` |
| Organization | select (`organizationid`) | Yes (*) | — | `selectedOrg` | `organization-details` |
| First Name | text | Yes | Letters and spaces only, max 60 → "First Name must contain only letters and spaces (max 60 chars)."; min 3 → "First Name must contain at least 3 characters." | `''` | — |
| Last Name | text | No | When present: letters and spaces only, max 60 | `''` | — |
| Email | email | Yes | Regex `local(1–64)@label(.label)+.tld(2–63)` → "Please enter a valid email address." | `''` | — |
| Contact Number | text | No | When present: `^\+?\d{10,13}$` → "Contact Number must be 10-13 digits, optionally starting with +." | `''` | — |
| Address | text (`maxLength=100`) | No | Max 100 characters | `''` | — |
| Login Name | text | Yes | `^[A-Za-z0-9]+$`, 4–20 characters → "Username must be 4-20 alphanumeric characters." | `''` | Uniqueness is checked by the backend (`E001`) |
| Password | password with a show/hide toggle | Yes | `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,60}$` | `''` | — |
| From Active Date | date | Yes | `min` = today, computed as **UTC** (`toISOString`). There is no onChange guard against past dates. | `''` | — |
| To Active Date | date | Yes | `min` = From or today; checked To ≥ From → "To Active Date cannot be earlier than From Active Date." | `''` | — |

The first check is that all required fields are present: "Please fill in all required fields".

The **Create User** button is always enabled. Request:

```jsonc
POST API_BASE1/create-user
{
  "userId": 0,
  "organizationId": "<organizationname of formOrg||selectedOrg>",   // a name, despite the key
  "customerCode": "<formCustomer || selectedCustomer>",
  "firstName": "...", "lastName": "...", "email": "...",
  "contactNumber": "...", "address": "...",
  "loginName": "<formUsername>", "userCode": "<formUsername>",
  "passwordHash": "<formPassword>",          // plain text from the form
  "userRole": "User", "isSSO": 0,
  "fromDate": "yyyy-mm-dd", "toDate": "yyyy-mm-dd"
}
```

| Response | Result |
|---|---|
| `status`, `errorCode` or `errorcode` is `E001` | Toast "Login name already exists! Please give another name and try." The modal stays open. |
| `res.ok` | Toast "User created successfully!"; the modal closes; `fetchUsers()` |
| Otherwise | Toast `message` / `Message`, or "Failed to save user" |
| Exception | Toast "An error occurred" |

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-create-modal.png — Create User modal]

## Edit User form

Opened by `openEdit(item)` (~L6678). It pre-fills every field, including the stored `password` returned by the
API. If First Name is missing, it is split from `username`. Dates are converted with `toDateInputValue`. An
`editSnapshot` is taken of the opening values.

| Field | Type | Required | Validation (`handleEditSave`) | Notes |
|---|---|---|---|---|
| First Name | text | Yes | Letters and spaces only, max 60, min 3 | |
| Last Name | text | No | Letters and spaces only, max 60 | |
| Email | email | Yes | Same regex as Create | |
| Contact Number | text | No | `^\+?\d{8,20}$` → "Contact Number must be 8-20 digits" | **Differs from Create (10–13)** |
| Address | text | No | Max 100 (no `maxLength` attribute) | |
| Login Name | text, **disabled** | (*) | — | Shows `usercode` |
| Password | password with toggle | Yes | Same regex as Create | The hint text below the field describes the rule |
| From Active Date | date | Yes | `min=getTodayISO()` (local). onChange rejects past dates with the toast "Please select today or a future date. Past dates are not allowed." | An existing past value is kept if left unchanged |
| To Active Date | date | Yes | `min = From \|\| today`; same past-date guard; To ≥ From | |

The **Save Changes** button is disabled when `!!editItem && !hasEditChanges`, meaning no field differs from
`editSnapshot` (title: "Make a change to enable saving"). It calls `handleEditSave`.

The request is **the same `create-user` endpoint**, with `userId = Number(editItem.userid)`. Every other field is
built the same way as in Create, except `passwordHash: formPassword || undefined`. `userRole` is always `"User"`.
`formStatus` is tracked for change detection but is **not sent**. The response handling matches Create, with the
messages "User updated successfully!", "Failed to update user." and "An error occurred.".

> If the API row has no `userid`, `userId` becomes `0`, and the edit may be treated as a create on the backend.
> This could not be determined from the frontend source.

The `handleSave` wrapper (~L6737) is defined but never used.

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-edit-modal.png — Edit User modal with disabled Login Name]

## Admin vs superadmin in this section

| Aspect | Superadmin | Admin |
|---|---|---|
| Customer / Org selects | Shown | Hidden |
| Initial customer | `ICME` | `sessionStorage.customerCode` |
| Effective organization | The selected org (default: the first) | **The first org returned for the customer.** The initial `sessionStorage.orgCode` is overwritten by the effect at ~L6577. |
| Rows with role admin | Hidden (removed when mapping) | Hidden |
| Create modal Customer/Org selects | Shown | **Shown**: there is no role check inside the modal |

## Dormant: Advanced Add User modal

The modal (~L7540) has Username, Password and dates fields, and its Save button only shows the toast "User added
successfully" with no API call. `showAdvancedAddUser` is never set to `true`.
