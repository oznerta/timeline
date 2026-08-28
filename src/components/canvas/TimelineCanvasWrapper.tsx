'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Lock, LogIn, ArrowLeft } from 'lucide-react';
import { TimelineCanvas } from './TimelineCanvas';
import { fetchTimelineData, persistTimelineData } from '@/lib/data-service';
import { TimelineData } from '@/types/timeline';
import { useAuth } from '@/context/AuthContext';

export function TimelineCanvasWrapper({ slug }: { slug: string }) {
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [restrictedError, setRestrictedError] = useState<{ isRestricted: boolean; projectTitle?: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const loaded = await fetchTimelineData(slug);
        if (!loaded || !loaded.project) {
          setNotFound(true);
        } else {
          setData(loaded);
        }
      } catch (err: any) {
        if (err?.isRestricted) {
          setRestrictedError({
            isRestricted: true,
            projectTitle: err.projectTitle,
          });
        } else {
          console.error('Failed to load timeline:', err);
          setNotFound(true);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading || isAuthLoading) {
    return (
      <div className="h-screen w-full bg-[var(--background)] flex flex-col items-center justify-center text-gray-500 text-xs font-bold gap-3 select-none">
        <div className="w-8 h-8 rounded-xl bg-[#F59E0B] text-gray-950 font-black flex items-center justify-center text-sm shadow-md animate-pulse">
          W
        </div>
        <span>Loading Weekline Schedule...</span>
      </div>
    );
  }

  // Not Found Screen
  if (notFound) {
    return (
      <div className="min-h-screen w-full bg-[var(--background)] flex flex-col items-center justify-center p-6 select-none">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 max-w-md w-full shadow-xl flex flex-col items-center text-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-[#D97706] font-black text-lg flex items-center justify-center shadow-xs">
            404
          </div>

          <div className="flex flex-col gap-1.5">
            <h2 className="text-lg font-black text-gray-900">Timeline Not Found</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              The timeline &quot;{slug}&quot; does not exist or has been removed.
            </p>
          </div>

          <div className="flex flex-col w-full gap-2.5 pt-2">
            <Link
              href="/dashboard"
              className="w-full py-2.5 px-4 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 font-black text-xs rounded-xl transition-all shadow-md shadow-[#F59E0B]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Go to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Restricted Access Verification
  const accessLevel = data?.project?.accessLevel || 'restricted';
  const isRestricted = accessLevel === 'restricted';

  let hasAccess = true;
  if (isRestricted && data) {
    const currentEmail = currentUser?.email?.toLowerCase();
    const currentUserId = currentUser?.id;
    const isOwner = Boolean(
      currentUserId &&
      data.project.userId &&
      currentUserId === data.project.userId
    );
    const isCollaborator = Boolean(
      currentEmail &&
      (data.collaborators || []).some(
        (c) => c.email.toLowerCase() === currentEmail
      )
    );

    if (!isOwner && !isCollaborator) {
      hasAccess = false;
    }
  }

  if (restrictedError?.isRestricted || !hasAccess) {
    const title = data?.project?.title || restrictedError?.projectTitle || slug;
    return (
      <div className="min-h-screen w-full bg-[var(--background)] flex flex-col items-center justify-center p-6 select-none">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 max-w-md w-full shadow-xl flex flex-col items-center text-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-[#D97706] flex items-center justify-center shadow-xs">
            <Lock className="w-6 h-6" />
          </div>

          <div className="flex flex-col gap-1.5">
            <h2 className="text-lg font-black text-gray-900">Access Restricted</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              &quot;{title}&quot; is private and only available to invited collaborators.
            </p>
            {currentUser?.email && (
              <p className="text-[11px] text-gray-400 mt-1">
                Signed in as <span className="font-bold text-gray-600">{currentUser.email}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col w-full gap-2.5 pt-2">
            <Link
              href={`/auth?redirect=/t/${slug}`}
              className="w-full py-2.5 px-4 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 font-black text-xs rounded-xl transition-all shadow-md shadow-[#F59E0B]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{currentUser ? 'Switch to authorized account' : 'Sign in to access'}</span>
            </Link>

            <Link
              href="/dashboard"
              className="w-full py-2.5 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl border border-gray-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <TimelineCanvas
      initialData={data}
      onSaveData={async (updated) => {
        await persistTimelineData(updated);
      }}
      slug={slug}
    />
  );
}
