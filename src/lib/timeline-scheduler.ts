import { DayInfo, TaskCard } from '@/types/timeline';

export type ReorderMode = 'push_right' | 'push_left' | 'swap' | 'stack';

export interface VisibleProjection {
  isVisible: boolean;
  startVisibleIndex: number;
  visibleSpan: number;
}

export interface CollisionResult {
  hasCollision: boolean;
  conflictingTasks: TaskCard[];
  hiddenConflicts: TaskCard[];
}

/**
 * Returns the 0-indexed position of a day in the given days sequence.
 */
export function getCanonicalDayIndex(days: DayInfo[], dayId: string): number {
  if (!dayId) return -1;
  const idx = days.findIndex((d) => d.id === dayId);
  if (idx !== -1) return idx;
  return days.findIndex(
    (d) =>
      d.fullDate === dayId ||
      d.dateStr === dayId ||
      d.id?.toLowerCase() === dayId?.toLowerCase() ||
      d.dayNum?.toString() === dayId
  );
}

/**
 * Calculates the exact visible screen grid start column and span count
 * for a task given the currently active day filter (displayDays).
 * 
 * Guarantees:
 * - A 6-day task in Mon/Wed/Fri view spans exactly 3 visible columns (Mon, Wed, Fri)
 *   and NEVER bleeds into next week's columns.
 * - A task on Friday with 3 days span in Mon-Fri view spans 1 visible column (Friday).
 */
export function calculateVisibleProjection(
  canonicalDays: DayInfo[],
  visibleDays: DayInfo[],
  task: TaskCard
): VisibleProjection {
  const sCanon = getCanonicalDayIndex(canonicalDays, task.dayId);
  if (sCanon === -1) {
    return { isVisible: false, startVisibleIndex: -1, visibleSpan: 0 };
  }

  const span = Math.max(1, task.daySpan || 1);
  const occupiedCanonDayIds = new Set<string>();
  for (let i = 0; i < span; i++) {
    const d = canonicalDays[sCanon + i];
    if (d) occupiedCanonDayIds.add(d.id);
  }

  // Find visible days that intersect the task's canonical occupied days
  const visibleIndices: number[] = [];
  visibleDays.forEach((vd, vIdx) => {
    if (occupiedCanonDayIds.has(vd.id)) {
      visibleIndices.push(vIdx);
    }
  });

  if (visibleIndices.length === 0) {
    return { isVisible: false, startVisibleIndex: -1, visibleSpan: 0 };
  }

  const startVisibleIndex = visibleIndices[0];
  const lastVisibleIndex = visibleIndices[visibleIndices.length - 1];
  const visibleSpan = lastVisibleIndex - startVisibleIndex + 1;

  return {
    isVisible: true,
    startVisibleIndex,
    visibleSpan: Math.max(1, visibleSpan),
  };
}

/**
 * Validates whether placing movingTask at targetDayId will collide with any other tasks in the track.
 */
export function checkTaskCollision(
  days: DayInfo[],
  trackTasks: TaskCard[],
  movingTaskId: string,
  targetDayId: string,
  span: number = 1
): CollisionResult {
  const targetIdx = getCanonicalDayIndex(days, targetDayId);
  if (targetIdx === -1) {
    return { hasCollision: false, conflictingTasks: [], hiddenConflicts: [] };
  }

  const targetEnd = targetIdx + Math.max(1, span) - 1;
  const conflictingTasks: TaskCard[] = [];

  trackTasks.forEach((t) => {
    if (t.id === movingTaskId) return;
    const tStart = getCanonicalDayIndex(days, t.dayId);
    if (tStart === -1) return;
    const tEnd = tStart + Math.max(1, t.daySpan || 1) - 1;

    // Interval intersection check
    if (Math.max(targetIdx, tStart) <= Math.min(targetEnd, tEnd)) {
      conflictingTasks.push(t);
    }
  });

  return {
    hasCollision: conflictingTasks.length > 0,
    conflictingTasks,
    hiddenConflicts: [],
  };
}

/**
 * Calculates the maximum days a card can expand to the right without overlapping the next card.
 */
export function getMaxResizeSpan(
  days: DayInfo[],
  trackTasks: TaskCard[],
  taskId: string,
  startDayId: string
): number {
  const sIdx = getCanonicalDayIndex(days, startDayId);
  if (sIdx === -1) return 1;

  const totalDays = days.length;
  let nextOccupiedIdx = totalDays;

  trackTasks.forEach((t) => {
    if (t.id === taskId) return;
    const tStart = getCanonicalDayIndex(days, t.dayId);
    if (tStart > sIdx && tStart < nextOccupiedIdx) {
      nextOccupiedIdx = tStart;
    }
  });

  return Math.max(1, nextOccupiedIdx - sIdx);
}

/**
 * Core Non-Overlapping Re-ordering Engine.
 * Supports 'push_right', 'push_left', and 'swap' along the active days sequence.
 * 
 * Guarantees:
 * - When in Workdays (Mon-Fri) mode, pushing past Friday shifts the task to Monday of next week,
 *   NEVER to a hidden Saturday or Sunday!
 */
