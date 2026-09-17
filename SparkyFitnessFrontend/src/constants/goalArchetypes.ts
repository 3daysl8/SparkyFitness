export interface GoalArchetype {
  id: string;
  pillarName: string;
  pillarColor: string;
  icon: string;
  titleKey: string;
  titleDefault: string;
  descriptionKey: string;
  descriptionDefault: string;
  longTerm: {
    statementKey: string;
    statementDefault: string;
    whyKey: string;
    whyDefault: string;
  };
  weekly: {
    statementKey: string;
    statementDefault: string;
    targetValue: number;
    unit: string;
  };
  daily: {
    statementKey: string;
    statementDefault: string;
    cueKey: string;
    cueDefault: string;
    obstacleKey: string;
    obstacleDefault: string;
    planKey: string;
    planDefault: string;
    recurrenceDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  };
}

export const GOAL_ARCHETYPES: GoalArchetype[] = [
  {
    id: 'strength_builder',
    pillarName: 'Strength & Conditioning',
    pillarColor: '#6366f1',
    icon: 'Dumbbell',
    titleKey: 'focus.archetypes.strength.title',
    titleDefault: 'Consistent Strength Builder',
    descriptionKey: 'focus.archetypes.strength.desc',
    descriptionDefault:
      'Build progressive physical resilience, lean muscle, and functional power through structured resistance training.',
    longTerm: {
      statementKey: 'focus.archetypes.strength.longTerm',
      statementDefault:
        'Cultivate a strong, capable body that handles life with vigor and confidence.',
      whyKey: 'focus.archetypes.strength.why',
      whyDefault:
        'To feel energized, prevent injury, and stay physically capable for decades.',
    },
    weekly: {
      statementKey: 'focus.archetypes.strength.weekly',
      statementDefault: 'Complete 3 focused resistance training sessions',
      targetValue: 3,
      unit: 'sessions',
    },
    daily: {
      statementKey: 'focus.archetypes.strength.daily',
      statementDefault:
        'Execute scheduled strength workout with high intent & track progressive load',
      cueKey: 'focus.archetypes.strength.cue',
      cueDefault:
        'Pack workout gear the night before; train at 7:00 AM or right after work',
      obstacleKey: 'focus.archetypes.strength.obstacle',
      obstacleDefault:
        'Feeling low on energy or pressed for time at the end of the day',
      planKey: 'focus.archetypes.strength.plan',
      planDefault:
        'If low energy, commit to just the warmup and 2 main compound sets (20 mins)',
      recurrenceDays: [1, 3, 5], // Mon, Wed, Fri
    },
  },
  {
    id: 'fasting_metabolic',
    pillarName: 'Nutrition & Metabolic Health',
    pillarColor: '#10b981',
    icon: 'Flame',
    titleKey: 'focus.archetypes.fasting.title',
    titleDefault: 'Metabolic Flexibility & Fasting',
    descriptionKey: 'focus.archetypes.fasting.desc',
    descriptionDefault:
      'Improve insulin sensitivity, mental clarity, and fat oxidation with a consistent fasting window.',
    longTerm: {
      statementKey: 'focus.archetypes.fasting.longTerm',
      statementDefault:
        'Achieve effortless energy stability and optimal body composition through mindful eating rhythms.',
      whyKey: 'focus.archetypes.fasting.why',
      whyDefault:
        'To eliminate mid-afternoon energy crashes and develop metabolic self-mastery.',
    },
    weekly: {
      statementKey: 'focus.archetypes.fasting.weekly',
      statementDefault: 'Complete 5 days of 16:8 intermittent fasting',
      targetValue: 5,
      unit: 'days',
    },
    daily: {
      statementKey: 'focus.archetypes.fasting.daily',
      statementDefault:
        'Close eating window by 8:00 PM and fast until 12:00 PM next day (16 hours)',
      cueKey: 'focus.archetypes.fasting.cue',
      cueDefault: 'Start fasting timer immediately upon finishing dinner',
      obstacleKey: 'focus.archetypes.fasting.obstacle',
      obstacleDefault: 'Late-night cravings while watching TV or relaxing',
      planKey: 'focus.archetypes.fasting.plan',
      planDefault:
        'If evening craving hits, brew hot peppermint tea and drink 500ml water',
      recurrenceDays: [1, 2, 3, 4, 5], // Mon-Fri
    },
  },
  {
    id: 'vital_hydration',
    pillarName: 'Daily Vitality & Hydration',
    pillarColor: '#06b6d4',
    icon: 'Droplet',
    titleKey: 'focus.archetypes.hydration.title',
    titleDefault: 'Optimal Daily Hydration',
    descriptionKey: 'focus.archetypes.hydration.desc',
    descriptionDefault:
      'Maintain cellular hydration, boost cognitive performance, and aid post-workout recovery.',
    longTerm: {
      statementKey: 'focus.archetypes.hydration.longTerm',
      statementDefault:
        'Keep body and mind consistently energized through dialed daily hydration habits.',
      whyKey: 'focus.archetypes.hydration.why',
      whyDefault:
        'To prevent brain fog, support digestion, and optimize physical performance.',
    },
    weekly: {
      statementKey: 'focus.archetypes.hydration.weekly',
      statementDefault: 'Hit 2.5L+ daily hydration target across 6+ days',
      targetValue: 6,
      unit: 'days',
    },
    daily: {
      statementKey: 'focus.archetypes.hydration.daily',
      statementDefault:
        'Drink 2,500 ml of water & electrolytes throughout the day',
      cueKey: 'focus.archetypes.hydration.cue',
      cueDefault:
        'Drink 500ml water with pinch of sea salt upon waking before coffee',
      obstacleKey: 'focus.archetypes.hydration.obstacle',
      obstacleDefault:
        'Forgetting to drink during back-to-back busy work meetings',
      planKey: 'focus.archetypes.hydration.plan',
      planDefault:
        'Keep a dedicated 1L water container directly on my desk in plain sight',
      recurrenceDays: [0, 1, 2, 3, 4, 5, 6], // Daily
    },
  },
  {
    id: 'restorative_recovery',
    pillarName: 'Mindset & Restorative Sleep',
    pillarColor: '#8b5cf6',
    icon: 'Moon',
    titleKey: 'focus.archetypes.sleep.title',
    titleDefault: 'Restorative Sleep & Recovery',
    descriptionKey: 'focus.archetypes.sleep.desc',
    descriptionDefault:
      'Anchor high quality deep sleep and low bedtime stress to supercharge daytime drive.',
    longTerm: {
      statementKey: 'focus.archetypes.sleep.longTerm',
      statementDefault:
        'Wake up refreshed, sharp, and naturally energized every morning without relying on excessive stimulants.',
      whyKey: 'focus.archetypes.sleep.why',
      whyDefault:
        'Because deep sleep is the foundation of emotional balance, immune health, and muscular recovery.',
    },
    weekly: {
      statementKey: 'focus.archetypes.sleep.weekly',
      statementDefault:
        'Maintain 7.5+ hours sleep average & consistent sleep schedule',
      targetValue: 7,
      unit: 'nights',
    },
    daily: {
      statementKey: 'focus.archetypes.sleep.daily',
      statementDefault:
        'Complete 30-minute digital wind-down & lights out by 10:30 PM',
      cueKey: 'focus.archetypes.sleep.cue',
      cueDefault:
        'Night mode alarm at 10:00 PM to turn off bright screens & dim ambient lights',
      obstacleKey: 'focus.archetypes.sleep.obstacle',
      obstacleDefault:
        'Mind racing with tomorrow’s to-do list while lying in bed',
      planKey: 'focus.archetypes.sleep.plan',
      planDefault:
        'If thoughts race, write a 2-minute brain dump on bedside notepad and do 4-7-8 breathing',
      recurrenceDays: [0, 1, 2, 3, 4, 5, 6], // Daily
    },
  },
];
