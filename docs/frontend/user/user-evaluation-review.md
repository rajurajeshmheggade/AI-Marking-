# Evaluation Review Dialog ("Evaluation Preview")

The Evaluation Preview dialog shows the AI evaluation for each question (score, OCR text used, key points, missing items, rationale, sub-question breakdown), lets a reviewer override marks with an audited comment ("Manual Marking"), request AI re-evaluation, and records approval of the evaluation stage.

Source: `src/pages/OCREvaluation.tsx` — `<Dialog open={!!evaluationReviewCandidate}>` (~L14394–L16546), Save confirmation dialog (~L15366), Re-evaluation dialog (~L16878); handlers `handleOpenEvaluationReview` (~L6220), `fetchProcessDataForCandidate` (~L6492), mapping effect (~L7030), `getEvaluationRawEntryForQuestion` (~L6991), `saveEvaluationScoreOnServer` (~L3547), `rankEvalDataByMarksAwarded` (~L3365), `computeObtainedScoreWithTopN` (~L3414), `submitReEvaluationRequest` (~L6827), `closeEvaluationReviewDialogAndRefresh` (~L6926); table chip `getEvaluationScoreChipClasses` (~L553) + `getPassMarkThresholdFor` (~L1173).

Not available in Standalone Mode (`effectiveWorkflowStages.evaluation` is forced `false`).

Back to [overview](./user-review-and-evaluation.md).

---

## 1. Score chip colouring (candidate table)

The `X/Y` chip next to the Evaluation badge is rendered when `candidate.evaluationMarks !== undefined` (phase3 ∈ completed/approved/pending and a score was returned) and `noqMarker ≠ 1`.

```text
threshold = getPassMarkThresholdFor(candidate)
class     = getEvaluationScoreChipClasses(evaluationMarks, maxMarks, threshold)
label     = `${evaluationMarks}/${maxMarks || 100}`
```

**`getPassMarkThresholdFor`** (reads `apiConfig.evaluationConfig` from `get-config-info`):

1. Subject code = `candidate.subjectCode` → code/value of the subject currently selected in the dropdown → `resolveSubjectCode()` → `selectedSubject`; trimmed, lower-cased.
2. If `evaluationConfig.subjectOverrides[]` has an entry whose `subjectCode` matches (case-insensitive) and its `passMarkThreshold` is a finite number → use it.
3. Else `evaluationConfig.globalThresholds.passMarkThreshold` if finite.
4. Else `undefined`.

**`getEvaluationScoreChipClasses(marks, maxMarks, threshold)`**:

| Condition | Colour |
|---|---|
| threshold not a number | neutral slate |
| `marks / (maxMarks > 0 ? maxMarks : 100) × 100 ≥ threshold` | **green** (emerald) |
| otherwise | **red** |

The threshold is a **percentage**. localStorage and any hardcoded 40 % are deliberately not consulted. The colouring applies only to the table chip; inside the dialog the total is shown in a neutral amber pill.

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/evaluation-score-chips.png — table rows with a green and a red score chip]

---

## 2. Opening the dialog

**Trigger:** Evaluation badge (phase3 ∈ completed/pending/approved) or the score chip.

`handleOpenEvaluationReview(candidate)`:

1. `evaluationActiveFetchKeyRef = "<reg>::3"`.
2. Start index = last viewed question for this candidate (`evaluationLastQuestionIndexByCandidateRef`, remembered across openings within the page session), clamped to the question list; else 0.
3. Clears `phase1IndexingRecord`, `answerSheets`, `evaluationDataMap`, `evaluationProcessData`, `evaluationSaveMeta`, `pendingScoresMap`, `pendingSubScoresMap`; sets `evalActiveQuestionIndex`, `phase3VisitedQuestions={start}`.
4. `await fetchProcessDataForCandidate(candidate, 3)` → `setEvaluationReviewCandidate(candidate)`.

### Request / response (type 3)

```text
GET {API_BASE1}/get-process-data  type=3  (other params as type 1)
```

| Field | Use |
|---|---|
| page mapping (`segment_data` etc.) | `phase1IndexingRecord` — used for "Not answered / Not tagged" and to filter eval_data on save |
| whole `processData` | `evaluationProcessData` (the object sent back as `evaluateddata`) |
| `candidateId`, `workspaceid`, `remainingCount`, `totalCandidateCount`, `scriptPath` | `evaluationSaveMeta` (stored; not used by the save calls) |
| `eval_data{ "<qkey>": {...} }` | merged with `all_questions_ranked[q].manual_marking` when present → `evaluationDataMap` |
| `final_score.obtained_score`, `final_score.max_score` | copied onto `evaluationReviewCandidate.evaluationMarks` / `maxMarks` |

### Per-question mapping

