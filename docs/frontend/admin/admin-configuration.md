# Config Settings (`SettingsSection`)

Source: `src/pages/SuperAdminDashboard.tsx` → `SettingsSection` (~L3817–6471). It also uses module-level
helpers defined at ~L3393–3815: `WORKFLOW_COMBINATIONS`, `INDIVIDUAL_STAGES`, `isValidIndividualSelection`,
`toIndividualSelection`, `sanitizePredefinedMapping`, `validateTopQValue`, `TopQFractionInput`,
`blockNonDigitCountKeys` and `toCountValue`.

Props: `API_BASE1`, `yearCode`, `cycleCode` and `yearCycleSelector`, all from the shell. HTTP calls use
`fetch`, not axios.

## Page structure

```text
Settings header ── [Customer]* [Organization]* [Year] [Cycle]        (* hidden for admin)
│
├─ Workflow Configuration card ── (eye icon) "View combinations" dialog
│    └─ Workflow Stages: 4 checkboxes
├─ Standalone Mode card                       (only when a single individual stage is selected, or the mode is ON)
├─ Segmentation / Indexing Configuration card (Segmentation OR Indexing)
│    ├─ Candidate Info Extraction             (hidden in Standalone)
│    ├─ Answer Script Structure               (Indexing only)
│    └─ Predefined mapping panel              (Predefined AND expanded)
├─ OCR Configuration card                     (OCR AND NOT Standalone)
│    └─ Standards Met Count                   (Metadata / Question Number cards are commented out)
├─ Evaluation Thresholds card                 (Evaluation)
│    ├─ Pass/Fail Mark Threshold (+ subject-wise grid)
│    ├─ Top N Questions (+ subject-wise grid)
│    └─ Live-evaluation Agent                 (AI Prompt card is commented out)
└─ Floating "Save Settings" button  → handleSaveToDB
```

All of the cards except the Workflow card are hidden with the CSS class `hidden`. They are **not** unmounted, so
their state is kept and only the visibility changes.

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/config-settings-full.png — Config Settings with all four stages checked, all cards visible]

## Load sequence

```text
mount / selectedCustomer change
  └─ fetch GET API_BASE1/organization-details?CustCode=<selectedCustomer>
       ├─ organizations ← data.data || data
       ├─ selectedOrg   ← first organizationid
       ├─ await fetchSubjects(first organizationcode)      → GET get-subject-data
       └─ loadSettings(first organizationcode)             → GET get-config-info
  (the effect at ~L4417 also calls loadSettings once selectedOrg + organizations are set → normally 2 loads)

Organization dropdown change → handleOrgChange
  ├─ setSelectedOrg(newId)
  ├─ await fetchSubjects(org.organizationcode)
  └─ loadSettings is triggered by the effect at ~L4417
```

While loading, a `PageLoader` overlay is shown (`loadingSettings` or `isSavingToDB`). While `loadingOrgs` is
true, the card area is replaced by a spinner.

### `fetchSubjects(orgCode)` (~L4184)

| Item | Value |
|---|---|
| Guard | If `yearCode` or `cycleCode` is empty: clears `subjects` and all `*SubjectCode`, shows the toast "No Year/Cycle available to load subjects.", and stops |
| Request | `GET ${API_BASE1}/get-subject-data?orgCode&custCode=ICME&yearCode&cycleCode&userCode`. `userCode` = `sessionStorage.userCode` or `username`, with `\x00` stripped. |
| Response | `subjects ← data.data \|\| data \|\| []`. The fields used later are `subjectcode` and `subjectname`. |
| Side effect | The first subject's code goes into `passMarkSubjectCode`, `topQSubjectCode`, `standardsSubjectCode`, `metadataSubjectCode` and `qNumSubjectCode` |
| Error | Toast "Failed to load subjects" |

> Changing the shared Year/Cycle does **not** re-run `fetchSubjects` here. The subject grids keep the subjects of
> the year and cycle that were selected when the org was loaded.

### `loadSettings(orgCode)` (~L4224)

Request: `GET ${API_BASE1}/get-config-info?OrgCode=<orgCode>&CustCode=<selectedCustomer>&AppCode=AImarking`.

