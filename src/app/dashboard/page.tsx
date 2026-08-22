'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { WeeklineDashboard } from '@/components/dashboard/WeeklineDashboard';
import { defaultTimelineData, createInitialTimeline } from '@/lib/default-data';
import { fetchTimelineData, persistTimelineData } from '@/lib/data-service';
import { TimelineData } from '@/types/timeline';
import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
  const router = useRouter();
  const { currentUser, isLoading: isAuthLoading } = useAuth();

  // Authentication Route Guard: Cannot visit dashboard if not logged in
  useEffect(() => {
    if (!isAuthLoading && !currentUser) {
      router.push('/auth');
    }
  }, [currentUser, isAuthLoading, router]);

  const handleCreateTimeline = async (
    title: string,
    folderId?: string,
    startDate?: string
  ) => {
    const rawSlug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'timeline';
    const uniqueSlug = `${rawSlug}-${Date.now().toString().slice(-4)}`;
    const starter = createInitialTimeline(title, uniqueSlug, startDate);
    if (currentUser?.id) {
      starter.project.userId = currentUser.id;
      starter.project.ownerName = currentUser.name;
      starter.project.ownerEmail = currentUser.email;
      const initials = (currentUser.name.trim().slice(0, 2) || 'PL').toUpperCase();
      starter.assignees = [
        {
          id: currentUser.id,
          projectId: starter.project.id,
          name: currentUser.name,
          initials,
          color: '#F59E0B',
        },
      ];
    }
    if (folderId) starter.project.folderId = folderId;
    await persistTimelineData(starter);
    router.push(`/t/${uniqueSlug}`);
  };

  if (isAuthLoading || (!currentUser && isAuthLoading)) {
    return (
      <div className="h-screen w-full bg-[#F8F9FA] flex flex-col items-center justify-center text-gray-500 text-xs font-bold gap-3 select-none">
        <div className="w-8 h-8 rounded-xl bg-[#F59E0B] text-gray-950 font-black flex items-center justify-center text-sm shadow-md animate-pulse">
          W
        </div>
        <span>Verifying Weekline session...</span>
      </div>
    );
  }

  if (!currentUser) {
    return null; // Route Guard redirects to /auth
  }

  return (
    <WeeklineDashboard
      timelineData={createInitialTimeline()}
      onCreateTimeline={handleCreateTimeline}
    />
  );
}
