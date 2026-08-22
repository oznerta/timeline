// Core Types for Weekline Timeline Platform

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt?: string;
}

export type PermissionLevel = 'editor' | 'viewer';
export type AccessLevel = 'public_view' | 'public_edit' | 'restricted';

export interface Collaborator {
  id: string;
  projectId: string;
  email: string;
  name: string;
  permission: PermissionLevel;
  avatarUrl?: string;
  invitedAt: string;
}

export interface Folder {
  id: string;
  userId?: string;
  name: string;
  color?: string;
  orderIndex?: number;
  createdAt?: string;
}

export interface Project {
  id: string;
  organizationId?: string;
  userId?: string;
  folderId?: string | null;
  slug: string;
  title: string;
  subtitle?: string;
  clientName?: string;
  brandName?: string;
  status?: 'active' | 'archived' | 'completed' | 'trashed';
  accessLevel?: AccessLevel;
  ownerName?: string;
  ownerEmail?: string;
  isFavorite?: boolean;
  isTrashed?: boolean;
  isShared?: boolean;
  sharedBy?: string;
  settings?: {
    visibleDays?: string[];
    selectedWeeks?: number[];
    [key: string]: any;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface DayConfig {
  id: string;
  dayName: string;
  dayNum: string;
  dateStr?: string;
  fullDate?: string;
  isWeekend?: boolean;
  isWeekStart?: boolean;
  weekNumber: number;
}

export type DayInfo = DayConfig;

export interface WeekGroup {
  id: string;
  weekNumber: number;
  label: string;
  title?: string;
  dateRange: string;
  daySpan: number;
  dayCount?: number;
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  monthLabel: string;
  scheduleLabel: string;
  orderIndex: number;
  startDate?: string;
  endDate?: string;
  workdaysOnly?: boolean;
  weekGroups: WeekGroup[];
  days: DayConfig[];
  status?: 'planning' | 'in_progress' | 'in_review' | 'completed';
}

export interface CategoryTrack {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  orderIndex: number;
}

export interface Assignee {
  id: string;
  projectId?: string;
  name: string;
  initials: string;
  color?: string;
}

export interface Tag {
  id: string;
  projectId: string;
  name: string;
  color: string; // Hex color code e.g. '#EA580C'
  orderIndex?: number;
}

export interface DeliverableItem {
  id: string;
  text: string;
  isCompleted: boolean;
}

export interface TaskCard {
  id: string;
  projectId?: string;
  sprintId: string;
  categoryId: string;
  tagId?: string;
  assigneeId?: string;
  assigneeIds?: string[];
  dayId: string;
  daySpan?: number;
  title: string;
  deliverables?: string[];
  deliverableItems?: DeliverableItem[];
  progressPercentage: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TimelineData {
  currentUser?: User;
  project: Project;
  sprints: Sprint[];
  categories: CategoryTrack[];
  assignees: Assignee[];
  tags: Tag[];
  tasks: TaskCard[];
  collaborators?: Collaborator[];
}
