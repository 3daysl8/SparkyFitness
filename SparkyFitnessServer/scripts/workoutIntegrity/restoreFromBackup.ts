// Companion restore script for repairWorkoutIntegrity's --apply backups.
// Reads a backup JSON file (SparkyFitnessServer/backup/repair/<user>-<ts>.json),
// verifies its sha256 companion, and reverses every entry: a deleted row is
// re-inserted (ON CONFLICT (id) DO NOTHING, parents before children -- here
// that means exercise_entries/exercise_preset_entries before the
// planned_workouts row they were paired with is removed), an inserted row is
// deleted by id, an updated row's touched columns are set back to their
// pre-apply values.
//
// Usage (from SparkyFitnessServer/):
//   pnpm exec tsx scripts/workoutIntegrity/restoreFromBackup.ts --file=backup/repair/<user>-<ts>.json
//   pnpm exec tsx scripts/workoutIntegrity/restoreFromBackup.ts --file=... --confirm

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { loadSecrets } from '../../utils/secretLoader.js';
import { getClient, endPool } from '../../db/poolManager.js';
import { log } from '../../config/logging.js';
import type { BackupEntry } from './repairWorkoutIntegrity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface BackupPayload {
  user_id: string;
  generated_at: string;
  today: string;
  entries: BackupEntry[];
}

function parseArgs() {
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => a.startsWith('--file='));
  if (!fileArg)
    throw new Error('Usage: restoreFromBackup.ts --file=<path> [--confirm]');
  return { file: fileArg.split('=')[1], confirm: args.includes('--confirm') };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryableClient = { query: (sql: string, params?: any[]) => Promise<any> };

async function insertFromSnapshot(
  client: QueryableClient,
  table: string,
  row: Record<string, unknown>
) {
  const columns = Object.keys(row);
  const columnList = columns.map((c) => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  await client.query(
    `INSERT INTO ${table} (${columnList}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
    columns.map((c) => row[c])
  );
}

async function run() {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
  loadSecrets();

  const { file, confirm } = parseArgs();
  const filePath = path.isAbsolute(file)
    ? file
    : path.resolve(process.cwd(), file);
  const raw = fs.readFileSync(filePath, 'utf-8');

  const shaPath = `${filePath}.sha256`;
  if (fs.existsSync(shaPath)) {
    const expected = fs.readFileSync(shaPath, 'utf-8').split(/\s+/)[0];
    const actual = crypto.createHash('sha256').update(raw).digest('hex');
    if (expected !== actual) {
      throw new Error(
        `Checksum mismatch for ${filePath}: expected ${expected}, got ${actual}. Refusing to restore from a possibly-modified backup.`
      );
    }
    log('info', '[restoreFromBackup] Checksum verified.');
  } else {
    log(
      'warn',
      `[restoreFromBackup] No .sha256 companion found at ${shaPath} -- proceeding without checksum verification.`
    );
  }

  const payload = JSON.parse(raw) as BackupPayload;
  console.log(
    `Backup for user ${payload.user_id}, generated ${payload.generated_at} (today=${payload.today}): ${payload.entries.length} entr${payload.entries.length === 1 ? 'y' : 'ies'} to reverse.`
  );
  for (const entry of payload.entries) {
    console.log(`  ${entry.operation} ${entry.table} -> will be reversed`);
  }

  if (!confirm) {
    console.log('\nDry run only -- re-run with --confirm to actually restore.');
    return;
  }

  const client = await getClient(payload.user_id);
  try {
    await client.query('BEGIN');

    // Reverse planned_workouts inserts (the "children" of a phantom
    // conversion) before re-inserting the exercise_entries/
    // exercise_preset_entries rows they replaced.
    for (const entry of payload.entries) {
      if (entry.table === 'planned_workouts' && entry.operation === 'insert') {
        const after = entry.after as { id: string };
        await client.query('DELETE FROM planned_workouts WHERE id = $1', [
          after.id,
        ]);
      }
    }

    for (const entry of payload.entries) {
      if (entry.operation === 'delete') {
        await insertFromSnapshot(
          client,
          entry.table,
          entry.before as Record<string, unknown>
        );
      } else if (
        entry.operation === 'update' &&
        entry.table === 'exercise_entries'
      ) {
        const before = entry.before as {
          id: string;
          calories_burned: number;
          calories_source: string | null;
          updated_at: string;
        };
        await client.query(
          'UPDATE exercise_entries SET calories_burned = $1, calories_source = $2, updated_at = $3 WHERE id = $4',
          [
            before.calories_burned,
            before.calories_source,
            before.updated_at,
            before.id,
          ]
        );
      }
    }

    await client.query('COMMIT');
    log(
      'info',
      `[restoreFromBackup] Restored ${payload.entries.length} entries.`
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

run()
  .catch((err) => {
    log('error', '[restoreFromBackup] Fatal error:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await endPool();
  });
