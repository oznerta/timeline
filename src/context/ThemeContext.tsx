'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
type DensityMode = 'default' | 'compact';

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  density: DensityMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setDensity: (density: DensityMode) => void;
  toggleDensity: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'weekline_theme';
const DENSITY_STORAGE_KEY = 'weekline_density';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeClass(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  // Add transition class temporarily for smooth switching
  root.classList.add('theme-transition');
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  // Remove transition class after animation completes
  setTimeout(() => {
    root.classList.remove('theme-transition');
  }, 350);
}

function applyDensityClass(density: DensityMode) {
  const root = document.documentElement;
  if (density === 'compact') {
    root.classList.add('compact');
  } else {
    root.classList.remove('compact');
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [density, setDensityState] = useState<DensityMode>('default');
  const [mounted, setMounted] = useState(false);

  // Initialize from localStorage on mount
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      const savedDensity = localStorage.getItem(DENSITY_STORAGE_KEY) as DensityMode | null;

      const initialTheme = savedTheme || 'light';
      const initialDensity = savedDensity || 'default';

      setThemeState(initialTheme);
      setDensityState(initialDensity);

      const resolved = initialTheme === 'system' ? getSystemTheme() : initialTheme;
      setResolvedTheme(resolved);
      applyThemeClass(resolved);
      applyDensityClass(initialDensity);
    } catch (e) {
      // localStorage unavailable — use defaults
      applyThemeClass('light');
    }
    setMounted(true);
  }, []);

  // Listen for system theme changes when mode is 'system'
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const newResolved = e.matches ? 'dark' : 'light';
      setResolvedTheme(newResolved);
      applyThemeClass(newResolved);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (_) {}

    const resolved = newTheme === 'system' ? getSystemTheme() : newTheme;
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
  }, [resolvedTheme, setTheme]);

  const setDensity = useCallback((newDensity: DensityMode) => {
    setDensityState(newDensity);
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, newDensity);
    } catch (_) {}
    applyDensityClass(newDensity);
  }, []);

  const toggleDensity = useCallback(() => {
    const newDensity = density === 'default' ? 'compact' : 'default';
    setDensity(newDensity);
  }, [density, setDensity]);

  // Prevent flash of wrong theme before hydration
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        density,
        setTheme,
        toggleTheme,
        setDensity,
        toggleDensity,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
