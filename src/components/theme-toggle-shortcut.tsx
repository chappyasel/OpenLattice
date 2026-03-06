"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

/**
 * Global keyboard shortcut for toggling theme
 * Cmd+Option+L (Mac) or Ctrl+Alt+L (Windows/Linux)
 */
export function ThemeToggleShortcut() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isLKey = e.key?.toLowerCase() === "l" || e.code === "KeyL";
      const isMac = e.metaKey && e.altKey && !e.ctrlKey && !e.shiftKey;
      const isWindows = e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey;

      if (isLKey && (isMac || isWindows)) {
        e.preventDefault();
        e.stopPropagation();

        const currentTheme = theme === "system" ? "light" : theme;
        const newTheme = currentTheme === "light" ? "dark" : "light";
        setTheme(newTheme);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [theme, setTheme]);

  return null;
}
