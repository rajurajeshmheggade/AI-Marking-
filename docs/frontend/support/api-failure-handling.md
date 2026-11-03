# API Failure Handling — Support View

For each major user action: what a failure looks like **in the UI**, what to look for **in the Network tab**, and what it most likely means. Toast texts are quoted exactly as they appear in the source so you can search for them.

Developer-level table (every endpoint, every catch block): [API error handling](../api/api-error-handling.md). Triage method: [Support guide](./support-guide.md).

Legend for "Means": **FE** frontend, **BE** backend, **DATA** missing/incorrect data, **AUTH** account/role, **CFG** configuration (env or org config), **NET** network/CORS.

> **Important:** in several places the UI shows a success toast even when the request failed, or shows sample data instead of an error. Those rows are marked ⚠.

---

## 1. Sign-in and session

| Action | UI on failure | Network tab | Means |
|---|---|---|---|
| Sign in | Red text under the form: the server message or "Invalid username or password" | `POST …/login` 200 with `statusCode`/`status` = `F001` | AUTH — wrong credentials |
| Sign in | "Network error during login" | `POST …/login` non-2xx, `(failed)` or CORS error | BE / NET / CFG (`VITE_AIMARKING_API_BASE`) |
| Sign in | Modal: "Your account is still yet to active…" or "…has expired or is inactive…" | `login` 200 `S001`, `userData[0].active` = `0` or `2` | AUTH — account validity window (set in User Management) |
| Sign in | "Access denied." under the form | `login` 200 `S001`, `customercode` ≠ `ICME` | AUTH / DATA — user belongs to another customer |
| Sign in | Lands on the wrong home page, no error | `get-config-info` failed or returned `[]` → cached `localStorage.standalone_mode` used | CFG / DATA — org config missing |
| Register | "Organization name is required" (no field to fill) | none — request never sent | FE — known bug, form cannot submit |
| Register | Request to `undefined/aiapps/AIProductApi/signup` | `(failed)` | CFG — `VITE_API_BASE_URL` not defined at build time |

There is no "session expired" failure: the frontend sends no token and never handles 401/403.

---

## 2. Evaluator home (SubjectDashboard)

| Action | UI on failure | Network tab | Means |
|---|---|---|---|
| Load years / cycles / subjects | ⚠ **No error.** Sample years/cycles/subjects appear (mock data), console warns "…showing mock … data until the backend is live" | `get-year-data` / `get-cycle-data` / `get-subject-data` failed **or** returned an empty list | BE (if failed) or DATA (if empty) |
| Token count | Shows 0, no message | `list-workspace` failed | BE |
| Student Export button missing | No message | `get-config-info` failed, or not all four stages enabled | CFG / BE |
| Student Export | "No data found for this register number." | `student-export` 200 without `candidateData` | DATA — wrong number or not evaluated |
| Student Export | "An error occurred during export." | `student-export` non-2xx / failed | BE / NET |

---

## 3. Workspaces and candidates (OCREvaluation)

| Action | UI on failure | Network tab | Means |
|---|---|---|---|
| Load workspace list | "Failed to load workspaces" | `list-workspace` failed | BE |
| Open workspace | ⚠ "Failed to load candidate data, showing sample data instead" **and fake rows appear** | `candidate-process-data` non-2xx / failed | BE — do not trust the rows shown |
| Polling refresh | Nothing (silent) — table just stops changing | repeated `candidate-process-data` every 30 s, failing | BE |
| Create workspace | Message inside the dialog: "Workspace name already exists. Please provide another name." | `create-workspace` 200 with `sp_status`/`status` = `F001` | DATA — pick another name |
| Create workspace | "Failed to create workspace. Please try again." | `create-workspace` failed | BE |
| Upload | "Upload failed. Please try again." / "Failed to upload files. Please try again." / `Upload returned status …` / Upload Error popup | `upload-pdfs` / `upload-pngs` / `ocr-image` / `evaluate-text` failed | BE / NET (file size, timeouts) |
| Create candidates | server message or "Failed to create candidates. Please try again." | `save-candidate-info` failed | BE |
| Standalone Create & Extract | ⚠ May continue after a failed `create-workspace` body or `save-candidate-info` (status not checked) | check both responses' bodies | BE |
| AI extraction (standalone create) | server `detail` or "Extraction request failed." | `POST {VITE_AIAPPS_API_BASE}/AITranscription/extract` non-2xx | BE / CFG |
| Delete candidates | "Failed to delete candidates" | `delete-candidate` non-2xx | BE |
| Delete candidates | ⚠ "Successfully deleted" but rows reappear on next poll | `delete-candidate` 200 with a failure body | BE — any HTTP 200 is treated as success |
| Delete workspace | `Cannot delete workspace "…" — it has candidates.` | — (frontend check) | DATA — expected rule |
| Rerun OCR / evaluation | `Failed to trigger OCR for …` / `Failed to trigger evaluation for …` | `run-ocr` / `run-evaluation` failed | BE |
| Run evaluation | Run request never sent | type-2 `get-process-data` failed first | BE |

