# Navigation Flow

The complete navigation graph: real routes, in-page view switches that keep the URL, dialogs, breadcrumb back-navigation, login redirects and logout. Data between screens is handed over through `sessionStorage` / `localStorage` and component props; no router `state`, query string or URL parameter is used anywhere in live code.

Related: [../architecture/routing.md](../architecture/routing.md) · [../architecture/application-flow.md](../architecture/application-flow.md) · [page-inventory.md](./page-inventory.md) · [../architecture/state-management.md](../architecture/state-management.md) · API IDs: [../api/api-integration-mapping.md](../api/api-integration-mapping.md)

---

## 1. Navigation graph

```text
/  ──(Login effect, not signed in)──►  /login
/login  Login
 ├─ [Sign In] M01 login ─► access check ─► customer must be ICME
 │    ├─ inactive / not-yet-active ─► "Access Denied" dialog ─[OK]─► /login (replace, session cleared)
 │    ├─ customer ≠ ICME ─► stays, "Access denied." (session NOT cleared)
 │    ├─ role superadmin | admin ─────────────────────────────► /superadmin-dashboard (replace)
 │    └─ other role ─► M02 get-config-info (standalone?)
 │          ├─ standalone ─────────────────────────────────────► /ocr-evaluation (replace)
 │          └─ normal ─────────────────────────────────────────► /subject-dashboard (replace)
 ├─ visiting /login while isLogin='true' ─► same three targets from cached userRole / standalone_mode
 └─ hidden "Sign up" ─► /register

/subject-dashboard  SubjectDashboard  (user)
 ├─ Year <select> ─► Cycle cards
 ├─ Cycle card ─► Subjects view (breadcrumb: Year › Cycle)
 │    └─ breadcrumb Year ─► back to Cycle cards
 ├─ Student Export ─► dialog ─[Download]─► .xlsx (M27)
 ├─ Subject card ─► inline <OCREvaluation> (URL unchanged)
 │    ├─ Workspace list
 │    │    ├─ breadcrumb Year ─► onBackToCycles ─► Cycle cards
 │    │    ├─ breadcrumb Cycle ─► goBackToHome (M06) ─► onBack ─► Subjects view
 │    │    │       (generic subject mode - no Evaluation stage, subject step skipped:
 │    │    │        onBack is wired to the same `backToCycles` as the Year crumb, so
 │    │    │        Cycle lands on Cycle cards too, not a Subjects view that doesn't exist)
 │    │    ├─ [Create New Workspace] ─► Create dialog ─► (per-question popup) ─► Confirm File Upload
 │    │    │       └─ "go back" link in dialog ─► onBack ─► Subjects view
 │    │    ├─ Delete (n) ─► Delete Workspace dialog
 │    │    └─ Workspace card ─► Workspace view
 │    └─ Workspace view
 │         ├─ breadcrumb Subject ─► handleBackToWorkspaceList ─► Workspace list
 │         ├─ Workspace ▼ ─► other Workspace view
 │         ├─ [Upload Additional Files] ─► Create/Upload dialog (additional mode)
 │         ├─ candidate number ─► Candidate Details dialog
 │         ├─ Segmentation/Indexing badge ─► Segmentation/Indexing review dialog
 │         ├─ OCR badge ─► OCR Preview dialog | Standalone OCR popup (Standalone OCR-only)
 │         ├─ Evaluation badge / score chip ─► Evaluation Preview ─► Re-evaluation dialog
 │         ├─ Delete ─► Delete Candidates dialog
 │         └─ Download ─► .xlsx (M26)
 └─ avatar ─► Logout ─► /login

/ocr-evaluation  OCREvaluation (user, Standalone Mode)
 └─ same as the inline OCREvaluation, but no breadcrumb base crumbs, no subject pill, no "go back"
    (inside a workspace the only crumb is "Subject" → back to the workspace list)
    avatar ─► Logout ─► /login

/superadmin-dashboard  SuperAdminDashboard (superadmin, admin — not role-guarded)
 ├─ initial section: Role Management (superadmin) / User Management (admin)
 ├─ sidebar ─► Config Settings
 ├─ sidebar ─► Subject & Question   (superadmin only)
 │     └─ Import dialog · Q-Preview dialog · status confirm · delete confirm
 ├─ sidebar ─► Marks Schema         (superadmin only)
 │     └─ Upload dialog (A: AI convert / B: .md) · View scheme dialog · Open ─► new tab (REPO_BASE file)
 ├─ (unreachable) 'dashboard' ─► AdminSubjectView ─► inline OCREvaluation (overrideOrgCode, onBack → Home crumb)
 └─ profile menu ─► Logout ─► /login

/register  Register (public, typed URL only)
 ├─ "Sign in" ─► /
 └─ result dialog OK ─► /      (success path, unreachable: /dashboard ─► NotFound, then /register)

/standalone-ocr ─► blank page        /sandbox ─► /login (replace)        * ─► NotFound ─[Back to Login]─► /login
Any guarded route without isLogin='true' ─► <Navigate to="/login" replace>
```