**API path.** This path is taken when the response is OK and `data[0].configSetting` exists:

| `configSetting` field | State set | Default if the field is missing |
|---|---|---|
| `ocrConfig.MetadataPresent` | `isMetadataGlobalOn` | Unchanged (keeps the previous value) |
| `ocrConfig.StandardsMetCount` | `isStandardsGlobalOn` | Unchanged |
| `ocrConfig.QuestionNumberExtraction` | `isQNumGlobalOn` | Unchanged |
| `indexingConfig.type` | `answerScriptType` | `'flexible'` (only when `indexingConfig` exists) |
| `indexingConfig.predefinedSettings.maxQuestions` / `.maxImages` | `predefinedMaxQuestions` / `predefinedMaxImages` | `1` |
| `indexingConfig.predefinedSettings.imageFormat` | `predefinedImageFormat` (`'jpg'` if the value is `jpg`, otherwise `'png'`) | — |
| `indexingConfig.predefinedSettings.mapping` | `predefinedMapping`, after `sanitizePredefinedMapping(…, maxQ, maxImg)` (`firstImg = 1`) | `{}` |
| `workflowStages` | `selectedStages` (assigned as-is) | Unchanged |
| `standalone` | `isStandaloneMode`. Also writes `localStorage.standalone_mode` = `'1'` or `'0'` | Unchanged |
| `evaluationConfig.globalThresholds.passMarkThreshold` | `passMark` (string) | `'40'` |
| `…globalThresholds.topQuestionsCount` | `topQuestionsCount` | `'5/8'` |
| `…globalThresholds.selectedPrompt` | `selectedPrompt` | `'generic'` |
| `…globalThresholds.liveEvaluationAgentEnabled` | `isReevalAgentGlobalOn` | `false` |
| `segmentationConfig.CandidateInfo` | `isCandidateInfoGlobalOn` | Unchanged |

On the API path it then:

1. Removes every `localStorage` key that starts with any of these prefixes for `<orgCode>_`: `org_pass_mark_`,
   `org_top_questions_`, `org_prompt_`, `org_reeval_agent_`, `org_standards_count_`, `org_ocr_metadata_` and
   `org_ocr_qnum_`. Only subject-level keys are removed, because the prefix includes a trailing `_` after the org code.
2. Writes subject overrides back to localStorage:
   - From `evaluationConfig.subjectOverrides[]`: `org_pass_mark_<org>_<sc>`, `org_top_questions_<org>_<sc>`,
     `org_prompt_<org>_<sc>`, and `org_reeval_agent_<org>_<sc>` (`'1'` or `'0'`).
   - From `ocrConfig.subjectOverrides[]`: `org_standards_count_<org>_<sc>`, `org_ocr_metadata_<org>_<sc>` and
     `org_ocr_qnum_<org>_<sc>` (`'1'` or `'0'`).
3. Forces a re-render with `setSubjects(prev => [...prev])` and returns.

**localStorage fallback.** This path is taken on a non-OK response, an empty array, a missing `configSetting`,
or an exception. Values are read from the keys below.

| Key | State | Default |
|---|---|---|
| `org_pass_mark_<org>` (or the `_<subject>` variant when subject-specific mode is on, which never happens; see below) | `passMark` | `'40'` |
| `org_top_questions_<org>` | `topQuestionsCount` | `'5/8'` |
| `org_prompt_<org>` | `selectedPrompt` | `'generic'` |
| `org_standards_count_<org>` | `isStandardsGlobalOn`, `isStandardsSubjectOn` | `false` |
| `org_ocr_metadata_<org>` | `isMetadataGlobalOn`, `isMetadataSubjectOn` | `false` |
| `org_ocr_qnum_<org>` | `isQNumGlobalOn`, `isQNumSubjectOn` | `false` |
| `org_seg_candidateinfo_<org>` | `isCandidateInfoGlobalOn` (`=== '1'`) | `false` |
| `org_predefined_mapping_<org>` (JSON `{maxQuestions,maxImages,imageFormat,mapping}`) | predefined state (sanitized) | `{}`, 8, 12, `png` |
| `org_answer_script_type_<org>` | `answerScriptType` | `'flexible'` |
| `org_selected_stages_<org>` (JSON) | `selectedStages` | `DEFAULT_STAGES` = Segmentation only |
| `org_standalone_<org>` | `isStandaloneMode`. Also writes `standalone_mode` | `false` |

