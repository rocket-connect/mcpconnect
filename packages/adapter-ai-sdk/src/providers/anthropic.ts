import { z } from "zod";
import { AISDKConfig } from "../ai-sdk-adapter";

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
    ];
  }

  /**
   * Test API key validity
   */
  static async testApiKey(apiKey: string, baseUrl?: string): Promise<boolean> {
    try {
      const url = baseUrl || "https://api.anthropic.com/v1/messages";

      // Make a minimal test request
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 1,
          messages: [{ role: "user", content: "Hi" }],
        }),
      });

      // Even if the request fails for other reasons, a 401 means invalid auth
      return response.status !== 401;
    } catch (error) {
      console.error("Anthropic API key test failed:", error);
      return false;
    }
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
    };

    return limits[model] || 200000;
  }

  /**
   * Get model capabilities
   */
  // eslint-disable-next-line no-unused-vars
  static getModelCapabilities(_model: string): {
    supportsImages: boolean;
    supportsTools: boolean;
    supportsSystemMessages: boolean;
  } {
    // All current Claude models support these features
    return {
      supportsImages: true,
      supportsTools: true,
      supportsSystemMessages: true,
    };
  }
}