---

## 2. Navigation actions

### 2.1 Login and routing

| Source | Trigger | Destination | Params / state passed | API called before | Data loaded after |
|---|---|---|---|---|---|
| `/` (`Login` effect) | Mount, not signed in | `/login` (push) | – | – | – |
| `/login` | Sign In, role `superadmin`/`admin`, ICME, active | `/superadmin-dashboard` (replace) | sessionStorage `isLogin, userInfo, user, userCode/usercode, orgCode/orgcode, customerCode/custcode, userRole, username, password, appcode` | M01 | Shell M04 → M05, M07 (superadmin); Role Management M08 → M07 → M15 |
| `/login` | Sign In, other role, Standalone on | `/ocr-evaluation` (replace) | same + localStorage `standalone_mode='1'`, `workflowStages`, `org_selected_stages_<org>`, `org_standalone_<org>` | M01, M02 | OCREvaluation: M06 (fan-out via M04/M05 when no year/cycle in session), M10, M18 |
| `/login` | Sign In, other role, Standalone off / unknown | `/subject-dashboard` (replace) | same; `standalone_mode='0'` (or cached) | M01, M02 | M04, M18 (tokens), M02, then M05 |
| `/login` | Revisit while `isLogin='true'` | role target (replace) | reads cached `userRole`, `standalone_mode` | none | as above |
| `/login` | Access Denied **OK** | `/login` (replace) | `clearAuthSession()` | M01 | – |
| `/login` | Customer ≠ ICME | stays | session keys remain written | M01 | – |
| Guarded route | No `isLogin` | `/login` (replace) | – (requested URL not remembered) | – | – |
| `NotFound` | Back to Login | `/login` | – | – | Login effect may redirect a signed-in user |

### 2.2 Subject Dashboard and inline OCR Evaluation

| Source | Trigger | Destination | Params / state passed | API called before | Data loaded after |
|---|---|---|---|---|---|
| Year/Cycle card | Year `<select>` change | Cycle cards | `selectedYearCode` | – | M05 |
| Cycle card | Click | Subjects view | `selectedCycleCode` | – | M06 |
| Subjects breadcrumb | Year crumb | Cycle cards | clears `selectedCycleCode` | – | – |
| Subject card | Click → `handleSelect` (~L651) | Inline `OCREvaluation` | sessionStorage `subjectcode/subjectCode`, `yearcode/yearCode`, `cyclecode/cycleCode`; props `preselectedSubject`, `selectedSubjectLabel`, `preselectedYearName`, `preselectedCycleName`, `onBack`, `onBackToCycles` | – | M06 (year/cycle from session) → M10, M18 |
| Workspace list | Cycle crumb → `goBackToHome` (~L4234) | Subjects view | `selected=null` | M06 (`refreshSubjects`) | SD effect: M04, M06, M18, M02 |
| Workspace list (generic subject mode) | Cycle crumb → `goBackToHome` → `onBack` (= `backToCycles`) | Cycle cards | clears cycle + subjects | – | SD effect: M04, M18, M02 |
| Workspace list | Year crumb → `goBackToCycles` → `onBackToCycles` | Cycle cards | clears cycle + subjects | – | SD effect: M04, M18, M02 |
| Create dialog | "go back" link (~L11205) | Subjects view | closes dialog, `onBack()` | – | as above |
| Workspace list | Workspace card click | Workspace view | `syncWorkspaceIdToSession` → `sessionStorage.workspaceid` | – | M22 (non-silent), then poll every 30 s; M02 (selectedWorkspace effect) |
| Workspace view | Workspace ▼ change | Other workspace | `sessionStorage.workspaceid`; clears search and filters | M18 (silent, force) | M22 + polling |
| Workspace view | Subject crumb → `handleBackToWorkspaceList` (~L4256) | Workspace list | `selectedWorkspace=null`, `candidates=[]`, stops polling | – | M18 (silent, force) |
| Workspace list | Create New Workspace | Create dialog | resets form; Standalone: `selectedSubject='generic'` | – | M02 (dialog effect) |
| Create dialog | Submit (Seg/Idx) → Confirm File Upload | Workspace list → Workspace view | `sessionStorage.workspaceid` from M19 | M19, M21 (ZIP), P01 | M22 + polling |
| Create dialog | Submit (OCR / Evaluation) | Per-question popup | `qFlowActiveIndex=0` | – | – |
| Per-question popup | Submit | Workspace view | `sessionStorage.workspaceid` | M22 (duplicate check), M19, M21, P02/P03, P04, P05, P06 or P07 | M22 |
| Create dialog (Standalone OCR-only) | Create & Extract | Workspace view | `sessionStorage.workspaceid` | M19, M21, P02, X01 per image, P05 | M22 |
| Workspace view | Upload Additional Files | Upload dialog | `isAdditionalUploadMode=true`, prefilled name | – | M02 (dialog effect) |
| Workspace view | Candidate number | Candidate Details dialog | `detailCandidate` | – | M23 |
| Workspace view | Segmentation/Indexing badge | Seg/Idx review dialog | candidate | – | M25 t1 (or M23 + R01 in Segmentation-only) |
| Workspace view | OCR badge | OCR Preview / Standalone OCR popup | candidate | – | M25 t2 |
| Workspace view | Evaluation badge / score chip | Evaluation Preview | candidate | – | M25 t3 |
| Evaluation Preview | Re-evaluate all / Re-evaluate Q | Re-evaluation dialog → Submit closes both | `isall`, `questions`, `userprompt` | P07, M25 t3, P11 t3 | M22 (silent) |
| Any review dialog | Approve / Confirm & Save | Dialog closes (or stays for next question) | sessionStorage `icme_ocr.*` keys | P09/P05/P06/P10/P11 | M25 refresh, M22 (silent) |
| Workspace list | Delete (n) → Confirm | Workspace list | selected ids | M20 | M18 (force), M06 |
| Workspace view | Delete → Confirm | Workspace view | selected candidates | M24 | local list update |
| Workspace view | Download | browser download | selected candidates | M26 (paged) | – |
| Subjects view | Student Export → Download | browser download | register number | M27 | – |
| Header | Logout | `/login` | removes 8 session keys (+ `localStorage.userName` in OCR) | – | Login form |

