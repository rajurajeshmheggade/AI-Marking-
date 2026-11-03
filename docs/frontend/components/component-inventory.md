# Component Inventory

Every application component in the frontend, where it lives, what it takes and emits, which APIs it depends on, who renders it, and **whether it is actually reachable** in the running app.

Scope:

- **§1** Shared components in `src/components/` (excluding `src/components/ui/`).
- **§2** In-file components inside the large pages (`SuperAdminDashboard.tsx`, `OCREvaluation.tsx`, `SandboxDashboard.tsx`, `StandaloneOCREvaluation.tsx`).
- **§3** Page components (as components, because pages are embedded inside other pages).
- **§4** shadcn/ui primitives in `src/components/ui/` — one summary table.

How reachability was verified: for each name, `src/` was searched for `import … from` statements and for JSX usage (`<Name`). For in-file components, the JSX call site and the condition that guards it were read. "Reachable" means a signed-in user can get the component on screen through normal navigation.

Related: [Component architecture](../architecture/component-architecture.md) · [Reusable components](./reusable-components.md) · [Component data flow](./component-data-flow.md) · [OCR components](./ocr-components.md) · [Page inventory](../pages/page-inventory.md)

---

## Reachability summary

| Status | Components |
|---|---|
| **Live** | `HeaderAccountControls`, `icons/AudiotrackOutlinedIcon`, `ocr/ScriptExtractorPanel`, `ocr/ExtractionControls` (renders nothing visible, see below), `ocr/ExtractionOutputTabs`, `ocr/ImageInspectorModal`, `ui/loader` → `PageLoader`; in-file: `YearCycleDropdowns`, `SubjectQuestionPanel`, `MarksSchemaSection`, `SettingsSection`, `TopQFractionInput`, `RoleManagementSection`, `AttachedAudioPreview`, OCREvaluation's local `StatusBadge` |
| **Never imported (dead file)** | `AppSidebar`, `SuperAdminSidebar`, `SessionTimeout`, `ProfileDropdown`, `BackToTop`, `Footer`, `StandaloneAppHeader`, `AudioPlayer/AudioPlayer`, `ocr/ExtractionMetrics`, `ocr/StatusBadge`; also `ocr/ExtractionControls` → `CategoryDropdown` (exported, never used) |
| **Defined but never rendered (in-file)** | `ImportPanel`, `ExcelInlineEditor` (both in `SuperAdminDashboard.tsx`) |
| **Rendered only from an unreachable branch** | `AdminSubjectView`, and `SubjectDashboard` *as embedded in* `SuperAdminDashboard` (the `activeSection === 'dashboard'` branch has no menu item and is never set) |
| **Routed but effectively unreachable** | `SandboxDashboard` and all its in-file components (guard key `sandboxLogin` is never written); `StandaloneOCREvaluation` at `/standalone-ocr` (renders a closed dialog when opened directly) |
| **Not routed at all** | `src/pages/AppIframe.tsx` (no route in `src/App.tsx`) |

Correction to the first-pass list: `HeaderAccountControls` is **live** (imported and rendered by `OCREvaluation.tsx` ~L8652 and `SubjectDashboard.tsx` ~L693). `StandaloneAppHeader` is confirmed **dead**. All others on the first-pass "unused" list are confirmed unused.

---

## 1. Shared components — `src/components/`

### 1.1 Live

