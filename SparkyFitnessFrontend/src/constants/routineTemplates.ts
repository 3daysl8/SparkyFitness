import type { WorkoutPreset, WorkoutPresetExercise } from '@/types/workout';
import type { Exercise } from '@/types/exercises';

export type RoutineTemplateCategory =
  | 'all'
  | 'ppl'
  | 'upper_lower'
  | 'full_body'
  | 'strength'
  | 'home_dumbbell'
  | 'conditioning';

export interface RoutineTemplateSet {
  set_number: number;
  set_type?: string;
  reps: number;
  weight: number;
  duration?: number;
  rest_time: number;
  notes?: string;
}

export interface RoutineTemplateExercise {
  name: string;
  category: string;
  targetMuscles: string[];
  equipment: string;
  sets: RoutineTemplateSet[];
}

export interface RoutineTemplate {
  id: string;
  titleKey: string;
  defaultTitle: string;
  descriptionKey: string;
  defaultDescription: string;
  category: RoutineTemplateCategory;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedDurationMin: number;
  targetSplit: string;
  primaryMuscles: string[];
  exercises: RoutineTemplateExercise[];
}

export const ROUTINE_CATEGORIES: {
  id: RoutineTemplateCategory;
  labelKey: string;
  defaultLabel: string;
}[] = [
  {
    id: 'all',
    labelKey: 'routineTemplates.categories.all',
    defaultLabel: 'All Programs',
  },
  {
    id: 'ppl',
    labelKey: 'routineTemplates.categories.ppl',
    defaultLabel: 'Push / Pull / Legs',
  },
  {
    id: 'upper_lower',
    labelKey: 'routineTemplates.categories.upperLower',
    defaultLabel: 'Upper / Lower',
  },
  {
    id: 'full_body',
    labelKey: 'routineTemplates.categories.fullBody',
    defaultLabel: 'Full Body',
  },
  {
    id: 'strength',
    labelKey: 'routineTemplates.categories.strength',
    defaultLabel: 'Strength / 5-3-1',
  },
  {
    id: 'home_dumbbell',
    labelKey: 'routineTemplates.categories.homeDumbbell',
    defaultLabel: 'Home & Dumbbell',
  },
  {
    id: 'conditioning',
    labelKey: 'routineTemplates.categories.conditioning',
    defaultLabel: 'HIIT & Conditioning',
  },
];

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  // 1. PPL - Push
  {
    id: 'ppl-push',
    titleKey: 'routineTemplates.templates.pplPush.title',
    defaultTitle: 'PPL - Push (Chest, Shoulders & Triceps)',
    descriptionKey: 'routineTemplates.templates.pplPush.desc',
    defaultDescription:
      'Classic pushing hypertrophy session focusing on pectoral, anterior/lateral deltoid, and triceps development with compound and isolation movements.',
    category: 'ppl',
    difficulty: 'Intermediate',
    estimatedDurationMin: 55,
    targetSplit: '3 to 6 Days / Week',
    primaryMuscles: ['Chest', 'Shoulders', 'Triceps'],
    exercises: [
      {
        name: 'Barbell Bench Press',
        category: 'strength',
        targetMuscles: ['Chest', 'Triceps', 'Shoulders'],
        equipment: 'Barbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Warm-up',
            reps: 10,
            weight: 40,
            rest_time: 90,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 8,
            weight: 70,
            rest_time: 90,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 8,
            weight: 70,
            rest_time: 90,
          },
          {
            set_number: 4,
            set_type: 'Normal',
            reps: 8,
            weight: 70,
            rest_time: 90,
          },
        ],
      },
      {
        name: 'Incline Dumbbell Press',
        category: 'strength',
        targetMuscles: ['Upper Chest', 'Front Delts'],
        equipment: 'Dumbbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 10,
            weight: 24,
            rest_time: 90,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 10,
            weight: 24,
            rest_time: 90,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 10,
            weight: 24,
            rest_time: 90,
          },
        ],
      },
      {
        name: 'Overhead Dumbbell Shoulder Press',
        category: 'strength',
        targetMuscles: ['Shoulders', 'Triceps'],
        equipment: 'Dumbbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 10,
            weight: 20,
            rest_time: 75,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 10,
            weight: 20,
            rest_time: 75,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 10,
            weight: 20,
            rest_time: 75,
          },
        ],
      },
      {
        name: 'Dumbbell Lateral Raise',
        category: 'strength',
        targetMuscles: ['Lateral Deltoids'],
        equipment: 'Dumbbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 12,
            weight: 10,
            rest_time: 60,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 12,
            weight: 10,
            rest_time: 60,
          },
          {
            set_number: 3,
            set_type: 'Drop Set',
            reps: 15,
            weight: 8,
            rest_time: 60,
          },
        ],
      },
      {
        name: 'Tricep Rope Pushdown',
        category: 'strength',
        targetMuscles: ['Triceps'],
        equipment: 'Cable',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 12,
            weight: 25,
            rest_time: 60,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 12,
            weight: 25,
            rest_time: 60,
          },
          {
            set_number: 3,
            set_type: 'Failure',
            reps: 15,
            weight: 25,
            rest_time: 60,
          },
        ],
      },
    ],
  },

  // 2. PPL - Pull
  {
    id: 'ppl-pull',
    titleKey: 'routineTemplates.templates.pplPull.title',
    defaultTitle: 'PPL - Pull (Back, Rear Delts & Biceps)',
    descriptionKey: 'routineTemplates.templates.pplPull.desc',
    defaultDescription:
      'Back thickness, lat width, rear delts, and biceps builder using horizontal and vertical pulling patterns.',
    category: 'ppl',
    difficulty: 'Intermediate',
    estimatedDurationMin: 55,
    targetSplit: '3 to 6 Days / Week',
    primaryMuscles: ['Back', 'Lats', 'Biceps', 'Rear Delts'],
    exercises: [
      {
        name: 'Barbell Bent-Over Row',
        category: 'strength',
        targetMuscles: ['Upper Back', 'Lats', 'Biceps'],
        equipment: 'Barbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Warm-up',
            reps: 10,
            weight: 40,
            rest_time: 90,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 8,
            weight: 65,
            rest_time: 90,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 8,
            weight: 65,
            rest_time: 90,
          },
          {
            set_number: 4,
            set_type: 'Normal',
            reps: 8,
            weight: 65,
            rest_time: 90,
          },
        ],
      },
      {
        name: 'Lat Pulldown',
        category: 'strength',
        targetMuscles: ['Lats', 'Biceps'],
        equipment: 'Cable',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 10,
            weight: 55,
            rest_time: 90,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 10,
            weight: 55,
            rest_time: 90,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 10,
            weight: 55,
            rest_time: 90,
          },
        ],
      },
      {
        name: 'Seated Cable Row',
        category: 'strength',
        targetMuscles: ['Middle Back', 'Rhomboids'],
        equipment: 'Cable',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 10,
            weight: 50,
            rest_time: 75,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 10,
            weight: 50,
            rest_time: 75,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 10,
            weight: 50,
            rest_time: 75,
          },
        ],
      },
      {
        name: 'Face Pull',
        category: 'strength',
        targetMuscles: ['Rear Delts', 'Rotator Cuff'],
        equipment: 'Cable',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 15,
            weight: 20,
            rest_time: 60,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 15,
            weight: 20,
            rest_time: 60,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 15,
            weight: 20,
            rest_time: 60,
          },
        ],
      },
      {
        name: 'Incline Dumbbell Bicep Curl',
        category: 'strength',
        targetMuscles: ['Biceps'],
        equipment: 'Dumbbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 10,
            weight: 14,
            rest_time: 60,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 10,
            weight: 14,
            rest_time: 60,
          },
          {
            set_number: 3,
            set_type: 'Drop Set',
            reps: 12,
            weight: 10,
            rest_time: 60,
          },
        ],
      },
    ],
  },

  // 3. PPL - Legs
  {
    id: 'ppl-legs',
    titleKey: 'routineTemplates.templates.pplLegs.title',
    defaultTitle: 'PPL - Legs (Quads, Hamstrings & Calves)',
    descriptionKey: 'routineTemplates.templates.pplLegs.desc',
    defaultDescription:
      'Heavy quad and posterior chain stimulation incorporating squats, hinges, leg accessories, and calf work.',
    category: 'ppl',
    difficulty: 'Intermediate',
    estimatedDurationMin: 60,
    targetSplit: '3 to 6 Days / Week',
    primaryMuscles: ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves'],
    exercises: [
      {
        name: 'Barbell Back Squat',
        category: 'strength',
        targetMuscles: ['Quadriceps', 'Glutes'],
        equipment: 'Barbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Warm-up',
            reps: 10,
            weight: 40,
            rest_time: 120,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 8,
            weight: 80,
            rest_time: 120,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 8,
            weight: 80,
            rest_time: 120,
          },
          {
            set_number: 4,
            set_type: 'Normal',
            reps: 8,
            weight: 80,
            rest_time: 120,
          },
        ],
      },
      {
        name: 'Romanian Deadlift',
        category: 'strength',
        targetMuscles: ['Hamstrings', 'Glutes', 'Lower Back'],
        equipment: 'Barbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 10,
            weight: 70,
            rest_time: 90,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 10,
            weight: 70,
            rest_time: 90,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 10,
            weight: 70,
            rest_time: 90,
          },
        ],
      },
      {
        name: 'Leg Press',
        category: 'strength',
        targetMuscles: ['Quadriceps', 'Glutes'],
        equipment: 'Machine',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 12,
            weight: 120,
            rest_time: 90,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 12,
            weight: 120,
            rest_time: 90,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 12,
            weight: 120,
            rest_time: 90,
          },
        ],
      },
      {
        name: 'Lying Leg Curl',
        category: 'strength',
        targetMuscles: ['Hamstrings'],
        equipment: 'Machine',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 12,
            weight: 40,
            rest_time: 60,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 12,
            weight: 40,
            rest_time: 60,
          },
          {
            set_number: 3,
            set_type: 'Drop Set',
            reps: 12,
            weight: 30,
            rest_time: 60,
          },
        ],
      },
      {
        name: 'Standing Calf Raise',
        category: 'strength',
        targetMuscles: ['Calves'],
        equipment: 'Machine',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 15,
            weight: 50,
            rest_time: 45,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 15,
            weight: 50,
            rest_time: 45,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 15,
            weight: 50,
            rest_time: 45,
          },
          {
            set_number: 4,
            set_type: 'Failure',
            reps: 15,
            weight: 50,
            rest_time: 45,
          },
        ],
      },
    ],
  },

  // 4. Upper Power
  {
    id: 'upper-power',
    titleKey: 'routineTemplates.templates.upperPower.title',
    defaultTitle: 'Upper Body Power & Hypertrophy',
    descriptionKey: 'routineTemplates.templates.upperPower.desc',
    defaultDescription:
      'Comprehensive upper body session blending heavy pressing and pulling compound lifts with targeted arm shaping.',
    category: 'upper_lower',
    difficulty: 'Intermediate',
    estimatedDurationMin: 60,
    targetSplit: '4-Day Split (Upper/Lower)',
    primaryMuscles: ['Chest', 'Back', 'Shoulders', 'Arms'],
    exercises: [
      {
        name: 'Barbell Bench Press',
        category: 'strength',
        targetMuscles: ['Chest', 'Triceps'],
        equipment: 'Barbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Warm-up',
            reps: 8,
            weight: 50,
            rest_time: 90,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 6,
            weight: 75,
            rest_time: 120,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 6,
            weight: 75,
            rest_time: 120,
          },
          {
            set_number: 4,
            set_type: 'Normal',
            reps: 6,
            weight: 75,
            rest_time: 120,
          },
        ],
      },
      {
        name: 'Barbell Bent-Over Row',
        category: 'strength',
        targetMuscles: ['Back', 'Lats'],
        equipment: 'Barbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 6,
            weight: 70,
            rest_time: 120,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 6,
            weight: 70,
            rest_time: 120,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 6,
            weight: 70,
            rest_time: 120,
          },
        ],
      },
      {
        name: 'Overhead Dumbbell Shoulder Press',
        category: 'strength',
        targetMuscles: ['Shoulders', 'Triceps'],
        equipment: 'Dumbbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 8,
            weight: 22,
            rest_time: 90,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 8,
            weight: 22,
            rest_time: 90,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 8,
            weight: 22,
            rest_time: 90,
          },
        ],
      },
      {
        name: 'Lat Pulldown',
        category: 'strength',
        targetMuscles: ['Lats', 'Biceps'],
        equipment: 'Cable',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 10,
            weight: 60,
            rest_time: 75,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 10,
            weight: 60,
            rest_time: 75,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 10,
            weight: 60,
            rest_time: 75,
          },
        ],
      },
      {
        name: 'Incline Dumbbell Bicep Curl',
        category: 'strength',
        targetMuscles: ['Biceps'],
        equipment: 'Dumbbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 10,
            weight: 14,
            rest_time: 60,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 10,
            weight: 14,
            rest_time: 60,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 10,
            weight: 14,
            rest_time: 60,
          },
        ],
      },
      {
        name: 'Tricep Rope Pushdown',
        category: 'strength',
        targetMuscles: ['Triceps'],
        equipment: 'Cable',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 12,
            weight: 25,
            rest_time: 60,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 12,
            weight: 25,
            rest_time: 60,
          },
          {
            set_number: 3,
            set_type: 'Failure',
            reps: 12,
            weight: 25,
            rest_time: 60,
          },
        ],
      },
    ],
  },

  // 5. Lower Hypertrophy
  {
    id: 'lower-hypertrophy',
    titleKey: 'routineTemplates.templates.lowerHypertrophy.title',
    defaultTitle: 'Lower Body Strength & Hypertrophy',
    descriptionKey: 'routineTemplates.templates.lowerHypertrophy.desc',
    defaultDescription:
      '4-day split lower body day emphasizing heavy squat strength and unilateral leg development with Romanian deadlifts.',
    category: 'upper_lower',
    difficulty: 'Intermediate',
    estimatedDurationMin: 55,
    targetSplit: '4-Day Split (Upper/Lower)',
    primaryMuscles: ['Quadriceps', 'Hamstrings', 'Glutes'],
    exercises: [
      {
        name: 'Barbell Back Squat',
        category: 'strength',
        targetMuscles: ['Quadriceps', 'Glutes'],
        equipment: 'Barbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Warm-up',
            reps: 10,
            weight: 40,
            rest_time: 90,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 6,
            weight: 85,
            rest_time: 120,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 6,
            weight: 85,
            rest_time: 120,
          },
          {
            set_number: 4,
            set_type: 'Normal',
            reps: 6,
            weight: 85,
            rest_time: 120,
          },
        ],
      },
      {
        name: 'Romanian Deadlift',
        category: 'strength',
        targetMuscles: ['Hamstrings', 'Glutes'],
        equipment: 'Barbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 8,
            weight: 75,
            rest_time: 90,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 8,
            weight: 75,
            rest_time: 90,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 8,
            weight: 75,
            rest_time: 90,
          },
        ],
      },
      {
        name: 'Bulgarian Split Squat',
        category: 'strength',
        targetMuscles: ['Quadriceps', 'Glutes'],
        equipment: 'Dumbbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 10,
            weight: 16,
            rest_time: 75,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 10,
            weight: 16,
            rest_time: 75,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 10,
            weight: 16,
            rest_time: 75,
          },
        ],
      },
      {
        name: 'Standing Calf Raise',
        category: 'strength',
        targetMuscles: ['Calves'],
        equipment: 'Machine',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 15,
            weight: 55,
            rest_time: 45,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 15,
            weight: 55,
            rest_time: 45,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 15,
            weight: 55,
            rest_time: 45,
          },
        ],
      },
    ],
  },

  // 6. Full Body Foundation
  {
    id: 'full-body-foundation',
    titleKey: 'routineTemplates.templates.fullBodyFoundation.title',
    defaultTitle: 'Full Body Foundation (3-Day Split A)',
    descriptionKey: 'routineTemplates.templates.fullBodyFoundation.desc',
    defaultDescription:
      'Time-efficient full body routine training every major muscle group 3 times a week with high-value compound lifts.',
    category: 'full_body',
    difficulty: 'Beginner',
    estimatedDurationMin: 50,
    targetSplit: '3 Days / Week (Mon/Wed/Fri)',
    primaryMuscles: ['Total Body', 'Chest', 'Back', 'Legs', 'Core'],
    exercises: [
      {
        name: 'Barbell Back Squat',
        category: 'strength',
        targetMuscles: ['Quadriceps', 'Glutes'],
        equipment: 'Barbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Warm-up',
            reps: 8,
            weight: 30,
            rest_time: 90,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 8,
            weight: 60,
            rest_time: 90,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 8,
            weight: 60,
            rest_time: 90,
          },
          {
            set_number: 4,
            set_type: 'Normal',
            reps: 8,
            weight: 60,
            rest_time: 90,
          },
        ],
      },
      {
        name: 'Barbell Bench Press',
        category: 'strength',
        targetMuscles: ['Chest', 'Triceps'],
        equipment: 'Barbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 8,
            weight: 60,
            rest_time: 90,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 8,
            weight: 60,
            rest_time: 90,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 8,
            weight: 60,
            rest_time: 90,
          },
        ],
      },
      {
        name: 'Barbell Bent-Over Row',
        category: 'strength',
        targetMuscles: ['Back', 'Lats'],
        equipment: 'Barbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 8,
            weight: 55,
            rest_time: 90,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 8,
            weight: 55,
            rest_time: 90,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 8,
            weight: 55,
            rest_time: 90,
          },
        ],
      },
      {
        name: 'Overhead Dumbbell Shoulder Press',
        category: 'strength',
        targetMuscles: ['Shoulders'],
        equipment: 'Dumbbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 10,
            weight: 16,
            rest_time: 60,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 10,
            weight: 16,
            rest_time: 60,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 10,
            weight: 16,
            rest_time: 60,
          },
        ],
      },
      {
        name: 'Dumbbell Lateral Raise',
        category: 'strength',
        targetMuscles: ['Lateral Delts'],
        equipment: 'Dumbbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 12,
            weight: 8,
            rest_time: 45,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 12,
            weight: 8,
            rest_time: 45,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 12,
            weight: 8,
            rest_time: 45,
          },
        ],
      },
    ],
  },

  // 7. 5/3/1 Compound Strength
  {
    id: 'strength-531-foundation',
    titleKey: 'routineTemplates.templates.strength531.title',
    defaultTitle: '5/3/1 Heavy Compound Strength',
    descriptionKey: 'routineTemplates.templates.strength531.desc',
    defaultDescription:
      'Pure strength progression focused on progressive overload across the Big 4 compound lifts with warm-ups and top working sets.',
    category: 'strength',
    difficulty: 'Advanced',
    estimatedDurationMin: 65,
    targetSplit: 'Powerlifting / Strength Focus',
    primaryMuscles: ['Total Body', 'Chest', 'Legs', 'Back'],
    exercises: [
      {
        name: 'Barbell Back Squat',
        category: 'strength',
        targetMuscles: ['Quadriceps', 'Glutes', 'Core'],
        equipment: 'Barbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Warm-up',
            reps: 5,
            weight: 50,
            rest_time: 120,
          },
          {
            set_number: 2,
            set_type: 'Warm-up',
            reps: 5,
            weight: 70,
            rest_time: 120,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 5,
            weight: 90,
            rest_time: 180,
          },
          {
            set_number: 4,
            set_type: 'Normal',
            reps: 3,
            weight: 100,
            rest_time: 180,
          },
          {
            set_number: 5,
            set_type: 'Failure',
            reps: 5,
            weight: 110,
            rest_time: 180,
            notes: 'AMRAP (As Many Reps As Possible)',
          },
        ],
      },
      {
        name: 'Barbell Bench Press',
        category: 'strength',
        targetMuscles: ['Chest', 'Triceps'],
        equipment: 'Barbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Warm-up',
            reps: 5,
            weight: 40,
            rest_time: 120,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 5,
            weight: 70,
            rest_time: 150,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 5,
            weight: 80,
            rest_time: 150,
          },
          {
            set_number: 4,
            set_type: 'Normal',
            reps: 5,
            weight: 85,
            rest_time: 150,
          },
        ],
      },
      {
        name: 'Barbell Bent-Over Row',
        category: 'strength',
        targetMuscles: ['Upper Back', 'Lats'],
        equipment: 'Barbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 8,
            weight: 70,
            rest_time: 90,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 8,
            weight: 70,
            rest_time: 90,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 8,
            weight: 70,
            rest_time: 90,
          },
        ],
      },
    ],
  },

  // 8. Dumbbell-Only Home Split
  {
    id: 'home-dumbbell-blast',
    titleKey: 'routineTemplates.templates.homeDumbbell.title',
    defaultTitle: 'Dumbbell-Only Full Body Home Workout',
    descriptionKey: 'routineTemplates.templates.homeDumbbell.desc',
    defaultDescription:
      'Complete muscle-building session requiring only a pair of dumbbells. Perfect for home workouts and minimal equipment setups.',
    category: 'home_dumbbell',
    difficulty: 'Beginner',
    estimatedDurationMin: 45,
    targetSplit: '3 Days / Week (Home)',
    primaryMuscles: ['Total Body', 'Legs', 'Chest', 'Back', 'Arms'],
    exercises: [
      {
        name: 'Dumbbell Goblet Squat',
        category: 'strength',
        targetMuscles: ['Quadriceps', 'Glutes', 'Core'],
        equipment: 'Dumbbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 12,
            weight: 20,
            rest_time: 60,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 12,
            weight: 20,
            rest_time: 60,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 12,
            weight: 20,
            rest_time: 60,
          },
        ],
      },
      {
        name: 'Incline Dumbbell Press',
        category: 'strength',
        targetMuscles: ['Chest', 'Shoulders'],
        equipment: 'Dumbbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 10,
            weight: 18,
            rest_time: 60,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 10,
            weight: 18,
            rest_time: 60,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 10,
            weight: 18,
            rest_time: 60,
          },
        ],
      },
      {
        name: 'Romanian Deadlift',
        category: 'strength',
        targetMuscles: ['Hamstrings', 'Glutes'],
        equipment: 'Dumbbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 10,
            weight: 18,
            rest_time: 60,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 10,
            weight: 18,
            rest_time: 60,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 10,
            weight: 18,
            rest_time: 60,
          },
        ],
      },
      {
        name: 'Overhead Dumbbell Shoulder Press',
        category: 'strength',
        targetMuscles: ['Shoulders', 'Triceps'],
        equipment: 'Dumbbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 10,
            weight: 14,
            rest_time: 60,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 10,
            weight: 14,
            rest_time: 60,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 10,
            weight: 14,
            rest_time: 60,
          },
        ],
      },
      {
        name: 'Incline Dumbbell Bicep Curl',
        category: 'strength',
        targetMuscles: ['Biceps'],
        equipment: 'Dumbbell',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 12,
            weight: 12,
            rest_time: 45,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 12,
            weight: 12,
            rest_time: 45,
          },
          {
            set_number: 3,
            set_type: 'Failure',
            reps: 12,
            weight: 12,
            rest_time: 45,
          },
        ],
      },
    ],
  },

  // 9. HIIT & Core Conditioning
  {
    id: 'hiit-conditioning',
    titleKey: 'routineTemplates.templates.hiitConditioning.title',
    defaultTitle: '20-Min Athletic Conditioning & Core Blast',
    descriptionKey: 'routineTemplates.templates.hiitConditioning.desc',
    defaultDescription:
      'Fast-paced athletic conditioning circuit to ramp up heart rate, burn calories, and reinforce abdominal stability.',
    category: 'conditioning',
    difficulty: 'Intermediate',
    estimatedDurationMin: 25,
    targetSplit: 'Cardio & Conditioning',
    primaryMuscles: ['Cardiovascular', 'Core', 'Full Body'],
    exercises: [
      {
        name: 'Bodyweight Push-Ups',
        category: 'strength',
        targetMuscles: ['Chest', 'Core', 'Triceps'],
        equipment: 'Bodyweight',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 15,
            weight: 0,
            rest_time: 45,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 15,
            weight: 0,
            rest_time: 45,
          },
          {
            set_number: 3,
            set_type: 'Failure',
            reps: 15,
            weight: 0,
            rest_time: 45,
          },
        ],
      },
      {
        name: 'Bulgarian Split Squat',
        category: 'strength',
        targetMuscles: ['Quadriceps', 'Glutes'],
        equipment: 'Bodyweight',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 12,
            weight: 0,
            rest_time: 45,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 12,
            weight: 0,
            rest_time: 45,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 12,
            weight: 0,
            rest_time: 45,
          },
        ],
      },
      {
        name: 'Face Pull',
        category: 'strength',
        targetMuscles: ['Upper Back', 'Postural'],
        equipment: 'Cable',
        sets: [
          {
            set_number: 1,
            set_type: 'Normal',
            reps: 15,
            weight: 15,
            rest_time: 45,
          },
          {
            set_number: 2,
            set_type: 'Normal',
            reps: 15,
            weight: 15,
            rest_time: 45,
          },
          {
            set_number: 3,
            set_type: 'Normal',
            reps: 15,
            weight: 15,
            rest_time: 45,
          },
        ],
      },
    ],
  },
];

