import { useState, useCallback, useRef } from 'react';
import { TimelineData } from '@/types/timeline';
import { TimelineHistoryManager } from '@/lib/timeline-history';

export interface TimelineHistoryControls {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => TimelineData | null;
  redo: () => TimelineData | null;
  recordState: (newState: TimelineData) => void;
  resetHistory: (initialState: TimelineData) => void;
}

export function useTimelineHistory(
  initialData: TimelineData
): [TimelineData, (updater: TimelineData | ((prev: TimelineData) => TimelineData)) => void, TimelineHistoryControls] {
  const managerRef = useRef<TimelineHistoryManager>(new TimelineHistoryManager(initialData, 50));
  const [present, setPresent] = useState<TimelineData>(initialData);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncFlags = useCallback(() => {
    setCanUndo(managerRef.current.canUndo);
    setCanRedo(managerRef.current.canRedo);
  }, []);

  const recordState = useCallback((newState: TimelineData) => {
    managerRef.current.push(newState);
    setPresent(newState);
    syncFlags();
  }, [syncFlags]);

  const setStateWithHistory = useCallback((updater: TimelineData | ((prev: TimelineData) => TimelineData)) => {
    setPresent((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      managerRef.current.push(next);
      syncFlags();
      return next;
    });
  }, [syncFlags]);

  const undo = useCallback((): TimelineData | null => {
    const restored = managerRef.current.undo();
    if (restored) {
      setPresent(restored);
      syncFlags();
    }
    return restored;
  }, [syncFlags]);

  const redo = useCallback((): TimelineData | null => {
    const restored = managerRef.current.redo();
    if (restored) {
      setPresent(restored);
      syncFlags();
    }
    return restored;
  }, [syncFlags]);

  const resetHistory = useCallback((initialState: TimelineData) => {
    managerRef.current.reset(initialState);
    setPresent(initialState);
    syncFlags();
  }, [syncFlags]);

  return [
    present,
    setStateWithHistory,
    {
      canUndo,
      canRedo,
      undo,
      redo,
      recordState,
      resetHistory,
    },
  ];
}
