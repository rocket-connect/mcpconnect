import React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "./Button";
import { cn } from "./lib/utils";
import { Theme } from "@mcpconnect/schemas";

export interface ThemeToggleProps {
  theme?: Theme;
  onToggle?: (theme: Theme) => void;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  theme = "light",
  onToggle,
  className,
}) => {
  const handleToggle = () => {
    if (theme === "light") {
      onToggle?.("dark");
    } else if (theme === "dark") {
      onToggle?.("system");
    } else {
      onToggle?.("light");
    }
  };

  const isDark = theme === "dark";
  const isLight = theme === "light";
  const isSystem = theme === "system";

  const getAriaLabel = () => {
    if (isLight) return "Switch to dark theme";
    if (isDark) return "Switch to system theme";
    return "Switch to light theme";
  };

  const getTitle = () => {
    if (isLight) return "Light theme (click for dark)";
    if (isDark) return "Dark theme (click for system)";
    return "System theme (click for light)";
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      className={cn(
        "h-9 w-9 p-0 rounded-lg relative",
        "transition-all duration-200",
        "hover:bg-gray-100 dark:hover:bg-gray-700",
        "border-2 border-gray-300 dark:border-gray-600",
        "bg-white dark:bg-gray-800",
        "shadow-sm hover:shadow-md",
        "focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        className
      )}
      aria-label={getAriaLabel()}
      title={getTitle()}
    >
      {/* Light theme icon */}
      <Sun
        className={cn(
          "h-4 w-4 absolute inset-0 m-auto transition-all duration-300",
          "text-yellow-600 dark:text-yellow-500",
          isLight
            ? "rotate-0 scale-100 opacity-100"
            : "rotate-90 scale-0 opacity-0"
        )}
      />

      {/* Dark theme icon */}
      <Moon
        className={cn(
          "h-4 w-4 absolute inset-0 m-auto transition-all duration-300",
          "text-blue-600 dark:text-blue-400",
          isDark
            ? "rotate-0 scale-100 opacity-100"
            : "-rotate-90 scale-0 opacity-0"
        )}
      />

      {/* System theme icon */}
      <Monitor
        className={cn(
          "h-4 w-4 absolute inset-0 m-auto transition-all duration-300",
          "text-gray-600 dark:text-gray-400",
          isSystem
            ? "rotate-0 scale-100 opacity-100"
            : "rotate-90 scale-0 opacity-0"
        )}
      />
    </Button>
  );
};
