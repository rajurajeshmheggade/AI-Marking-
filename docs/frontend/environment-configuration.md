# Environment Configuration

> Real values are never reproduced in this document. Variables are shown as `VAR_NAME=<configured-value>`. Ask the team lead for the values for each environment.

Related: [developer-onboarding.md](./developer-onboarding.md), [architecture/frontend-architecture.md](./architecture/frontend-architecture.md#310-configuration).

---

## 1. How Vite environment variables work in this project

- Only variables prefixed `VITE_` are exposed to browser code, via `import.meta.env.VITE_…`.
- They are **replaced at build time**. `npm run build` inlines the current values into the JavaScript in `dist/`. Changing `.env` on a server after the build has no effect — you must rebuild. The same `dist/` cannot be promoted from Testing to Production with different URLs.
- Files Vite loads (in increasing priority): `.env` → `.env.local` → `.env.[mode]` → `.env.[mode].local`. `npm run dev` uses mode `development` (so `.env.development` is loaded on top of `.env`); `npm run build` uses mode `production`; `npm run build:dev` uses `development`.
- Values in `.env.*.example` files are **not** loaded by Vite (the names do not match the pattern). They are templates to copy to `.env`.
- `src/vite-env.d.ts` only references `vite/client`; there is no typed `ImportMetaEnv` interface, so a misspelt variable name compiles silently and evaluates to `undefined`.
- Almost every usage has a hard-coded fallback (`import.meta.env.X || '<built-in URL>'`). A missing variable therefore does **not** break the build or show an error — the app silently calls the built-in host, which for most variables is an ICME production or Excelsoft POC host.

---

## 2. The env files in the repository

| File | Loaded by Vite? | Purpose | Variables (names only) |
|---|---|---|---|
| `.env.example` | No (template) | Generic template: "Copy this file to .env and adjust per environment". | the six core variables (§3) |
| `.env.production.example` | No (template) | Production endpoints; header asks to fill in the deploying branch. | six core variables |
| `.env.demo.example` | No (template) | Demo endpoints. | six core variables |
| `.env.testing.example` | No (template) | Testing / POC endpoints. | six core variables |
| `.env` | **Yes**, every mode | The active configuration. Present locally; ignored by `.gitignore` (`.env`, `.env.*` except the four examples). Contains the six core variables plus commented-out alternate blocks for other environments. | six core variables |
| `.env.development` | **Yes**, in `development` mode | Contains one variable, `VITE_API_BASE`, which **nothing in `src/` reads**. | `VITE_API_BASE` |
| `.envIsh` | No (not a Vite file name) | Legacy configuration from the item-generation product. | `VITE_LOGIN_URL`, `VITE_SEND_EMAIL_URL`, `VITE_API_BASE_URL`, `VITE_API_QUIZ_URL`, `VITE_API_APPS_URL`, `VITE_API_APPS_URL_AGENTS`, `VITE_ITEM_GEN_API_URL`, `VITE_API_URL` |
| `public/env.json` | No | Static JSON with legacy keys (`url`, `loginurl`, `orgcode`, `appcode`, `custcode`, `path`). Served publicly at `/env.json`, but nothing in `src/` fetches it. | — |

---

## 3. Variables referenced in `src/`

Found by searching `import.meta.env` across `src/`.

### 3.1 Core variables (present in all example files)

| Variable | Purpose | Used in (file → symbol) | Fallback when unset | Dev format | Prod format |
|---|---|---|---|---|---|
| `VITE_AIMARKING_API_BASE` | AIMarking REST API: login, configuration, year/cycle/subject, workspaces, candidates, organisations, users. | `src/api.ts` → `loginUser`; `src/pages/Login.tsx` → `CONFIG_API_BASE`; `src/pages/OCREvaluation.tsx` → `API_BASE1`, config fetch effects (~L1114, ~L3152); `src/pages/SubjectDashboard.tsx` → `API_BASE1`; `src/pages/SuperAdminDashboard.tsx` → `API_BASE1`, `RoleManagementSection` | Built-in ICME production AIMarking API URL (same in all 8 places). | Absolute `https://` URL that **includes the trailing `/api` path segment**, no trailing slash. Code appends `/login`, `/get-config-info`, etc. | Same shape, production host. |
| `VITE_ICMEPRODUCT_API_BASE` | ICME product / OCR processing API: uploads, run-ocr, evaluation, save-* endpoints, mark-scheme conversion. | `src/pages/OCREvaluation.tsx` → `API_BASE`, `API_ENDPOINTS.runOcr/ocrImage/evaluateText`; `src/pages/SubjectDashboard.tsx` → `API_BASE`; `src/pages/SuperAdminDashboard.tsx` → `API_BASE`, mark-scheme upload (~L2828) | Built-in ICME production `…/icmeproduct` URL — **except** the mark-scheme conversion call (~L2828), whose fallback is a different (POC) host and path. | Absolute `https://` URL, no trailing slash. | Same. |
| `VITE_REPO_BASE` | Root of the image / document repository; relative paths returned by the API are appended to it. | `src/pages/OCREvaluation.tsx` → `IMAGE_BASE` (adds a `/`); `src/pages/SuperAdminDashboard.tsx` → `REPO_BASE` (guideline links) | Built-in ICME production repo URL. The two fallbacks differ in path **letter case**, which matters on case-sensitive servers. | Absolute `https://` URL, **no trailing slash** (OCREvaluation adds one; SuperAdmin adds `/` before the path). | Same. |
| `VITE_AIAPPS_API_BASE` | AI-apps platform: AI transcription (master agent), registration e-mail, user activation, help page, SSO token. | `src/lib/extraction.ts` → `DEFAULT_ENDPOINT`; `src/pages/OCREvaluation.tsx` → `API_ENDPOINTS.aiTranscription`; `src/pages/Register.tsx` → send-email, `updateActiveRegisteredUser`, Help link; `src/pages/AppIframe.tsx` → `SSO_ENDPOINT` (dead) | Built-in Excelsoft POC `…/aiapps` URL. | Absolute `https://` URL ending with the `/aiapps` segment, no trailing slash. | Same. |
| `VITE_AIAPPS_WEB_BASE` | Web front-end that the registration e-mail's "Login" button points to. | `src/pages/Register.tsx` → `sendRegistrationEmail` (`<base>/#/login?data=…`) | Built-in Azure static-website URL. | Absolute `https://` origin, no trailing slash. Note the link uses **hash routing** (`/#/login`), i.e. it targets the separate AI-Levate apps portal, not this app (which uses `BrowserRouter`). | Same. |
| `VITE_AI_EXCELSOFT_BASE` | Excelsoft AI site; EULA link. | `src/pages/Register.tsx` (EULA `<a href>`); `src/utils/config.ts` → `getApiBaseUrl` (dead) | Built-in Excelsoft AI site URL. | Absolute `https://` origin, no trailing slash (code appends `/aiapps/EULA/AIEULA.html`). | Same. |

### 3.2 Variables used in code but **missing from every example file**

| Variable | Used in | Effect when unset (the normal case) |
|---|---|---|
| `VITE_API_BASE_URL` | `src/api.ts` → `API_BASE_URL` → `registerUser` (**live**, called by `Register.tsx`) | **No fallback.** The URL becomes the string `undefined/aiapps/AIProductApi/signup`, which the browser resolves relative to the current page (e.g. `<app-origin>/undefined/aiapps/…`). Registration therefore fails unless this variable is set. Defined only in the legacy `.envIsh`. |
| `VITE_API_APPS_URL` | `src/api.ts` → `getAppDetails`, `subscribeToApp` | Only reached from dead code (`AppIframe.tsx`). |
| `VITE_ITEM_GEN_API_URL` | `src/api.ts` → unused item-generation functions | None in practice. |
| `VITE_API_QUIZ_URL` | `src/api.ts` → exported `API_QUIZ_URL` (never used) | None. |
| `VITE_LOGIN_API_BASE`, `VITE_AIG_ITEM_GEN_API_URL` | dead modules `src/api_ish.ts`, `src/utils/api.ts`, `src/utils/Aigapi.ts` | None. |
| `VITE_LOCAL_PROXY` | `src/utils/config.ts` (dead) | None. |

### 3.3 Built-in Vite flags

| Flag | Used in | Purpose |
|---|---|---|
| `import.meta.env.DEV` | `src/pages/OCREvaluation.tsx` → `fetchImageBlob`; `src/utils/config.ts` (dead) | In dev only, image downloads fall back to the same-origin `/ICMEOcrRepo/...` path that the Vite dev proxy forwards (works around missing CORS headers on the repo host). Production builds use only the absolute URL. |

### 3.4 Variables present in env files but unused in code

| Variable | File(s) |
|---|---|
| `VITE_API_BASE` | `.env.development` |
| `VITE_LOGIN_URL`, `VITE_SEND_EMAIL_URL`, `VITE_API_APPS_URL_AGENTS`, `VITE_API_URL` | `.envIsh` |

All six core variables in the example files are used.

---

## 4. Setting up an environment

```text
# choose one template
cp .env.testing.example .env        # Testing / POC
cp .env.demo.example .env           # Demo
cp .env.production.example .env     # Production
```

Then edit `.env`:

```text
VITE_AIMARKING_API_BASE=<configured-value>
VITE_ICMEPRODUCT_API_BASE=<configured-value>
VITE_REPO_BASE=<configured-value>
VITE_AIAPPS_API_BASE=<configured-value>
VITE_AIAPPS_WEB_BASE=<configured-value>
VITE_AI_EXCELSOFT_BASE=<configured-value>
# required only if the /register page must work:
VITE_API_BASE_URL=<configured-value>
```

Restart `npm run dev` after editing (Vite reads env files at start-up), or rebuild for deployment.

Checklist:

- [ ] No trailing slash on any base.
- [ ] `VITE_AIMARKING_API_BASE` ends with the `/api` segment the backend expects.
- [ ] The backend hosts allow CORS from your dev origin (`http://localhost:8081`) — the dev proxy only covers `/api` and `/ICMEOcrRepo`, and the app calls the absolute base URLs directly.
- [ ] After `npm run build`, search `dist/assets/*.js` for the expected host to confirm the right values were baked in.

---

## 5. Dev-server proxy (`vite.config.ts`)

Only active when `mode === 'development'`:

| Path prefix | Target | Rewrite | Used by app code? |
|---|---|---|---|
| `/api` | AI-apps static web host (`<configured in vite.config.ts>`) | `^/api` → `/ai-apps/api` | **No** — no request in `src/` starts with `/api/`. |
| `/ICMEOcrRepo` | ICME OCR image repository host | none | Yes — dev-only fallback in `OCREvaluation.tsx` → `fetchImageBlob`. |

The proxy targets are hard-coded in `vite.config.ts`, not read from env.

---

## 6. Known configuration risks

| Risk | Detail |
|---|---|
| Silent production fallback | A forgotten variable in a Testing build calls production. Consider failing the build when a core variable is missing. |
| Registration base missing | `VITE_API_BASE_URL` is required by live code but not documented in any template. |
| Inconsistent fallbacks | `VITE_ICMEPRODUCT_API_BASE` has a different fallback host for the mark-scheme conversion; `VITE_REPO_BASE` fallbacks differ in letter case. |
| Untyped env | No `ImportMetaEnv` typing; typos are not caught. |
