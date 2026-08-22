import {
  Assignee,
  CategoryTrack,
  DayConfig,
  Project,
  Sprint,
  Tag,
  TaskCard,
  TimelineData,
  WeekGroup,
} from '@/types/timeline';

export const CURATED_TAG_COLORS = [
  '#EC4899', // Pink / Strategy
  '#EA580C', // Orange / Copy & Design
  '#2563EB', // Blue / Development
  '#8B5CF6', // Purple / Testing
  '#DC2626', // Red / Revision
  '#059669', // Green / Publish
  '#D97706', // Amber
  '#0891B2', // Cyan
  '#4F46E5', // Indigo
  '#16A34A', // Emerald
  '#0284C7', // Sky
  '#7C3AED', // Violet
];

const MONTH_FULL_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

const MONTH_SHORT_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const CALENDAR_DAY_ORDER: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export function getRandomTagColor(): string {
  const index = Math.floor(Math.random() * CURATED_TAG_COLORS.length);
  return CURATED_TAG_COLORS[index] || '#EA580C';
}

/**
 * Single source of truth for generating user initials from any display name
 * e.g., "Matt Renzo C. Baring" -> "MR", "Sarah Connor" -> "SC", "Maverick" -> "M"
 */
export function getInitials(name: string): string {
  if (!name || !name.trim()) return 'U';
  const clean = name.trim().replace(/\(You\)/gi, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  if (clean.length >= 2) {
    return clean.slice(0, 2).toUpperCase();
  }
  return clean.toUpperCase();
}

/**
 * Production-grade dynamic calculation of month header label from an array of days
 */
export function computeMonthLabelFromDays(days: DayConfig[]): string {
  if (!days || days.length === 0) return 'SCHEDULE';

  const seenMonths: { month: number; year: number }[] = [];
  for (const day of days) {
    if (!day.fullDate) continue;
    const parts = day.fullDate.split('-');
    if (parts.length >= 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      if (!isNaN(y) && !isNaN(m)) {
        if (!seenMonths.some((sm) => sm.month === m && sm.year === y)) {
          seenMonths.push({ month: m, year: y });
        }
      }
    }
  }

  if (seenMonths.length === 0) return 'SCHEDULE';
  if (seenMonths.length === 1) {
    return `${MONTH_FULL_NAMES[seenMonths[0].month]} ${seenMonths[0].year}`;
  }

  const first = seenMonths[0];
  const last = seenMonths[seenMonths.length - 1];

  if (first.year === last.year) {
    return `${MONTH_FULL_NAMES[first.month]} – ${MONTH_FULL_NAMES[last.month]} ${first.year}`;
  } else {
    return `${MONTH_FULL_NAMES[first.month]} ${first.year} – ${MONTH_FULL_NAMES[last.month]} ${last.year}`;
  }
}

export function generateDaysFromStartDate(
  startDateStr?: string,
  weekCount: number = 4
): {
  days: DayConfig[];
  weekGroups: WeekGroup[];
  monthLabel: string;
  scheduleLabel: string;
} {
  const chosenDate = startDateStr ? new Date(startDateStr + 'T00:00:00') : new Date();

  // Align to Sunday of the chosen week so every calendar week is strictly:
  // Sun -> Mon -> Tue -> Wed -> Thu -> Fri -> Sat
  const dayOfWeek = chosenDate.getDay(); // 0 is Sun, 6 is Sat
  const startDate = new Date(chosenDate);
  startDate.setDate(startDate.getDate() - dayOfWeek);

  const days: DayConfig[] = [];
  const weekGroups: WeekGroup[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let currentDate = new Date(startDate);

  for (let weekNum = 1; weekNum <= weekCount; weekNum++) {
    const weekStartDate = new Date(currentDate);

    for (let d = 0; d < 7; d++) {
      const dYear = currentDate.getFullYear();
      const dMonth = currentDate.getMonth();
      const dDate = currentDate.getDate();
      const dayOfWeekIndex = currentDate.getDay();
      const dayName = dayNames[dayOfWeekIndex];
      const dayStr = dDate < 10 ? `0${dDate}` : `${dDate}`;
      const monthStr = dMonth + 1 < 10 ? `0${dMonth + 1}` : `${dMonth + 1}`;
      const fullDate = `${dYear}-${monthStr}-${dayStr}`;

      days.push({
        id: `d-${weekNum}-${d + 1}-${dYear}${monthStr}${dayStr}`,
        dayName,
        dayNum: dayStr,
        dateStr: dayStr,
        fullDate,
        isWeekend: dayOfWeekIndex === 0 || dayOfWeekIndex === 6,
        isWeekStart: d === 0,
        weekNumber: weekNum,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const weekEndDate = new Date(currentDate);
    weekEndDate.setDate(weekEndDate.getDate() - 1);

    const startDayStr = weekStartDate.getDate() < 10 ? `0${weekStartDate.getDate()}` : `${weekStartDate.getDate()}`;
    const endDayStr = weekEndDate.getDate() < 10 ? `0${weekEndDate.getDate()}` : `${weekEndDate.getDate()}`;
    const startMonthShort = MONTH_SHORT_NAMES[weekStartDate.getMonth()];
    const endMonthShort = MONTH_SHORT_NAMES[weekEndDate.getMonth()];

    const dateRange = startMonthShort === endMonthShort
      ? `${startMonthShort} ${startDayStr} – ${endDayStr}`
      : `${startMonthShort} ${startDayStr} – ${endMonthShort} ${endDayStr}`;

    weekGroups.push({
      id: `w-${weekNum}`,
      weekNumber: weekNum,
      label: `WEEK ${weekNum}`,
      title: `Week ${weekNum}`,
      dateRange,
      daySpan: 7,
      dayCount: 7,
    });
  }

  const monthLabel = computeMonthLabelFromDays(days);
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const scheduleLabel = `${firstDay?.fullDate || ''} – ${lastDay?.fullDate || ''}`;

  return { days, weekGroups, monthLabel, scheduleLabel };
}

export function generateCurrentMonthDays(weekCount: number = 4): {
  days: DayConfig[];
  weekGroups: WeekGroup[];
  monthLabel: string;
  scheduleLabel: string;
} {
  return generateDaysFromStartDate(undefined, weekCount);
}

export function normalizeSprintTo7Days(sprint: Sprint): Sprint {
  const currentWeekGroups = sprint.weekGroups || [];
  const currentDays = sprint.days || [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Determine unique week numbers
  const weekNumbers = Array.from(
    new Set([
      ...currentWeekGroups.map((w) => w.weekNumber),
      ...currentDays.map((d) => d.weekNumber),
    ])
  ).sort((a, b) => a - b);

  if (weekNumbers.length === 0) return sprint;

  const normalizedDays: DayConfig[] = [];
  const normalizedWeekGroups: WeekGroup[] = [];

  for (const weekNum of weekNumbers) {
    const existingDaysInWeek = currentDays.filter((d) => d.weekNumber === weekNum);

    // If week already has all 7 days with valid dayNames, ensure they are sorted Sun -> Sat
    const hasAll7 =
      existingDaysInWeek.length === 7 &&
      dayNames.every((name) => existingDaysInWeek.some((d) => d.dayName.toLowerCase() === name.toLowerCase()));

    if (hasAll7) {
      const sortedDays = [...existingDaysInWeek].sort(
        (a, b) => (CALENDAR_DAY_ORDER[a.dayName.toLowerCase()] ?? 0) - (CALENDAR_DAY_ORDER[b.dayName.toLowerCase()] ?? 0)
      );
      normalizedDays.push(...sortedDays);
      const existingGrp = currentWeekGroups.find((w) => w.weekNumber === weekNum);
      if (existingGrp) {
        normalizedWeekGroups.push({ ...existingGrp, daySpan: 7, dayCount: 7 });
      }
      continue;
    }

    // Otherwise reconstruct the 7 days for this week starting strictly on Sunday
    let referenceDate = new Date();
    const firstExistingWithDate = existingDaysInWeek.find((d) => d.fullDate);

    if (firstExistingWithDate && firstExistingWithDate.fullDate) {
      const parsed = new Date(firstExistingWithDate.fullDate + 'T00:00:00');
      if (!isNaN(parsed.getTime())) {
        const dayIdx = dayNames.findIndex((name) => name.toLowerCase() === firstExistingWithDate.dayName.toLowerCase());
        const offset = dayIdx >= 0 ? dayIdx : parsed.getDay();
        referenceDate = new Date(parsed);
        referenceDate.setDate(referenceDate.getDate() - offset); // Back up to Sunday
      }
    } else if (normalizedDays.length > 0) {
      const lastDay = normalizedDays[normalizedDays.length - 1];
      if (lastDay && lastDay.fullDate) {
        const parsed = new Date(lastDay.fullDate + 'T00:00:00');
        if (!isNaN(parsed.getTime())) {
          referenceDate = new Date(parsed);
          referenceDate.setDate(referenceDate.getDate() + 1);
        }
      }
    }

    // Ensure referenceDate is on Sunday
    const refDayOfWeek = referenceDate.getDay();
    if (refDayOfWeek !== 0) {
      referenceDate.setDate(referenceDate.getDate() - refDayOfWeek);
    }

    const weekStartDate = new Date(referenceDate);
    const newWeekDays: DayConfig[] = [];

    for (let d = 0; d < 7; d++) {
      const dayDate = new Date(referenceDate);
      dayDate.setDate(dayDate.getDate() + d);

      const dYear = dayDate.getFullYear();
      const dMonth = dayDate.getMonth();
      const dDate = dayDate.getDate();
      const dayOfWeekIndex = dayDate.getDay();
      const dayName = dayNames[dayOfWeekIndex];
      const dayStr = dDate < 10 ? `0${dDate}` : `${dDate}`;
      const monthStr = dMonth + 1 < 10 ? `0${dMonth + 1}` : `${dMonth + 1}`;
      const fullDate = `${dYear}-${monthStr}-${dayStr}`;

      const existingMatch = existingDaysInWeek.find(
        (ed) => ed.dayName.toLowerCase() === dayName.toLowerCase()
      );

      newWeekDays.push({
        id: existingMatch ? existingMatch.id : `d-${weekNum}-${d + 1}-${dYear}${monthStr}${dayStr}`,
        dayName,
        dayNum: dayStr,
        dateStr: dayStr,
        fullDate,
        isWeekend: dayOfWeekIndex === 0 || dayOfWeekIndex === 6,
        isWeekStart: d === 0,
        weekNumber: weekNum,
      });
    }

    normalizedDays.push(...newWeekDays);

    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const startDayStr = weekStartDate.getDate() < 10 ? `0${weekStartDate.getDate()}` : `${weekStartDate.getDate()}`;
    const endDayStr = weekEndDate.getDate() < 10 ? `0${weekEndDate.getDate()}` : `${weekEndDate.getDate()}`;
    const startMonthShort = MONTH_SHORT_NAMES[weekStartDate.getMonth()];
    const endMonthShort = MONTH_SHORT_NAMES[weekEndDate.getMonth()];

    const dateRange = startMonthShort === endMonthShort
      ? `${startMonthShort} ${startDayStr} – ${endDayStr}`
      : `${startMonthShort} ${startDayStr} – ${endMonthShort} ${endDayStr}`;

    normalizedWeekGroups.push({
      id: `w-${weekNum}`,
      weekNumber: weekNum,
      label: `WEEK ${weekNum}`,
      title: `Week ${weekNum}`,
      dateRange,
      daySpan: 7,
      dayCount: 7,
    });
  }

  const monthLabel = computeMonthLabelFromDays(normalizedDays);

  return {
    ...sprint,
    monthLabel,
    weekGroups: normalizedWeekGroups,
    days: normalizedDays,
  };
}

export function appendWeekToSprint(sprint: Sprint): Sprint {
  const normalizedSprint = normalizeSprintTo7Days(sprint);
  const currentWeekGroups = normalizedSprint.weekGroups || [];
  const currentDays = normalizedSprint.days || [];
  const nextWeekNum = currentWeekGroups.length > 0
    ? Math.max(...currentWeekGroups.map((w) => w.weekNumber)) + 1
    : 1;

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const lastDay = currentDays[currentDays.length - 1];

  let nextDate = new Date();
  if (lastDay && lastDay.fullDate) {
    const lastDate = new Date(lastDay.fullDate + 'T00:00:00');
    if (!isNaN(lastDate.getTime())) {
      nextDate = new Date(lastDate);
      nextDate.setDate(nextDate.getDate() + 1);
    }
  }

  // Ensure next week starts on Sunday
  const dayOfWeek = nextDate.getDay();
  if (dayOfWeek !== 0) {
    nextDate.setDate(nextDate.getDate() - dayOfWeek);
  }

  const weekStartDate = new Date(nextDate);
  const newDays: DayConfig[] = [];

  for (let d = 0; d < 7; d++) {
    const dYear = nextDate.getFullYear();
    const dMonth = nextDate.getMonth();
    const dDate = nextDate.getDate();
    const dayOfWeekIndex = nextDate.getDay();
    const dayName = dayNames[dayOfWeekIndex];
    const dayStr = dDate < 10 ? `0${dDate}` : `${dDate}`;
    const monthStr = dMonth + 1 < 10 ? `0${dMonth + 1}` : `${dMonth + 1}`;
    const fullDate = `${dYear}-${monthStr}-${dayStr}`;

    newDays.push({
      id: `d-${nextWeekNum}-${d + 1}-${dYear}${monthStr}${dayStr}`,
      dayName,
      dayNum: dayStr,
      dateStr: dayStr,
      fullDate,
      isWeekend: dayOfWeekIndex === 0 || dayOfWeekIndex === 6,
      isWeekStart: d === 0,
      weekNumber: nextWeekNum,
    });

    nextDate.setDate(nextDate.getDate() + 1);
  }

  const weekEndDate = new Date(nextDate);
  weekEndDate.setDate(weekEndDate.getDate() - 1);

  const startDayStr = weekStartDate.getDate() < 10 ? `0${weekStartDate.getDate()}` : `${weekStartDate.getDate()}`;
  const endDayStr = weekEndDate.getDate() < 10 ? `0${weekEndDate.getDate()}` : `${weekEndDate.getDate()}`;
  const startMonthShort = MONTH_SHORT_NAMES[weekStartDate.getMonth()];
  const endMonthShort = MONTH_SHORT_NAMES[weekEndDate.getMonth()];

  const dateRange = startMonthShort === endMonthShort
    ? `${startMonthShort} ${startDayStr} – ${endDayStr}`
    : `${startMonthShort} ${startDayStr} – ${endMonthShort} ${endDayStr}`;

  const newWeekGroup: WeekGroup = {
    id: `w-${nextWeekNum}-${Date.now()}`,
    weekNumber: nextWeekNum,
    label: `WEEK ${nextWeekNum}`,
    title: `Week ${nextWeekNum}`,
    dateRange,
    daySpan: 7,
    dayCount: 7,
  };

  const allDays = [...currentDays, ...newDays];
  const updatedMonthLabel = computeMonthLabelFromDays(allDays);

  return {
    ...normalizedSprint,
    monthLabel: updatedMonthLabel,
    weekGroups: [...currentWeekGroups, newWeekGroup],
    days: allDays,
  };
}

export function createInitialTimeline(
  title: string = 'Sprint Delivery Schedule',
  slug: string = 'master-schedule',
  startDateStr?: string
): TimelineData {
  const project: Project = {
    id: `proj-${Date.now()}`,
    slug,
    title,
    subtitle: 'Timeline & Delivery Schedule',
    status: 'active',
    accessLevel: 'restricted',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const { days, weekGroups, monthLabel, scheduleLabel } = generateDaysFromStartDate(startDateStr, 4);

  const sprint: Sprint = {
    id: `sprint-${Date.now()}`,
    projectId: project.id,
    name: 'Sprint 1',
    monthLabel,
    scheduleLabel,
    orderIndex: 1,
    startDate: days[0]?.fullDate || '2026-10-01',
    endDate: days[days.length - 1]?.fullDate || '2026-10-28',
    workdaysOnly: false,
    weekGroups,
    days,
    status: 'in_progress',
  };

  const defaultCategories: CategoryTrack[] = [
    {
      id: `cat-${Date.now()}-1`,
      projectId: project.id,
      title: 'General',
      description: 'Main delivery track',
      orderIndex: 1,
    },
  ];

  const defaultAssignees: Assignee[] = [];

  const defaultTags: Tag[] = [
    { id: `tag-${Date.now()}-1`, projectId: project.id, name: 'Strategy', color: '#EC4899', orderIndex: 1 },
    { id: `tag-${Date.now()}-2`, projectId: project.id, name: 'Copy & Design', color: '#EA580C', orderIndex: 2 },
    { id: `tag-${Date.now()}-3`, projectId: project.id, name: 'Development', color: '#2563EB', orderIndex: 3 },
    { id: `tag-${Date.now()}-4`, projectId: project.id, name: 'Testing', color: '#8B5CF6', orderIndex: 4 },
    { id: `tag-${Date.now()}-5`, projectId: project.id, name: 'Revision', color: '#DC2626', orderIndex: 5 },
    { id: `tag-${Date.now()}-6`, projectId: project.id, name: 'Publish', color: '#059669', orderIndex: 6 },
  ];

  return {
    project,
    sprints: [sprint],
    categories: defaultCategories,
    assignees: defaultAssignees,
    tags: defaultTags,
    tasks: [],
  };
}

export const defaultTimelineData: TimelineData = createInitialTimeline();
