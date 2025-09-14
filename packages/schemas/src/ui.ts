import { z } from "zod";

/**
 * Schema for UI component variants
 */
export const UIVariantSchema = z.enum([
  "primary",
  "secondary",
  "ghost",
  "outline",
]);

export type UIVariant = z.infer<typeof UIVariantSchema>;

/**
 * Schema for UI component sizes
 */
export const UISizeSchema = z.enum(["sm", "md", "lg", "xl"]);

export type UISize = z.infer<typeof UISizeSchema>;

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

/**
 * Schema for UI notification
 */
export const UINotificationSchema = z.object({
  id: z.string(),
  type: z.enum(["success", "error", "warning", "info"]),
  title: z.string(),
  message: z.string(),
  duration: z.number().positive().optional(),
  persistent: z.boolean().default(false),
  actions: z
    .array(
      z.object({
        label: z.string(),
        action: z.string(),
        variant: UIVariantSchema.optional(),
      })
    )
    .optional(),
  timestamp: z.date(),
});

export type UINotification = z.infer<typeof UINotificationSchema>;

/**
 * Schema for UI panel configuration
 */
export const UIPanelSchema = z.object({
  id: z.string(),
  title: z.string(),
  visible: z.boolean().default(true),
  collapsible: z.boolean().default(true),
  collapsed: z.boolean().default(false),
  position: z.enum(["left", "right", "top", "bottom", "center"]),
  size: z
    .object({
      width: z.number().optional(),
      height: z.number().optional(),
      minWidth: z.number().optional(),
      minHeight: z.number().optional(),
      maxWidth: z.number().optional(),
      maxHeight: z.number().optional(),
    })
    .optional(),
  resizable: z.boolean().default(false),
  scrollable: z.boolean().default(true),
});

export type UIPanel = z.infer<typeof UIPanelSchema>;

/**
 * Schema for UI layout configuration
 */
export const UILayoutSchema = z.object({
  mode: UILayoutModeSchema,
  panels: z.array(UIPanelSchema),
  sidebar: z.object({
    visible: z.boolean().default(true),
    width: z.number().default(320),
    collapsible: z.boolean().default(true),
    collapsed: z.boolean().default(false),
  }),
  inspector: z.object({
    visible: z.boolean().default(true),
    width: z.number().default(384),
    position: z.enum(["right", "bottom"]).default("right"),
    collapsible: z.boolean().default(true),
    collapsed: z.boolean().default(false),
  }),
  header: z.object({
    visible: z.boolean().default(true),
    height: z.number().default(64),
    sticky: z.boolean().default(true),
  }),
});

export type UILayout = z.infer<typeof UILayoutSchema>;
