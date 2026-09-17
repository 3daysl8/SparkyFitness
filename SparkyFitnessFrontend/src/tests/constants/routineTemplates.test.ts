import {
  ROUTINE_TEMPLATES,
  ROUTINE_CATEGORIES,
  convertTemplateToWorkoutPreset,
} from '@/constants/routineTemplates';
import type { Exercise } from '@/types/exercises';

describe('routineTemplates', () => {
  it('contains valid and unique routine templates', () => {
    expect(ROUTINE_TEMPLATES.length).toBeGreaterThan(0);
    const ids = new Set<string>();

    ROUTINE_TEMPLATES.forEach((template) => {
      expect(ids.has(template.id)).toBe(false);
      ids.add(template.id);

      expect(template.defaultTitle).toBeTruthy();
      expect(template.defaultDescription).toBeTruthy();
      expect(template.estimatedDurationMin).toBeGreaterThan(0);
      expect(template.exercises.length).toBeGreaterThan(0);

      template.exercises.forEach((ex) => {
        expect(ex.name).toBeTruthy();
        expect(ex.sets.length).toBeGreaterThan(0);
        ex.sets.forEach((set) => {
          expect(set.reps).toBeGreaterThan(0);
          expect(set.rest_time).toBeGreaterThan(0);
        });
      });
    });
  });

  it('contains valid category definitions', () => {
    expect(ROUTINE_CATEGORIES.length).toBeGreaterThan(0);
    expect(ROUTINE_CATEGORIES[0]?.id).toBe('all');
  });

  it('converts a template to a clean WorkoutPreset structure', () => {
    const template = ROUTINE_TEMPLATES[0]!;
    const converted = convertTemplateToWorkoutPreset(template, 'test-user-123');

    expect(converted.user_id).toBe('test-user-123');
    expect(converted.name).toBe(template.defaultTitle);
    expect(converted.description).toBe(template.defaultDescription);
    expect(converted.exercises.length).toBe(template.exercises.length);
    expect(converted.exercises[0]?.exercise_name).toBe(
      template.exercises[0]?.name
    );
    expect(converted.exercises[0]?.sets.length).toBe(
      template.exercises[0]?.sets.length
    );
  });

  it('maps to existing exercises when matched by name', () => {
    const template = ROUTINE_TEMPLATES[0]!;
    const mockExistingExercises: Exercise[] = [
      {
        id: 'real-db-bench-id',
        name: 'Barbell Bench Press',
        category: 'strength',
        images: ['https://example.com/bench.png'],
      } as unknown as Exercise,
    ];

    const converted = convertTemplateToWorkoutPreset(
      template,
      'test-user-123',
      mockExistingExercises
    );

    const benchEx = converted.exercises.find(
      (e) => e.exercise_name.toLowerCase() === 'barbell bench press'
    );
    expect(benchEx).toBeDefined();
    expect(benchEx?.exercise_id).toBe('real-db-bench-id');
    expect(benchEx?.image_url).toBe('https://example.com/bench.png');
  });
});
