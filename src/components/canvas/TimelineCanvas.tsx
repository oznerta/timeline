'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpDown,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  Edit2,
  Edit3,
  Eye,
  Globe,
  Loader2,
  Lock,
  LogIn,
  Mouse,
  Plus,
  Settings,
  Share2,
  SlidersHorizontal,
  Tag as TagIcon,
  Trash2,
  Undo2,
  Redo2,
  User as UserIcon,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  AccessLevel,
  Assignee,
  CategoryTrack,
  Collaborator,
  PermissionLevel,
  Tag,
  TaskCard,
  TimelineData,
  WeekGroup,
} from '@/types/timeline';
import { useAuth } from '@/context/AuthContext';
import {
  CURATED_TAG_COLORS,
  getRandomTagColor,
  appendWeekToSprint,
  normalizeSprintTo7Days,
  computeMonthLabelFromDays,
  CALENDAR_DAY_ORDER,
  getInitials,
} from '@/lib/default-data';
import {
  calculateVisibleProjection,
  checkTaskCollision,
  getMaxResizeSpan,
  repositionTasksWithMode,
  ReorderMode,
} from '@/lib/timeline-scheduler';
import { useTimelineHistory } from '@/hooks/useTimelineHistory';

interface TimelineCanvasProps {
  initialData: TimelineData;
  onSaveData: (data: TimelineData) => Promise<void>;
  slug: string;
}

