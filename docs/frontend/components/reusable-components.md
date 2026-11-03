# Reusable Components

Only a handful of components in this codebase are genuinely reused (rendered from more than one call site, or designed as a self-contained contract). This document lists them with their prop contracts and **real call sites** so new code uses them the same way.

Everything else is either a page, an in-file section rendered exactly once, or dead code — see the [Component inventory](./component-inventory.md).

---

## 1. `PageLoader` — the single blocking loader

**File:** `src/components/ui/loader.tsx` → `PageLoader` (and the inner `Loader`).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `text` | `string?` | `"Please wait..."` | Every live caller uses the default, so the wording is the same everywhere. |

Behaviour: fixed full-screen **solid white** overlay at `z-[70]`; blocks all clicks; sits above dialogs so approve/save actions show it. Toasts (sonner) still appear above it.

Real call sites:

```tsx
// src/pages/OCREvaluation.tsx (~L8522)
{(isPageLoaderActive || isPopupLoaderActive) && <PageLoader />}

// src/pages/SuperAdminDashboard.tsx → SettingsSection (~L4844)
{loadingSettings && <PageLoader />}
{isSavingToDB && <PageLoader />}

// src/pages/SuperAdminDashboard.tsx → MarksSchemaSection (~L3015), RoleManagementSection (~L7007)
{uploading && <PageLoader />}
{isSaving && <PageLoader />}
```

Usage rules:

- Drive it from a boolean flag that is reset in `finally`, as every caller above does. A flag that is never reset leaves the user on a white screen (see [Troubleshooting → blank page](../support/troubleshooting.md#11-navigation-failure--blank-page)).
- `SubjectDashboard.tsx` does **not** use `PageLoader`; it shows inline spinners (`Loader2`) per list.

---

## 2. `HeaderAccountControls` — header tokens + account menu

**File:** `src/components/HeaderAccountControls.tsx`

| Prop | Type | Default | Notes |
|---|---|---|---|
| `displayName` | `string` | — | Falls back to `"User"` when blank. |
| `tokenCount` | `number` | — | Shown with `toLocaleString()` when the tokens button is opened. |
| `onLogout` | `() => void` | — | Called from the avatar menu's Logout item. The component does not clear storage itself. |
| `showLogout` | `boolean?` | `true` | Hides the Logout item. |

Reads `sessionStorage.userInfo` to show the e-mail (`email` / `gmail` / `emailId` / `emailid`). The current login stores `userInfo` without an e-mail field (`Login.tsx` → `handleSubmit` writes `{userCode, orgCode, customerCode, userRole, username}`), so the e-mail line is normally empty.

Real call sites:

```tsx
// src/pages/SubjectDashboard.tsx (~L693)
<HeaderAccountControls
  displayName={displayName || 'Evaluator'}
  tokenCount={tokenCount}          // sum of totaltokenusage over list-workspace
  onLogout={handleLogout}
/>

// src/pages/OCREvaluation.tsx (~L8652)
<HeaderAccountControls
  displayName={displayName}
  tokenCount={headerTokenCount || 0}
  onLogout={handleLogout}
  showLogout={!isSuperAdmin}       // hidden only when userRole === 'superadmin'
/>
```

`SuperAdminDashboard` does **not** use this component; it renders its own avatar menu inline (~L7840).

---

## 3. `YearCycleDropdowns` — shared Year / Cycle picker (admin)

**File:** `src/pages/SuperAdminDashboard.tsx` → `YearCycleDropdowns` (~L548). In-file, but reused by three sections through a pre-rendered node.

| Prop | Type | Notes |
|---|---|---|
| `years` | `{ yearcode, yearname }[]` | From the shell's `get-year-data` call. |
| `yearCode` / `onYearChange` | `string` / `(code) => void` | Controlled. |
| `yearsLoading` | `boolean` | Shows a single "Loading..." option and disables the select. |
| `cycles` | `{ cyclecode, cyclename }[]` | From the shell's `get-cycle-data?YearCode=` call. |
| `cycleCode` / `onCycleChange` | `string` / `(code) => void` | Controlled. |
| `cyclesLoading` | `boolean` | As above. When `cycles` is empty: "No cycles", disabled. |
| `variant` | `'compact' \| 'settings'` | Styling only. |

Pattern — the shell renders it once per section and passes the **node** down, so sections never own Year/Cycle state:

```tsx
// src/pages/SuperAdminDashboard.tsx → SuperAdminDashboard (~L7723)
const renderYearCycle = (variant: 'compact' | 'settings') => (
  <YearCycleDropdowns years={headerYears} yearCode={headerSelectedYearCode}
    onYearChange={setHeaderSelectedYearCode} yearsLoading={headerYearsLoading}
    cycles={headerCycles} cycleCode={headerSelectedCycleCode}
    onCycleChange={setHeaderSelectedCycleCode} cyclesLoading={headerCyclesLoading}
    variant={variant} />
);

<SettingsSection API_BASE1={API_BASE1}
  yearCode={headerSelectedYearCode} cycleCode={headerSelectedCycleCode}
  yearCycleSelector={renderYearCycle('settings')} />
```

The section places `{yearCycleSelector}` in its toolbar (`SubjectQuestionPanel` ~L1585, `MarksSchemaSection` ~L3055, `SettingsSection` ~L4888) and reads the codes from its `yearCode` / `cycleCode` props.

Caveat: when the years list is empty and not loading, the Year select renders **no options at all** (there is no "No years" placeholder).

---

## 4. `StatusBadge` (OCREvaluation local)

**File:** `src/pages/OCREvaluation.tsx` → `StatusBadge` (~L449). Rendered from every stage column of the candidate table (~L10085–10360).

| Prop | Type | Notes |
|---|---|---|
| `status` | `string` | Key into an internal config map (e.g. `yet-to-segmentation`, `yet-to-ocr`, `in-progress`, `completed`, `pending`, `approved`, `stopped`). |
| `clickable` | `boolean?` | Callers pass `true` for `completed` / `pending` / `approved`. |
| `onClick` | `() => void?` | Opens the stage's review dialog. |
| `afterLabel` | `ReactNode?` | Extra marker after the label (used for the "reviewed" indicator on Phase 1). |

```tsx
// src/pages/OCREvaluation.tsx (~L10116)
<StatusBadge
  status={candidate.phase2}
  clickable={candidate.phase2 === "completed" || candidate.phase2 === "pending" || candidate.phase2 === "approved"}
  onClick={() => handleOpenOcrReview(candidate)}
/>
```

Do not confuse with `src/components/ocr/StatusBadge.tsx`, an older copy that is never imported.

---

## 5. `TopQFractionInput`

**File:** `src/pages/SuperAdminDashboard.tsx` → `TopQFractionInput` (~L3662). Used three times inside `SettingsSection` (~L6255, ~L6289, ~L6345) — global, per-subject and predefined-mapping contexts.

| Prop | Type | Notes |
|---|---|---|
| `value` | `string` | `"N/M"` (default constant `TOP_Q_DEFAULT = '/'`). |
| `onChange` | `(val: string) => void` | Every keystroke is accepted; caller validates. |
| `invalid` | `boolean?` | Red border. |
| `lockedTotal` | `number?` | Fixes the denominator (e.g. to the predefined question total). |
| `compact`, `title`, `inherited`, `showInherited` | optional | Display only. |

---

## 6. OCR review set (`src/components/ocr/`)

These are single-use today but are written as self-contained components with typed contracts. Full detail: [OCR components](./ocr-components.md).

| Component | Contract | Real call site |
|---|---|---|
| `StandaloneOCREvaluation` (page used as a dialog) | `open: boolean`, `onClose()`, `segments: SegmentImage[]` | `OCREvaluation.tsx` ~L17652: `open={!!standaloneOcrPopupData}`, `segments={standaloneOcrPopupData \|\| []}` |
| `ScriptExtractorPanel` | `segments: ExtractorSegment[]`, `onInspectImage({url,label})` | `StandaloneOCREvaluation.tsx`: `segments={segments} onInspectImage={setPopupImage}` |
| `ExtractionOutputTabs` | `result: ExtractionResult \| null`, `onCopy(text,label)`, `isRunning?` | `ScriptExtractorPanel.tsx`: `result={result} onCopy={handleCopy} isRunning={isRunning}` |
| `ImageInspectorModal` | `imageUrl`, `label`, `onClose()` | `StandaloneOCREvaluation.tsx`, inside a nested full-screen `Dialog` |
| `ExtractionControls` | `subject`, `onSubjectChange`, `onExtract`, `isRunning`, `disabled?`, `showButton?` | `ScriptExtractorPanel.tsx` with `showButton={false}` → renders nothing visible (see [known issues](../known-issues.md)) |

`ExtractorSegment` (exported from `ScriptExtractorPanel.tsx`) is the data contract between OCREvaluation and the popup: `id`, `imageUrl`, `label`, `ocrText`, plus optional rich fields `ocrBlocks`, `ocrFigureCounts`, `ocrTokens`, `ocrSubject`, `ocrIssues`, `ocrTranscriptionLatex`, `ocrInterpretation`, `ocrHasData`.

---

## 7. Shared helpers that behave like components' contracts

| Helper | File | Use it for |
|---|---|---|
| `getSessionCodes()` | `src/lib/session.ts` | `{usercode, custcode: 'ICME', orgcode, appcode}` resolved from the dual-case session keys. Note `custcode` is **always `'ICME'`**. |
| `clearAuthSession()` | `src/lib/session.ts` | Remove every auth key from session and localStorage. Only `Login.tsx` calls it today; logout handlers do not. |
| `cn()` | `src/lib/utils.ts` | Merge Tailwind classes. |
| `toast` from `sonner` | — | The live notification pattern (bottom-right). |

---

## 8. Guidance for new reusable components

1. Lift anything rendered in two places into `src/components/` rather than copying JSX inside the large page files.
2. Accept data as props; let the container read `sessionStorage` via `getSessionCodes()`.
3. Follow the `yearCycleSelector` pattern (container owns state, passes a node or callbacks) instead of each child fetching the same list.
4. Never render API- or user-supplied HTML without sanitising it (the `marked` → `dangerouslySetInnerHTML` path in `ExtractionOutputTabs` is the current counter-example).