> **Risk:** On the API path, fields that are missing from `configSetting` keep whatever the previous organization
> had. For example, if org B's config has no `ocrConfig`, org A's Standards toggle stays on.

## Workflow Stages

Control: four checkboxes, `stage-segmentation`, `stage-indexing`, `stage-ocr` and `stage-evaluation` (~L5023–5112).
State: `selectedStages`. Default for an org with nothing saved: `{segmentation:true, indexing:false, ocr:false, evaluation:false}`.

### Allowed combinations (`WORKFLOW_COMBINATIONS`, ~L3761)

| # | Combination | Standalone-eligible | Image / Audio |
|---|---|---|---|
| 1 | Segmentation only | Yes | |
| 2 | Segmentation + Indexing | | |
| 3 | Segmentation + Indexing + OCR | | |
| 4 | Segmentation + Indexing + OCR + Evaluation | | |
| 5 | Indexing only | Yes | |
| 6 | Indexing + OCR | | |
| 7 | Indexing + OCR + Evaluation | | |
| 8 | OCR only | Yes | Yes |
| 9 | OCR + Evaluation | | Yes |
| 10 | Evaluation only | | |

Combinations that are not allowed include all-off, Segmentation + OCR, Segmentation + Evaluation, and Indexing +
Evaluation.

### Checkbox onChange

```text
Standalone ON:
  disabled = stage is Evaluation, OR another of Segmentation/Indexing/OCR is already checked
  check   → stages = { only this stage }        uncheck → all off (allowed; zero stages is valid here)
  resetCandidateInfoIfStageDropped(prev, next)

Standalone OFF:
  newStages = { ...selectedStages, [stage]: checked }
  not in WORKFLOW_COMBINATIONS → toast.error("You have selected an invalid combination… Allowed combinations:\n1. …")
                                 (5 s, pre-line); state unchanged
  valid → setSelectedStages(newStages)
          if Segmentation/Indexing unchecked and neither remains on:
             isCandidateInfoGlobalOn=false; localStorage.removeItem(org_seg_candidateinfo_<org>)
```

Unchecking the last checked stage outside Standalone Mode is rejected, because all-off is not in the list.

### "View combinations" dialog

The eye button in the card header sets `showCombinationsDialog`. The dialog lists all 10 combinations as stage
chips, with a **Current** badge (on the entry that exactly equals `selectedStages`), a **Standalone** badge and an
**Image / Audio** badge. Clicking outside the dialog does not close it (`onPointerDownOutside` and
`onInteractOutside` are prevented); it closes with the X button or Escape.

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/config-workflow-combinations.png — View combinations dialog with "Current" badge]

## Standalone Mode

Visibility: the card is shown when `isSingleIndividualStage || isStandaloneMode`, where
`isSingleIndividualStage = !evaluation && exactly one of {segmentation, indexing, ocr}`. Because it also stays
visible while the mode is on, the user can always switch it off.

Control: a `Switch` bound to `isStandaloneMode`, with the label "● Standalone Mode Active" or "○ Standard Mode (default)".

onCheckedChange (~L5168):

1. `setIsStandaloneMode(checked)`.
2. If it was turned on and the selection is not a valid single stage: `next = toIndividualSelection(stages)` keeps
   the **earliest** selected individual stage in pipeline order and clears Evaluation. It then calls
   `resetCandidateInfoIfStageDropped`, sets the stages, and shows the toast "Standalone Mode keeps one stage: X. The
   other stages were cleared." (or "…select one stage…" if none survived).
3. Writes immediately, **before Save**: `localStorage.org_standalone_<org>` = `'1'` or `'0'` (when an org is
   resolved) and `localStorage.standalone_mode` = `'1'` or `'0'`.

### Standalone rule set

