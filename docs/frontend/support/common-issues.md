# Common Issues — Quick Answers

The most frequent symptoms, with a one-line answer and a link to the full playbook in [Troubleshooting](./troubleshooting.md). Confirmed bugs are tracked in [Known issues](../known-issues.md).

## Sign-in and navigation

| Symptom | Short answer | More |
|---|---|---|
| "Invalid username or password" | The login API returned `F001`; check credentials in User Management. | [§1](./troubleshooting.md#1-login-failure) |
| "Network error during login" | The login API was unreachable or returned non-2xx; check backend / `VITE_AIMARKING_API_BASE`. | [§1](./troubleshooting.md#1-login-failure) |
| Modal "account is still yet to active" / "expired or is inactive" | The user's active-date window excludes today; fix From/To dates. | [§1](./troubleshooting.md#1-login-failure) |
| "Access denied." | The user's customer code is not `ICME`. | [§2](./troubleshooting.md#2-access-denied) |
| Evaluator lands on the admin page (or the reverse) | Role or Standalone Mode from config/cache; clear Local Storage and re-login. | [§3](./troubleshooting.md#3-landing-on-the-wrong-dashboard) |
| Opening a new tab asks for login | Sign-in is stored per tab (`sessionStorage`). Expected. | [§12](./troubleshooting.md#12-session-and-auth-issues) |
| Never logged out after being idle | There is no idle timeout. Expected (known issue). | [§12](./troubleshooting.md#12-session-and-auth-issues) |
| Blank page at `/standalone-ocr` | That route has no data; use `/ocr-evaluation`. | [§11](./troubleshooting.md#11-navigation-failure--blank-page) |
| `/sandbox` bounces to login | The sandbox guard key is never set; the page is unreachable. | [§11](./troubleshooting.md#11-navigation-failure--blank-page) |
| "Not Found" right after registering | Registration navigates to `/dashboard`, which doesn't exist; go to `/login`. | [§11](./troubleshooting.md#11-navigation-failure--blank-page) |
| Registration form never submits | It requires an Organization name that has no input field (known bug). | [Known issues](../known-issues.md) |

## Home page and lists

| Symptom | Short answer | More |
|---|---|---|
| Years / cycles / subjects look like samples | The backend failed or returned nothing, so mock data is shown. Check the three list calls. | [§6](./troubleshooting.md#6-ui-not-showing-api-data) |
| Admin Year dropdown has no options | `get-year-data` failed or is empty (only logged to console). | [§7](./troubleshooting.md#7-dropdown-empty-years--cycles--subjects--organisations) |
| Admin cannot pick their organisation | The org selector is hidden for Admins and the first org is used (known issue). | [§14](./troubleshooting.md#14-incorrect-data-binding) |
| "No Year/Cycle available to load subjects." flashes after changing Year | The cycle is blank while cycles reload; the table refills afterwards. | [§8](./troubleshooting.md#8-table-empty) |
| Student Export button missing | Shown only when all four stages are enabled and subjects are listed. | [§9](./troubleshooting.md#9-button-not-visible) |

## Workspaces, candidates and review

| Symptom | Short answer | More |
|---|---|---|
| "Failed to load candidate data, showing sample data instead" | The candidate API failed; the rows shown are fake. | [§6](./troubleshooting.md#6-ui-not-showing-api-data) |
| Table doesn't refresh | Polling runs every 30 s, pauses while a dialog is open, and skips while a loader is active. | [§4](./troubleshooting.md#4-api-not-called) |
| "Approved" filter misses rows that show Approved | Status 3 is displayed as Approved but filtered as "pending" (known issue). | [§13](./troubleshooting.md#13-incorrect-status-badge) |
| Create Workspace / Delete missing | Hidden for the `superadmin` role. | [§9](./troubleshooting.md#9-button-not-visible) |
| No Rerun button | Rerun shows only for raw status 4 without the no-question marker. | [§9](./troubleshooting.md#9-button-not-visible) |
| Download greyed out | A selected candidate is incomplete or from another workspace; clear the selection. | [§10](./troubleshooting.md#10-button-disabled) |
| "No changes made…" / "OCR data has not been edited…" on Approve | Approve requires an edit in this build. | [API failure handling §4](./api-failure-handling.md#4-review-and-approval) |
| Error toast then success toast on Approve / Save score | The save partly failed but the UI still marked success; re-check after the next poll. | [API failure handling §4](./api-failure-handling.md#4-review-and-approval) |
| Standalone OCR popup has no Extract button | The button is hidden in this build (known issue); the popup is view-only. | [Known issues](../known-issues.md) |
| Images broken | Wrong `VITE_REPO_BASE` or path encoding. | [§18](./troubleshooting.md#18-images-not-loading) |
| Images show but Download fails | The image repository sends no CORS headers. | [§18](./troubleshooting.md#18-images-not-loading) |

## Export

| Symptom | Short answer | More |
|---|---|---|
| "No data available to export" | Nothing processed or matched the selection. | [§17](./troubleshooting.md#17-excel-export-missing-sheets-or-columns) |
| "No evaluation data available to export" | Any error during Download, including a backend failure; check the Network tab. | [API failure handling §5](./api-failure-handling.md#5-export) |
| Workbook missing a sheet or the OCR column | Sheets and the OCR column are only included when they have data. | [§17](./troubleshooting.md#17-excel-export-missing-sheets-or-columns) |

## Admin configuration

| Symptom | Short answer | More |
|---|---|---|
| Config "saved" but evaluators see the old behaviour | The save may not have persisted (any 2xx = success), or the evaluator's cache is stale. | [§16](./troubleshooting.md#16-standalone-mode-settings-not-taking-effect) |
| Settings show values from the previously selected org | Missing config sections keep old values; reload the page. | [§6](./troubleshooting.md#6-ui-not-showing-api-data) |
| Edited user can no longer log in | Likely cause: the edit form pre-fills the stored password hash and sends it back as the password (known issue; whether the backend re-hashes it needs backend confirmation). | [Known issues](../known-issues.md) |
| App calls the wrong server | `.env` is baked in at build time; rebuild with the right file. | [§15](./troubleshooting.md#15-environment-configuration-issue) |
