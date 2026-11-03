# Developer Onboarding

Goal: get a new frontend developer from a fresh machine to a running, debuggable app, and explain where things live.

Read next: [architecture/frontend-architecture.md](./architecture/frontend-architecture.md) → [architecture/application-flow.md](./architecture/application-flow.md) → [environment-configuration.md](./environment-configuration.md).

---

## 1. Prerequisites

| Tool | Version | Evidence / note |
|---|---|---|
| Node.js | 18 or newer (Vite 5 requirement). The current maintainer machine runs Node 24 / npm 11. | `package.json` has **no `engines` field** and there is no `.nvmrc`; pin a version in your team if needed. |
| npm | bundled with Node | `package-lock.json` is present and newer than `bun.lockb` (Sep vs Apr) — **use npm**. |
| Bun | optional | `bun.lockb` is a leftover from the Lovable template; mixing package managers produces divergent dependency trees. |
| Git | any | The project originated as a Lovable project (`README.md`); `lovable-tagger` is a dev dependency. |
| Browser | Chrome/Edge with React Developer Tools | for debugging |
| OS | Windows works. On Linux/macOS (case-sensitive FS) see §8 "Case-sensitive import". | |

Access you need from the team: the environment values for `.env` (never committed), and test credentials per role (superadmin, admin, user).

---

## 2. Install

```text
cd D:\ICME\full_updated
npm ci            # reproducible install from package-lock.json (or: npm install)
```

---

## 3. Environment setup

```text
copy .env.testing.example .env      # Windows (cmd)
cp   .env.testing.example .env      # bash
```

Pick the template for the backend you want (`.env.testing.example`, `.env.demo.example`, `.env.production.example`) and fill every `VITE_*=<configured-value>`. If you need the registration page, also add `VITE_API_BASE_URL=<configured-value>` (used by live code but missing from the templates). Full reference: [environment-configuration.md](./environment-configuration.md).

Remember: every base URL has a built-in fallback, so a missing value silently targets a built-in (often production) host. Double-check `.env` before testing destructive actions such as deleting workspaces.

---

## 4. Scripts (`package.json`)

| Command | What it does |
|---|---|
| `npm run dev` | `vite` dev server in `development` mode on **port 8081**, host `::` (all interfaces, IPv4 and IPv6) → open `http://localhost:8081/login`. Enables `lovable-tagger` and the dev proxy. |
| `npm run build` | `vite build` (mode `production`) → `dist/`. Env values are baked in. |
| `npm run build:dev` | `vite build --mode development` → `dist/` built with development-mode env files (`.env.development` applied) and the component tagger. |
| `npm run preview` | `vite preview` serves `dist/` locally (port 8081 per the non-dev `server` block). |
| `npm run lint` | `eslint .` with `eslint.config.js` (TypeScript + react-hooks + react-refresh; `no-unused-vars` off). At the time of writing it reports roughly 700 problems, mostly in the large page files; lint is not enforced in any pipeline found in the repo. |

There is no `typecheck` script. TypeScript is non-strict (`strict: false`, `strictNullChecks: false`) and `vite build` does **not** type-check. To type-check manually:

```text
npx tsc --noEmit -p tsconfig.app.json
```

### Testing

No test runner is configured: there is no `test` script, no Jest/Vitest/Playwright/Cypress dependency, and no `*.test.*`/`*.spec.*` files in `src/`. All verification today is manual. If you add tests, Vitest fits the existing Vite setup.

---

## 5. Project structure

```text
full_updated/
├─ index.html                 # #root + /src/main.tsx
├─ vite.config.ts             # port 8081, dev proxy, @ alias, lovable-tagger (dev)
├─ tailwind.config.ts, postcss.config.js, components.json (shadcn)
├─ tsconfig.json / tsconfig.app.json / tsconfig.node.json  (non-strict)
├─ eslint.config.js
├─ .env.example, .env.{production,demo,testing}.example   # templates (committed)
├─ .env, .env.development, .envIsh                         # local / legacy (not committed)
├─ public/                    # static assets: lovable-uploads/ (logo), Subject_Import.xlsx, env.json (unused)
├─ src/
│  ├─ main.tsx                # createRoot(<App/>)
│  ├─ App.tsx                 # providers, router, RequireAuth
│  ├─ index.css               # Tailwind + CSS variables
│  ├─ api.ts                  # live: loginUser, registerUser (+ unused legacy functions)
│  ├─ pages/
│  │  ├─ Login.tsx            # /, /login
│  │  ├─ Register.tsx         # /register (imported as ./pages/register!)
│  │  ├─ SubjectDashboard.tsx # /subject-dashboard (user)
│  │  ├─ OCREvaluation.tsx    # /ocr-evaluation (~17.6k lines – the core workspace)
│  │  ├─ SuperAdminDashboard.tsx  # /superadmin-dashboard (~7.9k lines)
│  │  ├─ StandaloneOCREvaluation.tsx # popup used by OCREvaluation
│  │  ├─ SandboxDashboard.tsx, NotFound.tsx
│  │  └─ AppIframe.tsx        # not routed (dead)
│  ├─ components/
│  │  ├─ ui/                  # shadcn/ui primitives + loader.tsx
│  │  ├─ ocr/                 # script extractor (AI transcription) UI
│  │  ├─ HeaderAccountControls.tsx
│  │  └─ … legacy, unused (SessionTimeout, AppSidebar, ProfileDropdown, …)
│  ├─ hooks/                  # use-toast.ts, use-mobile.tsx
│  ├─ lib/                    # session.ts, extraction.ts, utils.ts (cn)
│  ├─ utils/                  # mdQuestionParser.ts (live); api.ts, Aigapi.ts, config.ts, getTFOptions.ts (dead)
│  ├─ api/                    # three empty .ts files (dead)
│  ├─ api_ish.ts, config.js   # dead
│  └─ assets/                 # sample answer-sheet PNGs
├─ docs/frontend/             # this documentation
├─ scratch/, *.cjs            # one-off Node scripts that rewrite SuperAdminDashboard.tsx / generate trackers – not part of the app
└─ *.zip, *.xlsx              # local backups and trackers (ignored by the Vite watcher)
```