`getEvaluationRawEntryForQuestion(map, question, index)` tries keys `id`, `index+1`, `getQuestionKey`, `Q<id>`, `Q<index+1>`, `<id>_<index>`, `<id>-<index>`, then any entry whose `Qid/qid/question_id/questionId/questionid` equals the id.

The effect at ~L7030 maps the active entry to `evaluationData`:

| eval_data field | `EvaluationData` field | UI |
|---|---|---|
| `marks_awarded` | `evaluationScore` | big score input |
| `marks_max` (else question `maxScore`) | `maxScore` | — (UI uses question `maxScore`) |
| `extracted_text` | `extractedInfo` | "OCR Data" card |
| `key_points_covered` (array, or `|`-separated string with brackets/quotes stripped) | `keypoints` | "Keypoints" list ("No Key Points Found!" when empty) |
| `missing_points[]` → `how_to_improve` \| `description` \| JSON | `missing` | "Missing Items" ("No missing items" when empty) |
| `feedback` | `rational` | "Rationale" |
| `subquestion_evaluations{}` | (read directly) | Sub-question breakdown |
| `manual_marking` | (read directly) | indigo question colour, "Manual Marks" note popover |

---

## 3. UI structure

```text
Dialog (95vw × 95vh; outside click / Esc closes via onOpenChange without table refresh)
├─ Header
│  ├─ <Award> "Evaluation Preview"
│  ├─ (rubric dropdown – trigger empty, never opens)
│  ├─ Manual Marking switch (disabled unless quickApprove; tooltip "Enable Quick Approve to use manual marking")
│  ├─ Amber pill: "Score: <displayed> / <max>" or "Total: <max> marks"
│  ├─ "Re-evaluate all" (disabled unless quickApprove)
│  └─ Close (X) → closeEvaluationReviewDialogAndRefresh
├─ Mobile question strip / Desktop rail
│  └─ colours: amber = no eval data, indigo = has manual_marking, teal = normal, ✓ visited
└─ Right content
   ├─ Candidate name · [has eval] "Re-evaluate Q" · [manual_marking] "Manual Marks" popover
   ├─ Question card: Q{id}, text/parts (hidden in Standalone Mode), Max Score (sum of sub-question max when sub-questions exist)
   ├─ [no eval data] orange "Not answered / Not tagged" (mapping empty) or "Data not found"
   └─ [eval data]
      ├─ Score banner: input  "/ max"  [Save]
      ├─ Save confirmation dialog
      ├─ Sub-question breakdown (collapsible) → per sub-question input, nested parts inputs, feedback, key points, missing points
      └─ OCR Data · Keypoints · Missing Items · Rationale
```

The dialog has **no page images** and **no explicit "Approve" button**. Approval is recorded by saving a manual mark or submitting a re-evaluation (both call `update-status type 3 status 1`, see §7).

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/evaluation-review-dialog.png — Evaluation Preview with Manual Marking on, sub-question breakdown expanded]

### Header score pill

```text
maxTotal  = processData.final_score.max_score ?? candidate.maxMarks ?? 100
baseTotal = candidate.evaluationMarks (number) else Σ marks_awarded over questions
pending   = pending value for active question (or Σ sub-question pending/actual)
displayed = pending != null ? round1(baseTotal + pending − currentActive) : baseTotal
```

This is a simple sum preview — it does **not** apply Top-N.

---

## 4. Navigation and close

| Control | Rule |
|---|---|
| Question buttons | Quick Approve OFF → free; ON → current, previous, or next after current visited. Click also closes the manual-marking view. |
| Prev / Next (mobile) | bounds; Next also blocked by the Quick Approve rule |
| Close (X) | `closeEvaluationReviewDialogAndRefresh`: remembers active index, clears fetch key, eval state, pending maps, pages, record; then **silent table refresh** (`loadCandidatesForWorkspace`) |
| Outside click / Esc | `onOpenChange(false)`: same clearing but **no table refresh** |

Pending edits are discarded on close without warning.

---

## 5. Manual marking (score editing)

Requires: Quick Approve ON → Manual Marking switch ON → eval data present.

### 5.1 Main score input (questions without sub-questions)

| Rule | Behaviour |
|---|---|
| Disabled | `!manualMarkingEnabled \|\| !hasEvalData \|\| hasSubQuestions` |
| Focus | pre-fills `pendingScoresMap[qid]` with current score |
| Allowed characters | `''` or `/^\d*\.?\d*$/` — other keystrokes are ignored (so `-` cannot be typed) |
| `n > question.maxScore` | value kept, error "Entered marks (n) cannot exceed max marks (max)." (rose underline, tooltip) |
| `n < 0` | error "Marks cannot be negative." (unreachable via regex) |
| Empty or `"."` | kept, error cleared |