| Rule | Mechanism | Line |
|---|---|---|
| At most one of Segmentation / Indexing / OCR, and never Evaluation | Checkbox `disabled` plus the onChange branch; `isValidIndividualSelection` | ~L5057, L3534 |
| A loaded config that breaks the rule is corrected automatically | Effect on `[isStandaloneMode, selectedStages]` → `toIndividualSelection` | ~L3962 |
| Standards Met Count is forced off | Effect: `isStandardsGlobalOn=false`, `localStorage.org_standards_count_<org>='0'` | ~L3975 |
| Candidate Info Extraction is forced off | Same effect: `isCandidateInfoGlobalOn=false`, removes `org_seg_candidateinfo_<org>` | ~L3982 |
| Candidate Info card hidden | `isStandaloneMode ? 'hidden'` | ~L5225 |
| Whole OCR Configuration card hidden | `(!selectedStages.ocr \|\| isStandaloneMode) ? 'hidden'` | ~L5602 |
| Standards Met card hidden (redundant with the row above) | `isStandaloneMode ? 'hidden'` | ~L5619 |
| Answer Script locked to Flexible when Indexing is the stage | `lockAnswerScriptToFlexible = isStandaloneMode && indexing`. An effect forces `'flexible'`, and the Predefined label and Switch are disabled. | ~L4042–4050, L5306–5336 |
| Payload still carries `standalone: true` and the single stage | `handleSaveToDB` | ~L4707 |

