'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

/**
 * Light/dark theme toggle. Flips the `dark` class on <html> (Tailwind
 * `darkMode: 'class'`) and persists the choice to localStorage. The initial
 * class is set pre-paint by the inline script in app/layout.tsx, so this only
 * has to read the already-applied state on mount to sync its icon.
 */
export function ThemeToggle({ label }: { label: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      /* storage unavailable — held for this session only */
    }
    setDark(next);
  };

  return (
    <button
      onClick={toggle}
      className="rounded-md p-2 text-gray-300 hover:bg-white/10 hover:text-white"
      title={label}
      aria-label={label}
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
