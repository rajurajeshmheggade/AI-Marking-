# Miscellaneous Pages and Dead Modules

Covers `src/pages/NotFound.tsx`, `src/pages/AppIframe.tsx`, and a short inventory of unused modules. The big pages are documented elsewhere: OCR evaluation and subject dashboard in [`../user/`](../user/), super admin in [`../admin/`](../admin/), registration in [register-page.md](./register-page.md).

---

## 1. NotFound — `src/pages/NotFound.tsx`

| | |
|---|---|
| Route | `*` (catch-all, last in `src/App.tsx`) |
| Guard | none |
| Renders | Full-height centred column: heading **404**, text "Page not found.", and a `<Link to="/login">` wrapping a shadcn `Button` "Back to Login". |
| State / APIs | none |
| Reached by | any unknown URL, including `/dashboard` — which `Register.tsx` navigates to after a successful auto-login (see [register-page.md §3](./register-page.md#3-post-registration-e-mail-and-activation-sendregistrationemail)) |

If the user is still signed in, "Back to Login" leads to `/login`, whose `useEffect` redirects them to their role's landing page.

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/not-found.png — the 404 page with the "Back to Login" button]

---

## 2. AppIframe — `src/pages/AppIframe.tsx` (not routed)

**Status: dead code.** It is not declared in `src/App.tsx` and no file imports it (searched for `AppIframe` across `src/`). It cannot be reached in the running app. It appears to be carried over from the AI-Levate apps portal, where it opened partner apps through SSO inside an iframe.

What the code would do if routed (it expects a `:appCode` URL parameter via `useParams`):

```text
mount
 ├─ effect 1 (appCode): read sessionStorage.userInfo → userCode, orgCode
 │     missing → error "User not logged in or missing codes"
 │     getAppDetails(usercode, orgcode, 1)          (src/api.ts)
 │        GET {VITE_API_APPS_URL}/get_app_details?usercode=…&orgcode=…&subscription=1
 │        (if role in storage is 'user', keeps only items with isSubscribed === 2)
 │     find app by appCode (case-insensitive) → else "App <code> not found"
 │     app.isRedirect must be truthy → else "This app is not configured for iframe redirection."
 │     setApp(match)
 └─ effect 2 (appCode): POST {VITE_AIAPPS_API_BASE}/Login/ssoTokenGen
       body { username: sessionStorage.email, password: sessionStorage.password, appcode }
       !res.ok → "HTTP <status>"; no data.token → "Token not present in response"
       setToken(token)
iframeSrc = applicationURL contains '#' ? applicationURL + (?|&) + "isSSO=1&token=<enc>"
                                        : applicationURL + "#/isSSO=1&token=<enc>"
render: header (logo, "Back to Dashboard" → /dashboard, Logout), PageLoader while loading,
        red error box, or full-height <iframe allow="clipboard-write; fullscreen; display-capture;">
```

Errors are also raised as sonner `toast.error`. Logout removes the 8 standard session keys and navigates to `/login`.

Why it would not work as-is in this app:

- `sessionStorage.email` is never written (nothing in `src/` sets it), so the SSO request would send `username: null`.
- `VITE_API_APPS_URL` is not defined in any `.env.*.example`.
- `/dashboard` does not exist.
- The two effects run in parallel and both toggle `loading`, so the loader can disappear before app details arrive.
- It depends on the plain-text `sessionStorage.password`.

---

## 3. Other unrouted or blank routes

| Item | Status |
|---|---|
| `/standalone-ocr` → `StandaloneOCREvaluation` | Routed but renders nothing: the component is a controlled `Dialog` requiring `open`, `onClose`, `segments`; the route passes none. The module-level helpers `readStoredOcrResult` / `buildSegmentsFromStoredResult` and `MOCK_SEGMENTS` are unused, and `sessionStorage.standalone_ocr_result` is never written. Real use: popup inside `OCREvaluation` (`<StandaloneOCREvaluation open={!!standaloneOcrPopupData} …/>`). |
| `/sandbox` → `SandboxDashboard` | Routed, but its guard requires `sessionStorage.sandboxLogin === 'true'`, which nothing writes, so it always redirects to `/login`. Also imported (unused) by `SuperAdminDashboard.tsx`. Details: [sandbox-dashboard.md](./sandbox-dashboard.md). |

---

## 4. Dead module inventory

Verified by searching `src/` for an import of each path (`from '…'` with `@/` and relative forms). Only `@/api` (= `src/api.ts`) is imported, by `Login.tsx`, `Register.tsx` and `AppIframe.tsx`.

| Module | Content | Evidence |
|---|---|---|
| `src/api_ish.ts` | Older copy of `src/api.ts`, uses `VITE_LOGIN_API_BASE`. | no importer |
| `src/utils/api.ts` | Another copy, `VITE_LOGIN_API_BASE`. | no importer |
| `src/utils/Aigapi.ts` | Copy for an "AIG" item generator, `VITE_AIG_ITEM_GEN_API_URL`. | no importer |
| `src/config.js` | Knowledge-base endpoint map with hard-coded hosts. | no importer |
| `src/utils/config.ts` | `getApiBaseUrl()` (`VITE_LOCAL_PROXY`, `VITE_AI_EXCELSOFT_BASE`). | no importer |
| `src/utils/getTFOptions.ts` | True/false option helper. | no importer |
| `src/api/base.ts`, `src/api/base_ish.ts`, `src/api/updateQuestion.ts` | 0-byte files. | empty |
| Unused exports in `src/api.ts` | `getLearningObjectives`, `fetchUsageStats`, `getBookWiseUsage`, `getChapters`, `fetchDropdownOptions`, `generateItem`, `getFromDB`, `deleteQuestion`, `subscribeToApp`, `updateQuestion`, `sendStep1API`–`sendStep3API`, `API_QUIZ_URL`. | no importer |
| Components | `SessionTimeout`, `AppSidebar`, `SuperAdminSidebar`, `ProfileDropdown`, `StandaloneAppHeader`, `Footer`, `BackToTop`, `AudioPlayer/AudioPlayer`, `ocr/ExtractionMetrics`, `ocr/StatusBadge`. | no importer |
| `src/App.css` | Template CSS. | not imported |
| `src/hooks/use-mobile.tsx` | Used only by the unused `ui/sidebar.tsx`. | — |

Recommendation (not applied): delete or move these to an `archive/` folder outside `src/` so new developers do not edit the wrong API module, and so `tsc` / ESLint output shrinks.
