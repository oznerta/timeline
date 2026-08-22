import { describe, it, expect } from 'vitest';
import { computeMonthLabelFromDays } from '@/lib/default-data';
import { DayConfig } from '@/types/timeline';

describe('Dynamic Month Calculation Engine', () => {
  it('returns single month when all days are in the same month', () => {
    const days: DayConfig[] = [
      { id: '1', dayName: 'Mon', dayNum: '10', dateStr: '10', fullDate: '2026-08-10', weekNumber: 1 },
      { id: '2', dayName: 'Tue', dayNum: '11', dateStr: '11', fullDate: '2026-08-11', weekNumber: 1 },
      { id: '3', dayName: 'Wed', dayNum: '12', dateStr: '12', fullDate: '2026-08-12', weekNumber: 1 },
    ];

    expect(computeMonthLabelFromDays(days)).toBe('AUGUST 2026');
  });

  it('returns dual month label when days span across two consecutive months in the same year', () => {
    const days: DayConfig[] = [
      { id: '1', dayName: 'Sat', dayNum: '29', dateStr: '29', fullDate: '2026-08-29', weekNumber: 1 },
      { id: '2', dayName: 'Sun', dayNum: '30', dateStr: '30', fullDate: '2026-08-30', weekNumber: 1 },
      { id: '3', dayName: 'Tue', dayNum: '01', dateStr: '01', fullDate: '2026-09-01', weekNumber: 1 },
      { id: '4', dayName: 'Wed', dayNum: '02', dateStr: '02', fullDate: '2026-09-02', weekNumber: 1 },
    ];

    expect(computeMonthLabelFromDays(days)).toBe('AUGUST – SEPTEMBER 2026');
  });

  it('returns span across 3 months in the same year', () => {
    const days: DayConfig[] = [
      { id: '1', dayName: 'Sat', dayNum: '29', dateStr: '29', fullDate: '2026-08-29', weekNumber: 1 },
      { id: '2', dayName: 'Wed', dayNum: '15', dateStr: '15', fullDate: '2026-09-15', weekNumber: 2 },
      { id: '3', dayName: 'Thu', dayNum: '08', dateStr: '08', fullDate: '2026-10-08', weekNumber: 3 },
    ];

    expect(computeMonthLabelFromDays(days)).toBe('AUGUST – OCTOBER 2026');
  });

  it('returns multi-year formatted label when spanning across New Year', () => {
    const days: DayConfig[] = [
      { id: '1', dayName: 'Thu', dayNum: '31', dateStr: '31', fullDate: '2026-12-31', weekNumber: 1 },
      { id: '2', dayName: 'Fri', dayNum: '01', dateStr: '01', fullDate: '2027-01-01', weekNumber: 1 },
    ];

    expect(computeMonthLabelFromDays(days)).toBe('DECEMBER 2026 – JANUARY 2027');
  });

  it('handles empty or malformed array gracefully', () => {
    expect(computeMonthLabelFromDays([])).toBe('SCHEDULE');
  });
});