### 5.2 Sub-question and nested inputs

- `subquestion_evaluations` entries whose key has ≥2 parenthesised groups (e.g. `1(b)(i)`) are treated as nested (`isNestedSubQuestionKey`) and excluded from the top level.
- A sub-question **with** `nested_evaluations` is read-only; its value is the sum of nested parts (pending or actual).
- Sub-question input: same regex; error when `> marks_max` ("Entered marks (n) cannot exceed max marks (max).") — if `marks_max` ≤ 0 there is no upper bound.
- Nested input: errors "Cannot be negative." / "Cannot exceed `max`."
- Pending keys: `pendingSubScoresMap["<qid>::<subKey or nestedKey>"]`.
- With sub-questions, the main input shows the derived sum (read-only); if the sum exceeds the question `maxScore`, the tooltip reads "Sum of sub-question marks (x) exceeds max marks (y). Reduce sub-question marks." and Save is disabled.

### 5.3 Save button

| Disabled when (no sub-questions) | Disabled when (sub-questions) |
|---|---|
| no eval data, no pending value, Manual Marking off, or a validation error | no eval data, Manual Marking off, no pending sub-value that differs from current, a sub error, or derived sum > max |

On click: value = pending (or derived sum); if `0 ≤ value ≤ max` (max = derived sub-max or question `maxScore || 10`), rounds to 1 decimal, captures the current score, opens **Confirm Score Update**; else `toast.error('Please enter a value between 0 and <max>')`.

### 5.4 Confirm Score Update dialog

- Shows Current → Updated with delta chip (+/−/No change) and an optional **Comment** textarea.
- Note text: `"Score updated by <sessionStorage.username || userCode || usercode || 'evaluator'>" will be automatically included.`
- If both old and new scores are 0: amber warning "Score is already 0. Please enter a score before saving." and **Confirm & Save** disabled.
- **Cancel** / outside click blocked (`onInteractOutside` prevented); Cancel resets the dialog state.

**Confirm & Save** sequence:

1. Builds `manual_marking` string: `Previous marks: <old> Updated marks: <new> Comment: Score updated by <user>[ - <comment>]`.
2. If sub-question edits exist: builds `processDataOverride` with updated `subquestion_evaluations` (nested parents recomputed as sum of nested parts), parent `marks_awarded` = Σ non-nested sub marks, parent `marks_max` = Σ sub max (or existing).
3. **Top-N total** — `fetch {API_BASE1}/get-config-info?OrgCode&CustCode&AppCode=AImarking` (no-store); unwraps `value[0]` / `Data[0]` / `[0]` / `.configSetting`; `topQuestionsCount` from the subject override matching `evaluationReviewCandidate.subjectCode || activeSubjectData.subjectCode`, else global; parsed as the integer before `/` (e.g. `"4/8"` → 4). `newTotal` = sum of the top N scores across **all questions in the question list** (active question uses the new score); N ≤ 0 → sum of all. On failure: `baseTotal + (new − old)`. Rounded to 1 decimal and written into `processDataOverride.final_score.obtained_score`.
4. Optimistic UI: `evaluationReviewCandidate.evaluationMarks = newTotal`, `evaluationData.evaluationScore = new`; `evaluationDataMap[q]` gets new marks + `manual_marking`; `evaluationProcessData` updated for sub-question edits; candidate row `evaluationMarks = newTotal`.
5. `saveEvaluationScoreOnServer(...)` → `POST {API_BASE}/save-evaluation-data` (§6).
6. `POST {API_BASE}/update-status {type: 3, status: 1}` (failure → `console.warn`).
7. Silent table refresh; re-fetch type 3 (replaces optimistic state with server data).
8. Clears pending values for this question, turns **Manual Marking off**, `toast.success('Evaluation score updated to <n>')`.

Steps 5–7 failure → `toast.error('Failed to save evaluation score to server. Please try again.')`; optimistic changes remain on screen until the next fetch. Pending values are cleared and the success toast is shown **even when the save failed** (they sit after the try/catch).

---

## 6. Rank and total recomputation

### `saveEvaluationScoreOnServer` → `save-evaluation-data`

1. Base process data = `processDataOverride ?? evaluationProcessData` (throws "Missing evaluation processdata…" if absent).
2. Locates the eval_data key for the question; sets `marks_awarded = obtainedScore`, keeps/sets `marks_max`, sets `manual_marking`.
3. Filters eval_data to questions that have image paths in `phase1IndexingRecord.question_page_mapping` (or `processData.question_page_mapping`); if no question has images, nothing is filtered.
4. `rankEvalDataByMarksAwarded`: sort by `marks_awarded` desc (ties by key) and assign **dense ranks** (equal marks share a rank; next distinct mark = rank + 1) into each entry's `rank`.
5. `topQuestionsCount` from in-memory `apiConfig` (subject override matched against `candidate.subjectCode || subjectcode`, else global); `computeObtainedScoreWithTopN` = sum of the N highest `marks_awarded` (all if N ≤ 0).
6. If `final_score` exists, `final_score.obtained_score` is overwritten with this recomputed value (so the `newTotal` computed in §5.4 step 3 is superseded whenever `final_score` is present).