---

## 4. Review and approval

| Action | UI on failure | Network tab | Means |
|---|---|---|---|
| Open a review dialog | "Failed to load segmentation data" / "No segmentation data available" / "Failed to load candidate information" | `get-process-data` / `get-candidate-info` failed or empty | BE / DATA |
| Open OCR review (normal) | ⚠ When OCR text is missing the dialog can show **bundled sample page images** | `get-process-data` returned no `ocr_extracted_text` | DATA |
| Open standalone OCR popup | server message or "Failed to fetch process data for standalone OCR" | `get-process-data?type=2` failed / no processData | BE / DATA |
| Approve Segmentation/Indexing | "Failed to approve. Please try again." | save-indexing request failed | BE |
| Approve Segmentation/Indexing | ⚠ Success toast and row "Approved", but backend not updated | OCR sync, `recalculate-standards` or `update-status` (type 1) failed — **only a console warning** | BE — check `update-status` response |
| Approve OCR | "OCR saved, but recalculation failed. Please try again." **followed by** "OCR approved and saved for …"; row shows Approved locally | `recalculate-standards` failed; `update-status` (type 2) **not sent** | BE — status not persisted; reopen after refresh |
| Approve OCR | "Recalculation succeeded but updating status failed. Please try again." then success toast | `update-status` failed | BE |
| Approve OCR | "Failed to save OCR data. Please try again." / `Failed to save OCR data (status …)` | OCR save request failed | BE |
| Approve without editing | "No changes made. Please update the page mapping before approving." / "OCR data has not been edited…" | none | FE — observed rule: approval requires an edit |
| Save evaluation score | ⚠ "Failed to save evaluation score to server. Please try again." **followed by** "Evaluation score updated to N"; edits cleared | score save request failed | BE — score not saved, re-enter it |
| Re-evaluation | "Failed to submit re-evaluation request. Please try again." / `Failed to submit re-evaluation (status …)` | re-evaluation request failed | BE |

---

## 5. Export

| Action | UI on failure | Network tab | Means |
|---|---|---|---|
| Download | "No data available to export" | `get-all-data-exports` 200 with empty `data` (first page) | DATA — nothing processed yet |
| Download | ⚠ "No evaluation data available to export" | **any** error during the loop or workbook build (5xx, network, parse) | BE / NET / FE — check status codes |
| Download images | "Failed to download image(s)" | image GET blocked by CORS or non-2xx | NET / CFG (`VITE_REPO_BASE`) |

---

## 6. Administration (SuperAdminDashboard)

| Action | UI on failure | Network tab | Means |
|---|---|---|---|
| Load years / cycles (shell header selector) | Empty selectors, no toast | `get-year-data` / `get-cycle-data` failed (console only) | BE / DATA |
| Load years / cycles (Subject & Question import dialog) | "Failed to load years" / "Failed to load cycles" | same endpoints | BE |
| Load organisations | "Failed to load organizations" (sections) / nothing (shell) | `organization-details` failed | BE |
| Load subjects | "Failed to load subjects" / "No Year/Cycle available to load subjects." | `get-subject-data` failed / Year or Cycle empty | BE / DATA |
| Load settings | Form keeps previous values; falls back to localStorage | `get-config-info` failed or `[]` | BE / DATA |
| Save settings | `Failed to save configuration: <status>` / "Error connecting to the API to save settings" | `save-config-info` non-2xx / failed | BE / NET |
| Save settings | ⚠ Success toast even when the body reports failure (any 2xx) — and values are mirrored into this browser's localStorage regardless | `save-config-info` 200 with error body | BE — verify by reloading in another browser |
| Import subjects | `Failed to import: …`, column / duplicate / sheet validation toasts | `import-subject-data-v2` failed, or file rejected before sending | DATA (file) / BE |
| Delete subjects | "Deletion failed. Please try again." — remaining subjects in the batch are **not** attempted | one `delete-subject` failed | BE |
| Toggle subject status | "Failed to update subject status" / "Cannot mark inactive. Subject has active workspaces." | `update-subject-data` | BE / DATA |
| Marks schema conversion | server message or "Failed to process PDF. Please try uploading .md directly." / "API returned empty markdown…" | `convert-markscheme-to-md` | BE / CFG |
| Marks schema upload | server message or "Upload failed. Please try again." | `upload-marking-scheme` | BE |
| Marks schema questions | ⚠ "Marking schema uploaded, but questions could not be saved: …" **followed by** a success toast | `save-questions` failed | BE |
| Create / edit user | server message or "Failed to save user" / "Failed to update user." / "Login name already exists!…" | `create-user` | BE / DATA |
| Delete user | server message or "Failed to delete user" | `delete-user` | BE |