| Name | File | Props | Key state | Events / callbacks | API dependency | Parent | Children | Reachable? | Business purpose |
|---|---|---|---|---|---|---|---|---|---|
| `HeaderAccountControls` | `src/components/HeaderAccountControls.tsx` | `displayName: string`, `tokenCount: number`, `onLogout: () => void`, `showLogout?: boolean` (default `true`) | none (reads `sessionStorage.userInfo` for e-mail via `readSessionEmail`) | `onLogout` on the Logout menu item | none | `OCREvaluation` (~L8652, `showLogout={!isSuperAdmin}`), `SubjectDashboard` (~L693) | `DropdownMenu*` primitives | **Yes** | Header right side: tokens-used button (count shown when opened) and avatar menu (name, e-mail, Logout). |
| `AudiotrackOutlinedIcon` | `src/components/icons/AudiotrackOutlinedIcon.tsx` | SVG props (`className`, …) | — | — | none | `OCREvaluation` (incl. `AttachedAudioPreview`) | — | **Yes** | Icon for attached audio answers. |
| `ScriptExtractorPanel` | `src/components/ocr/ScriptExtractorPanel.tsx` → `ScriptExtractorPanel` (~L102) | `segments: ExtractorSegment[]`, `onInspectImage({url,label})` | `activeSegmentId`, `subject` (`"General"`), `options` (`DEFAULT_OPTIONS`), `zoomLevel`, `isRunning`, `error`, `result`, `upload` (dropped replacement image), `isDragOver`, `isPanning` | `onInspectImage` (maximise), internal `handleExtract`, `handleCopy` | `runExtraction()` in `src/lib/extraction.ts` → `POST {VITE_AIAPPS_API_BASE}/AITranscription/extract` (only reachable through `handleExtract`, which has no visible trigger — see `ExtractionControls`) | `StandaloneOCREvaluation` | `ExtractionControls`, `ExtractionOutputTabs` | **Yes** (inside the OCR Review popup) | Shows each script page with zoom/pan and the already-extracted OCR result for that page. |
| `ExtractionControls` | `src/components/ocr/ExtractionControls.tsx` → `ExtractionControls` (~L100) | `subject`, `onSubjectChange`, `options?`, `onOptionsChange?`, `onExtract`, `isRunning`, `disabled?`, `showButton?` (default `true`) | — | `onExtract` (button click) | none directly | `ScriptExtractorPanel` (passes `showButton={false}`) | `Button` only when `showButton` | Rendered, **but outputs an empty `<div>`**: the component's only content is the Extract button, and its single caller hides it. `subject`/`options` props are accepted but not rendered. | Intended: subject picker + "Extract script" button. |
| `CategoryDropdown` | same file (~L19), exported | `subject`, `onSubjectChange`, `options?: string[]` (defaults to `ALLOWED_SUBJECTS`) | `open` | `onSubjectChange` | none | — | — | **No** (never imported) | Inline category picker safe inside modals. |
| `ExtractionOutputTabs` | `src/components/ocr/ExtractionOutputTabs.tsx` → `ExtractionOutputTabs` (~L102) | `result: ExtractionResult \| null`, `onCopy(text,label)`, `isRunning?` | `activeTab` (`ocr` \| `latex` \| `interpret` \| `issues` \| `json`) | `onCopy`; local `downloadTxt` | none | `ScriptExtractorPanel` | local `DtgBar`, `ExtractionLoader` | **Yes** | Tabbed OCR output (transcription Markdown, LaTeX, interpretation, issues, raw JSON). Markdown is rendered with `marked` into `dangerouslySetInnerHTML` (~L166, ~L234) without sanitising. |
| `ImageInspectorModal` | `src/components/ocr/ImageInspectorModal.tsx` | `imageUrl`, `label`, `onClose` | `zoom`, `isPanning` | `onClose` (also Escape key) | none (image `<img src>` only) | `StandaloneOCREvaluation` (nested `Dialog`) | — | **Yes** | Full-screen zoom / pan / download viewer for a page image. |
| `PageLoader` (+ `Loader`) | `src/components/ui/loader.tsx` (project-specific, not stock shadcn) | `text?` (default `"Please wait..."`) | — | — | none | `OCREvaluation` (~L8522–8531), `SuperAdminDashboard` (~L1498, ~L3015, ~L4844–4845, ~L7007), `AppIframe` (dead) | `Loader` | **Yes** | The single full-screen blocking loader (`z-[70]`). |

### 1.2 Dead (never imported anywhere in `src/`)

