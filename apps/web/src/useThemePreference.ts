import { useEffect, useState } from "react";

export type ThemePreference = "light" | "dark";

const THEME_STORAGE_KEY = "formae-theme";

export function useThemePreference() {
  const [theme, setTheme] = useState<ThemePreference>(() =>
    readStoredThemePreference(),
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    globalThis.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return {
    theme,
    toggleTheme() {
      setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
    },
    setTheme,
  };
}

function readStoredThemePreference(): ThemePreference {
  const storedThemePreference =
    globalThis.localStorage.getItem(THEME_STORAGE_KEY);

  if (storedThemePreference === "dark" || storedThemePreference === "light") {
    return storedThemePreference;
  }

  if (
    globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches === true
  ) {
    return "dark";
  }

  return "light";
}
