# Ouroboros Life: 5-tab restructure — full plan

This is the complete plan for the current restructure in progress, copied verbatim from the
Claude Code plan file (`velvety-petting-finch.md`) so any agent working in this repo has it —
that plan file lives outside this repo in a tool-specific location and won't be visible to
every session/tool. **This doc is the plan; `fork-status-and-handoff.md`'s "PICK UP HERE"
section tracks live status against it — check that first for what's actually done.**

## Context

Ouroboros Life (personal fork of SparkyFitness, `C:\dev\SparkyFitness`) has accumulated the
original upstream nutrition-tracker surface (food diary, macro goals) plus two large domains
that don't fit a single-purpose personal lifestyle app: clinical GLP-1/medication management
(titration, injection-site logging, symptom tracking) and a menstrual cycle/pregnancy/TTC suite.
Meanwhile the things this app is actually for — workouts, focus/habits, a daily supplement
stack, a Home command-center dashboard — are scattered across 9+ nav tabs alongside all of the
above.

Goal: collapse the app to exactly **5 tabs — Home, Workouts, Focus, Check-in, Settings** —
by hard-deleting (code + DB tables, confirmed by the user over hiding) food diary/nutrition-goals,
clinical medication tracking, and cycle/pregnancy/TTC; keeping a trimmed "Daily Protocols &
Supplements" slice of medications moved into a new Check-in tab; renaming Exercises→Workouts;
and wiring supplements + a "Life Pillars"/"Weekly Motivation Checkpoint" relabel into Focus/Home.

This reverses this app's established "hide, don't delete" precedent (Nutrition/Reports were
previously hidden, not removed) — confirmed deliberately by the user as a real cut this time,
not another hide, specifically to simplify the codebase. `SparkyFitnessMobile/` (the separate
React Native app in this repo) is explicitly **out of scope** — not touched.

Two rounds of Explore + one Plan-agent review mapped the actual dependency graph (not just the
obvious UI surface) before any code was touched — the ordering below exists specifically to
avoid the landmines that review surfaced: an FK from cycle/pregnancy into `medications`, a
report/AI-tool dependency web wider than "food vs. supplements," and an all-or-nothing RLS
reapply file.

## Execution order (each numbered step = one verified commit, run backend/frontend build+lint+test after each)

### 1. Decouple Home's water goal from `user_goals` (must land before the goals table is touched)
- Add a `water_goal_ml` field to wherever `usePreferences`/`PreferencesContext` already persists
  things like `water_display_unit` (frontend `src/contexts/PreferencesContext.tsx` + backend
  preferences table/route — small ALTER if the backing table needs the column).
- Surface it as a "Daily Water Goal" field in `src/pages/Settings/WaterTrackingSettings.tsx`
  (already the natural home — it edits sibling water preferences today).
- Rewire `useWaterGoalQuery`/`getWaterGoalForDate` (`src/hooks/Diary/useWaterIntake.ts`,
  `src/api/Diary/waterIntakteService.ts`) to read the new preference instead of
  `GET /goals/for-date`. Verify Home's `WaterCard` target still renders correctly.

### 2. DB migration + RLS (schema only — no service rewiring in this step)
One new migration file, **in this order** (order matters — confirmed FK dependency):
1. Drop cycle/pregnancy tables first: `cycles`, `cycle_daily_entries`, `cycle_settings`,
   `user_cycle_display_preferences`, `cycle_test_entries`, `pregnancies`,
   `pregnancy_kick_sessions`, `pregnancy_contractions`, `pregnancy_photos`,
   `pregnancy_checklist_state`, `health_appointments`. **These hold `prenatal_medication_id`/
   `supplement_medication_id` FKs into `medications` — must drop before altering `medications`,
   or the alter fails/orphans.** Explicitly do NOT touch `user_custom_moods` /
   `user_mood_display_preferences` (co-located in the same original migration but back the
   unrelated general Mood feature).
2. Drop clinical medication tables: `medication_pens`, `injection_entries`,
   `medication_titration_steps`, `user_custom_symptoms`, `user_custom_symptom_locations`,
   `symptom_entries`.
3. `ALTER TABLE medications DROP COLUMN` for clinical-only columns: `prescriber`, `pharmacy`,
   `rx_number`, `is_glp1`, `effectiveness_rating`, `photo_path`. Keep dosing/schedule columns
   and `is_supplement`. Leave `medication_types`/`medication_schedule_types`/
   `medication_route_types` lookup tables untouched (global reference data — unused
   injectable-route rows are harmless).
