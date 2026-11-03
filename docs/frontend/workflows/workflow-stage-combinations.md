# Workflow Stage Combinations — Navigation & Upload Behavior

This document explains, for every valid combination of the four Config
Settings toggles — **Segmentation**, **Indexing**, **OCR**, **Evaluation** —
what an evaluator sees after choosing a Year and Cycle: whether a Subject
must be picked before reaching the workspace list, and what kind of upload
the Create Workspace dialog asks for.

---

## 1. Two separate settings

There are two independent settings that shape what an evaluator sees, and
they are easy to confuse because an admin configures both in the same place:

- **Standalone Mode** is an organisation-wide on/off switch. When it is on,
  an evaluator skips Year, Cycle and Subject entirely at login and lands
  directly inside the workspace area for whichever single stage is
  configured. When it is off, the evaluator goes through Year → Cycle →
  (Subject, if required) → Workspace, which is what this document mostly
  describes.
- **Workflow Stages** are the four toggles themselves. They decide whether
  the Subject step appears, and what the Create Workspace dialog asks the
  evaluator to upload.

Standalone Mode can only be switched on for four of the ten combinations
below — Segmentation only, Indexing only, OCR only, and Evaluation only. It
cannot be combined with any multi-stage setup.

---

## 2. The rule that decides whether Subject is asked for

Only one toggle decides this: **Evaluation**.

- If Evaluation is switched on, the evaluator must pick a Subject before
  reaching the workspace list, because Evaluation needs a subject-specific
  marking scheme, pass mark and prompt to work against.
- If Evaluation is switched off, there is nothing subject-specific left to
  pick, so Year and Cycle lead straight to the workspace list. Behind the
  scenes, everything runs against a fixed placeholder subject rather than a
  real one, but the evaluator never sees that step.

Segmentation, Indexing and OCR have no say in this decision at all. That is
why "Segmentation only" skips straight to the workspace list after Cycle,
while any combination that includes Evaluation always asks for a Subject
first.

---

## 3. The ten valid combinations

Config Settings does not allow every mathematically possible mix of the four
toggles to be saved. An admin can click any checkbox, but the change is
rejected with a warning unless the result matches one of exactly ten allowed
combinations:

| # | Combination | Can run in Standalone Mode? | Input type |
|---|---|---|---|
| 1 | Segmentation only | Yes | PDF |
| 2 | Segmentation + Indexing | No | PDF |
| 3 | Segmentation + Indexing + OCR | No | PDF |
| 4 | Segmentation + Indexing + OCR + Evaluation | No | PDF |
| 5 | Indexing only | Yes | Images |
| 6 | Indexing + OCR | No | Images |
| 7 | Indexing + OCR + Evaluation | No | Images |
| 8 | OCR only | Yes | Images, Audio, Video |
| 9 | OCR + Evaluation | No | Images, Audio, Video |
| 10 | Evaluation only | Yes | Text |

The combinations that are **not** allowed are: nothing switched on at all;
Segmentation with OCR but no Indexing; Segmentation with Evaluation but no
Indexing or OCR; Segmentation with OCR and Evaluation but no Indexing; and
Indexing with Evaluation but no OCR. Each of these is rejected for a
practical reason — Segmentation without Indexing produces no per-question
mapping for OCR to read from, and Evaluation needs OCR's extracted text to
have something to mark.

If you were expecting nine rather than ten, the likely explanation is that
two of these were being counted as one elsewhere — most commonly
"Segmentation + Indexing + OCR + Evaluation" being treated as a variant of
"Segmentation + Indexing + OCR", or "OCR only" and "OCR + Evaluation" being
counted together. This document keeps all ten separate because each one
genuinely produces different behavior for the evaluator.

---

## 4. What happens after Cycle, for each combination

With Standalone Mode off:

