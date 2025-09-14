import { z } from "zod";

/**
 * Base configuration schema that all adapters extend
 */
export const BaseConfigSchema = z.object({
  name: z.string().min(1, "Adapter name is required"),
  version: z.string().optional(),
  debug: z.boolean().default(false),
  timeout: z.number().positive().default(30000),
  retries: z.number().min(0).default(3),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type BaseConfig = z.infer<typeof BaseConfigSchema>;

/**
 * Adapter metadata schema
 */
export const AdapterMetadataSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  capabilities: z.array(z.string()),
  supportedVersions: z.array(z.string()).optional(),
  created: z.date(),
  lastModified: z.date(),
});

export type AdapterMetadata = z.infer<typeof AdapterMetadataSchema>;

/**
 * Adapter status enum
 */
export enum AdapterStatus {
  IDLE = "idle",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  PROCESSING = "processing",
  ERROR = "error",
  DISCONNECTED = "disconnected",
}

/**
 * Base adapter error class
 */
export class AdapterError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly cause?: Error;

  constructor(
    message: string,
    code: string = "ADAPTER_ERROR",
    details?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message);
    this.name = "AdapterError";
    this.code = code;
    this.details = details;
    this.cause = cause;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      stack: this.stack,
    };
  }
}
