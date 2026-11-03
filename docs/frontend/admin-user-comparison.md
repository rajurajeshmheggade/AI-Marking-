# Superadmin vs Admin vs User — Feature Comparison

What each role can do in the frontend, built from the actual role checks in source. All checks are **client-side UI decisions**; the backend's own enforcement is not visible from this repository.

Related: [architecture/authentication-authorization.md](./architecture/authentication-authorization.md) · [api/api-authentication.md](./api/api-authentication.md) · [pages/page-inventory.md](./pages/page-inventory.md) · [admin/](./admin/) · [user/](./user/)

---

## 1. Where roles are checked

| Check | Location | Definition | Effect |
|---|---|---|---|
| Login routing | `src/pages/Login.tsx` → `handleSubmit`, redirect `useEffect` | `userRole.trim().toLowerCase()` ∈ {`superadmin`, `admin`} → `/superadmin-dashboard`; anything else → user pages | Landing page only |
| `isAdmin` (SuperAdmin console) | `SuperAdminDashboard.tsx` shell (~L7620), `AdminSubjectView` (~L96), `SubjectQuestionPanel` (~L661), `SettingsSection` (~L3819), `RoleManagementSection` (~L6497) | `(sessionStorage.userRole \|\| 'superadmin').toLowerCase() === 'admin'` | Hides sections, selects and admin rows |
| Missing role default | same lines | `userRole` missing → treated as **`superadmin`** | Full console |
| `isSuperAdmin` (subject delete) | `SubjectQuestionPanel.handleConfirmDeleteSubject` (~L1374) | `userRole.toLowerCase() === 'superadmin'` | Only superadmin may delete subjects |
| `isSuperAdmin` (OCR page) | `OCREvaluation.tsx` (~L956) | `userRole.toLowerCase() === 'superadmin'` — matches **only** `superadmin`, not `admin` | Hides create/upload/delete and Logout |
| `isAdmin` (Subject Dashboard) | `SubjectDashboard.tsx` (~L324) | `userRole === 'admin'` | Header top padding only |
| Workspace ownership | `OCREvaluation.tsx` → `isUserCodeMismatch` (~L418), `isSelectable` (~L9302) | Workspace / row `userCode` must equal a session user code (an empty owner counts as a mismatch) | Locks Upload Additional Files and row selection |
| Route guard | `src/App.tsx` → `RequireAuth` | `sessionStorage.isLogin === 'true'` only | **No role guard on any route** |

> **Route access is not role-guarded.** Any signed-in user, including an evaluator, can open `/superadmin-dashboard` by typing the URL. Because the console only distinguishes `admin` from everything else, an evaluator (`userRole = 'user'`, or any other non-`admin` value) who does this gets the **superadmin** layout: all four sections and the customer/org selects. Only subject deletion is additionally blocked for them (it requires exactly `superadmin`). Likewise a superadmin or admin can open `/subject-dashboard` or `/ocr-evaluation`. Whether the backend rejects the resulting calls: Implementation behavior could not be conclusively determined from the current frontend source.

---

## 2. Feature matrix

"By URL only" = reachable only by typing a route the role is not sent to.

