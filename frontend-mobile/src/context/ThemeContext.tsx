import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

export type ThemeKey = 'classic' | 'ocean' | 'midnight' | 'slate' | 'dark';

export type ThemePalette = {
  key: ThemeKey;
  label: string;
  description: string;
  colors: {
    screen: string;
    surface: string;
    surfaceMuted: string;
    border: string;
    primary: string;
    primarySoft: string;
    text: string;
    muted: string;
    inactive: string;
    /** Small uppercase labels on stat cards; brighter than `muted` on dark theme. */
    caption: string;
    headerBorder: string;
    shadow: string;
  };
};

export const THEME_STORAGE_KEY = 'app_theme';

const THEME_OPTIONS: ThemePalette[] = [
  {
    key: 'classic',
    label: 'Classic',
    description: 'Warm sand background with the original blue accent.',
    colors: {
      screen: '#F9F7F7',
      surface: '#FFFFFF',
      surfaceMuted: '#F3F1EB',
      border: '#DBE2EF',
      primary: '#123A5F',
      primarySoft: '#DBEAFE',
      text: '#0F172A',
      muted: '#64748B',
      inactive: '#94A3B8',
      caption: '#64748B',
      headerBorder: '#E6E1D8',
      shadow: 'rgba(18, 58, 95, 0.08)',
    },
  },
  {
    key: 'ocean',
    label: 'Ocean',
    description: 'Crisper whites with a deeper blue accent.',
    colors: {
      screen: '#F5FAFF',
      surface: '#FFFFFF',
      surfaceMuted: '#EEF5FF',
      border: '#D3E2F2',
      primary: '#0F4C81',
      primarySoft: '#DCEFFF',
      text: '#0F172A',
      muted: '#64748B',
      inactive: '#94A3B8',
      caption: '#64748B',
      headerBorder: '#D9E6F2',
      shadow: 'rgba(15, 76, 129, 0.08)',
    },
  },
  {
    key: 'midnight',
    label: 'Midnight',
    description: 'A darker navy accent while keeping the interface light.',
    colors: {
      screen: '#F8FAFC',
      surface: '#FFFFFF',
      surfaceMuted: '#EEF2F7',
      border: '#D7E0EA',
      primary: '#1F2A44',
      primarySoft: '#E0E8F5',
      text: '#0F172A',
      muted: '#64748B',
      inactive: '#94A3B8',
      caption: '#64748B',
      headerBorder: '#D8E1EA',
      shadow: 'rgba(31, 42, 68, 0.08)',
    },
  },
  {
    key: 'slate',
    label: 'Slate',
    description: 'Soft gray surfaces with a balanced slate accent.',
    colors: {
      screen: '#EEF2F7',
      surface: '#FFFFFF',
      surfaceMuted: '#E6EBF2',
      border: '#CBD5E1',
      primary: '#334155',
      primarySoft: '#E2E8F0',
      text: '#0F172A',
      muted: '#64748B',
      inactive: '#94A3B8',
      caption: '#64748B',
      headerBorder: '#CBD5E1',
      shadow: 'rgba(51, 65, 85, 0.08)',
    },
  },
  {
    key: 'dark',
    label: 'Dark',
    description: 'A true dark mode with a brighter blue accent.',
    colors: {
      screen: '#0B1220',
      surface: '#111827',
      surfaceMuted: '#1F2937',
      border: '#334155',
      primary: '#93C5FD',
      primarySoft: '#1E293B',
      text: '#F8FAFC',
      muted: '#94A3B8',
      inactive: '#64748B',
      caption: '#CBD5E1',
      headerBorder: '#1F2937',
      shadow: 'rgba(0, 0, 0, 0.32)',
    },
  },
];

type ThemeContextValue = {
  themeKey: ThemeKey;
  theme: ThemePalette;
  themeOptions: ThemePalette[];
  setThemeKey: (nextTheme: ThemeKey) => Promise<void>;
  isReady: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeKey(value: string | null): value is ThemeKey {
  return value === 'classic' || value === 'ocean' || value === 'midnight' || value === 'slate' || value === 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeKey, setThemeKeyState] = useState<ThemeKey>('classic');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;

    const loadTheme = async () => {
      try {
        const storedTheme = await SecureStore.getItemAsync(THEME_STORAGE_KEY);

        if (!active) {
          return;
        }

        if (isThemeKey(storedTheme)) {
          setThemeKeyState(storedTheme);
        }
      } finally {
        if (active) {
          setIsReady(true);
        }
      }
    };

    void loadTheme();

    return () => {
      active = false;
    };
  }, []);

  const setThemeKey = useCallback(async (nextTheme: ThemeKey) => {
    setThemeKeyState(nextTheme);
    await SecureStore.setItemAsync(THEME_STORAGE_KEY, nextTheme);
  }, []);

  const value = useMemo(
    () => ({
      themeKey,
      theme: THEME_OPTIONS.find((entry) => entry.key === themeKey) ?? THEME_OPTIONS[0],
      themeOptions: THEME_OPTIONS,
      setThemeKey,
      isReady,
    }),
    [isReady, setThemeKey, themeKey]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error('useAppTheme must be used inside ThemeProvider');
  }

  return value;
}