4. Drop food/nutrition/goals cluster: `foods`, `food_variants`, `food_entries`,
   `food_data_providers`, `food_entry_meals`, `food_favorites`, `meals`, `meal_foods`,
   `meal_plans`, `meal_plan_templates`, `meal_plan_template_assignments`, `meal_types`,
   `user_meal_visibilities`, `user_custom_nutrients`, `user_nutrient_display_preferences`,
   `user_nutrient_goal_preferences`, `user_allergen_preferences`, `goal_presets`,
   `weekly_goal_plans`, `user_goals` (only after step 1's water-preference migration lands).
- Update `db/rls_policies.sql`: remove all dropped tables from the hardcoded `ARRAY[...]`
  (~lines 58-103) **and** their individual `CREATE POLICY`/`create_*_policy(...)` blocks
  further down. **`utils/applyRlsPolicies.ts` runs this whole file as one query — one leftover
  reference to a dropped table fails RLS reapplication for every table, not just the broken
  one.** Before restarting the server, grep every dropped table name against
  `db/rls_policies.sql` and confirm zero hits.
- After deploying, spot-check `pg_class.relrowsecurity` on a couple of surviving tables the
  same way past sessions caught the Calendar-feed RLS miss (see handoff doc's known gotchas) —
  don't just trust the file parsed without error.

### 3. Server-side code cleanup
- **Delete outright**: `routes/foodRoutes.ts`, `foodCrudRoutes.ts`, `foodEntryRoutes.ts`,
  `foodEntryMealRoutes.ts`, `foodIntegrationRoutes.ts`, `mealRoutes.ts`, `mealTypeRoutes.ts`,
  `mealPlanTemplateRoutes.ts`, `goalRoutes.ts`, `goalPresetRoutes.ts`,
  `weeklyGoalPlanRoutes.ts`, `nutrientDisplayPreferenceRoutes.ts`,
  `nutrientGoalPreferenceRoutes.ts`, `customNutrientRoutes.ts`, `allergenPreferenceRoutes.ts`,
  `adaptiveTdeeRoutes.ts`, `v2/foodRoutes.ts`, `v2/goalPresetRoutes.ts`, `v2/cycleRoutes.ts`,
  `v2/pregnancyRoutes.ts`, `v2/symptomRoutes.ts` — and their backing services/repositories
  (the full food/meal/goal service+model cluster, `glp1Service.ts`, `medicationPenRepository.ts`,
  `injectionRepository.ts`, `titrationRepository.ts`, `symptomRepository.ts`,
  `cycleService.ts`/`cycleRepository.ts`, `pregnancyService.ts`/`pregnancyRepository.ts`).
  Also delete `services/dailySummaryService.ts` + `routes/dailySummaryRoutes.ts` (single-date
  variant) outright — confirmed its only consumer is the frontend `Diary.tsx`/`DailyProgress.tsx`
  being deleted in step 4; grep for any other consumer first before deleting, just in case.
- **Keep `models/supplementSql.ts`** — shared SQL fragment for supplement-dose×nutrient math —
  but rewire its remaining caller (previously also called from the now-deleted `foodMisc.ts`).
- **Trim, don't delete** `routes/v2/medicationRoutes.ts`: remove the pens/injections/titration/
  glp1-serum-curve/site-suggestion endpoints, keep list/create/update/delete medication,
  entries CRUD, schedules CRUD, display-preferences.
- **Isolated sub-step (separate verified commit within this phase, per Plan-review flag)**:
  rewire `services/reportService.ts` and `services/dailySummaryRangeService.ts` (NOT
  `dailySummaryService.ts`, which is deleted above) to drop all food-nutrient aggregation while
  preserving supplement-adherence and other non-food metrics (weight/sleep/workout volume).
  `reportService.ts` currently imports `symptomRepository`/`injectionRepository`/
  `titrationRepository` directly — remove those imports too. Also audit every consumer of
  `services/goalService.ts` (wraps `goalRepository`/`weeklyGoalPlanRepository`/
  `goalPresetRepository`, drives `adaptiveTdeeService`/BMR calorie-balance math) before
  `user_goals` is dropped — confirm nothing in the weight-trend/TDEE logic being kept in
  Reports silently depends on it; delete `goalService.ts`/`adaptiveTdeeService.ts` once
  confirmed clear, or extract the non-nutrition pieces if something does depend on them.
  Verify the (still-hidden-from-main-nav, delegate-permission-gated) `/reports` view and
  family-sharing delegate flow still work before moving on.
- **AI/MCP tools**: delete `ai/tools/foodTools.ts`, `mealPlansTools.ts`, `goalTools.ts` + their
  `ai/tools/schemas/*` — but first relocate `getWaterHistoryRows` out of `foodTools.ts` (water
  history isn't food-specific; `ai/tools/reportTools.ts` imports it and would otherwise break).
  Deregister `buildFoodTools`/`buildGoalTools`/`buildMealPlanTools` in `ai/tools/index.ts`.
  Trim `ai/tools/medicationTools.ts` + `ai/tools/schemas/medications.ts`: remove `log_injection`/
  `list_injections` actions and injection-only fields; **keep everything else working
  unchanged** — `sparky_manage_medications` is relied on by a separate Hermes morning-briefing
  integration for supplements-due reminders.
- **Small fix**: `services/demoSeedService.ts` references the clinical-only medication columns
  being dropped in step 2 (`prescriber`, `pharmacy`, `is_glp1`, etc.) — update its seed data.
- **Tests**: delete test files for everything deleted above; update rather than delete the
  ones flagged as touching surviving code (`dailySummarySupplements.test.ts`,
  `reportSupplementScaling.test.ts`, the core-only `describe` blocks in
  `medicationRoutes.test.ts`, `waterEstimatedGoalAdjustment.test.ts`/`waterGoalExclusivity.test.ts`,
  `tests/rlsPermissionMatrix.integration.test.ts`).
- Run `tsc`/`eslint --max-warnings 0`/full backend test suite clean before moving to step 4.

### 4. Frontend cleanup — NOT STARTED, this is where the next session picks up
- Delete `src/pages/Diary/`, `src/pages/Goals/`, `src/pages/Cycle/` in full, plus the
  clinical-only medication components (`Glp1Coach.tsx`, `Glp1TitrationManager.tsx`,
  `InjectionSiteBodyMap.tsx`, `SymptomDashboard.tsx`, `SymptomLogForm.tsx`).
- Remove their route declarations + lazy imports in `src/App.tsx` (`diary`, `goals`, `cycle`,
  and the old top-level `medications` route once its content is relocated in step 5).
- Rename Exercises→Workouts: route `exercises`→`workouts` in `App.tsx`; update the 3
  `MainLayout.tsx` references (desktop tab, mobile tab, `exercise.title` label) plus
  `HomeChecklist.tsx`'s 2 `navigate('/exercises')` call sites, `AgendaCard.tsx`'s 1 call site,
  and the `WorkoutPresetsManager.test.tsx` reference. (Backend `/exercises` API path is
  unrelated — no change needed there.)
- Update nav in all 3 places in `src/layouts/MainLayout.tsx` (`availableTabs`,
  `availableMobileTabs`, `addCompItems`) to the new 5-tab set: desktop shows Home, Workouts,
  Focus, Check-in, Settings (+ Admin if admin); mobile bottom bar stays Home, Workouts,
  Add(+), Settings (unchanged shape, just the rename); the "+" sheet now offers Check-in and
  Focus only (Diary/Goals/Cycle items removed; Medications item removed since it's no longer
  a standalone destination). Also remove `CycleSettings.tsx`'s accordion section from
  `SettingsPage.tsx`'s "wellness" tab, and review/trim the "nutrition-diet" tab's other
  sections (`NutrientDisplaySettings`, `NutrientGoalDirectionSettings`,
  `CustomNutrientsSettings`, `AllergenSettings`, `CalculationSettings`, `MealTypeManager`) —
  collapse or remove that tab if nothing user-relevant remains in it.
- i18n: don't hand-edit all locale files by hand (there are ~35 under `public/locales/`).
  First do one manual, verified pass over `public/locales/en/translation.json` to build a
  confirmed delete-list — it's wider than the obvious blocks (`medications` trimmed not
  removed, `goals`, `diary`, `foodDiary`, plus `foods`, `nutrition`, `foodSearchDialog`,
  `enhancedFoodSearch`, `foodDatabaseManager`, `mealCard`, `mealManagement`, `mealBuilder`,
  `mealPlanCalendar`, `mealPlanTemplateForm`, `customFoodForm`, `customNutritionForm`,
  `mealCreation`, `mealTypeManager`, `food`, `foodPhoto`, `editFoodEntry`, `dailyProgress`,
  `foodCsvImport`, `diaryCsvImport`, `copyFoodEntryDialog`, `openFoodFactsContribution`,
  `cycle`, `pregnancy` — note `reports`/`nutritionCharts` blocks likely mix food and
  workout/sleep content and need surgical nested-key pruning, not top-level deletion) + the
  `nav.*` keys to prune. Then grep the codebase for `t('<eachDeletedKey>` to confirm no
  orphaned references, then run that same verified key-list as a small Node script against
  all locale files under `public/locales/`.
- Tests: delete/update the test files identified for Diary/Goals/Cycle/clinical-medications
  (`AddMedicationDialog.test.tsx`, `MedicationReports.test.tsx`, `TodayMedications.test.ts`,
  `Glp1Coach.test.tsx`, `DailyGoals.test.tsx`, plus the broader food/diary test set). Triage
  rather than delete the supplement-adjacent util tests (`filterMedsBySubtype`,
  `supplementDoseScaling`, `positiveDoseOrNull`, `visibleDoseCards`, `addSupplementTotals`).
- Run frontend `tsc`/`eslint`/test suite clean before moving to step 5.
- **Note for whoever picks this up**: the backend (steps 1-3) is already committed and fully
  green, so the frontend right now still references some backend routes that no longer exist
  (e.g. `/diary`, `/goals`, `/medications` pens/injections/titration endpoints) — this is
  expected mid-restructure breakage, not a regression to chase. The frontend won't typecheck
  cleanly again until this step actually removes those callers. Don't try to "fix" the
  frontend by restoring backend routes.

### 5. New wiring
- **Check-in "Protocols" tab**: relocate the kept medication components (`ScheduleManager.tsx`,
  `TodayMedications.tsx`, the Log/Cabinet tabs minus Symptoms) into a new tab inside
  `src/pages/CheckIn/CheckIn.tsx` (alongside existing Measurements, Fasting & Mood, Sleep,
  Photos), rebranded "Daily Protocols & Supplements" in copy/i18n. Delete the old top-level
  `/medications` route once this lands.
- **"Today's Supplements" on Home**: follow the exact pattern `HomeChecklist.tsx` already uses
  for Focus's daily checklist (hook → snapshot object → `Collapsible`/`Card` section → row
  component, mirroring `useTodayFocusSnapshot`/`HabitRow`). New hook (e.g.
  `useTodaySupplementSchedule(date)`) backed by a small new aggregation reusing the existing
  medication-schedule/entry repository methods kept in step 3 — no changes needed to the
  existing Focus hooks, this is a sibling data source.
- **Focus "Life Pillars" relabel**: rename "Domain" → "Life Pillar" in UI copy + i18n only —
  confirmed the current `focus_domains` model is a flat `{id, name, color}` tag with no
  hierarchy, so this is pure relabeling, not a schema change.
- **Focus "Weekly Motivation Checkpoint"**: new minimal section on `FocusPage.tsx` — no
  existing structure for this. Build it by reusing existing `timeframe: 'weekly'` focuses +
  the existing checkin mechanism (a dedicated card listing/editing weekly-timeframe focuses
  with a reflection check-in), composed from primitives that already exist rather than new
  data model. **Flag to the user at review time if this minimal interpretation isn't what
  they meant** — there was no existing precedent for this feature to build from.

### 6. Deploy + live-verify on Pi5
Per this repo's own established process (`fork-status-and-handoff.md`'s repeated lesson: a
clean build has never once been sufficient proof here) — rebuild both Docker images with
`--no-cache`, `--force-recreate`, then on a disposable test account at 390px in both themes
confirm: the 5-tab nav renders correctly on desktop and mobile; Water quick-add still works
against the new preference-based goal; a supplement can be toggled from the new Check-in
Protocols tab and from Home's new "Today's Supplements" section and stays in sync; workout
finish still auto-checks the habit and updates the metric card; the Calendar agenda card still
renders and "Launch Workout" still works; Focus's Life Pillars/Weekly Checkpoint render;
Settings' remaining tabs make sense with Cycle/nutrition sections gone; a full page reload
doesn't 404 on `/exercises` deep links if any exist. Spot-check `pg_class.relrowsecurity` on a
couple of surviving tables per step 2's note.

