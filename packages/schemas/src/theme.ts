import { z } from "zod";

/**
 * Schema for theme configuration
 */
export const ThemeSchema = z.enum(["light", "dark", "system"]);

export type Theme = z.infer<typeof ThemeSchema>;

/**
 * Schema for theme context
 */
export const ThemeContextSchema = z.object({
  theme: ThemeSchema,
  systemTheme: ThemeSchema.exclude(["system"]).optional(),
  resolvedTheme: ThemeSchema.exclude(["system"]),
});

export type ThemeContextType = z.infer<typeof ThemeContextSchema> & {
  toggleTheme?: () => void;
  setTheme?: (theme: Theme) => void;
};

/**
 * Schema for theme configuration settings
 */
export const ThemeConfigSchema = z.object({
  defaultTheme: ThemeSchema.default("system"),
  enableSystemTheme: z.boolean().default(true),
  storageKey: z.string().default("mcpconnect-theme"),
  colorScheme: z
    .object({
      light: z.record(z.string(), z.string()).optional(),
      dark: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  customColors: z.record(z.string(), z.string()).optional(),
  animations: z.boolean().default(true),
  reducedMotion: z.boolean().default(false),
});

export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;