| Name | File | Props | Notable behaviour (if it were mounted) | Reachable? |
|---|---|---|---|---|
| `AppSidebar` | `src/components/AppSidebar.tsx` | none | Template sidebar; reads `user`/`role` from session/localStorage (`role` is never written). | **No** |
| `SuperAdminSidebar` | `src/components/SuperAdminSidebar.tsx` | `onNavigate?` | Router-link sidebar. `SuperAdminDashboard` builds its own sidebar inline (~L7787). | **No** |
| `SessionTimeout` | `src/components/SessionTimeout.tsx` | `timeoutMs = 60_000` | Idle timer that toasts and navigates to `/login`; storage clearing is commented out. | **No** — no idle timeout exists in the app. |
| `ProfileDropdown` | `src/components/ProfileDropdown.tsx` | none | Logout does `sessionStorage.clear()` + removes `authToken`/`userSession`/`userInfo` from localStorage. | **No** |
| `BackToTop` | `src/components/BackToTop.tsx` | `loading?` | Scroll-to-top button. | **No** |
| `Footer` | `src/components/Footer.tsx` | none | Fixed footer; pages render their own footers. | **No** |
| `StandaloneAppHeader` | `src/components/StandaloneAppHeader.tsx` | `AppHeaderProps` (search value, `onMenuClick`, …) | Links to `/dashboard`, a route that does not exist. | **No** |
| `AudioPlayer` | `src/components/AudioPlayer/AudioPlayer.tsx` (+ `.css`) | `audioTrack` | Custom audio player. `onLoadedMetadata` → `applyDuration` (~L141) caps the duration at 20 s (`Math.min(20, …)`) and a 200 ms interval stops playback once `currentTime >= duration`, so longer recordings would stop at 20 s. Irrelevant while unused. | **No** |
| `ExtractionMetrics` | `src/components/ocr/ExtractionMetrics.tsx` | `result: ExtractionResult` | Token / figure metrics card. | **No** |
| `StatusBadge` (ocr) | `src/components/ocr/StatusBadge.tsx` | `status`, `clickable?`, `onClick?` | Duplicate of OCREvaluation's local `StatusBadge` with fewer statuses. | **No** |

---

## 2. In-file components inside pages

### 2.1 `src/pages/SuperAdminDashboard.tsx`

The shell (`SuperAdminDashboard`, ~L7607) holds `activeSection` (default `'role-management'`), the Year/Cycle header state and an unused organisation list (`sharedProps` ~L7721 is built but never passed). Sidebar items: Role/User Management → `role-management`, Config Settings → `settings`, Subject & Question → `subject-question` (superadmin only), Marks Schema → `marks-schema` (superadmin only). `isAdmin` is `userRole === 'admin'`; **any other role, including a missing role, gets the Super Admin UI** (`loggedInRole` defaults to `'superadmin'`, ~L7617).

