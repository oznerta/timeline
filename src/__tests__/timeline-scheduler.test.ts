import { describe, it, expect } from 'vitest';
import {
  calculateVisibleProjection,
  checkTaskCollision,
  getMaxResizeSpan,
  repositionTasksWithMode,
} from '../lib/timeline-scheduler';
import { DayInfo, TaskCard } from '../types/timeline';

// Generate standard 28-day sprint
const mockDays: DayInfo[] = Array.from({ length: 28 }, (_, i) => {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = dayNames[i % 7];
  return {
    id: `day-${i + 1}`,
    dayNum: i + 1,
    dayName,
    isWeekend: dayName === 'Sun' || dayName === 'Sat',
    isWeekStart: dayName === 'Sun',
    weekNumber: Math.floor(i / 7) + 1,
  };
});

describe('Timeline Scheduler & Projection Engine', () => {
  it('correctly projects multi-day cards onto a 5-day Workdays view without bleeding', () => {
    // 5-day view (Mon-Fri)
    const workdays = mockDays.filter((d) => !d.isWeekend);
    
    // Card on Friday (day-6) with 3-day span (Fri, Sat, Sun)
    const fridayCard: TaskCard = {
      id: 'card-1',
      sprintId: 's1',
      categoryId: 'c1',
      dayId: 'day-6', // Friday
      daySpan: 3, // Fri 6, Sat 7, Sun 8
      title: 'Weekend Deploy',
      progressPercentage: 0,
    };

    const projection = calculateVisibleProjection(mockDays, workdays, fridayCard);
    expect(projection.isVisible).toBe(true);
    // On workdays, Friday is at index 4 (Mon 2, Tue 3, Wed 4, Thu 5, Fri 6)
    expect(projection.startVisibleIndex).toBe(4);
    // Since Saturday and Sunday are hidden, it spans only Friday on screen (1 column)
    expect(projection.visibleSpan).toBe(1);
  });

  it('correctly projects a 6-day card onto a Mon/Wed/Fri custom filter view', () => {
    // Mon, Wed, Fri only
    const customDays = mockDays.filter((d) => d.dayName === 'Mon' || d.dayName === 'Wed' || d.dayName === 'Fri');

    // 6-day card from Monday (day-2) to Saturday (day-7)
    const longCard: TaskCard = {
      id: 'card-2',
      sprintId: 's1',
      categoryId: 'c1',
      dayId: 'day-2', // Monday
      daySpan: 6, // Mon, Tue, Wed, Thu, Fri, Sat
      title: 'Full Week Campaign',
      progressPercentage: 0,
    };

    const projection = calculateVisibleProjection(mockDays, customDays, longCard);
    expect(projection.isVisible).toBe(true);
    expect(projection.startVisibleIndex).toBe(0); // Mon 2 is first visible day
    // Mon 2, Wed 4, Fri 6 are the 3 visible days
    expect(projection.visibleSpan).toBe(3);
  });

  it('detects collisions accurately for multi-day cards', () => {
    const trackTasks: TaskCard[] = [
      { id: 't1', sprintId: 's1', categoryId: 'c1', dayId: 'day-3', daySpan: 2, title: 'Task 1', progressPercentage: 0 },
      { id: 't2', sprintId: 's1', categoryId: 'c1', dayId: 'day-10', daySpan: 1, title: 'Task 2', progressPercentage: 0 },
    ];

    // Dropping a 2-day card on day-2 (occupies day-2 and day-3) should collide with t1 (day-3)
    const result = checkTaskCollision(mockDays, trackTasks, 'moving-card', 'day-2', 2);
    expect(result.hasCollision).toBe(true);
    expect(result.conflictingTasks[0].id).toBe('t1');

    // Dropping on day-6 (empty) should not collide
    const cleanResult = checkTaskCollision(mockDays, trackTasks, 'moving-card', 'day-6', 2);
    expect(cleanResult.hasCollision).toBe(false);
  });

  it('correctly bounds drag-to-resize up to the next card in the track', () => {
    const trackTasks: TaskCard[] = [
      { id: 't1', sprintId: 's1', categoryId: 'c1', dayId: 'day-2', daySpan: 1, title: 'Task 1', progressPercentage: 0 },
      { id: 't2', sprintId: 's1', categoryId: 'c1', dayId: 'day-5', daySpan: 1, title: 'Task 2', progressPercentage: 0 },
    ];

    // t1 starts at index 1 (day-2), t2 starts at index 4 (day-5). Distance is 3 days (days 2, 3, 4).
    const maxSpan = getMaxResizeSpan(mockDays, trackTasks, 't1', 'day-2');
    expect(maxSpan).toBe(3);
  });

  it('executes push_right cascade with zero overlaps', () => {
    const trackTasks: TaskCard[] = [
      { id: 't1', sprintId: 's1', categoryId: 'c1', dayId: 'day-1', daySpan: 1, title: 'Task 1', progressPercentage: 0 },
      { id: 't2', sprintId: 's1', categoryId: 'c1', dayId: 'day-2', daySpan: 2, title: 'Task 2', progressPercentage: 0 },
    ];

    // Moving t1 into day-2 with push_right should push t2 downstream to day-3
    const reordered = repositionTasksWithMode(mockDays, trackTasks, 't1', 'day-2', 'push_right');
    const movedT1 = reordered.find((t) => t.id === 't1');
    const shiftedT2 = reordered.find((t) => t.id === 't2');

    expect(movedT1?.dayId).toBe('day-2');
    expect(shiftedT2?.dayId).toBe('day-3');
  });

  it('executes swap cleanly between cards', () => {
    const trackTasks: TaskCard[] = [
      { id: 't1', sprintId: 's1', categoryId: 'c1', dayId: 'day-2', daySpan: 1, title: 'Task 1', progressPercentage: 0 },
      { id: 't2', sprintId: 's1', categoryId: 'c1', dayId: 'day-8', daySpan: 1, title: 'Task 2', progressPercentage: 0 },
    ];

    const swapped = repositionTasksWithMode(mockDays, trackTasks, 't1', 'day-8', 'swap');
    expect(swapped.find((t) => t.id === 't1')?.dayId).toBe('day-8');
    expect(swapped.find((t) => t.id === 't2')?.dayId).toBe('day-2');
  });

  it('correctly shifts cards past Friday to Monday of next week in a Workdays view without landing on hidden weekend', () => {
    const workdays = mockDays.filter((d) => !d.isWeekend);
    // In workdays: Week 1 Friday is day-6. Week 2 Monday is day-9.
    const trackTasks: TaskCard[] = [
      { id: 't1', sprintId: 's1', categoryId: 'c1', dayId: 'day-5', daySpan: 1, title: 'Thursday Card', progressPercentage: 0 },
      { id: 't2', sprintId: 's1', categoryId: 'c1', dayId: 'day-6', daySpan: 1, title: 'Friday Card', progressPercentage: 0 },
    ];

    // Move t1 into day-6 (Friday) with push_right.
    // In workdays sequence, the day right after Friday (day-6) is Monday (day-9)!
    const reordered = repositionTasksWithMode(workdays, trackTasks, 't1', 'day-6', 'push_right');
    const movedT1 = reordered.find((t) => t.id === 't1');
    const shiftedT2 = reordered.find((t) => t.id === 't2');

    expect(movedT1?.dayId).toBe('day-6'); // Friday
    expect(shiftedT2?.dayId).toBe('day-9'); // Monday of next week (NOT Saturday day-7 or Sunday day-8)!
  });
});
