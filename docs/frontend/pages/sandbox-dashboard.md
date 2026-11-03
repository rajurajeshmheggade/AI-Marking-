# Sandbox Dashboard (`/sandbox`)

`src/pages/SandboxDashboard.tsx` → default export `SandboxDashboard`.

A self-contained "Evaluation Workbench" UI with three pipelines — **OCR**, **Evaluation**, **OCR + Evaluation**. In the current source it is a **front-end mock only**: it makes **no network requests**. All results come from an in-file mock engine (`MOCK_MODE = true`, exported).

---

## 1. Route and access guard

| Item | Value |
|---|---|
| Route | `<Route path="/sandbox" element={<SandboxDashboard />} />` in `src/App.tsx` |
| App-level auth | Not wrapped in `RequireAuth` (comment in `App.tsx`: "/sandbox is deliberately excluded - it guards itself on its own sandboxLogin key") |
| Own guard | `useEffect`: if `sessionStorage.sandboxLogin !== 'true'` → `navigate('/login', {replace: true})` |
| Who sets `sandboxLogin` | Nothing in `src/` writes this key. The page is reachable only if the key is set externally (e.g. manually in dev tools). |
| Guard timing | Runs after the first render, so the page paints once before redirecting. |
| Other references | `SuperAdminDashboard.tsx` imports `SandboxDashboard` but never renders it. |

### Session keys

| Key (sessionStorage) | Read | Written / removed |
|---|---|---|
| `sandboxLogin` | guard | removed on Logout |
| `sandboxUsername` | `getSandboxUser().username` (default `'rajesh'`) | removed on Logout |
| `sandboxDisplayName` | header name chip (default `'Rajesh'`) | removed on Logout |

---

## 2. Layout

```text
Page
├─ FullScreenLoader (message per running mode)
├─ ImageModal (when previewImg)
├─ Header (sticky)
│  ├─ Logo (/lovable-uploads/…png) · "OCR Evaluation" · "AI powered Essay Marking"
│  ├─ Mode <select> (hidden < sm): "Select Mode..." (disabled) · OCR · Evaluation · OCR + Evaluation
│  ├─ User chip (displayName)
│  ├─ "0 Tokens" chip (static)
│  └─ Logout
├─ Main (max-w-6xl)
│  ├─ home      → HomePannel   (3 cards → set mode)
│  ├─ ocr       → OcrPanel
│  ├─ evaluation→ EvaluationPanel
│  └─ ocr-eval  → ComboPanel
└─ Footer "Copyright © 2026 | Excelsoft Technologies Ltd. | Version: V.1.0.0"
```

`sidebarOpen` state and several icons are declared but no sidebar is rendered. On mobile (< `sm`) the mode select, user chip and Logout are hidden, so the only way to switch mode is the home cards (there is no way back to home).

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/sandbox-home.png — Sandbox Evaluation Workbench home with the three pipeline cards]

---

## 3. Panels

### OCR

| Control | Rule | Handler |
|---|---|---|
| `ImageUploadZone` | accepts `image/png`, `image/jpeg`, `image/webp` (others skipped with `toast.warning('Some files were skipped (only PNG/JPG/JPEG/WEBP allowed)')`); drop zone shown only when no images; "Add More" afterwards; hover → Preview / Remove | `addImages` (reads each file as base64 data URL), `removeImage` |
| Question Number (optional) | free text | `ocrQuestion` |
| **Run OCR** | disabled while loading or no images | `runOcr` → `mockRunOcr` |

`mockRunOcr` logs the would-be payload `{username, question_number, images:[{filename, data}]}` to the console, waits 1.5–2.5 s, returns one result per image with rotating sample text, random tokens (350–750) and time. UI: skeletons while loading, then per-image split cards (image + text, Copy), Copy All, Download OCR (`ocr-results.txt`), summary bar (images, total time, total tokens). Toast: "OCR completed — Mock data returned".

### Evaluation

| Control | Rule |
|---|---|
| OCR Text (required) | textarea, character count |
| Rubric (`.md` only via `accept`) | `RubricUpload`; shows name and size; remove |
| **Evaluate** | disabled while loading, empty text or no rubric |

`runEval` reads the rubric text, calls `mockRunEval` (2–3 s delay; random 12–19 of 20, random feedback/achieved/missing points, tokens, time). Result → `EvalResultCard`.

### OCR + Evaluation

Images + rubric (required) + optional question number. **Run Complete Evaluation** runs `mockRunOcr`, pauses 400 ms, then `mockRunEval` on the joined OCR text. Step indicator: "Step 1 — OCR" → "Step 2 — Evaluation" (idle / running / done / error). Shows OCR cards and the evaluation card.

### EvalResultCard

| Percentage | Colour | Label |
|---|---|---|
| ≥ 70 | green | Pass |
| ≥ 40 | yellow | Below Average |
| < 40 | red | Fail |

These thresholds are hardcoded here and unrelated to the configured pass mark used on the OCR Evaluation page. Actions: Copy Result, Download Report (`evaluation-report.txt`).

---

## 4. APIs

None. The mock functions' comment reads "Replace with real fetch() calls once backend is ready." There is no use of `API_BASE`, `API_BASE1` or `runExtraction` in this file.

## 5. Notes / risks

- Hardcoded default identity `rajesh` / `Rajesh` when session keys are absent.
- Panels are defined as components inside the render function (`HomePannel`, `OcrPanel`, …) and rendered as `<OcrPanel />`, so React sees a new component type on every parent render and remounts the panel. Values survive (held in parent state), but each keystroke in the Question Number / OCR Text fields re-renders the parent and remounts the field, which is expected to drop input focus after every character.
- `ImageUploadZone.onDrop` is memoised with an empty dependency list and closes over the first `handleFiles`/`onAdd`.

See also: [overview of the review layer](../user/user-review-and-evaluation.md).
