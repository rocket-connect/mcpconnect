import { z } from "zod";

/**
 * Schema for API request headers
 */
export const APIHeadersSchema = z.record(z.string(), z.string());

export type APIHeaders = z.infer<typeof APIHeadersSchema>;

/**
 * Schema for API error response
 */
export const APIErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
  timestamp: z.date().optional(),
  path: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type APIError = z.infer<typeof APIErrorSchema>;

/**
 * Schema for API success response wrapper
 */
export const APIResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: APIErrorSchema.optional(),
  metadata: z
    .object({
      timestamp: z.date(),
      requestId: z.string().optional(),
      version: z.string().optional(),
      pagination: z
        .object({
          page: z.number().positive(),
          limit: z.number().positive(),
          total: z.number().nonnegative(),
          hasMore: z.boolean(),
        })
        .optional(),
    })
    .optional(),
});

export type APIResponse<T = unknown> = z.infer<typeof APIResponseSchema> & {
  data?: T;
};