export function repositionTasksWithMode(
  days: DayInfo[],
  trackTasks: TaskCard[],
  movingTaskId: string,
  targetDayId: string,
  mode: ReorderMode
): TaskCard[] {
  const targetIdx = getCanonicalDayIndex(days, targetDayId);
  const movingTask = trackTasks.find((t) => t.id === movingTaskId);

  if (targetIdx === -1 || !movingTask) {
    return trackTasks;
  }

  const movingSpan = Math.max(1, movingTask.daySpan || 1);
  const totalDays = days.length;

  if (mode === 'stack') {
    return trackTasks.map((t) => (t.id === movingTaskId ? { ...t, dayId: targetDayId } : t));
  }

  if (mode === 'swap') {
    const otherTasks = trackTasks.filter((t) => t.id !== movingTaskId);
    const occupant = otherTasks.find((t) => {
      const tStart = getCanonicalDayIndex(days, t.dayId);
      const tEnd = tStart + Math.max(1, t.daySpan || 1) - 1;
      return targetIdx >= tStart && targetIdx <= tEnd;
    }) || otherTasks.find((t) => t.dayId === targetDayId);

    if (occupant) {
      const occupantOriginalDayId = occupant.dayId;
      const movingOriginalDayId = movingTask.dayId;

      return trackTasks.map((t) => {
        if (t.id === movingTaskId) {
          return { ...t, dayId: occupantOriginalDayId };
        }
        if (t.id === occupant.id) {
          return { ...t, dayId: movingOriginalDayId };
        }
        return t;
      });
    }

    return trackTasks.map((t) => (t.id === movingTaskId ? { ...t, dayId: targetDayId } : t));
  }

  if (mode === 'push_right') {
    const updatedMoving: TaskCard = { ...movingTask, dayId: targetDayId };
    const otherTasks = trackTasks.filter((t) => t.id !== movingTaskId);

    // Sort existing tasks by start day index in active days sequence
    const sortedOthers = [...otherTasks].sort((a, b) => {
      return getCanonicalDayIndex(days, a.dayId) - getCanonicalDayIndex(days, b.dayId);
    });

    const resultTasks: TaskCard[] = [];
    const movingStart = targetIdx;
    const movingEnd = targetIdx + movingSpan - 1;

    let currentBlockedUntil = movingEnd;
    resultTasks.push(updatedMoving);

    sortedOthers.forEach((t) => {
      const tStart = getCanonicalDayIndex(days, t.dayId);
      const tSpan = Math.max(1, t.daySpan || 1);

      if (tStart + tSpan - 1 < movingStart) {
        // Card is completely before the moved card, keep untouched
        resultTasks.push(t);
      } else {
        // Shift card downstream if blocked along active days sequence
        const nextStart = Math.max(tStart, currentBlockedUntil + 1);
        const clampedStart = Math.min(nextStart, totalDays - tSpan);
        const newDay = days[Math.max(0, clampedStart)] || days[days.length - 1];
        const shiftedTask: TaskCard = { ...t, dayId: newDay.id };
        resultTasks.push(shiftedTask);
        currentBlockedUntil = clampedStart + tSpan - 1;
      }
    });

    return resultTasks;
  }

  if (mode === 'push_left') {
    const updatedMoving: TaskCard = { ...movingTask, dayId: targetDayId };
    const otherTasks = trackTasks.filter((t) => t.id !== movingTaskId);

    // Sort descending for leftward push along active days sequence
    const sortedOthers = [...otherTasks].sort((a, b) => {
      return getCanonicalDayIndex(days, b.dayId) - getCanonicalDayIndex(days, a.dayId);
    });

    const resultTasks: TaskCard[] = [updatedMoving];
    const movingStart = targetIdx;
    let currentLeftFreeBefore = movingStart;

    sortedOthers.forEach((t) => {
      const tStart = getCanonicalDayIndex(days, t.dayId);
      const tSpan = Math.max(1, t.daySpan || 1);

      if (tStart > movingStart + movingSpan - 1) {
        // Card is completely after moved card, keep untouched
        resultTasks.push(t);
      } else {
        // Shift card upstream along active days sequence
        const nextStart = Math.min(tStart, currentLeftFreeBefore - tSpan);
        const clampedStart = Math.max(0, nextStart);
        const newDay = days[clampedStart] || days[0];
        const shiftedTask: TaskCard = { ...t, dayId: newDay.id };
        resultTasks.push(shiftedTask);
        currentLeftFreeBefore = clampedStart;
      }
    });

    return resultTasks;
  }

  return trackTasks;
}

/**
 * Default non-overlapping positioning fallback
 */
export function repositionTasksWithoutOverlap(
  days: DayInfo[],
  trackTasks: TaskCard[],
  movingTaskId: string,
  targetDayId: string
): TaskCard[] {
  return repositionTasksWithMode(days, trackTasks, movingTaskId, targetDayId, 'push_right');
}
