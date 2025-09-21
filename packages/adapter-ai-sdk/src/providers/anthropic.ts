import { z } from "zod";
import { AISDKConfig } from "../types";
import { createAnthropic } from "@ai-sdk/anthropic";

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

export class AnthropicProvider {
  static createConfig(
    config: Partial<AnthropicConfig> & { apiKey: string }
  ): AISDKConfig {
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

  static async testApiKey(apiKey: string, baseUrl?: string): Promise<boolean> {
    try {
      const anthropicProvider = createAnthropic({
        apiKey,
        ...(baseUrl && { baseURL: baseUrl }),
        headers: {
          "anthropic-dangerous-direct-browser-access": "true",
          "Content-Type": "application/json",
        },
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

      const model = anthropicProvider("claude-3-haiku-20240307");

      const { generateText } = await import("ai");

      await generateText({
        model,
        messages: [{ role: "user", content: "Hi" }],
        maxOutputTokens: 1,
      });

      return true;
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error details:", {
          name: error.name,
          message: error.message,
          isCorsError:
            error.message.includes("CORS") || error.message.includes("Origin"),
        });
      } else {
        console.error("Anthropic API key test failed:", error);
      }

      return false;
    }
  }

  static createProviderWithCors(apiKey: string, baseUrl?: string) {
    return createAnthropic({
      apiKey,
      ...(baseUrl && { baseURL: baseUrl }),
      headers: {
        "anthropic-dangerous-direct-browser-access": "true",
        "Content-Type": "application/json",
      },
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

  static validateApiKey(apiKey: string): boolean {
    return apiKey.startsWith("sk-ant-") && apiKey.length > 20;
  }

  static getContextLimit(model: string): number {
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