| Name | Line | Props | Key state | Events / callbacks | API dependency (paths) | Parent | Children | Reachable? | Business purpose |
|---|---|---|---|---|---|---|---|---|---|
| `YearCycleDropdowns` | ~L548 | `years`, `yearCode`, `onYearChange`, `yearsLoading`, `cycles`, `cycleCode`, `onCycleChange`, `cyclesLoading`, `variant: 'compact' \| 'settings'` | none (controlled) | `onYearChange`, `onCycleChange` → shell setters | none (data fetched by shell: `get-year-data`, `get-cycle-data`) | Shell `renderYearCycle()` (~L7723), passed down as the `yearCycleSelector` node | native selects | **Yes** | Shared Year / Cycle picker shown inside each section. |
| `SubjectQuestionPanel` | ~L614 | `yearCode`, `cycleCode`, `yearCycleSelector: ReactNode` | `subjects`, `selectedRows`, delete / status / preview flags, import state (`importTab`, `importFile`, `importRows`, `importYears`, `importSelectedYearCode`, `importCycles`, `importSelectedCycleCode`), `organizations`, `selectedOrg`, `selectedCustomer`, `questions`, `questionFormat` | `handleConfirmDeleteSubject` (~L1369), `handleToggleStatus` (~L1472), import upload handlers (~L797, ~L971) | `organization-details`, `get-year-data`, `get-cycle-data`, `get-subject-data`, `import-subject-data-v2`, `question-data`, `delete-subject`, `get-config-info`, `update-subject-data` (all on `VITE_AIMARKING_API_BASE`) | Shell, `activeSection === 'subject-question'` (~L7878) | `PageLoader`, `yearCycleSelector`, dialogs | **Yes** (Super Admin only) | Import subjects/questions from Excel, list, activate/deactivate and delete subjects, preview questions. |
| `MarksSchemaSection` | ~L2701 | `API_BASE`, `API_BASE1`, `yearCode`, `cycleCode`, `yearCycleSelector` | `subjects`, `selectedSubject`, `mdFile`, `pdfFile`, `pdfStep`, `cards`, `viewCard`, `cardContent`, org state, `uploading` | `handlePdfSelect` (~L2812), `handleMdSelect`, `handleSubmit`, `handleViewCard` (~L2979) | `organization-details`, `get-subject-data`, `get-marking-scheme`, `save-questions` (`VITE_AIMARKING_API_BASE`); `convert-markscheme-to-md`, `upload-marking-scheme` (`VITE_ICMEPRODUCT_API_BASE`); direct GET of the scheme file from `VITE_REPO_BASE` | Shell, `activeSection === 'marks-schema'` (~L7888) | `PageLoader`, `yearCycleSelector` | **Yes** (Super Admin only) | Upload a marking scheme (Word → Markdown conversion or `.md`), parse questions with `parseMarkdownToQuestions` (`src/utils/mdQuestionParser.ts`), save, and view uploaded schemes. |
| `SettingsSection` | ~L3817 | `API_BASE1`, `yearCode`, `cycleCode`, `yearCycleSelector` | Dozens: `passMark`, `topQuestionsCount`, standards / metadata / QNum / prompt / re-eval-agent toggles, `predefinedMapping`, `answerScriptType`, `selectedStages`, `isStandaloneMode`, `loadingSettings`, `isSavingToDB`, `organizations`, `selectedOrg`, `subjects` | `loadSettings` (~L4224), `handleSaveToDB` (~L4644), per-field `handleSave*` (write `org_*` localStorage) | `organization-details`, `get-subject-data`, `get-config-info`, `save-config-info` | Shell, `activeSection === 'settings'` (~L7900) | `TopQFractionInput`, `PageLoader`, `yearCycleSelector` | **Yes** (Super Admin and Admin) | Per-organisation workflow configuration: stages, Standalone Mode, OCR / indexing / evaluation options, thresholds. |
| `TopQFractionInput` | ~L3662 | `value`, `onChange`, `invalid?`, `compact?`, `title?`, `inherited?`, `showInherited?`, `lockedTotal?` | `focused` | `onChange` | none | `SettingsSection` (~L6255, ~L6289, ~L6345) | — | **Yes** | "N / M" input for the Top-N-questions-counted rule. |
| `RoleManagementSection` | ~L6491 | none (redefines `API_BASE1` locally ~L6492) | `selectedCustomer`, `customerList`, `organizations`, `selectedOrg`, `roleList`, `form*` fields, `editItem`, `editSnapshot`, `actionConfirm`, advanced filters, `filterStatus`, `searchQuery`, `isSaving` | `handleCreate` (~L6842), `handleEditSave`, `openEdit` (~L6681), delete / approve / reject handlers | `customer-details`, `organization-details`, `get-user-details`, `create-user` (create and edit), `delete-user` | Shell, `activeSection === 'role-management'` (~L7911, default section) | `PageLoader`, dialogs | **Yes** (label "User Management" for Admin) | Create, edit, activate/deactivate and delete users. |
| `AdminSubjectView` | ~L82 | none | `subjects`, `selected`, `selectedOrg`, … | `handleSelect` (writes `subjectcode`/`subjectCode`) | `organization-details`, `subject-list` | Shell, `activeSection === 'dashboard'` and not Admin (~L7873) | `OCREvaluation` with `overrideOrgCode` (~L211) | **No** — `'dashboard'` is never set | Legacy Super Admin subject picker that opened the evaluation workspace for any org. |
| `SubjectDashboard` (embedded) | ~L7871 | none | — | — | see §3 | Shell, `activeSection === 'dashboard'` and Admin | — | **No** (same unreachable branch) | Legacy "Admin sees the evaluator home". |
| `ImportPanel` | ~L2650 | `title`, `description`, `icon`, `acceptTypes?` | file / importing flags | `handleImport` — a 1.2 s `setTimeout` then a success toast (no API) | none | — | — | **No** (never rendered) | Placeholder import card. |
| `ExcelInlineEditor` | ~L395 | `onClear` | `sheets` (never populated), `apiEndpoint` (typed by user) | posts to the user-typed endpoint | arbitrary | — | — | **No** (never rendered) | Prototype spreadsheet editor. |
| `SandboxDashboard` (import) | L31 | — | — | — | — | imported, never rendered | — | n/a | Leftover import. |

Note: `PageLoader` is imported from `src/components/ui/loader.tsx`, not declared in this file.

### 2.2 `src/pages/OCREvaluation.tsx`