How user pages read these values: `Login.tsx` and `OCREvaluation.tsx` read `localStorage.standalone_mode`, and
`Login.tsx` reads `org_selected_stages_<orgCode>`. Both also re-fetch `get-config-info` and overwrite
`standalone_mode` and `workflowStages` themselves. See [../workflows/admin-workflow.md](../workflows/admin-workflow.md#how-the-configuration-reaches-user-pages).

## Segmentation / Indexing Configuration

The card is visible when `candidateInfoStageOn = segmentation || indexing`.

### Candidate Info Extraction

| Aspect | Value |
|---|---|
| Visible | Card visible **and** `!isStandaloneMode` |
| Control | `Switch`, `checked = candidateInfoStageOn && isCandidateInfoGlobalOn`, `disabled = !candidateInfoStageOn` |
| onChange | `setIsCandidateInfoGlobalOn(checked)`; on → `localStorage.org_seg_candidateinfo_<org>='1'`, off → the key is removed |
| Effects | `candidateInfoActive` makes `firstTaggableImage()` return 2, so image 1 is the candidate page and cannot be tagged. `minPredefinedImages` becomes 2. An effect (~L4159) immediately removes image 1 from every question's mapping. |
| Reset | Cleared when neither Segmentation nor Indexing remains on, and when Standalone is turned on |

### Answer Script Structure

| Aspect | Value |
|---|---|
| Visible | `selectedStages.indexing` |
| Control | "Predefined" label · Switch (`checked = answerScriptType === 'flexible'`) · "Flexible" label. Both labels can be clicked. |
| Disabled | `!indexing \|\| lockAnswerScriptToFlexible` (tooltip: "Standalone Mode always uses a flexible answer script.") |
| onChange | `setAnswerScriptType('flexible' \| 'predefined')`. No immediate localStorage write. |
| Side effect | Effect at ~L4091: `isPredefinedExpanded = (answerScriptType === 'predefined')`. Choosing Predefined opens the mapping panel, including when the value comes from a load. |
| Predefined extras | A note ("covers N question(s) and M image(s) per script") and a "Configure / Hide Mapping Details" toggle |

### Predefined mapping panel

Visible when `isPredefinedExpanded && answerScriptType === 'predefined'` (and Indexing is on).

| Field | Control | Rules | onChange |
|---|---|---|---|
| Max Questions | `type=number`, 1–99 | `blockNonDigitCountKeys` blocks `- + e E . ,`. `toCountValue` keeps at most 2 digits. An empty value is allowed while typing. | `requestPredefinedConfigChange('questions', v)` |
| Max Images | Same. Placeholder shows `minPredefinedImages`–99. | Inline error when `0 < value < minPredefinedImages`: "Max Images must be at least 2 while Candidate Info Extraction is on…" | `requestPredefinedConfigChange('images', v)` |
| Image Format | Segmented buttons `PNG` / `JPG` | Disabled when `!indexing` | `setPredefinedImageFormat` |
| Question N image picker | A dropdown per question (closes on outside click via `.q-dropdown-container`) | Taggable pool = `firstTaggableImage()` … `maxImg`. One image can be tagged to several questions; the dropdown shows other owners as `Q…` | `toggleImageForQuestion(q, img)` |

`requestPredefinedConfigChange` recomputes the mapping with `sanitizePredefinedMapping`. If nothing would be lost,
the change is applied. Otherwise it stores `pendingPredefinedConfig` and opens the **"Some existing tags will be
removed"** dialog, which lists the questions that would be removed and the image tags that would be cleared.

- **Remove & Apply** → `confirmPredefinedConfigChange` → toast "Configuration updated - N image tag(s) removed".
- **Cancel** → the change is discarded.

Live indicator chips show the question count, image count, `tagged / taggable`, the untagged count, and the
Candidate Info state. Warnings: the Candidate Info explanation and the "Only X taggable images for N questions…"
banner.

When Predefined and Indexing are both active, `predefinedQuestionTotal = Max Questions`. The Top N **Total** box
becomes read-only and follows Max Questions, and effects clamp the global and per-subject Top N numerators to that
total (~L3995–4038).

[SCREENSHOT REQUIRED: docs/frontend/assets/screenshots/config-predefined-mapping.png — predefined mapping grid with chips and an open image dropdown]

## OCR Configuration

The card is visible when `selectedStages.ocr && !isStandaloneMode`.

| Setting | Visible | Control | onChange |
|---|---|---|---|
| Standards Met Count | Not Standalone | Switch `isStandardsGlobalOn` | Sets the state and writes `localStorage.org_standards_count_<org>` = `'1'` or `'0'` |
| Metadata Present | **Commented out** (~L5663) | — | The value is still loaded and saved in `ocrConfig.MetadataPresent` |
| Question Number Extraction | **Commented out** (~L5709) | — | The value is still loaded and saved in `ocrConfig.QuestionNumberExtraction` |

## Evaluation Thresholds

The card is visible when `selectedStages.evaluation`.

### Pass/Fail Mark Threshold

| Aspect | Value |
|---|---|
| Scope tabs | Only a **Global** tab exists. `isPassMarkSubjectSpecific` is never set to `true`, so the subject-specific branch (~L5816) is unreachable. |
| Global input | `type=number`, accepts `''` or integers 1–99 (no `.`). onChange writes `localStorage.org_pass_mark_<org>` = value (or `'40'` when empty) and re-renders the subjects. |
| "View/Hide Subject wise change" | Grid of subjects. Each card shows the subject's own value (highlighted "Subject override") or the global value. |
| Subject card input | onFocus starts a draft (`passMarkDrafts`). onChange with a value 1–99 writes `org_pass_mark_<org>_<sc>`; an empty value removes the key. The X button clears the override and shows the toast "<subject> now uses the global pass mark (N)." |

### Top N Questions

| Aspect | Value |
|---|---|
| Control | `TopQFractionInput`: two boxes of up to 2 digits around a fixed `/`. Filling the numerator moves focus to the denominator. It emits `"N/D"`. |
| Default | `TOP_Q_DEFAULT = '/'`, which means not set |
| Validation (`validateTopQValue`) | Unset (`''` or `'/'`) → OK. Not `^\d+/\d+$` → "Please enter a valid value in the format Min Question Count/Max Question." Either part 0 → "Numerator and denominator must both be greater than zero." D < N → "The denominator cannot be less than the numerator." |
| Global onChange | `setTopQuestionsCount`, `setTopQError`. When valid: writes `org_top_questions_<org>`, or removes it when unset. |
| Subject grid | A compact input per subject. It shows the inherited global value greyed until focused. Invalid drafts are kept in `topQSubjectDrafts` and their messages in `topQSubjectErrors`. Valid → writes or removes `org_top_questions_<org>_<sc>`. The X button clears the override. |
| Locked total | When Predefined and Indexing are both on, the denominator is read-only and equals Max Questions |
| Subject-specific scope | Unreachable, for the same reason as Pass Mark |

### Live-evaluation Agent

A Switch bound to `isReevalAgentGlobalOn`. onChange writes `org_reeval_agent_<org>` = `'1'` or `'0'`.

### Select AI Prompt

**Commented out** (~L5970–6182). `selectedPrompt` is still loaded (default `'generic'`) and saved.

## Save: `handleSaveToDB` (~L4644)

Trigger: the floating **Save Settings** button. It is never disabled; a `PageLoader` overlay is shown while
`isSavingToDB` is true.

### Pre-save validation (stops at the first failure)

| # | Condition | Toast / UI |
|---|---|---|
| 1 | No org resolved | "No organization selected" |
| 2 | `evaluation` on and the global Top N is invalid | The validation message; `topQError` is set |
| 3 | `evaluation` on and a subject Top N is invalid | "Top N / Total for <subject name>: <message>" |
| 4 | `predefined` and `indexing`, and Max Questions or Max Images is blank | "Please enter a value for Max Questions and Max Images (1-99)."; the mapping panel is expanded |
| 5 | `predefined` and `indexing`, and Max Images < `minPredefinedImages` | "Max Images must be at least 2 when Candidate Info Extraction is on…" or "Max Images must be at least 1." |
| 6 | `untaggedQuestions` is not empty (only computed for `indexing && predefined`) | "Every question must have at least one image tagged. Missing: Q…" (5 s); the panel is expanded |

Top N errors do not block a save while Evaluation is off, because that card is only hidden.

### Request

`POST ${API_BASE1}/save-config-info`, with `Content-Type: application/json` and `Accept: */*`.

```jsonc
{
  "orgCode": "<organizationcode>",
  "custCode": "<selectedCustomer>",
  "appCode": "AImarking",
  "configSetting": {
    "OrgCode": "<organizationcode>",
    "CustCode": "<selectedCustomer>",
    "workflowStages": { "segmentation": bool, "indexing": bool, "ocr": bool, "evaluation": bool },
    "standalone": bool,
    // only if segmentation || indexing
    "segmentationConfig": { "CandidateInfo": isCandidateInfoGlobalOn },
    // only if ocr
    "ocrConfig": {
      "StandardsMetCount": bool, "MetadataPresent": bool, "QuestionNumberExtraction": bool,
      "subjectOverrides": [ { "subjectCode": "...", "StandardsMetCount"?: bool, "MetadataPresent"?: bool, "QuestionNumberExtraction"?: bool } ]
    },
    // only if indexing
    "indexingConfig": {
      "type": "flexible" | "predefined",
      "predefinedSettings": { "maxQuestions": n||1, "maxImages": n||1, "imageFormat": "png"|"jpg", "mapping": { "q1": [2,3], ... } }
    },
    // only if evaluation
    "evaluationConfig": {
      "globalThresholds": {
        "passMarkThreshold": Number(passMark) || 40,
        "selectedPrompt": "generic" | ...,
        "topQuestionsCount": "<N/D>"  /* or "5" when unset */,
        "liveEvaluationAgentEnabled": bool
      },
      "subjectOverrides": [ { "subjectCode": "...", "passMarkThreshold"?: n, "selectedPrompt"?: s, "topQuestionsCount"?: s, "liveEvaluationAgentEnabled"?: bool } ]
    }
  }
}
```

How the payload is assembled:

- Each `subjectOverrides` list is built by looping over the currently loaded `subjects`. For each subject, the
  code checks whether the subject-level localStorage key exists (`!== null`). Only subjects with at least one
  key are included, and only the keys that exist are emitted.
- `indexingConfig.predefinedSettings` is always sent when Indexing is on, even when `type` is `flexible`.
- A setting that belongs to a stage which is off is omitted completely; it is not sent as `false`.

### Response handling

| Outcome | Behaviour |
|---|---|
| `response.ok` | Parses JSON. `code = result.code \|\| result.status \|\| result`. `'s001'` → "Settings saved successfully (s001)"; `'s002'` → "Settings updated successfully (s002)"; anything else → `result.message` or "Configuration saved to database!". Then `await loadSettings(orgCode)`. |
| Non-OK HTTP | "Failed to save configuration: <status>" |
| Network error | "Error connecting to the API to save settings" |
| `finally` (always, including after a failure) | Silent localStorage mirror: `handleSavePassMark`, `handleSaveTopQ`, `handleSaveStandards`, `handleSaveReevalAgent`, `handleSavePrompt`, `handleSaveStages` (`org_selected_stages_<org>`), `handleSaveAnswerScript` (`org_answer_script_type_<org>` + `org_predefined_mapping_<org>`), `handleSaveMetadata`, `handleSaveQNum`, `handleSaveStandalone` (`org_standalone_<org>` + `standalone_mode`) |

> The status comparison is case-sensitive and lowercase. A backend reply such as `S001` falls through to the
> generic success toast. Codes starting with `F` are not handled, so any 2xx response is reported as a success.

## Conditional rendering

| Condition | UI shown or hidden | Business meaning |
|---|---|---|
| `isAdmin` | Customer and Organization selects hidden | An admin should be scoped to one org (but see the admin-scoping risk) |
| `loadingOrgs` | Spinner instead of the cards | Organizations not yet known |
| `loadingSettings \|\| isSavingToDB` | `PageLoader` overlay | Configuration loading or saving |
| `isSingleIndividualStage \|\| isStandaloneMode` | Standalone Mode card | Standalone is only meaningful for a single raw stage |
| `segmentation \|\| indexing` | Segmentation/Indexing card | Candidate Info applies to both stages |
| `!isStandaloneMode` (inside that card) | Candidate Info Extraction | Standalone has no candidate-info page |
| `indexing` | Answer Script Structure | Page-to-question mapping belongs to Indexing |
| `answerScriptType === 'predefined'` | Mapping note and "Configure Mapping Details" | Predefined scripts need the mapping |
| `isPredefinedExpanded && predefined` | Mapping panel | — |
| `candidateInfoActive` | Amber banner "1.png is the Candidate Info page"; image 1 removed from the pool | Page 1 is reserved |
| `taggableImages.length < maxQ` | "cannot receive an image" warning | Too few images for the number of questions |
| `pendingPredefinedConfig` | "Some existing tags will be removed" dialog | Confirm a destructive change |
| `ocr && !isStandaloneMode` | OCR Configuration card | — |
| `evaluation` | Evaluation Thresholds card | — |
| `isPassMarkExpanded` / `isTopQExpanded` | Subject-wise grids | Per-subject overrides |
| `lockAnswerScriptToFlexible` | Predefined disabled, with a tooltip | Standalone does no advance tagging |
| `predefinedQuestionTotal` | Top N denominator read-only | Total = Max Questions |

## localStorage keys written by this section

| Key | Written when | Read by (outside this file) |
|---|---|---|
| `standalone_mode` | Standalone switch onChange; `loadSettings` (both paths); Save `finally` | `Login.tsx`, `OCREvaluation.tsx` (several places) |
| `org_standalone_<org>` | Standalone switch onChange; Save `finally` | Written by `Login.tsx`, not read elsewhere in `src/` |
| `org_selected_stages_<org>` | Save `finally` (`handleSaveStages`) | `Login.tsx` (to detect standalone OCR-only) |
| `org_seg_candidateinfo_<org>` | Candidate Info switch; removed on a stage drop or on Standalone | Only this section |
| `org_standards_count_<org>` / `_<sc>` | Standards switch (`'1'`/`'0'`); the Standalone effect writes `'0'`; load and save | Only this section |
| `org_ocr_metadata_<org>` / `_<sc>`, `org_ocr_qnum_<org>` / `_<sc>` | Load and save mirror (the toggles are commented out) | `org_ocr_qnum_*` is read by `OCREvaluation.tsx` (~L3846) as a fallback |
| `org_pass_mark_<org>` / `_<sc>` | Pass-mark inputs; load; save | Only this section |
| `org_top_questions_<org>` / `_<sc>` | Top N inputs; clamp effect; load; save | Only this section |
| `org_prompt_<org>` / `_<sc>` | Load; save | Only this section |
| `org_reeval_agent_<org>` / `_<sc>` | Agent switch; load; save | Only this section |
| `org_answer_script_type_<org>`, `org_predefined_mapping_<org>` | Save `finally` | Only this section |

`workflowStages` is **not** written by this file. `Login.tsx` and `OCREvaluation.tsx` write it from their own
`get-config-info` call.
