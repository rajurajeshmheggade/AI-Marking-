# Admin Setup Workflow (Quick Reference)

This page is a checklist. The full narrative, with the starting point, action, API, UI state, completion and
errors for each step, is in [../workflows/admin-workflow.md](../workflows/admin-workflow.md).

```text
Year/Cycle ─▶ Config Settings ─▶ Import Subjects ─▶ Marks Schema ─▶ Activate Subjects ─▶ Users
 (shell)       save-config-info   import-subject-    upload-marking-   update-subject-     create-user /
                                   data-v2            scheme + save-    data               delete-user
                                                      questions
```

| # | Section | Who | Key action | API(s) | Done when |
|---|---|---|---|---|---|
| 1 | Any section's Year/Cycle selector | Both | Pick Year → Cycle | `get-year-data`, `get-cycle-data` | Both selected |
| 2 | Config Settings | Both (admin: first org only) | Stages, Standalone, Indexing, OCR, Evaluation → **Save Settings** | `get-config-info`, `save-config-info` | Success toast and reload |
| 3 | Subject & Question → Import Subject File | Superadmin | CSV with `Subject Code,Subject Name`; the dialog's own Year/Cycle/Org | `import-subject-data-v2` | `S001` / `S002` toast |
| 4 | Marks Schema | Superadmin | Subject → Word (AI) or `.md` → Confirm & Save | `convert-markscheme-to-md`, `upload-marking-scheme`, `save-questions` | Card appears under Uploaded Schemes |
| 5 | Subject & Question → STATUS badge | Superadmin | Activate (needs a guideline when Evaluation is on) | `get-config-info`, `update-subject-data` | Badge shows Active |
| 6 | Role / User Management | Both (admin: first org only) | Add / Edit / Delete users | `get-user-details`, `create-user`, `delete-user` | Success toast |

Ordering is not enforced by the UI. Steps 4 and 5 depend on step 3, and activation depends on step 2's Evaluation
stage together with step 4's guideline file.

Related: [admin-configuration.md](admin-configuration.md), [admin-subject-question.md](admin-subject-question.md),
[admin-marks-schema.md](admin-marks-schema.md), [admin-user-management.md](admin-user-management.md).
