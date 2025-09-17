import { z } from "zod";

/**
 * Schema for UI layout mode
 */
export const UILayoutModeSchema = z.enum([
  "chat",
  "tools",
  "inspector",
  "split",
]);

export type UILayoutMode = z.infer<typeof UILayoutModeSchema>;