| # | Combination | Subject step | What the Create Workspace dialog asks for |
|---|---|---|---|
| 1 | Segmentation only | Skipped | A whole scanned script: a PDF, a ZIP of PDFs, or a folder of PDFs |
| 2 | Segmentation + Indexing | Skipped | Same as above — Segmentation decides the dialog shape even when Indexing is also on |
| 3 | Segmentation + Indexing + OCR | Skipped | Same as above |
| 4 | Segmentation + Indexing + OCR + Evaluation | Asked | Same as above |
| 5 | Indexing only | Skipped | A ZIP archive containing folders of PNG/JPG images only — PDFs and loose files are not accepted |
| 6 | Indexing + OCR | Skipped | One image uploaded per question, through a per-question popup |
| 7 | Indexing + OCR + Evaluation | Asked | One image uploaded per question, through a per-question popup |
| 8 | OCR only | Skipped | One image, or an audio/video recording, per question, through a per-question popup with a mode switch |
| 9 | OCR + Evaluation | Asked | Same per-question popup with the image/audio/video mode switch |
| 10 | Evaluation only | Asked | Typed text entered per question, through a per-question popup — no file upload at all |

Two things worth calling out in plain terms:

- **Segmentation always wins the dialog shape when it is present**, even
  alongside Indexing or OCR. The whole-script PDF/ZIP upload only gives way
  to Indexing's own ZIP-of-images behavior once Segmentation is switched
  off.
- **The per-question popup only appears once Segmentation and Indexing are
  both off.** That is the point where OCR takes over and asks for images
  (with the audio/video option available only when Evaluation is the one
  other toggle involved, or neither), and where Evaluation on its own asks
  for typed text instead of any file.

---

## 5. Standalone Mode, for the four single-stage combinations

When Standalone Mode is on, login skips Year, Cycle and Subject completely
and takes the evaluator straight into the workspace area for whichever
single stage is configured:

- **Segmentation only** — a straightforward viewer for the whole scanned
  script, with no per-question popup and no quick-approve step.
- **Indexing only** — workspace creation asks for a ZIP of image folders,
  the same as the non-standalone version, just without the usual
  question-header information since there is no subject context to show.
- **OCR only** — a "Create & Extract" flow: enter a workspace name and
  candidate name, attach one to three files (images, or audio/video), and
  each one is processed immediately rather than queued for later review.
- **Evaluation only** — this combination is allowed to be marked as
  Standalone-eligible in Config Settings, but no dedicated standalone
  evaluation flow actually exists yet; there is nothing built for an
  evaluator to land on if an admin configures this.

---

## 6. Which flags gate which decision, in plain English

- **Whether a Subject must be picked** comes down to the Evaluation toggle
  by itself. Nothing else about Segmentation, Indexing or OCR matters here.

- **Whether the Create Workspace dialog shows a whole-file upload (PDF/ZIP)
  or a ZIP-of-images upload** is decided by checking Segmentation first,
  then Indexing, then OCR, then Evaluation, in that order, and stopping at
  the first one that is switched on. Segmentation showing up anywhere in the
  combination always wins this check.

- **Whether the dialog shows a per-question popup instead of a whole-file
  upload** depends on whether Segmentation or Indexing is switched on at
  all. If either of them is on, the whole-file upload is used and the popup
  never appears. If both are off, OCR being on produces an image popup, and
  Evaluation being on (with OCR off) produces a typed-text popup instead.

- **Whether the popup offers an audio/video recording option, instead of
  only images,** depends only on OCR being on with both Segmentation and
  Indexing off — Evaluation being on or off alongside that makes no
  difference to whether the option is offered.

- **Whether the candidate table shows "Video file" and "Length" columns**
  depends on all of the following being true together: the workspace itself
  was created for video answers, and the combination is specifically
  OCR + Evaluation with Segmentation and Indexing both off.

- **Whether a combination can be run in Standalone Mode** depends on it
  being one of the four single-stage combinations — Segmentation only,
  Indexing only, OCR only, or Evaluation only. Any combination mixing two or
  more stages together cannot be made standalone, however the toggles are
  set.
