# State Management

## 1. Approach

| Layer | Mechanism | Used for |
|---|---|---|
| Component state | `useState`, `useMemo`, `useCallback`, `useRef` (no `useReducer` or `createContext` outside `src/components/ui`) | Everything a page shows: lists, selections, dialog open flags, loading flags, edit buffers. `OCREvaluation.tsx` has ~183 `useState` lines and `SuperAdminDashboard.tsx` ~179. |
| Props | parent → child | Embedded pages: `SubjectDashboard` passes `preselectedSubject`, `selectedSubjectLabel`, `preselectedYearName`, `preselectedCycleName`, `onBack`, `onBackToCycles` to `OCREvaluation`; `SuperAdminDashboard` passes `yearCode`, `cycleCode`, `API_BASE`, `API_BASE1`, `yearCycleSelector` to its sections. |
| `sessionStorage` | per tab, survives refresh | Identity, current Year/Cycle/Subject/Workspace, per-workspace review drafts. |
| `localStorage` | per browser, survives restarts | Organisation configuration cache (`standalone_mode`, `workflowStages`, `org_*` keys). |
| Module-level variables | singletons | `OCREvaluation.tsx` → `sharedListWorkspaceRequest` deduplicates concurrent `list-workspace` calls. `use-toast.ts` → module-level `memoryState`/`listeners` with a plain `reducer` function. |
| Global store | **none** | No Redux / Zustand / Context store. `@tanstack/react-query`'s `QueryClientProvider` is mounted in `src/App.tsx`, but no `useQuery`/`useMutation` exists, so there is no query cache in use. |

Why storage instead of a store: page hand-off. Because subject screens are rendered either as routes (`/ocr-evaluation`) or embedded components, and pages read identity directly, the codebase passes context via storage keys that every page can read on mount, including after a refresh.

Detailed per-page `useState` inventories are owned by other documents: [`../user/`](../user/) (OCR evaluation and subject dashboard) and [`../admin/`](../admin/) (super admin sections).

---

## 2. Storage key reference

Found by searching every `sessionStorage.` and `localStorage.` call in `src/` (excluding the dead modules `src/api_ish.ts`, `src/utils/api.ts`, `src/utils/Aigapi.ts`). "S" = `sessionStorage`, "L" = `localStorage`.

### 2.1 Identity / session (written at login)

