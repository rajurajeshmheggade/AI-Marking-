# User Workflow (Concise)

The full narrative, broken down per stage combination, is in [`../workflows/user-workflow.md`](../workflows/user-workflow.md).

```text
Login
 ├─ normal ──► Home (/subject-dashboard)
 │              Year ▼ ─► Cycle card ─► Subject card ──(sessionStorage subject/year/cycle)──┐
 └─ standalone ──────────────────────────────────────► /ocr-evaluation ◄──────────────────┘
                                                      Workspace list
                                                        ├─ Create New Workspace ─► dialog ─► upload chain (by stages)
                                                        └─ open workspace ─► candidate table (polls every 30 s)
                                                                              ├─ status badge ─► review dialogs
                                                                              ├─ Upload Additional Files
                                                                              ├─ Delete selected
                                                                              └─ Download (.xlsx)
```

| # | Step | Where | Main API(s) | Next |
|---|---|---|---|---|
| 1 | Sign in | `Login.tsx` | `get-config-info` (standalone flag, stages) | 2 or 4 |
| 2 | Choose year → cycle | `SubjectDashboard.tsx` | `get-year-data`, `get-cycle-data` | 3 |
| 3 | Choose subject | `SubjectDashboard.tsx` → `handleSelect` | `get-subject-data` | 4 |
| 4 | See workspaces | `OCREvaluation.tsx` → `refreshWorkspaces` | `get-subject-data` (smart), `list-workspace`, `question-data` | 5 or 6 |
| 5 | Create workspace and upload | Create dialog | per mode: `create-workspace`, `save-candidate-info`, `upload-pdfs` / `upload-pngs` / `upload-audios`, `save-ocr-data`, `recalculate-standards`, `run-evaluation`, `transcribe-audio`, AI `extract` | 6 |
| 6 | Open workspace | card click / Workspace ▼ | `candidate-process-data`, `get-config-info` | 7 |
| 7 | Monitor stages | candidate table | `candidate-process-data` every 30 s | 8 |
| 8 | Review / approve | badges | see [user-review-and-evaluation.md](./user-review-and-evaluation.md) | 9 |
| 9 | Export | Download | `get-all-data-exports` (paginated) | – |

Stage combinations at a glance:

| Effective stages | Upload input | Table columns |
|---|---|---|
| Segmentation (+ Indexing/OCR/Evaluation) | PDFs, folder or ZIP of PDFs | Segmentation(/Indexing) + enabled others |
| Indexing (no Segmentation) | ZIP of image folders | Indexing + enabled others |
| OCR (± Evaluation) | Candidate name + images (or one audio file) per question | OCR (+ Evaluation) |
| Evaluation only | Candidate name + OCR text per question | Evaluation |
| Standalone OCR only | Candidate name + 1–3 images, Create & Extract | OCR (no Quick Approve) |
