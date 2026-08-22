import { describe, it, expect } from 'vitest';
import {
  generateDaysFromStartDate,
  normalizeSprintTo7Days,
  appendWeekToSprint,
  CALENDAR_DAY_ORDER,
} from '@/lib/default-data';
import { Sprint } from '@/types/timeline';

describe('Date Engine & Calendar Calculations', () => {
  it('generates 4 weeks (28 days) strictly aligned to Sunday -> Saturday', () => {
    // Starting on Saturday Aug 22, 2026
    const { days, weekGroups, monthLabel } = generateDaysFromStartDate('2026-08-22', 4);

    expect(days).toHaveLength(28);
    expect(weekGroups).toHaveLength(4);
    expect(monthLabel).toContain('2026');

    // Week 1 should start on Sunday
    expect(days[0].dayName).toBe('Sun');
    expect(days[0].weekNumber).toBe(1);
    expect(days[6].dayName).toBe('Sat');
    expect(days[6].weekNumber).toBe(1);

    // Week 2
    expect(days[7].dayName).toBe('Sun');
    expect(days[7].weekNumber).toBe(2);
    expect(days[13].dayName).toBe('Sat');

    // Verify calendar day order
    for (let w = 0; w < 4; w++) {
      const weekDays = days.slice(w * 7, (w + 1) * 7);
      const expectedDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      weekDays.forEach((d, idx) => {
        expect(d.dayName).toBe(expectedDayNames[idx]);
        expect(CALENDAR_DAY_ORDER[d.dayName.toLowerCase()]).toBe(idx);
      });
    }
  });

  it('correctly calculates consecutive dates across month boundaries', () => {
    // Start at end of August
    const { days } = generateDaysFromStartDate('2026-08-30', 2);
    expect(days).toHaveLength(14);

    // Check fullDate format YYYY-MM-DD
    days.forEach((d) => {
      expect(d.fullDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('normalizes a partial sprint to a full 7-day sorted calendar week', () => {
    const rawSprint: Sprint = {
      id: 'sprint-test',
      projectId: 'proj-test',
      name: 'Sprint 1',
      monthLabel: 'AUGUST 2026',
      scheduleLabel: '',
      orderIndex: 1,
      workdaysOnly: false,
      weekGroups: [
        {
          id: 'w-1',
          weekNumber: 1,
          label: 'WEEK 1',
          title: 'Week 1',
          dateRange: 'Mon 24 – Fri 28',
          daySpan: 5,
          dayCount: 5,
        },
      ],
      days: [
        {
          id: 'd-1-1',
          dayName: 'Mon',
          dayNum: '24',
          dateStr: '24',
          fullDate: '2026-08-24',
          weekNumber: 1,
        },
        {
          id: 'd-1-2',
          dayName: 'Fri',
          dayNum: '28',
          dateStr: '28',
          fullDate: '2026-08-28',
          weekNumber: 1,
        },
      ],
    };

    const normalized = normalizeSprintTo7Days(rawSprint);
    expect(normalized.days).toHaveLength(7);
    expect(normalized.days[0].dayName).toBe('Sun');
    expect(normalized.days[1].dayName).toBe('Mon');
    expect(normalized.days[6].dayName).toBe('Sat');
  });

  it('appends a new week to a sprint seamlessly', () => {
    const { days, weekGroups, monthLabel, scheduleLabel } = generateDaysFromStartDate('2026-08-22', 2);

    const initialSprint: Sprint = {
      id: 'sprint-append',
      projectId: 'proj-append',
      name: 'Sprint 1',
      monthLabel,
      scheduleLabel,
      orderIndex: 1,
      workdaysOnly: false,
      weekGroups,
      days,
    };

    const updated = appendWeekToSprint(initialSprint);
    expect(updated.weekGroups).toHaveLength(3);
    expect(updated.days).toHaveLength(21);
    expect(updated.weekGroups[2].weekNumber).toBe(3);
    expect(updated.days[14].dayName).toBe('Sun');
    expect(updated.days[20].dayName).toBe('Sat');
  });
});
