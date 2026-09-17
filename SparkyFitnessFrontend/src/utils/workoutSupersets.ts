export interface SupersetRun {
  groupId: number;
  /** Indices of member exercises in the exercises array */
  indices: number[];
  /** IDs of member exercises if available */
  entryIds: string[];
}

export interface SupersetDisplayInfo {
  groupId: number;
  runIndex: number;
  label: string;
  letter: string;
  isGiantSet: boolean;
  isFirst: boolean;
  isMiddle: boolean;
  isLast: boolean;
  colorClass: string;
  badgeClass: string;
}

export const SUPERSET_PALETTE = [
  {
    border: 'border-l-blue-500',
    bg: 'bg-blue-500/10',
    badge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    dot: 'bg-blue-500',
  },
  {
    border: 'border-l-amber-500',
    bg: 'bg-amber-500/10',
    badge:
      'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    dot: 'bg-amber-500',
  },
  {
    border: 'border-l-purple-500',
    bg: 'bg-purple-500/10',
    badge:
      'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    dot: 'bg-purple-500',
  },
  {
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-500/10',
    badge:
      'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  {
    border: 'border-l-pink-500',
    bg: 'bg-pink-500/10',
    badge: 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30',
    dot: 'bg-pink-500',
  },
  {
    border: 'border-l-cyan-500',
    bg: 'bg-cyan-500/10',
    badge: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    dot: 'bg-cyan-500',
  },
];

/** Convert 0 -> 'A', 1 -> 'B', 25 -> 'Z', 26 -> 'AA', etc. */
export function getSupersetLetter(index: number): string {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode(65 + (temp % 26)) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Scan adjacent runs of 2+ exercises sharing a non-null `superset_group`.
 * Standalone singletons or broken runs are ignored (not considered valid supersets).
 */
export function getSupersetRuns<
  T extends { superset_group?: number | null; id?: string | number },
>(exercises: T[]): SupersetRun[] {
  const runs: SupersetRun[] = [];
  const flush = (run: SupersetRun | null) => {
    if (run !== null && run.indices.length >= 2) {
      runs.push(run);
    }
  };

  let current: SupersetRun | null = null;
  exercises.forEach((exercise, index) => {
    const groupId = exercise.superset_group ?? null;
    const entryId = exercise.id != null ? String(exercise.id) : `ex-${index}`;

    if (groupId != null && current !== null && current.groupId === groupId) {
      current.indices.push(index);
      current.entryIds.push(entryId);
      return;
    }

    flush(current);
    current =
      groupId != null
        ? { groupId, indices: [index], entryIds: [entryId] }
        : null;
  });

  flush(current);
  return runs;
}

/**
 * Maps each exercise index to its SupersetDisplayInfo if it belongs to a valid superset run.
 */
export function getSupersetDisplayMap<
  T extends { superset_group?: number | null; id?: string | number },
>(
  exercises: T[],
  t?: (
    key: string,
    options?: { defaultValue?: string; label?: string; count?: number }
  ) => string
): Map<number, SupersetDisplayInfo> {
  const map = new Map<number, SupersetDisplayInfo>();
  const runs = getSupersetRuns(exercises);

  runs.forEach((run, runIndex) => {
    const letter = getSupersetLetter(runIndex);
    const isGiantSet = run.indices.length > 2;
    const palette = SUPERSET_PALETTE[runIndex % SUPERSET_PALETTE.length] ??
      SUPERSET_PALETTE[0] ?? {
        border: 'border-l-indigo-500',
        badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
      };

    const defaultLabel = isGiantSet
      ? `Giant Set ${letter}`
      : `Superset ${letter}`;
    const label = t
      ? isGiantSet
        ? t('workoutPresetForm.giantSetLabel', {
            defaultValue: defaultLabel,
            label: letter,
          })
        : t('workoutPresetForm.supersetLabel', {
            defaultValue: defaultLabel,
            label: letter,
          })
      : defaultLabel;

    run.indices.forEach((exerciseIndex, posInRun) => {
      map.set(exerciseIndex, {
        groupId: run.groupId,
        runIndex,
        label,
        letter,
        isGiantSet,
        isFirst: posInRun === 0,
        isMiddle: posInRun > 0 && posInRun < run.indices.length - 1,
        isLast: posInRun === run.indices.length - 1,
        colorClass: palette.border,
        badgeClass: palette.badge,
      });
    });
  });

  return map;
}

/**
 * Clear the group value on any exercise not part of an adjacent 2+ run.
 */
export function normalizeSupersetGroups<
  T extends { superset_group?: number | null },
>(exercises: T[]): T[] {
  const runs = getSupersetRuns(exercises);
  const groupedIndices = new Set(runs.flatMap((r) => r.indices));

  const needsNormalization = exercises.some(
    (e, idx) => (e.superset_group ?? null) !== null && !groupedIndices.has(idx)
  );

  if (!needsNormalization) {
    return exercises;
  }

  return exercises.map((e, idx) =>
    (e.superset_group ?? null) !== null && !groupedIndices.has(idx)
      ? { ...e, superset_group: null }
      : e
  );
}

/**
 * Links the exercise at `index` with the exercise at `index + 1`.
 * If `index` already has a group, `index + 1` joins that group.
 * If `index + 1` has a group (and `index` does not), `index` joins `index + 1`'s group.
 * Otherwise, a fresh group ID (max + 1) is assigned to both.
 */
export function supersetExercisesWithNext<
  T extends { superset_group?: number | null },
>(exercises: T[], index: number): T[] {
  if (index < 0 || index >= exercises.length - 1) {
    return exercises;
  }

  const current = exercises[index];
  const next = exercises[index + 1];
  if (!current || !next) {
    return exercises;
  }

  let maxGroupId = 0;
  exercises.forEach((e) => {
    if (e.superset_group != null && e.superset_group > maxGroupId) {
      maxGroupId = e.superset_group;
    }
  });

  let targetGroupId: number;
  if (current.superset_group != null) {
    targetGroupId = current.superset_group;
  } else if (next.superset_group != null) {
    targetGroupId = next.superset_group;
  } else {
    targetGroupId = maxGroupId + 1;
  }

  const updated = exercises.map((e, idx) => {
    if (idx === index || idx === index + 1) {
      return { ...e, superset_group: targetGroupId };
    }
    return e;
  });

  return normalizeSupersetGroups(updated);
}

/**
 * Removes the exercise at `index` from its superset group.
 * If only 1 exercise remains in the superset run, it automatically dissolves.
 */
export function ungroupExercise<T extends { superset_group?: number | null }>(
  exercises: T[],
  index: number
): T[] {
  if (index < 0 || index >= exercises.length) {
    return exercises;
  }

  const current = exercises[index];
  if (!current || current.superset_group == null) {
    return exercises;
  }

  const updated = exercises.map((e, idx) =>
    idx === index ? { ...e, superset_group: null } : e
  );

  return normalizeSupersetGroups(updated);
}
