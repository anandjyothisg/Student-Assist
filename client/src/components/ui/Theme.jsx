import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.remove('light');
    root.style.colorScheme = 'dark';
  } else if (theme === 'light') {
    root.classList.add('light');
    root.style.colorScheme = 'light';
  } else {
    // system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.add('light');
      root.style.colorScheme = 'light';
    }
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  const isDark = theme === 'dark' || (
    theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen to system changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (newTheme) => {
    localStorage.setItem('theme', newTheme);
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return { theme: 'dark', setTheme: () => {}, toggleTheme: () => {}, isDark: true };
  }
  return context;
}
