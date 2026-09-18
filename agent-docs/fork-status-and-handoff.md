# Personal fork status & handoff

This is a personal fork of `CodeWithCJ/SparkyFitness`, being turned into a lifestyle/habit app for one user (Isaac, `3daysl8@gmail.com`). This doc is a running handoff for picking the work back up in a fresh session — update it as things change, don't let it go stale.

## ⚠️ PICK UP HERE

**Status as of 2026-09-18 (later still) — dark biometric redesign, Phase 2 of 6, uncommitted**:
full plan at `C:\Users\ICPET\.claude\plans\i-am-redesigning-my-fancy-clarke.md`; design spec at
`agent-docs/design-system.md`. Phase 1 (tokens, dark-only cutover, `Card` primitive) landed as
commit `2399c91a3` on `main` — see the demoted entry below for its own detail. **Phase 2 (Today/Home
dashboard rebuild) is implemented and fully validated locally — `pnpm run validate`, full test suite
137/137 suites (1180/1180 tests), and a `vite build` all green — but NOT yet committed.**

**What Phase 2 built**: the first three shared primitives, each landing with its first real caller
per knip's zero-unused-exports rule, all in `SparkyFitnessFrontend/src/components/biometric/`:
- **`SectionCard`** — replaces the `Collapsible > Card > CardHeader(trigger) > CollapsibleContent >
  CardContent` skeleton that was hand-copied across 6 Home cards. Manages its own open/closed state
  (controlled or uncontrolled), takes `title`/`icon`/`badge`/`summary`/`action`/`loading`.
- **`DataRow`** — the flat "icon + label + value + trailing" row, replacing hand-rolled versions in
  `DailyCheckpointCard` and `SupplementsSnapshotCard`. Renders no card/border of its own; parents
  supply separation via `divide-y divide-border`. **Not forced onto every row** — `AgendaCard`'s
  `EventRow` (three-part time/title/location content, one has a real clickable link) and
  `ToDoCard`/`HabitCard`'s rows (custom animated `CheckTarget` checkbox, domain-colour left border)
  kept their own markup but were flattened to match DataRow's visual grammar (no border/bg, `divide-y`
  parent) rather than being force-fit into an API that didn't suit their content shape.
- **`MetricCard`** — two layouts: `wide` (label+value left, ring right — used by the vitals HUD) and
  `tile` (ring on top, centered — used by the Home Workout/Water/Sleep row, replacing three
  bespoke-but-consistent hand-rolled tiles). Added `metric="warning"` (maps to `--status-moderate`)
  for the missed-workout state, and `emptyBorder` (mutes ring/icon/value to `text-muted-foreground`,
  dashed border) for CTA-only tiles like "+ Start Workout".

**New `DailyStatusHero.tsx`** (`src/pages/Home/`) absorbs the old inline `WeekStrip`/`DayPill` as its
date control, per the plan. Its headline ring uses **today's focus/habit completion %** (from
`useTodayFocusSnapshot`, a cache hit — HabitCard/ToDoCard/DailyCheckpointCard already call the same
query key for the same date, so this adds zero network requests), not a wearable-only score — it's
always meaningful regardless of Garmin connection. A small secondary badge shows
`training_readiness_score` when wearable data exists for the day, without gating the hero on it.
**This was the plan's own flagged open question ("worth deciding with real data on screen") — now
built with the interim choice described above; worth a look once live to confirm it's what Isaac
pictured**, per that question's own caution.

**Full page reorder** (`HomeChecklist.tsx`): hero → metric tiles/missed-workout nudge → vitals HUD →
cycle snapshot (moved up next to the HUD — both are "body state today" signals) → supplements →
agenda → daily checkpoint → focus banner (now a lightweight strip, not a heavy gradient card) →
to-do list → habits. `FocusBanner` visually "folds in" ahead of the daily-actions section as the
plan specified, though the `/focus` nav tab itself hasn't been retired yet — that's Phase 3.

**`DailyHealthMetricsCard.tsx` rebuilt** — this was the worst nesting example in the app
(`Collapsible > Card > CollapsibleContent > CardContent > grid > 7 more bordered tile-divs`, each
with its own rainbow icon colour). Now a single flat grid, no per-tile border/background, icons
monochrome except body battery's progress bar (which keeps a real 3-state status colour via the new
`--status-optimal/moderate/low` tokens — a genuine status indicator, not decoration).
`CycleSnapshotCard` — the plan's named "worst offender" with 20 saturated Tailwind colour classes —
is now a single phase-colour dot plus neutral card, per spec.

**A real bug fixed along the way, not hypothetical**: converting `AgendaCard`'s empty state to the
shared `EmptyState` component required giving it an action (that component's `actionLabel`/`onAction`
props are required, not optional) — wired to `/settings?tab=developer-integrations&section=calendar-feeds`,
a real destination (confirmed against `SettingsPage.tsx`'s `SECTION_TO_TAB_MAP`, which doesn't
actually contain a `calendar-feeds` entry — passing both `tab` and `section` explicitly sidesteps
that gap rather than depending on it).

**Two real regressions caught by the existing test suite, not by inspection** — worth the reminder
that "looks right" isn't verification here: (1) `WorkoutCard`'s "+ Start Workout" CTA text was
shortened to "+ Start" for the narrower tile, silently breaking `getByRole('button', { name: /\+
Start Workout/ })` in its own test — reverted to the full string. (2) The new `DailyStatusHero` calls
`useDailyHealthMetrics` unconditionally, which `HomeChecklist.test.tsx` didn't mock — every one of
its 6 tests crashed with "No QueryClient set" until a mock was added there (now documented inline in
that test file). Both were caught by `pnpm test`, not by reading the diff — this project's `pnpm run
validate` alone (typecheck/lint/format/knip) would not have caught either one.

**4 new i18n keys added** to `public/locales/en/translation.json` (`agenda.manageFeeds`,
`home.readiness`, `home.todaysFocus`, `home.intentionsComplete`) to satisfy
`translationKeysCoverage.test.ts` — that checker only catches string-literal `t('key', ...)` calls,
so `DailyStatusHero`'s dynamic `t(greeting.key, greeting.fallback)` calls (4 more: `home.greeting.
{night,morning,afternoon,evening}`) went undetected by the checker but were added anyway since
they're real new user-facing text; only the other 34 non-English locale files are still missing all
8 (harmless — `t()`'s second argument is the fallback for exactly this case, so English strings
render correctly regardless).

**Not yet done**: uncommitted, unpushed, undeployed — same standing caveat as Phase 1, and the real
acceptance test (live at 390px on Pi5) still hasn't run for either phase. Phase 3 (Check-in nav tab,
global shell restyle, Sleep/Fasting promotion, `FastingTimerRing`/`FastingZoneBar`/water-bottle
rewrites) hasn't started.

---

**Previous entry, 2026-09-18 (earlier that day) — Phase 1 of the redesign** (commit `2399c91a3` on
`main`):

**Status when written (superseded by the Phase 2 entry above)**: full plan at
`C:\Users\ICPET\.claude\plans\i-am-redesigning-my-fancy-clarke.md`. The app is being
rebuilt from stock shadcn light-mode into a Whoop/Oura-style dark biometric interface — deep matte
canvas, elevated charcoal cards, hairline borders, zero shadows, accent colour reserved for data.
Rollout is phased (1 Foundation → 2 Today → 3 Check-in → 4 Workouts → 5 Progress → 6 Focus+Settings),
each phase its own deployable commit. **Phase 1 (tokens + Card primitive + dark-only cutover) is
implemented and fully validated locally — `pnpm run validate` and the full test suite (137/137
suites, 1180/1180 tests) both green — but has NOT been committed or deployed yet.** Design spec is
now durable at `agent-docs/design-system.md`.

**What Phase 1 actually touches**: `SparkyFitnessFrontend/src/index.css` (`--card` now genuinely
elevated above `--background`, a `--primary`/`--metric-recovery` mint replacing the light-mode
default, `--surface-2`/`--surface-3` wells, `--border-strong`, `.metric-num` utility, self-hosted
`@fontsource-variable/inter`); `components/ui/card.tsx` (`shadow-sm` removed, `CardTitle` becomes the
small-caps label spec instead of `text-2xl` — this one change reshapes all 111 files that import
`Card`, without touching any of them); a full dark-only cutover (`src/lib/sleep/whoop-colors.ts`,
`src/contexts/ThemeContext.tsx`, `src/components/ThemeToggle.tsx` all deleted; `App.tsx`/
`MainLayout.tsx` un-wrapped; `.dark` hardcoded on `<html>`; 5 Sleep-report chart files that read
`resolvedTheme` off the deleted context now hardcode their dark-branch colours; `manifest.json` +
`vite.config.ts`'s inline PWA manifest + a new `theme-color` meta all re-pointed to `#0A0D12` so a
PWA launch no longer flashes white).

**A real bug self-discovered and fixed, not yet documented anywhere else**: `--border` is now an
alpha-bearing value (`0 0% 100% / 0.06`), and Tailwind v4 opacity modifiers on a theme colour compile
to `color-mix(in srgb, hsl(var(--border)) N%, transparent)` (confirmed by inspecting the actual
compiled CSS from a `vite build`, not assumed) — the modifier multiplies against the token's own
already-baked-in 6% alpha rather than erroring, so every existing `border-border/50`-style usage
(55 occurrences across 23 files) would have rendered at roughly 3-5% opacity instead of the visible
divider it used to be. Fixed by converting all of them to the new `border-border-strong` token
(12% alpha, no modifier) via a scoped sed pass, re-validated after. **Any new code should never put
a Tailwind opacity modifier on `border-border` (or `bg-border`/`divide-border`) — use
`border-border-strong` instead.**

**New gotcha for the Known Gotchas list below**: running `pnpm run format` (prettier, no path filter)
repo-wide on this Windows/Kingdom checkout made `git status` show ~600 files as modified, even though
`git diff --shortstat` showed real content changes in only ~39 of them — `core.autocrlf=true`
colliding with `.gitattributes`' `* text=auto eol=lf` makes prettier's writes look like changes to
every file it touches, not just the ones it actually reformatted. Recovered by diffing
`git status --short` against `git diff --name-only` and `git checkout --pathspec-from-file=` on the
set difference (files with zero real diff) — see the Known Gotchas entry for the exact recipe. Scope
`prettier --write` to specific files/dirs on this box instead of running it bare across the repo.

**Not yet done**: this phase hasn't been committed, hasn't been pushed, and hasn't been deployed to
Pi5. No live-verification at 390px has happened yet — that's the real acceptance test per this doc's
own repeated lesson, and it hasn't run. Phases 2-6 (the actual page-by-page visual rebuild — Today
dashboard, Check-in nav promotion, Workouts, Progress charts, Focus/Settings) haven't started; none
of the new shared primitives (`MetricCard`, `DataRow`, `SectionCard`, `SegmentedControl`,
`GoalCascade`, `chartTheme`) exist yet — each lands in the same commit as its first real page caller,
per knip's zero-unused-exports rule, starting Phase 2.

---

**Previous entry, 2026-09-18 (earlier that day)** (commits `f7a668268`, `172b5fc91`, `4b59cb056` on
`main`):

**Kingdom was 13 commits stale** (Isaac also builds this app in Antigravity, which pushes directly
— Kingdom's clone isn't automatically in sync). Fast-forwarded `018f546b8` → `f417d3d25` clean, zero
line-ending churn despite a new `.gitattributes` (`text=auto eol=lf` normalizes on checkout, doesn't
touch history), `pnpm install --frozen-lockfile` needed (server gained a direct
`@simplewebauthn/server` dep the custom `dynamicPasskey` plugin needs). **Always check
`git ls-remote origin main` before trusting a local Kingdom clone is current** — this cost a wasted
exploration pass earlier this session before being caught.

**Garmin Connect integration — root-caused and fixed. It was never actually running.** Isaac tried
to connect and got nothing. Root cause, found via SSH + `docker logs`: `getaddrinfo ENOTFOUND
sparkyfitness-garmin` — the backend/frontend were live and the app's Garmin code (routes, DB schema,
UI) has been fully built for a while, but the `sparkyfitness-garmin` microservice **container had
never been deployed**. The upstream `docker-compose.prod.yml` template ships that service
commented out behind a stale `# Garmin integration is still work in progress. Enable once table is
ready.` comment — true for upstream, not for this fork, where the table (`external_data_providers`'
token columns, migration `202508201215`) and the whole integration have been ready for a while.
Nobody had ever uncommented it on the live Pi5 deploy.

**Fix**: built `sparkyfitness_garmin:custom` on Pi5 (`--no-cache`, context `SparkyFitnessGarmin/`,
`docker/Dockerfile.garmin_microservice` — matches the CI workflow's own build args, *not* the repo-
root context the server/frontend Dockerfiles need). Uncommented the service block + the frontend's
`depends_on` in `/home/pi1/sparkyfitness/docker-compose.yml` (the **live** compose file — it's a
manually-maintained copy that has already diverged from the repo's tracked
`docker/docker-compose.prod.yml` in several ways: `:custom` image tags instead of upstream `:latest`,
`restart: unless-stopped` vs `always`, a host-IP-pinned frontend port, and the extra
`sparkyfitness-tailscale` sidecar — so this edit was made directly via SSH, not as a repo commit).
`.env`'s `GARMIN_MICROSERVICE_URL`/`GARMIN_SERVICE_PORT`/`GARMIN_SERVICE_IS_CN` were already correctly
set, nothing to change there. `docker compose up -d sparkyfitness-garmin` — no restart of any other
container needed.

**Verified end-to-end, not just "container is up"**: from inside the backend container,
`wget http://sparkyfitness-garmin:8000/` succeeded (the exact DNS name that was failing). Isaac then
logged in for real through the app (email/password → MFA code), confirmed via the microservice's own
logs (`INFO:routes:Successfully resumed Garmin login`). A manual sync a few minutes later pulled 8
real days of history straight from Garmin Connect: `daily_health_metrics` gained steps/distance/
floors/body-battery/stress/resting-HR/VO2-max/training-readiness rows, `exercise_entries`/
`sleep_entries` gained real rows too — confirmed by querying the DB directly, not by trusting the UI.

**A real, separate discovery mid-session, not a fix — worth knowing before re-investigating "why
don't Garmin steps show up anywhere"**: they already did. `garminHealthProcessor.ts` writes daily
wellness data (steps included) to `daily_health_metrics`, which **nothing in the frontend reads at
all** (confirmed: zero references to `total_steps` anywhere in `SparkyFitnessFrontend/src`) — but a
*second*, independent Garmin pipeline (`integrations/garminconnect/garminMeasurementMapping.ts` →
`parseGarminHealthMeasurements`, called from both `garminService.ts` and `garminRoutes.ts`'s manual-
sync route) already maps `steps` (and weight/body-fat/neck/waist/hips/muscle-mass/bone-mass/BMR) into
`check_in_measurements`, which **is** read — by `Reports → Measurements → Daily Steps` chart
(`MeasurementChartsGrid.tsx`). Verified directly against the DB: values identical to what synced.
**Don't assume "no frontend reads this specific column" means the data isn't visible anywhere** —
this codebase has more than one write path for the same underlying Garmin payload; check both before
concluding something needs building.

**A real bug found, not yet fixed — deliberately out of scope this session**:
`sync_frequency`'s `'hourly'` and `'daily'` options (Garmin card → Edit → Sync Frequency, same field
exists for Withings/Fitbit/Oura/Strava/Polar/Google Health too) are **indistinguishable to the
scheduler**. `SparkyFitnessServer.ts`'s per-provider `cron.schedule('0 * * * *', ...)` blocks
(~line 698 onward) only check `provider.sync_frequency !== 'manual'` — picking "Daily" still syncs
every hour. Not urgent (more-frequent-than-promised, not less), but the label is misleading across
every provider that has this field, not just Garmin. **Isaac's own Garmin connection is still set to
`manual`** — no auto-sync configured yet; he'd need to switch it to Hourly (the honest label, given
the bug above) for it to sync without a manual tap.

**Garmin's provider-card "Token Expires" display was also misleading, fixed**: it decoded the `exp`
claim of a short-lived session JWT (`di_token`, ~24h window observed) captured at login, not the
long-lived OAuth1 credential that actually gates continued access — which the backend already
re-persists a refreshed pair for on every sync (`garminConnectService.ts`'s `new_tokens` handling,
confirmed live: DB `token_expires_at` moved from ~24h out to further out after a sync, no re-login
needed). `googlehealth` already got this exact treatment in `ProviderCard.tsx` with the comment
"access tokens auto-refresh; showing 1h expiry misleads users" — Garmin was missed; now matches.

**Five mobile-UI fixes, screenshotted and diagnosed from an actual phone**, all deployed:
- **Sleep timeline overflow** (`SleepTimelineEditor.tsx`): hourly axis labels were rendered one per
  hour with no cap, overlapping into unreadable garbage and running off the right edge on a long
  session. Now thinned adaptively (max ~7 labels, "nice" step sizes), first/last labels clamp inside
  the box via `transform`, container gets `overflow-hidden`. The Awake/REM/Light/Deep/Clear button
  row now `flex-wrap`s instead of running the 5th button off-screen.
- **Today's Supplements card** (`SupplementsSnapshotCard.tsx`) is now collapsible — same
  `Collapsible`/chevron pattern `HabitCard.tsx`/`ToDoCard.tsx` already established; it was the one
  Home card that hadn't gotten it, and it's the one whose list actually grows unbounded.
- **To-Do list party emoji removed** (`ToDoCard.tsx`): 🎉 replaced with a `CheckCircle2` lucide icon
  in both empty states, matching the app's otherwise-monochrome iconography. `EmptyState.tsx` now
  takes an optional `icon` prop alongside `emoji` so every other caller is unaffected.
- **Workouts "Quick Start" button moved above the fold** (`WorkoutsRoutinesTab.tsx`): it rendered
  third, after `ActiveProgramWidget`/`PlannedWorkoutsList`, both of which can run long — now renders
  immediately below the page's tab header.
- **Focus & Motivation pillar cards collapsible** (`GoalCascadeCard.tsx`): each Life Pillar card, same
  pattern again — a pillar with a long daily-habit list no longer forces the whole page to scroll.
