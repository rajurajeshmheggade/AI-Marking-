# Register Page — `src/pages/Register.tsx`

| | |
|---|---|
| Route | `/register` (public). Declared in `src/App.tsx` as `import Register from "./pages/register"` — lower-case path; breaks on case-sensitive file systems (see [../architecture/routing.md §4](../architecture/routing.md#4-case-sensitivity-build-risk)). |
| Entry points | Typed URL only. The "Sign up" link on the Login page is rendered with `className="hidden …"`. |
| Component | `Register` (default export) |
| APIs | `registerUser` (`src/api.ts`), inline `axios.post` for send-email and activation, `loginUser` (`src/api.ts`) |
| Shared UI | `Button`, `Input`, `Label`, `Card`, `Checkbox`, `Dialog` from `@/components/ui/*`; native `<select>` for Customer/Organization |

Relation to the product: the page, its e-mail template ("Registered to AI-Levate") and its APIs (`AIProductApi`) come from the AI-Levate apps platform. ICME users are normally created by Super Admin/Admin in Role/User Management (see [`../admin/`](../admin/)).

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/register-page.png — Register page with the Create Account card and field validation colours]

---

## 1. Fields and validation

State: `formData`, `fieldValidation` (live green/red state), `errors` (messages), `selectedCustomer`, `selectedOrg`.

| Field (placeholder) | Input sanitising (`handleInputChange`) | Live validity (`fieldValidation`) | Submit rule (`handleSubmit`) → message |
|---|---|---|---|
| First Name * | letters and spaces only, max 60 | `/^[A-Za-z\s]+$/`, ≤ 60 | required → "First name is required"; > 60 → "First name must be at most 60 characters"; non-letters → "Only letters allowed" |
| Last Name | letters and spaces only, max 60 | same | > 60 → "Last name must be at most 60 characters" (optional) |
| Email Address * | none | regex: local part 1–64 chars, domain labels, TLD 2–63 letters | only if non-empty and invalid → "Enter a valid email address (local ≤60 chars, TLD ≤5 chars)". **Not actually required** despite the `*`, and the message's limits do not match the regex. |
| Username * | alphanumeric only, max 20 | alnum, 4–20 | required → "Username is required"; < 4 → "Username must be at least 4 characters"; non-alnum → "Username must be alphanumeric" |
| Password * | max 60 (`maxLength=60`) | `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,60}$` | required → "Password is required"; > 60; weak → "Password must include upper, lower, number, and special character". Shows "Strong password" when valid. |
| Confirm Password * | max 60 | equals password and strong | required → "Confirm your password"; mismatch → "Passwords do not match" |
| Contact Number | digits only, one leading `+` allowed, max 13 digits (`maxLength=14`) | `^\+?\d{10,13}$` | if non-empty must match `^\+?\d{10,12}$` → "Contact number must be 10–12 digits (optional leading +)". Live check allows 13 digits, submit allows only 12. |
| Activation From | `type` switches text→date on focus; `min` = today | non-empty | required → "Activation from date is required"; From > To → "From date cannot be after To date" |
| Activation To | `min` = From or today | non-empty | required → "Activation to date is required" |
| Select Customer * (`<select>`) | options from local constant `CUSTOMERS` = `[ICME]` | — | required → "Customer is required" |
| Select Organization * (`<select>`) | options from `ORGANIZATIONS[selectedCustomer]` = `[ICME]`; reset when customer changes | — | required → "Organization is required" |
| Organization name (`formData.organizationName`) | max 60 | non-empty | required → "Organization name is required". **There is no input for this field in the JSX**, so it is always empty and this error is always added to `errors.organizationName` — which is also never rendered. Result: **the form can never pass client validation.** |
| EULA checkbox | — | — | unchecked → `errors.general` "Accept the terms to continue". Link: `{VITE_AI_EXCELSOFT_BASE}/aiapps/EULA/AIEULA.html`. |

> Because of the missing Organization-name input, `handleSubmit` always returns at `if (hasErrors)`. Everything from §2 onward describes code that is currently unreachable from the UI. Verified by searching the JSX for `organizationName` (only appears in state, sanitiser and validation). The Customer/Organization dropdown values are also **not included** in the request payload.

---

## 2. Registration request

`registerUser(payload)` in `src/api.ts`:

| | |
|---|---|
| Method / URL | `POST {VITE_API_BASE_URL}/aiapps/AIProductApi/signup` via `axios` |
| Env note | `VITE_API_BASE_URL` has **no fallback** and is not in any `.env.*.example` → URL becomes `undefined/aiapps/AIProductApi/signup` (relative). See [../environment-configuration.md](../environment-configuration.md#32-variables-used-in-code-but-missing-from-every-example-file). |
| Body | `firstname`, `lastname`, `email`, `contactnumber`, `activationDateFrom`, `activationDateTo`, `orgname` (= `organizationName`), `username`, `password`, `createdBy: ""`, `userID: 0` |
| Response `status` | `S001` → returns `{status, message: "Registration successful", data}`; `FL001` → throws "User already exists"; `O001` → "Organization already exists"; `LO001` → "Username already exists"; `EM001` → "Email already exists"; other → throws `result.message` or "Registration failed". HTTP errors → throws `error.response.data.message` or "Registration failed". |

Because `registerUser` throws for every non-`S001` status, the `response.status === 'FL001'…` branches in `Register.handleSubmit` are unreachable; errors arrive in the `catch` and are shown from `error.message` in the red `errors.general` banner.

---

## 3. Post-registration e-mail and activation (`sendRegistrationEmail`)

Runs only when `registerUser` returns `S001`.

1. Writes `sessionStorage.tempUserEmail` and `tempUserName` (never read anywhere).
2. Builds an activation link: JSON `{username, email}` is AES-encrypted with **CryptoJS using the hard-coded passphrase `'Excelsoft'`**, URL-encoded, and appended as `?data=` to `{VITE_AIAPPS_WEB_BASE}/#/login`. The link targets the AI-Levate apps portal (hash routing), not this application.
3. Sends `POST {VITE_AIAPPS_API_BASE}/AIProductApi/send-email` with `{ to, subject: 'Registration Successful - AI-Levate', body: <HTML> }`. The HTML greets the user by username, shows a hosted banner image, a **Login** button with the link, and an Excelsoft signature.
4. If `response.data.status === 'success'`:
   - Opens the result dialog: "Save Successful!" / "Registration successful. A secure login link has been sent to your email to validate your logins."
   - `POST {VITE_AIAPPS_API_BASE}/AIProductApi/updateActiveRegisteredUser` with `{username, email}` — i.e. the account is activated immediately, before the user clicks the e-mailed link.
   - `loginUser(username, password)`; only if the response uses the **old** shape (`status === 'S001'` and `data[]`) it writes `userInfo`, `isLogin`, `username`, `password`, `userCode`, `orgCode`, `customerCode`, `userRole` to sessionStorage and calls `navigate('/dashboard')` — a route that does not exist (renders NotFound). With the current API shape (`statusCode`/`userData`) this block is skipped. All errors here are swallowed.
5. Otherwise, or on exception: opens the dialog in error mode. Defect: the code calls `setSaveAllDialogType(<message>)` instead of `setSaveAllDialogMessage(...)`, so the dialog shows "Save Failed" with no description (and in the exception path the type is the message text, so the red/green styling falls to the red branch).
6. After the promise settles: `navigate("/register")`.

Dialog **OK** → `setShowSaveAllDialog(false)` and `navigate('/')`.

---

## 4. Navigation

| Control | Target |
|---|---|
| "Already have an account? Sign in" | `/` (Login) |
| Dialog OK | `/` |
| After e-mail flow | `/register`; possibly `/dashboard` (404) first |
| Footer "Help" | `{VITE_AIAPPS_API_BASE}/AIHelp/index.html` |
| Footer "Privacy and Cookie Policy" | Excelsoft privacy page (external) |

---

## 5. Security and quality observations (not fixed)

| # | Observation |
|---|---|
| 1 | Hard-coded AES passphrase `'Excelsoft'` in client code. Anyone can decrypt or forge the `data` parameter; it provides obfuscation, not security. Any security decision based on it must be made server-side. |
| 2 | Password stored in plain text in `sessionStorage` after auto-login (old-shape path). |
| 3 | Account activated (`updateActiveRegisteredUser`) from the browser right after sending the e-mail, defeating e-mail verification. |
| 4 | Form cannot be submitted (missing Organization-name input). |
| 5 | Customer/Organization dropdowns are required but their values are not sent. |
| 6 | E-mail marked `*` but optional; validation messages disagree with the actual regexes (e-mail limits, contact 12 vs 13 digits). |
| 7 | `import { set } from "date-fns"` is unused. |
