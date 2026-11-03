# Support Guide — Triage for the AI Marking Frontend

This guide is for L1/L2 support and on-call developers. It explains how to work out, in a few minutes, whether a reported problem is in the **frontend**, the **backend API**, the **database/data**, **authentication**, **configuration** or the **network** — using signals specific to this app.

Companion documents:

- [Troubleshooting](./troubleshooting.md) — issue-by-issue playbooks.
- [Common issues](./common-issues.md) — one-line FAQ.
- [API failure handling](./api-failure-handling.md) — what each failing action looks like.
- [Known issues](../known-issues.md) — confirmed bugs (check here first; many "incidents" are known behaviour).
- Developer-level detail: [API integration mapping](../api/api-integration-mapping.md), [API error handling](../api/api-error-handling.md), [State management](../architecture/state-management.md).

---

## 1. Facts about this app that change how you triage

| Fact | Why it matters | Source |
|---|---|---|
| The browser calls the backends **directly**; there is no frontend server or BFF. | Every data problem is visible in the browser's Network tab. | All pages call `axios`/`fetch` inline. |
| **No auth token** is sent on any API call, and there is **no 401/403 handling**. | "Session expired" never happens in the UI. An auth problem shows as wrong data, an empty list or an API error body, not a redirect to login. | grep: no `Authorization` header in live code. |
| Login state is just `sessionStorage.isLogin === 'true'`. | Closing the tab logs the user out; a second tab is not signed in. Session never times out. | `src/App.tsx` → `RequireAuth`; `SessionTimeout` is never mounted. |
| API base URLs are **baked in at build time** from `VITE_*` variables, and every one has a hard-coded fallback host. | A wrong or missing `.env` at build time silently points the app at a different environment. Changing `.env` on a server after the build has no effect. | `import.meta.env.VITE_*` with `\|\|` fallbacks in each page. |
| Many responses use an **envelope status**: `S001` success, `S002` updated/success, `F001` failure (also `FL001`, `O001`, `LO001`, `EM001` on signup). | An HTTP **200 can still be a failure**. Always read the response body. | `src/api.ts` → `loginUser`, `registerUser`; OCREvaluation handlers. |
| Several handlers treat **any HTTP 2xx as success** (Config save, delete candidate, toggle subject status, score save). | A green toast does not prove the backend saved anything. | See [known issues](../known-issues.md). |
| The **Home page shows mock data** when the backend fails or returns nothing (`USE_MOCK_DATA_WHILE_BACKEND_IN_DEV = true`). | A backend outage looks like "wrong years / cycles / subjects", not an error. | `src/pages/SubjectDashboard.tsx` (~L36). |
| Organisation config is cached in **localStorage** (`standalone_mode`, `workflowStages`, `org_*`). | Stale browser cache can make the UI behave like an old configuration. | [State management §2.4](../architecture/state-management.md). |
| Identity keys are stored in **two casings** (`orgCode`/`orgcode`, `userCode`/`usercode`, `subjectCode`/`subjectcode`, …) and readers fall back to hard-coded codes (`ICME01`, `ICMELIVE`, `ICME1`). | A missing key silently sends a default org/user code. | `src/lib/session.ts` → `getSessionCodes`; page call sites. |

---

## 2. Which environment variable controls which host

When a request goes to the wrong place, identify the variable from the URL path, then check the value the build used.

