import { describe, it, expect } from 'vitest';
import { computeTrackLanes } from '../lib/lane-layout';
import { DayInfo, TaskCard } from '../types/timeline';

describe('Multi-Lane Layout Engine (Multiple Cards per Day)', () => {
  const mockDays: DayInfo[] = [
    { id: 'd-1', dayName: 'Mon', dayNum: '1', weekNumber: 1, isWeekend: false },
    { id: 'd-2', dayName: 'Tue', dayNum: '2', weekNumber: 1, isWeekend: false },
    { id: 'd-3', dayName: 'Wed', dayNum: '3', weekNumber: 1, isWeekend: false },
    { id: 'd-4', dayName: 'Thu', dayNum: '4', weekNumber: 1, isWeekend: false },
    { id: 'd-5', dayName: 'Fri', dayNum: '5', weekNumber: 1, isWeekend: false },
  ];

  const createTask = (id: string, dayId: string, span: number = 1): TaskCard => ({
    id,
    projectId: 'p-1',
    sprintId: 's-1',
    categoryId: 'c-1',
    dayId,
    daySpan: span,
    title: `Task ${id}`,
    deliverables: [],
    deliverableItems: [],
    progressPercentage: 0,
  });

  it('allocates a single lane when tasks do not overlap', () => {
    const tasks = [
      createTask('t1', 'd-1', 1),
      createTask('t2', 'd-3', 1),
      createTask('t3', 'd-5', 1),
    ];

    const result = computeTrackLanes(mockDays, mockDays, tasks);
    expect(result.maxLanes).toBe(1);
    expect(result.taskLaneMap.get('t1')).toBe(0);
    expect(result.taskLaneMap.get('t2')).toBe(0);
    expect(result.taskLaneMap.get('t3')).toBe(0);
  });

  it('allocates multiple vertical lanes for cards on the exact same day', () => {
    const tasks = [
      createTask('card-1', 'd-1', 1),
      createTask('card-2', 'd-1', 1),
      createTask('card-3', 'd-1', 1),
    ];

    const result = computeTrackLanes(mockDays, mockDays, tasks);
    expect(result.maxLanes).toBe(3);
    expect(result.taskLaneMap.get('card-1')).toBe(0);
    expect(result.taskLaneMap.get('card-2')).toBe(1);
    expect(result.taskLaneMap.get('card-3')).toBe(2);
  });

  it('handles multi-day spanning cards overlapping with single-day cards', () => {
    const tasks = [
      createTask('span-mon-wed', 'd-1', 3), // Mon, Tue, Wed
      createTask('tue-single', 'd-2', 1),   // Tue
      createTask('wed-single', 'd-3', 1),   // Wed
      createTask('thu-single', 'd-4', 1),   // Thu (non-overlapping with span)
    ];

    const result = computeTrackLanes(mockDays, mockDays, tasks);
    expect(result.maxLanes).toBe(2);
    expect(result.taskLaneMap.get('span-mon-wed')).toBe(0);
    expect(result.taskLaneMap.get('tue-single')).toBe(1);
    // wed-single can reuse lane 1 after tue-single
    expect(result.taskLaneMap.get('wed-single')).toBe(1);
    // thu-single can reuse lane 0 after span-mon-wed finishes
    expect(result.taskLaneMap.get('thu-single')).toBe(0);
  });

  it('returns default 1 lane when track has zero tasks', () => {
    const result = computeTrackLanes(mockDays, mockDays, []);
    expect(result.maxLanes).toBe(1);
    expect(result.taskLaneMap.size).toBe(0);
  });
});
