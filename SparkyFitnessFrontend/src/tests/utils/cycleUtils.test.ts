import {
  calculateCycleDay,
  determineCyclePhase,
  getPhaseRecommendations,
  calculateCycleInfo,
  daysDifference,
  addDaysToDateStr,
  getStoredCycleSettings,
  saveStoredCycleSettings,
  getStoredCycleEntries,
  saveStoredCycleEntry,
  DEFAULT_CYCLE_SETTINGS,
} from '@/utils/cycleUtils';

describe('cycleUtils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('daysDifference and addDaysToDateStr', () => {
    it('calculates difference in days correctly', () => {
      expect(daysDifference('2026-09-01', '2026-09-15')).toBe(14);
      expect(daysDifference('2026-09-15', '2026-09-01')).toBe(-14);
      expect(daysDifference('2026-09-01', '2026-09-01')).toBe(0);
    });

    it('adds days to date string accurately', () => {
      expect(addDaysToDateStr('2026-09-01', 14)).toBe('2026-09-15');
      expect(addDaysToDateStr('2026-09-28', 5)).toBe('2026-10-03');
    });
  });

  describe('calculateCycleDay', () => {
    it('calculates current day of cycle correctly within first cycle', () => {
      const res = calculateCycleDay('2026-09-01', '2026-09-10', 28);
      expect(res.cycleDay).toBe(10);
      expect(res.cycleStartDate).toBe('2026-09-01');
    });

    it('wraps around to next cycle when exceeding cycle length', () => {
      const res = calculateCycleDay('2026-09-01', '2026-09-30', 28); // 29 days later = Day 2 of cycle 2
      expect(res.cycleDay).toBe(2);
      expect(res.cycleStartDate).toBe('2026-09-29');
    });

    it('handles start date in future gracefully', () => {
      const res = calculateCycleDay('2026-09-20', '2026-09-10', 28);
      expect(res.cycleDay).toBe(1);
    });
  });

  describe('determineCyclePhase', () => {
    it('identifies menstrual phase (days 1-5 for 5-day period)', () => {
      expect(determineCyclePhase(1, 28, 5, 14)).toBe('menstrual');
      expect(determineCyclePhase(3, 28, 5, 14)).toBe('menstrual');
      expect(determineCyclePhase(5, 28, 5, 14)).toBe('menstrual');
    });

    it('identifies follicular phase (days 6-12)', () => {
      expect(determineCyclePhase(6, 28, 5, 14)).toBe('follicular');
      expect(determineCyclePhase(10, 28, 5, 14)).toBe('follicular');
      expect(determineCyclePhase(12, 28, 5, 14)).toBe('follicular');
    });

    it('identifies ovulatory phase (days 13-15 for 28-day cycle)', () => {
      expect(determineCyclePhase(13, 28, 5, 14)).toBe('ovulatory');
      expect(determineCyclePhase(14, 28, 5, 14)).toBe('ovulatory');
      expect(determineCyclePhase(15, 28, 5, 14)).toBe('ovulatory');
    });

    it('identifies luteal phase (days 16-28)', () => {
      expect(determineCyclePhase(16, 28, 5, 14)).toBe('luteal');
      expect(determineCyclePhase(22, 28, 5, 14)).toBe('luteal');
      expect(determineCyclePhase(28, 28, 5, 14)).toBe('luteal');
    });
  });

  describe('getPhaseRecommendations', () => {
    it('provides tailored training and nutrition for each phase', () => {
      const menstrual = getPhaseRecommendations('menstrual');
      expect(menstrual.trainingGuidance.intensity).toBe('recovery');

      const follicular = getPhaseRecommendations('follicular');
      expect(follicular.trainingGuidance.intensity).toBe('high');

      const ovulatory = getPhaseRecommendations('ovulatory');
      expect(ovulatory.trainingGuidance.intensity).toBe('high');

      const luteal = getPhaseRecommendations('luteal');
      expect(luteal.trainingGuidance.intensity).toBe('moderate');
      expect(luteal.nutritionGuidance.metabolicNote).toContain(
        'Metabolic rate'
      );
    });
  });

  describe('calculateCycleInfo', () => {
    it('generates full cycle prediction model', () => {
      const settings = {
        ...DEFAULT_CYCLE_SETTINGS,
        last_period_start_date: '2026-09-01',
        avg_cycle_length: 28,
        avg_period_length: 5,
        luteal_phase_length: 14,
      };

      const info = calculateCycleInfo('2026-09-10', settings);
      expect(info.cycleDay).toBe(10);
      expect(info.phase).toBe('follicular');
      expect(info.nextPeriodDate).toBe('2026-09-29');
      expect(info.ovulationDate).toBe('2026-09-14');
      expect(info.daysUntilNextPeriod).toBe(19);
    });
  });

  describe('persistence helpers', () => {
    it('saves and retrieves cycle settings from localStorage', () => {
      saveStoredCycleSettings({ avg_cycle_length: 30, avg_period_length: 6 });
      const stored = getStoredCycleSettings();
      expect(stored.avg_cycle_length).toBe(30);
      expect(stored.avg_period_length).toBe(6);
    });

    it('saves and retrieves daily cycle entries', () => {
      saveStoredCycleEntry({
        date: '2026-09-18',
        flow: 'medium',
        symptoms: ['cramps', 'fatigue'],
        energy: 4,
      });

      const all = getStoredCycleEntries();
      expect(all['2026-09-18']?.flow).toBe('medium');
      expect(all['2026-09-18']?.symptoms).toContain('cramps');
    });
  });
});
