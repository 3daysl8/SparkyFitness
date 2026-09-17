import {
  getSupersetRuns,
  getSupersetLetter,
  getSupersetDisplayMap,
  supersetExercisesWithNext,
  ungroupExercise,
  normalizeSupersetGroups,
} from '@/utils/workoutSupersets';

describe('workoutSupersets', () => {
  describe('getSupersetLetter', () => {
    it('returns sequential letters starting with A', () => {
      expect(getSupersetLetter(0)).toBe('A');
      expect(getSupersetLetter(1)).toBe('B');
      expect(getSupersetLetter(25)).toBe('Z');
      expect(getSupersetLetter(26)).toBe('AA');
    });
  });

  describe('getSupersetRuns', () => {
    it('returns empty array when no supersets are present', () => {
      const exercises = [
        { id: '1', superset_group: null },
        { id: '2', superset_group: null },
      ];
      expect(getSupersetRuns(exercises)).toEqual([]);
    });

    it('identifies adjacent paired exercises sharing a superset_group', () => {
      const exercises = [
        { id: '1', superset_group: 1 },
        { id: '2', superset_group: 1 },
        { id: '3', superset_group: null },
      ];
      const runs = getSupersetRuns(exercises);
      expect(runs).toHaveLength(1);
      expect(runs[0]).toEqual({
        groupId: 1,
        indices: [0, 1],
        entryIds: ['1', '2'],
      });
    });

    it('ignores isolated singletons with a superset_group', () => {
      const exercises = [
        { id: '1', superset_group: 1 },
        { id: '2', superset_group: 2 },
        { id: '3', superset_group: 3 },
      ];
      expect(getSupersetRuns(exercises)).toEqual([]);
    });

    it('handles multiple separate superset runs', () => {
      const exercises = [
        { id: '1', superset_group: 1 },
        { id: '2', superset_group: 1 },
        { id: '3', superset_group: null },
        { id: '4', superset_group: 2 },
        { id: '5', superset_group: 2 },
        { id: '6', superset_group: 2 },
      ];
      const runs = getSupersetRuns(exercises);
      expect(runs).toHaveLength(2);
      expect(runs[0]!.indices).toEqual([0, 1]);
      expect(runs[1]!.indices).toEqual([3, 4, 5]);
    });
  });

  describe('getSupersetDisplayMap', () => {
    it('creates display mapping with letters and giant set flags', () => {
      const exercises = [
        { id: '1', superset_group: 1 },
        { id: '2', superset_group: 1 },
        { id: '3', superset_group: 2 },
        { id: '4', superset_group: 2 },
        { id: '5', superset_group: 2 },
      ];
      const map = getSupersetDisplayMap(exercises);
      expect(map.size).toBe(5);

      const ex0 = map.get(0)!;
      expect(ex0.letter).toBe('A');
      expect(ex0.isGiantSet).toBe(false);
      expect(ex0.isFirst).toBe(true);
      expect(ex0.isLast).toBe(false);

      const ex1 = map.get(1)!;
      expect(ex1.letter).toBe('A');
      expect(ex1.isFirst).toBe(false);
      expect(ex1.isLast).toBe(true);

      const ex2 = map.get(2)!;
      expect(ex2.letter).toBe('B');
      expect(ex2.isGiantSet).toBe(true);
      expect(ex2.isFirst).toBe(true);

      const ex3 = map.get(3)!;
      expect(ex3.isMiddle).toBe(true);

      const ex4 = map.get(4)!;
      expect(ex4.isLast).toBe(true);
    });
  });

  describe('supersetExercisesWithNext', () => {
    it('groups two ungrouped exercises together', () => {
      const exercises = [
        { id: '1', superset_group: null },
        { id: '2', superset_group: null },
        { id: '3', superset_group: null },
      ];
      const result = supersetExercisesWithNext(exercises, 0);
      expect(result[0]!.superset_group).toBe(1);
      expect(result[1]!.superset_group).toBe(1);
      expect(result[2]!.superset_group).toBeNull();
    });

    it('adds next exercise to an existing superset group', () => {
      const exercises = [
        { id: '1', superset_group: 1 },
        { id: '2', superset_group: 1 },
        { id: '3', superset_group: null },
      ];
      const result = supersetExercisesWithNext(exercises, 1);
      expect(result[0]!.superset_group).toBe(1);
      expect(result[1]!.superset_group).toBe(1);
      expect(result[2]!.superset_group).toBe(1);
    });
  });

  describe('ungroupExercise', () => {
    it('dissolves a 2-exercise superset when one member is removed', () => {
      const exercises = [
        { id: '1', superset_group: 1 },
        { id: '2', superset_group: 1 },
      ];
      const result = ungroupExercise(exercises, 0);
      expect(result[0]!.superset_group).toBeNull();
      expect(result[1]!.superset_group).toBeNull();
    });

    it('leaves remaining 2 exercises grouped when middle of giant set is removed', () => {
      const exercises = [
        { id: '1', superset_group: 1 },
        { id: '2', superset_group: 1 },
        { id: '3', superset_group: 1 },
      ];
      const result = ungroupExercise(exercises, 0);
      expect(result[0]!.superset_group).toBeNull();
      expect(result[1]!.superset_group).toBe(1);
      expect(result[2]!.superset_group).toBe(1);
    });
  });

  describe('normalizeSupersetGroups', () => {
    it('clears broken / single-member group values', () => {
      const exercises = [
        { id: '1', superset_group: 1 },
        { id: '2', superset_group: null },
        { id: '3', superset_group: 2 },
        { id: '4', superset_group: 2 },
      ];
      const result = normalizeSupersetGroups(exercises);
      expect(result[0]!.superset_group).toBeNull();
      expect(result[1]!.superset_group).toBeNull();
      expect(result[2]!.superset_group).toBe(2);
      expect(result[3]!.superset_group).toBe(2);
    });
  });
});