---

## 6. API configuration in code

- Pages build URLs from module-level constants, e.g. `src/pages/OCREvaluation.tsx` → `API_BASE`, `API_BASE1`, `API_ENDPOINTS`; `src/pages/SubjectDashboard.tsx` → `API_ENDPOINTS`; `src/pages/SuperAdminDashboard.tsx` → `API_BASE`, `API_BASE1`, `REPO_BASE`.
- Requests use `axios` or `fetch` directly; there is no shared client, interceptor, or auth header.
- Login and registration go through `src/api.ts`.
- Endpoint catalogue: [`./api/api-integration-mapping.md`](./api/api-integration-mapping.md).

When adding an endpoint, add it to the page's `API_ENDPOINTS` map (or better, a new service module) instead of inlining another URL string.

---

## 7. Debugging tips

| Need | How |
|---|---|
| Find the component behind a DOM node | In `npm run dev`, `lovable-tagger` adds `data-lov-id` / `data-lov-name` and `data-component-path`, `data-component-line`, `data-component-file`, `data-component-name` attributes to JSX elements (attribute names verified in `node_modules/lovable-tagger/dist`). Inspect an element in DevTools and read the attribute to jump to the source. Not present in `npm run build` output. |
| Inspect state | React Developer Tools → Components. Select `OCREvaluation` / `SuperAdminDashboard` to view their many `useState` hooks. |
| Inspect session | DevTools → Application → Session Storage / Local Storage for `http://localhost:8081`. Key meanings: [architecture/state-management.md](./architecture/state-management.md). Deleting `isLogin` forces a redirect to `/login` on the next navigation. |
| See what the backend returned | DevTools → Network, filter `Fetch/XHR`. Status is usually inside the JSON body (`statusCode`/`status` = `S001` success, `F001` failure), not the HTTP code. |
| Switch role quickly | Log out, log in with another test account. (Editing `userRole` in storage only changes client UI; do not rely on it for testing permissions.) |
| Reset the app | Clear Session Storage **and** Local Storage — logout leaves many keys behind (see [authentication-authorization.md §6](./architecture/authentication-authorization.md#6-logout-paths)). |
| Why did I land on the OCR page instead of the Subject Dashboard? | Standalone Mode: check `localStorage.standalone_mode` and the `get-config-info` response in Network. |
| Images do not download in dev | The image repo lacks CORS headers; OCREvaluation retries via the `/ICMEOcrRepo` dev proxy. Make sure you started with `npm run dev` (mode `development`). |

---

## 8. Common setup issues

| Symptom | Cause | Fix |
|---|---|---|
| `Could not resolve "./pages/register"` on Linux/macOS/CI | `App.tsx` imports `./pages/register`; file is `Register.tsx`. | Rename the import to `./pages/Register` (code change – coordinate with the team). |
| `EBUSY` / file-watcher crashes on Windows | Large `.zip`/`.xlsx` files in the project root. | Already mitigated by `server.watch.ignored` in `vite.config.ts`; keep backups out of the project folder. |
| Login shows "Failed to fetch" | CORS or wrong `VITE_AIMARKING_API_BASE`; the backend must allow `http://localhost:8081`. | Check the Network tab and `.env`; restart dev server after edits. |
| Login shows "Network error during login" | `/login` returned a non-2xx HTTP status. | Check backend availability. |
| Registration always fails | `VITE_API_BASE_URL` not set → request goes to `/undefined/aiapps/...`. | Add the variable. |
| Port 8081 already in use | Another dev server. | Stop it or run `npx vite --port <n>` (proxy still applies). |
| Changes to `.env` ignored | Vite reads env only at start / build time. | Restart `npm run dev` or rebuild. |
| Refresh on `/subject-dashboard` 404s on the deployed site | Host lacks SPA fallback to `index.html`. | Configure a rewrite on the web server. |
| Duplicate dependency issues | Installed with Bun and npm. | Delete `node_modules`, use `npm ci`. |

---

## 9. Conventions to follow

- Import with the `@/` alias (`@/components/ui/button`, `@/lib/session`).
- Use `toast` from `sonner` for user messages; `PageLoader` for blocking work.
- Use `getSessionCodes()` (`src/lib/session.ts`) for user/org codes instead of reading storage keys directly.
- Never commit `.env`; add new variables to all four `.env.*.example` files with `<configured-value>` placeholders and document them in [environment-configuration.md](./environment-configuration.md).
