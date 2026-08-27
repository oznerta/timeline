import { DayInfo, TaskCard } from '@/types/timeline';
import { calculateVisibleProjection } from './timeline-scheduler';

export interface LaneAllocationResult {
  taskLaneMap: Map<string, number>;
  maxLanes: number;
}

/**
 * Computes optimal vertical lane indices for a list of tasks within a category track.
 * 
 * Guarantees:
 * - Tasks that overlap on any day (including single-day multiple cards) are assigned distinct lane indices (0, 1, 2...).
 * - Tasks that do not overlap share the lowest available lane (lane 0) to maximize space efficiency.
 * - If no tasks exist, returns 1 lane.
 */
export function computeTrackLanes(
  canonicalDays: DayInfo[],
  visibleDays: DayInfo[],
  trackTasks: TaskCard[]
): LaneAllocationResult {
  const taskLaneMap = new Map<string, number>();
  if (!trackTasks || trackTasks.length === 0) {
    return { taskLaneMap, maxLanes: 1 };
  }

  // 1. Calculate projections and collect visible tasks
  const visibleTaskInfos: {
    task: TaskCard;
    start: number;
    end: number;
  }[] = [];

  trackTasks.forEach((task) => {
    const proj = calculateVisibleProjection(canonicalDays, visibleDays, task);
    if (proj.isVisible) {
      visibleTaskInfos.push({
        task,
        start: proj.startVisibleIndex,
        end: proj.startVisibleIndex + proj.visibleSpan - 1,
      });
    } else {
      taskLaneMap.set(task.id, 0);
    }
  });

  // 2. Sort visible tasks by start index (ascending), then span (descending)
  visibleTaskInfos.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return (b.end - b.start) - (a.end - a.start);
  });

  // 3. Greedy lane allocation (Interval Graph Coloring)
  const laneEndPositions: number[] = []; // laneEndPositions[lane] = last occupied visible column index

  visibleTaskInfos.forEach(({ task, start, end }) => {
    let assignedLane = -1;

    for (let l = 0; l < laneEndPositions.length; l++) {
      if (start > laneEndPositions[l]) {
        assignedLane = l;
        laneEndPositions[l] = end;
        break;
      }
    }

    if (assignedLane === -1) {
      assignedLane = laneEndPositions.length;
      laneEndPositions.push(end);
    }

    taskLaneMap.set(task.id, assignedLane);
  });

  const maxLanes = Math.max(1, laneEndPositions.length);
  return { taskLaneMap, maxLanes };
}