Payload:

```json
{
  "orgcode": "...", "custcode": "ICME",
  "obtainedscore": 34.5,
  "evaluateddata": { "...processData...", "eval_data": { "1": { "marks_awarded": 7, "rank": 2, "manual_marking": "..." } },
                     "final_score": { "obtained_score": 34.5, "max_score": 50 },
                     "registration_number": "..." },
  "questiondetails": [ { "Qid": 1, "maxscore": 10, "obtainedscore": 7, "rank": 2 } ],
  "maxscore": 10,
  "registrationnumber": "...", "subjectcode": "...", "workspaceid": 123,
  "manual_marking": "Previous marks: 5 Updated marks: 7 Comment: ..."
}
```

- `questiondetails` is built from `all_questions_ranked` when present, **otherwise** `eval_data` — if the server returned `all_questions_ranked`, these rows carry the pre-edit marks/ranks.
- `maxscore` is the edited **question's** max (or derived sub-question max), not the candidate total.

### `saveFilteredEvaluationDataWithoutImagePaths` (cleanup after Phase 1 / OCR approval)

Same filtering, dense ranking and Top-N recompute, but no score change; payload has `obtainedscore` = recomputed total, `maxscore` = `final_score.max_score`, no `manual_marking`.

---

## 7. Re-evaluation

| Control | Visible / enabled | Opens |
|---|---|---|
| **Re-evaluate all** (header) | enabled when Quick Approve ON | Re-evaluation dialog, scope "All questions" (`reEvaluationIsAll=true`) |
| **Re-evaluate Q** (content header) | when the active question has eval data; enabled when Quick Approve ON | Re-evaluation dialog, scope "Question `<id>`" (`openReEvaluationForQuestion`; invalid id → "Invalid question selected") |

**Request Re-evaluation dialog** (~L16878): candidate name, scope, **Re-evaluation Instructions** textarea (required). **Submit** disabled while empty or submitting; **Cancel** resets.

`submitReEvaluationRequest`:

| Check | Toast |
|---|---|
| empty prompt | "Please provide re-evaluation instructions" |
| no candidate | "No candidate selected for re-evaluation" |
| question scope with no question | "Please select a question to re-evaluate" |

```text
POST {API_BASE}/run-evaluation
{ orgcode, custcode:'ICME', usercode, isall: 1|0, registrationnumber,
  subjectcode, workspaceid, questions: [] | [qid], userprompt: <instructions> }
```

- Status not in {200, 201, 204} → `toast.error('Failed to submit re-evaluation (status N)')`.
- Success → `toast.success('Re-evaluation request submitted successfully')`, dialog closed/reset → re-fetch type 3 → silent table refresh → `POST update-status {type:3, status:1}` (failure logged only).
- Error → `toast.error('Failed to submit re-evaluation request. Please try again.')`.

The response body of `run-evaluation` is not read; the refreshed type 3 data reflects whatever the backend has at that moment (re-evaluation may still be running).

### Related table actions (outside the dialog)

| Action | Request | Status update |
|---|---|---|
| Evaluation **Rerun** (`markingstatus = 4`) — `handleRunEvaluation` | `GET get-process-data type 2` (result only used to build an unused `questionsArray`), then `POST run-evaluation {isall:1, questions:[], userprompt:''}` | none (calls commented out) |
| "Stalled" restart — `handleRestartEvaluation` | `POST run-evaluation {isall:1}` + `POST update-status {type:3, status:2}` | unreachable (`isCandidateStalled` returns `false`) |

---

## 8. Conditional rendering summary

| Element | Condition |
|---|---|
| Manual Marking switch enabled | `quickApprove` |
| Re-evaluate all enabled | `quickApprove` |
| Re-evaluate Q | active question has eval data (enabled when `quickApprove`) |
| Manual Marks note | active entry `manual_marking` non-empty string |
| Score banner, sub-questions, detail cards | `evaluationData` present for active question |
| "Not answered / Not tagged" | mapping key exists but empty and no eval entry |
| Sub-question breakdown | `subquestion_evaluations` has non-nested entries; expanded via toggle |
| Question text | not Standalone Mode |

See also: [OCR review](./user-ocr-review.md) · [API mapping](./user-api-mapping-review.md) · [workflow](../workflows/review-and-approval-workflow.md) · admin config for `evaluationConfig`: [../admin/](../admin/).
