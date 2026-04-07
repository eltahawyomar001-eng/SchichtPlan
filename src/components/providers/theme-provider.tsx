"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => {},
});

const STORAGE_KEY = "shiftfy-theme";

/** Browser / PWA chrome colour per theme */
const THEME_COLORS = { light: "#059669", dark: "#18181b" } as const;

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const isFirstRender = useRef(true);

  // Sync DOM class + meta theme-color whenever theme changes
  // (skip first render for the class — inline script handles it)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // Ensure DOM matches state on hydration (the inline script may have
      // already set the class, but the React state might differ on SSR).
      document.documentElement.classList.toggle("dark", theme === "dark");
    } else {
      document.documentElement.classList.toggle("dark", theme === "dark");
      localStorage.setItem(STORAGE_KEY, theme);
    }

    // Update <meta name="theme-color"> so the browser / PWA chrome adapts
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", THEME_COLORS[theme]);
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
