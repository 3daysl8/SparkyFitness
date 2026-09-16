// Phase 6 CLI runner. Thin by design -- all decision logic lives in
// repairWorkoutIntegrity.ts (unit-tested); this file owns argv, transaction
// boundaries, the pre-apply JSON backup, and console reporting.
//
// Usage (from SparkyFitnessServer/):
//   pnpm exec tsx scripts/workoutIntegrity/run.ts --user <userId>
//   pnpm exec tsx scripts/workoutIntegrity/run.ts --user <userId> --include-past
//   pnpm exec tsx scripts/workoutIntegrity/run.ts --user <userId> --apply
//   pnpm exec tsx scripts/workoutIntegrity/run.ts --user <userId> --apply --include-past --recompute-calories
//
// Dry-run (no --apply) is the default and runs inside a READ ONLY
// transaction -- Postgres itself rejects any write attempt, so a bug here
// cannot mutate data. It also re-checksums the affected tables before and
// after building the report and asserts they match, as a second, independent
// proof nothing changed.
//
// --apply writes a JSON backup of every affected row's pre-image to
// SparkyFitnessServer/backup/repair/ (gitignored, mode 600) BEFORE
// committing -- if the file write fails, the transaction rolls back instead.

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { loadSecrets } from '../../utils/secretLoader.js';
import { getClient, endPool } from '../../db/poolManager.js';
import { log } from '../../config/logging.js';
import { todayInZone } from '@workspace/shared';
import preferenceRepository from '../../models/preferenceRepository.js';
import {
  buildIntegrityReport,
  applyRepairs,
  type IntegrityReport,
} from './repairWorkoutIntegrity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CliArgs {
  userId: string;
  apply: boolean;
  includePast: boolean;
  recomputeCalories: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const userArg = args.find((a) => a.startsWith('--user='));
  const userId = userArg?.split('=')[1];
  if (!userId) {
    throw new Error(
      'Usage: run.ts --user=<userId> [--apply] [--include-past] [--recompute-calories]'
    );
  }
  return {
    userId,
    apply: args.includes('--apply'),
    includePast: args.includes('--include-past'),
    recomputeCalories: args.includes('--recompute-calories'),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryableClient = { query: (sql: string, params?: any[]) => Promise<any> };

async function tableChecksum(
  client: QueryableClient,
  table: string,
  userId: string
): Promise<string> {
  const result = await client.query(
    `SELECT count(*)::text AS n,
            COALESCE(string_agg(id::text, ',' ORDER BY id), '') AS ids
     FROM ${table} WHERE user_id = $1`,
    [userId]
  );
  const { n, ids } = result.rows[0];
  return crypto.createHash('sha256').update(`${n}:${ids}`).digest('hex');
}

async function checksumAll(client: QueryableClient, userId: string) {
  return {
    exercise_entries: await tableChecksum(client, 'exercise_entries', userId),
    exercise_preset_entries: await tableChecksum(
      client,
      'exercise_preset_entries',
      userId
    ),
    planned_workouts: await tableChecksum(client, 'planned_workouts', userId),
  };
}

function printReport(report: IntegrityReport) {
  const eligiblePhantoms = report.phantom_candidates.filter(
    (p) => p.eligibleForApply
  );
  const blockedPhantoms = report.phantom_candidates.filter((p) => !p.qualifies);

  console.log(`\n=== Workout integrity report: user ${report.user_id} ===`);
  console.log(`Today (user tz): ${report.today}`);
  console.log(`--include-past: ${report.include_past}\n`);

  console.log(
    `Phantom candidates: ${report.phantom_candidates.length} total, ` +
      `${eligiblePhantoms.length} eligible for --apply, ` +
      `${blockedPhantoms.length} report-only (failed the strict rule).`
  );
  for (const p of report.phantom_candidates) {
    const tag = p.eligibleForApply
      ? 'ELIGIBLE'
      : p.qualifies
        ? 'QUALIFIES (past, needs --include-past)'
        : 'BLOCKED';
    console.log(
      `  [${tag}] ${p.row.id} ${p.row.entry_date} "${p.row.exercise_name}" (${p.bucket})`
    );
    for (const reason of p.reasons) console.log(`      - ${reason}`);
  }

  console.log(
    `\nEmpty sessions (always apply-eligible): ${report.empty_sessions.length}`
  );
  for (const s of report.empty_sessions) {
    console.log(`  ${s.id} ${s.entry_date} "${s.name}"`);
  }

  console.log(
    `\nStale-calorie candidates (apply only with --recompute-calories): ${report.stale_calories.length}`
  );
  for (const c of report.stale_calories) {
    console.log(
      `  ${c.id} ${c.entry_date} "${c.exercise_name}": ${c.calories_burned} kcal -> ${c.recomputed_calories} kcal (calories_source=${c.calories_source ?? 'null'})`
    );
  }

  console.log(
    `\nImplausible durations (report only): ${report.implausible_durations.length}`
  );
  for (const d of report.implausible_durations) {
    console.log(
      `  ${d.id} ${d.entry_date} "${d.exercise_name}": ${d.duration_minutes.toFixed(3)} min, ${d.calories_burned} kcal`
    );
  }

  console.log(
    `\nUntyped exercises used in the last 30 days (report only, for tagging): ${report.untyped_exercises.length}`
  );
  for (const e of report.untyped_exercises) {
    console.log(
      `  "${e.name}" (${e.category ?? 'no category'}) - ${e.recent_uses} use(s)`
    );
  }
  console.log('');
}

async function runDryRun(userId: string, today: string, includePast: boolean) {
  const client = await getClient(userId);
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const before = await checksumAll(client, userId);
    const report = await buildIntegrityReport(
      client,
      userId,
      today,
      includePast
    );
    const after = await checksumAll(client, userId);
    await client.query('ROLLBACK');

    const unchanged =
      before.exercise_entries === after.exercise_entries &&
      before.exercise_preset_entries === after.exercise_preset_entries &&
      before.planned_workouts === after.planned_workouts;
    if (!unchanged) {
      throw new Error(
        'INTERNAL ERROR: table checksums differ before/after a READ ONLY dry-run transaction. This should be impossible -- Postgres enforces read-only. Nothing was written (the transaction was rolled back), but investigate before trusting this report.'
      );
    }
    log(
      'info',
      '[repairWorkoutIntegrity] Dry-run self-check passed: exercise_entries/exercise_preset_entries/planned_workouts checksums unchanged before vs after (read-only transaction rolled back).'
    );
    printReport(report);
    console.log(
      'DRY RUN ONLY -- nothing was changed. Re-run with --apply once the report above has been reviewed and approved.'
    );
  } finally {
    client.release();
  }
}