- Same pass also fixed the "Note from CodewithCJ" box shown on every provider settings card
  (`ProviderCard.tsx`) — a non-wrapping `flex` row that ran off the right edge on a phone; added
  `flex-wrap`.

**New Home card: Daily Wearable Health Summary** (`WearableHealthCard.tsx`, new). Revives
`DailyHealthMetricsCard.tsx`, which turned out to be dead code — fully built (body battery, stress,
resting HR, VO2 max, training readiness tiles) but **never mounted anywhere**; its own comment
referenced a `DailyProgress.tsx` sidebar page that doesn't exist in this fork (pre-dates the Home
redesign). It's the only UI that reads `daily_health_metrics` at all. Stripped its own `Card` shell
(now pure tile-grid content) so the new `WearableHealthCard` wrapper can own a `Collapsible`+`Card`
shell matching every other Home card this session touched. Placed right after the Workout/Water/
Sleep tile row — continues that "today's vitals" story before the app moves on to check-ins/to-dos;
Reports already owns the historical/trend version of body battery (`BodyBatteryCard`), so this is
deliberately the today-snapshot counterpart, not a duplicate. Added the three tiles the dead
component never had: **Steps**, **Distance** (respects the km/miles preference via the existing
`convertDistance` helper from `PreferencesContext`), **Floors**. Invisible when there's no wearable
data for the date, same rule as `SupplementsSnapshotCard`. New test coverage:
`WearableHealthCard.test.tsx` (empty state, populated tiles, missing-data fallback).

**Verified**: `tsc -b` clean, `eslint --max-warnings 0` clean, full frontend suite **137 suites /
1180 tests** passing, `knip` clean (no longer flags `DailyHealthMetricsCard`/`useDailyHealthMetrics`
as unused — the whole point of reviving them). Deploy was **frontend-only** — none of this session's
changes touched `SparkyFitnessServer/`, so the backend/DB/Garmin-microservice/Tailscale containers
were never restarted.