Top-level declarations found with `^const [A-Z]\w*\s*[:=]` / `^function [A-Z]`: only three are components — the rest are constants (`OCR_STANDARDS_EVALUATION_CRITERIA`, `IMAGE_BASE`, `API_BASE`, `API_BASE1`, `API_ENDPOINTS`, `QFLOW_MAX_IMAGES_PER_QUESTION`, `QFLOW_MAX_AUDIO_PER_QUESTION`). Every dialog, table and review screen is JSX inline in the single `OCREvaluation` function body (~L697 → ~L17658), not separate components.

| Name | Line | Props | Key state | Events / callbacks | API dependency | Parent | Children | Reachable? | Business purpose |
|---|---|---|---|---|---|---|---|---|---|
| `AttachedAudioPreview` | ~L322 | `file: File`, `onRemove: () => void` | `url` (object URL, revoked on unmount) | `onRemove` | none | `OCREvaluation`, per-question upload popup (~L17272) | `AudiotrackOutlinedIcon`, `<audio controls>` | **Yes** (when a question accepts an audio answer) | Preview a recorded/attached audio answer before upload. |
| `StatusBadge` (local) | ~L449 | `status: string`, `clickable?`, `onClick?`, `afterLabel?: ReactNode` | — | `onClick` → `handleOpenOcrReview` / `handleOpenEvaluationReview` / Phase 1 review | none | Candidate table cells (~L10085–10360) | lucide icons | **Yes** | Stage status chip per candidate (Yet to …, In Progress, Completed, Pending, Approved, Stopped, …); clickable when the stage can be reviewed. |
| `OCREvaluation` | ~L697 | see [component-data-flow §1](./component-data-flow.md#1-subjectdashboard--ocrevaluation) | ~180 `useState` hooks | — | see [API integration mapping](../api/api-integration-mapping.md) | `SubjectDashboard`, route `/ocr-evaluation`, `AdminSubjectView` (dead) | `HeaderAccountControls`, `StatusBadge`, `AttachedAudioPreview`, `StandaloneOCREvaluation`, `PageLoader` | **Yes** | Workspace / candidate / review engine. |

### 2.3 `src/pages/StandaloneOCREvaluation.tsx`

| Name | Line | Props | Key state | Parent | Children | Reachable? | Purpose |
|---|---|---|---|---|---|---|---|
| `StandaloneOCREvaluation` (default export) | ~L73 | `open: boolean`, `onClose: () => void`, `segments: SegmentImage[]` | `popupImage` | `OCREvaluation` (~L17652); route `/standalone-ocr` (no props) | `ScriptExtractorPanel`, nested `Dialog` → `ImageInspectorModal` | **Yes** as the OCR Review popup; **No** as a route (opens with `open` undefined → nothing visible) | OCR Review popup. Shows "No OCR data found for this candidate." when `segments` is empty. |
| `MOCK_SEGMENTS`, `readStoredOcrResult` (~L39), `buildSegmentsFromStoredResult` (~L55) | — | — | — | — | — | **Dead**: the two helpers are never called, so `MOCK_SEGMENTS` is never shown by this file. (OCREvaluation has its own bundled sample pages — see [known issues](../known-issues.md).) | — |

### 2.4 `src/pages/SandboxDashboard.tsx` (all effectively unreachable)

`Skeleton` (~L203), `ImageModal` (~L210), `FullScreenLoader` (~L223), `ImageUploadZone` (~L241), `RubricUpload` (~L338), `EvalResultCard` (~L377), `MessageSquareIcon` (~L492), `SandboxDashboard` (~L501). The page runs on bundled mock data (`MOCK_MODE = true`, ~L69) and redirects to `/login` unless `sessionStorage.sandboxLogin === 'true'`, which no code writes. Details: [sandbox-dashboard.md](../pages/sandbox-dashboard.md).

---

## 3. Page components used as components

| Page | File | Rendered by | Props accepted | Reachable? |
|---|---|---|---|---|
| `Login` | `src/pages/Login.tsx` | routes `/`, `/login` | — | Yes |
| `Register` | `src/pages/Register.tsx` (imported as `./pages/register`) | route `/register` | — | Route yes; form cannot submit (see [known issues](../known-issues.md)) |
| `SubjectDashboard` | `src/pages/SubjectDashboard.tsx` | route `/subject-dashboard`; `SuperAdminDashboard` dead branch | — | Yes |
| `OCREvaluation` | `src/pages/OCREvaluation.tsx` | `SubjectDashboard`; route `/ocr-evaluation` | 9 optional props | Yes |
| `SuperAdminDashboard` | `src/pages/SuperAdminDashboard.tsx` | route `/superadmin-dashboard` | — | Yes |
| `StandaloneOCREvaluation` | `src/pages/StandaloneOCREvaluation.tsx` | `OCREvaluation`; route `/standalone-ocr` | `open`, `onClose`, `segments` | Popup yes; route no |
| `SandboxDashboard` | `src/pages/SandboxDashboard.tsx` | route `/sandbox` | — | No |
| `NotFound` | `src/pages/NotFound.tsx` | route `*` | — | Yes |
| `AppIframe` | `src/pages/AppIframe.tsx` | nothing | — | No (not routed) |

---

## 4. shadcn/ui primitives — `src/components/ui/`

Verified by searching `src/` for `components/ui/<name>` imports. `*` marks an importer that is itself dead.

| Primitive | Used by pages / app components |
|---|---|
| `button` | Login, Register, NotFound, OCREvaluation, SubjectDashboard, SuperAdminDashboard, SandboxDashboard, StandaloneOCREvaluation, ocr/ExtractionControls, ocr/ExtractionOutputTabs, ocr/ScriptExtractorPanel, AppIframe*, AppSidebar*, BackToTop*, ProfileDropdown*, StandaloneAppHeader* |
| `input` | Login, Register, OCREvaluation, SubjectDashboard, SuperAdminDashboard, SandboxDashboard, StandaloneAppHeader* |
| `card` | Login, Register, OCREvaluation, SuperAdminDashboard, SandboxDashboard |
| `dialog` | Register, OCREvaluation, SubjectDashboard, SuperAdminDashboard, StandaloneOCREvaluation |
| `alert-dialog` | Login, OCREvaluation |
| `dropdown-menu` | HeaderAccountControls, OCREvaluation, SuperAdminDashboard, ProfileDropdown*, StandaloneAppHeader* |
| `tooltip` | App (`TooltipProvider`), OCREvaluation, SuperAdminDashboard, StandaloneOCREvaluation, `ui/dialog`, AudioPlayer* |
| `scroll-area` | OCREvaluation, SuperAdminDashboard, StandaloneOCREvaluation |
| `textarea` | OCREvaluation, SuperAdminDashboard, SandboxDashboard |
| `checkbox` | Register, OCREvaluation |
| `switch` | OCREvaluation, SuperAdminDashboard |
| `label` | Register, SuperAdminDashboard |
| `table` | OCREvaluation |
| `loader` (custom) | OCREvaluation, SuperAdminDashboard, AppIframe* |
| `toaster`, `sonner` | App |
| `avatar` | AppSidebar*, ProfileDropdown* |
| `separator` | StandaloneAppHeader*, `ui/sidebar` |
| `toast` | `ui/toaster`, `hooks/use-toast` |
| `sheet`, `skeleton` | `ui/sidebar` only |
| `toggle` | `ui/toggle-group` only |
| **No importer** | accordion, alert, aspect-ratio, badge, breadcrumb, calendar, carousel, chart, collapsible, command, context-menu, drawer, form, hover-card, input-otp, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, select, sidebar, slider, tabs, toggle-group, use-toast |

---

## 5. Non-component modules worth knowing

| Module | Status |
|---|---|
| `src/lib/session.ts` (`getSessionCodes`, `clearAuthSession`, `getAccountAccess`) | Live; `clearAuthSession` is only called from `Login.tsx`. |
| `src/lib/extraction.ts` (`runExtraction`, `DEFAULT_OPTIONS`, `ALLOWED_SUBJECTS`) | Live (ScriptExtractorPanel; dynamic import in OCREvaluation ~L11919). |
| `src/utils/mdQuestionParser.ts` | Live (MarksSchemaSection). |
| `src/api.ts` | Partly live: `loginUser`, `registerUser`; `getAppDetails` only from dead `AppIframe`. |
| `src/api_ish.ts`, `src/api/base.ts`, `src/api/base_ish.ts`, `src/api/updateQuestion.ts`, `src/utils/api.ts`, `src/utils/Aigapi.ts`, `src/utils/config.ts`, `src/utils/getTFOptions.ts`, `src/config.js`, `src/hooks/use-mobile.tsx` (only via unused `ui/sidebar`) | **Dead** — no importer from live code. |