const ALL_DAYS_LIST = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WORKDAYS_LIST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export function TimelineCanvas({ initialData, onSaveData, slug }: TimelineCanvasProps) {
  const { currentUser } = useAuth();
  const [data, setData, historyControls] = useTimelineHistory(
    useMemo(
      () => ({
        ...initialData,
        sprints: (initialData.sprints || []).map(normalizeSprintTo7Days),
        tags: initialData.tags || [],
      }),
      [initialData]
    )
  );

  const [activeSprintIndex] = useState(0);
  const activeSprint = data.sprints[activeSprintIndex] || data.sprints[0];

  // Collaborator & Permission state
  const [collaborators, setCollaborators] = useState<Collaborator[]>(data.collaborators || []);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(data.project.accessLevel || 'public_view');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState<PermissionLevel>('editor');
  const [isInviting, setIsInviting] = useState(false);

  // User permission level (owner/editor/viewer)
  const isOwner = Boolean(
    currentUser && (!data.project.userId || currentUser.id === data.project.userId)
  );
  const userCollaborator = collaborators.find(
    (c) => c.email.toLowerCase() === (currentUser?.email || '').toLowerCase()
  );
  const userPermission: PermissionLevel = isOwner
    ? 'editor'
    : userCollaborator
    ? userCollaborator.permission
    : accessLevel === 'public_edit'
    ? 'editor'
    : 'viewer';
  const isReadOnly = userPermission === 'viewer';

  const handleUpdateAccessLevel = async (newLevel: AccessLevel) => {
    setAccessLevel(newLevel);
    setData((prev) => ({
      ...prev,
      project: { ...prev.project, accessLevel: newLevel },
    }));

    try {
      await fetch(`/api/timeline/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_access_level', accessLevel: newLevel }),
      });
    } catch (e) {
      console.error('Failed to update access level:', e);
    }
  };

  // Generate Base Week Groups from Days
  const allWeekGroups: WeekGroup[] = useMemo(() => {
    if (activeSprint.weekGroups && activeSprint.weekGroups.length > 0) {
      const seen = new Set<number>();
      const uniqueWeeks: WeekGroup[] = [];
      activeSprint.weekGroups.forEach((w, idx) => {
        if (!seen.has(w.weekNumber)) {
          seen.add(w.weekNumber);
          uniqueWeeks.push({
            ...w,
            id: w.id || `week-grp-${w.weekNumber}-${idx}`,
          });
        }
      });
      if (uniqueWeeks.length > 0) return uniqueWeeks;
    }
    const map = new Map<number, number>();
    activeSprint.days.forEach((d) => {
      map.set(d.weekNumber, (map.get(d.weekNumber) || 0) + 1);
    });
    return Array.from(map.entries()).map(([weekNum, count]) => ({
      id: `w-${weekNum}`,
      weekNumber: weekNum,
      label: `WEEK ${weekNum}`,
      title: `Week ${weekNum}`,
      dateRange: `Week ${weekNum}`,
      daySpan: count,
      dayCount: count,
    }));
  }, [activeSprint]);

  const allWeekNumbers = useMemo(() => {
    return allWeekGroups.map((w) => w.weekNumber);
  }, [allWeekGroups]);

  // Filters State
  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState<string>('all');
  const [isAssigneeFilterOpen, setIsAssigneeFilterOpen] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>(() => {
    if (initialData.project.settings?.visibleDays && Array.isArray(initialData.project.settings.visibleDays) && initialData.project.settings.visibleDays.length > 0) {
      return initialData.project.settings.visibleDays;
    }
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`weekline_days_${slug}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (_) {}
    }
    return ALL_DAYS_LIST;
  });
  const [isDaysDrawerOpen, setIsDaysDrawerOpen] = useState(false);
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>(() => {
    if (initialData.project.settings?.selectedWeeks && Array.isArray(initialData.project.settings.selectedWeeks) && initialData.project.settings.selectedWeeks.length > 0) {
      return initialData.project.settings.selectedWeeks;
    }
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`weekline_weeks_${slug}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (_) {}
    }
    return allWeekNumbers.length > 0 ? allWeekNumbers : [1, 2, 3, 4];
  });
  const [isWeekDrawerOpen, setIsWeekDrawerOpen] = useState(false);

  const router = useRouter();
  const [isSaved, setIsSaved] = useState(true);
  const [showUnsavedWarningModal, setShowUnsavedWarningModal] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);

  // Guard against closing tab, refreshing, or hard navigation while auto-saving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isSaved) {
        e.preventDefault();
        e.returnValue = 'Your changes are still saving. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSaved]);

  const handleNavigateWithGuard = (url: string) => {
    if (!isSaved) {
      setPendingNavigationUrl(url);
      setShowUnsavedWarningModal(true);
    } else {
      router.push(url);
    }
  };

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Custom Dropdown Open States in Modals
  const [isTaskTagDropdownOpen, setIsTaskTagDropdownOpen] = useState(false);
  const [isTaskAssigneeDropdownOpen, setIsTaskAssigneeDropdownOpen] = useState(false);
  const [isSharePermissionDropdownOpen, setIsSharePermissionDropdownOpen] = useState(false);
  const [isShareAccessDropdownOpen, setIsShareAccessDropdownOpen] = useState(false);

  // Context Menu State for Task Cards
  const [contextMenuState, setContextMenuState] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    task: TaskCard;
  } | null>(null);

  // Effective Assignees = Timeline Owner + Saved Assignees + Invited Collaborators
  const effectiveAssignees: Assignee[] = useMemo(() => {
    const list: Assignee[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    // 1. Resolve Owner / Creator
    const isCurrentViewerOwner = Boolean(
      currentUser?.id && data.project.userId && currentUser.id === data.project.userId
    );

    // Find saved owner from data.assignees or data.project
    const savedOwner = (data.assignees || []).find(
      (a) => a.id === data.project.userId || a.id.startsWith('assignee-') || a.id === 'owner'
    ) || (data.assignees && data.assignees.length > 0 ? data.assignees[0] : null);

    const ownerId = data.project.userId || savedOwner?.id || currentUser?.id || 'owner';
    const rawOwnerName =
      (isCurrentViewerOwner ? currentUser?.name : null) ||
      data.project.ownerName ||
      (savedOwner && savedOwner.name !== 'Owner' && savedOwner.name !== 'Lead' ? savedOwner.name : null) ||
      currentUser?.name ||
      'Timeline Owner';

    const displayName = isCurrentViewerOwner ? `${currentUser?.name || rawOwnerName} (You)` : rawOwnerName;
    const initials = getInitials(displayName);

    list.push({
      id: ownerId,
      projectId: data.project.id,
      name: displayName,
      initials,
      color: savedOwner?.color || '#F59E0B',
    });
    seenIds.add(ownerId);
    seenNames.add(rawOwnerName.toLowerCase());

    // 2. Include any other saved assignees from data.assignees (excluding legacy placeholders)
    (data.assignees || []).forEach((ass) => {
      const normalizedName = (ass.name || '').trim().toLowerCase();
      if (normalizedName === 'lead' || normalizedName === 'owner' || ass.id.startsWith('assignee-')) return;
      if (seenIds.has(ass.id) || seenNames.has(normalizedName)) return;
      seenIds.add(ass.id);
      seenNames.add(normalizedName);
      list.push({ ...ass, initials: getInitials(ass.name) });
    });

    // 3. Include Invited Collaborators
    (collaborators || []).forEach((col) => {
      const colName = col.name || col.email.split('@')[0];
      if (seenIds.has(col.id) || seenNames.has(colName.toLowerCase())) return;
      seenIds.add(col.id);
      seenNames.add(colName.toLowerCase());

      const isThisColCurrent = currentUser?.email && col.email.toLowerCase() === currentUser.email.toLowerCase();
      const initials = getInitials(colName);
      list.push({
        id: col.id,
        projectId: data.project.id,
        name: isThisColCurrent ? `${colName} (You)` : colName,
        initials,
        color: '#2563EB',
      });
    });

    return list;
  }, [currentUser, data.project, data.assignees, collaborators]);

  // Maps for efficient lookup
  const assigneeMap = useMemo(() => {
    const map = new Map<string, Assignee>();
    effectiveAssignees.forEach((a) => map.set(a.id, a));

    // Handle project owner alternate ID mapping if needed
    if (currentUser?.id && data.project.userId && currentUser.id !== data.project.userId) {
      const ownerAssignee = effectiveAssignees.find((a) => a.id === currentUser.id || a.id === data.project.userId);
      if (ownerAssignee) {
        map.set(data.project.userId, ownerAssignee);
        map.set(currentUser.id, ownerAssignee);
      }
    }
    return map;
  }, [effectiveAssignees, currentUser?.id, data.project.userId]);

  const tagMap = useMemo(() => {
    const map = new Map<string, Tag>();
    (data.tags || []).forEach((t) => map.set(t.id, t));
    return map;
  }, [data.tags]);

  // Filtered displayed days based on selected weeks AND selected days in strict calendar order
  const displayDays = useMemo(() => {
    return activeSprint.days
      .filter((d) => selectedWeeks.includes(d.weekNumber) && selectedDays.includes(d.dayName))
      .sort((a, b) => {
        if (a.weekNumber !== b.weekNumber) return a.weekNumber - b.weekNumber;
        return (CALENDAR_DAY_ORDER[a.dayName.toLowerCase()] ?? 0) - (CALENDAR_DAY_ORDER[b.dayName.toLowerCase()] ?? 0);
      });
  }, [activeSprint.days, selectedWeeks, selectedDays]);

  // Production-grade dynamic calculation of the Month(s) currently displayed
  const displayedMonthLabel = useMemo(() => {
    return computeMonthLabelFromDays(displayDays);
  }, [displayDays]);

  // Filtered displayed week groups based on selected weeks and selected days
  const displayWeekGroups = useMemo(() => {
    return allWeekGroups
      .filter((w) => selectedWeeks.includes(w.weekNumber))
      .map((w) => {
        // Get all matching days in this week that are currently selected
        const matchingDays = activeSprint.days.filter(
          (d) => d.weekNumber === w.weekNumber && selectedDays.includes(d.dayName)
        );

        if (matchingDays.length === 0) {
          return { ...w, daySpan: 0, dateRange: '' };
        }

        const firstDay = matchingDays[0];
        const lastDay = matchingDays[matchingDays.length - 1];

        let dynamicDateRange = '';
        if (matchingDays.length === 1) {
          dynamicDateRange = `${firstDay.dayName} ${firstDay.dayNum}`;
        } else {
          dynamicDateRange = `${firstDay.dayName} ${firstDay.dayNum} – ${lastDay.dayName} ${lastDay.dayNum}`;
        }

        return {
          ...w,
          daySpan: matchingDays.length,
          dateRange: dynamicDateRange,
        };
      })
      .filter((w) => w.daySpan > 0);
  }, [allWeekGroups, selectedWeeks, selectedDays, activeSprint.days]);

  // Filter tasks on the canvas based on Assignee filter and Tag filter
  const filteredTasks = useMemo(() => {
    return data.tasks.filter((t) => {
      if (selectedAssigneeFilter !== 'all') {
        const taskAssigneeIds = t.assigneeIds && t.assigneeIds.length > 0
          ? t.assigneeIds
          : (t.assigneeId ? [t.assigneeId] : []);
        if (!taskAssigneeIds.includes(selectedAssigneeFilter)) {
          return false;
        }
      }
      if (selectedTagFilter !== 'all' && t.tagId !== selectedTagFilter) {
        return false;
      }
      return true;
    });
  }, [data.tasks, selectedAssigneeFilter, selectedTagFilter]);

  const columnTemplate = `240px repeat(${displayDays.length}, 190px)`;

  // Scroll Direction Mode: 'horizontal' | 'vertical'
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [scrollMode, setScrollMode] = useState<'horizontal' | 'vertical'>('horizontal');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('weekline_scroll_mode');
      if (saved === 'horizontal' || saved === 'vertical') {
        setScrollMode(saved);
      }
    } catch (_) {}
  }, []);

  const handleToggleScrollMode = (mode: 'horizontal' | 'vertical') => {
    setScrollMode(mode);
    try {
      localStorage.setItem('weekline_scroll_mode', mode);
    } catch (_) {}
  };

  useEffect(() => {
    const container = gridContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (scrollMode === 'horizontal') {
        // Redirect vertical wheel movement to horizontal scrolling
        if (Math.abs(e.deltaY) > 0 && Math.abs(e.deltaX) === 0) {
          e.preventDefault();
          container.scrollLeft += e.deltaY;
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [scrollMode]);

  // Inspector & Card Editing State
  const [selectedTask, setSelectedTask] = useState<TaskCard | null>(null);
  const [newDeliverableText, setNewDeliverableText] = useState('');

  // Drag & Drop Re-ordering & Collision State
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverDayId, setDragOverDayId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);
  const [collisionModalState, setCollisionModalState] = useState<{
    isOpen: boolean;
    movingTaskId: string;
    targetDayId: string;
    targetCategoryId: string;
    conflictingTaskTitle: string;
    targetDayLabel: string;
  } | null>(null);

  // Work Stream Management State
  const [isAddTrackOpen, setIsAddTrackOpen] = useState(false);
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingTrackTitle, setEditingTrackTitle] = useState('');

  // Tag Creation & Management State
  const [isAddTagOpen, setIsAddTagOpen] = useState(false);
  const [isManageTagsOpen, setIsManageTagsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(getRandomTagColor());

  const handlePersistChanges = useCallback(
    async (updated: TimelineData) => {
      setData(updated);
      setIsSaved(false);
      try {
        await onSaveData(updated);
        setIsSaved(true);
      } catch (e) {
        console.error('Failed to save timeline data:', e);
      }
    },
    [onSaveData, setData]
  );

  const handleUndo = useCallback(async () => {
    if (isReadOnly || !historyControls.canUndo) return;
    const previous = historyControls.undo();
    if (previous) {
      setIsSaved(false);
      try {
        await onSaveData(previous);
        setIsSaved(true);
      } catch (e) {
        console.error('Failed to save undone timeline data:', e);
      }
    }
  }, [isReadOnly, historyControls, onSaveData]);

  const handleRedo = useCallback(async () => {
    if (isReadOnly || !historyControls.canRedo) return;
    const next = historyControls.redo();
    if (next) {
      setIsSaved(false);
      try {
        await onSaveData(next);
        setIsSaved(true);
      } catch (e) {
        console.error('Failed to save redone timeline data:', e);
      }
    }
  }, [isReadOnly, historyControls, onSaveData]);

  // Quick Card Duplicate Handler (Alt+Drag, Ctrl+D, and Right-Click Menu)
  const handleDuplicateTask = useCallback(
    (
      taskToDuplicate: TaskCard,
      targetDayId?: string,
      targetCategoryId?: string
    ) => {
      if (isReadOnly) return;

      const newTaskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const destCategoryId = targetCategoryId || taskToDuplicate.categoryId;

      // Determine destination day ID
      let destDayId = targetDayId;
      if (!destDayId) {
        // If not specified, find next available working day in active displayDays
        const currDayIdx = displayDays.findIndex((d) => d.id === taskToDuplicate.dayId);
        if (currDayIdx !== -1 && currDayIdx + 1 < displayDays.length) {
          destDayId = displayDays[currDayIdx + 1].id;
        } else {
          destDayId = taskToDuplicate.dayId;
        }
      }

      // Clone deliverables with fresh IDs
      const clonedDeliverableItems = (taskToDuplicate.deliverableItems || []).map((item, idx) => ({
        id: `del-${newTaskId}-${idx}`,
        text: item.text,
        isCompleted: false,
      }));

      const clonedTask: TaskCard = {
        ...taskToDuplicate,
        id: newTaskId,
        categoryId: destCategoryId,
        dayId: destDayId,
        title: taskToDuplicate.title,
        deliverableItems: clonedDeliverableItems,
        deliverables: clonedDeliverableItems.map((i) => i.text),
        progressPercentage: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Check collision on destination track
      const trackTasks = data.tasks.filter(
        (t) => t.sprintId === activeSprint.id && t.categoryId === destCategoryId
      );
      const collision = checkTaskCollision(
        displayDays,
        trackTasks,
        newTaskId,
        destDayId,
        clonedTask.daySpan || 1
      );

      if (collision.hasCollision) {
        // Automatically cascade push right to accommodate the new duplicate cleanly
        const reordered = repositionTasksWithMode(
          displayDays,
          [...trackTasks, clonedTask],
          newTaskId,
          destDayId,
          'push_right'
        );
        const otherTasks = data.tasks.filter(
          (t) => !(t.sprintId === activeSprint.id && t.categoryId === destCategoryId)
        );
        handlePersistChanges({ ...data, tasks: [...otherTasks, ...reordered] });
      } else {
        handlePersistChanges({ ...data, tasks: [...data.tasks, clonedTask] });
      }

      setContextMenuState(null);
    },
    [isReadOnly, displayDays, data, activeSprint.id, handlePersistChanges]
  );

  // Global Keyboard Shortcuts (Ctrl+Z / Ctrl+Y / Cmd+Z / Cmd+Shift+Z / Ctrl+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when user is actively editing inside an input, textarea, or contenteditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (!modifier) return;

      // Undo: Ctrl+Z / Cmd+Z (without Shift)
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Redo: Ctrl+Y / Cmd+Y or Ctrl+Shift+Z / Cmd+Shift+Z
      else if (
        e.key.toLowerCase() === 'y' ||
        (e.key.toLowerCase() === 'z' && e.shiftKey)
      ) {
        e.preventDefault();
        handleRedo();
      }
      // Duplicate: Ctrl+D / Cmd+D
      else if (e.key.toLowerCase() === 'd' && !e.shiftKey) {
        if (selectedTask) {
          e.preventDefault();
          handleDuplicateTask(selectedTask);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleDuplicateTask, selectedTask]);

  // Add Week functionality
  const handleAddWeek = () => {
    if (isReadOnly) return;
    const updatedSprint = appendWeekToSprint(activeSprint);
    const updatedSprints = data.sprints.map((s, idx) => (idx === activeSprintIndex ? updatedSprint : s));
    const updatedData = { ...data, sprints: updatedSprints };

    // Also auto-select the newly added week in the filter
    const newWeekNum = Math.max(...updatedSprint.weekGroups.map((w) => w.weekNumber));
    setSelectedWeeks((prev) => [...prev, newWeekNum]);

    handlePersistChanges(updatedData);
  };

  // Remove Last Week functionality
  const handleRemoveLastWeek = () => {
    if (isReadOnly) return;
    if (activeSprint.weekGroups.length <= 1) return;
    if (!confirm('Are you sure you want to remove the last week from this timeline? Any cards in that week will be removed.')) return;

    const maxWeekNum = Math.max(...activeSprint.weekGroups.map((w) => w.weekNumber));
    const updatedWeekGroups = activeSprint.weekGroups.filter((w) => w.weekNumber !== maxWeekNum);
    const removedDayIds = new Set(activeSprint.days.filter((d) => d.weekNumber === maxWeekNum).map((d) => d.id));
    const updatedDays = activeSprint.days.filter((d) => d.weekNumber !== maxWeekNum);

    const updatedSprint = {
      ...activeSprint,
      weekGroups: updatedWeekGroups,
      days: updatedDays,
    };

    const updatedTasks = data.tasks.filter((t) => !removedDayIds.has(t.dayId));
    const updatedSprints = data.sprints.map((s, idx) => (idx === activeSprintIndex ? updatedSprint : s));
    const updatedData = { ...data, sprints: updatedSprints, tasks: updatedTasks };

    setSelectedWeeks((prev) => prev.filter((w) => w !== maxWeekNum));
    handlePersistChanges(updatedData);
  };

  // Bounded Drag-to-Resize Handler (Stops at next card)
  const handleStartResize = (
    e: React.MouseEvent,
    taskId: string,
    currentSpan: number,
    startDayId: string
  ) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();

    const movingTask = data.tasks.find((x) => x.id === taskId);
    if (!movingTask) return;

    const startX = e.clientX;
    const colWidth = 190;
    const targetTrackTasks = data.tasks.filter(
      (t) => t.sprintId === activeSprint.id && t.categoryId === movingTask.categoryId
    );
    const maxAllowedSpan = getMaxResizeSpan(displayDays, targetTrackTasks, taskId, startDayId);
    let latestSpan = currentSpan;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const stepDelta = Math.round(deltaX / colWidth);
      const nextSpan = Math.max(1, Math.min(maxAllowedSpan, currentSpan + stepDelta));
      if (nextSpan !== latestSpan) {
        latestSpan = nextSpan;
        setData((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, daySpan: nextSpan } : t)),
        }));
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setData((currentData) => {
        handlePersistChanges(currentData);
        return currentData;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Drag-and-Drop Re-order Handlers
  const handleDayDrop = (
    e: React.DragEvent,
    targetCategoryId: string,
    targetDayId: string
  ) => {
    e.preventDefault();
    setDragOverDayId(null);
    setDragOverCategoryId(null);

    const taskId = draggedTaskId || e.dataTransfer.getData('text/plain');
    if (isReadOnly || !taskId) return;

    const movingTask = data.tasks.find((t) => t.id === taskId);
    if (!movingTask) return;

    // Alt+Drag Quick Duplicate Check
    const isAltDuplicate = e.altKey || (e.dataTransfer && e.dataTransfer.dropEffect === 'copy');
    if (isAltDuplicate) {
      handleDuplicateTask(movingTask, targetDayId, targetCategoryId);
      return;
    }

    if (movingTask.dayId === targetDayId && movingTask.categoryId === targetCategoryId) {
      return;
    }

    const targetTrackTasks = data.tasks.filter(
      (t) => t.sprintId === activeSprint.id && t.categoryId === targetCategoryId
    );

    const collision = checkTaskCollision(
      displayDays,
      targetTrackTasks,
      taskId,
      targetDayId,
      movingTask.daySpan || 1
    );

    if (!collision.hasCollision) {
      // 0ms Fast Path (No collision, no popup)
      const updatedTasks = data.tasks.map((t) =>
        t.id === taskId
          ? { ...t, dayId: targetDayId, categoryId: targetCategoryId, updatedAt: new Date().toISOString() }
          : t
      );
      handlePersistChanges({ ...data, tasks: updatedTasks });
      return;
    }

    // Collision detected -> Open Contextual Collision Modal
    const targetDay = activeSprint.days.find((d) => d.id === targetDayId);
    const targetDayLabel = targetDay ? `${targetDay.dayName} ${targetDay.dayNum}` : 'Target Day';
    const primaryConflict = collision.conflictingTasks[0];
    const conflictingTaskTitle =
      (primaryConflict?.deliverableItems && primaryConflict.deliverableItems[0]?.text) ||
      primaryConflict?.title ||
      'Existing Card';

    setCollisionModalState({
      isOpen: true,
      movingTaskId: taskId,
      targetDayId,
      targetCategoryId,
      conflictingTaskTitle,
      targetDayLabel,
    });
  };

  const handleExecuteReorder = (mode: ReorderMode) => {
    if (!collisionModalState) return;
    const { movingTaskId, targetDayId, targetCategoryId } = collisionModalState;

    const movingTask = data.tasks.find((t) => t.id === movingTaskId);
    if (!movingTask) {
      setCollisionModalState(null);
      return;
    }

    const targetTrackTasks = data.tasks
      .filter((t) => t.sprintId === activeSprint.id && t.categoryId === targetCategoryId && t.id !== movingTaskId)
      .concat([{ ...movingTask, categoryId: targetCategoryId }]);

    const reorderedTargetTasks = repositionTasksWithMode(
      displayDays,
      targetTrackTasks,
      movingTaskId,
      targetDayId,
      mode
    );

    const otherTasks = data.tasks.filter(
      (t) => !(t.sprintId === activeSprint.id && (t.categoryId === targetCategoryId || t.id === movingTaskId))
    );

    const finalTasks = [...otherTasks, ...reorderedTargetTasks];
    handlePersistChanges({ ...data, tasks: finalTasks });
    setCollisionModalState(null);
  };

  // Tag Management Handlers
  const handleUpdateTag = (tagId: string, updates: Partial<Tag>) => {
    if (isReadOnly) return;
    const updatedTags = (data.tags || []).map((t) => (t.id === tagId ? { ...t, ...updates } : t));
    const updatedData = { ...data, tags: updatedTags };
    handlePersistChanges(updatedData);
  };

  const handleDeleteTag = (tagId: string) => {
    if (isReadOnly) return;
    if (!confirm('Are you sure you want to delete this tag? Cards using this tag will have no tag.')) return;
    const updatedTags = (data.tags || []).filter((t) => t.id !== tagId);
    const updatedTasks = data.tasks.map((t) => (t.tagId === tagId ? { ...t, tagId: undefined } : t));
    const updatedData = { ...data, tags: updatedTags, tasks: updatedTasks };
    handlePersistChanges(updatedData);
  };

  // Toggle Days in Multi-select Filter with per-timeline persistence in DB & localStorage
  const handleToggleDay = (dayName: string) => {
    let nextDays: string[];
    if (selectedDays.includes(dayName)) {
      if (selectedDays.length === 1) return; // Keep at least 1 day
      nextDays = selectedDays.filter((d) => d !== dayName);
    } else {
      nextDays = [...selectedDays, dayName];
    }
    setSelectedDays(nextDays);
    try {
      localStorage.setItem(`weekline_days_${slug}`, JSON.stringify(nextDays));
    } catch (_) {}
    if (!isReadOnly) {
      const updatedSettings = { ...(data.project.settings || {}), visibleDays: nextDays };
      handlePersistChanges({
        ...data,
        project: { ...data.project, settings: updatedSettings },
      });
    }
  };

  const handleSetAllDays = () => {
    setSelectedDays(ALL_DAYS_LIST);
    try {
      localStorage.setItem(`weekline_days_${slug}`, JSON.stringify(ALL_DAYS_LIST));
    } catch (_) {}
    if (!isReadOnly) {
      const updatedSettings = { ...(data.project.settings || {}), visibleDays: ALL_DAYS_LIST };
      handlePersistChanges({
        ...data,
        project: { ...data.project, settings: updatedSettings },
      });
    }
  };

  const handleSetWorkdays = () => {
    setSelectedDays(WORKDAYS_LIST);
    try {
      localStorage.setItem(`weekline_days_${slug}`, JSON.stringify(WORKDAYS_LIST));
    } catch (_) {}
    if (!isReadOnly) {
      const updatedSettings = { ...(data.project.settings || {}), visibleDays: WORKDAYS_LIST };
      handlePersistChanges({
        ...data,
        project: { ...data.project, settings: updatedSettings },
      });
    }
  };

  // Toggle Weeks in Multi-select Filter with per-timeline persistence in DB & localStorage
  const isAllWeeksSelected = selectedWeeks.length === allWeekNumbers.length;
  const handleToggleAllWeeks = () => {
    const nextWeeks = isAllWeeksSelected ? [allWeekNumbers[0] || 1] : [...allWeekNumbers];
    setSelectedWeeks(nextWeeks);
    try {
      localStorage.setItem(`weekline_weeks_${slug}`, JSON.stringify(nextWeeks));
    } catch (_) {}
    if (!isReadOnly) {
      const updatedSettings = { ...(data.project.settings || {}), selectedWeeks: nextWeeks };
      handlePersistChanges({
        ...data,
        project: { ...data.project, settings: updatedSettings },
      });
    }
  };

  const handleToggleWeek = (weekNum: number) => {
    let nextWeeks: number[];
    if (selectedWeeks.includes(weekNum)) {
      if (selectedWeeks.length === 1) return;
      nextWeeks = selectedWeeks.filter((w) => w !== weekNum);
    } else {
      nextWeeks = [...selectedWeeks, weekNum].sort((a, b) => a - b);
    }
    setSelectedWeeks(nextWeeks);
    try {
      localStorage.setItem(`weekline_weeks_${slug}`, JSON.stringify(nextWeeks));
    } catch (_) {}
    if (!isReadOnly) {
      const updatedSettings = { ...(data.project.settings || {}), selectedWeeks: nextWeeks };
      handlePersistChanges({
        ...data,
        project: { ...data.project, settings: updatedSettings },
      });
    }
  };

  // Deliverables checklist toggle
  const handleToggleDeliverable = (taskId: string, itemIndex: number) => {
    if (isReadOnly) return;
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task) return;

    let items = task.deliverableItems || [];
    if (items.length === 0 && task.deliverables) {
      items = task.deliverables.map((text, idx) => ({
        id: `del-${task.id}-${idx}`,
        text,
        isCompleted: false,
      }));
    }

    const updatedItems = items.map((item, idx) =>
      idx === itemIndex ? { ...item, isCompleted: !item.isCompleted } : item
    );

    const completed = updatedItems.filter((i) => i.isCompleted).length;
    const progress = Math.round((completed / (updatedItems.length || 1)) * 100);

    const updatedTask: TaskCard = {
      ...task,
      deliverableItems: updatedItems,
      deliverables: updatedItems.map((i) => i.text),
      progressPercentage: progress,
      updatedAt: new Date().toISOString(),
    };

    const updatedTasks = data.tasks.map((t) => (t.id === taskId ? updatedTask : t));
    const updatedData = { ...data, tasks: updatedTasks };
    if (selectedTask?.id === taskId) {
      setSelectedTask(updatedTask);
    }
    handlePersistChanges(updatedData);
  };

  const handleAddDeliverableItem = (taskId: string) => {
    if (isReadOnly || !newDeliverableText.trim()) return;
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const existing = task.deliverableItems || [];
    const updatedItems = [
      ...existing,
      { id: `del-${Date.now()}`, text: newDeliverableText.trim(), isCompleted: false },
    ];

    const completed = updatedItems.filter((i) => i.isCompleted).length;
    const progress = Math.round((completed / (updatedItems.length || 1)) * 100);

    const updatedTask: TaskCard = {
      ...task,
      deliverableItems: updatedItems,
      deliverables: updatedItems.map((i) => i.text),
      progressPercentage: progress,
      updatedAt: new Date().toISOString(),
    };

    const updatedTasks = data.tasks.map((t) => (t.id === taskId ? updatedTask : t));
    const updatedData = { ...data, tasks: updatedTasks };
    setSelectedTask(updatedTask);
    setNewDeliverableText('');
    handlePersistChanges(updatedData);
  };

  const handleDeleteDeliverableItem = (taskId: string, index: number) => {
    if (isReadOnly) return;
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task || !task.deliverableItems) return;

    const updatedItems = task.deliverableItems.filter((_, idx) => idx !== index);
    const completed = updatedItems.filter((i) => i.isCompleted).length;
    const progress = updatedItems.length > 0 ? Math.round((completed / updatedItems.length) * 100) : 0;

    const updatedTask: TaskCard = {
      ...task,
      deliverableItems: updatedItems,
      deliverables: updatedItems.map((i) => i.text),
      progressPercentage: progress,
      updatedAt: new Date().toISOString(),
    };

    const updatedTasks = data.tasks.map((t) => (t.id === taskId ? updatedTask : t));
    const updatedData = { ...data, tasks: updatedTasks };
    setSelectedTask(updatedTask);
    handlePersistChanges(updatedData);
  };

  const handleUpdateTaskField = (taskId: string, field: keyof TaskCard, value: any) => {
    if (isReadOnly) return;
    const updatedTasks = data.tasks.map((t) =>
      t.id === taskId ? { ...t, [field]: value, updatedAt: new Date().toISOString() } : t
    );
    const updatedData = { ...data, tasks: updatedTasks };
    const updated = updatedTasks.find((t) => t.id === taskId);
    if (updated) setSelectedTask(updated);
    handlePersistChanges(updatedData);
  };

  const handleToggleTaskAssignee = (taskId: string, assigneeId: string) => {
    if (isReadOnly) return;
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const rawIds = task.assigneeIds && task.assigneeIds.length > 0
      ? task.assigneeIds
      : (task.assigneeId ? [task.assigneeId] : []);

    // Clean, resolve through map, and deduplicate
    const currentAssigneeIds = Array.from(
      new Set(
        rawIds
          .map((id) => assigneeMap.get(id)?.id || id)
          .filter((id) => Boolean(id) && effectiveAssignees.some((a) => a.id === id))
      )
    );

    const nextAssigneeIds = currentAssigneeIds.includes(assigneeId)
      ? currentAssigneeIds.filter((id) => id !== assigneeId)
      : [...currentAssigneeIds, assigneeId];

    const primaryAssigneeId = nextAssigneeIds[0] || '';

    const updatedTask: TaskCard = {
      ...task,
      assigneeIds: nextAssigneeIds,
      assigneeId: primaryAssigneeId,
      updatedAt: new Date().toISOString(),
    };

    const updatedTasks = data.tasks.map((t) => (t.id === taskId ? updatedTask : t));
    const updatedData = { ...data, tasks: updatedTasks };
    if (selectedTask?.id === taskId) {
      setSelectedTask(updatedTask);
    }
    handlePersistChanges(updatedData);
  };

  const handleOpenNewTaskModal = (categoryId: string, dayId: string) => {
    if (isReadOnly) return;

    const defaultTagId = data.tags[0]?.id || '';
    const defaultAssigneeId = effectiveAssignees[0]?.id || '';

    const newTask: TaskCard = {
      id: `task-${Date.now()}`,
      projectId: data.project.id,
      sprintId: activeSprint.id,
      categoryId,
      tagId: defaultTagId,
      assigneeId: defaultAssigneeId,
      assigneeIds: defaultAssigneeId ? [defaultAssigneeId] : [],
      dayId,
      title: '',
      deliverables: [],
      deliverableItems: [],
      progressPercentage: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedTasks = [...data.tasks, newTask];
    const updatedData = { ...data, tasks: updatedTasks };
    setSelectedTask(newTask);
    setNewDeliverableText('');
    handlePersistChanges(updatedData);
  };

  const handleDeleteTask = (taskId: string) => {
    if (isReadOnly) return;
    const updatedTasks = data.tasks.filter((t) => t.id !== taskId);
    const updatedData = { ...data, tasks: updatedTasks };
    setSelectedTask(null);
    handlePersistChanges(updatedData);
  };

  // Work Stream Track Operations
  const handleAddTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !newTrackTitle.trim()) return;

    const newTrack: CategoryTrack = {
      id: `cat-${Date.now()}`,
      projectId: data.project.id,
      title: newTrackTitle.trim(),
      orderIndex: data.categories.length + 1,
    };

    const updatedCategories = [...data.categories, newTrack];
    const updatedData = { ...data, categories: updatedCategories };
    setIsAddTrackOpen(false);
    setNewTrackTitle('');
    handlePersistChanges(updatedData);
  };

  const handleRenameTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !editingTrackId || !editingTrackTitle.trim()) return;

    const updatedCategories = data.categories.map((c) =>
      c.id === editingTrackId ? { ...c, title: editingTrackTitle.trim() } : c
    );
    const updatedData = { ...data, categories: updatedCategories };
    setEditingTrackId(null);
    setEditingTrackTitle('');
    handlePersistChanges(updatedData);
  };

  const handleDeleteTrack = (categoryId: string) => {
    if (isReadOnly) return;
    if (!confirm('Are you sure you want to delete this entire work stream track and its cards?')) return;
    const updatedCategories = data.categories.filter((c) => c.id !== categoryId);
    const updatedTasks = data.tasks.filter((t) => t.categoryId !== categoryId);
    const updatedData = { ...data, categories: updatedCategories, tasks: updatedTasks };
    handlePersistChanges(updatedData);
  };

  // Add & Customize Tag
  const handleOpenAddTagModal = () => {
    setIsManageTagsOpen(false);
    setIsTaskTagDropdownOpen(false);
    setIsTaskAssigneeDropdownOpen(false);
    setNewTagName('');
    setNewTagColor(getRandomTagColor());
    setIsAddTagOpen(true);
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    const newTag: Tag = {
      id: `tag-${Date.now()}`,
      projectId: data.project.id,
      name: newTagName.trim(),
      color: newTagColor,
      orderIndex: (data.tags || []).length + 1,
    };

    const updatedTags = [...(data.tags || []), newTag];
    const updatedData = { ...data, tags: updatedTags };
    if (selectedTask) {
      handleUpdateTaskField(selectedTask.id, 'tagId', newTag.id);
    }
    setIsAddTagOpen(false);
    setNewTagName('');
    handlePersistChanges(updatedData);
  };

  // Collaborator Invitations
  const handleInviteCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || isInviting) return;

    setIsInviting(true);
    try {
      const inviterName = currentUser?.name || currentUser?.email?.split('@')[0] || 'A team member';
      const res = await fetch(`/api/timeline/${slug}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteEmail.split('@')[0],
          permission: invitePermission,
          inviterName,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setCollaborators((prev) => {
          const idx = prev.findIndex((c) => c.id === result.collaborator.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = result.collaborator;
            return copy;
          }
          return [...prev, result.collaborator];
        });
        setInviteEmail('');
      }
    } catch (err) {
      console.error('Failed to invite collaborator:', err);
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateCollaboratorPermission = async (
    collaboratorId: string,
    permission: PermissionLevel
  ) => {
    try {
      await fetch(`/api/timeline/${slug}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_permission', collaboratorId, permission }),
      });
      setCollaborators((prev) =>
        prev.map((c) => (c.id === collaboratorId ? { ...c, permission } : c))
      );
    } catch (e) {
      console.error('Failed to update permission:', e);
    }
  };

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    if (!confirm('Remove this collaborator from this timeline?')) return;
    try {
      await fetch(`/api/timeline/${slug}/collaborators?id=${collaboratorId}`, {
        method: 'DELETE',
      });
      setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId));
    } catch (e) {
      console.error('Failed to remove collaborator:', e);
    }
  };

  const handleCopyShareLink = async () => {
    if (typeof window !== 'undefined') return;
    const url = `${window.location.origin}/t/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
  };

  return (
    <div className="relative h-screen w-full bg-[#F8F9FA] text-gray-900 font-sans antialiased overflow-hidden select-none flex flex-col">
      {/* TOP BRAND & STUDIO APP BAR */}
      <header className="h-14 bg-white border-b border-gray-200 z-40 px-4 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleNavigateWithGuard('/dashboard')}
            title="Back to Dashboard"
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="text-gray-400">Weekline</span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-900 font-black">{data.project.title}</span>
          </div>

          {/* Auto-Save & Status Pill */}
          <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold transition-all ${
            isSaved
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-300 text-amber-800 animate-pulse'
          }`}>
            {isSaved ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            ) : (
              <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
            )}
            <span>Auto-Save</span>
            <span className="font-extrabold">{isSaved ? 'Saved' : 'Saving changes...'}</span>
          </div>

          {/* Permission Mode Indicator */}
          {isReadOnly && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-800">
              <Lock className="w-3 h-3" />
              <span>View Only</span>
            </div>
          )}
        </div>

        {/* Collaborators and Share Action */}
        <div className="flex items-center gap-3">
          {!currentUser ? (
            <button
              type="button"
              onClick={() => handleNavigateWithGuard('/auth')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 font-black text-xs rounded-xl transition-all shadow-sm shadow-[#F59E0B]/20 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In to Edit</span>
            </button>
          ) : (
            <>
              {/* Active Collaborators Preview Avatars */}
              <div
                onClick={() => setShareModalOpen(true)}
                className="flex items-center -space-x-1.5 cursor-pointer"
                title="Collaborators on this timeline"
              >
                <div className="w-6 h-6 rounded-full bg-[#F59E0B] text-gray-950 font-black text-[9px] flex items-center justify-center border-2 border-white shadow-xs">
                  {getInitials(currentUser?.name || 'U')}
                </div>
                {collaborators.slice(0, 3).map((col) => (
                  <div
                    key={col.id}
                    className="w-6 h-6 rounded-full bg-blue-500 text-white font-bold text-[9px] flex items-center justify-center border-2 border-white shadow-xs"
                    title={`${col.name} (${col.permission})`}
                  >
                    {getInitials(col.name || col.email)}
                  </div>
                ))}
                {collaborators.length > 3 && (
                  <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 font-bold text-[9px] flex items-center justify-center border-2 border-white">
                    +{collaborators.length - 3}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShareModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 font-black text-xs rounded-xl transition-all shadow-sm shadow-[#F59E0B]/20 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Invite & Share</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* FILTER TOOLBAR & MONTH SUB-HEADER */}
      <div className="w-full bg-white border-b border-gray-200 z-30 shrink-0 px-4 py-2.5 flex items-center justify-between gap-3 shadow-2xs">
        {/* Left Side: Assignees and Tags Filters */}
        <div className="flex items-center gap-2.5">
          {/* Custom Assignees Filter Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsAssigneeFilterOpen(!isAssigneeFilterOpen);
                setIsTagFilterOpen(false);
                setIsDaysDrawerOpen(false);
                setIsWeekDrawerOpen(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-[#D97706]" />
              <span className="truncate max-w-[130px]">
                {selectedAssigneeFilter === 'all'
                  ? 'All Assignees'
                  : effectiveAssignees.find((a) => a.id === selectedAssigneeFilter)?.name || 'Assignee'}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                  isAssigneeFilterOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isAssigneeFilterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsAssigneeFilterOpen(false)} />
                <div className="absolute left-0 mt-1.5 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-1.5 flex flex-col gap-0.5 animate-dropdown">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAssigneeFilter('all');
                      setIsAssigneeFilterOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      selectedAssigneeFilter === 'all' ? 'bg-amber-50 text-[#D97706]' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#D97706]" />
                      <span>All Assignees</span>
                    </div>
                    {selectedAssigneeFilter === 'all' && <Check className="w-3.5 h-3.5 text-[#D97706]" />}
                  </button>

                  <div className="my-1 border-t border-gray-100" />

                  {effectiveAssignees.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setSelectedAssigneeFilter(a.id);
                        setIsAssigneeFilterOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        selectedAssigneeFilter === a.id ? 'bg-amber-50 text-[#D97706]' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-5 h-5 rounded-full text-[9.5px] font-black flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: a.color || '#F59E0B' }}
                        >
                          {a.initials}
                        </span>
                        <span className="truncate">{a.name}</span>
                      </div>
                      {selectedAssigneeFilter === a.id && <Check className="w-3.5 h-3.5 text-[#D97706] shrink-0" />}
                    </button>
                  ))}

                  {!isReadOnly && (
                    <>
                      <div className="my-1 border-t border-gray-100" />
                      <button
                        type="button"
                        onClick={() => {
                          setIsAssigneeFilterOpen(false);
                          setShareModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold text-[#D97706] hover:bg-amber-50 transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Invite Collaborator...</span>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Custom Tags Filter Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsTagFilterOpen(!isTagFilterOpen);
                setIsAssigneeFilterOpen(false);
                setIsDaysDrawerOpen(false);
                setIsWeekDrawerOpen(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <TagIcon className="w-3.5 h-3.5 text-[#D97706]" />
              <span className="truncate max-w-[130px]">
                {selectedTagFilter === 'all'
                  ? 'All Tags'
                  : data.tags.find((t) => t.id === selectedTagFilter)?.name || 'Tag'}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                  isTagFilterOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isTagFilterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsTagFilterOpen(false)} />
                <div className="absolute left-0 mt-1.5 w-52 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-1.5 flex flex-col gap-0.5 animate-dropdown">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTagFilter('all');
                      setIsTagFilterOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      selectedTagFilter === 'all' ? 'bg-amber-50 text-[#D97706]' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <TagIcon className="w-4 h-4 text-[#D97706]" />
                      <span>All Tags</span>
                    </div>
                    {selectedTagFilter === 'all' && <Check className="w-3.5 h-3.5 text-[#D97706]" />}
                  </button>

                  <div className="my-1 border-t border-gray-100" />

                  {(data.tags || []).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTagFilter(t.id);
                        setIsTagFilterOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        selectedTagFilter === t.id ? 'bg-amber-50 text-[#D97706]' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: t.color }}
                        />
                        <span className="truncate">{t.name}</span>
                      </div>
                      {selectedTagFilter === t.id && <Check className="w-3.5 h-3.5 text-[#D97706] shrink-0" />}
                    </button>
                  ))}

                  {!isReadOnly && (
                    <>
                      <div className="my-1 border-t border-gray-100" />
                      <button
                        type="button"
                        onClick={() => {
                          setIsTagFilterOpen(false);
                          setIsManageTagsOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <Settings className="w-4 h-4 text-gray-500" />
                        <span>Manage Tags...</span>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Undo & Redo Controls */}
          {!isReadOnly && (
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl p-0.5 gap-0.5">
              <button
                type="button"
                disabled={!historyControls.canUndo}
                onClick={handleUndo}
                title="Undo (Ctrl+Z)"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-700 hover:bg-white hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer transition-all shadow-2xs disabled:shadow-none"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!historyControls.canRedo}
                onClick={handleRedo}
                title="Redo (Ctrl+Y)"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-700 hover:bg-white hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer transition-all shadow-2xs disabled:shadow-none"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Center: Dynamic Month Header */}
        <div className="flex items-center justify-center">
          <span className="text-xs sm:text-sm font-black tracking-[0.25em] text-gray-900 uppercase select-none">
            {displayedMonthLabel}
          </span>
        </div>

        {/* Right Side: Days Multi-select, Weeks Multi-select & + Add Week */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Days Filter Combobox Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDaysDrawerOpen(!isDaysDrawerOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-[#D97706]" />
              <span>
                {selectedDays.length === 7
                  ? 'All 7 Days'
                  : selectedDays.length === 5 && !selectedDays.includes('Sun') && !selectedDays.includes('Sat')
                  ? 'Workdays (5)'
                  : `${selectedDays.length} Days`}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isDaysDrawerOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDaysDrawerOpen && (
              <>
                <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsDaysDrawerOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-3 flex flex-col gap-2 animate-dropdown">
                  <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                    <span className="text-[11px] font-black uppercase tracking-wider text-gray-700">
                      Select Days
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSetWorkdays}
                        className="text-[10px] font-bold text-gray-500 hover:text-[#D97706] cursor-pointer"
                      >
                        Mon–Fri
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={handleSetAllDays}
                        className="text-[10px] font-bold text-[#D97706] hover:underline cursor-pointer"
                      >
                        All 7
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    {ALL_DAYS_LIST.map((dayName) => {
                      const isChecked = selectedDays.includes(dayName);
                      return (
                        <div
                          key={`day-filter-${dayName}`}
                          onClick={() => handleToggleDay(dayName)}
                          className={`flex items-center justify-between p-1.5 px-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                            isChecked
                              ? 'bg-amber-50/80 border-amber-200 text-gray-900'
                              : 'bg-gray-50/50 border-gray-100 text-gray-400 hover:bg-gray-100'
                          }`}
                        >
                          <span>{dayName}</span>
                          <div
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                              isChecked ? 'bg-[#F59E0B] border-[#F59E0B] text-gray-950 font-black' : 'border-gray-300'
                            }`}
                          >
                            {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Weeks Filter Combobox Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsWeekDrawerOpen(!isWeekDrawerOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#D97706]" />
              <span>
                {isAllWeeksSelected
                  ? `All Weeks (${allWeekNumbers.length})`
                  : `${selectedWeeks.length} Week${selectedWeeks.length > 1 ? 's' : ''}`}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isWeekDrawerOpen ? 'rotate-180' : ''}`} />
            </button>

            {isWeekDrawerOpen && (
              <>
                <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsWeekDrawerOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-3 flex flex-col gap-2.5 animate-dropdown">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <span className="text-[11px] font-black uppercase tracking-wider text-gray-700">
                      Filter Weeks
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleAllWeeks}
                      className="text-[10px] font-bold text-[#D97706] hover:underline cursor-pointer"
                    >
                      {isAllWeeksSelected ? 'Clear to 1' : 'Select All'}
                    </button>
                  </div>

                  <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
                    {allWeekGroups.map((w, idx) => {
                      const isChecked = selectedWeeks.includes(w.weekNumber);
                      return (
                        <div
                          key={`filter-week-${w.weekNumber}-${w.id || idx}`}
                          onClick={() => handleToggleWeek(w.weekNumber)}
                          className={`flex items-center justify-between p-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                            isChecked
                              ? 'bg-amber-50/70 border-amber-200 text-gray-900'
                              : 'bg-gray-50/50 border-gray-100 text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                                isChecked ? 'bg-[#F59E0B] border-[#F59E0B] text-gray-950 font-black' : 'border-gray-300'
                              }`}
                            >
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span>Week {w.weekNumber}</span>
                          </div>
                          {w.dateRange && (
                            <span className="text-[10px] text-gray-400 font-semibold">{w.dateRange}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {!isReadOnly && (
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-1">
                      <button
                        type="button"
                        onClick={handleAddWeek}
                        className="text-[11px] font-bold text-[#D97706] hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Week</span>
                      </button>

                      {activeSprint.weekGroups.length > 1 && (
                        <button
                          type="button"
                          onClick={handleRemoveLastWeek}
                          className="text-[11px] font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          Remove Last Week
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* + Add Week Button */}
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleAddWeek}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 font-black text-xs rounded-xl transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Week</span>
            </button>
          )}
        </div>
      </div>

      {/* FULL-WIDTH FULL-HEIGHT TIMELINE WORKSPACE */}
      <div
        ref={gridContainerRef}
        className="flex-1 w-full overflow-auto relative bg-[#F8F9FA]"
      >
        <div className="w-max min-w-full pb-16">
          {/* STICKY HEADER: CYCLES & DAYS ROW */}
          <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-2xs">
            {/* Week Groups (Cycles) Row */}
            <div
              className="grid border-b border-gray-200 bg-gray-50/60"
              style={{
                gridTemplateColumns: columnTemplate,
              }}
            >
              {/* Top-Left Corner Header */}
              <div className="sticky left-0 z-30 bg-gray-50 border-r border-gray-200 px-4 py-2 flex items-center text-[10px] font-black uppercase tracking-widest text-gray-400 shadow-2xs">
                Cycles
              </div>

              {/* Week Spanning Headers */}
              {displayWeekGroups.map((week, idx) => {
                const span = week.daySpan || 7;
                const uniqueKey = week.id ? `${week.id}-${idx}` : `week-${week.weekNumber}-${idx}`;
                return (
                  <div
                    key={uniqueKey}
                    className="border-l-2 border-gray-200 py-2 px-3 text-center flex items-center justify-center gap-2"
                    style={{ gridColumn: `span ${span}` }}
                  >
                    <span className="text-xs font-black text-gray-900 tracking-wider uppercase">
                      {week.label || `WEEK ${week.weekNumber}`}
                    </span>
                    {week.dateRange && (
                      <span className="text-[10px] text-[#D97706] font-semibold">
                        ({week.dateRange})
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Days & Dates Row */}
            <div
              className="grid bg-white"
              style={{
                gridTemplateColumns: columnTemplate,
              }}
            >
              {/* Top-Left Corner Work Stream Header with + Add Button */}
              <div className="sticky left-0 z-30 bg-white border-r border-gray-200 px-4 py-2 flex items-center justify-between shadow-2xs">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#D97706]">
                  Work Stream
                </span>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => setIsAddTrackOpen(true)}
                    title="Add Work Stream"
                    className="p-1 rounded-md bg-gray-100 hover:bg-[#F59E0B] hover:text-gray-950 text-gray-700 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold px-2"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                )}
              </div>

              {/* Day Header Cells */}
              {displayDays.map((day) => (
                <div
                  key={day.id}
                  className={`text-center flex flex-col items-center justify-center py-2 ${
                    day.isWeekStart ? 'border-l-2 border-gray-200 bg-gray-50/40' : 'border-l border-gray-200/60'
                  } ${day.isWeekend ? 'bg-amber-50/20' : ''}`}
                >
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {day.dayName}
                  </span>
                  <span className="text-sm font-black text-gray-900">{day.dayNum}</span>
                </div>
              ))}
            </div>
          </div>

          {/* TIMELINE ROWS / TRACKS */}
          <div className="flex flex-col divide-y divide-gray-200">
            {data.categories.map((cat) => {
              const isEditing = editingTrackId === cat.id;
              const trackTasks = filteredTasks.filter(
                (t) => t.sprintId === activeSprint.id && t.categoryId === cat.id
              );

              return (
                <div
                  key={cat.id}
                  className="grid bg-white hover:bg-gray-50/30 transition-colors relative min-h-[135px]"
                  style={{
                    gridTemplateColumns: columnTemplate,
                    gridTemplateRows: 'auto',
                  }}
                >
                  {/* Left Work Stream Column */}
                  <div
                    className="sticky left-0 z-10 bg-white border-r border-gray-200 p-3.5 flex items-center justify-between group/track shadow-2xs"
                    style={{ gridColumn: 1, gridRow: 1 }}
                  >
                    {isEditing ? (
                      <form onSubmit={handleRenameTrack} className="flex items-center gap-1.5 w-full">
                        <input
                          autoFocus
                          type="text"
                          value={editingTrackTitle}
                          onChange={(e) => setEditingTrackTitle(e.target.value)}
                          className="flex-1 bg-gray-50 text-xs font-bold px-2 py-1 rounded border border-[#F59E0B] focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="text-[10px] font-bold bg-[#F59E0B] text-gray-950 px-2 py-1 rounded cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTrackId(null)}
                          className="text-gray-500 hover:text-gray-900 p-1 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </form>
                    ) : (
                      <>
                        <span className="text-xs font-black text-gray-900 truncate">
                          {cat.title}
                        </span>

                        {!isReadOnly && (
                          <div className="flex items-center gap-1 opacity-0 group-hover/track:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTrackId(cat.id);
                                setEditingTrackTitle(cat.title);
                              }}
                              title="Rename Track"
                              className="text-gray-400 hover:text-amber-600 p-1 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTrack(cat.id)}
                              title="Delete Track"
                              className="text-gray-400 hover:text-rose-600 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Day Background Grid Cells */}
                  {displayDays.map((day, dIdx) => {
                    const isDragTarget = dragOverDayId === day.id && dragOverCategoryId === cat.id;
                    const hasCardStartingHere = trackTasks.some((t) => t.dayId === day.id);

                    return (
                      <div
                        key={day.id}
                        onDragOver={(e) => {
                          if (isReadOnly) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverDayId !== day.id || dragOverCategoryId !== cat.id) {
                            setDragOverDayId(day.id);
                            setDragOverCategoryId(cat.id);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverDayId === day.id && dragOverCategoryId === cat.id) {
                            setDragOverDayId(null);
                            setDragOverCategoryId(null);
                          }
                        }}
                        onDrop={(e) => handleDayDrop(e, cat.id, day.id)}
                        onClick={() => {
                          if (!isReadOnly && !hasCardStartingHere) {
                            handleOpenNewTaskModal(cat.id, day.id);
                          }
                        }}
                        className={`p-2 flex flex-col justify-center min-h-[135px] relative group/cell transition-colors ${
                          day.isWeekStart ? 'border-l-2 border-gray-200 bg-gray-50/30' : 'border-l border-gray-200/60'
                        } ${day.isWeekend ? 'bg-amber-50/10' : ''} ${
                          isDragTarget ? 'bg-amber-100/60 ring-2 ring-inset ring-[#F59E0B]' : ''
                        } ${
                          !isReadOnly && !hasCardStartingHere ? 'cursor-pointer' : ''
                        }`}
                        style={{ gridColumn: dIdx + 2, gridRow: 1, zIndex: 1 }}
                      >
                        {/* Quick Add Button on Hover */}
                        {!isReadOnly && !hasCardStartingHere && !isDragTarget && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenNewTaskModal(cat.id, day.id);
                            }}
                            className="w-full h-[110px] border border-dashed border-gray-200 hover:border-[#F59E0B] rounded-xl text-gray-300 hover:text-[#D97706] flex items-center justify-center transition-all opacity-0 group-hover/cell:opacity-100 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Multi-Day Task Cards on Grid */}
                  {trackTasks.map((t) => {
                    const proj = calculateVisibleProjection(activeSprint.days, displayDays, t);
                    if (!proj.isVisible) return null;

                    const rawAssigneeIds = t.assigneeIds && t.assigneeIds.length > 0
                      ? t.assigneeIds
                      : (t.assigneeId ? [t.assigneeId] : []);

                    const seenCardAssigneeIds = new Set<string>();
                    const taskAssignees: Assignee[] = [];
                    rawAssigneeIds.forEach((id) => {
                      const a = assigneeMap.get(id);
                      if (a && !seenCardAssigneeIds.has(a.id)) {
                        seenCardAssigneeIds.add(a.id);
                        taskAssignees.push(a);
                      }
                    });
                    const tag = t.tagId ? tagMap.get(t.tagId) : undefined;
                    const cardBg = tag?.color || '#0F172A';

                    return (
                      <div
                        key={t.id}
                        draggable={!isReadOnly}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', t.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedTaskId(t.id);
                        }}
                        onDragEnd={() => {
                          setDraggedTaskId(null);
                          setDragOverDayId(null);
                          setDragOverCategoryId(null);
                        }}
                        onDragOver={(e) => {
                          if (isReadOnly) return;
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverDayId !== t.dayId || dragOverCategoryId !== cat.id) {
                            setDragOverDayId(t.dayId);
                            setDragOverCategoryId(cat.id);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDayDrop(e, cat.id, t.dayId);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTask(t);
                        }}
                        onContextMenu={(e) => {
                          if (isReadOnly) return;
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenuState({
                            isOpen: true,
                            x: e.clientX,
                            y: e.clientY,
                            task: t,
                          });
                        }}
                        className={`p-2 relative flex flex-col justify-center select-none group/card pointer-events-auto transition-opacity ${
                          draggedTaskId === t.id ? 'opacity-40' : 'opacity-100'
                        }`}
                        style={{
                          gridColumn: `${proj.startVisibleIndex + 2} / span ${proj.visibleSpan}`,
                          gridRow: 1,
                          zIndex: 2,
                        }}
                      >
                        <div
                          className="w-full min-h-[110px] rounded-2xl p-3 flex flex-col justify-between border border-black/10 hover:border-black/30 transition-all cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md hover:scale-[1.005] text-white gap-2 relative"
                          style={{
                            backgroundColor: cardBg,
                            backgroundImage: `linear-gradient(135deg, ${cardBg} 0%, rgba(0,0,0,0.18) 100%)`,
                          }}
                        >
                          {/* Top Bar: Tag Badge + Day Span Badge + Multi-Assignees Initials Stack */}
                          <div className="flex items-center justify-between gap-1 shrink-0">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-[9.5px] font-black uppercase tracking-wider bg-black/25 text-white/95 px-2 py-0.5 rounded-md truncate max-w-[95px]">
                                {tag?.name || 'TAG'}
                              </span>
                              {proj.visibleSpan > 1 && (
                                <span className="text-[9px] font-black uppercase tracking-wider bg-white/20 text-white px-1.5 py-0.5 rounded-md">
                                  {proj.visibleSpan}d
                                </span>
                              )}
                            </div>

                            <div className="flex items-center -space-x-1.5 shrink-0 bg-black/20 backdrop-blur-xs p-0.5 rounded-full">
                              {taskAssignees.map((a) => {
                                const isLightColor =
                                  !a.color ||
                                  a.color === '#F59E0B' ||
                                  a.color === '#FBBF24' ||
                                  a.color === '#FDE047' ||
                                  a.color === '#FEF08A';

                                return (
                                  <span
                                    key={a.id}
                                    title={a.name}
                                    className={`w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center border-2 border-white shadow-md ring-1 ring-black/20 shrink-0 uppercase tracking-tight ${
                                      isLightColor ? 'text-gray-950' : 'text-white'
                                    }`}
                                    style={{ backgroundColor: a.color || '#F59E0B' }}
                                  >
                                    {a.initials}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          {/* Visible Checklist Items */}
                          <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
                            {(t.deliverableItems || []).map((item, idx) => (
                              <div
                                key={item.id || idx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleDeliverable(t.id, idx);
                                }}
                                className="flex items-start gap-2 text-xs text-white/95 leading-tight cursor-pointer group/item"
                              >
                                <div
                                  className={`w-3.5 h-3.5 rounded border mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
                                    item.isCompleted
                                      ? 'bg-white text-gray-950 border-white font-black'
                                      : 'border-white/50 bg-black/20 group-hover/item:border-white'
                                  }`}
                                >
                                  {item.isCompleted && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                                <span
                                  className={`break-words line-clamp-2 text-[11px] font-bold ${
                                    item.isCompleted ? 'line-through opacity-60 text-white/70' : 'text-white'
                                  }`}
                                >
                                  {item.text}
                                </span>
                              </div>
                            ))}
                            {(!t.deliverableItems || t.deliverableItems.length === 0) && (
                              <span className="text-[11px] text-white/60 font-medium italic">
                                Click to add checklist items
                              </span>
                            )}
                          </div>

                          {/* Right Edge Mouse Drag Handle for Duration Resizing */}
                          {!isReadOnly && (
                            <div
                              onMouseDown={(e) =>
                                handleStartResize(e, t.id, t.daySpan || 1, t.dayId)
                              }
                              className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity z-20 hover:bg-black/25 rounded-r-2xl"
                              title="Drag to adjust day duration"
                            >
                              <div className="w-1 h-5 bg-white/70 rounded-full pointer-events-none" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* TASK DETAILS / INSPECTOR MODAL */}
      {selectedTask && (
        <div
          onClick={() => setSelectedTask(null)}
          className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-gray-200 rounded-3xl w-full max-w-lg p-6 relative shadow-2xl flex flex-col gap-4 animate-dropdown max-h-[85vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#D97706]">
                Task Details
              </span>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>



            {/* Tag Picker & Multi-Select Assignee Row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Custom Tag Picker */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-black uppercase text-gray-700">
                    Tag
                  </label>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={handleOpenAddTagModal}
                      className="text-[10px] font-bold text-[#D97706] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New Tag</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => {
                    setIsTaskTagDropdownOpen(!isTaskTagDropdownOpen);
                    setIsTaskAssigneeDropdownOpen(false);
                  }}
                  className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:bg-white focus:border-[#F59E0B] focus:outline-none cursor-pointer flex items-center justify-between disabled:opacity-70"
                >
                  <div className="flex items-center gap-2 truncate">
                    {selectedTask.tagId ? (
                      <>
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: data.tags.find((t) => t.id === selectedTask.tagId)?.color || '#F59E0B' }}
                        />
                        <span className="truncate">
                          {data.tags.find((t) => t.id === selectedTask.tagId)?.name || 'Tag'}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-500">No Tag</span>
                    )}
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform duration-200 ${
                      isTaskTagDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isTaskTagDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsTaskTagDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-1.5 flex flex-col gap-0.5 animate-dropdown max-h-48 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          handleUpdateTaskField(selectedTask.id, 'tagId', undefined);
                          setIsTaskTagDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          !selectedTask.tagId ? 'bg-amber-50 text-[#D97706]' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-gray-500">No Tag</span>
                        {!selectedTask.tagId && <Check className="w-3.5 h-3.5 text-[#D97706]" />}
                      </button>

                      {(data.tags || []).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            handleUpdateTaskField(selectedTask.id, 'tagId', t.id);
                            setIsTaskTagDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            selectedTask.tagId === t.id ? 'bg-amber-50 text-[#D97706]' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                            <span className="truncate">{t.name}</span>
                          </div>
                          {selectedTask.tagId === t.id && <Check className="w-3.5 h-3.5 text-[#D97706] shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Custom Multi-Select Assignee Picker */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-black uppercase text-gray-700">
                    Assignees
                  </label>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => setShareModalOpen(true)}
                      className="text-[10px] font-bold text-[#D97706] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Invite Member</span>
                    </button>
                  )}
                </div>

                {(() => {
                  const rawAssigneeIds = selectedTask.assigneeIds && selectedTask.assigneeIds.length > 0
                    ? selectedTask.assigneeIds
                    : (selectedTask.assigneeId ? [selectedTask.assigneeId] : []);

                  // Resolve each ID to its effectiveAssignee and deduplicate by assignee.id
                  const seenMemberIds = new Set<string>();
                  const selectedAssignees: Assignee[] = [];
                  rawAssigneeIds.forEach((id) => {
                    const a = assigneeMap.get(id);
                    if (a && !seenMemberIds.has(a.id)) {
                      seenMemberIds.add(a.id);
                      selectedAssignees.push(a);
                    }
                  });
                  const selectedAssigneeIds = selectedAssignees.map((a) => a.id);

                  return (
                    <>
                      <button
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => {
                          setIsTaskAssigneeDropdownOpen(!isTaskAssigneeDropdownOpen);
                          setIsTaskTagDropdownOpen(false);
                        }}
                        className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:bg-white focus:border-[#F59E0B] focus:outline-none cursor-pointer flex items-center justify-between disabled:opacity-70"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          {selectedAssignees.length === 0 ? (
                            <span className="text-gray-500">Unassigned</span>
                          ) : (
                            <div className="flex items-center -space-x-1 overflow-hidden">
                              {selectedAssignees.slice(0, 3).map((a) => {
                                const isLightColor =
                                  !a.color ||
                                  a.color === '#F59E0B' ||
                                  a.color === '#FBBF24' ||
                                  a.color === '#FDE047' ||
                                  a.color === '#FEF08A';

                                return (
                                  <span
                                    key={a.id}
                                    title={a.name}
                                    className={`w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center border-2 border-white shrink-0 shadow-xs ${
                                      isLightColor ? 'text-gray-950' : 'text-white'
                                    }`}
                                    style={{ backgroundColor: a.color || '#F59E0B' }}
                                  >
                                    {a.initials}
                                  </span>
                                );
                              })}
                              <span className="text-xs font-bold text-gray-800 ml-1.5 truncate">
                                {selectedAssignees.length === 1
                                  ? selectedAssignees[0].name
                                  : `${selectedAssignees.length} assigned`}
                              </span>
                            </div>
                          )}
                        </div>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform duration-200 ${
                            isTaskAssigneeDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {isTaskAssigneeDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsTaskAssigneeDropdownOpen(false)}
                          />
                          <div className="absolute right-0 left-0 mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-1.5 flex flex-col gap-0.5 animate-dropdown max-h-52 overflow-y-auto">
                            <div className="px-2.5 py-1 text-[10px] font-black uppercase text-gray-400 border-b border-gray-100 mb-0.5">
                              Assign Team Members
                            </div>
                            {effectiveAssignees.map((a) => {
                              const isChecked = selectedAssigneeIds.includes(a.id);
                              return (
                                <div
                                  key={a.id}
                                  onClick={() => handleToggleTaskAssignee(selectedTask.id, a.id)}
                                  className={`flex items-center justify-between p-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                                    isChecked
                                      ? 'bg-amber-50/70 border-amber-200 text-gray-900'
                                      : 'bg-gray-50/40 border-transparent text-gray-700 hover:bg-gray-100'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <div
                                      className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                        isChecked ? 'bg-[#F59E0B] border-[#F59E0B] text-gray-950 font-black' : 'border-gray-300'
                                      }`}
                                    >
                                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                    <span
                                      className="w-5 h-5 rounded-full text-[9.5px] font-black flex items-center justify-center text-white shrink-0"
                                      style={{ backgroundColor: a.color || '#F59E0B' }}
                                    >
                                      {a.initials}
                                    </span>
                                    <span className="truncate">{a.name}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Duration (Days) Stepper */}
            {(() => {
              const modalProj = calculateVisibleProjection(activeSprint.days, displayDays, selectedTask);
              const displaySpan = modalProj.isVisible ? modalProj.visibleSpan : (selectedTask.daySpan || 1);
              const isFiltered = displayDays.length < activeSprint.days.length;

              return (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-black uppercase text-gray-700">
                      Duration ({displaySpan} {displaySpan === 1 ? 'Day' : 'Days'})
                    </label>
                    {isFiltered && (selectedTask.daySpan || 1) !== displaySpan && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50">
                        {selectedTask.daySpan || 1} calendar days total
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl p-1 gap-1">
                      <button
                        type="button"
                        disabled={isReadOnly || (selectedTask.daySpan || 1) <= 1}
                        onClick={() => {
                          const newSpan = Math.max(1, (selectedTask.daySpan || 1) - 1);
                          handleUpdateTaskField(selectedTask.id, 'daySpan', newSpan);
                        }}
                        className="w-7 h-7 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center text-xs font-black text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                      >
                        -
                      </button>
                      <span className="px-3 text-xs font-black text-gray-900 min-w-[55px] text-center">
                        {displaySpan} {displaySpan === 1 ? 'Day' : 'Days'}
                      </span>
                      <button
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => {
                          const newSpan = (selectedTask.daySpan || 1) + 1;
                          handleUpdateTaskField(selectedTask.id, 'daySpan', newSpan);
                        }}
                        className="w-7 h-7 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center text-xs font-black text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-[11px] font-semibold text-gray-400">
                      {isFiltered
                        ? `Covers ${displaySpan} visible working ${displaySpan === 1 ? 'day' : 'days'}`
                        : `Spans across ${displaySpan} consecutive sprint days`}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Deliverables Checklist */}
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-700 mb-2">
                Deliverables Checklist ({selectedTask.progressPercentage || 0}%)
              </label>

              <div className="flex flex-col gap-1.5 mb-2.5">
                {(selectedTask.deliverableItems || []).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs font-semibold transition-colors ${
                      item.isCompleted
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 line-through'
                        : 'bg-gray-50 border-gray-200 text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    <div
                      onClick={() => handleToggleDeliverable(selectedTask.id, idx)}
                      className="flex items-center gap-2.5 flex-1 cursor-pointer"
                    >
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                          item.isCompleted ? 'bg-emerald-600 border-emerald-600 text-white font-black' : 'border-gray-300'
                        }`}
                      >
                        {item.isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span>{item.text}</span>
                    </div>

                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleDeleteDeliverableItem(selectedTask.id, idx)}
                        className="text-gray-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {!isReadOnly && (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Add deliverable item..."
                    value={newDeliverableText}
                    onChange={(e) => setNewDeliverableText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDeliverableItem(selectedTask.id);
                      }
                    }}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#F59E0B] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddDeliverableItem(selectedTask.id)}
                    className="px-3 py-1.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              {!isReadOnly ? (
                <button
                  type="button"
                  onClick={() => handleDeleteTask(selectedTask.id)}
                  className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Delete Card
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 rounded-xl text-xs font-black cursor-pointer shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / CUSTOMIZE TAG MODAL */}
      {isAddTagOpen && (
        <div
          onClick={() => setIsAddTagOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-[60] flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-6 relative shadow-2xl flex flex-col gap-4 animate-dropdown"
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900">Create New Tag</h3>
              <button
                type="button"
                onClick={() => setIsAddTagOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTag} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-[11px] font-black uppercase text-gray-700 mb-1">
                  Tag Name
                </label>
                <input
                  autoFocus
                  type="text"
                  required
                  placeholder="e.g. Design, Frontend, Strategy..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-900 focus:bg-white focus:border-[#F59E0B] focus:outline-none"
                />
              </div>

              {/* Tag Color Customizer & Palette */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-black uppercase text-gray-700">
                    Tag Color
                  </label>
                  <span className="text-[10px] font-mono font-bold text-gray-400">
                    {newTagColor}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-2.5">
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white"
                  />
                  <span className="text-xs text-gray-500 font-medium">
                    Pick custom color or choose from palette below
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-2">
                  {CURATED_TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewTagColor(c)}
                      className={`w-full h-8 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                        newTagColor.toLowerCase() === c.toLowerCase()
                          ? 'ring-2 ring-gray-950 scale-105 shadow-sm'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {newTagColor.toLowerCase() === c.toLowerCase() && (
                        <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Card */}
              <div className="p-3 rounded-2xl border border-gray-100 bg-gray-50 flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase text-gray-400">
                  Card Preview
                </span>
                <div
                  className="rounded-xl p-3 text-white flex items-center justify-between shadow-xs"
                  style={{ backgroundColor: newTagColor }}
                >
                  <span className="text-[10px] font-black uppercase tracking-wider bg-black/25 px-2 py-0.5 rounded">
                    {newTagName.trim() || 'TAG NAME'}
                  </span>
                  <span className="text-xs font-bold">Sample Task Title</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddTagOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 text-xs font-black rounded-xl cursor-pointer"
                >
                  Create Tag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD WORKSTREAM TRACK MODAL */}
      {isAddTrackOpen && (
        <div
          onClick={() => setIsAddTrackOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-6 relative shadow-2xl flex flex-col gap-4 animate-dropdown"
          >
            <h3 className="text-lg font-black text-gray-900">Add New Work Stream Track</h3>
            <form onSubmit={handleAddTrack} className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-black uppercase text-gray-700 mb-1">
                  Work Stream Title
                </label>
                <input
                  autoFocus
                  type="text"
                  required
                  placeholder="e.g. Frontend Architecture"
                  value={newTrackTitle}
                  onChange={(e) => setNewTrackTitle(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-900 focus:bg-white focus:border-[#F59E0B] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTrackOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 text-xs font-black rounded-xl cursor-pointer"
                >
                  Add Track
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* SHARE & INVITE COLLABORATORS MODAL */}
      {shareModalOpen && (
        <div
          onClick={() => setShareModalOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-[60] flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-gray-200 rounded-3xl w-full max-w-lg p-6 relative shadow-2xl flex flex-col gap-5 animate-dropdown text-gray-900"
          >
            {/* Top Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-gray-900">
                  Share &ldquo;{data.project.title}&rdquo;
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Invite collaborators to view or edit this sprint timeline.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer -mr-1.5 -mt-1.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Single Seamless Invite Row */}
            <form onSubmit={handleInviteCollaborator} className="flex items-center gap-2">
              <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-1 focus-within:bg-white focus-within:border-[#F59E0B] focus-within:ring-2 focus-within:ring-[#F59E0B]/10 transition-all">
                <input
                  type="email"
                  required
                  placeholder="Add people by email..."
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 bg-transparent text-xs font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none py-1.5"
                />
                <div className="h-4 w-px bg-gray-200 mx-2" />
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsSharePermissionDropdownOpen(!isSharePermissionDropdownOpen)}
                    className="bg-transparent text-xs font-bold text-gray-700 hover:text-gray-950 focus:outline-none cursor-pointer flex items-center gap-1.5 pr-1 py-1"
                  >
                    <span>{invitePermission === 'editor' ? 'Can edit' : 'Can view'}</span>
                    <ChevronDown
                      className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${
                        isSharePermissionDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isSharePermissionDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsSharePermissionDropdownOpen(false)}
                      />
                      <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-1 flex flex-col gap-0.5 animate-dropdown">
                        <button
                          type="button"
                          onClick={() => {
                            setInvitePermission('editor');
                            setIsSharePermissionDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            invitePermission === 'editor' ? 'bg-amber-50 text-[#D97706]' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span>Can edit</span>
                          {invitePermission === 'editor' && <Check className="w-3.5 h-3.5 text-[#D97706]" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInvitePermission('viewer');
                            setIsSharePermissionDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            invitePermission === 'viewer' ? 'bg-amber-50 text-[#D97706]' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span>Can view</span>
                          {invitePermission === 'viewer' && <Check className="w-3.5 h-3.5 text-[#D97706]" />}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isInviting || !inviteEmail.trim()}
                className="px-4 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 font-black text-xs rounded-2xl transition-all shadow-sm shadow-[#F59E0B]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {isInviting ? 'Inviting...' : 'Invite'}
              </button>
            </form>

            {/* People with Access List */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                People with access
              </span>

              <div className="flex flex-col divide-y divide-gray-100 max-h-56 overflow-y-auto pr-1">
                {/* Owner */}
                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center border border-amber-200">
                      {getInitials(effectiveAssignees[0]?.name || 'Owner')}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-900">
                        {effectiveAssignees[0]?.name || 'Owner'}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {data.project.ownerEmail || (isOwner ? currentUser?.email : '')}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                    Owner
                  </span>
                </div>

                {/* Invited Collaborators */}
                {collaborators.map((col) => (
                  <div key={col.id} className="flex items-center justify-between py-2.5 group">
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-black text-xs flex items-center justify-center border border-blue-200 shrink-0">
                        {col.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="text-xs font-bold text-gray-900 truncate">{col.name}</span>
                        <span className="text-[11px] text-gray-400 truncate">{col.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={col.permission}
                        onChange={(e) => handleUpdateCollaboratorPermission(col.id, e.target.value as PermissionLevel)}
                        className="text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl px-2.5 py-1 focus:outline-none cursor-pointer"
                      >
                        <option value="editor">Can edit</option>
                        <option value="viewer">Can view</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleRemoveCollaborator(col.id)}
                        title="Remove collaborator"
                        className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* General Access & Link Sharing Controls */}
            <div className="pt-3.5 border-t border-gray-100 flex flex-col gap-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                General Access
              </span>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${accessLevel === 'restricted' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                    {accessLevel === 'restricted' ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-900">
                      {accessLevel === 'restricted' ? 'Restricted' : 'Anyone with the link'}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {accessLevel === 'restricted'
                        ? 'Only invited collaborators can open'
                        : accessLevel === 'public_edit'
                        ? 'Anyone on the internet with the link can edit'
                        : 'Anyone on the internet with the link can view'}
                    </span>
                  </div>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsShareAccessDropdownOpen(!isShareAccessDropdownOpen)}
                    className="inline-flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-800 focus:outline-none cursor-pointer"
                  >
                    <span>
                      {accessLevel === 'public_view' && 'Viewer (Read-only)'}
                      {accessLevel === 'public_edit' && 'Editor (Can edit)'}
                      {accessLevel === 'restricted' && 'Restricted (Private)'}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                        isShareAccessDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isShareAccessDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsShareAccessDropdownOpen(false)}
                      />
                      <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-1.5 flex flex-col gap-0.5 animate-dropdown">
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateAccessLevel('public_view');
                            setIsShareAccessDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            accessLevel === 'public_view' ? 'bg-amber-50 text-[#D97706]' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>Viewer (Read-only)</span>
                          </div>
                          {accessLevel === 'public_view' && <Check className="w-3.5 h-3.5 text-[#D97706]" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateAccessLevel('public_edit');
                            setIsShareAccessDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            accessLevel === 'public_edit' ? 'bg-amber-50 text-[#D97706]' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Editor (Can edit)</span>
                          </div>
                          {accessLevel === 'public_edit' && <Check className="w-3.5 h-3.5 text-[#D97706]" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateAccessLevel('restricted');
                            setIsShareAccessDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            accessLevel === 'restricted' ? 'bg-amber-50 text-[#D97706]' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5 text-rose-600" />
                            <span>Restricted (Private)</span>
                          </div>
                          {accessLevel === 'restricted' && <Check className="w-3.5 h-3.5 text-[#D97706]" />}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                  {accessLevel === 'restricted' ? (
                    <>
                      <Lock className="w-3.5 h-3.5 text-rose-500" />
                      <span>Private link (collaborators only)</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-3.5 h-3.5 text-blue-500" />
                      <span>Public share link</span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Link copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-gray-600" />
                      <span>Copy link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE TAGS MODAL (Timeline Scoped) */}
      {isManageTagsOpen && (
        <div
          onClick={() => setIsManageTagsOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-gray-200 rounded-3xl w-full max-w-lg p-6 relative shadow-2xl flex flex-col gap-4 animate-dropdown max-h-[85vh] overflow-hidden"
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-black text-gray-900">Manage Tags</h3>
                <p className="text-xs text-gray-500">Custom tags and card colors for this specific timeline.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsManageTagsOpen(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Inline Quick Add Tag */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTagName.trim()) return;
                const newTag: Tag = {
                  id: `tag-${Date.now()}`,
                  projectId: data.project.id,
                  name: newTagName.trim(),
                  color: newTagColor,
                  orderIndex: (data.tags || []).length + 1,
                };
                const updatedTags = [...(data.tags || []), newTag];
                const updatedData = { ...data, tags: updatedTags };
                setNewTagName('');
                setNewTagColor(getRandomTagColor());
                handlePersistChanges(updatedData);
              }}
              className="flex items-center gap-2.5 p-2 bg-amber-50/60 border border-amber-200/80 rounded-2xl shrink-0"
            >
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="w-8 h-8 rounded-xl border border-gray-200 cursor-pointer p-0.5 bg-white shrink-0 shadow-2xs"
                title="Choose new tag color"
              />
              <input
                type="text"
                required
                placeholder="New tag name (e.g. Design, Frontend)..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#F59E0B]"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 font-black text-xs rounded-xl transition-all cursor-pointer shrink-0 shadow-2xs"
              >
                Add Tag
              </button>
            </form>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1 max-h-64">
              {(data.tags || []).map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between gap-3 p-2.5 bg-gray-50 border border-gray-200 rounded-2xl"
                >
                  <div className="flex items-center gap-2.5 flex-1">
                    <input
                      type="color"
                      value={tag.color}
                      onChange={(e) => handleUpdateTag(tag.id, { color: e.target.value })}
                      className="w-8 h-8 rounded-xl border border-gray-200 cursor-pointer p-0.5 bg-white shrink-0 shadow-2xs"
                      title="Change tag color"
                    />
                    <input
                      type="text"
                      value={tag.name}
                      onChange={(e) => handleUpdateTag(tag.id, { name: e.target.value })}
                      className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#F59E0B]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteTag(tag.id)}
                    className="p-2 text-gray-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 cursor-pointer transition-colors"
                    title="Delete Tag"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {(data.tags || []).length === 0 && (
                <div className="text-center py-6 text-xs text-gray-400 font-bold">
                  No tags created for this timeline yet. Type above to add one!
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsManageTagsOpen(false)}
                className="px-5 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 font-black text-xs rounded-xl cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTEXTUAL RE-ORDER COLLISION MODAL */}
      {collisionModalState && collisionModalState.isOpen && (
        <div
          onClick={() => setCollisionModalState(null)}
          className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-6 relative shadow-2xl flex flex-col gap-5 animate-dropdown"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#D97706] flex items-center justify-center font-black">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Re-order Cards</h3>
                  <p className="text-[11px] text-gray-400 font-semibold">
                    Slot on <span className="font-bold text-gray-700">{collisionModalState.targetDayLabel}</span> is already occupied.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCollisionModalState(null)}
                className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conflict Summary Box */}
            <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-2xl flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#D97706]">Conflicting Card</span>
              <span className="text-xs font-bold text-gray-900 truncate">
                {collisionModalState.conflictingTaskTitle}
              </span>
            </div>

            {/* Action Options */}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => handleExecuteReorder('push_right')}
                className="w-full p-3.5 rounded-2xl border border-gray-200 hover:border-[#F59E0B] hover:bg-amber-50/40 flex items-center justify-between text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-xl bg-gray-100 group-hover:bg-[#F59E0B] group-hover:text-gray-950 flex items-center justify-center text-gray-600 transition-colors">
                    &rarr;
                  </div>
                  <div>
                    <div className="text-xs font-black text-gray-900">Push Right (Forward)</div>
                    <div className="text-[11px] text-gray-400 font-medium">Shift downstream cards to succeeding days</div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleExecuteReorder('push_left')}
                className="w-full p-3.5 rounded-2xl border border-gray-200 hover:border-[#F59E0B] hover:bg-amber-50/40 flex items-center justify-between text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-xl bg-gray-100 group-hover:bg-[#F59E0B] group-hover:text-gray-950 flex items-center justify-center text-gray-600 transition-colors">
                    &larr;
                  </div>
                  <div>
                    <div className="text-xs font-black text-gray-900">Push Left (Backward)</div>
                    <div className="text-[11px] text-gray-400 font-medium">Shift upstream cards to preceding days</div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleExecuteReorder('swap')}
                className="w-full p-3.5 rounded-2xl border border-gray-200 hover:border-[#F59E0B] hover:bg-amber-50/40 flex items-center justify-between text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-xl bg-gray-100 group-hover:bg-[#F59E0B] group-hover:text-gray-950 flex items-center justify-center text-gray-600 transition-colors">
                    &#8644;
                  </div>
                  <div>
                    <div className="text-xs font-black text-gray-900">Swap Positions</div>
                    <div className="text-[11px] text-gray-400 font-medium">Exchange positions between the two cards</div>
                  </div>
                </div>
              </button>
            </div>

            {/* Cancel Footer */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setCollisionModalState(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM RIGHT-CLICK CARD CONTEXT MENU */}
      {contextMenuState && contextMenuState.isOpen && (
        <>
          <div
            className="fixed inset-0 z-50 cursor-default"
            onClick={() => setContextMenuState(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenuState(null);
            }}
          />
          <div
            className="fixed z-50 bg-white border border-gray-200/90 rounded-2xl shadow-2xl p-1.5 min-w-[200px] flex flex-col gap-0.5 animate-dropdown text-xs backdrop-blur-md"
            style={{
              top: Math.min(contextMenuState.y, typeof window !== 'undefined' ? window.innerHeight - 220 : contextMenuState.y),
              left: Math.min(contextMenuState.x, typeof window !== 'undefined' ? window.innerWidth - 220 : contextMenuState.x),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-gray-100 mb-0.5 truncate">
              {contextMenuState.task.deliverableItems?.[0]?.text || contextMenuState.task.title || 'Task Options'}
            </div>

            <button
              type="button"
              onClick={() => {
                handleDuplicateTask(contextMenuState.task);
              }}
              className="flex items-center justify-between px-2.5 py-2 rounded-xl font-bold text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Copy className="w-3.5 h-3.5 text-amber-600" />
                <span>Duplicate Card</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">Alt+Drag</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedTask(contextMenuState.task);
                setContextMenuState(null);
              }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-gray-500" />
              <span>Edit Details...</span>
            </button>

            <div className="my-0.5 border-t border-gray-100" />

            <button
              type="button"
              onClick={() => {
                handleDeleteTask(contextMenuState.task.id);
                setContextMenuState(null);
              }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Delete Card</span>
            </button>
          </div>
        </>
      )}

      {/* UNSAVED CHANGES / ACTIVE SAVING GUARD MODAL */}
      {showUnsavedWarningModal && (
        <div
          onClick={() => setShowUnsavedWarningModal(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-6 relative shadow-2xl flex flex-col gap-5 animate-dropdown"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-[#D97706] flex items-center justify-center font-black shrink-0 shadow-xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">Changes Still Saving...</h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  Your timeline changes are currently being synced with the database.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center gap-2.5 text-xs font-semibold text-amber-900">
              <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
              <span>Leaving or reloading right now might result in recent edits not being saved.</span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedWarningModal(false);
                  setPendingNavigationUrl(null);
                }}
                className="px-4 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 font-black text-xs rounded-xl transition-all shadow-sm shadow-[#F59E0B]/20 cursor-pointer"
              >
                Stay & Wait
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedWarningModal(false);
                  if (pendingNavigationUrl) {
                    router.push(pendingNavigationUrl);
                  }
                }}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Leave Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING SCROLL DIRECTION TOGGLE WIDGET (BOTTOM-RIGHT) */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-1.5 p-1 bg-white/95 backdrop-blur-md border border-gray-200/90 rounded-2xl shadow-xl shadow-black/10 hover:shadow-2xl transition-all select-none">
        {/* Minimalist Scroll Indicator */}
        <div className="flex items-center gap-1.5 pl-2.5 pr-1 py-1 text-gray-500">
          <Mouse className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Scroll</span>
        </div>

        {/* Minimalist Segmented Tabs */}
        <div className="flex items-center gap-1 bg-gray-100/70 p-0.5 rounded-xl border border-gray-200/40">
          <button
            type="button"
            onClick={() => handleToggleScrollMode('horizontal')}
            title="Horizontal Scroll Mode (Mouse wheel moves timeline horizontally left/right)"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
              scrollMode === 'horizontal'
                ? 'bg-white text-gray-950 font-black shadow-xs border border-gray-200/80'
                : 'text-gray-500 hover:text-gray-900 font-bold'
            }`}
          >
            <ArrowLeftRight className="w-3 h-3 text-[#D97706]" />
            <span>Horizontal</span>
          </button>

          <button
            type="button"
            onClick={() => handleToggleScrollMode('vertical')}
            title="Vertical Scroll Mode (Mouse wheel moves timeline vertically up/down)"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
              scrollMode === 'vertical'
                ? 'bg-white text-gray-950 font-black shadow-xs border border-gray-200/80'
                : 'text-gray-500 hover:text-gray-900 font-bold'
            }`}
          >
            <ArrowUpDown className="w-3 h-3 text-[#D97706]" />
            <span>Vertical</span>
          </button>
        </div>
      </div>
    </div>
  );
}
