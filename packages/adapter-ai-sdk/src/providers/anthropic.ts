import { z } from "zod";
import { AISDKConfig } from "../ai-sdk-adapter";
import { createAnthropic } from "@ai-sdk/anthropic";

/**
 * Anthropic-specific configuration schema
 */
export const AnthropicConfigSchema = z.object({
  provider: z.literal("anthropic"),
  apiKey: z.string().min(1, "Anthropic API key is required"),
  baseUrl: z.string().url().optional(),
  model: z
    .enum([
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307",
      "claude-3-5-sonnet-latest",
      "claude-3-5-haiku-latest",
      "claude-3-opus-latest",
    ])
    .default("claude-3-5-sonnet-20241022"),
});

export type AnthropicConfig = z.infer<typeof AnthropicConfigSchema>;

/**
 * Anthropic provider factory function
 */
export class AnthropicProvider {
  static createConfig(
    config: Partial<AnthropicConfig> & { apiKey: string }
  ): AISDKConfig {
    console.log("AnthropicProvider.createConfig:", {
      hasApiKey: !!config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
    });

    const anthropicConfig = AnthropicConfigSchema.parse({
      provider: "anthropic" as const,
      ...config,
    });

    return {
      name: "anthropic-adapter",
      provider: "anthropic",
      model: anthropicConfig.model,
      apiKey: anthropicConfig.apiKey,
      baseUrl: anthropicConfig.baseUrl,
      temperature: 0.7,
      maxTokens: 4096,
      stream: false,
      timeout: 30000,
      retries: 3,
      debug: false,
      modelProvider: {
        type: "anthropic",
        model: anthropicConfig.model,
        config: anthropicConfig,
      },
    };
  }

  /**
   * Get available Anthropic models
   */
  static getAvailableModels(): Array<{
    value: string;
    label: string;
    description?: string;
  }> {
    return [
      {
        value: "claude-3-5-sonnet-20241022",
        label: "Claude 3.5 Sonnet",
        description: "Most capable model for complex tasks",
      },
      {
        value: "claude-3-5-haiku-20241022",
        label: "Claude 3.5 Haiku",
        description: "Fast and efficient for simple tasks",
      },
      {
        value: "claude-3-opus-20240229",
        label: "Claude 3 Opus",
        description: "Powerful model for demanding tasks",
      },
      {
        value: "claude-3-sonnet-20240229",
        label: "Claude 3 Sonnet",
        description: "Balanced performance and speed",
      },
      {
        value: "claude-3-haiku-20240307",
        label: "Claude 3 Haiku",
        description: "Quick responses for simple tasks",
      },
      {
        value: "claude-3-5-sonnet-latest",
        label: "Claude 3.5 Sonnet (Latest)",
        description: "Latest version of Claude 3.5 Sonnet",
      },
      {
        value: "claude-3-5-haiku-latest",
        label: "Claude 3.5 Haiku (Latest)",
        description: "Latest version of Claude 3.5 Haiku",
      },
      {
        value: "claude-3-opus-latest",
        label: "Claude 3 Opus (Latest)",
        description: "Latest version of Claude 3 Opus",
      },
    ];
  }

  /**
   * Test API key validity with CORS headers
   */
  static async testApiKey(apiKey: string, baseUrl?: string): Promise<boolean> {
    try {
      console.log("Testing Anthropic API key with CORS headers...", {
        hasApiKey: !!apiKey,
        hasBaseUrl: !!baseUrl,
        baseUrl: baseUrl || "default",
      });

      // Create the provider with CORS-friendly configuration
      const anthropicProvider = createAnthropic({
        apiKey,
        // Use the provided baseUrl or fall back to Anthropic's default
        ...(baseUrl && { baseURL: baseUrl }),
        // Add headers for direct browser access
        headers: {
          "anthropic-dangerous-direct-browser-access": "true",
          "Content-Type": "application/json",
        },
        // Additional fetch options for CORS
        fetch: (url, options) => {
          return fetch(url, {
            ...options,
            mode: "cors",
            credentials: "omit",
            headers: {
              ...options?.headers,
              "anthropic-dangerous-direct-browser-access": "true",
              "Content-Type": "application/json",
            },
          });
        },
      });

      // Get a model instance - use the smallest/fastest model for testing
      const model = anthropicProvider("claude-3-haiku-20240307");

      // Make a minimal test request using the AI SDK v5 generateText function
      const { generateText } = await import("ai");

      console.log("Making test API call to Anthropic with CORS headers...");

      const result = await generateText({
        model,
        messages: [{ role: "user", content: "Hi" }],
        maxOutputTokens: 1,
      });

      console.log("Anthropic API test successful:", {
        hasText: !!result.text,
        usage: result.usage,
      });

      return true;
    } catch (error) {
      console.error("Anthropic API key test failed:", error);

      // Log more details about the error for debugging
      if (error instanceof Error) {
        console.error("Error details:", {
          name: error.name,
          message: error.message,
          // Check if it's a CORS error
          isCorsError:
            error.message.includes("CORS") || error.message.includes("Origin"),
        });
      }

      return false;
    }
  }

  /**
   * Create Anthropic provider with CORS configuration
   */
  static createProviderWithCors(apiKey: string, baseUrl?: string) {
    return createAnthropic({
      apiKey,
      ...(baseUrl && { baseURL: baseUrl }),
      // Essential header for direct browser access
      headers: {
        "anthropic-dangerous-direct-browser-access": "true",
        "Content-Type": "application/json",
      },
      // Custom fetch with CORS configuration
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          mode: "cors",
          credentials: "omit",
          headers: {
            ...options?.headers,
            "anthropic-dangerous-direct-browser-access": "true",
            "Content-Type": "application/json",
          },
        });
      },
    });
  }

  /**
   * Validate Anthropic API key format
   */
  static validateApiKey(apiKey: string): boolean {
    // Anthropic API keys start with "sk-ant-"
    return apiKey.startsWith("sk-ant-") && apiKey.length > 20;
  }

  /**
   * Get model pricing information (per 1M tokens)
   */
  static getModelPricing(
    model: string
  ): { input: number; output: number } | null {
    const pricing: Record<string, { input: number; output: number }> = {
      "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
      "claude-3-5-haiku-20241022": { input: 0.25, output: 1.25 },
      "claude-3-opus-20240229": { input: 15, output: 75 },
      "claude-3-sonnet-20240229": { input: 3, output: 15 },
      "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
      // Latest versions use same pricing as their dated counterparts
      "claude-3-5-sonnet-latest": { input: 3, output: 15 },
      "claude-3-5-haiku-latest": { input: 0.25, output: 1.25 },
      "claude-3-opus-latest": { input: 15, output: 75 },
    };

    return pricing[model] || null;
  }

  /**
   * Get model context limits
   */
  static getContextLimit(model: string): number {
    // Most Claude models support 200k context
    const limits: Record<string, number> = {
      "claude-3-5-sonnet-20241022": 200000,
      "claude-3-5-haiku-20241022": 200000,
      "claude-3-opus-20240229": 200000,
      "claude-3-sonnet-20240229": 200000,
      "claude-3-haiku-20240307": 200000,
      "claude-3-5-sonnet-latest": 200000,
      "claude-3-5-haiku-latest": 200000,
      "claude-3-opus-latest": 200000,
    };

    return limits[model] || 200000;
  }
}
