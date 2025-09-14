import React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "./Button";
import { cn } from "./lib/utils";

export interface ThemeToggleProps {
  theme?: "light" | "dark";
  onToggle?: (theme: "light" | "dark") => void;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  theme = "light",
  onToggle,
  className,
}) => {
  const handleToggle = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    onToggle?.(newTheme);
  };

  const isDark = theme === "dark";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      className={cn(
        "h-8 w-8 p-0 rounded-full relative",
        "transition-all duration-200",
        "hover:bg-gray-100 dark:hover:bg-gray-700",
        "border border-gray-200 dark:border-gray-600",
        "bg-white dark:bg-gray-800",
        className
      )}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
    >
      <Sun
        className={cn(
          "h-4 w-4 absolute transition-all duration-300",
          "text-yellow-500",
          isDark
            ? "rotate-90 scale-0 opacity-0"
            : "rotate-0 scale-100 opacity-100"
        )}
      />
      <Moon
        className={cn(
          "h-4 w-4 absolute transition-all duration-300",
          "text-gray-700 dark:text-gray-300",
          isDark
            ? "rotate-0 scale-100 opacity-100"
            : "-rotate-90 scale-0 opacity-0"
        )}
      />
    </Button>
  );
};