/**
 * Converts a RoutineTemplate into a clean WorkoutPreset object ready to save or execute.
 */
export function convertTemplateToWorkoutPreset(
  template: RoutineTemplate,
  userId: string,
  existingExercises?: Exercise[]
): Omit<WorkoutPreset, 'id' | 'created_at' | 'updated_at'> {
  const existingMap = new Map<string, Exercise>();
  if (existingExercises) {
    existingExercises.forEach((ex) => {
      if (ex.name) {
        existingMap.set(ex.name.toLowerCase().trim(), ex);
      }
    });
  }

  const exercises: WorkoutPresetExercise[] = template.exercises.map(
    (item, index) => {
      const match = existingMap.get(item.name.toLowerCase().trim());
      const exerciseId = match?.id || `template-ex-${index + 1}`;

      const fullExercise: Exercise =
        match ||
        ({
          id: exerciseId,
          name: item.name,
          category: item.category,
          equipment: [item.equipment],
          primary_muscles: item.targetMuscles,
          source: 'built_in',
        } as unknown as Exercise);

      return {
        exercise_id: exerciseId,
        exercise_name: item.name,
        category: item.category,
        image_url: match?.images?.[0] || undefined,
        exercise: fullExercise,
        sort_order: index,
        sets: item.sets.map((s) => ({
          set_number: s.set_number,
          set_type: s.set_type || 'Normal',
          reps: s.reps,
          weight: s.weight,
          duration: s.duration || 0,
          rest_time: s.rest_time || 90,
          notes: s.notes || '',
        })),
      };
    }
  );

  return {
    user_id: userId,
    name: template.defaultTitle,
    description: template.defaultDescription,
    is_public: false,
    exercises,
  };
}