Full detail in [authentication-authorization.md §3](./authentication-authorization.md#3-session-and-storage-keys-written-during-authentication).

| Key | Storage | Written in | Read in | Purpose |
|---|---|---|---|---|
| `isLogin` | S | `Login.tsx` → `handleSubmit`; `Register.tsx` | `App.tsx` → `RequireAuth`; `Login.tsx` | Auth flag (`'true'`). |
| `userInfo` | S | `Login.tsx`; `Register.tsx` | `HeaderAccountControls.tsx`, `OCREvaluation.tsx`, `SubjectDashboard.tsx`, `SuperAdminDashboard.tsx`, `lib/session.ts` | JSON `{userCode, orgCode, customerCode, userRole, username}`; display name and e-mail. |
| `user` | S | `api.ts` → `loginUser` | `lib/session.ts` → `getSessionCodes`; `api.ts` | Raw login record JSON. |
| `userCode` / `usercode` | S | `api.ts`, `Login.tsx`, `Register.tsx` (camel only) | `getSessionCodes`, OCREvaluation (23 + 11 reads), SubjectDashboard, SuperAdminDashboard | User code for API parameters. |
| `orgCode` / `orgcode` | S | `api.ts`, `Login.tsx`, `Register.tsx` (camel only) | `getSessionCodes`, OCREvaluation (28 + 11 reads), SubjectDashboard, SuperAdminDashboard | Organisation code. Common fallback when missing: `'ICME01'` or `'ICMELIVE'` (varies by call site). |
| `customerCode` / `custcode` | S | `api.ts`, `Login.tsx`, `Register.tsx` | OCREvaluation, SuperAdminDashboard | Customer code. |
| `custCode` | S | **never written** | `OCREvaluation.tsx`, `SubjectDashboard.tsx` → `handleStudentExport` | Always falls back to `'ICME'`. |
| `userRole` | S | `Login.tsx`, `Register.tsx` | `Login.tsx`, OCREvaluation, SubjectDashboard, SuperAdminDashboard | Role. |
| `username` | S | `Login.tsx`, `Register.tsx` | OCREvaluation, SubjectDashboard, SuperAdminDashboard | Display name fallback. |
| `password` | S | `Login.tsx`, `Register.tsx` | `AppIframe.tsx` (dead) | Plain-text password (risk). |
| `appcode` | S | `api.ts` → `loginUser` (`'IG'` default) | `lib/session.ts`, `api.ts` | Legacy. |
| `UserNameDetails`, `displayName` | S | **never written** | `OCREvaluation.tsx` (~L425) | Display-name fallbacks; always `null`. |
| `email` | S | **never written** | `AppIframe.tsx` (dead) | — |
| `tempUserEmail`, `tempUserName` | S | `Register.tsx` → `handleSubmit` | **never read** | Left over. |

### 2.2 Workflow context (cross-page hand-off)

| Key | Storage | Written in | Read in | Purpose |
|---|---|---|---|---|
| `yearcode` / `yearCode` | S | `SubjectDashboard.tsx` → `handleSelect` | `SubjectDashboard.tsx` (restore effect), `OCREvaluation.tsx` | Year chosen on the subject dashboard, so OCREvaluation calls `get-subject-data` for just this Year/Cycle. |
| `cyclecode` / `cycleCode` | S | `SubjectDashboard.tsx` → `handleSelect` | `SubjectDashboard.tsx`, `OCREvaluation.tsx` | Cycle chosen. |
| `subjectcode` / `subjectCode` | S | `SubjectDashboard.tsx` → `handleSelect`; `SuperAdminDashboard.tsx` → `AdminSubjectView.handleSelect`; `OCREvaluation.tsx` (~L9022, subject dropdown) | `OCREvaluation.tsx` (`resolveSubjectCode` and others) | Current subject code. |
| `subject_code`, `subject`, `subjectId`, `subjectid`, `subject_id`, `subjectName`, `subjectname`, `subject_name` | S | **never written** | `OCREvaluation.tsx` | Fallback spellings in the subject resolution chain; always `null`. |
| `workspaceid` | S | `OCREvaluation.tsx` (~L1831, ~L2895, ~L3081, ~L4725, ~L5209) when a workspace is created/selected | `OCREvaluation.tsx` (25 reads) | Current workspace id for process/candidate APIs. |
| `workspacesid` | S | **never written** | `OCREvaluation.tsx` (fallback after `workspaceid`) | Typo-style fallback. |
| `fromdate`, `todate` | S | **never written** | `OCREvaluation.tsx` (list-workspace params) | Fallback to computed defaults. |
| `org` | S | **never written** | `OCREvaluation.tsx` | Fallback. |
| `standalone_ocr_result` | S | **never written** in current source | `StandaloneOCREvaluation.tsx` → `readStoredOcrResult` (itself unused) | Intended hand-off of AI transcription results; 24-hour expiry logic. |

### 2.3 Per-workspace review drafts (OCREvaluation)

| Key pattern | Storage | Written / read in | Purpose |
|---|---|---|---|
| `icme_ocr.quickApprove.<workspaceId>` | S | `OCREvaluation.tsx` → `readQuickApproveMap` / `writeQuickApproveMap` | Keeps "Quick Approve" toggles across the 30-second candidate poll (`CANDIDATE_POLL_INTERVAL_MS`). |
| `icme_ocr.phase1.mapping.<workspaceId>.<registrationNumber>` | S | `OCREvaluation.tsx` → `getPhase1MappingStorageKey` | Draft question→page mapping (`{question_page_mapping, savedAt, pending}`). |
| `icme_ocr.phase2.ocr.<workspaceId>.<registrationNumber>` | S | `OCREvaluation.tsx` → `getPhase2OcrStorageKey` | Draft edited OCR text (`{ocr_extracted_text, savedAt}`). |

These are not cleared on logout.

### 2.4 Organisation configuration cache (localStorage)

| Key | Written in | Read in | Purpose |
|---|---|---|---|
| `standalone_mode` | `Login.tsx` → `fetchStandaloneMode`; `OCREvaluation.tsx` (config fetch effects ~L1127, ~L3165); `SuperAdminDashboard.tsx` (settings load/save/toggle) | `Login.tsx` (fallback + redirect effect), `OCREvaluation.tsx` (16 reads, incl. `standaloneMode` initial state) | `'1'` = Standalone Mode: users skip the Subject Dashboard. |
| `workflowStages` | `Login.tsx`, `OCREvaluation.tsx` | `OCREvaluation.tsx` | JSON of enabled stages (`ocr`, `segmentation`, `indexing`, `evaluation`). |
| `org_selected_stages_<org>` | `Login.tsx`, `SuperAdminDashboard.tsx` | `Login.tsx`, `SuperAdminDashboard.tsx` | Per-org stages. |
| `org_standalone_<org>` | `Login.tsx`, `SuperAdminDashboard.tsx` | `SuperAdminDashboard.tsx` | Per-org Standalone flag. |
| `org_ocr_qnum_<org>` / `org_ocr_qnum_<org>_<subject>` | `SuperAdminDashboard.tsx` | `SuperAdminDashboard.tsx`; `OCREvaluation.tsx` → `isQNumExtractionEnabled` (fallback when `apiConfig.ocrConfig.QuestionNumberExtraction` is absent) | Question-number extraction toggle (global / per subject). |
| `org_ocr_metadata_<org>[ _<subject>]` | `SuperAdminDashboard.tsx` | `SuperAdminDashboard.tsx` | Metadata-present toggle. |
| `org_standards_count_<org>[ _<subject>]` | `SuperAdminDashboard.tsx` | `SuperAdminDashboard.tsx` | Standards-met count toggle. |
| `org_pass_mark_<org>[ _<subject>]` | `SuperAdminDashboard.tsx` | `SuperAdminDashboard.tsx` (default `'40'`) | Pass mark threshold. |
| `org_top_questions_<org>[ _<subject>]` | `SuperAdminDashboard.tsx` | `SuperAdminDashboard.tsx` (default `'5/8'`) | Top-N questions counted. |
| `org_prompt_<org>[ _<subject>]` | `SuperAdminDashboard.tsx` | `SuperAdminDashboard.tsx` (default `'generic'`) | Evaluation prompt choice. |
| `org_reeval_agent_<org>[ _<subject>]` | `SuperAdminDashboard.tsx` | `SuperAdminDashboard.tsx` | Live re-evaluation agent toggle. |
| `org_predefined_mapping_<org>` | `SuperAdminDashboard.tsx` | `SuperAdminDashboard.tsx` | Predefined question mapping JSON. |
| `org_answer_script_type_<org>` | `SuperAdminDashboard.tsx` | `SuperAdminDashboard.tsx` (default `'flexible'`) | Answer-script type. |
| `org_seg_candidateinfo_<org>` | removed in `SuperAdminDashboard.tsx` | `SuperAdminDashboard.tsx` | Candidate-info segmentation flag. |

`SuperAdminDashboard.tsx` builds the config-save payload by reading these keys back (around the `hasStd` / `hasPass` checks) — i.e. `localStorage` doubles as the edit buffer for Config Settings. When the server config is loaded, overrides are written into these keys. Details belong to the admin settings docs in [`../admin/`](../admin/).

### 2.5 Other

| Key | Storage | Where | Note |
|---|---|---|---|
| `sandboxLogin`, `sandboxUsername`, `sandboxDisplayName` | S | `SandboxDashboard.tsx` (read / removed) | Never written → sandbox unreachable. |
| `role` | S / L | `api.ts` → `getAppDetails`, `AppSidebar.tsx` | Never written. |
| `userName` | L | removed by `OCREvaluation.tsx` → `handleLogout`, `clearAuthSession` | Never written. |
| `authToken`, `userSession`, `userInfo` | L | removed by `clearAuthSession`, `ProfileDropdown.tsx` | Never written by current code. |

---

## 3. Patterns and pitfalls

1. **Dual casing.** Many keys exist twice (`orgCode`/`orgcode`, `userCode`/`usercode`, `subjectCode`/`subjectcode`, `yearCode`/`yearcode`, `cycleCode`/`cyclecode`). Readers try several spellings in sequence. When adding a writer, write both spellings or the readers that prefer the other one will see stale data.
2. **Hard-coded fallbacks.** Readers fall back to literal codes (`'ICME01'`, `'ICMELIVE'`, `'ICME1'`, `'ICME'`). A missing key does not fail loudly; it calls the API with a default org.
3. **Phantom keys.** Several keys are read but never written (listed above). They are harmless today but misleading.
4. **localStorage is browser-wide.** `standalone_mode` and `workflowStages` are not namespaced by org. Two users of different orgs on the same browser overwrite each other's cache; `Login.tsx` re-fetches on every login to mitigate this, but the redirect `useEffect` uses the possibly stale value.
5. **Logout leaves state behind.** See [authentication-authorization.md §6](./authentication-authorization.md#6-logout-paths).
6. **Storage errors.** Most writes are wrapped in `try/catch` that ignore failures (e.g. quota or private mode).

---

## 4. Adding new shared state — recommendation

- Prefer passing props for embedded pages; use `sessionStorage` only for values that must survive a refresh.
- Add the key to this table, and if it identifies the user, also to `AUTH_SESSION_KEYS` in `src/lib/session.ts` so `clearAuthSession()` removes it.
