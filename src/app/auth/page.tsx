'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowRight,
  Lock,
  Mail,
  User as UserIcon,
} from 'lucide-react';

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/dashboard';

  const { signIn, signUp, currentUser, isLoading } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!isLoading && currentUser) {
      router.push(redirectUrl);
    }
  }, [currentUser, isLoading, redirectUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const res = await signIn(email, password);
        if (!res.success) {
          setErrorMsg(res.error || 'Invalid email or password.');
          setLoading(false);
          return;
        }
      } else {
        const res = await signUp(email, password, name);
        if (res.requiresEmailConfirmation) {
          setInfoMsg(res.error || 'Account created! Please check your inbox for the verification link to confirm your account, then sign in.');
          setMode('signin');
          setPassword('');
          setLoading(false);
          return;
        }
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to create account.');
          setLoading(false);
          return;
        }
      }

      router.push(redirectUrl);
    } catch (err: any) {
      setErrorMsg(err?.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto my-auto bg-white border border-gray-200 rounded-3xl p-8 shadow-xl shadow-gray-200/50">
      {/* Switcher Tabs */}
      <div className="grid grid-cols-2 p-1 bg-gray-100 border border-gray-200 rounded-2xl mb-6">
        <button
          type="button"
          onClick={() => {
            setMode('signin');
            setErrorMsg(null);
            setInfoMsg(null);
          }}
          className={`py-2 text-xs font-black tracking-wider uppercase rounded-xl transition-all cursor-pointer ${
            mode === 'signin'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('signup');
            setErrorMsg(null);
            setInfoMsg(null);
          }}
          className={`py-2 text-xs font-black tracking-wider uppercase rounded-xl transition-all cursor-pointer ${
            mode === 'signup'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Create Account
        </button>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">
          {mode === 'signin' ? 'Sign in to Weekline' : 'Create your account'}
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          {mode === 'signin'
            ? 'Access your sprint delivery timelines and team schedules.'
            : 'Get started with clean, multi-week delivery schedules.'}
        </p>
      </div>

      {/* Info / Email Confirmation Alert */}
      {infoMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold mb-5 flex items-start gap-2 leading-relaxed">
          <span>{infoMsg}</span>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold mb-5 flex items-center gap-2">
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === 'signup' && (
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                placeholder="Alex Johnson"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-bold text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#F59E0B] focus:outline-none"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="email"
              required
              placeholder="alex@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-bold text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#F59E0B] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-bold text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#F59E0B] focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full py-3 bg-[#F59E0B] hover:bg-[#D97706] text-gray-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-[#F59E0B]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-gray-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default function AuthPage() {
  return (
    <main className="min-h-screen w-full bg-[#F8F9FA] text-gray-900 font-sans flex flex-col justify-between p-6 sm:p-10 select-none">
      {/* Top Brand */}
      <header className="flex items-center justify-between max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#F59E0B] text-gray-950 font-black flex items-center justify-center text-sm shadow-md">
            W
          </div>
          <span className="text-base font-black tracking-wider uppercase text-gray-900">
            Weekline
          </span>
        </div>
      </header>

      {/* Main Center Box */}
      <div className="w-full flex items-center justify-center py-8">
        <Suspense
          fallback={
            <div className="flex items-center justify-center p-8 text-gray-400 text-xs font-bold">
              Loading Auth Portal...
            </div>
          }
        >
          <AuthForm />
        </Suspense>
      </div>

      {/* Bottom Spacer (No Footer) */}
      <div className="h-6" />
    </main>
  );
}