| Path seen in Network tab | Variable | Typical calls |
|---|---|---|
| `…/login`, `…/get-config-info`, `…/save-config-info`, `…/get-year-data`, `…/get-cycle-data`, `…/get-subject-data`, `…/list-workspace`, `…/candidate-process-data`, `…/get-all-data-exports`, `…/student-export`, `…/organization-details`, `…/get-user-details`, `…/create-user`, `…/delete-candidate`, `…/delete-workspace` | `VITE_AIMARKING_API_BASE` | Login, config, home lists, workspaces, candidates, admin |
| `…/run-ocr`, `…/ocr-image`, `…/evaluate-text`, `…/update-status`, uploads and save-stage endpoints, `…/convert-markscheme-to-md`, `…/upload-marking-scheme` | `VITE_ICMEPRODUCT_API_BASE` | Processing, OCR, evaluation, marking schemes |
| Page images (`<img src>`), marking-scheme files | `VITE_REPO_BASE` | Script pages, scheme viewer |
| `…/AITranscription/extract`, `…/AIProductApi/send-email`, `…/AIProductApi/updateActiveRegisteredUser` | `VITE_AIAPPS_API_BASE` | Re-extraction, registration |
| `…/aiapps/AIProductApi/signup` prefixed by `undefined` | `VITE_API_BASE_URL` (**in no env template, no fallback**) | Registration |
| Links in the registration e-mail / EULA / Help | `VITE_AIAPPS_WEB_BASE`, `VITE_AI_EXCELSOFT_BASE` | Register page |

Never paste real hostnames into tickets shared outside the team; quote the variable name and path.

---

## 3. The triage decision flow

```text
User reports a problem
        │
        ▼
1. Reproduce. Note: route (URL), role (Super Admin / Admin / User),
   organisation, Year/Cycle/Subject/Workspace, exact time.
        │
        ▼
2. Is it a known issue?  ── yes ──▶ link the known-issues entry; stop.
        │ no
        ▼
3. Open DevTools ▸ Console.
   ├─ Red JS error / "Cannot read properties of undefined" / white page
   │        ──▶ FRONTEND (rendering bug or unexpected response shape)
   └─ No error ─▶ continue
        │
        ▼
4. DevTools ▸ Network (preserve log, disable cache). Repeat the action.
   ├─ No request fired at all
   │        ──▶ FRONTEND (guard / disabled condition / missing session key)
   │            see troubleshooting "API not called"
   ├─ Request fired ─▶ identify the API from the path (table in §2)
        │
        ▼
5. Inspect the REQUEST.
   ├─ Host wrong / "undefined/…" in URL ──▶ CONFIGURATION (build-time env)
   ├─ Params wrong (OrgCode=ICME01/ICMELIVE default, empty subject,
   │   wrong YearCode/CycleCode)        ──▶ FRONTEND STATE / SESSION
   │                                         (missing or stale storage key)
   └─ Looks right ─▶ continue
        │
        ▼
6. Inspect the RESPONSE + STATUS CODE.
   ├─ (failed) / CORS error / net::ERR_*   ──▶ NETWORK or server CORS config
   ├─ 5xx                                   ──▶ BACKEND (collect request, time)
   ├─ 4xx                                   ──▶ BACKEND validation / contract
   │                                            (frontend sent bad params?)
   ├─ 200 with F001 / error message         ──▶ BACKEND business rule or
   │                                            AUTH (wrong credentials, inactive)
   ├─ 200 with empty array / null           ──▶ DATABASE / DATA (nothing
   │                                            configured for that org/year)
   └─ 200 with correct data, UI still wrong ──▶ FRONTEND binding / mapping
        │
        ▼
7. Escalate with: route, role, org, the full request URL + payload,
   response body, status, timestamp → backend team checks server logs
   for that timestamp and parameters.
```

---

## 4. Telling the layers apart — concrete signals

### 4.1 Frontend

- Console shows a React error or `TypeError`, or the page is white with no request in flight.
- No request fires when the button is clicked (button hidden/disabled by role or stage config, missing `workspaceid`, missing subject code).
- The response body is correct but the table/badge shows something else (mapping bug — e.g. status 3 rows show "Approved" but are excluded by the "Approved" filter; see known issues).
- A route renders nothing: `/standalone-ocr` (dialog closed), `/sandbox` (bounces to login), `/dashboard` (404).

### 4.2 Backend

- 5xx, or 4xx on a request whose parameters look valid.
- 200 with an envelope failure (`F001`) and a server message.
- Slow responses: candidate table polling (`CANDIDATE_POLL_INTERVAL_MS = 30_000`) keeps showing "In Progress" — the stage is still running server-side; check backend job logs.