| Feature | Superadmin | Admin | User (evaluator) |
|---|---|---|---|
| **Login landing** | `/superadmin-dashboard`, Role Management section | `/superadmin-dashboard`, User Management section | `/subject-dashboard`; `/ocr-evaluation` when the org has Standalone Mode on |
| **Header** | "Super Admin Dashboard", role "Super Admin", profile menu → Logout | "Admin Dashboard", role "Admin" | `HeaderAccountControls`: token count, avatar → Logout |
| **Customer / Organization selects** (S&Q, MS, CS, RM) | Shown; any customer/org | Hidden; pre-scoped to `sessionStorage.customerCode` / `orgCode` | – |
| **Year / Cycle selectors** | Shared header selectors in S&Q, MS, CS | Same (CS only) | Subject Dashboard Year select and Cycle cards |
| **Subject dashboard (Year → Cycle → Subject)** | By URL only. The console's `dashboard` section (`AdminSubjectView`) is unreachable | By URL only. The console's `dashboard` section (`SubjectDashboard`) is unreachable | Yes (normal mode) |
| **Config Settings** (workflow stages, standalone, OCR, indexing, evaluation thresholds) | Yes, any org (M02/M03) | Yes, own org | No |
| **Subject & Question** (import, preview, activate, delete) | Yes; delete allowed only here (`isSuperAdmin` check) | No (menu item filtered out) | No |
| **Marks Schema** (AI convert, upload, view) | Yes | No (filtered out) | No |
| **User management** | "Role Management": sees all users incl. admins; create/edit/delete | "User Management": own org; `admin` rows hidden; create/edit/delete | No |
| Role assigned to new users | Always `User` (`userRole:'User'`) | Always `User` | – |
| **Workspace create** | Hidden in OCREvaluation (`!isSuperAdmin`) — by URL only | Allowed if reached by URL (`isSuperAdmin` false) | Yes |
| **Workspace delete** | Not role-gated (only `candidateCount === 0`) — by URL only | Same — by URL only | Yes, empty workspaces only |
| **Uploads** (create upload, Upload Additional Files) | Upload Additional Files hidden; create hidden | Allowed by URL, subject to ownership | Yes; Upload Additional Files only in own workspaces (`isUserCodeMismatch`) and outside cooldowns |
| **Candidate delete** | Button hidden and handler blocked ("Superadmin cannot delete candidates") | Allowed by URL, own rows only | Yes, rows whose `userCode` matches (selectable rows) and only in deletable states |
| **Review / approval** (Segmentation/Indexing, OCR) | Not role-gated in the dialogs — by URL only | Same — by URL only | Yes; editing/approval requires Quick Approve on the row; not ownership-gated in the dialogs |
| **Evaluation editing** (manual marks, re-evaluate) | Not role-gated — by URL only | Same | Yes, with Quick Approve |
| **Rerun OCR / Evaluation** (status 4) | Not role-gated — by URL only | Same | Yes |
| **Exports** — candidate Download (M26) | Not role-gated — by URL only | Same | Yes; selection limited to own rows, "download all" when none selected |
| **Exports** — Student Export (M27) | By URL only | By URL only | Yes, when all four workflow stages are enabled |
| **Standalone mode** | Configures it (CS); own landing unaffected | Configures it for own org; own landing unaffected | Experiences it: lands on `/ocr-evaluation`, `subjectcode='generic'`, single stage |
| **Logout** | Profile menu. Inside OCREvaluation the Logout control is hidden (`showLogout={!isSuperAdmin}`) | Profile menu; OCREvaluation shows Logout | Header avatar menu |

---

## 3. Notes and edge cases

1. `isSuperAdmin` in `OCREvaluation.tsx` matches only `'superadmin'`. An **admin** who opens a user page by URL is treated exactly like an evaluator (can create workspaces, upload, delete own candidates).
2. A superadmin inside OCREvaluation has no Logout in that header (it is hidden), so they must navigate away (e.g. to `/login`, which redirects them back to the console) to sign out.
3. In the console a missing `userRole` falls back to `superadmin`, the most privileged layout.
4. Admin pre-scoping uses `sessionStorage.orgCode`; editing that value in DevTools changes the org whose configuration and users the admin sees.
5. Workspace ownership compares the workspace owner from `candidate-process-data` `summary[0].userCode` with `sessionStorage.userCode`, `usercode`, `username`, `UserNameDetails` and `displayName`. An empty owner disables row selection and additional uploads (treated as a mismatch).
6. Whether an evaluator can see workspaces created by others depends on whether `list-workspace` filters by the `usercode` it receives: Implementation behavior could not be conclusively determined from the current frontend source.

---

## 4. Recommendations (documentation only)

- Add a role-aware guard (`RequireRole(['superadmin','admin'])`) on `/superadmin-dashboard` and redirect admins away from user pages if that is the intended policy.
- Treat a missing `userRole` as the least privileged role, not `superadmin`.
- Decide whether `admin` should share the superadmin restrictions inside OCREvaluation (`isSuperAdmin` vs `isAdmin`).
- Mirror every client-side restriction on the backend; the frontend sends no token (see [api/api-authentication.md](./api/api-authentication.md)).
