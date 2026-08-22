'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '@/types/timeline';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ success: boolean; requiresEmailConfirmation?: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        // Handle Supabase Email Confirmation URL Hash (#access_token=...&refresh_token=...)
        if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token=')) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (!error && data.session?.user) {
              // Clean the long hash string from URL
              window.history.replaceState(null, '', '/dashboard');
              const u: User = {
                id: data.session.user.id,
                email: data.session.user.email || '',
                name: data.session.user.user_metadata?.name || data.session.user.email?.split('@')[0] || 'User',
                avatarUrl: data.session.user.user_metadata?.avatar_url,
                createdAt: data.session.user.created_at,
              };
              setCurrentUser(u);
              setIsLoading(false);
              return;
            }
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const u: User = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            avatarUrl: session.user.user_metadata?.avatar_url,
            createdAt: session.user.created_at,
          };
          setCurrentUser(u);
          setIsLoading(false);
          return;
        }
      }

      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      console.warn('Session restoration failed:', e);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();

    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const u: User = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            avatarUrl: session.user.user_metadata?.avatar_url,
            createdAt: session.user.created_at,
          };
          setCurrentUser(u);
        }
        setIsLoading(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [restoreSession]);

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.toLowerCase().includes('email not confirmed')) {
            return {
              success: false,
              error: 'Your email has not been confirmed yet. Please check your inbox for the verification link (or disable "Confirm email" in Supabase Auth settings).',
            };
          }
          return { success: false, error: error.message };
        }
        if (data.user && data.session) {
          const u: User = {
            id: data.user.id,
            email: data.user.email || '',
            name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
            createdAt: data.user.created_at,
          };
          setCurrentUser(u);
          return { success: true };
        }
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Invalid email or password' };
      }

      setCurrentUser(data.user);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to sign in' };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    name: string
  ): Promise<{ success: boolean; requiresEmailConfirmation?: boolean; error?: string }> => {
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
          },
        });
        if (error) return { success: false, error: error.message };

        // If Supabase requires email verification, session is null
        if (data.user && !data.session) {
          return {
            success: false,
            requiresEmailConfirmation: true,
            error: 'Account created! Please check your email to confirm your account before signing in.',
          };
        }

        if (data.user && data.session) {
          const u: User = {
            id: data.user.id,
            email: data.user.email || '',
            name,
            createdAt: data.user.created_at,
          };
          setCurrentUser(u);
          return { success: true };
        }
      }

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to create account' };
      }

      setCurrentUser(data.user);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to create account' };
    }
  };

  const signOut = async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Sign out error:', e);
    } finally {
      setCurrentUser(null);
      window.location.href = '/auth';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
