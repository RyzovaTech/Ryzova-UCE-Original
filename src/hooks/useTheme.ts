import { useEffect, useState } from 'react';
import { loadSettings, saveSettings, type StoredSettings } from '@/lib/storage';

function getInitialTheme(): StoredSettings['theme'] {
  if (typeof window === 'undefined') return 'light';
  const settings = loadSettings();
  if (settings.theme) return settings.theme;
  if (window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<StoredSettings['theme']>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveSettings({ theme });
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return { theme, toggle };
}
