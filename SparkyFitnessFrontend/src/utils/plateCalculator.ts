/**
 * Barbell plate loading calculator and Olympic color palette.
 */

export interface PlateSpec {
  weight: number;
  color: string;
  borderColor: string;
  textColor: string;
  heightClass: string; // for proportional visual rendering
}

export const KG_PLATES: PlateSpec[] = [
  {
    weight: 25,
    color: '#ef4444',
    borderColor: '#b91c1c',
    textColor: '#ffffff',
    heightClass: 'h-24',
  }, // Red
  {
    weight: 20,
    color: '#3b82f6',
    borderColor: '#1d4ed8',
    textColor: '#ffffff',
    heightClass: 'h-24',
  }, // Blue
  {
    weight: 15,
    color: '#eab308',
    borderColor: '#a16207',
    textColor: '#000000',
    heightClass: 'h-20',
  }, // Yellow
  {
    weight: 10,
    color: '#22c55e',
    borderColor: '#15803d',
    textColor: '#ffffff',
    heightClass: 'h-18',
  }, // Green
  {
    weight: 5,
    color: '#f8fafc',
    borderColor: '#94a3b8',
    textColor: '#0f172a',
    heightClass: 'h-14',
  }, // White
  {
    weight: 2.5,
    color: '#1e293b',
    borderColor: '#0f172a',
    textColor: '#f8fafc',
    heightClass: 'h-12',
  }, // Black
  {
    weight: 1.25,
    color: '#94a3b8',
    borderColor: '#64748b',
    textColor: '#0f172a',
    heightClass: 'h-10',
  }, // Silver
];

export const LBS_PLATES: PlateSpec[] = [
  {
    weight: 45,
    color: '#3b82f6',
    borderColor: '#1d4ed8',
    textColor: '#ffffff',
    heightClass: 'h-24',
  }, // Blue
  {
    weight: 35,
    color: '#eab308',
    borderColor: '#a16207',
    textColor: '#000000',
    heightClass: 'h-20',
  }, // Yellow
  {
    weight: 25,
    color: '#22c55e',
    borderColor: '#15803d',
    textColor: '#ffffff',
    heightClass: 'h-18',
  }, // Green
  {
    weight: 10,
    color: '#f8fafc',
    borderColor: '#94a3b8',
    textColor: '#0f172a',
    heightClass: 'h-14',
  }, // White
  {
    weight: 5,
    color: '#1e293b',
    borderColor: '#0f172a',
    textColor: '#f8fafc',
    heightClass: 'h-12',
  }, // Black
  {
    weight: 2.5,
    color: '#94a3b8',
    borderColor: '#64748b',
    textColor: '#0f172a',
    heightClass: 'h-10',
  }, // Silver
];

export interface PlateCount {
  plate: PlateSpec;
  count: number;
}

export interface PlateCalculationResult {
  targetWeight: number;
  barWeight: number;
  unit: string;
  weightPerSide: number;
  totalLoadedWeight: number;
  platesPerSide: PlateCount[];
  remainder: number;
  isExact: boolean;
}

export const BARBELL_OPTIONS = [
  { label: 'Olympic Bar (20 kg)', weight: 20, unit: 'kg' },
  { label: 'Olympic Bar (45 lbs)', weight: 45, unit: 'lbs' },
  { label: "Women's Bar (15 kg)", weight: 15, unit: 'kg' },
  { label: "Women's Bar (33 lbs)", weight: 33, unit: 'lbs' },
  { label: 'Technique Bar (10 kg)', weight: 10, unit: 'kg' },
  { label: 'EZ Curl Bar (7.5 kg / 15 lbs)', weight: 7.5, unit: 'kg' },
  { label: 'No Bar (0 kg/lbs)', weight: 0, unit: 'kg' },
];

/**
 * Calculates the exact plate combination needed per side for a target barbell weight.
 */
export function calculatePlates(
  targetWeight: number,
  barWeight: number = 20,
  unit: string = 'kg',
  availablePlates?: PlateSpec[]
): PlateCalculationResult {
  const plates = availablePlates ?? (unit === 'lbs' ? LBS_PLATES : KG_PLATES);
  const normalizedTarget = Math.max(0, targetWeight);
  const normalizedBar = Math.max(0, barWeight);

  if (normalizedTarget <= normalizedBar) {
    return {
      targetWeight: normalizedTarget,
      barWeight: normalizedBar,
      unit,
      weightPerSide: 0,
      totalLoadedWeight: normalizedBar,
      platesPerSide: [],
      remainder: 0,
      isExact: normalizedTarget === normalizedBar,
    };
  }

  const weightToLoad = normalizedTarget - normalizedBar;
  let remainingPerSide = weightToLoad / 2;
  const platesPerSide: PlateCount[] = [];

  // Sort plates descending
  const sortedPlates = [...plates].sort((a, b) => b.weight - a.weight);

  for (const plate of sortedPlates) {
    if (remainingPerSide >= plate.weight) {
      const count = Math.floor(remainingPerSide / plate.weight);
      if (count > 0) {
        platesPerSide.push({ plate, count });
        remainingPerSide =
          Math.round((remainingPerSide - count * plate.weight) * 100) / 100;
      }
    }
  }

  const loadedPerSide = platesPerSide.reduce(
    (sum, item) => sum + item.plate.weight * item.count,
    0
  );
  const totalLoadedWeight =
    Math.round((normalizedBar + loadedPerSide * 2) * 100) / 100;
  const remainder =
    Math.round((normalizedTarget - totalLoadedWeight) * 100) / 100;

  return {
    targetWeight: normalizedTarget,
    barWeight: normalizedBar,
    unit,
    weightPerSide: loadedPerSide,
    totalLoadedWeight,
    platesPerSide,
    remainder,
    isExact: Math.abs(remainder) < 0.01,
  };
}