### 7. Update the handoff doc
Update `agent-docs/fork-status-and-handoff.md`'s "Architecture decisions already made" section
to record this as a deliberate reversal of the prior "hide, don't delete" entries for
Nutrition/Reports/Medications/Cycle — supersede those bullet points rather than leaving them
contradicting the new state, and add a "PICK UP HERE" entry noting what's newly built
(Protocols tab, Today's Supplements, Life Pillars, Weekly Motivation Checkpoint) so a fresh
session doesn't need to rediscover this restructure from the diff alone.

## Verification
- After steps 3 and 4: backend and frontend `tsc` / `eslint --max-warnings 0` / full test
  suites green (excluding the two pre-existing unrelated gaps already documented in the
  handoff doc: `translationKeysCoverage.test.ts`'s ~12 missing keys, `WorkoutPlaybackPage.test.tsx`'s
  i18next module-loading error).
- Grep-based checks called out inline above (dropped table names against `rls_policies.sql` —
  already done for step 2; deleted i18n keys against `t('...')` call sites — needed in step 4)
  before restarting/deploying.
- Step 6's live-verification on the real Pi5 deployment is the actual acceptance test — this
  codebase's history shows build success alone has repeatedly hidden real breakage.

## Open item to flag at review
The "Weekly Motivation Checkpoint" has no existing precedent in this codebase — the design
above is the best minimal interpretation (weekly-timeframe focuses + a reflection check-in),
not a confirmed spec from the user. Worth a quick look once built in case they pictured
something more specific (e.g. a prompt/ritual rather than a list view).
