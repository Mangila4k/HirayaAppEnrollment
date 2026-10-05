import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

export const LIGHT = {
  background: '#f5f7fb',
  card: '#ffffff',
  cardBorder: '#e3e8ef',
  text: '#0B2A4A',
  textMuted: '#6b7a90',
  chevron: '#b0bac9',
  dark: '#000000',
  light: '#ffffff',
};

export const DARK = {
  background: '#0f1419',
  card: '#1a2029',
  cardBorder: '#2a323d',
  text: '#f5f7fa',
  textMuted: '#8b95a5',
  chevron: '#4a5563',
  dark: '#000000',
  light: '#ffffff',
};

export const ACCENT_PRESETS = [
  { name: 'Blue', value: '#4A90E2' },
  { name: 'Green', value: '#4CD964' },
  { name: 'Orange', value: '#FF9500' },
  { name: 'Pink', value: '#FF2D78' },
  { name: 'Purple', value: '#AF52DE' },
  { name: 'Teal', value: '#00C7BE' },
  { name: 'Red', value: '#FF3B30' },
  { name: 'Yellow', value: '#FFCC00' },
];

type ThemeContextType = {
  isDark: boolean;
  setIsDark: (v: boolean) => void;
  primaryColor: string;
  setPrimaryColor: (v: string) => void;
  theme: typeof LIGHT;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDarkState] = useState(false);
  const [primaryColor, setPrimaryColorState] = useState('#4A90E2');

  useEffect(() => {
    AsyncStorage.multiGet(['theme', 'primaryColor']).then((values) => {
      const savedTheme = values.find((v) => v[0] === 'theme')?.[1];
      const savedColor = values.find((v) => v[0] === 'primaryColor')?.[1];
      if (savedTheme) setIsDarkState(savedTheme === 'dark');
      if (savedColor) setPrimaryColorState(savedColor);
    });
  }, []);

  const setIsDark = (v: boolean) => {
    setIsDarkState(v);
    AsyncStorage.setItem('theme', v ? 'dark' : 'light');
  };

  const setPrimaryColor = (v: string) => {
    setPrimaryColorState(v);
    AsyncStorage.setItem('primaryColor', v);
  };

  const theme = isDark ? DARK : LIGHT;

  return (
    <ThemeContext.Provider
      value={{ isDark, setIsDark, primaryColor, setPrimaryColor, theme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}