**Browser Back / refresh.** Inside a subject, Browser Back leaves `/subject-dashboard` entirely. A refresh returns to the Subjects/Cycle view (the `selected` state is lost; year/cycle are restored from `sessionStorage`). Deep links to a subject or workspace are not possible. See [../architecture/routing.md §3](../architecture/routing.md#3-in-page-routing-views-that-do-not-change-the-url).

### 2.3 Super Admin / Admin Console

| Source | Trigger | Destination | Params / state passed | API called before | Data loaded after |
|---|---|---|---|---|---|
| Sidebar | Role / User Management | `RoleManagementSection` | `activeSection` | – | M08, M07, M15 |
| Sidebar | Config Settings | `SettingsSection` | `yearCode`, `cycleCode`, `yearCycleSelector` props | – | M07 → M06 + M02 |
| Sidebar | Subject & Question (superadmin) | `SubjectQuestionPanel` | same props | – | M07, M04, M06 |
| Sidebar | Marks Schema (superadmin) | `MarksSchemaSection` | `API_BASE`, `API_BASE1` + same props | – | M07, M06 |
| Header Year/Cycle | change | same section | `headerSelectedYearCode/CycleCode` | M05 (on year change) | section re-fetches M06 |
| S&Q | Import Subject File | Import dialog | – | – | M04, M05 (import selects) |
| S&Q | Q-Preview eye | Question preview dialog | subject | – | M10 |
| MS | Scheme card | View scheme dialog | subject, `guidelinepath` | – | M14 (→ R02) |
| MS | Open link | new browser tab | `REPO_BASE/<guidelinepath>` | – | – |
| Profile menu | Logout | `/login` | removes 8 session keys (localStorage kept) | – | Login form |

Switching sections unmounts the previous one; its local state (filters, dialogs) is lost and its APIs re-run on return.

### 2.4 Register and dead routes

| Source | Trigger | Destination | Notes |
|---|---|---|---|
| `/login` | hidden "Sign up" | `/register` | Not visible |
| `/register` | "Already have an account? Sign in" | `/` | → Login effect → `/login` |
| `/register` | Result dialog OK | `/` | – |
| `/register` | Successful e-mail + auto-login | `/dashboard` → NotFound, then `/register` | Unreachable (validation always fails) |
| `/sandbox` | Mount | `/login` (replace) | `sandboxLogin` never written |
| `/standalone-ocr` | Mount | stays, blank | Dialog has no `open` prop |

---

## 3. Data handed between screens

| Key / prop | Written by | Read by |
|---|---|---|
| sessionStorage identity keys | Login | every page (API params, display name, role) |
| `localStorage.standalone_mode`, `workflowStages`, `org_*` | Login, Config Settings, OCREvaluation | Login redirect, OCREvaluation |
| `sessionStorage.subjectcode/yearcode/cyclecode` (+ camelCase) | SubjectDashboard `handleSelect` | OCREvaluation `resolveSubjectCode`, `fetchSubjectsSmart`; SubjectDashboard restore effect |
| `sessionStorage.workspaceid` | OCREvaluation (create chains, `syncWorkspaceIdToSession`, `loadCandidatesForWorkspace`) | most OCREvaluation calls as fallback |
| `sessionStorage.icme_ocr.*` | review dialogs (Quick Approve, Phase 1 state) | review dialogs |
| Props `preselectedSubject`, `selectedSubjectLabel`, `preselectedYearName`, `preselectedCycleName`, `onBack`, `onBackToCycles` | SubjectDashboard | OCREvaluation breadcrumb and back actions |
| Prop `overrideOrgCode` | `AdminSubjectView` (unreachable) | `getFinalCodes()` |

Full key list: [../architecture/state-management.md](../architecture/state-management.md) · [../user/user-state-reference.md](../user/user-state-reference.md).