async function runApply(
  userId: string,
  today: string,
  includePast: boolean,
  recomputeCalories: boolean
) {
  const client = await getClient(userId);
  try {
    await client.query('BEGIN');
    const summary = await applyRepairs(client, userId, today, {
      includePast,
      recomputeCalories,
    });

    const backupDir = path.resolve(__dirname, '../../backup/repair');
    fs.mkdirSync(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${userId}-${timestamp}.json`);
    const payload = {
      user_id: userId,
      generated_at: new Date().toISOString(),
      today,
      include_past: includePast,
      recompute_calories: recomputeCalories,
      entries: summary.backup,
    };
    const serialized = JSON.stringify(payload, null, 2);
    const checksum = crypto
      .createHash('sha256')
      .update(serialized)
      .digest('hex');
    fs.writeFileSync(backupPath, serialized, { mode: 0o600 });
    fs.writeFileSync(
      `${backupPath}.sha256`,
      `${checksum}  ${path.basename(backupPath)}\n`,
      {
        mode: 0o600,
      }
    );

    await client.query('COMMIT');

    log(
      'info',
      `[repairWorkoutIntegrity] Applied and committed. Backup written to ${backupPath} (sha256 ${checksum}).`
    );
    console.log(
      `\nApplied: ${summary.phantomsConverted} phantom(s) converted to planned_workouts, ` +
        `${summary.emptySessionsDeleted} empty session(s) deleted, ` +
        `${summary.caloriesRecomputed} calorie value(s) recomputed.`
    );
    console.log(`Backup: ${backupPath}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function run() {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
  loadSecrets();

  const { userId, apply, includePast, recomputeCalories } = parseArgs();
  const prefs = await preferenceRepository.getUserPreferences(userId);
  const tz =
    prefs?.timezone && typeof prefs.timezone === 'string'
      ? prefs.timezone
      : 'UTC';
  const today = todayInZone(tz);

  log(
    'info',
    `[repairWorkoutIntegrity] user=${userId} today=${today} (tz=${tz}) apply=${apply} includePast=${includePast} recomputeCalories=${recomputeCalories}`
  );

  if (apply) {
    await runApply(userId, today, includePast, recomputeCalories);
  } else {
    await runDryRun(userId, today, includePast);
  }
}

run()
  .catch((err) => {
    log('error', '[repairWorkoutIntegrity] Fatal error:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await endPool();
  });
