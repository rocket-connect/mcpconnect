import React, { createContext, useContext, useEffect, useState } from "react";
import { Theme, ThemeContextType } from "@mcpconnect/schemas";
import { LocalStorageAdapter } from "@mcpconnect/adapter-localstorage";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeAdapter] = useState(() => 
    new LocalStorageAdapter({
      name: "mcpconnect-theme-storage",
      provider: "localstorage",
      prefix: "mcpconnect:",
      debug: false,
      timeout: 30000,
      retries: 3,
      compression: false,
      encryption: false,
      autoCleanup: false,
      maxSize: 1024 * 1024, // 1MB for theme storage
      maxItemSize: 1024, // 1KB for theme data
      simulateAsync: false,
      cleanupInterval: 3600000, // 1 hour
    })
  );

  const [theme, setTheme] = useState<Theme>("dark"); // Default to dark
  const [systemTheme, setSystemTheme] = useState<Exclude<Theme, "system">>("dark");
  const [isInitialized, setIsInitialized] = useState(false);

  const resolvedTheme: Exclude<Theme, "system"> =
    theme === "system" ? systemTheme : theme;

  // Initialize adapter and load theme
  useEffect(() => {
    const initializeTheme = async () => {
      try {
        await themeAdapter.initialize();
        
        // Load saved theme
        const savedTheme = await themeAdapter.getTheme();
        if (savedTheme && ["light", "dark", "system"].includes(savedTheme)) {
          setTheme(savedTheme);
        } else {
          // Default to system preference or dark
          const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
          setTheme(prefersDark ? "dark" : "light");
        }
      } catch (error) {
        console.error("Failed to initialize theme storage:", error);
        // Fall back to system preference or dark
        const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
        setTheme(prefersDark ? "dark" : "light");
      } finally {
        setIsInitialized(true);
      }
    };

    initializeTheme();
  }, [themeAdapter]);

  // Monitor system theme changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    setSystemTheme(mediaQuery.matches ? "dark" : "light");

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  // Apply theme to document when resolved theme changes
  useEffect(() => {
    if (!isInitialized || typeof window === "undefined") return;

    const root = window.document.documentElement;

    // Remove existing theme classes
    root.classList.remove("light", "dark");

    // Add the resolved theme class
    root.classList.add(resolvedTheme);
  }, [resolvedTheme, isInitialized]);

  // Save theme when it changes (only after initialization)
  useEffect(() => {
    if (!isInitialized) return;

    const saveTheme = async () => {
      try {
        await themeAdapter.setTheme(theme);
      } catch (error) {
        console.error("Failed to save theme:", error);
      }
    };

    saveTheme();
  }, [theme, themeAdapter, isInitialized]);

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === "light") return "dark";
      if (prev === "dark") return "system";
      return "light"; // system -> light
    });
  };

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  const contextValue: ThemeContextType = {
    theme,
    systemTheme,
    resolvedTheme,
    setTheme: handleSetTheme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}