**Deployed to Pi5**: `pg_dump -Fc` backup taken and verified restorable (`pg_restore -l` inside the
db container after `docker cp`, 998 TOC entries) despite zero migration this session (same "cheap
insurance" policy every phase has followed) — also specifically protects the Garmin data that had
just synced. Frontend image tagged `sparkyfitness:pre-f417d3d25` before rebuild. `--no-cache` build
of the frontend only from `/home/pi1/sparkyfitness-build`, confirmed the built image's
`locales/en/translation.json` actually contains the new `dailyHealthMetrics.steps` key
(`docker create`+`docker cp`+grep) before deploying. `docker compose up -d --force-recreate
sparkyfitness-frontend` (only), confirmed healthy in ~12s, confirmed the live site's served
`index-*.js` hash matches the freshly built image's exactly, confirmed backend `/api/health` still
`{"status":"UP"}` throughout (never touched). `docker builder prune -f` after.

**Pi5 SSH still has no `~/.ssh/config` alias** (same gotcha as before) — `ssh -i
~/.ssh/id_ed25519_pi5 pi1@100.103.152.66` every time; the backup-dir permission workaround
(`sudo bash -c '... > backup/file.dump && chown pi1:pi1 ...'`) still applies too, same as documented
below in Known Gotchas.

---

**Previous entry, 2026-09-17** (commit `520ee452c` and earlier, passkey RP ID fix + Home habit
redesign):

**Status as of 2026-09-17:**
- **Home Habit Tracking, Focus & Goals Reminder, and Daily Accountability Checkpoint Redesign:** FULLY COMPLETED.
  - Extracted modular `HabitCard.tsx` (completion progress bar, Life Pillar color tags/filters, streak counters with flame badges, quick reflection note logging modal, numeric progress controls, fixed weekday logic).
  - Built `FocusBanner.tsx` anchoring active Weekly Focus and Life Pillars directly on Home with 1-tap jump to `/focus`.
  - Built `DailyCheckpointCard.tsx` aggregating daily tracking across habits, workouts, hydration, sleep, supplements, and biometric/mood check-in with celebratory completion states.
  - Extracted `SupplementsSnapshotCard.tsx` into a clean standalone component.
  - Refactored `HomeChecklist.tsx` from 1,079 lines into a clean layout orchestrator.
  - Fixed `recurrence_days_of_week` empty-array bug on both `HabitCard.tsx` and `FocusPage.tsx` (`size > 0 && size < 7`), with UI validation preventing saving with 0 selected days.
  - Full test suite passing (128 test suites, 1,143 unit tests) and `pnpm run validate` clean.

**Next Priority:**
**Fix the passkey RP ID bug.** Production login console-errors on passkey verification:
`[Better Auth] Error verifying passkey SecurityError: The RP ID "100.103.152.66" is invalid for this domain`.
Root cause confirmed: `SparkyFitnessServer/auth.ts:166-182` derives `passkeyRpID` **once at server startup** from `process.env.BETTER_AUTH_URL` (preferred) or `SPARKY_FITNESS_FRONTEND_URL`, via `new URL(...).hostname`, then passes it to `passkey({ rpID: passkeyRpID, rpName: 'SparkyFitness', ... })` at line 701-703 — a single fixed value for the whole process, so only one origin can ever validate.
Real fix: derive `rpID` per-request from the incoming `Host` header (better-auth/simplewebauthn support this) rather than one env-derived constant at startup.
List already got a dedicated redesign (see "To-Do List card redesign" below) and Workouts got its
own (see "Workouts tab redesign" below); the **habit-tracking half of Home never has** — only
incremental fixes (e.g. the `CheckTarget` checkbox-sizing pass). That gap is the actual ask.

**Design precedent to match, from the two past redesigns below** — pure Tailwind + shadcn/ui, no
new libraries, ever: extract a shared control rather than duplicating per-card (`DayWeekToggle.tsx`
was pulled out specifically so Agenda/To-Do cards can't visually drift apart); split a monolithic
page file into focused subcomponents as part of the redesign, not after (`ToDoCard`/`CheckTarget`/
`EmptyState` were extracted from `HomeChecklist.tsx` during its own redesign — the same file is
still 1,078 lines because the habit-checklist half of it was never done); no repeated section-header
icons on dashboard cards (plain title + count/summary, icons reserved for metric tiles + top nav);
verify live at both 390px mobile and desktop, light and dark, in the real dev Docker stack before
calling it done — a build succeeding is not verification (this doc's own Known Gotchas list a real
off-screen-button bug from Phase 3 of the Workouts redesign that only live-verification caught).

**General polish, fold in opportunistically rather than as a separate pass**: `vendor-others` JS
chunk is ~2.2MB uncompressed (slow first PWA update per device per deploy, self-healing, not
broken — only worth it if touching build config anyway); `translationKeysCoverage.test.ts` and
`WorkoutPlaybackPage.test.tsx` have known intermittent flakes (pre-existing, not this session's to
fix unless it regresses further); no TODO/FIXME comments exist anywhere in
`SparkyFitnessFrontend/src/pages/` or `src/components/` — this codebase tracks known issues in this
doc's "Not yet done" section (below), not inline comments, so check there for anything else
worth folding in rather than grepping for markers that won't exist.

---

**Previous entry, workout-mapping plan close-out, 2026-09-16/17** (`c9789c41a` on `main`):
**Phase 6 of the workout-mapping plan** (full plan:
`C:\Users\ICPET\.claude\plans\help-me-plan-splendid-sphinx.md`, 6 phases total) is complete. This
was the last phase of the whole workout-mapping plan — **all 6 phases are now shipped.** The
approval-gated repair script for the 5 known-bad production phantom rows plus the other integrity
categories from the original investigation: built, tested, deployed, dry-run against real
production data, and every mutating category Isaac approved has been applied (phantoms + empty
session deleted 2026-09-17 ~01:00 UTC on his "delete"; the stale-calorie recompute applied
separately ~01:04 UTC once he explicitly confirmed it — his first "delete" didn't clearly cover
that one since it's an update, not a delete, so it was correctly held back until asked directly).

**What shipped**: `SparkyFitnessServer/scripts/workoutIntegrity/repairWorkoutIntegrity.ts` (pure,
unit-tested decision logic — 20 tests), `run.ts` (CLI: `--user` required, dry-run default inside a
`READ ONLY` transaction with a before/after table-checksum self-check, `--apply` writes a sha256'd
JSON backup of every affected row's pre-image to `backup/repair/` — which is bind-mounted from
`/home/pi1/sparkyfitness/backup/repair/` on Pi5, the same host dir the DB dumps already live in —
before committing), `restoreFromBackup.ts` (companion undo, checksum-verified). Implements the
plan's strict phantom rule (created by the user, updated <5s after creation, no notes/source_id,
no real set/activity/lap/GPS/HR-zone signal, no existing `planned_workouts` overlap) exactly as
specified — no loosening for convenience.

**A real discrepancy the dry-run surfaced, not assumed away**: all 5 "Bodyweight Squat HD" phantoms
carry a populated `source_id` ('1312'), which fails the strict rule's "no source_id" check. Traced
it: `source_id` is copied from the exercise's own wger catalog reference at row-creation time
(`exercises.source='wger'`, `source_id='1312'` for that exercise) — not evidence of real external
sync provenance the way the rule's author likely intended it as a guard against. The script
correctly routed all 5 to report-only rather than auto-applying on a technicality; per its own
design, a human (Isaac) reviewed the reasoning and approved the delete directly rather than the
script silently deciding either way. **Second discrepancy**: 4 of the 5 phantoms (20/27 Sep, 4/11
Oct) each already had a real `planned_workouts` row covering the same exercise/date — Phase 2's
template sync is correctly scheduling them now — so converting the phantoms into *new*
`planned_workouts` rows (the script's default apply behavior) would have created duplicates. Isaac
chose a plain delete instead (no conversion) for all 5, which the general `--apply` path doesn't
support (it always converts) — applied as a reviewed one-off transaction instead, using the same
backup format/location so `restoreFromBackup.ts` still works on it if ever needed. Confirmed after:
the 4 real `planned_workouts` template rows are completely untouched, zero orphaned children left
behind by any of the 6 deleted rows (all were already childless).

**Applied to production, 2026-09-17**: the 5 phantom `exercise_entries` rows deleted outright, the
1 empty `exercise_preset_entries` session (`ea3d3a7a…`, 14 Sep, "Phase 1. Lower Body (A)") deleted
(~01:00 UTC, manual one-off transaction — see below for why), and the stale-calorie recompute on
the Slow Squat entry (`96229413…`, 2181.53 → 32.2 kcal, `calories_source` now `derived`) applied
~01:04 UTC through the real `--apply --recompute-calories` CLI path (safe to run automatically at
that point since the phantoms/empty-session were already gone — nothing ambiguous was left for it
to touch). Two backups on Pi5's `backup/repair/` and copied to `C:\dev\SparkyFitness-backups\repair\`
on Kingdom: `...-2026-09-17T00-51-09.000Z.json` (the manual phantom/session delete) and
`...-2026-09-17T01-04-01-257Z.json` (the calorie recompute, written automatically by `run.ts`).

**Still report-only, no action taken (by design)**: 5 implausible-duration entries from 15 Sep
(0.1–1.0 min upper-body sets) and 11 untyped-but-recently-used exercises (including Treadmill,
Bodyweight Squat HD, Slow Squat) — these have no apply path in the script at all, they're pure
awareness reports for Isaac to act on manually (e.g. tagging exercises with `workout_type` in
Settings, now that Phase 5's weekly-goal classification depends on those tags).

**Deploy for this phase**: backend-only (no migration, no frontend change) — `pg_dump` backup taken
and verified restorable (1009 TOC entries) before rebuilding regardless of no schema change (same
"cheap insurance" policy every phase has followed), image tagged `pre-d20dd0152`, `--no-cache`
rebuild confirmed to contain `scripts/workoutIntegrity/` before deploying, `docker compose up -d
--force-recreate sparkyfitness-server` only (frontend untouched), confirmed healthy. Dry-run and
the approved deletions were both run via `docker exec sparkyfitness-sparkyfitness-server-1
node_modules/.bin/tsx scripts/workoutIntegrity/run.ts --user=<id>` against the live container —
this fork ships TypeScript straight into the image, so `tsx` runs it directly, no separate compile
step needed, same as every other maintenance script in this repo.

**New gotcha, worth remembering**: `SparkyFitnessServer/backup/` inside a *running* container is
bind-mounted to `/home/pi1/sparkyfitness/backup/` on the host (same dir the DB dumps live in) — a
script's own `--apply` backup write lands there automatically and is already host-persistent, no
extra copy-off-container step needed (unlike a one-off manual backup built with raw SQL outside the
script, which has to be placed there by hand — mistakenly wrote one to the *build clone's*
`SparkyFitnessServer/backup/repair/` first, which is NOT bind-mounted or visible to the running
container, before catching it and moving it to the real bind-mounted path).

**Before this session considered running anything against production**: the full apply→backup→
restore cycle was exercised end-to-end against real Postgres using synthetic fixtures seeded
directly on the **dev** DB (covering every category: a clean eligible future phantom, a
source_id-blocked one, a qualifying-but-past one, an empty session, a stale-calorie row, an
implausible duration, and an untyped-exercise usage) — dry-run, `--apply`, then
`restoreFromBackup.ts --confirm`, confirming every row came back exactly as it was. Cleaned up
after. Only then was the dry-run pointed at production.

---

**Previous entry, also shipped 2026-09-16** (`5fcbf4519` on `main`):
**Phase 5 of the workout-mapping plan** (full plan:
`C:\Users\ICPET\.claude\plans\help-me-plan-splendid-sphinx.md`, 6 phases total) is complete,
merged, and live: weekly workout goals (total/strength/cardio session targets, a cardio-minutes
floor, and an any_strength/explicit_only counting-mode switch), built contract-first + two parallel
worktree lanes (5A backend, 5B frontend) the same way as phases 2-4.

**Contract**: migration `20260916100000_add_weekly_workout_goals.sql` adds
`user_preferences.weekly_workout_target_total/strength/cardio` (nullable, positive CHECK — NULL
means no goal set), `weekly_cardio_min_minutes` (NOT NULL DEFAULT 20), `weekly_strength_counting`
(NOT NULL DEFAULT `'any_strength'`, CHECK IN `('any_strength','explicit_only')`). New pure module
`shared/src/workouts/weeklyGoal.ts`: `resolveWeeklyGoalPolicy` (raw prefs → policy with defaults),
`classifySession` (session tag → preset tag → duration-weighted majority across exercise tags →,
under `any_strength` only, a last-resort exercise-modality guess; `explicit_only` returns `null`
instead of guessing), `computeWeeklyProgress` (total is type-agnostic; cardio only counts once a
session's duration meets `cardio_min_minutes`). `weekBounds(date, firstDayOfWeek)` extracted into
`shared/src/utils/calendar.ts` from `alcoholWeekService.ts`'s own inline calc, now shared by both.

**Lane 5A (backend)**: new `services/weeklyWorkoutGoalService.ts` + `models/
weeklyWorkoutGoalRepository.ts` + `GET /api/v2/reports/weekly-workout-goal?date=`, deliberately its
**own router** mounted ahead of `reportRoutesV2` at the same `/api/v2/reports` prefix and gated on
the **`diary`** tier (not `reportRoutes.ts`'s `reports` tier) — matches every other route reading
this same session data (`exerciseEntryRoutes`, `plannedWorkoutRoutes`); `reportRoutes.ts`'s
`router.use(checkPermissionMiddleware('reports'))` runs unconditionally for every request that
reaches it, so a route added there couldn't opt out of that tier. New MCP action
`get_weekly_progress` on the existing `sparky_manage_planned_workouts` tool (no new tool).
`alcoholWeekService.ts` refactored onto the shared `weekBounds`. Along the way, fixed a real
latent bug in `preferenceRepository.upsertUserPreferences`: the two NOT-NULL-defaulted columns
(`weekly_cardio_min_minutes`/`weekly_strength_counting`) would have silently reverted to their
defaults on any settings save that omitted them, the same bug class already documented for
`chart_scale_mode` — fixed by reading the "was this key present" flag directly in the ON CONFLICT
branch instead of a plain `COALESCE`.

**Lane 5B (frontend)**: "Weekly Workout Goals" block in `PreferenceSettings.tsx` (5 fields, `<Select>`
for counting mode) + matching `PreferencesContext.tsx` plumbing; a compact `WeeklyGoalChip` on
`pages/Home/WorkoutCard.tsx` ("This week: 4/4 · S 2/2 · C 2/1", one line appended under the existing
text stack in each of the card's status branches, colored to the workout accent once every *set*
leg is met, hidden entirely when no leg has a target) — chosen over a second progress ring since the
tile is one of three in a `grid-cols-3` row with no room for multiple rings. New `api/Reports/
reportsService.ts`/`hooks/Reports/useReports.ts` additions (`getWeeklyWorkoutGoalProgress`/
`useWeeklyWorkoutGoal`), matching the existing alcohol-week client/hook exactly rather than the
per-feature file split the lane brief suggested — checked the real convention first.

**A real bug found live, not by either lane's unit tests**: `weeklyWorkoutGoalRepository
.getWeeklySessions` originally queried only `exercise_preset_entries`, so a workout logged via a
bare `log_exercise` MCP call (or the app's own single-exercise manual log) — `exercise_entries` with
`exercise_preset_entry_id IS NULL`, a completely normal, common shape — was invisible to every leg
of weekly-goal counting, including the type-agnostic total. The codebase's own established
definition of "a session" (`exerciseEntryHistoryService.ts`'s `NON_EMPTY_PRESET_SESSION` UNION ALL
standalone `exercise_entries`) already covered this; the new repository just hadn't matched it.
Found by signing up a throwaway dev account, logging a bare exercise over the real MCP HTTP
transport, and seeing `completed_total` stay 0 — the mocked-repository unit tests couldn't catch it
because their mocks already assumed the incomplete query shape. Fixed with a `UNION ALL` matching
the established pattern, and locked in with a new `weeklyWorkoutGoal.integration.test.ts` against
the real dev DB proving both branches count and that `any_strength`/`explicit_only` behave correctly
against real Postgres data (not just mocks).

**Gotcha found during dev-stack verification, worth remembering**: after editing a file directly
(not through a shell command) while the dev backend container was already running, `nodemon`
*appeared* to restart (fresh startup lines in `docker logs --tail`) but was actually just showing
the tail of the **original** startup — the edit was never picked up. A real `docker restart
docker-sparkyfitness-server-1` was needed before the fix took effect. If a code change doesn't seem
to take effect on this dev stack even after `docker logs` shows a "clean" nodemon startup, restart
the container explicitly rather than trusting the log tail — Windows bind-mount file-change events
into the container are not fully reliable.

**Second gotcha, cleanup-specific**: like `exercises.user_id`, `user_preferences.user_id` has **no
FK at all** to `"user"(id)` (confirmed via `pg_constraint` — zero FKs targeting `"user"`) — a raw
`DELETE FROM "user"` during throwaway-account cleanup leaves an orphaned `user_preferences` row
behind. Delete `user_preferences` explicitly (before or after the user row) when cleaning up a
throwaway account by hand, the same way `exercises` already needs to be. Also confirmed (by
accident, then fixed): the generic `PUT`/`POST /api/user-preferences` endpoints can never clear a
nullable preference field back to `NULL` once set — `COALESCE($n, column)` treats an explicit
`null` in the payload the same as "not provided." This is pre-existing and applies equally to
`weekly_alcohol_limit_g`/`water_goal_ml`/the three new weekly targets, not a phase 5 regression; if
a future session wants a real "clear to unset" UX for any of these, it needs the same explicit
"key present" pattern already used for `default_barcode_provider_id`/`active_ai_service_id`, not a
plain `COALESCE`.

Verified: `tsc -b` clean across shared/backend/frontend, backend lint clean, frontend lint+knip
clean (zero new flags), full backend suite **252 suites / 3052 tests** passing (vitest), full
frontend suite **115 suites / 1065 tests** passing (jest), all 6 DB-backed integration suites
(`rlsPermissionMatrix`, `schemaParity`, `exerciseEntryStats`, `workoutSessionIntegrity`,
`plannedWorkoutSync`, the new `weeklyWorkoutGoal`) green against the dev DB, `pnpm run
test:migrations` idempotent re-run clean, RLS still enabled on `user_preferences`. Live-verified in
the local dev stack via a disposable signup account over the real MCP HTTP transport (not just REST)
— set goals, logged a standalone exercise, confirmed `any_strength` vs `explicit_only` both count
and classify correctly against real data — then in the browser via Playwright against the seeded
demo account (Settings block renders and persists all 5 fields; Home chip renders "This week: 4/4 ·
S 2/2 · C 2/1" in the workout accent color when every set leg is met, and disappears entirely once
targets are cleared back to unset) — demo account's own real data confirmed untouched afterward.
Then repeated the full disposable-account MCP round trip against **production** post-deploy,
cascade-cleaned to 0 rows across `user`/`exercises`/`user_preferences`/`exercise_entries`
afterward; confirmed the new tool description and REST endpoint live on the real
`https://sparkyfitness.tail854f4e.ts.net` domain, and confirmed the redeployed frontend serves a
clean login page post-deploy.

Deployed to Pi5: both images tagged `pre-0c96a3046` before rebuild, `pg_dump -Fc` backup taken and
verified restorable (`pg_restore --list`, 1004 TOC entries), copied to
`C:\dev\SparkyFitness-backups\db\`, `--no-cache` build of both images (repo-root context) from
`/home/pi1/sparkyfitness-build`, confirmed the built backend image actually contains the fixed
`weeklyWorkoutGoalRepository.ts` (`docker create`+`docker cp`+grep) and the built frontend image
contains the new translation keys before deploying, Hermes stopped before and restarted after (a
two-service deploy, same as Phase 3), `docker compose up -d --force-recreate` both services,
confirmed both `healthy` and the migration columns present, `docker builder prune -af` (3.9GB
reclaimed).

**Not done yet, deliberately out of scope**: Phase 6's data-repair script for the 5 known-bad
production phantom rows — still open, still untouched, still real safety-critical work deserving
its own focused session.

---

**Previous entry, also shipped 2026-09-16** (`165c3910d` on `main`):
**Phase 4 of the workout-mapping plan** (full plan:
`C:\Users\ICPET\.claude\plans\help-me-plan-splendid-sphinx.md`, 6 phases total) is complete,
merged, and live. Backend/MCP-only, on top of Phase 2's `planned_workouts` domain and Phase 3's
planning UI: the new `sparky_manage_planned_workouts` MCP tool, plus the revert-from-`started`
endpoint Phase 3 flagged as a gap.

**Contract**: `revertPlannedWorkout` (started→planned) added at repo/service/REST layers — closes
the started/discard gap from Phase 3 (the frontend still never calls `start` proactively, so it has
no need for revert either; this was purely to unblock MCP, where an agent-initiated `start` is a
real, expected path). `createPlannedWorkout` now takes an explicit `origin` param so MCP-created
rows tag `'coach'` instead of the frontend's `'manual'`.

**New tool `sparky_manage_planned_workouts`**: `list_planned`, `get_day`, `create`, `update`,
`move`, `delete`, `start` (today-only — refuses a plan dated any other day, matching the frontend's
own constraint), `revert`, `complete` (links an already-logged session to a plan after the fact;
distinct from the auto-complete-on-save path a plan-launched frontend session already gets), `skip`.
Every write returns the saved record plus a structured `[Planned Workout Tool] ... userId=...`
log line. Service errors carry a numeric `.status` (400/404/409) and are mapped 1:1 to
VALIDATION/NOT_FOUND/CONFLICT — the first domain in this codebase to do that instead of the
free-text substring matching every sibling tool still uses.

**`sparky_manage_workout_plans` touch-up**: `set_day_assignment`/`clear_day_assignment` now echo
the next 4 weeks of the resulting `planned_workouts` schedule in their response, since editing a
template assignment silently resyncs those rows server-side (Phase 2's sync engine) — an agent
editing a schedule couldn't previously see the effect of its own edit without a separate
`list_planned` call.

**Drive-by**: fixed one pre-existing eslint warning in `chatService.test.ts` that was blocking a
clean `lint` run.

Verified: `tsc --noEmit` clean, `eslint --max-warnings 0` clean, full backend suite **249 suites /
3018 tests passing**. Live-verified against the real dev DB via the actual MCP HTTP transport (not
just unit tests or a one-off script) — signed up a throwaway account, called `tools/list` and
confirmed `sparky_manage_planned_workouts` present, then ran `create` (bare title, no
preset/exercise) → `start` → `revert` → confirmed a redundant `revert` correctly 409s
(`CONFLICT`) → `complete`, then confirmed a second `complete` on the same plan also 409s
(`already_linked`). Then repeated the `tools/list` + `create`→`start`→`revert`→`complete` shape of
check against **production** post-deploy with a second disposable account.

**Real gotcha found while live-verifying, worth knowing before calling `complete` again**:
`completePlannedWorkoutWithSession`'s `session_id` must be an `exercise_preset_entries` id (a
workout **session** — what `log_workout_preset` or a real preset-based playback creates), not the
`exercise_entries` id that plain `log_exercise` returns. The first attempt used a `log_exercise`
id and got a correctly-worded but easy-to-misread `NOT_FOUND: Session not found, or it does not
belong to you` — nothing was broken, the id was just the wrong table. If Hermes ever calls
`complete` itself, point it at a preset-session id, not a bare exercise-entry id.

**Second gotcha, demo-account-specific**: `demoRestrictionGuard` blocks the **entire** `/mcp`
prefix for the demo account on any method — there is no way to exercise the MCP surface, including
`tools/list`, as the demo user. Any future MCP live-verification needs a real (throwaway) signup
account instead, same as this session used.

**Third gotcha, cleanup-specific**: unlike almost every other `user_id`-keyed table (`ON DELETE
CASCADE` throughout), `exercises.user_id` has **no FK constraint at all** — deleting a throwaway
test user leaves their custom exercises behind as orphaned rows (harmless — `shared_with_public`
defaults false, so nothing else can see them — but not auto-cleaned). Delete any custom exercises
a throwaway account created *before* deleting the user row, or clean them up separately after,
the way this session did.

No migration this phase (confirmed via diff against the pre-Phase-4 commit) — `shared/` untouched
too, so no `--no-cache` dev-image rebuild was needed, just a `docker restart` of the bind-mounted
dev backend container.

Deployed to Pi5: backend image tagged `pre-165c3910d` before rebuild, `pg_dump -Fc` backup taken
and verified restorable (`pg_restore --list` inside the db container, 1004 TOC entries — pg_restore
isn't installed on the Pi5 host itself, only inside the postgres container), copied into
`backup/` (the `sudo mv` dance, per the existing gotcha below — direct redirect into `backup/`
still 403s), `--no-cache` build of the backend only (repo-root context, per the standing Dockerfile
gotcha below) from `/home/pi1/sparkyfitness-build`, confirmed the built image actually contains
`plannedWorkoutTools.ts` (`docker create` + `docker cp` + grep, since this fork ships TypeScript
straight into the image rather than a compiled JS bundle) before deploying, `docker compose up -d
--force-recreate sparkyfitness-server` from `/home/pi1/sparkyfitness` (the separate runtime compose
dir — `/home/pi1/sparkyfitness-build` is build-only, never where `docker compose` itself runs),
confirmed `{"status":"UP"}` and the container `healthy`, confirmed the new tool live in
production's real `tools/list` response over the actual `https://sparkyfitness.tail854f4e.ts.net`
domain via a disposable account (cleaned up immediately after, cascade-deleted down to 0 rows same
as the dev-DB check), `docker builder prune -af` after (2.9GB reclaimed). Frontend untouched, not
redeployed. Hermes was not stopped/restarted for this deploy (single-service backend
`--force-recreate`, and Hermes' MCP client re-fetches `tools/list` per session regardless — no
reconfiguration needed for it to see the new tool on its next call).

**Not done yet, deliberately out of scope for this phase**: no frontend UI for revert — Phase 4 was
backend/MCP-only by design, and the frontend still never calls `start` proactively (Phase 3's
standing decision), so it has no path that would ever need to call `revert` either.

**Next**: Phase 5 (weekly-goal tracking) and Phase 6's data-repair script for the 5 known-bad
production phantom rows — see "Not yet done" item 0 below, still untouched, still real
safety-critical work deserving its own focused session.

---

**Previous entry, also shipped 2026-09-16** (`9b5066f6c` on `main`):
**Phase 3 of the workout-mapping plan** (full plan:
`C:\Users\ICPET\.claude\plans\help-me-plan-splendid-sphinx.md`, 6 phases total) is complete,
merged, and live. Frontend-only, built on top of Phase 2's `planned_workouts` backend: a real
planning UI, and the dashboard/playback surfaces re-pointed off the workout-plan-*template* domain
onto the new domain.

**Contract deviation, worth knowing if a future phase touches this domain again**: the plan
assigned the frontend `planned_workouts` API client + hooks (`api/Exercises/plannedWorkouts.ts`,
`hooks/Exercises/usePlannedWorkouts.ts`, `api/keys/exercises.ts`) to lane 3A, but lane 3B's
dashboard/playback work needed the same module to compile standalone in its own worktree — so
those three files were built once as part of the contract instead (fully implemented, not just
typed — the backend API shape was already 100% fixed from Phase 2, so there was no real design
left to split across lanes). `translation.json`'s "contract only" ownership was also relaxed for
this phase: each lane was given its own reserved i18n namespace to append into directly (rather
than pre-authoring exact UI copy for components not yet designed), which did produce one real
merge conflict on reconciliation (both lanes appended near the same spot in `translation.json`) —
resolved by simple concatenation, both blocks are valid siblings. Worth the same call again for
any future UI-heavy phase with genuinely disjoint i18n groups.

**Lane 3A (Planning UI)**: new `PlannedWorkoutsList.tsx` (date-ordered, 7-days-back to 27-days-
forward window matching the backend's eager-sync horizon, status/missed chips, Move/Skip/Delete
row actions gated on the row's actual status so the UI never triggers a predictable 409) and
`AddPlannedWorkoutDialog.tsx` (reuses `AddExerciseDialog`'s `mode="workout-plan"` picker rather
than building a new one), wired into `WorkoutsRoutinesTab` via a third `ProgramsActionBar` action.
`AddWorkoutPlanDialog`'s day-cards now render in `orderedDaysOfWeek(firstDayOfWeek)` order (display
only — `day_of_week` values and `DAYS_OF_WEEK` itself untouched). `useWorkoutPlans.ts`'s template
mutations now also invalidate `plannedWorkoutKeys.all`, since activating/editing/deleting a
template resyncs `planned_workouts` rows server-side. Added a minimal "Delete workout" action on
history cards, reusing the pre-existing `useDeleteExercisePresetEntryMutation`/
`useDeleteExerciseEntryMutation` hooks (no new backend plumbing) behind `ConfirmationDialog`.

**Lane 3B (Dashboard + playback)** — the bigger piece: extracted `WorkoutCard` out of
`HomeChecklist.tsx` into its own file and re-pointed it from the template-domain hook onto
`usePlannedWorkoutDayView`, dropping the old today-only gate so it reflects whichever date is
selected (starting is still gated to today only — browsing another date's plan is informational).
Added a `MissedWorkoutsNudge` card with Move-to-today/Skip actions, driven by the day-view's
`missed` array (a date-independent signal computed relative to *today*, not to whatever date
happens to be selected — Isaac's standing decision: missed workouts stay on their date and only
move via explicit action, never automatically). Threaded `planned_workout_id` through the entire
playback draft lifecycle (`WorkoutPlaybackDraft`, `createWorkoutPlaybackDraftFromPreset`/
`createWorkoutPlaybackRouteState`/`createBlankWorkoutPlaybackDraft`,
`buildPresetSessionCreateRequestFromDraft`) so finishing a workout launched from a plan reaches
Phase 2's existing auto-complete-on-save path. Fixed `ActiveProgramWidget`'s device-local
`new Date()` to `todayInZone`, reordered its day grid and `HomeChecklist`'s week strip and
`WeekdayToggle` via `orderedDaysOfWeek`, and re-pointed its "Start Today's Workout" button onto a
real `planned_workouts` row (via day-view) instead of the raw template assignments array, so it
carries an id the playback draft can use. Added local-midnight rollover for `selectedDate`, gated
so it never yanks the user off a manually-selected non-today date.

**A real backend gap was found and deliberately designed around, not papered over**: the plan's
"Discard releases a started plan" requirement assumed a revert-from-`started` path exists — it
doesn't. Phase 2 shipped `start`/`skip`/`complete`/`delete` but nothing reverts `started` back to
`planned`, and `delete`/move both refuse a `started` row. Investigated directly against
`plannedWorkoutService.ts`/`plannedWorkoutRepository.ts` before building anything. **Decision:
never call the `start` endpoint anywhere in the playback launch path** — the auto-complete-on-save
path is unconditional on status, so plan completion still works end-to-end; the cost is no
mid-workout "started" indicator anywhere in the UI (a plan stays `planned` all the way through an
in-progress workout, jumping straight to `completed` on save). If a future session wants that
indicator, it needs either a real revert-to-`planned` endpoint (Phase 2 backend follow-up) or a
frontend-only signal (checking for a live localStorage draft, the same mechanism `WorkoutCard`'s
own "active" tile already uses) — not a naive `start()` call, which would orphan rows the moment
anyone discards.

Verified: shared `tsc --noEmit` + frontend `tsc -b` clean on the contract and both lanes
individually, `eslint --max-warnings 0` clean throughout, each lane's own full `pnpm test` green
(108/1018 and 104/1016), reconciled `main`'s full suite **112 suites / 1045 tests passing**, `knip`
clean (flags some pre-existing unused-export debt plus four now-legitimately-unused
`usePlannedWorkouts` exports — `usePlannedWorkout`, `useUpdatePlannedWorkoutMutation`,
`useStartPlannedWorkoutMutation`, `useCompletePlannedWorkoutMutation` — the last two unused
specifically *because* of the started/discard decision above, not dead code to delete). No backend
or migration this phase (confirmed via diff against the pre-Phase-3 commit). `prettier --check`
still fails repo-wide — same pre-existing Windows `core.autocrlf` checkout artifact documented in
the Known Gotchas below, confirmed via a zero-diff `prettier --write` on an affected file; not a
regression, don't chase it.

Live-verified against the local dev stack (`--no-cache` rebuild of both dev images, `shared/`
changed again): created a planned workout through the real "Plan a Workout" dialog, confirmed it
rendered correctly in `PlannedWorkoutsList` (status chip, actions correctly enabled) and on the
Home dashboard's `WorkoutCard` for today; launched playback from it and confirmed
`planned_workout_id` was present on the persisted localStorage draft; Discarded and confirmed the
plan stayed at `status: 'planned'` (no orphaning, per the decision above); Deleted it and confirmed
clean removal. Exercised the History tab's new delete confirmation dialog (cancelled without
deleting real demo data). Then live-verified again against **production** post-deploy with a fresh
disposable signup account (the documented demo-account approach wasn't usable here since prod
isn't running in demo mode) — hit the PWA stale-service-worker gotcha immediately (page title still
read the pre-rename "Ouroboros Life" until service workers/caches were cleared, confirming the gate
matters, not just documentation), then repeated the full create → dashboard-reflects-it → cleanup
loop successfully; account and its cascade-deleted `planned_workouts` row confirmed fully gone
afterward (`SELECT count(*) ... = 0`).

Deployed to Pi5: both images tagged `pre-9b5066f6c` before rebuild, `--no-cache` build of both from
`/home/pi1/sparkyfitness-build`, confirmed the new UI strings present in the built frontend image
before deploying, `pg_dump -Fc` backup taken and verified restorable (`pg_restore --list`, 993 TOC
entries) *despite* no migration this phase (cheap insurance, matches the established per-phase
procedure), copied off the Pi to `C:\dev\SparkyFitness-backups\db\`, `docker compose up -d
--force-recreate` both services, confirmed `{"status":"UP"}` and both containers healthy, Hermes
stopped before and restarted after, `docker builder prune -af` (reclaimed 3.9GB). Worktrees
(`p3-planning-ui`, `p3-dashboard`) and their branches removed after reconciliation — the directory
deletion itself needed PowerShell's `\\?\` long-path prefix on this host (`git worktree remove`
alone failed with "Filename too long" on the nested `node_modules` trees; worth remembering for
future worktree cleanup on Kingdom).

**New gotcha, not yet in the Known Gotchas list below**: `ssh`-ing to Pi5 by the documented alias
(`pi1@100.103.152.66`) works fine as a raw command, but there's no `~/.ssh/config` entry on Kingdom
mapping a short host alias to it — every session has to pass the full `-i ~/.ssh/id_ed25519_pi5
pi1@100.103.152.66` each time (the key itself is present and works). Also: the Pi's
`/home/pi1/sparkyfitness/backup/` directory is `root:root` 755, not writable by the `pi1` user a
plain SSH session runs as — a `pg_dump ... > backup/file.dump` redirect fails with "Permission
denied" even though `pi1` is in the `sudo`/`docker` groups; write to `/home/pi1/` first and `sudo
mv` into `backup/` instead of fighting the redirect under `sudo`.

**Not done yet, deliberately deferred**: Phase 4 (MCP `sparky_manage_planned_workouts` tool),
Phase 5 (weekly-goal tracking), and Phase 6's data-repair script for the 5 known-bad production
phantom rows (Bodyweight Squat HD, 13/20/27 Sep + 4/11 Oct) — still present, still untouched, still
real safety-critical work deserving its own focused session. See "Not yet done" item 0 below.

---

**Previous entry, also shipped 2026-09-15** (`8038c264a` on `main`):
**Phase 2 of the workout-mapping plan** (full plan:
`C:\Users\ICPET\.claude\plans\help-me-plan-splendid-sphinx.md`, 6 phases total) is complete,
merged, and live. New `planned_workouts` table + CRUD domain
(`models/plannedWorkoutRepository.ts`, `services/plannedWorkoutService.ts`,
`routes/v2/plannedWorkoutRoutes.ts` — list/day-view/get/create/patch/move/start/skip/complete/
delete, all diary-tier). A session created with `planned_workout_id` completes its plan
automatically (`exercisePresetEntryRepository.linkPlannedWorkoutWithClient`, in the same
transaction as the session insert).

**The actual fix**: `workoutPlanTemplateService.ts` no longer eagerly materializes real
`exercise_entries`/`exercise_preset_entries` for up to a year of a template's future on every
activation, nor unconditionally deletes and recreates every future entry (including ones already
completed today) on every edit — that whole code path (`models/exerciseTemplate.ts`) is deleted.
It now calls `plannedWorkoutService.syncTemplatePlannedWorkouts`, which upserts a 28-day rolling
window of `planned_workouts` rows (lazily extended to 90 days on demand) and — this is the
guarantee that matters — only ever refreshes or removes a row still `planned`, unmodified, and
undismissed. A completed, started, user-edited, or dismissed row survives every future resync
completely untouched, even when the assignment that generated it is edited or removed entirely.
The regeneration key is `(template_id, generated_for_date, slot)`, where `slot` is an
assignment's position within its own day-of-week group — **not** its database id, since editing
any part of a template replaces every one of its assignment rows with new ids
(`workoutPlanTemplateRepository.updateWorkoutPlanTemplate`); anchoring to id would have broken
regeneration identity on every edit.

Verified: backend `tsc -b` + full vitest (2980 passing), the real-database integration suite
`plannedWorkoutSync.integration.test.ts` (4/4, added to the CI migration job) proving the safety
guarantee directly against Postgres — **it caught a genuine bug during development**: the cleanup
DELETE compared bare `slot` values across different dates instead of the `(date, slot)` pair,
since `slot` is only unique per day-of-week, not globally; a mocked unit test would never have
caught this. `schemaParity` (also caught a real gap: the migration's new `workout_type` columns on
`exercise_preset_entries`/`exercises`/`workout_presets` were missing from their shared zod
schemas), `rlsPermissionMatrix` (178/178 — also fixed two **pre-existing** gaps found along the
way: `focus_domains`/`focuses`/`focus_checkins`/`calendar_feeds` were never registered in the
test's `DOMAIN` map, and the `exercises` library-tier fixture's INSERT never set the NOT NULL
`source` column), `exerciseEntryStats`, `workoutSessionIntegrity` all unaffected. Frontend `tsc -b`
+ jest (989 passing; one `AIServiceSettings.test.tsx` failure during the full-suite run reproduced
as a pre-existing test-isolation flake — passed alone and on a full-suite re-run, not caused by
this backend-only phase). Live-verified against the local dev stack: created a training plan with
a Monday assignment through the real "Training Schedule" UI, confirmed exactly one
`planned_workouts` row generated and **zero** phantom `exercise_preset_entries` rows (the bug,
directly disproven); edited the plan to add a Wednesday assignment, confirmed the Monday row kept
its exact same id (refreshed, not deleted-and-recreated) and Wednesday was added; deleted the plan
and confirmed full cleanup. Then live-verified again against **production** post-deploy with the
pre-existing disposable test account — existing "Push Pull Legs" template still loads with zero
console errors.

**New gotcha, not yet in the Known Gotchas list below**: `shared/` package changes require a
`docker compose build --no-cache` of the **dev** images before dev-stack testing (see the Phase-1
entry below for the mechanism) — this phase touched `shared/` again (new `PlannedWorkouts*.zod.ts`,
`WORKOUT_TYPES`, three existing DB schemas gaining `workout_type`) and needed the same rebuild.
Also: a Postgres partial unique index's uniqueness only holds across the *combination* of its
indexed columns, not each column independently — a cleanup query that checks a multi-column
uniqueness key one column at a time (as this phase's first draft of the regeneration cleanup did,
comparing `slot` alone) will silently mis-delete rows whenever two different key-combinations share
a value in just one column. Worth remembering for any future `(a, b, c)`-keyed partial-unique
table's cleanup/dedup logic.

**Not done yet, deliberately deferred**: Phase 6's data-repair script (dry-run report,
approval-gated apply, JSON backup + restore script) for the 5 known-bad production phantom rows
(Bodyweight Squat HD, 13/20/27 Sep + 4/11 Oct) is real, safety-critical work involving Isaac's
actual data — it was not rushed into this same session. Stopping future phantom generation does
not touch those existing rows either way; they're unaffected by this deploy. See "Not yet done"
item 0 below for the full repair-category breakdown when that work starts.

---

**Previous entry, also shipped this same day (`6d94d3f98` on `main`):**
**Phase 1 of the workout-mapping fix** (full plan: `C:\Users\ICPET\.claude\plans\help-me-plan-splendid-sphinx.md`,
6 phases total) is complete, merged, and live. Fixed: duplicate sessions from a double-tap
Finish or a coach retry, empty session shells that still counted as workouts, calorie values
that went stale after a duration edit, and unsafe MCP writes (`log_workout_preset`'s `preset_id`
was typed as a `uuidSchema` even though the DB column is an integer — no real preset id could
ever have validated through that tool).

Contract: migration `20260915100000_add_workout_session_integrity_columns.sql` —
`exercise_preset_entries.client_request_id`/`client_request_fingerprint` (partial unique index
on `(user_id, client_request_id)`) for idempotent session creation, `exercise_entries.calories_source`
(`derived`/`manual`/`device`, named CHECK) so a duration edit only recomputes calories the server
itself derived. `shared/src/utils/workoutDuration.ts` + `workoutPlausibility.ts` new.

Backend (`exercisePresetEntryRepository.ts`, `exerciseEntry.ts`, `exerciseService.ts`,
`exerciseEntryHistoryService.ts`, `errorHandler.ts`, both exercise routes): idempotent
`INSERT ... ON CONFLICT (user_id, client_request_id) WHERE client_request_id IS NOT NULL DO NOTHING`
then re-select, fingerprint-mismatch → 409; deletes the parent session in the same transaction
when its last exercise entry is removed; empty sessions excluded from by-date/history reads and
counts; route-level future-date guard exempting sync sources and `'Workout Plan'`; `errorHandler`
now honors `err.status`/`err.statusCode` and hides internal 5xx messages from the client. **Late
addition beyond the original spec**: if a client-sent `workout_preset_id` isn't visible to the
saving user's RLS client (the FK to `workout_presets` ignores RLS, so trusting it blindly would
let a stale/malicious id cross-link to another user's preset), the session still saves — the
preset link is stored `NULL` instead of a hard 404, provided the client also sent its own
exercise/set structure.

MCP (`ai/tools/exerciseTools.ts`, `focusTools.ts`, `formatting.ts`, schemas): `log_workout_preset`
now matches an existing non-empty session on the same date by preset id **or** normalized name
(the app itself saves sessions with `workout_preset_id` NULL) and returns it with
`already_logged` instead of duplicating; `log_exercise` gained a 6-hour retry guard (same
exercise/date/duration/set-count); both refuse a future `entry_date` against the user's own
timezone. Also fixed a **latent data-loss bug** in `manage_focus`: `update_focus` was calling
`focusRepository.updateFocus` with every field on every call, so any field the caller didn't
mention got written as `NULL` — needed fixing for the new `due_time` field to behave sanely, but
it was already wiping `statement`/`unit`/`target_value`/etc. on any partial update before this
fix.

Verification: full backend suite 2940/2940 (vitest, `tsc -b` clean), full frontend suite 989/989
(jest, `tsc -b` + `eslint --max-warnings 0` clean), the real-database integration suite
`workoutSessionIntegrity.integration.test.ts` 8/8 against the dev DB (plus `schemaParity` 2/2 and
`exerciseEntryStats` 16/16, unaffected) — one of its own fixtures had a bug (seeded exercises as
private to one synthetic user, then logged them against a second synthetic user in the
"scopes client_request_id per user" case; fixed by seeding `shared_with_public: true`). Live UI
round-trip against the local dev stack (demo account): started a blank preset-based workout,
completed a set, hit Finish, confirmed exactly one row in `exercise_preset_entries` with
`client_request_id`/`client_request_fingerprint` populated and `calories_source = 'derived'` on
the child `exercise_entries` row, watched the Home "Workouts" count go 2→3→2 across create and
DB-level cleanup. Then live-verified again directly against **production** post-deploy with a
pre-existing disposable test account (`Claude Test 6`): page loads clean (0 console errors),
started a blank workout, confirmed the "Complete at least one set before finishing" guard blocks
an empty Finish (so a truly-empty session can't even be created via the UI), backed out clean —
no data left behind, nothing to clean up.

**New gotcha, not in the Known Gotchas list below yet**: the **dev** Docker stack's `shared/`
package is baked into the image at build time (only `SparkyFitnessServer/`/`SparkyFitnessFrontend/`
are bind-mounted — see `docker/docker-compose.dev.yml`), so a `docker restart` after editing
`shared/` is not enough; the container starts and then crashes on a since-added export it can't
see, or (frontend) Vite throws `does not provide an export named ...` from a stale
`/@fs/app/shared/src/index.ts`. Needed a real `docker compose --env-file .env -f
docker/docker-compose.dev.yml build --no-cache <service>` + `up -d --force-recreate` for both
`sparkyfitness-server` and `sparkyfitness-frontend` to pick up a `shared/` change on this host —
this had apparently been silently stale since the Phase 1 contract commit landed, so the dev
containers had been running broken since before this session started. Production doesn't have
this problem (it always does a full image rebuild), but check this first if the **dev** stack
throws a missing-shared-export error after only editing `shared/`.

**Next**: Phase 2 of the workout-mapping plan (`planned_workouts` table, planning UI/dashboard, a
new MCP planned-workout tool, weekly goals, the approval-gated repair script for the known-bad
production rows below) — see the plan file above for the full phase breakdown. Production data
still has the pre-existing bad rows the plan's Phase 6 repair script will need to fix (with
Isaac's explicit approval, never silently): 5 phantom "Bodyweight Squat HD" entries
(13/20/27 Sep, 4/11 Oct, `workout_plan_assignment_id = 1`), one empty session
(`ea3d3a7a-277a-42cc-9ce1-13143823cfe1`, 14 Sep — now correctly hidden from the UI by this
phase's fix, but the row itself is still there), a Slow Squat entry with duration 6 / 2181.53 kcal
(rate 322 kcal/min), and five upper-body playback entries on 15 Sep with 0.1–1.0 min durations.

---

**Previous entry, also shipped this same day (`8879dceb3` on `main`):**
the app's display name was shortened from "Ouroboros Life" to **"Ouros Life"** everywhere
user-facing — `index.html` title/og:title, both PWA manifests (the static
`public/manifest.json` used in dev + the `vite-plugin-pwa`-generated `manifest.webmanifest` used
in prod, which are two separate config sources that had drifted into agreement and need updating
together), the header heading + `BrandMark`'s `aria-label`, the three Auth-flow screens (sign
in/up, forgot password, reset password) logo alt text + heading, and the chunk-recovery
"Updating..." loading message + its test. Checked all 34 locale files in
`public/locales/*/translation.json` for the old name first — none reference it, so no i18n
follow-up needed. **Left deliberately untouched**: every other "Ouroboros" hit in
`SparkyFitnessServer` (13 files: repositories, AI tools, migrations, tests) is the *unrelated*
internal "Ouroboros restructure" codename — the name of the earlier refactor that hard-deleted
nutrition tracking (see `agent-docs/ouroboros-restructure-plan.md`) — not the product name; don't
confuse the two if "Ouroboros" comes up again. Verified live in the local dev stack (page title
+ header + BrandMark aria-label all confirmed rendering "Ouros Life") before deploying; deployed
via `--no-cache` frontend rebuild on Pi5, grepped the built image for the new string and zero
remaining old-name hits in `index.html`, confirmed the running container serves it,
`docker builder prune -af` after. Full frontend suite (971/971) + `tsc -b` + `eslint
--max-warnings 0` all clean beforehand.

---

**Previous entry, also shipped this same day:**
`CheckTarget` (the shared checkbox used by To-Do List and Daily Habits on Home) was shrunk from
32px (`h-8 w-8`) to 20px (`h-5 w-5`) — it was visibly oversized next to its label and broke
alignment with Today's Agenda above it — and its unchecked-state border bumped from a washed-out
`/30` opacity to `/50` for contrast. Check icon/stroke sized down to match (`h-3 w-3`,
`strokeWidth={3}`). Both row containers (`ToDoRow` in `ToDoCard.tsx`, `HabitRow` in
`HomeChecklist.tsx`) standardized to the same `rounded-xl` (12px) + `px-3.5 py-2.5` (14px/10px)
rhythm so the two sections read consistently with each other.

**Isaac's brief asked for this in plain CSS/CSS Modules/styled-components "consistent with
existing codebase styling patterns" — checked first and that's backwards**: this app has zero
CSS Modules or styled-components anywhere, Tailwind v4 is the only styling system, and
`CheckTarget`/`ToDoRow`/`HabitRow` were already 100% Tailwind utility classes with no dedicated
stylesheet. Flagged it and got confirmation to implement in Tailwind instead, matching every
sibling card on the dashboard — introducing a second styling paradigm for one component would
have been the actual inconsistency. **Worth remembering for next time a request specifies a
styling approach**: check `package.json` / grep for `.module.css` before assuming the brief's
framing of "existing patterns" is accurate — it may be describing a different project (Isaac
also works on the content-hub repo, which genuinely has no Tailwind).

Live-verified with throwaway fixtures in the local dev stack (not just the build): logged into
the dev DB's seeded demo account (`getDemoCredentials()` in `demoSeedService.ts` derives a
stable password from `BETTER_AUTH_SECRET` when `SPARKY_FITNESS_DEMO_PASSWORD` isn't set — no
password is hardcoded anywhere), added a throwaway to-do + habit via the UI, screenshotted both
the unchecked and checked states, confirmed the smaller crisp circle and consistent row rhythm,
then cleaned up (habit deleted via the Focus page's delete button, the completed to-do deleted
directly via `psql` since completed one-off Focus items have no delete affordance on the Home
dashboard itself — confirmed the demo account's real data, e.g. Water 91%/2-of-2 supplements,
was untouched afterward). Full frontend suite (971/971 Jest tests — this frontend uses Jest, not
vitest; vitest is the *backend's* test runner in this monorepo, don't confuse the two) + `tsc -b`
+ `eslint --max-warnings 0` all clean. Deployed: `--no-cache` frontend rebuild on Pi5, grepped
the built image for the new `h-5 w-5 shrink-0` class combo to confirm it compiled in, confirmed
the *running* container serves that same chunk, `docker builder prune -af` after.

---

**Previous entry, also shipped this same day:**

`sparky_manage_workout_plans` gained two new MCP actions so Hermes can now change day-by-day
workout scheduling itself instead of only reading it —

- `set_day_assignment` (plan_id, day_of_week, + exactly one of preset_id/preset_name or
  exercise_id/exercise_name) — assigns a saved preset or a single exercise to a day,
  **replacing** anything already assigned to that day (not adding alongside it — deliberate,
  confirmed with Isaac before building).
- `clear_day_assignment` (plan_id, day_of_week) — removes whatever's assigned, making it a
  rest day.

`day_of_week` accepts 0=Sunday..6=Saturday or a day name ("Monday", "Mon", case-insensitive).

**Real gotcha found and handled, worth knowing if you touch this tool again**:
`workoutPlanTemplateService.updateWorkoutPlanTemplate` does a **full replace**, not a patch —
both the plan's top-level fields (`plan_name`/`description`/`start_date`/`end_date`/
`is_active`, each defaulted to blank/`false`/today if omitted) and the entire `assignments`
array (anything whose `id` isn't in the payload gets deleted). Both new actions read the whole
plan first via `getWorkoutPlanTemplateById` and echo every other field and every other day's
assignment back unchanged before adding/removing just the target day. This was live-verified
against the real dev DB (not just unit tests) with a throwaway preset+plan+exercise, created
and cleaned up via a one-off `tsx` script run inside `docker-sparkyfitness-server-1` — confirmed
`plan_name`/`description`/`start_date`/`is_active` all survive a single-day edit, confirmed
"replace" semantics actually replace (not append), and confirmed the MISSING_PARAMS/NOT_FOUND
error paths. `findExerciseByExactName` was exported from `exerciseTools.ts` (was file-local) so
`workoutPlanTools.ts` could reuse it for `exercise_name` resolution instead of duplicating it.

Full backend suite (2860/2860, up from 2853 — 9 new tests) + `tsc -b` + `eslint
--max-warnings 0` all clean. Files: `ai/tools/workoutPlanTools.ts`,
`ai/tools/schemas/workoutPlans.ts`, `ai/tools/exerciseTools.ts` (one-line export),
`tests/chatbotToolsWorkoutPlans.test.ts`.

Pushed and deployed: backend image rebuilt `--no-cache` on Pi5 from the repo-root build
context, `docker compose up -d --force-recreate sparkyfitness-server`, confirmed healthy
(`{"status":"UP"}` from inside the container) and `docker builder prune -af` run after. Hermes'
`sparkyfitness` MCP connection already shows `✓ enabled` for "all" tools (`hermes mcp list` on
Pi5) — MCP clients re-fetch `tools/list` per session, so no reconfiguration needed for it to see
the two new actions on next use. Not exercised through a real end-to-end Hermes call against
production data (deliberately — didn't want to mutate Isaac's actual workout plans without
asking); the dev-DB live-verification above plus the byte-identical `--no-cache` build is the
verification for this deploy.

**Hit the shared-repo gotcha again while pushing this** (see the Process note directly below,
from a few sessions ago) — `git push` was rejected because a different concurrent session had
already pushed `bcfd41530` ("harmonize dashboard water card tint and standardize section header
typography," `AgendaCard.tsx`/`HomeChecklist.tsx`, frontend-only) straight to `origin/main`.
Confirmed it touched disjoint files from this session's backend-only change, `git pull --rebase`
onto it cleanly, re-ran `tsc -b` + the scoped test suite post-rebase, then pushed.

**That frontend commit has now also been deployed** (Isaac confirmed it was a real fix — the
"Daily Habits" card's `CardTitle` had no size override, so it fell back to shadcn's default
`text-2xl`, while "Today's Agenda" and "Today's Supplements" already explicitly set `text-base`;
the fix adds the matching `text-base font-semibold tracking-tight` to Daily Habits). Frontend
image rebuilt `--no-cache` on Pi5, `docker compose up -d --force-recreate sparkyfitness-frontend`,
confirmed both the freshly built image *and* the running container serve the new
`HomeChecklist-*.js` chunk (grepped for the new `metric-water/30` tint class as a fingerprint —
present in both), `docker builder prune -af` after. **Not** re-verified with an authenticated
live screenshot (no known admin password, and standing up a disposable account + seeding
habit/agenda/supplement fixtures felt disproportionate for a one-line class fix matching an
already-proven sibling pattern) — if it still looks wrong when checked, try the PWA stale-cache
gotcha below first before assuming the fix didn't land.

**Still open, untouched this session**: the proactive Hermes morning-briefing automation, the
phantom-diary-entries decision, and the passkey RP ID console error — all still open from the
previous handoff, see "Not yet done" below.

**Process note, worth knowing before starting concurrent work**: this session discovered that
`C:\dev\SparkyFitness` on Kingdom is a single shared working directory — a *different* concurrent
session (also Isaac, also Claude) committed `32070d1ae` ("two-tier check-in form, frictionless
daily stack" — `CheckInForm.tsx` split into an always-visible Daily Core + collapsible Body
Measurements section, and the Medications page's Adherence/filter/cards replaced with a single
"Today's Stack" grouped checklist) directly onto the same local `main` branch this session was
using, and it rode along on this session's next `git push` without any merge conflict or warning.
If two sessions are ever active on this repo at once, check `git log` for unexpected commits
before pushing or deploying — don't assume everything on your local branch is something you wrote.
That commit was verified before deploying (full frontend suite: `tsc -b` / `eslint
--max-warnings 0` / 971/971 tests, all clean) but not authored or design-reviewed by this session
— if it needs a fuller write-up, that's for whichever session built it.

**Also caught during that same pre-deploy verification, and fixed** (commit `dd4ee4e06`): four
`t()` keys added earlier today for the Workouts restructure (`activeProgramWidget.manage`,
`.manageSchedules`, `.noActivePlan`, `.startTodaysWorkout` in `ActiveProgramWidget.tsx`) were
missing the `exercise.` prefix every other key in that file uses — they silently fell back to
their inline default string (identical English text, so invisible in the browser) instead of
resolving through `translation.json`, breaking localization for any non-English locale. Only
caught by the full `pnpm test` run (`translationKeysCoverage.test.ts`); a scoped `--testPathPatterns`
run (used throughout the Workouts work) doesn't touch that file. **Lesson: run the full frontend
test suite at least once before deploying, not just a scoped pattern match on the files you
touched** — this bug shipped invisibly through several rounds of scoped verification.

**Three things shipped and deployed this session, on top of the ongoing Hermes/phantom-diary
items below** — see the dedicated Status sections further down for the first two:

1. **To-Do List card redesign — time-based scheduling + a Day/Week view** (commits `7e2458467`,
   `68a6d3d54`). Optional `due_time` on scheduled focuses, a shared `DayWeekToggle` used by both
   the To-Do List and Today's Agenda cards, and a pass removing repeated section-header icons
   (Today's Agenda's calendar icon, Today's Supplements' badge) in favor of a plain title +
   count/summary baseline.
2. **Workouts tab restructured into "Programs & Schedule"** (commits `c3af4d6b2`, `5e9fa8e2f`,
   `dd4ee4e06`) — the Active Program Widget now always renders (with a Manage entry point instead
   of vanishing when nothing's active), a two-button action bar drives schedule/program creation,
   and the preset grid dropped bulk-select for one Start button per card. A real, previously-
   undetected cache-invalidation bug was found and fixed in the process — worth reading before
   touching `useWorkoutPlans.ts`'s mutation hooks again.
3. **The upstream "new release / breaking changes" warning dialog was removed** (commit
   `585866f9f`) — Isaac asked to stop the recurring full-screen modal that pops up after every
   upstream release; rather than just dismissing it (which only clears the current version in
   `localStorage` and reappears on the next upstream release), the whole GitHub release-check was
   removed outright — `AppSetup.tsx` no longer fetches it, `NewReleaseDialog.tsx` is deleted, and
   the supporting query/API/key code in `useGeneralQueries.ts` / `api/general.ts` /
   `api/keys/general.ts` is gone too. The unrelated announcement-banner system and the header's
   GitHub star-count badge are untouched — don't confuse the three, they're separate features.
4. **Hermes is connected to this app's MCP server, full read/write, all 32 tools** (see
   "Hermes integration" under "Not yet done" below for the full detail, including a correction
   to this doc's own earlier wrong assumption that Hermes was an n8n workflow — it isn't). The
   connection itself is done; the *proactive scheduled briefing* is still not built — that's
   still open, see the same section.

**New, not-yet-investigated gap surfaced while live-verifying today's deploy** (console error on
the login page, not from anything in today's changes): `[Better Auth] Error verifying passkey
SecurityError: The RP ID "100.103.152.66" is invalid for this domain`, seen when loading
`https://sparkyfitness.tail854f4e.ts.net/login`. Looks like `SPARKY_FITNESS_FRONTEND_URL` (or
whatever passkey uses as its RP ID) is pinned to the raw IP while the app is actually being
accessed via the Tailscale hostname — doesn't block password login, only surfaced as a console
error, not chased down further this session.

**Older fixed bug, still worth knowing**: a real production bug in the Calendar/Daily-Agenda
feature was found and fixed (commit `103445d04`): the feed cache's default clone-on-read
behavior broke recurring-event expansion, silently dropping an *entire feed's* events (not just
the recurring ones) on every read except the first one after each 15-minute cache refresh.
Surfaced as "today's event flickers on and off" and "the week view is basically always empty."
Fixed, tested (2 new regression tests pin the exact failure mode), deployed, and live-verified
with 5 consecutive reads returning consistent results. Full writeup in the dedicated Status
section below — worth reading if you touch `calendarService.ts` or add another `node-cache`
anywhere in this codebase that stores anything beyond plain JSON (class instances don't survive
the clone).

**Real gap intentionally left unresolved — needs a decision before the Active Program Widget
is fully trustworthy**: activating a workout plan pre-materializes "completed" diary entries
for every future day matching an assignment (`exerciseTemplate.ts`'s
`createExerciseEntriesFromTemplate` — pre-existing behavior, not new this session). The plan
was to detect and delete that phantom entry when the user presses "Start Workout" on a
scheduled day, but doing that needs `workout_plan_assignment_id` on the exercise-entry API
*response* — the backend currently accepts that field on writes but never returns it on reads
(`exerciseEntryResponseSchema` omits it). The widget and Home card both work correctly for the
common case right now; this only bites if a user activates a program and then also presses
"Start Workout" on a day it already auto-scheduled. Fixing it needs either exposing that field
on the response schema (small, but touches a shared contract) or changing the materialization
behavior itself (bigger). Flagged in-code in `ActiveProgramWidget.tsx`, not silently skipped.

Also worth knowing before touching anything: the **Known gotchas** section further down (Docker cache/env-reload traps, the PWA stale-cache trap, the build-context trap, the disposable-test-account cleanup command) has bitten every session in this doc at least once — skim it first.

## Status: Workouts restructured into "Programs & Schedule" — deployed and live-verified (commits `c3af4d6b2`, `5e9fa8e2f`)

Rebuilt the "Routines & Programs" sub-tab (relabeled "Programs & Schedule") to match Today's
Agenda's pill-nav pattern: `ActiveProgramWidget` now always renders instead of returning `null`
with no active plan (a dead end with no recovery path) — an empty state offers a "Manage
Schedules" button, and the populated state gained a small "Manage" header button alongside the
renamed "Start Today's Workout" CTA. A new `ProgramsActionBar` (exactly "+ Training Schedule" /
"+ Create Program") replaced the old per-section add buttons. `WorkoutPresetsManager` was
rewritten as `MyProgramsGrid` — dropped the bulk-select/checkbox edit mode entirely (each card
already has its own Start/Edit/Duplicate/Delete via its kebab menu), retitled "My Programs."
`WorkoutPlansManager` split into `ManageSchedulesDialog` (list/activate/edit/delete) plus a bare
create-dialog instance owned by the tab. `WorkoutPresetCard` simplified to match. History and
Exercise Library sub-tabs already matched the ask and were untouched.

`AddWorkoutPlanDialog` gained duration quick-pills (1 Week / 4 Weeks / Ongoing / Custom — derived
from the actual start/end dates, so a manual date edit falls through to "Custom" automatically,
no separate state to keep in sync) and dropped the legacy plan-editing warning banner.

**Real bug found and fixed along the way, commit `c3af4d6b2`**: every workout-plan mutation
(`useCreateWorkoutPlanTemplateMutation`, `useUpdateWorkoutPlanTemplateMutation`,
`useDeleteWorkoutPlanTemplateMutation` in `useWorkoutPlans.ts`) only invalidated the plans
*list* query key, never `workoutPlanKeys.active(date)` — so the Active Program Widget went stale
after creating, activating/deactivating, or deleting a schedule until a hard reload. Caught by
creating a schedule live in the redesigned UI and watching the just-built "Active Training
Schedule" card fail to populate. Fixed by invalidating the whole `workoutPlanKeys.all` prefix
instead of just `.lists()`. Confirmed live: deactivating a plan through `ManageSchedulesDialog`
now clears the Active Program Widget instantly, no reload.

**Verification**: `tsc -b` and `eslint --max-warnings 0` clean; the preset-manager test suite
renamed/updated to match (`MyProgramsGrid.test.tsx`, 5/5 passing) plus the full Exercise/Workout
suite (113/113). Live-verified in the local dev Docker stack — light/dark × desktop/390px mobile,
full create-schedule → assign-preset → activate → see-it-on-the-card flow — then deployed to Pi5
(`--no-cache` rebuild of both images, `--force-recreate`, `docker builder prune -af`) and
confirmed on the real production URL: both containers healthy, the `due_time` migration applied
to the production DB, and the served bundle's chunk hashes exactly match the freshly built image
(the PWA service-worker stale-cache gotcha reproduced again here — cleared registrations/caches
before trusting anything rendered, per the existing Known Gotcha entry below).

## Status: To-Do List card redesign — time-based scheduling + Day/Week view (commits `7e2458467`, `68a6d3d54`)

Added an optional `due_time` to scheduled `focuses` (migration
`20260914090000_add_focus_due_time.sql` + repo/schema/route support, plus a `period_date` range
filter on the list-focuses query for the week view) so the dashboard's To-Do List card can show a
time badge per task and a Day/Week toggle alongside Today's Agenda. Extracted a shared
`DayWeekToggle` component so both cards render identically instead of drifting apart — Today's
Agenda's own toggle was migrated onto it too, since the two couldn't otherwise match pixel-for-
pixel. Pulled `ToDoCard`, `CheckTarget`, and `EmptyState` out of the monolithic
`HomeChecklist.tsx` into their own files along the way.

**Follow-up pass**: removed repeated section-header icons across the Home dashboard (Today's
Agenda's `CalendarDays`, Today's Supplements' `Tablets` badge) so every card header reads as a
plain title + count/summary — the metric tiles (Workout/Water/Sleep) and top nav keep their icons
as the intended visual anchors, per the stated rationale (icons repeated on every section compete
with the content inside the cards; metric tiles and nav are a different, icon-centric pattern by
design).

**Verification**: `tsc -b` and `eslint --max-warnings 0` clean on both passes. Live-verified in
the local dev Docker stack: added a timed task, an untimed task, and tasks across a week, checked
the Day view time badge and Week view day-grouping (caught and fixed a locale-dependent day-label
bug — `toLocaleDateString`'s `{weekday, day}` field order flipped to "14 MON" instead of "MON 14"
on this container's locale; now built manually to pin the order), confirmed the empty-week
fallback, and confirmed the header-icon cleanup in both themes. Deployed to Pi5 in the same
`--force-recreate` deploy as the Workouts restructure above (one deploy covered both) — the
`due_time` migration was confirmed applied to the production DB as part of that.

## Status: Calendar feed cache silently dropping events — fixed and deployed (commit `103445d04`)

Reported by Isaac after connecting a real Google Calendar: "today's event shows up, then
disappears, then comes back" and "the 7-day [week] feed is not showing." Both turned out to be
one root cause, diagnosed by testing the live production feed directly (SSH + `docker exec` into
`sparkyfitness-sparkyfitness-server-1`, fetching the real `.ics` URL, and reproducing the exact
`eventsForFeedInRange` logic in a throwaway `node -e` script) rather than guessing from the code
alone — the bug only manifests on a **cache hit**, so testing against a fresh parse alone (which
is what the existing unit tests in `tests/calendarService.test.ts` did) never caught it.

**Root cause**: `calendarService.ts`'s `NodeCache` (15-minute TTL) defaults to `useClones: true`,
which deep-clones the parsed `ical.CalendarResponse` on every `.get()`. That clone breaks the
internal state of the RRule wrapper class `node-ical` attaches to any recurring `VEVENT` —
confirmed directly: calling `ical.expandRecurringEvent()` on the original parsed object works,
calling it on the *same object round-tripped through a default `NodeCache`* throws
`Invalid calling context`. That throw happens inside `eventsForFeedInRange`'s `for` loop, which
has no try/catch, so it aborts the whole function — and the outer `Promise.allSettled` in
`getAgenda` catches that as a rejected feed and drops **every event from that feed**, recurring
or not, not just the one that triggered it.

Net effect: only the very first agenda read after each 15-minute cache refresh returned real
data (a fresh parse, never cloned); every other read in that window returned nothing. A user
loading Day view first (warming the cache) and then switching to Week view would hit the broken
cache-hit path almost every time — matching "the week view is basically always empty" exactly,
while Day view would occasionally show correctly right after a refresh, matching the flicker.

**Fix**: added `useClones: false` to the `NodeCache` constructor — the parsed calendar is never
mutated after parsing, so there's no safety reason to clone it. One line. Two regression tests
added to `tests/calendarService.test.ts` (`feedCache clone behavior with recurring events`) that
directly reproduce the round-trip: one proves `useClones: false` survives it, one proves the
`node-cache` *default* (`useClones: true`) still throws — a tripwire if this ever gets
reintroduced elsewhere. Full backend suite (2853 tests) and `tsc -b` both clean. Deployed via a
backend-only rebuild (`--no-cache`, repo root as build context, `--force-recreate`) and
live-verified: 5 consecutive calls each to the Day and Week agenda endpoints all returned
identical, correct results (previously only call #1 would have).

**General lesson for this codebase**: any `NodeCache` (or similar) storing something other than
plain JSON — a class instance, anything from a third-party parser library — should default to
`useClones: false` unless there's a specific mutation-safety reason not to. The `announcementCache`
precedent this cache's own code comment cites stores plain data and was never at risk; don't
assume that precedent extends to a richer object type without checking.

## Status: Workouts tab redesign — deployed and live-verified (commits `71d5914`, `7243449`, `e630365`)

Replaced the old flat Workouts page (a 1,000+ row exercise table stacked on top of the presets
and plans tables) with a segmented **Routines & Programs / History / Exercise Library** layout.
This also happens to close out the old "Workout Logging Phase 3 remainder" and "Phase 4" items
from the section further below (muscle-group tags were dropped by choice — see that section for
why — but the Finish Workout summary modal and "Repeat last session" prefill are both now done,
in a more general form than originally spec'd).

**Routines & Programs**: an Active Program Widget shows the full weekly split for whichever
program is active, with a one-tap Start Workout for today's assignment; workout presets render
as a card grid (`WorkoutPresetCard.tsx`) instead of a table, each with Start/Log/Duplicate/Edit/
Delete; programs moved into a compact "Manage Programs" dialog instead of a permanent table
(`WorkoutPlansManager.tsx`), since there are usually only a handful.

**History** (genuinely new — `WorkoutsHistoryTab.tsx`, `WorkoutHistorySessionCard.tsx`): a
paginated logbook of every past session, calling a backend endpoint
(`GET /v2/exercise-entries/history`) that already existed but had zero frontend consumers before
this. Each session expands to show exact sets/weights, a PR badge, and a **Repeat Workout**
button that rebuilds a full playback draft from what was actually performed
(`createWorkoutPlaybackDraftFromSession` in `utils/workoutPlayback.ts`) — live-verified end to
end: repeating a session pre-filled all sets with the historical weights/reps/rest times,
completing them updated volume/rest-timer live, and finishing produced exactly one new session
in History (no duplicates).

**Exercise Library**: added muscle-group and equipment filters (reusing `BodyMapFilter.tsx` and
the equipment-chip pattern already used by `ExerciseSearch.tsx`) alongside the existing search/
category filters, and a new `ExerciseDetailModal.tsx` (muscle focus, image, an Epley-formula
estimated 1RM computed client-side from the existing ghost-value endpoint, and a 90-day volume
history chart via the existing-but-previously-frontend-unused
`GET /exercises/progress/:exerciseId` endpoint). Live-verified: for a logged 85kg×6 best set, the
modal correctly showed "Est. 1RM: 102 kg" (85 × 1.2, per Epley) and "Best Set: 85 kg × 6".

**Workout playback**: finishing a workout now shows a recap (`WorkoutFinishSummaryModal.tsx` —
duration, sets, volume, PR count) before returning to the previous screen, instead of saving and
navigating away silently. The habit-auto-completion on Finish (existing `WORKOUT_HABIT_PATTERN`
regex match) is unchanged, just runs before the modal opens instead of before an immediate
navigate.

**Two real backend bugs found and fixed, neither caught by the (fully green) test suite because
both need a real database to reproduce**:
1. **No enforcement of a single active workout plan per user** (`workoutPlanTemplateRepository.ts`)
   — activating a plan never deactivated any other active plan, so two could both carry
   `is_active = true`, and the active-plan lookup the new widget depends on would arbitrarily
   pick whichever row Postgres returned first. Fixed: deactivate every other plan for the user
   inside the same transaction whenever a create/update sets `is_active = true`. New test:
   `tests/workoutPlanTemplateRepository.activePlan.test.ts`.
2. **Every new user creation was broken** (`userRepository.ts`'s `ensureUserInitialization`) —
   it unconditionally inserted into `user_goals`, which the Ouroboros restructure hard-dropped
   weeks earlier without updating this function. This wasn't demo-mode-specific: regular signup
   calls the exact same function, so **any fresh account on this database has been failing to
   sign up since the restructure's DB migration first ran**, not just the public demo. Found
   only because this session spun up a local dev environment to visually verify the redesign and
   hit it trying to log in. Fixed by removing the dead insert (`user_goals` has no replacement
   here, the nutrition-goals feature it backed was deleted along with it).

**Dead code removed**: `ExerciseCard.tsx` and the five components it exclusively imported
(`EditExerciseEntryDialog`, `ExercisePlaybackModal`, `EditExerciseDatabaseDialog`,
`LogExerciseEntryDialog`, `ExerciseEntryDisplay`, `ExercisePresetEntryDisplay`) — a
diary-style exercise view with zero importers anywhere in the app, left over from before the
Home checklist + live workout playback replaced it. Confirmed zero external importers via a
dedicated Explore pass before deleting, not assumed.

**Verification**: backend 2,851/2,851 tests + clean typecheck; frontend 977/977 tests + clean
typecheck + clean lint (both scoped and full-repo runs, after every phase, not just at the end)
+ successful production `vite build` (confirmed a dedicated `WorkoutsPage-*.js` chunk in the
output). Live-verified on both a local dev Docker stack and the real Pi5 deployment via
Playwright — not just "the build succeeded," per this doc's own repeated lesson.

## Status: Calendar / Daily Agenda domain — built, deployed, and live-verified (commit `dcf045b2e`)

New owner-only domain (`calendar_feeds` table, Tier 1) letting the user subscribe to a Google/Apple/Outlook calendar via its iCal (`.ics`) URL and see a Day/Week agenda on the Home dashboard, with a "Launch Workout" quick action on any event whose title looks like a workout. Full domain scaffold following `agent-docs/new-domain-template.md` — see `agent-docs/file-and-domain-reference.md`'s "Focus & Calendar" section for the file map. Server-side fetch is 15-minute cached (`node-cache`, matching `announcementService.ts`'s precedent) and SSRF-guarded through the existing `utils/outboundUrlPolicy.ts` (previously AI-service-only — now documented in `SparkyFitnessServer/AGENTS.md` as general-purpose).

**Three real bugs were found and fixed only by deploying to the Pi5 and live-testing with a real public ICS feed (Google's "US Holidays" calendar) — none of them were caught by a clean build, typecheck, or the initial unit tests:**

1. **RLS was never actually enabled on the new table.** `create_owner_policy('calendar_feeds')` creates the *policy*, but `ENABLE ROW LEVEL SECURITY` is applied separately by a hardcoded table-name array earlier in `rls_policies.sql`, and the new table was missing from it. Caught by directly querying `pg_class.relrowsecurity` after deploying (`f`, should be `t`) rather than trusting the migration succeeded — the policy existed and looked fine in `\d calendar_feeds`, which is exactly why this is easy to miss. **If you add another domain, check `relrowsecurity` on the new table after deploying, don't just confirm the policy exists.**
2. **Week view showed six days in the past.** First implementation used a Monday-anchored calendar week (`weekStartFor`, mirroring `focusService.ts`'s convention) — fine for Focus's checklist, wrong here: with today on a Sunday, that week is almost entirely behind you. Fixed to a rolling 7-day window starting from the selected day, matching the spec's actual wording ("upcoming events for the rest of the week").
3. **All-day events landed on the wrong calendar day** on this specific server (`TZ=Australia/Melbourne`, UTC+10). `node-ical` parses a `VALUE=DATE` field as midnight in the *process's own* local timezone, then stores it as that instant's UTC equivalent — midnight Sep 7 AEST is `2026-09-06T14:00:00Z`. Naively serializing that with `toISOString()` recovers the wrong day on any non-UTC server. Fixed in `services/calendarService.ts`'s `allDayInstantToUtcMidnightIso` by re-deriving the calendar day via `Intl.DateTimeFormat` in that same local zone before re-anchoring it as UTC midnight. **The original unit tests only asserted `allDay: true` and never checked the actual date, so they passed the whole time** — a good reminder that a boolean flag test can hide a value being wrong underneath it. Dedicated round-trip tests now cover positive-offset, negative-offset, and UTC server zones.

**Two pre-existing, unrelated gaps noticed while running the full test suites (not fixed — out of scope for this feature, but worth knowing about)**:
- `pnpm test` in the frontend has been red for a while: `translationKeysCoverage.test.ts` was already failing before this session over ~12 missing keys from the Phase 2/3 workout-logging work and the Focus domain (both predate this session). This session's own new keys (`agenda.*`, `settings.calendar.*`) were added and are not part of that list.
- `WorkoutPlaybackPage.test.tsx` fails in the frontend suite with "You are passing an undefined module" from `i18next.use(initReactI18next)` — reproduces in full isolation, unrelated to anything touched today (last modified in yesterday's Phase 2 commit), not caused by this session's `pnpm add`/lockfile change (verified: no i18next-related lines in that diff).

## Status: Active Workout Logging feature — deployed and live-verified (commit `c50ac1f34`)

Phases 1-3 of the Exercise/dashboard-wiring plan (see "What's built" below for full detail) are now built, deployed, and live-verified end to end against a disposable test account at 390px in both light and dark theme. The predicted "Known risk" typecheck failure (see below) **did not recur** — the Phase 3 build passed `validate` (typecheck/lint/format/knip) clean on the first try, `3852213`.

**One real bug was found and fixed by live-verification, not by the build succeeding** — the same lesson this doc keeps re-learning: `WORKOUT_PLAYBACK_SET_GRID_CLASSES` (`utils/workoutPlayback.ts`) applied `min-w-[48rem]` (768px) unconditionally instead of scoped to `sm:`, forcing the mobile `grid-cols-4` set-row layout into a 768px-wide box with no `overflow-x-auto` ancestor to contain it and no horizontal scroll available at the document level. The new Phase 3 weight/rep stepper buttons sit at the *right* edge of that oversized flex row, so they rendered fully off-screen (DOM position ~x:640-794 on a 390px viewport) and were completely unreachable — not just visually cramped. Phase 2's "Previous: …" text passed its own live-verification fine because it sits at the *left* edge of the same wide row, which is why this went unnoticed until Phase 3 added content to the right edge. Fixed in `c50ac1f34` by scoping the min-width to `sm:` (matching every other class in that constant) — confirmed live: reps/weight steppers now render at ~x:200-340 and actually move the value (tested via real clicks, not just DOM presence).

**Gotcha hit during this session's live-verification, worth repeating for the next one**: the PWA service worker on `sparkyfitness.tail854f4e.ts.net` served a stale cached JS chunk (`Exercises-DHoJOXim.js`) even in a brand-new Playwright browser context, immediately after a fresh `--force-recreate` deploy — the "Start Blank Workout" button appeared genuinely missing until this was caught. Verify what's actually running with `performance.getEntriesByType('resource')` filtered to the chunk in question and compare against `docker run --rm --entrypoint sh <image> -c "grep -rl '<expected string>' /usr/share/nginx/html/assets/"` on the freshly built image; if they don't match, unregister service workers and clear caches (`navigator.serviceWorker.getRegistrations()` → `.unregister()`, `caches.keys()` → `.delete()`) and hard-navigate before trusting anything rendered. Don't burn time debugging a "missing" feature that's actually just a stale precache.

Confirmed live: Phase 1's 3-state Workout card (empty → in-progress → rich "10 mins • 45 kg" summary), auto-habit-completion (a "Workout" daily habit auto-checked with a streak badge on Finish), the week-strip dumbbell dot; Phase 2's "Previous: 5 kg × 3" hint and the 🏆 PR badge (triggered by completing a heavier/higher-rep set than the prior session's best); Phase 3's floating rest timer (only appears when a later set remains — correctly stays hidden when the completed set was the workout's last, since there's nothing to rest before), the sticky bar/floating-timer/bottom-nav vertical spacing (measured live: 15px clear gap between floating timer and sticky bar, 56px clear below the sticky bar for the nav — the hand-computed CSS offsets in the previous version of this doc were correct), and "Start Blank Workout" opening a buildable empty session.

**Known risk, already hit once (did not recur this session)**: `WorkoutPresetSet.reps`/`.weight` (from the shared `exerciseEntrySetRequestSchema`) are `number | null | undefined`, but several of the new PR/stepper functions were written assuming `number | null` (no `undefined`) — already fixed once in `isPrSet` (`?? null` at both comparison sites, commit `3de93febd`). The Phase 3 stepper code (`stepReps`/`stepWeight` in `WorkoutPlaybackSetRow.tsx`) uses `(reps ?? 0)`/`(weight ?? 0)`, which handles `undefined` correctly. Still worth knowing about if `tsc -b` ever throws a similar "undefined not assignable to X | null" error elsewhere: normalize with `?? null` (not just truthy checks) at the boundary.

### Not yet done from this feature

- Muscle-group color tags and the Finish Workout summary modal (Phase 3 scope, never started — see "What's built" below).
- Phase 4 ("Repeat last session" prefill) — not started.

### What's built so far (4-phase plan; full rationale/decisions were originally on a local plan file, `C:\Users\ICPET\.claude\plans\eager-wondering-dusk.md`, which may not survive to a new machine/session — the summary below is the durable copy)

The spec was "wire the Exercise section to the dashboard + upgrade workout logging UX" (routine templates, previous-performance display, PR detection, rest timer, set tags, a Finish modal, mobile steppers/sticky-bar, muscle-group color tags). Investigation found most of the *logging* half already existed as "Workout Playback" (`pages/Diary/WorkoutPlaybackPage.tsx` + `utils/workoutPlayback.ts` + subcomponents) — routines, a rest timer, set-type tags were all already there; the real gaps were: nothing connected it to the dashboard, `GET /v2/exercises/:id/stats` (bestSet/lastSet/recentSessions) existed server-side with zero web consumers, PR detection was a pure passthrough (`is_pr` always `false` from web, despite a comment claiming "the server owns PR detection" — it never did), and none of the mobile-ergonomics asks existed.

- **Phase 1 — deployed, live-verified, commit `866a677f9`.** Dashboard `WorkoutCard` 3-state rewrite (empty/active/completed), week-strip dumbbell dot, auto-habit-completion on Finish (regex match `/workout|gym/i` against that day's boolean/none-target daily habits — a string-match, there's no category field on `Focus` to key off instead). Confirmed working live with a real preset+habit+finish flow.
- **Phase 2 — pushed but the FIRST build attempt failed (fixed in `3de93febd`, not yet rebuilt).** `getExerciseStats` API call + `exerciseStatsQueryOptions`/`useWorkoutExerciseStats` (fans a per-exercise-id list out over `useQueries` — a dynamic count of `useQuery` calls would violate the rules of hooks). `WorkoutPlaybackSetRow` shows `"Previous: {weight} × {reps}"` matched by `set_number` against the most recent prior session. Real PR detection ported from `SparkyFitnessMobile/src/utils/workoutSession.ts` (`compareSetRecords`/`isWarmupSetType`/`isPrSet` — mobile already solved this exact problem client-side; porting a proven algorithm was judged lower-risk than adding new server-side PR-stamping to a shared transaction path). **Test file updated** (`tests/components/WorkoutPlaybackPage.test.tsx`) to mock the two new hook dependencies (`@/hooks/useFocus`, `useWorkoutExerciseStats`) — the established pattern in this codebase is "components import wrapped hooks from `hooks/*`, tests mock those modules, never exercise raw react-query," so a direct `useQueries` call in the page itself would have broken that isolation; it's wrapped in `useWorkoutExerciseStats` in the hooks file instead specifically to keep that pattern intact.
- **Phase 3 — deployed and live-verified, commits `3852213` (feature) + `c50ac1f34` (mobile-overflow fix, see "Status" above).** Floating rest timer (+30s) via `extendWorkoutPlaybackRestTimer` + new `WorkoutPlaybackFloatingRestTimer.tsx` — confirmed it only appears when a later set remains (correctly absent when the completed set was the workout's last). Weight/rep steppers in `WorkoutPlaybackSetRow.tsx` (share a row with the "Previous:" hint to avoid bloating an already-dense row further) — confirmed they actually move the value, after fixing the mobile overflow bug that made them unreachable. `addExerciseToWorkoutDraft` + `createBlankWorkoutPlaybackDraft` in `utils/workoutPlayback.ts`, wired to a new `WorkoutPlaybackStickyBar.tsx` (mobile-only, "+ Add Exercise" reuses the existing `AddExerciseDialog` in `mode="preset"` — deliberately not a new mode, since `'preset'`'s existing tab-visibility/title behavior is already exactly right for a live session) and a "Start Blank Workout" button added to `WorkoutPresetsManager.tsx`'s existing Start Workout dialog — confirmed live.
  - **NOT done**: muscle-group color tags (was going to be `fetchExerciseDetails` per exercise_id via the same `useQueries` fan-out pattern as stats, `primary_muscles[0]` through a small fixed palette mirroring the Home redesign's `--metric-*` token pattern in `index.css` — never started).
  - **NOT done**: the Finish Workout summary modal (total time/volume/set count + a PR celebration list) — spec'd, never started. `handleFinishWorkout` in `WorkoutPlaybackPage.tsx` still navigates away immediately on success with no modal.
- **Phase 4 — not started at all.** "Repeat last session" (prefill a preset's sets from `useExerciseHistory(exercise_id, 1)` per exercise instead of the preset's static template — deliberately per-exercise, not per-preset-session, since there's no clean "most recent complete session of preset X" lookup and presets can be edited between sessions).

## Status: Home dashboard redesigned and deployed (commit `2ca20b3ce`)

The Home checklist (`/`) and its surrounding chrome were redesigned toward an Apple Fitness / Lifesum / Things 3 feel — circular-progress metric cards (Workout/Water/Sleep, with a "+Nml" quick-add on Water and a tap-to-log CTA on Sleep), a pill-carousel week strip with per-day completion dots, a shared circular check-target for to-dos/habits (pop-animates on toggle), an inline progress bar + quick stepper for numeric habits, encouraging empty states, a transparent-background SVG header logo (`BrandMark`), Sign Out moved to Settings > Profile, and a pill-active/FAB mobile bottom nav. Deployed and live-verified at 390px in both themes (see `docs/history` — actually see the commits below; no separate history doc for this one).

Two real bugs were caught and fixed only by live-testing (not by the build succeeding):
1. `WEEKDAY_LABELS[idx]` types as `string | undefined` under this repo's `noUncheckedIndexedAccess` — a typecheck failure, not a runtime bug, but it did block the first deploy attempt.
2. The bigger one: **the week strip's 7 pills + 2 chevrons don't all fit at 390px, and nothing scrolled the selected pill into view** — so "today" (often the last pill, e.g. a Saturday) was silently scrolled off-screen on load, defeating the entire "prominent highlighted selected pill" point of the redesign. Fixed in `2ca20b3ce` by forwarding a ref from `DayPill` and calling `scrollIntoView({ inline: 'center' })` on the selected one whenever `selectedDate` changes. Confirmed live with a screenshot (Sat 12 centered and visible) — screenshotting one screen isn't enough on its own here; the earlier screenshot *looked* fine at a glance (6 pills visible, mildly truncated 7th) and the bug only became obvious by reading the actual day labels/numbers rendered.

**Process note, reinforced again this session**: keep live-verifying every visual change against the *actual rendered content*, not just "did a screenshot render without visual glitches." The overflow-fix saga (below) and this week-strip bug are two different sessions catching two different classes of "looks fine in the build, wrong in the browser" failure.

## Status: sets-table overflow fix deployed and live-verified (commit `8d8369d54`)

The previous handoff's "PICK UP HERE" fix (`bdb5d557c`) was deployed and live-tested — and the live test caught that it **did not actually work**: the whole Edit Workout Plan / Create Workout Preset dialog still scrolled sideways as one unit at 390px, identical to the original bug report. This is now fixed for real in `8d8369d54`, deployed, and confirmed live (DOM measurement + screenshot: dialog `scrollWidth === clientWidth`, Plan Name doesn't move when the dialog is scrolled, only the sets table itself has an internal scrollbar). See item 9 below for the corrected root-cause diagnosis and fix — read it before touching this dialog/table pattern again, it explains a real, non-obvious CSS trap (`overflow-x-auto` on a deeply-nested descendant does nothing on its own; the *direct grid-item ancestor* of the dialog's top-level `grid` wrapper needs `min-w-0` too).

**Process note for future sessions**: the previous session marked `bdb5d557c` as "not yet deployed" and stopped there without live-testing it. Don't trust a fix like this is correct just because the build succeeded and the intended code shipped — actually reproduce the original bug live (real browser, real viewport, real interaction) after every deploy of a visual/layout fix, the way step 7 below does. A clean build and a present class name are not the same thing as a fixed bug.

**Branding**: the app is user-facing-rebranded to **"Ouroboros Life"** (new icon, title, manifest, header, auth pages) — but the repo name, package names, Docker image tags (`sparkyfitness_server:custom`, `sparkyfitness:custom`), env var prefixes (`SPARKY_FITNESS_*`), and all internal code/file naming deliberately stayed "SparkyFitness" (renaming those would be high-blast-radius for zero user-facing benefit). Don't be confused when infra commands still say "sparkyfitness" — that's intentional and correct.

## Where everything lives

- **Fork**: `github.com/3daysl8/SparkyFitness`, upstream = `github.com/CodeWithCJ/SparkyFitness` (remote `upstream`).
- **Local dev clone**: `C:\dev\SparkyFitness` on the Windows PC "Kingdom" — do development here.
- **Build clone on Pi5**: `/home/pi1/sparkyfitness-build` — `git pull` here, then build images. Not the deployed instance.
- **Deployed instance**: `/home/pi1/sparkyfitness/` on Pi5 (`100.103.152.66`), managed via `docker-compose.yml` + `.env` in that directory. Reached over Tailscale only, three ways:
  - `https://sparkyfitness.tail854f4e.ts.net` — dedicated Tailscale identity (own sidecar container, see below), the one installed as a home-screen app. **Use this as the primary URL.**
  - `https://rasp-pi.tail854f4e.ts.net:8443` — older HTTPS wrapper on Pi5's main dashboard hostname.
  - `http://100.103.152.66:3004` — plain IP, always works, no padlock.
  - All three must stay listed in `.env`'s `SPARKY_FITNESS_EXTRA_TRUSTED_ORIGINS` (comma-separated) or logins from that origin silently fail — this bit twice already.
- **Admin login**: `3daysl8@gmail.com` (auto-admin via `SPARKY_FITNESS_ADMIN_EMAIL` in `.env`), password is whatever the user set at signup (not stored anywhere I can see).
- **SSH to Pi5**: `ssh -i ~/.ssh/id_ed25519_pi5 pi1@100.103.152.66` (key already present on Kingdom).

## Architecture decisions already made (don't re-litigate without reason)

- **Host on Pi5, not Kingdom** — Pi5 is always-on; Kingdom sleeps and is only woken via WoL, unacceptable latency for a workout-logging app used mid-gym.
- **Docker images are custom-built from source**, not the upstream `codewithcj/*` prebuilt ones — building was needed the moment we added new tables/routes. Build natively on Pi5 (arm64), no cross-compilation needed (`FROM --platform=$BUILDPLATFORM` already handles it).
- **Remote access = Tailscale only**, no port-forwarding, no public exposure, matching the rest of this user's home infra.
- **A separate Tailscale sidecar container** (`sparkyfitness-tailscale` service in the compose file, `tailscale/tailscale` image, own node identity, own auth key already consumed and stored — see `.env`'s `SPARKY_TS_AUTHKEY`) exists solely so this app has its own distinct Tailscale hostname — Android was conflating it with another self-hosted app (the "content hub") that shares the same Pi5 `rasp-pi` hostname otherwise.
- **Nutrition tracking is hidden, not deleted** — Foods tab/quick-add removed from nav (`MainLayout.tsx`), all data/routes/tables untouched, fully reversible.
- **New "Focus & Motivation" domain** built from scratch (not shoehorned into the existing rigid `user_goals` nutrition table or the generic-but-target-less `custom_categories` habit system) — tables `focus_domains`, `focuses`, `focus_checkins`. Owner-only RLS tier, same as Cycle/Pregnancy.
- **The app's landing page (`/`) is now a Tasks & Habits-style checklist** (`HomeChecklist.tsx`), not the nutrition-oriented Diary dashboard. Diary moved to its own `/diary` tab.
- **Reports (charts/graphs) tab is hidden, not deleted** — same pattern as nutrition. Removed from desktop tabs and the mobile bottom bar; route/data/permission-gated delegate view untouched.
- **Mobile bottom bar is Home / Exercises / Add / Settings**, not Home / Reports / Add / Settings — Exercises got the freed-up always-visible slot since the bottom bar only has 4 slots and Reports wasn't needed there. Exercises was also removed from the mobile "+" Add sheet since it's no longer needed as a duplicate entry point.
- **Adding a to-do or habit has two purpose-built entry points on Home**, not one ambiguous dialog — a "+" on the To-Do List card opens a one-off (statement + date) dialog, a "+" on the Daily Habits card opens a recurring (statement + days-of-week + end date) dialog. The Focus page's original combined "+"/checkbox dialog still exists for the fuller editor (domains, targets). Both share a `WeekdayToggle` component (`pages/Focus/WeekdayToggle.tsx`).

## What's built (item 9's overflow fix and everything after it are deployed and live-verified — see "Status" sections above)

1. **Focus & Motivation backend**: migration (`focus_domains`/`focuses`/`focus_checkins` + later `recurrence_days_of_week`/`recurrence_end_date` on `focuses`), routes (`routes/v2/focusRoutes.ts`), service/repository (`services/focusService.ts`, `models/focusRepository.ts`), Zod schemas (`schemas/focusSchemas.ts`).
2. **AI/MCP tool**: `sparky_manage_focus` (`ai/tools/focusTools.ts` + `ai/tools/schemas/focus.ts`), registered under the existing `goals` chat-tool category — so both the in-app AI chat and any external MCP client (e.g. Hermes) get it automatically, including the `get_today` action (resolves scheduled items + recurring habits w/ streaks + weekly/long-term focuses for any date).
3. **Frontend**:
   - `pages/Focus/FocusPage.tsx` — manage domains, create/edit focuses (daily/weekly/long-term), a date picker for one-off scheduled daily focuses, a "make recurring" toggle (day-of-week exclusion + optional end date) for standing habits, check-in dialog, check-in history.
   - `pages/Home/HomeChecklist.tsx` — the landing page: week-strip date selector, collapsible "To-Do List" and "Daily Habits" (each with its own quick-add "+", see above), streak badges and quick check-off, plus a thin status strip linking into the real Exercises/Diary/Check-In tabs for workout/water/sleep.
   - Nav updated (`layouts/MainLayout.tsx`, `App.tsx`) — `/` → `HomeChecklist`, `/diary` → the old `Diary` page, `/focus` → `FocusPage`.
4. **Streak computation bug fixed** (`services/focusService.ts`'s `computeStreak`): it used to break a habit's streak on every day excluded by `recurrence_days_of_week` (e.g. a Mon-Fri habit reset to a streak of 1 every Monday, since Sunday had no check-in). Fixed to skip non-scheduled days when walking backward instead of treating them as a miss. Covered by real test coverage now (`tests/focusService.test.ts`, `tests/focusRepository.test.ts` — the Focus domain had none before). Verified live via Playwright, not just unit tests.
5. **Exercise search "not showing results" bug fixed** (`pages/Exercises/ExerciseSearch.tsx`): the Online-tab search against Wger/Free Exercise DB was actually working correctly end-to-end (network request, backend, result data all fine) — the interactive body-map muscle diagram above the results was just tall enough (worse on mobile) that a completed search produced no visible change above the fold. Collapsed the body map behind a "Filter by muscle" toggle, closed by default.
6. **Wger search "API error" fixed — real networking bug, not app logic** (`index.ts`): Wger calls were failing with `fetch failed` / `ETIMEDOUT` while Free Exercise DB (GitHub-hosted) worked fine. Root cause: `wger.de` publishes an IPv6 DNS record that this Docker deployment can't actually route (`ENETUNREACH`), and Node's Happy-Eyeballs (`autoSelectFamily`) races IPv4 against that dead IPv6 candidate with a short (~250ms) per-attempt timeout — real round-trip latency to wger.de exceeds that budget even on the IPv4 path that works fine unraced (confirmed live: unraced fetch ~1s, raced fetch fails at ~320ms). Fixed with `dns.setDefaultResultOrder('ipv4first')` *and* `net.setDefaultAutoSelectFamily(false)` at the top of `index.ts` — the DNS-order call alone was not sufficient, both are needed. This is a general fix, not Wger-specific: any other outbound API this server calls that happens to have an IPv6 record would hit the same failure mode.
7. **Double-nested Dialog bug fixed** (`pages/Exercises/AddWorkoutPlanDialog.tsx` + `AddExerciseDialog.tsx`): "Add Exercise" for a day inside the workout-plan editor was opening `AddExerciseDialog` — already a complete, self-contained Radix `Dialog` — wrapped in a *second*, separate `Dialog` just to give it a custom title. Two independently-centered, independently-sized dialogs stacked on the same open state looked tolerable on desktop (they roughly overlapped) but broke visibly on a phone-width screen (competing widths, doubled close buttons). Fixed by making `AddExerciseDialog`'s own title/description mode-aware (`mode === 'workout-plan'` shows the "Add Exercise or Preset" copy) and deleting the redundant outer wrapper — verified live at a 390px viewport, exactly one dialog now. **General lesson for this codebase**: `AddExerciseDialog` is always a full dialog in itself: never wrap it in another `Dialog`/`DialogContent` — pass it a `mode` and render it directly, the way `AddExerciseDialog.tsx` itself already does for its other modes.
9. **Workout-plan editor: sets table forcing the whole dialog into horizontal scroll — fixed, deployed, live-verified** (`pages/Exercises/SortableExerciseItem.tsx`, `AddWorkoutPlanDialog.tsx`, `WorkoutPresetForm.tsx`). Reported as "opened edit workout plan and it opened full size" / "I have to move it sideways and up and down." Reproduced live at 390px: adding an exercise with sets made the *entire* Edit Workout Plan dialog scroll sideways (plan name, dates, other days too), not just the sets area.
   - **First attempt (`bdb5d557c`) did not actually fix it** — this is the important lesson. It added `truncate`/`min-w-0` to the title and wrapped the sets grid in its own `overflow-x-auto`, reasoning that "an element with non-visible overflow has an automatic minimum size of zero, so it can't push its ancestors wider." That reasoning is only true for a flex/grid item that *directly* has non-visible overflow — the `overflow-x-auto` div here is nested many plain-block layers deep inside the dialog (`Card` → `space-y-3` → `border` card → …), not a direct grid item of anything, so the rule never engaged. Deployed and live-tested at 390px with real DOM measurement (`dialog.scrollWidth` vs `dialog.clientWidth`, and confirming Plan Name moved in lockstep when the dialog was scrolled) — the whole dialog still scrolled as one unit, identical to the original bug. **Don't trust "the fix's class names are present in the built JS" as verification — that only proves the code shipped, not that it works. Always reproduce the actual bug live after deploying a layout fix.**
   - **Actual root cause, found by bisecting live via `element.style.minWidth = '0px'` at each ancestor level and re-measuring `dialog.scrollWidth` after each**: `DialogContent` (`components/ui/dialog.tsx`) is `display: grid` with no explicit `grid-template-columns`, so its single implicit column's width is driven by its *direct grid-item children's* automatic minimum size — and "automatic minimum size is zero for a scroll container" is a rule that applies specifically to that direct grid/flex item itself, not to an arbitrarily-nested descendant several plain-`div` levels down. The sets table's `overflow-x-auto` wrapper is deeply nested, so it never got the zero-minimum treatment; the *actual* direct grid item that needed it was the `<div className="space-y-4">` wrapping the whole "Assignments" day-list in `AddWorkoutPlanDialog.tsx` (and the equivalent unstyled `<div>` wrapping "Exercises" in `WorkoutPresetForm.tsx`).
   - **Real fix**: add `min-w-0` to that direct grid-item ancestor specifically — `AddWorkoutPlanDialog.tsx`'s Assignments wrapper and `WorkoutPresetForm.tsx`'s Exercises wrapper — on top of keeping the earlier `overflow-x-auto`/`truncate` changes (both are still needed; neither alone is sufficient). Verified live: `dialog.scrollWidth === dialog.clientWidth` (whole dialog no longer overflows, Plan Name field doesn't move when the dialog is scrolled), while the sets table's own `overflow-x-auto` wrapper still correctly shows `scrollWidth > clientWidth` (it, and only it, scrolls internally) — confirmed with a screenshot showing a visible scrollbar under just the sets table.
   - **General lesson for this codebase**: wrapping a wide element in `overflow-x-auto` only contains it if the ancestor chain up to the nearest grid/flex container *also* has `min-w-0` on the actual direct item of that container — not on some other nearby-looking wrapper. When adding this pattern elsewhere, verify by bisecting live (`el.style.minWidth = '0px'` at each ancestor, re-measure) rather than assuming the CSS spec rule applies at whatever nesting level felt natural. `CardioLog.tsx`'s grid was checked and is already responsive (`grid-cols-2 md:grid-cols-5`) — not affected.
10. Commits since `a4a62e044`: `976bbc108` (streak fix + Focus tests), `3bacf46ed` (removed footer OSS branding — version/What's New/star/sponsor — from the footer only, header star/sponsor left as-is since not asked), `b0d19dc8e` (Home quick-add), `9e042dd53` (nav simplification + Ouroboros Life rebrand), `747a1927b` (exercise search layout fix), `5996a0f05` + `c2baa5cee` (Wger networking fix, two commits), `2830e85d2` (double-nested Dialog fix), `bdb5d557c` (sets-table overflow fix attempt #1 — deployed but didn't work, see item 9), `8d8369d54` (sets-table overflow fix attempt #2 — deployed and live-verified working, item 9), `3852213` (Phase 3 workout-logging feature — floating rest timer, steppers, sticky bar, blank workout), `c50ac1f34` (Phase 3 mobile-overflow fix — see "Status: Active Workout Logging feature" above). All build clean (`tsc`, `eslint --max-warnings 0`, `knip`, full test suite) across backend/frontend/shared. `prettier --check` fails repo-wide due to a pre-existing Windows CRLF checkout artifact (`core.autocrlf=true`), unrelated to this work — don't chase it.
11. **Home dashboard redesign — deployed, live-verified in both themes** (`pages/Home/HomeChecklist.tsx`, `layouts/MainLayout.tsx`, `pages/Settings/ProfileInformation.tsx`, new `components/BrandMark.tsx` + `components/ui/circular-progress.tsx` + `hooks/useSignOut.ts`, new `metric-workout`/`metric-water`/`metric-sleep` tokens + `check-pop` keyframe + `.no-scrollbar` utility in `index.css`). See the "Status" section at the top of this doc for the two bugs this caught. Commits: `0f3f6f193` (main redesign), `daa1d215c` (typecheck fix — `noUncheckedIndexedAccess` on an array-indexed prop), `2ca20b3ce` (week-strip selected-pill auto-scroll fix). Water's quick-add ("+Nml" button) intentionally simplifies `WaterIntake.tsx`'s full linked-food serving-size math to just "explicit container volume, else 250ml default" — the Diary water card remains the source of truth for that edge case. The Home page's own "Add Habit" dialog still only creates boolean/none-target habits (no `target_type` field in that form) — a numeric habit like "Walk 10,000 Steps" has to be created via `/focus`'s fuller editor to exercise the new progress-bar-and-stepper row.

## Known gotchas (learned the hard way this session — don't repeat)

- **`docker compose up -d` does NOT reload `.env` changes on an already-running container** — it needs `docker compose up -d` to actually recreate it (a plain `restart` never picks up new env vars; this bit us twice on `SPARKY_FITNESS_EXTRA_TRUSTED_ORIGINS`).
- **`docker compose up -d` also won't recreate a container just because the image tag was rebuilt** if nothing in the compose service definition changed — it compared config, not image digest. Use `docker compose up -d --force-recreate <service>` after rebuilding an image, or it'll keep running the old container.
- **Docker's build cache can silently serve stale output** even when source genuinely changed — this happened once already (a rebuilt frontend image was missing the new page entirely, despite `docker build` exiting 0). Always verify: `docker run --rm --entrypoint sh <image> -c "ls /usr/share/nginx/html/assets/ | grep <ExpectedNewChunkName>"` before deploying; use `--no-cache` if in doubt.
- **Docker's build cache can also serve an actively *corrupted* cached layer**, not just stale output — hit this **three times in one session**, on both frontend and backend builds: a `pnpm install`/`pnpm deploy` layer had a byte-corrupted or invalid-UTF-8 third-party file each time (a different file each time — `node_modules/.../dist/index.d.ts`, `zxing-js.umd.js`, then a "Bad control character in string literal in JSON" reading pnpm's own content-addressable store), failing `tsc`/rolldown/pnpm itself with unrelated-looking single-file parse errors. `docker build --no-cache` fixed it every time; a plain rebuild without `--no-cache` after a prior `--no-cache` build can reintroduce it (the freshly-built layer gets corrupted again and then cached). **Given how often this recurs, just always pass `--no-cache` for both Dockerfiles on this host** rather than trying a plain build first — treat a plain rebuild as the exception, not the default. `docker builder prune -af` (not just `-f`) after a deploy clears it fully (took the cache from ~10GB down to 0B last time) and is worth doing after every deploy on this host, not just when something breaks.
- **Git identity isn't configured on Kingdom for this repo** — set locally (not `--global`) as `3daysl8` / `3daysl8@gmail.com` if a fresh clone needs it again.
- Windows checkout has `core.autocrlf=true`, so `git add` always warns about LF→CRLF — harmless, ignore it.
- **A disposable test account created via real signup (not raw DB writes) is the reliable way to visually verify a deploy** with Playwright/browser tools — the admin password isn't known/stored anywhere. Sign up with a `*@example.invalid` email, verify, then clean up: `docker exec sparkyfitness-db psql -U sparky -d sparkyfitness_db -c "DELETE FROM \"user\" WHERE email = '...';"` (that's `sparky`/`sparkyfitness_db`, not `sparkyfitness`/`sparkyfitness` — check `docker exec sparkyfitness-db env | grep POSTGRES` if unsure) — every FK to `user` is `ON DELETE CASCADE` (confirmed by querying `information_schema.referential_constraints`), so one DELETE cleans up everything with no orphaned rows.
- **`docker/Docker_deploy_manual_command.md` describes the wrong build for this fork and will produce a failed build if followed literally.** It documents the *upstream* project's multi-arch DockerHub publish flow (`docker buildx build ... -f docker/Dockerfile.backend SparkyFitnessServer --push`), which uses `SparkyFitnessServer` as the build context. This fork's `Dockerfile.backend`/`Dockerfile.frontend` are written for a pnpm-workspace monorepo (they `COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./` and `COPY shared/ shared/` before anything else) and need the **repo root** (`.`, run from `/home/pi1/sparkyfitness-build`) as the build context, not `SparkyFitnessServer`. Using the wrong context fails fast and loudly (`COPY shared/ shared/: "/shared": not found`), so it's not a silent-corruption risk like the cache issues below — just don't trust that doc file's exact invocation. The correct commands: `docker build --no-cache -t sparkyfitness_server:custom -f docker/Dockerfile.backend .` and `docker build --no-cache -t sparkyfitness:custom -f docker/Dockerfile.frontend .`, both from `/home/pi1/sparkyfitness-build`. Matches the dev compose file's own `build: { context: .., dockerfile: docker/Dockerfile.backend.dev }` pattern — check that file first next time instead of the manual-command doc.
- **A raw HTTP client hitting `/mcp` without both `Accept: application/json` and `Accept: text/event-stream` gets a `406 Not Acceptable`** ("Client must accept both application/json and text/event-stream") before auth is even checked — this is the MCP StreamableHTTP transport spec's own requirement, enforced by the SDK, not a bug in this app. Hit this connecting Hermes (2026-09-13): its native HTTP MCP client sends a plain `Accept: */*` and 406s every time, which looks exactly like an auth failure (it fails right after the "does this need auth" step) but isn't — confirmed by curling the same endpoint with the correct dual `Accept` header and the same key, which worked immediately. If a future client 406s here, check its `Accept` header before assuming the key is bad; the `mcp-remote` npm bridge (already documented above in the MCP setup docs) sends it correctly and is the fallback for any client that doesn't.
- **The PWA service worker can serve a stale cached JS chunk even in a brand-new Playwright browser context, immediately after a fresh `--force-recreate` deploy** — a feature that's genuinely in the deployed image can still appear "missing" live because the browser is running an old precached bundle. Compare `performance.getEntriesByType('resource')` (filtered to the chunk in question) against what's actually in the freshly built image; if they don't match, unregister service workers (`navigator.serviceWorker.getRegistrations()` → `.unregister()`) and clear caches (`caches.keys()` → `.delete()`) before hard-navigating and trusting anything rendered. This app also has a named-theme cycle (`localStorage['theme']` — `system`/`light`/`dark`/plus at least one branded palette like `whoop`) behind the single header toggle button; don't assume the button's next click lands on plain "dark", set `localStorage.theme` directly and reload if you need a specific one for a screenshot.
- **The dev Docker stack's `shared/` package is baked into the image at build time, not bind-mounted** (`docker/docker-compose.dev.yml` only mounts `SparkyFitnessServer/`/`SparkyFitnessFrontend/`) — a `docker restart` after editing `shared/` is not enough. The backend starts and then crashes with `SyntaxError: The requested module '@workspace/shared' does not provide an export named '...'`; the frontend throws the same thing from Vite (`/@fs/app/shared/src/index.ts does not provide an export named ...`) even after its own `.vite` cache is cleared and the container restarted, because the *image's* copy of `shared/` is what's stale, not a runtime cache. Fix: `docker compose --env-file .env -f docker/docker-compose.dev.yml build --no-cache <service>` (`sparkyfitness-server` and/or `sparkyfitness-frontend`) then `up -d --force-recreate <service>` — for both, if `shared/` changed. Also: running `docker compose build` from inside `docker/` (instead of the repo root) silently drops the `../.env` variable interpolation and fails with `required variable ... is missing a value` even though the file exists at the expected relative path — pass `--env-file .env` explicitly and/or run from the repo root to be safe. Hit this 2026-09-15 across two Phase-1-and-2-era `shared/` changes; check this first if the **dev** stack throws a missing-shared-export error after only editing `shared/`.
- **A multi-column partial unique index's uniqueness only holds across the *combination* of its indexed columns, not each column independently** — a cleanup/dedup query that checks such a key one column at a time will silently mis-delete or mis-spare rows whenever two different key-combinations happen to share a value in just one column. Hit this 2026-09-15 building `planned_workouts`' `(template_id, generated_for_date, slot)` regeneration key: `slot` is only unique *per day-of-week* (each day's assignments are independently 0-indexed), so a first-draft cleanup DELETE comparing bare `slot` values across different dates treated every day's "slot 0" as the same slot and wrongly spared (or deleted) the wrong day's row. The real-database integration test caught this immediately; a mocked unit test never would have. Fix: compare the full column tuple, e.g. `NOT EXISTS (SELECT 1 FROM unnest($dates::date[], $slots::smallint[]) AS d(date, slot) WHERE d.date = tbl.col_a AND d.slot = tbl.col_b)` rather than `NOT (col_b = ANY($slots))`. Worth remembering for any future multi-column-keyed partial-unique table.
- **A TypeScript package with no bundled `.d.ts` and no `noImplicitAny` diagnostic on an *existing* import site can still be genuinely untyped** — `pg-format` (used by several repository files for bulk `INSERT ... VALUES %L`) has no types at all, but only newly-added files importing it surfaced `TS7016`; existing files turned out to each carry their own `// @ts-expect-error TS(7016)` comment suppressing it, which isn't obvious from a quick grep for the import line alone. Added a proper ambient declaration (`types/pg-format.d.ts`, matching the existing `types/garmin-fitsdk.d.ts` precedent for untyped packages) instead of another suppression — this made the old per-file `@ts-expect-error` comments stale (`TS2578: Unused '@ts-expect-error' directive`), so they all had to come out together. If tsc ever flags an unused `@ts-expect-error` on an import line, check whether a *different* file just added a real ambient type for that module.
- **Spreading a value with an unresolvable type (e.g. from a dynamic `import()` of a non-literal, variable path) into an object literal silently widens the *entire* literal's inferred type**, not just that one spread's contribution — `models/exerciseRepository.ts` did `const { default: x } = await import(somePathVariable); export default { ...a, ...b, ...x, ... }`, and because `x` was untypeable (TS can't statically resolve a variable-path dynamic import), the whole merged default export object's type collapsed toward permissive/untyped for every key, not just `x`'s. This silently masked a real type-safety gap in an unrelated test file (`exerciseSourceScoping.test.ts` called `.mockResolvedValueOnce` directly on a property with no compile-time indication it needed `vi.mocked()` or a suppression comment, because the whole object was too loosely typed to catch it) until the dead spread was removed for an unrelated reason (deleting `exerciseTemplate.ts`, whose exports `x` was pulling in). If removing a spread from a merged default-export object suddenly produces type errors in files that never imported that spread's source directly, check whether the removed spread was the thing quietly keeping the *whole* merged type loose.
- **A live-deployed compose file can silently diverge from the repo's own tracked `docker/docker-compose.prod.yml`, and a service block being commented out in the repo doesn't mean it's commented out (or correctly configured) on the actual running host, or vice versa** — found this because Garmin's service block was commented out in *both* places independently (upstream's stale "still WIP" comment never got cleaned up when this fork actually built the feature), but the live `/home/pi1/sparkyfitness/docker-compose.yml` already has several deliberate un-committed differences from the tracked file (custom image tags, restart policy, a pinned frontend port, an extra Tailscale sidecar). **Before trusting either file's contents, check the other one and check what's actually running (`docker ps`)** — don't assume they agree.
- **A component or hook that TypeScript happily compiles and knip doesn't flag can still be completely dead if you only grep for its import, not its actual JSX usage** — `DailyHealthMetricsCard`/`useDailyHealthMetrics` had zero consumers anywhere in the app (the component that was supposed to use it referenced a page that no longer exists), which `grep -l` for the component name across `pages/` correctly showed as zero matches — but a quicker surface-level check (does the export exist, does it typecheck) would have missed it. When investigating "does this built feature actually show up anywhere," grep for `<ComponentName` or the hook's call site specifically, not just its existence.
- **Running `prettier --write` (or `pnpm run format`) with no path filter, repo-wide, on this Windows/Kingdom checkout makes `git status` show hundreds of files as modified even when almost none of them actually changed content.** `core.autocrlf=true` (local git config) collides with this repo's `.gitattributes` (`* text=auto eol=lf`): prettier rewrites every file it touches, and the resulting bytes trip `git status`'s modified-check even where `git diff` shows zero real difference. Hit this 2026-09-18: `pnpm run format` with no args during the redesign's Phase 1 flagged 616 files, but `git diff --shortstat` showed real content changes in only 39. Recovery recipe: `comm -23 <(git status --short | awk '$1=="M"{print $2}' | sort) <(git diff --name-only | sort)` gives the phantom set, then `git checkout --pathspec-from-file=<that list> --` restores them (exclude untracked `??` files from the list first, or the pathspec errors and the whole checkout aborts — even for the files that would've matched). **Always scope `prettier --write`/`pnpm run format` to the specific files or directories actually being changed on this box, never run it bare.**
- **`--border` (and any other alpha-bearing HSL CSS variable, e.g. `0 0% 100% / 0.06`) does NOT combine safely with a Tailwind v4 opacity modifier.** `border-border/50` compiles to `color-mix(in srgb, hsl(var(--border)) 50%, transparent)` (confirmed from actual `vite build` output, not assumed) — this multiplies the modifier against the token's own already-baked-in alpha rather than erroring, so a `/50` on a 6%-alpha token renders at ~3% opacity, not 50%. This isn't unique to `--border`: it'll bite any future alpha-bearing token the same way. Use a second, non-modified token at the target alpha instead (this is why `--border-strong` exists) — never stack a Tailwind opacity modifier on top of a CSS variable that already carries its own alpha channel.

## Not yet done (from the original broader plan — still open)

0. ~~Workout-mapping fix, Phases 1–6~~ — **DONE (2026-09-17), all 6 phases shipped** (plan: `C:\Users\ICPET\.claude\plans\help-me-plan-splendid-sphinx.md`). Session integrity, the planned-workout domain, planning UI, the MCP tool, weekly goals, and finally the approval-gated repair script for the known-bad production rows — all merged and deployed, see "PICK UP HERE" above for Phase 6's close-out. Nothing left open from this plan.
1. **Wire the in-app AI chatbot to Kingdom's Ollama** (`http://100.68.231.84:11434/v1`, admin-only AI setting, no `ALLOW_PRIVATE_NETWORK_AI` change needed). `OLLAMA_CONTEXT_LENGTH` may need raising on Kingdom for reliable tool-calling.
2. **Hermes integration — connection now DONE (2026-09-13); the morning-briefing automation itself is not.**
   - **Correction to this doc's own earlier assumption**: Hermes is **not** an n8n workflow. It's its own container on Pi5 (`docker ps` shows `hermes`, image `nousresearch/hermes-agent:v2026.8.27`), configured via `/home/pi1/.hermes/config.yaml` (bind-mounted into the container at `/opt/data`) and driven by its own CLI (`hermes mcp add/list/test/...`). `n8n` also runs on this Pi5 (container `n8n`) but is a separate, unrelated thing — don't conflate them, and don't plan a "wire it up via an n8n workflow" step again without checking first.
   - **Connected**: added as an MCP server via `docker exec -it hermes hermes mcp add sparkyfitness --command npx --env "AUTH_HEADER=Bearer <API_KEY>" --args -y mcp-remote https://sparkyfitness.tail854f4e.ts.net/mcp --header "Authorization:${AUTH_HEADER}"`, all 32 tools enabled. Verify with `docker exec hermes hermes mcp list`.
   - **Why the stdio bridge, not a direct URL**: Hermes' native `hermes mcp add --url ... --auth header` HTTP transport 406s immediately — it doesn't send `Accept: application/json, text/event-stream`, which this server's MCP StreamableHTTP transport requires (see the new Known Gotcha entry below). That's a bug in Hermes' own HTTP MCP client, confirmed by curling the same endpoint from inside the `hermes` container with the correct `Accept` header and getting a clean `tools/list` response with the same key. `mcp-remote` (the same npm bridge this app's own MCP docs already recommend for header-mangling stdio clients) negotiates it correctly, so use that bridge for any future HTTP MCP client that hits the same wall.
   - **Access level — deliberate, not an oversight**: Hermes has **full read/write access**, not scoped to read-only. Isaac's call (2026-09-13): the app is still in feature-discovery mode — he wants to chat with Hermes (GPT-backed) against the real app to figure out what's worth automating, before locking anything down. Worth knowing: **there is no per-key access scoping in this codebase at all** — every generated API key gets every non-admin tool/route, full read+write (nutrition category is the only thing gone, hard-deleted). If a future session is asked to restrict Hermes later, the real fix is action-level gating inside each bundled `sparky_manage_*` tool (they mix one safe read with several writes, including destructive deletes) or a dedicated read-only tool/endpoint — tool-level all-or-nothing isn't fine-grained enough, see git history/session notes around 2026-09-13 for the full per-tool risk inventory if this comes up again.
   - **Still open**: this only gives Hermes on-demand pull access (Isaac messages it, it calls tools). No scheduled/proactive "morning briefing" push exists yet. The workout-plan "what's scheduled today" MCP gap is also still real (`ai/tools/workoutPlanTools.ts` / `sparky_manage_workout_plans` has no such action — `GET /workout-plan-templates/active/:date` exists but nothing wraps it for MCP). For scheduling, check Hermes' own CLI first (`hermes --help` lists a `cron` subcommand) before assuming an external n8n workflow is needed — that assumption was wrong once already this session.
3. **Phantom auto-materialized diary entries on program activation** — see "PICK UP HERE" above for the full description and the two possible fixes. Not urgent (only affects the edge case of starting a workout on a day a just-activated program already auto-scheduled), but worth resolving before leaning on the Active Program Widget heavily.
4. ~~Untested by the user yet~~ — **now tested and confirmed working live** (recurring habit creation, day-of-week exclusion correctly hiding a habit on excluded days, streak counting across a full weekend gap, the Undo action). Found and fixed a real bug in the process (see streak fix above).
5. **Deferred by choice, not forgotten**: uHabits-style "X times per week, any day" frequency mode (day-of-week exclusion was built instead, per explicit request); quick tap-to-increment for numeric habits (currently opens a small dialog to type a value instead); habit-strength EMA scoring (a simple consecutive-day streak was built instead, deliberately, for a personal single-user tool); muscle-group color tags on exercises (spec'd for the old Workout Logging plan, dropped when the Workouts redesign superseded that plan — never asked for again).
6. **Minor known edge case, not fixed**: in `FocusPage.tsx`'s recurring-habit day picker, unchecking all 7 weekday buttons stores an empty `recurrence_days_of_week` array, and Postgres's `ANY('{}')` is always false — the habit would silently never appear in the checklist or `get_today` again (still editable/deletable from the Focus page's management list though). Low priority: the default is all-days-checked, so a user has to go out of their way to hit it.
7. **JS bundle is on the large side** (`vendor-others` ~2.2MB uncompressed) — not broken, but the reason a PWA update after a deploy can take ~30s to finish downloading on a mobile connection before the app becomes usable again (one-time per device per deploy, self-healing via the existing `chunkRecovery.ts` reload mechanism). Worth revisiting with code-splitting if that one-time wait ever actually bothers the user — hasn't been asked for yet.
8. **Pre-existing test-suite gaps, unrelated to any of the above**: `translationKeysCoverage.test.ts` has intermittently had missing-key failures from various past sessions' new `t()` calls (each session's own new keys get added as part of that session — check this doesn't regress, don't assume it's someone else's problem to fix). `WorkoutPlaybackPage.test.tsx` has previously shown an i18next module-loading error in isolation in at least one past session; it did not reproduce during this session's test runs (13/13 passing, including 2 new tests for the Finish Workout Summary modal) — if it comes back, it's pre-existing and not necessarily caused by whatever you're working on, but verify rather than assume.
9. **`sync_frequency`'s `'hourly'` vs `'daily'` distinction is cosmetic only** — the scheduler (`SparkyFitnessServer.ts`, one `cron.schedule('0 * * * *', ...)` block per provider) treats both identically (anything `!== 'manual'` syncs every hour). Affects Garmin, Withings, Fitbit, Oura, Strava, Polar, Google Health — every provider with that field. Not urgent, but worth fixing properly before relying on "Daily" meaning daily for any provider.
10. **Isaac's Garmin connection is still `sync_frequency: 'manual'`** — no auto-sync configured. He needs to flip it to Hourly (Settings → Garmin card → Edit) if he wants it to sync without a manual tap each time, once the item above is fixed or accepted as-is.

## Quick file map for the Focus domain

- Backend: `SparkyFitnessServer/db/migrations/20260912120000_add_focus_schema.sql` + `20260912130000_add_focus_recurrence.sql`, `schemas/focusSchemas.ts`, `models/focusRepository.ts`, `services/focusService.ts`, `routes/v2/focusRoutes.ts`, `ai/tools/focusTools.ts`, `ai/tools/schemas/focus.ts`.
- Frontend: `SparkyFitnessFrontend/src/pages/Focus/FocusPage.tsx`, `src/pages/Home/HomeChecklist.tsx`, `src/types/focus.ts`, `src/api/focus/focusService.ts`, `src/hooks/useFocus.ts`.
- Both `AGENTS.md` files (root + `SparkyFitnessFrontend/`), `docs/content/8.developer/11.database-security-tiers.md`, `docs/content/2.features/9.family-friends-sharing.md`, and `shared/src/schemas/database/Focus*.zod.ts` were updated to keep the repo's own doc conventions in sync — check these too if extending the domain further.
