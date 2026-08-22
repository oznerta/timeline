import { describe, it, expect } from 'vitest';
import { TimelineHistoryManager } from '../lib/timeline-history';
import { TimelineData } from '../types/timeline';

const mockTimelineData: TimelineData = {
  project: {
    id: 'p1',
    slug: 'test-project',
    title: 'Test Project',
    status: 'active',
  },
  sprints: [],
  categories: [],
  assignees: [],
  tags: [],
  tasks: [
    {
      id: 'task-1',
      sprintId: 's1',
      categoryId: 'c1',
      dayId: 'day-1',
      daySpan: 1,
      title: 'Initial Task',
      progressPercentage: 0,
    },
  ],
};

describe('Timeline History Manager (Undo / Redo Engine)', () => {
  it('initializes with clean stacks and flags disabled', () => {
    const history = new TimelineHistoryManager(mockTimelineData);
    expect(history.currentState.tasks[0].title).toBe('Initial Task');
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });

  it('records state transitions and enables undo', () => {
    const history = new TimelineHistoryManager(mockTimelineData);
    const step2: TimelineData = {
      ...mockTimelineData,
      tasks: [{ ...mockTimelineData.tasks[0], dayId: 'day-5' }],
    };

    history.push(step2);

    expect(history.currentState.tasks[0].dayId).toBe('day-5');
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it('executes undo and restores previous state', () => {
    const history = new TimelineHistoryManager(mockTimelineData);
    const step2: TimelineData = {
      ...mockTimelineData,
      tasks: [{ ...mockTimelineData.tasks[0], dayId: 'day-5' }],
    };

    history.push(step2);
    const restored = history.undo();

    expect(restored).not.toBeNull();
    expect(history.currentState.tasks[0].dayId).toBe('day-1');
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);
  });

  it('executes redo after undo to re-apply forward state', () => {
    const history = new TimelineHistoryManager(mockTimelineData);
    const step2: TimelineData = {
      ...mockTimelineData,
      tasks: [{ ...mockTimelineData.tasks[0], dayId: 'day-10' }],
    };

    history.push(step2);
    history.undo();
    expect(history.currentState.tasks[0].dayId).toBe('day-1');

    const redone = history.redo();
    expect(redone).not.toBeNull();
    expect(history.currentState.tasks[0].dayId).toBe('day-10');
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it('clears redo future stack when a new action occurs after undo', () => {
    const history = new TimelineHistoryManager(mockTimelineData);
    history.push({
      ...mockTimelineData,
      tasks: [{ ...mockTimelineData.tasks[0], dayId: 'day-2' }],
    });

    history.undo();
    expect(history.canRedo).toBe(true);

    // New action
    history.push({
      ...mockTimelineData,
      tasks: [{ ...mockTimelineData.tasks[0], dayId: 'day-99' }],
    });

    expect(history.currentState.tasks[0].dayId).toBe('day-99');
    expect(history.canRedo).toBe(false);
    expect(history.canUndo).toBe(true);
  });

  it('caps history at maximum snapshots and discards oldest', () => {
    const history = new TimelineHistoryManager(mockTimelineData, 5); // cap at 5
    for (let i = 1; i <= 10; i++) {
      history.push({
        ...mockTimelineData,
        tasks: [{ ...mockTimelineData.tasks[0], dayId: `day-${i}` }],
      });
    }

    expect(history.currentState.tasks[0].dayId).toBe('day-10');
    // We can undo at most 5 times
    let undoCount = 0;
    while (history.canUndo) {
      history.undo();
      undoCount++;
    }
    expect(undoCount).toBe(5);
    expect(history.currentState.tasks[0].dayId).toBe('day-5');
  });
});
