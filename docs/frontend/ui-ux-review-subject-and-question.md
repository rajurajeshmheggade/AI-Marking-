# UI/UX Review — Subject & Question Admin Workflow

Scope: the **Subject & Question** screen in the Super Admin Dashboard
(`src/pages/SuperAdminDashboard.tsx` → `SubjectQuestionPanel`), covering four
dialogs a Super Admin moves through as one conceptual task — importing a
subject, uploading its marking scheme, and reviewing the questions/rubric
that scheme produced. Each dialog was built with its own visual language
instead of a shared one, so the same task feels like four different products
depending on which step you're on.

No code was changed for this review — it is a design findings document only.

---

## 1. Import Subject

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/subject-import-subject.png — "Import Subject" dialog: Select Customer/Organization/Year/Cycle in a 2×2 grid, then a dashed upload dropzone for a `.csv` template]

**Where:** `SuperAdminDashboard.tsx` ~L2805-2875 (header shell), ~L2838-2875 (customer/org selects).

**Style used:** header icon badge solid `#2563eb` blue; header strip `bg-gradient-to-r from-[#2563eb]/5 to-blue-50/30`; numbered step badges (`1`, `2`, …) in a blue circle; `border-2 border-gray-100` thick-bordered inputs; `rounded-xl` corners; `maxWidth: 1000px`.

**Findings:**
- The "5 UPLOAD FILE" step's dropzone copy says "Accepts .cw templates only" — reads like a typo/placeholder for "`.csv`" (there is no widely-recognized `.cw` file type), and nothing on screen explains what a "template" actually is or links to one (contrast with the Marking Schema dialog below, which has a visible "Download Template" link in the same position).
- Steps are numbered 1–5 but rendered as plain circles with no connecting line/progress indicator, so it doesn't read as a sequence a user is moving through — just five independently labeled fields.

---

## 2. Upload Marking Schema — subject/cycle selection

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/subject-marking-schema-select.png — "Upload Marking Schema" dialog: Select Customer/Organization/Year/Cycle/Subject, then "Upload Marking Scheme" button, disabled until a subject is chosen]

**Where:** `SuperAdminDashboard.tsx` ~L2309-2345. The code comment explicitly says: *"Same shell as Import Subject, so the two read as one family."*

**Style used:** identical header shell to §1 (same blue icon badge, same gradient strip, same `rounded-xl` inputs) — **this part is done right** and should be the reference style for the other two dialogs below.

**Findings:**
- The "Download Template" link here (top-right of step 5) is exactly the link §1's dropzone is missing — the two dialogs solve the same "where do I get the template" problem differently (one has the link, one doesn't) despite intentionally sharing a shell.
- "SELECT SUBJECT" has an "Upload folder by subject name" checkbox with no visible explanation of what it does differently when checked; it's the only non-obvious control in an otherwise self-explanatory form.

---

## 3. Upload Marking Schema — AI Auto-Convert / Direct Upload step

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/subject-marking-schema-choose.png — Step 2 of the same flow: "1 Choose → 2 Process → 3 Preview" stepper, then two large cards: "Upload Document" (orange, "AI Auto-Convert" badge) and "Upload .md File" (teal, "Direct Upload" badge)]

**Where:** `SuperAdminDashboard.tsx` ~L4336-4378.

**Style used:** a completely different visual system from §2, despite being the very next screen in the **same** upload flow: large centered cards (`p-8`, `rounded-2xl`) with hover-lift animation, an orange icon badge for "Upload Document" and a teal icon badge for "Upload .md File", pill badges ("AI AUTO-CONVERT" / "DIRECT UPLOAD") floating at each card's top-right corner, and a numbered circle stepper ("1 Choose", "2 Process", "3 Preview") that has no equivalent anywhere in §1/§2.

**Findings — this is the clearest issue in the set:**
- A Super Admin opens "Upload Marking Schema" (blue header, blue accents, §2) and the very next screen in that same dialog drops the blue theme entirely for orange+teal cards with no header bar carrying over the subject/cycle context already selected — it reads as having navigated into a different tool.
- Orange and teal are used here purely to tell two upload *options* apart from each other; the same two colors are used project-wide for other meanings — orange for "needs attention" counts, teal for the app's primary action color (buttons, active nav, etc. throughout `OCREvaluation.tsx` and `SubjectDashboard.tsx`). Using them here as arbitrary option-differentiators borrows colors the rest of the app already uses to mean something else.
- The "1 Choose → 2 Process → 3 Preview" stepper exists only inside this one sub-step of the overall flow (Customer → Org → Year → Cycle → Subject → **this** → Preview → Submit); it duplicates step-tracking the outer dialog's own numbered fields (§2) were already doing, with a different visual convention (circles-with-connecting-line vs. plain numbered badges).

---

## 4. Question(s) & Rubric(s) breakdown

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/subject-question-rubric-breakdown.png — "Question(s) & Rubric(s)" dialog: a teal circular "i" info icon, "Edit" button top-right, then a scrollable list of "QUESTION 1/2/3…" cards each with its text and a "marks" pill]

**Where:** `SuperAdminDashboard.tsx` ~L2480-2560.

**Style used:** a **third** distinct visual system: `#f8fafc` body background, `rounded-[24px]` dialog corners (§1/§2 use `16px`), a teal info icon rendered as a circle around a **serif, italic, bold "i" glyph** — the only serif character anywhere in these four dialogs, which otherwise use the app's sans-serif font throughout — and teal Edit/Save/Cancel buttons.

**Findings:**
- The serif italic "i" is a one-off: nothing else in the Subject & Question workflow (or, per the component inventory, the app generally) uses a serif font, so it reads as an unstyled fallback rather than a deliberate choice.
- This is the only one of the four dialogs with `24px` corners; §1 and §2 use `16px`. There's no reason tied to this dialog's content for the radius to differ.
- Each question card's marks pill repeats the number already shown beside the question's own heading (seen in the screenshot as "20 marks" appearing twice per question row) — not a visual-language issue, but worth a second look alongside the above.

---

## 5. Summary: one task, four design languages

| Dialog | Header color | Corner radius | Accent color(s) | Font |
|---|---|---|---|---|
| §1 Import Subject | Blue `#2563eb` | `16px` | Blue | Sans (app default) |
| §2 Upload Marking Schema (select) | Blue `#2563eb` (same shell as §1) | `16px` | Blue | Sans |
| §3 Upload Marking Schema (choose method) | None (no header bar) | `16px` (cards: `16px`) | Orange **and** Teal | Sans |
| §4 Question(s) & Rubric(s) | None (plain white) | `24px` | Teal | Sans, except one serif/italic glyph |

Four screens that are all steps of the same two tasks ("add a subject," "give
it a marking scheme") currently read as four different products. The
recommendation is not to pick any one of these four as "correct" — it's to
define one shell (header treatment, corner radius, accent color, step
indicator convention) and apply it to all four, the way §1 and §2 already
intentionally share one.
