'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit2,
  ExternalLink,
  FileText,
  Folder as FolderIcon,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Grid,
  LayoutDashboard,
  List,
  LogOut,
  Maximize2,
  Minimize2,
  Monitor,
  Moon,
  MoreVertical,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Sun,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { Folder, Project, TimelineData } from '@/types/timeline';
import {
  fetchWorkspaceFolders,
  fetchWorkspaceProjects,
  createWorkspaceFolder,
  renameWorkspaceFolder,
  deleteWorkspaceFolder,
  moveWorkspaceProject,
  renameWorkspaceProject,
  trashWorkspaceProject,
  restoreWorkspaceProject,
  deleteWorkspaceProjectPermanently,
} from '@/lib/data-service';
import { getInitials } from '@/lib/default-data';

interface WeeklineDashboardProps {
  timelineData: TimelineData;
  onCreateTimeline: (
    title: string,
    folderId?: string,
    startDate?: string
  ) => void;
}

export function WeeklineDashboard({
  timelineData,
  onCreateTimeline,
}: WeeklineDashboardProps) {
  const router = useRouter();
  const { currentUser, signOut } = useAuth();
  const { theme, resolvedTheme, setTheme, density, toggleDensity } = useTheme();

  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Active navigation view: 'all' (Personal space) | 'shared' | 'trash' | folderId
  const [activeView, setActiveView] = useState<string>('all');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [personalExpanded, setPersonalExpanded] = useState<boolean>(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'modified' | 'alpha'>('modified');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modals & Context Menus State
  const [isCreateTimelineModalOpen, setIsCreateTimelineModalOpen] = useState(false);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [selectedFolderForNewTimeline, setSelectedFolderForNewTimeline] = useState<string>('');

  // Rename Modals / Inline states
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [renamingProject, setRenamingProject] = useState<Project | null>(null);
  const [renameProjectTitle, setRenameProjectTitle] = useState('');

  // Move to Folder State
  const [movingProject, setMovingProject] = useState<Project | null>(null);
  const [selectedDestinationFolder, setSelectedDestinationFolder] = useState<string>('');

  // Share Modal State
  const [sharingProject, setSharingProject] = useState<Project | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Active Dropdown Menu Tracker (id -> boolean)
  const [activeDropdownMenu, setActiveDropdownMenu] = useState<string | null>(null);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isNewTimelineFolderDropdownOpen, setIsNewTimelineFolderDropdownOpen] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#F59E0B');

  // Fetch projects and folders
  const loadWorkspaceData = useCallback(async () => {
    try {
      const [projects, fetchedFolders] = await Promise.all([
        fetchWorkspaceProjects(currentUser?.id, currentUser?.email),
        fetchWorkspaceFolders(currentUser?.id),
      ]);

      setProjectsList(projects || []);
      setFolders(fetchedFolders || []);
      const exp: Record<string, boolean> = {};
      (fetchedFolders || []).forEach((f: Folder) => {
        exp[f.id] = true;
      });
      setExpandedFolders(exp);
    } catch (e) {
      console.warn('Could not load workspace metadata:', e);
    } finally {
      setIsLoadingData(false);
    }
  }, [currentUser?.id, currentUser?.email]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Close context menus on outside click
  useEffect(() => {
    const handleOutside = () => setActiveDropdownMenu(null);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, []);

  const toggleFolderExpand = (folderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  // Folder Operations
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const created = await createWorkspaceFolder(newFolderName.trim(), newFolderColor, currentUser?.id);
      setFolders((prev) => [...prev.filter((f) => f.id !== created.id), created]);
      setExpandedFolders((prev) => ({ ...prev, [created.id]: true }));
      setActiveView(created.id);
    } catch (err) {
      console.error('Failed to create folder:', err);
    } finally {
      setIsCreateFolderModalOpen(false);
      setNewFolderName('');
    }
  };

  const handleRenameFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingFolder || !renameFolderName.trim()) return;

    try {
      await renameWorkspaceFolder(renamingFolder.id, renameFolderName.trim());
      setFolders((prev) =>
        prev.map((f) => (f.id === renamingFolder.id ? { ...f, name: renameFolderName.trim() } : f))
      );
    } catch (err) {
      console.error('Failed to rename folder:', err);
    } finally {
      setRenamingFolder(null);
      setRenameFolderName('');
    }
  };

  const handleDeleteFolder = async (folderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this folder? Timelines inside will be moved to Personal Space.')) {
      return;
    }

    try {
      await deleteWorkspaceFolder(folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setProjectsList((prev) =>
        prev.map((p) => (p.folderId === folderId ? { ...p, folderId: null } : p))
      );
      if (activeView === folderId) {
        setActiveView('all');
      }
    } catch (err) {
      console.error('Failed to delete folder:', err);
    }
  };

  // Timeline Operations
  const handleCreateTimelineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onCreateTimeline(
      newTitle.trim(),
      selectedFolderForNewTimeline || undefined,
      newStartDate
    );
    setIsCreateTimelineModalOpen(false);
    setNewTitle('');
    setNewStartDate(new Date().toISOString().split('T')[0]);
    setSelectedFolderForNewTimeline('');
  };

  const handleRenameProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingProject || !renameProjectTitle.trim()) return;

    try {
      await renameWorkspaceProject(renamingProject.id, renameProjectTitle.trim());
      setProjectsList((prev) =>
        prev.map((p) =>
          p.id === renamingProject.id || p.slug === renamingProject.id
            ? { ...p, title: renameProjectTitle.trim() }
            : p
        )
      );
    } catch (err) {
      console.error('Failed to rename timeline:', err);
    } finally {
      setRenamingProject(null);
      setRenameProjectTitle('');
    }
  };

  const handleMoveTimelineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movingProject) return;

    const targetFolderId = selectedDestinationFolder || null;
    try {
      await moveWorkspaceProject(movingProject.id, targetFolderId);
      setProjectsList((prev) =>
        prev.map((p) =>
          p.id === movingProject.id || p.slug === movingProject.id
            ? { ...p, folderId: targetFolderId }
            : p
        )
      );
      if (targetFolderId) {
        setExpandedFolders((prev) => ({ ...prev, [targetFolderId]: true }));
      }
    } catch (err) {
      console.error('Failed to move timeline:', err);
    } finally {
      setMovingProject(null);
      setSelectedDestinationFolder('');
    }
  };

  const handleTrashTimeline = async (projectId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      await trashWorkspaceProject(projectId);
      setProjectsList((prev) =>
        prev.map((p) => (p.id === projectId || p.slug === projectId ? { ...p, isTrashed: true } : p))
      );
    } catch (err) {
      console.error('Failed to trash timeline:', err);
    }
  };

  const handleRestoreTimeline = async (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await restoreWorkspaceProject(projectId);
      setProjectsList((prev) =>
        prev.map((p) => (p.id === projectId || p.slug === projectId ? { ...p, isTrashed: false } : p))
      );
    } catch (err) {
      console.error('Failed to restore timeline:', err);
    }
  };

  const handleDeletePermanently = async (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Permanently delete this timeline? This action cannot be undone.')) return;
    try {
      await deleteWorkspaceProjectPermanently(projectId);
      setProjectsList((prev) => prev.filter((p) => p.id !== projectId && p.slug !== projectId));
    } catch (err) {
      console.error('Failed to delete timeline permanently:', err);
    }
  };

  const handleEmptyTrash = async () => {
    if (!confirm('Are you sure you want to permanently delete all items in the Trash?')) return;
    try {
      const trashed = projectsList.filter((p) => p.isTrashed);
      await Promise.all(trashed.map((p) => deleteWorkspaceProjectPermanently(p.id)));
      setProjectsList((prev) => prev.filter((p) => !p.isTrashed));
    } catch (err) {
      console.error('Failed to empty trash:', err);
    }
  };

  const handleCopyShareLink = async (slug: string) => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/t/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Filtered lists
  const activeProjects = projectsList.filter((p) => !p.isTrashed);
  const rootProjects = activeProjects.filter((p) => !p.folderId && !p.isShared);
  const sharedProjects = activeProjects.filter((p) => p.isShared);
  const trashedProjects = projectsList.filter((p) => p.isTrashed);

  // Projects displayed in the main grid
  let displayedProjects = (
    activeView === 'trash'
      ? trashedProjects
      : activeView === 'shared'
      ? sharedProjects
      : activeView === 'all'
      ? activeProjects
      : activeProjects.filter((p) => p.folderId === activeView)
  ).filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.clientName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (sortBy === 'alpha') {
    displayedProjects = [...displayedProjects].sort((a, b) => a.title.localeCompare(b.title));
  }

  const activeFolder = folders.find((f) => f.id === activeView);
  const userInitial = getInitials(currentUser?.name || 'User');

  return (
    <div className="flex h-screen w-full bg-[var(--background)] text-gray-900 font-sans antialiased overflow-hidden select-none">
      {/* LEFT SIDEBAR */}
      <aside className="w-72 min-w-[280px] bg-white border-r border-gray-200 flex flex-col justify-between shrink-0 select-none shadow-2xs">
        <div className="flex flex-col p-4 overflow-y-auto flex-1 gap-4">
          {/* Top Logo */}
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="w-7 h-7 rounded-xl bg-[#F59E0B] text-gray-950 font-black flex items-center justify-center text-xs shadow-xs">
              W
            </div>
            <span className="text-sm font-black tracking-wider uppercase text-gray-900">
              Weekline
            </span>
          </div>

          {/* Top Capsule Dashboard Button */}
          <div>
            <button
              type="button"
              onClick={() => setActiveView('all')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-2xs ${
                activeView === 'all'
                  ? 'bg-amber-50 text-amber-950 border border-amber-200'
                  : 'bg-gray-50/80 text-gray-700 hover:bg-gray-100 hover:text-gray-900 border border-gray-200/80'
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 ${activeView === 'all' ? 'text-[#D97706]' : 'text-gray-500'}`} />
              <span>Dashboard</span>
            </button>
          </div>

          {/* Tree Navigation: Personal Space */}
          <div className="flex flex-col gap-1">
            {/* Personal Root Node */}
            <div
              onClick={() => setPersonalExpanded(!personalExpanded)}
              className="flex items-center justify-between px-2 py-1.5 rounded-xl text-xs font-black text-gray-800 hover:bg-gray-100/70 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${personalExpanded ? '' : '-rotate-90'}`} />
                <User className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>Personal</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCreateFolderModalOpen(true);
                }}
                title="New Folder"
                className="p-1 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tree Branch with Left Guide Line */}
            {personalExpanded && (
              <div className="pl-3.5 ml-3 border-l-2 border-gray-100 flex flex-col gap-1 mt-0.5">
                {/* Folder Nodes */}
                {folders.map((folder) => {
                  const folderProjects = activeProjects.filter((p) => p.folderId === folder.id);
                  const isExpanded = expandedFolders[folder.id] ?? true;
                  const isSelected = activeView === folder.id;
                  const isMenuOpen = activeDropdownMenu === `folder-${folder.id}`;

                  return (
                    <div key={folder.id} className="flex flex-col relative">
                      {/* Folder Row */}
                      <div
                        onClick={() => setActiveView(folder.id)}
                        className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-50 text-gray-950 font-black border border-amber-200'
                            : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/80'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate flex-1">
                          <button
                            type="button"
                            onClick={(e) => toggleFolderExpand(folder.id, e)}
                            className="text-gray-400 hover:text-gray-900 p-0.5 cursor-pointer"
                          >
                            <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </button>
                          {isExpanded ? (
                            <FolderOpen className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                          ) : (
                            <FolderIcon className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                          )}
                          <span className="truncate">{folder.name}</span>
                        </div>

                        {/* Hover Action Menu Icons */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownMenu(isMenuOpen ? null : `folder-${folder.id}`);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-900 rounded-md hover:bg-gray-200/60 transition-opacity cursor-pointer"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Folder Context Dropdown Menu */}
                      {isMenuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-2 top-full mt-1 w-44 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-1.5 flex flex-col gap-0.5 animate-dropdown text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingFolder(folder);
                              setRenameFolderName(folder.name);
                              setActiveDropdownMenu(null);
                            }}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-gray-700 hover:bg-gray-100 font-semibold cursor-pointer"
                          >
                            <span>Rename</span>
                            <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFolderForNewTimeline(folder.id);
                              setIsCreateTimelineModalOpen(true);
                              setActiveDropdownMenu(null);
                            }}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-gray-700 hover:bg-gray-100 font-semibold cursor-pointer"
                          >
                            <span>New timeline</span>
                            <Plus className="w-3.5 h-3.5 text-gray-500" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveView(folder.id);
                              setActiveDropdownMenu(null);
                            }}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-gray-700 hover:bg-gray-100 font-semibold cursor-pointer"
                          >
                            <span>Open folder</span>
                            <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
                          </button>

                          <div className="h-px bg-gray-100 my-0.5" />

                          <button
                            type="button"
                            onClick={(e) => {
                              setActiveDropdownMenu(null);
                              handleDeleteFolder(folder.id, e);
                            }}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 font-semibold cursor-pointer"
                          >
                            <span>Delete</span>
                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          </button>
                        </div>
                      )}

                      {/* Nested Timelines in Tree */}
                      {isExpanded && folderProjects.length > 0 && (
                        <div className="pl-5 pr-1 py-0.5 flex flex-col gap-0.5 border-l border-gray-100 ml-3.5 mt-0.5">
                          {folderProjects.map((p) => (
                            <div
                              key={p.id}
                              className="group/item flex items-center justify-between px-2 py-1.5 rounded-xl text-[11px] font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer truncate"
                            >
                              <Link href={`/t/${p.slug}`} className="flex items-center gap-2 truncate flex-1">
                                <FileText className="w-3 h-3 text-gray-400 shrink-0" />
                                <span className="truncate">{p.title}</span>
                              </Link>

                              <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMovingProject(p);
                                    setSelectedDestinationFolder(p.folderId || '');
                                  }}
                                  title="Move to Folder"
                                  className="p-1 text-gray-400 hover:text-blue-600 rounded-md cursor-pointer"
                                >
                                  <FolderInput className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingProject(p);
                                    setRenameProjectTitle(p.title);
                                  }}
                                  title="Rename Timeline"
                                  className="p-1 text-gray-400 hover:text-amber-600 rounded-md cursor-pointer"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleTrashTimeline(p.id, e)}
                                  title="Move to Trash"
                                  className="p-1 text-gray-400 hover:text-rose-600 rounded-md cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Loose / Root Timelines (No Folder) */}
                {rootProjects.map((p) => (
                  <div
                    key={p.id}
                    className="group/item flex items-center justify-between px-2 py-1.5 rounded-xl text-xs font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer truncate"
                  >
                    <Link href={`/t/${p.slug}`} className="flex items-center gap-2 truncate flex-1">
                      <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{p.title}</span>
                    </Link>

                    <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMovingProject(p);
                          setSelectedDestinationFolder('');
                        }}
                        title="Move to Folder"
                        className="p-1 text-gray-400 hover:text-blue-600 rounded-md cursor-pointer"
                      >
                        <FolderInput className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingProject(p);
                          setRenameProjectTitle(p.title);
                        }}
                        title="Rename Timeline"
                        className="p-1 text-gray-400 hover:text-amber-600 rounded-md cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleTrashTimeline(p.id, e)}
                        title="Move to Trash"
                        className="p-1 text-gray-400 hover:text-rose-600 rounded-md cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Shared with you & Trash Bin */}
          <div className="flex flex-col gap-1 pt-2 border-t border-gray-100">
            {/* Shared with You */}
            <button
              type="button"
              onClick={() => setActiveView('shared')}
              className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeView === 'shared'
                  ? 'bg-amber-50 text-gray-900 font-black border border-amber-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className={`w-4 h-4 ${activeView === 'shared' ? 'text-[#D97706]' : 'text-gray-400'}`} />
                <span>Shared with you</span>
              </div>
              {sharedProjects.length > 0 && (
                <span className="text-[10px] font-bold text-gray-400">{sharedProjects.length}</span>
              )}
            </button>

            {/* Trash Bin */}
            <button
              type="button"
              onClick={() => setActiveView('trash')}
              className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeView === 'trash'
                  ? 'bg-rose-50 text-rose-900 font-black border border-rose-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Trash2 className={`w-4 h-4 ${activeView === 'trash' ? 'text-rose-600' : 'text-gray-400'}`} />
                <span>Trash Bin</span>
              </div>
              {trashedProjects.length > 0 && (
                <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-md">
                  {trashedProjects.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Theme & Preference Controls */}
        <div className="px-3 py-2.5 border-t border-gray-200 bg-gray-50/30 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Theme</span>
            <div className="flex items-center p-0.5 bg-gray-200/60 rounded-xl">
              <button
                type="button"
                onClick={() => setTheme('light')}
                title="Light Mode"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white text-[#D97706] shadow-xs font-black'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                title="Dark Mode"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-white text-amber-400 shadow-xs font-black'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTheme('system')}
                title="Follow System Theme"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  theme === 'system'
                    ? 'bg-white text-[#D97706] shadow-xs font-black'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Density</span>
            <button
              type="button"
              onClick={toggleDensity}
              title={`Switch to ${density === 'default' ? 'Compact' : 'Default'} Density`}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-[11px] transition-colors cursor-pointer"
            >
              {density === 'compact' ? (
                <>
                  <Minimize2 className="w-3 h-3 text-[#D97706]" />
                  <span>Compact</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3 h-3 text-gray-500" />
                  <span>Default</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* User Profile Card with Sign Out */}
        <div className="p-3 border-t border-gray-200 bg-gray-50/50">
          <div className="flex items-center justify-between p-2 rounded-2xl bg-white border border-gray-200/80 shadow-2xs">
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-8 h-8 rounded-xl bg-gray-900 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                {userInitial}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs font-bold text-gray-900 truncate">
                  {currentUser?.name || 'User'}
                </span>
                <span className="text-[10px] text-gray-500 truncate">
                  {currentUser?.email || ''}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={signOut}
              title="Sign Out"
              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[var(--background)]">
        {/* Top Header Bar */}
        <header className="min-h-16 py-3 border-b border-gray-200 bg-white px-6 md:px-8 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#F59E0B]" />
                <h1 className="text-base md:text-lg font-black text-gray-900 tracking-tight">
                  {activeView === 'trash'
                    ? 'Trash Bin'
                    : activeView === 'shared'
                    ? 'Shared with you'
                    : activeFolder
                    ? activeFolder.name
                    : 'Personal space'}
                </h1>
              </div>
              <span className="text-xs text-gray-500 font-semibold mt-0.5">
                {activeView === 'trash'
                  ? `${trashedProjects.length} trashed timelines`
                  : `${displayedProjects.length} timelines · ${folders.length} folders`}
              </span>
            </div>
          </div>

          {/* Top Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            {activeView === 'trash' ? (
              trashedProjects.length > 0 && (
                <button
                  type="button"
                  onClick={handleEmptyTrash}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Empty Trash</span>
                </button>
              )
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFolderForNewTimeline(activeFolder ? activeFolder.id : '');
                    setIsCreateTimelineModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 font-black text-xs rounded-xl transition-all shadow-md shadow-[#F59E0B]/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>New timeline</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCreateFolderModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold text-xs rounded-xl border border-gray-200 transition-all cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4 text-gray-600" />
                  <span>New folder</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Workspace Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto flex flex-col gap-7">
            {/* Search, Filter & Sort Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search timelines by title or client..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-gray-900 placeholder:text-gray-400 focus:border-[#F59E0B] focus:outline-none shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-auto">
                {/* Custom Active View Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsViewDropdownOpen(!isViewDropdownOpen);
                      setIsSortDropdownOpen(false);
                    }}
                    className="inline-flex items-center justify-between gap-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:border-[#F59E0B] shadow-2xs cursor-pointer min-w-[140px]"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {activeView === 'all' && <FolderOpen className="w-3.5 h-3.5 text-[#D97706] shrink-0" />}
                      {activeView === 'shared' && <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                      {activeView === 'trash' && <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                      {!['all', 'shared', 'trash'].includes(activeView) && (
                        <FolderIcon className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                      )}
                      <span className="truncate">
                        {activeView === 'all' && 'All files'}
                        {activeView === 'shared' && 'Shared with you'}
                        {activeView === 'trash' && 'Trash Bin'}
                        {!['all', 'shared', 'trash'].includes(activeView) &&
                          (folders.find((f) => f.id === activeView)?.name || 'Folder')}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform duration-200 ${
                        isViewDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isViewDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsViewDropdownOpen(false)}
                      />
                      <div className="absolute left-0 mt-1.5 w-52 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-1.5 flex flex-col gap-0.5 animate-dropdown">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveView('all');
                            setIsViewDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            activeView === 'all' ? 'bg-amber-50 text-[#D97706]' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-[#D97706]" />
                            <span>All files</span>
                          </div>
                          {activeView === 'all' && <Check className="w-3.5 h-3.5 text-[#D97706]" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveView('shared');
                            setIsViewDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            activeView === 'shared' ? 'bg-amber-50 text-[#D97706]' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-blue-600" />
                            <span>Shared with you</span>
                          </div>
                          {activeView === 'shared' && <Check className="w-3.5 h-3.5 text-[#D97706]" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveView('trash');
                            setIsViewDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            activeView === 'trash' ? 'bg-amber-50 text-[#D97706]' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Trash2 className="w-4 h-4 text-rose-600" />
                            <span>Trash Bin</span>
                          </div>
                          {activeView === 'trash' && <Check className="w-3.5 h-3.5 text-[#D97706]" />}
                        </button>

                        {folders.length > 0 && (
                          <div className="my-1 border-t border-gray-100" />
                        )}

                        {folders.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              setActiveView(f.id);
                              setIsViewDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                              activeView === f.id ? 'bg-amber-50 text-[#D97706]' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <FolderIcon className="w-4 h-4 text-[#F59E0B] shrink-0" />
                              <span className="truncate">{f.name}</span>
                            </div>
                            {activeView === f.id && <Check className="w-3.5 h-3.5 text-[#D97706] shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Custom Sort Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSortDropdownOpen(!isSortDropdownOpen);
                      setIsViewDropdownOpen(false);
                    }}
                    className="inline-flex items-center justify-between gap-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:border-[#F59E0B] shadow-2xs cursor-pointer min-w-[130px]"
                  >
                    <span className="truncate">
                      {sortBy === 'modified' ? 'Last modified' : 'Alphabetical'}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform duration-200 ${
                        isSortDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isSortDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsSortDropdownOpen(false)}
                      />
                      <div className="absolute right-0 mt-1.5 w-44 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-1.5 flex flex-col gap-0.5 animate-dropdown">
                        <button
                          type="button"
                          onClick={() => {
                            setSortBy('modified');
                            setIsSortDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            sortBy === 'modified' ? 'bg-amber-50 text-[#D97706]' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span>Last modified</span>
                          {sortBy === 'modified' && <Check className="w-3.5 h-3.5 text-[#D97706]" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSortBy('alpha');
                            setIsSortDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            sortBy === 'alpha' ? 'bg-amber-50 text-[#D97706]' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span>Alphabetical</span>
                          {sortBy === 'alpha' && <Check className="w-3.5 h-3.5 text-[#D97706]" />}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center bg-white border border-gray-200 rounded-xl p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      viewMode === 'grid'
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-400 hover:text-gray-900'
                    }`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      viewMode === 'list'
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-400 hover:text-gray-900'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* FOLDERS HORIZONTAL CARDS SECTION */}
            {activeView !== 'trash' && activeView !== 'shared' && folders.length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                  Folders ({folders.length})
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {folders.map((folder) => {
                    const count = activeProjects.filter((p) => p.folderId === folder.id).length;
                    const isSelected = activeView === folder.id;

                    return (
                      <div
                        key={folder.id}
                        onClick={() => setActiveView(isSelected ? 'all' : folder.id)}
                        className={`group relative flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-md ${
                          isSelected
                            ? 'bg-amber-50/70 border-[#F59E0B] shadow-amber-500/10'
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 truncate">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-[#D97706] flex items-center justify-center shrink-0">
                            <FolderIcon className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col truncate">
                            <span className="text-xs font-black text-gray-900 truncate">
                              {folder.name}
                            </span>
                            <span className="text-[11px] font-semibold text-gray-400">
                              {count} {count === 1 ? 'timeline' : 'timelines'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingFolder(folder);
                              setRenameFolderName(folder.name);
                            }}
                            title="Rename Folder"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteFolder(folder.id, e)}
                            title="Delete Folder"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TIMELINES SECTION */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                  {activeView === 'trash'
                    ? 'Trashed Timelines'
                    : activeView === 'shared'
                    ? 'Shared Timelines'
                    : 'Timelines'}{' '}
                  ({displayedProjects.length})
                </span>

                {displayedProjects.length > 0 && activeView === 'all' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Move all displayed timelines to Trash?')) {
                        displayedProjects.forEach((p) => handleTrashTimeline(p.id));
                      }
                    }}
                    className="text-xs font-bold text-gray-400 hover:text-gray-900 cursor-pointer"
                  >
                    Select all
                  </button>
                )}
              </div>

              {displayedProjects.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-300 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400">
                    {activeView === 'trash' ? (
                      <Trash2 className="w-6 h-6" />
                    ) : activeView === 'shared' ? (
                      <Users className="w-6 h-6" />
                    ) : (
                      <Calendar className="w-6 h-6" />
                    )}
                  </div>
                  <h3 className="text-sm font-black text-gray-900">
                    {activeView === 'trash'
                      ? 'Trash is empty'
                      : activeView === 'shared'
                      ? 'No shared timelines yet'
                      : 'No timelines found'}
                  </h3>
                  <p className="text-xs text-gray-500 max-w-sm">
                    {activeView === 'trash'
                      ? 'Deleted timelines will appear here and can be restored anytime.'
                      : activeView === 'shared'
                      ? 'When someone shares a timeline link with you, it will appear here.'
                      : 'Create your first sprint delivery schedule to map out work streams, deliverables, and milestones.'}
                  </p>
                  {activeView !== 'trash' && activeView !== 'shared' && (
                    <button
                      type="button"
                      onClick={() => setIsCreateTimelineModalOpen(true)}
                      className="mt-2 px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 font-black text-xs rounded-xl transition-all shadow-md shadow-[#F59E0B]/20 cursor-pointer"
                    >
                      Create Timeline
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'
                      : 'flex flex-col gap-3'
                  }
                >
                  {displayedProjects.map((proj) => {
                    const isDropdownOpen = activeDropdownMenu === `project-${proj.id}`;

                    if (proj.isTrashed) {
                      return (
                        <div
                          key={proj.id}
                          className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-2xs opacity-80 hover:opacity-100 transition-opacity"
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                In Trash
                              </span>
                            </div>
                            <h3 className="text-sm font-black text-gray-900 leading-snug line-through text-gray-500">
                              {proj.title}
                            </h3>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                            <button
                              type="button"
                              onClick={(e) => handleRestoreTimeline(proj.id, e)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Restore</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleDeletePermanently(proj.id, e)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={proj.id}
                        onClick={() => router.push(`/t/${proj.slug}`)}
                        className="group relative bg-white hover:border-[#F59E0B]/60 border border-gray-200 rounded-2xl p-4 flex flex-col justify-between gap-3.5 transition-all shadow-2xs hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                      >
                        {/* Visual Canvas Mockup Box */}
                        <div className="w-full h-36 bg-gray-50/80 border border-gray-100 rounded-xl p-3 flex flex-col justify-between overflow-hidden relative group-hover:bg-amber-50/20 transition-colors">
                          <div className="flex items-center gap-1.5">
                            <div className="w-10 h-2 rounded-full bg-amber-400/60" />
                            <div className="w-14 h-2 rounded-full bg-blue-400/60" />
                            <div className="w-12 h-2 rounded-full bg-rose-400/60" />
                          </div>
                          <div className="flex items-center gap-1.5 pl-8">
                            <div className="w-16 h-2 rounded-full bg-purple-400/60" />
                            <div className="w-10 h-2 rounded-full bg-emerald-400/60" />
                          </div>
                          <div className="flex items-center gap-1.5 pl-4">
                            <div className="w-12 h-2 rounded-full bg-amber-400/60" />
                            <div className="w-20 h-2 rounded-full bg-blue-400/60" />
                          </div>
                          <div className="flex items-center gap-1.5 pl-12">
                            <div className="w-14 h-2 rounded-full bg-rose-400/60" />
                            <div className="w-8 h-2 rounded-full bg-emerald-400/60" />
                          </div>
                        </div>

                        {/* Title and Metadata */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col truncate">
                            <h3 className="text-sm font-black text-gray-900 group-hover:text-[#D97706] transition-colors leading-snug truncate">
                              {proj.title}
                            </h3>
                            <span className="text-[11px] font-semibold text-gray-400 mt-0.5">
                              {proj.clientName ? `${proj.clientName} · ` : ''}Active schedule
                            </span>
                          </div>

                          {/* 3-Dots Context Menu Action */}
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveDropdownMenu(isDropdownOpen ? null : `project-${proj.id}`)
                              }
                              className="p-1 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-1.5 flex flex-col gap-0.5 animate-dropdown text-xs">
                                <button
                                  type="button"
                                  onClick={() => router.push(`/t/${proj.slug}`)}
                                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-gray-700 hover:bg-gray-100 font-semibold cursor-pointer"
                                >
                                  <span>Open</span>
                                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setMovingProject(proj);
                                    setSelectedDestinationFolder(proj.folderId || '');
                                    setActiveDropdownMenu(null);
                                  }}
                                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-gray-700 hover:bg-gray-100 font-semibold cursor-pointer"
                                >
                                  <span>Move to folder...</span>
                                  <FolderInput className="w-3.5 h-3.5 text-blue-500" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setRenamingProject(proj);
                                    setRenameProjectTitle(proj.title);
                                    setActiveDropdownMenu(null);
                                  }}
                                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-gray-700 hover:bg-gray-100 font-semibold cursor-pointer"
                                >
                                  <span>Rename</span>
                                  <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSharingProject(proj);
                                    setActiveDropdownMenu(null);
                                  }}
                                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-gray-700 hover:bg-gray-100 font-semibold cursor-pointer"
                                >
                                  <span>Share link</span>
                                  <Share2 className="w-3.5 h-3.5 text-blue-500" />
                                </button>

                                <div className="h-px bg-gray-100 my-0.5" />

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    setActiveDropdownMenu(null);
                                    handleTrashTimeline(proj.id, e);
                                  }}
                                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 font-semibold cursor-pointer"
                                >
                                  <span>Move to trash</span>
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* MOVE TO FOLDER MODAL */}
      {movingProject && (
        <div
          onClick={() => setMovingProject(null)}
          className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-dropdown flex flex-col gap-4"
          >
            <div>
              <h3 className="text-lg font-black text-gray-900">Move Timeline to Folder</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Select a destination folder for &quot;{movingProject.title}&quot;
              </p>
            </div>

            <form onSubmit={handleMoveTimelineSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                {/* No folder / Personal space option */}
                <div
                  onClick={() => setSelectedDestinationFolder('')}
                  className={`flex items-center justify-between p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                    selectedDestinationFolder === ''
                      ? 'bg-amber-50/80 border-[#F59E0B] text-gray-950 shadow-2xs'
                      : 'bg-gray-50/60 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <User className="w-4 h-4 text-[#F59E0B]" />
                    <span>Personal Space (No folder)</span>
                  </div>
                  {selectedDestinationFolder === '' && <Check className="w-4 h-4 text-[#D97706]" />}
                </div>

                {/* Folder options */}
                {folders.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedDestinationFolder(f.id)}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                      selectedDestinationFolder === f.id
                        ? 'bg-amber-50/80 border-[#F59E0B] text-gray-950 shadow-2xs'
                        : 'bg-gray-50/60 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FolderIcon className="w-4 h-4 text-[#F59E0B]" />
                      <span>{f.name}</span>
                    </div>
                    {selectedDestinationFolder === f.id && <Check className="w-4 h-4 text-[#D97706]" />}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setMovingProject(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 text-xs font-black rounded-xl cursor-pointer shadow-sm shadow-[#F59E0B]/20"
                >
                  Move Timeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME FOLDER MODAL */}
      {renamingFolder && (
        <div
          onClick={() => setRenamingFolder(null)}
          className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-dropdown flex flex-col gap-4"
          >
            <h3 className="text-lg font-black text-gray-900">Rename Folder</h3>
            <form onSubmit={handleRenameFolderSubmit} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-[11px] font-black uppercase text-gray-700 mb-1.5">
                  Folder Name
                </label>
                <input
                  autoFocus
                  type="text"
                  required
                  value={renameFolderName}
                  onChange={(e) => setRenameFolderName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:bg-white focus:border-[#F59E0B] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRenamingFolder(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 text-xs font-black rounded-xl cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME TIMELINE MODAL */}
      {renamingProject && (
        <div
          onClick={() => setRenamingProject(null)}
          className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-dropdown flex flex-col gap-4"
          >
            <h3 className="text-lg font-black text-gray-900">Rename Timeline</h3>
            <form onSubmit={handleRenameProjectSubmit} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-[11px] font-black uppercase text-gray-700 mb-1.5">
                  Timeline Title
                </label>
                <input
                  autoFocus
                  type="text"
                  required
                  value={renameProjectTitle}
                  onChange={(e) => setRenameProjectTitle(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:bg-white focus:border-[#F59E0B] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRenamingProject(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 text-xs font-black rounded-xl cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHARE MODAL */}
      {sharingProject && (
        <div
          onClick={() => setSharingProject(null)}
          className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-dropdown flex flex-col gap-4"
          >
            <h3 className="text-lg font-black text-gray-900">Share Timeline</h3>
            <p className="text-xs text-gray-500">
              Anyone with this link can view or collaborate on this sprint schedule.
            </p>

            <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-700">
                Shareable Link
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-700 truncate font-mono bg-white border border-gray-200 px-3 py-1.5 rounded-xl flex-1">
                  {typeof window !== 'undefined' ? `${window.location.origin}/t/${sharingProject.slug}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyShareLink(sharingProject.slug)}
                  className="px-3.5 py-1.5 bg-[#F59E0B] text-gray-950 font-black text-xs rounded-xl cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setSharingProject(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE FOLDER MODAL */}
      {isCreateFolderModalOpen && (
        <div
          onClick={() => setIsCreateFolderModalOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-dropdown flex flex-col gap-4"
          >
            <h3 className="text-lg font-black text-gray-900">Create New Folder</h3>
            <p className="text-xs text-gray-500">
              Group your sprint schedules by project category or client.
            </p>
            <form onSubmit={handleCreateFolder} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-[11px] font-black uppercase text-gray-700 mb-1.5">
                  Folder Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Client Deliverables Q4"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:bg-white focus:border-[#F59E0B] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCreateFolderModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 text-xs font-black rounded-xl cursor-pointer"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE TIMELINE MODAL */}
      {isCreateTimelineModalOpen && (
        <div
          onClick={() => setIsCreateTimelineModalOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-dropdown flex flex-col gap-4"
          >
            <h3 className="text-lg font-black text-gray-900">Create New Sprint Timeline</h3>
            <p className="text-xs text-gray-500">
              Initialize a multi-week delivery schedule for your team.
            </p>
            <form onSubmit={handleCreateTimelineSubmit} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-[11px] font-black uppercase text-gray-700 mb-1.5">
                  Timeline Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master Delivery Schedule"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:bg-white focus:border-[#F59E0B] focus:outline-none"
                />
              </div>

              {/* Assign to Folder */}
              <div className="relative">
                <label className="block text-[11px] font-black uppercase text-gray-700 mb-1.5">
                  Assign to Folder (Optional)
                </label>
                <button
                  type="button"
                  onClick={() => setIsNewTimelineFolderDropdownOpen(!isNewTimelineFolderDropdownOpen)}
                  className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:bg-white focus:border-[#F59E0B] focus:outline-none cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 truncate">
                    {selectedFolderForNewTimeline ? (
                      <>
                        <FolderIcon className="w-4 h-4 text-[#F59E0B] shrink-0" />
                        <span className="truncate">
                          {folders.find((f) => f.id === selectedFolderForNewTimeline)?.name || 'Folder'}
                        </span>
                      </>
                    ) : (
                      <>
                        <User className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="text-gray-500">No Folder (Personal Space)</span>
                      </>
                    )}
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform duration-200 ${
                      isNewTimelineFolderDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isNewTimelineFolderDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsNewTimelineFolderDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-1.5 flex flex-col gap-0.5 animate-dropdown max-h-48 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFolderForNewTimeline('');
                          setIsNewTimelineFolderDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          selectedFolderForNewTimeline === '' ? 'bg-amber-50 text-[#D97706]' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span>No Folder (Personal Space)</span>
                        </div>
                        {selectedFolderForNewTimeline === '' && <Check className="w-3.5 h-3.5 text-[#D97706]" />}
                      </button>

                      {folders.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setSelectedFolderForNewTimeline(f.id);
                            setIsNewTimelineFolderDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            selectedFolderForNewTimeline === f.id ? 'bg-amber-50 text-[#D97706]' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FolderIcon className="w-4 h-4 text-[#F59E0B] shrink-0" />
                            <span className="truncate">{f.name}</span>
                          </div>
                          {selectedFolderForNewTimeline === f.id && <Check className="w-3.5 h-3.5 text-[#D97706] shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Start Date Picker */}
              <div>
                <label className="block text-[11px] font-black uppercase text-gray-700 mb-1.5">
                  Start Date (Which day does this timeline start?)
                </label>
                <input
                  type="date"
                  required
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:bg-white focus:border-[#F59E0B] focus:outline-none cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCreateTimelineModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 text-xs font-black rounded-xl cursor-pointer"
                >
                  Create Timeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
