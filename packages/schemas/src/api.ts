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

/**
 * Schema for paginated API response
 */
export const PaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    pagination: z.object({
      page: z.number().positive(),
      limit: z.number().positive(),
      total: z.number().nonnegative(),
      totalPages: z.number().nonnegative(),
      hasMore: z.boolean(),
      hasPrevious: z.boolean(),
    }),
  });

/**
 * Schema for API request with pagination
 */
export const PaginatedRequestSchema = z.object({
  page: z.number().positive().default(1),
  limit: z.number().positive().max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  filter: z.record(z.string(), z.unknown()).optional(),
});

export type PaginatedRequest = z.infer<typeof PaginatedRequestSchema>;

/**
 * Schema for bulk operation request
 */
export const BulkOperationSchema = z.object({
  operation: z.enum(["create", "update", "delete"]),
  items: z.array(z.record(z.string(), z.unknown())),
  options: z
    .object({
      continueOnError: z.boolean().default(false),
      batchSize: z.number().positive().default(100),
    })
    .optional(),
});

export type BulkOperation = z.infer<typeof BulkOperationSchema>;