### 4.3 Database / data

- 200 with `[]` or `data: []` for a valid org/year/cycle — nothing configured. Typical: no years/cycles defined, no subjects mapped to the cycle, no users for the org, no config saved (`get-config-info` returns `[]`, which also means Standalone Mode is unknown and the cached value is used).
- **Watch out:** on the Home page an empty answer is replaced with **mock** years/cycles/subjects. If you see placeholder subjects, check `get-year-data` / `get-cycle-data` / `get-subject-data` in the Network tab — a `[]` there means data is missing, not that the UI is wrong.

### 4.4 Authentication / authorisation

- Login: `POST …/login` returns `F001` → wrong credentials. Returns `S001` but the user sees a modal about not-yet-active or expired → the `active` flag is `0` or `2` (`src/lib/session.ts` → `getAccountAccess`).
- "Access denied." under the form → login succeeded but `customerCode` is not `ICME` (`src/pages/Login.tsx` → `handleSubmit`). Note that `isLogin='true'` has already been written at that point.
- Wrong dashboard → driven by `userRole` (`superadmin`/`admin` → admin dashboard) and Standalone Mode. See troubleshooting.
- Because there is no token, the backend cannot reject a request for lack of auth; if the backend starts enforcing auth, **every** call will fail and the UI will just show errors/empty states.

### 4.5 Configuration

- Request host is unexpected, or contains `undefined` → build used the wrong / missing `.env`. Vite bakes `VITE_*` at build time; rebuild after changing `.env`.
- Stage/standalone behaviour does not match what the admin saved → check `get-config-info` response first, then the browser's `localStorage` (`standalone_mode`, `workflowStages`, `org_selected_stages_<org>`, `org_standalone_<org>`).
- Config Settings shows "saved" but nothing changed server-side → `save-config-info` treats any 2xx as success and always mirrors values into localStorage, so **this browser** looks updated even if the server rejected it. Verify with `get-config-info` from another browser.

### 4.6 Network

- Requests show `(failed)`, `net::ERR_NAME_NOT_RESOLVED`, `ERR_CONNECTION_*`, or a CORS error in the console.
- Images display but **Download** fails with a CORS/`HTTP` error: the image repository does not send CORS headers; `<img>` works, `fetch()` does not. In development the dev server proxies `/ICMEOcrRepo`; in a production build there is no proxy (`src/pages/OCREvaluation.tsx` → `fetchImageBlob`, `vite.config.ts`).

---

## 5. Browser-state checks support can do on a call

Open DevTools ▸ Application:

| Check | Where | What good looks like |
|---|---|---|
| Signed in | Session Storage → `isLogin` | `true` |
| Role | Session Storage → `userRole` | `superadmin`, `admin` or `user` (lower/upper case accepted). Missing role ⇒ the Admin dashboard treats the user as Super Admin. |
| Org / user codes | `orgCode` **and** `orgcode`, `userCode` **and** `usercode` | Same value in both casings. |
| Current context | `yearcode`/`yearCode`, `cyclecode`/`cycleCode`, `subjectcode`/`subjectCode`, `workspaceid` | Match what the user selected. |
| Org config cache | Local Storage → `standalone_mode`, `workflowStages`, `org_*` | Match the latest `get-config-info` response. |

Safe reset for a confused browser: log out, then clear Local Storage and Session Storage for the site, and log in again. (Logout alone does **not** clear localStorage or the per-workspace review drafts `icme_ocr.*`.)

---

## 6. What to collect before escalating

1. Route, role, organisation code, Year / Cycle / Subject / Workspace, candidate registration number.
2. Exact UI message (toast text) and time.
3. Network tab: full request URL, method, payload, HTTP status, response body (export as HAR if possible).
4. Console errors.
5. Build/environment the user is on (which deployment) — the frontend cannot report which `.env` it was built with, so ask the deploy owner.
