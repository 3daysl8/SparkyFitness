# Personal fork status & handoff

This is a personal fork of `CodeWithCJ/SparkyFitness`, being turned into a lifestyle/habit app for one user (Isaac, `3daysl8@gmail.com`). This doc is a running handoff for picking the work back up in a fresh session — update it as things change, don't let it go stale.

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

## What's built and deployed (as of commit `a4a62e044`)

1. **Focus & Motivation backend**: migration (`focus_domains`/`focuses`/`focus_checkins` + later `recurrence_days_of_week`/`recurrence_end_date` on `focuses`), routes (`routes/v2/focusRoutes.ts`), service/repository (`services/focusService.ts`, `models/focusRepository.ts`), Zod schemas (`schemas/focusSchemas.ts`).
2. **AI/MCP tool**: `sparky_manage_focus` (`ai/tools/focusTools.ts` + `ai/tools/schemas/focus.ts`), registered under the existing `goals` chat-tool category — so both the in-app AI chat and any external MCP client (e.g. Hermes) get it automatically, including the `get_today` action (resolves scheduled items + recurring habits w/ streaks + weekly/long-term focuses for any date).
3. **Frontend**:
   - `pages/Focus/FocusPage.tsx` — manage domains, create/edit focuses (daily/weekly/long-term), a date picker for one-off scheduled daily focuses, a "make recurring" toggle (day-of-week exclusion + optional end date) for standing habits, check-in dialog, check-in history.
   - `pages/Home/HomeChecklist.tsx` — the new landing page: week-strip date selector, collapsible "To-Do List" (one-off scheduled focuses for the selected date) and "Daily Habits" (recurring habits active that date, with streak badges and quick check-off), plus a thin status strip linking into the real Exercises/Diary/Check-In tabs for workout/water/sleep.
   - Nav updated (`layouts/MainLayout.tsx`, `App.tsx`) — `/` → `HomeChecklist`, `/diary` → the old `Diary` page, `/focus` → `FocusPage`.
4. Two commits pushed: `a25a1d126` (Focus hub + nutrition hiding) and `a4a62e044` (recurrence + checklist landing page). Both build clean (`tsc`, `eslint --max-warnings 0`, `knip`) across backend/frontend/shared. `prettier --check` fails repo-wide due to a pre-existing Windows CRLF checkout artifact (`core.autocrlf=true`), unrelated to this work — don't chase it.

## Known gotchas (learned the hard way this session — don't repeat)

- **`docker compose up -d` does NOT reload `.env` changes on an already-running container** — it needs `docker compose up -d` to actually recreate it (a plain `restart` never picks up new env vars; this bit us twice on `SPARKY_FITNESS_EXTRA_TRUSTED_ORIGINS`).
- **`docker compose up -d` also won't recreate a container just because the image tag was rebuilt** if nothing in the compose service definition changed — it compared config, not image digest. Use `docker compose up -d --force-recreate <service>` after rebuilding an image, or it'll keep running the old container.
- **Docker's build cache can silently serve stale output** even when source genuinely changed — this happened once already (a rebuilt frontend image was missing the new page entirely, despite `docker build` exiting 0). Always verify: `docker run --rm --entrypoint sh <image> -c "ls /usr/share/nginx/html/assets/ | grep <ExpectedNewChunkName>"` before deploying; use `--no-cache` if in doubt.
- **Git identity isn't configured on Kingdom for this repo** — set locally (not `--global`) as `3daysl8` / `3daysl8@gmail.com` if a fresh clone needs it again.
- Windows checkout has `core.autocrlf=true`, so `git add` always warns about LF→CRLF — harmless, ignore it.

## Not yet done (from the original broader plan — still open)

1. **Wire the in-app AI chatbot to Kingdom's Ollama** (`http://100.68.231.84:11434/v1`, admin-only AI setting, no `ALLOW_PRIVATE_NETWORK_AI` change needed). `OLLAMA_CONTEXT_LENGTH` may need raising on Kingdom for reliable tool-calling.
2. **Hermes morning-briefing integration** (the biggest remaining piece): a scheduled n8n workflow on Pi5 that has Hermes pull, via the app's own `/mcp` endpoint + a generated API key (`POST /api/identity/user/generate-api-key`):
   - Today's planned workout — **real gap**: no existing tool/endpoint answers "what's scheduled today" for the workout-plan system (`ai/tools/workoutPlanTools.ts` has no such action); either add a small one or have Hermes fetch the active plan + filter by day-of-week itself.
   - Sleep-logged reminder, supplements-due reminder — both already fully supported by existing tools (`sparky_manage_checkin`, `sparky_manage_medications`), zero new code needed.
   - The new Focus checklist itself — already exposed via `sparky_manage_focus`'s `get_today`, zero new code needed.
   - Delivery: n8n → Telegram Bot API directly (Hermes has no proactive-send mechanism today) — see the earlier plan file content (superseded, but Track 2's design notes are still valid) for the full mechanics of enabling Hermes' gateway API, timezone handling, etc.
3. **Untested by the user yet** (was about to test when this handoff was written): recurring habit creation end-to-end, one-off scheduled-for-a-future-date focus via the date picker, streak counting across multiple days, day-of-week exclusion actually hiding a habit on excluded days, the Undo action on a checked-off habit.
4. **Deferred by choice, not forgotten**: uHabits-style "X times per week, any day" frequency mode (day-of-week exclusion was built instead, per explicit request); quick tap-to-increment for numeric habits (currently opens a small dialog to type a value instead); habit-strength EMA scoring (a simple consecutive-day streak was built instead, deliberately, for a personal single-user tool).

## Quick file map for the Focus domain

- Backend: `SparkyFitnessServer/db/migrations/20260912120000_add_focus_schema.sql` + `20260912130000_add_focus_recurrence.sql`, `schemas/focusSchemas.ts`, `models/focusRepository.ts`, `services/focusService.ts`, `routes/v2/focusRoutes.ts`, `ai/tools/focusTools.ts`, `ai/tools/schemas/focus.ts`.
- Frontend: `SparkyFitnessFrontend/src/pages/Focus/FocusPage.tsx`, `src/pages/Home/HomeChecklist.tsx`, `src/types/focus.ts`, `src/api/focus/focusService.ts`, `src/hooks/useFocus.ts`.
- Both `AGENTS.md` files (root + `SparkyFitnessFrontend/`), `docs/content/8.developer/11.database-security-tiers.md`, `docs/content/2.features/9.family-friends-sharing.md`, and `shared/src/schemas/database/Focus*.zod.ts` were updated to keep the repo's own doc conventions in sync — check these too if extending the domain further.
