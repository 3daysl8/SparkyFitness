import {
  calculatePlates,
  KG_PLATES,
  LBS_PLATES,
  BARBELL_OPTIONS,
} from '@/utils/plateCalculator';

describe('plateCalculator', () => {
  it('calculates exact plate configuration for standard kg target', () => {
    // 100 kg on 20 kg bar = 80 kg to load = 40 kg per side (20 + 20)
    const result = calculatePlates(100, 20, 'kg');

    expect(result.targetWeight).toBe(100);
    expect(result.barWeight).toBe(20);
    expect(result.weightPerSide).toBe(40);
    expect(result.totalLoadedWeight).toBe(100);
    expect(result.remainder).toBe(0);
    expect(result.isExact).toBe(true);
    expect(result.platesPerSide).toEqual([
      { plate: KG_PLATES.find((p) => p.weight === 25)!, count: 1 },
      { plate: KG_PLATES.find((p) => p.weight === 15)!, count: 1 },
    ]);
  });

  it('calculates exact plate configuration for complex kg weights', () => {
    // 82.5 kg on 20 kg bar = 62.5 kg to load = 31.25 kg per side (25 + 5 + 1.25)
    const result = calculatePlates(82.5, 20, 'kg');

    expect(result.weightPerSide).toBe(31.25);
    expect(result.totalLoadedWeight).toBe(82.5);
    expect(result.isExact).toBe(true);
    expect(result.platesPerSide).toEqual([
      { plate: KG_PLATES.find((p) => p.weight === 25)!, count: 1 },
      { plate: KG_PLATES.find((p) => p.weight === 5)!, count: 1 },
      { plate: KG_PLATES.find((p) => p.weight === 1.25)!, count: 1 },
    ]);
  });

  it('calculates plate configuration in lbs', () => {
    // 225 lbs on 45 lbs bar = 180 lbs to load = 90 lbs per side (2 * 45)
    const result = calculatePlates(225, 45, 'lbs');

    expect(result.targetWeight).toBe(225);
    expect(result.barWeight).toBe(45);
    expect(result.weightPerSide).toBe(90);
    expect(result.totalLoadedWeight).toBe(225);
    expect(result.isExact).toBe(true);
    expect(result.platesPerSide).toEqual([
      { plate: LBS_PLATES.find((p) => p.weight === 45)!, count: 2 },
    ]);
  });

  it('handles empty bar when target weight equals bar weight', () => {
    const result = calculatePlates(20, 20, 'kg');

    expect(result.weightPerSide).toBe(0);
    expect(result.totalLoadedWeight).toBe(20);
    expect(result.platesPerSide).toHaveLength(0);
    expect(result.isExact).toBe(true);
  });

  it('handles target weight less than bar weight gracefully', () => {
    const result = calculatePlates(15, 20, 'kg');

    expect(result.weightPerSide).toBe(0);
    expect(result.totalLoadedWeight).toBe(20);
    expect(result.platesPerSide).toHaveLength(0);
    expect(result.isExact).toBe(false);
  });

  it('identifies inexact matches and calculates remainder', () => {
    // 63 kg on 20 kg bar = 43 kg to load = 21.5 kg per side.
    // Available plates in kg: 20 + 1.25 = 21.25 kg per side (42.5 kg loaded + 20 bar = 62.5 kg total).
    // Remainder: 0.5 kg.
    const result = calculatePlates(63, 20, 'kg');

    expect(result.isExact).toBe(false);
    expect(result.remainder).toBe(0.5);
    expect(result.totalLoadedWeight).toBe(62.5);
  });

  it('supports custom bar weights', () => {
    // 15kg Women's Bar
    const result = calculatePlates(55, 15, 'kg');
    expect(result.barWeight).toBe(15);
    expect(result.weightPerSide).toBe(20);
    expect(result.totalLoadedWeight).toBe(55);
    expect(result.isExact).toBe(true);
  });

  it('exposes barbell options with default weights', () => {
    expect(BARBELL_OPTIONS.length).toBeGreaterThan(0);
    expect(BARBELL_OPTIONS[0]!.weight).toBe(20);
    expect(BARBELL_OPTIONS[0]!.unit).toBe('kg');
  });
});
