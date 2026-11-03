# Signing In — Evaluator (User) Role

This page describes sign-in from the point of view of an evaluator (any role other than `superadmin` or `admin`). The full technical flow, including every error branch, is in [../workflows/login-workflow.md](../workflows/login-workflow.md).

## 1. Sign in

1. Open the application URL. You are taken to the **Login** page (`/login`).
2. Enter your **Username or Email** and **Password**. The **Sign In** button is enabled only when both fields contain text. Leading and trailing spaces are removed before sending.
3. Click **Sign In** (or press Enter). "Signing in, please wait..." appears while the request runs.

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-login-form.png — Login page with username and password filled in, Sign In enabled]

## 2. Where you land

Your organisation's configuration decides the first screen. The app reads it from `get-config-info` right after sign-in (`src/pages/Login.tsx` → `fetchStandaloneMode`).

| Organisation setting | First screen | What you see |
|---|---|---|
| Standalone Mode **off** (default) | **Subject Dashboard** (`/subject-dashboard`) | Year selector, cycle cards, then subject cards. Selecting a subject opens the OCR Evaluation workspace on the same page, with a "Back to subjects" control. |
| Standalone Mode **on** | **OCR Evaluation** (`/ocr-evaluation`) directly | The workspace with no subject-picker step and no "Back to subjects" control. |

If the configuration cannot be read, the app uses the last value cached in this browser (`localStorage.standalone_mode`). On a browser that has never cached it, that means Subject Dashboard.

The header on both screens shows a purple **tokens** button (tokens used) and a teal **avatar** with your initial. Opening the avatar shows your name, e-mail (when the login record includes one) and **Logout** (`src/components/HeaderAccountControls.tsx`).

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/user-landing-subject-dashboard.png — Subject Dashboard right after an evaluator signs in]

Working on subjects and scripts: see the other guides in this folder (`../user/`).

## 3. Messages you may see

| Message | Meaning | What to do |
|---|---|---|
| "Invalid username or password" (or a server message) | Credentials rejected. | Re-enter; contact your administrator if it continues. |
| "Network error during login" / "Failed to fetch" | The server could not be reached or returned an error. | Check your connection; retry later; report to support. |
| **Access Denied** — "Your account is still yet to active…" | Your account's start date has not arrived. | Click **OK**; contact your administrator. |
| **Access Denied** — "Your account has expired or is inactive…" | Your account's end date has passed or it was deactivated. | Click **OK**; contact your administrator. |
| "Access denied." (red text) | Your account belongs to a customer other than ICME. | Contact your administrator. |

## 4. Signing out and sessions

- Use the avatar menu → **Logout**. You return to the Login page.
- Closing the browser tab also ends your session. A new tab requires signing in again.
- There is currently **no automatic sign-out after inactivity**. Sign out yourself on shared computers.
