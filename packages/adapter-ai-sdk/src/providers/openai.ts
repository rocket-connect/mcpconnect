import { z } from "zod";
import { AISDKConfig } from "../types";
import { createOpenAI } from "@ai-sdk/openai";

export const OpenAIConfigSchema = z.object({
  provider: z.literal("openai"),
  apiKey: z.string().min(1, "OpenAI API key is required"),
  baseUrl: z.string().url().optional(),
  model: z
    .enum([
      "gpt-5",
      "gpt-5-2025-08-07",
      "gpt-5-mini",
      "gpt-5-mini-2025-08-07",
      "gpt-5-nano",
      "gpt-5-nano-2025-08-07",
      "gpt-5-chat-latest",
      "gpt-5.1",
      "gpt-5.1-chat-latest",
      "gpt-4.1",
      "gpt-4.1-2025-04-14",
      "gpt-4.1-mini",
      "gpt-4.1-mini-2025-04-14",
      "gpt-4.1-nano",
      "gpt-4.1-nano-2025-04-14",
      "gpt-4o",
      "gpt-4o-2024-05-13",
      "gpt-4o-2024-08-06",
      "gpt-4o-2024-11-20",
      "gpt-4o-mini",
      "gpt-4o-mini-2024-07-18",
      "gpt-4-turbo",
      "gpt-4-turbo-2024-04-09",
      "gpt-4",
      "gpt-4-0613",
      "gpt-4.5-preview",
      "gpt-4.5-preview-2025-02-27",
      "gpt-3.5-turbo",
      "gpt-3.5-turbo-0125",
      "gpt-3.5-turbo-1106",
      "chatgpt-4o-latest",
      "o1",
      "o1-2024-12-17",
      "o3-mini",
      "o3-mini-2025-01-31",
      "o3",
      "o3-2025-04-16",
    ])
    .default("gpt-4o"),
});

export type OpenAIConfig = z.infer<typeof OpenAIConfigSchema>;

export class OpenAIProvider {
  static createConfig(
    config: Partial<OpenAIConfig> & { apiKey: string }
  ): AISDKConfig {
    const openaiConfig = OpenAIConfigSchema.parse({
      provider: "openai" as const,
      ...config,
    });

    return {
      name: "openai-adapter",
      provider: "openai",
      model: openaiConfig.model,
      apiKey: openaiConfig.apiKey,
      baseUrl: openaiConfig.baseUrl,
      temperature: 0.7,
      maxTokens: 4096,
      stream: false,
      timeout: 30000,
      retries: 3,
      debug: false,
      modelProvider: {
        type: "openai",
        model: openaiConfig.model,
        config: openaiConfig,
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
        value: "gpt-5",
        label: "GPT-5",
        description: "Most advanced GPT-5 model",
      },
      {
        value: "gpt-5-mini",
        label: "GPT-5 Mini",
        description: "Efficient GPT-5 variant",
      },
      {
        value: "gpt-5-nano",
        label: "GPT-5 Nano",
        description: "Compact GPT-5 for fast responses",
      },
      {
        value: "gpt-5.1",
        label: "GPT-5.1",
        description: "Latest GPT-5.1 model",
      },
      {
        value: "gpt-4.1",
        label: "GPT-4.1",
        description: "Advanced GPT-4.1 model",
      },
      {
        value: "gpt-4.1-mini",
        label: "GPT-4.1 Mini",
        description: "Efficient GPT-4.1 variant",
      },
      {
        value: "gpt-4.1-nano",
        label: "GPT-4.1 Nano",
        description: "Compact GPT-4.1 for fast responses",
      },
      {
        value: "gpt-4o",
        label: "GPT-4o",
        description: "Optimized GPT-4 model",
      },
      {
        value: "gpt-4o-mini",
        label: "GPT-4o Mini",
        description: "Fast and efficient for everyday tasks",
      },
      {
        value: "gpt-4-turbo",
        label: "GPT-4 Turbo",
        description: "High-performance GPT-4",
      },
      {
        value: "gpt-4",
        label: "GPT-4",
        description: "Original GPT-4 model",
      },
      {
        value: "gpt-4.5-preview",
        label: "GPT-4.5 Preview",
        description: "Preview of GPT-4.5",
      },
      {
        value: "gpt-3.5-turbo",
        label: "GPT-3.5 Turbo",
        description: "Quick responses for simple tasks",
      },
      {
        value: "o1",
        label: "O1",
        description: "Reasoning-focused model",
      },
      {
        value: "o3-mini",
        label: "O3 Mini",
        description: "Compact reasoning model",
      },
      {
        value: "o3",
        label: "O3",
        description: "Advanced reasoning model",
      },
      {
        value: "chatgpt-4o-latest",
        label: "ChatGPT-4o (Latest)",
        description: "Latest ChatGPT-4o version",
      },
    ];
  }

  static async testApiKey(apiKey: string, baseUrl?: string): Promise<boolean> {
    try {
      const openaiProvider = createOpenAI({
        apiKey,
        ...(baseUrl && { baseURL: baseUrl }),
        headers: {
          "Content-Type": "application/json",
        },
        fetch: (url, options) => {
          return fetch(url, {
            ...options,
            mode: "cors",
            credentials: "omit",
            headers: {
              ...options?.headers,
            },
          });
        },
      });

      const model = openaiProvider("gpt-3.5-turbo");

      const { generateText } = await import("ai");

      await generateText({
        model,
        messages: [{ role: "user", content: "Hi" }],
        maxOutputTokens: 16,
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
        console.error("OpenAI API key test failed:", error);
      }

      return false;
    }
  }

  static createProviderWithCors(apiKey: string, baseUrl?: string) {
    return createOpenAI({
      apiKey,
      ...(baseUrl && { baseURL: baseUrl }),
      headers: {
        "Content-Type": "application/json",
      },
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          mode: "cors",
          credentials: "omit",
          headers: {
            ...options?.headers,
          },
        });
      },
    });
  }

  static validateApiKey(apiKey: string): boolean {
    return apiKey.startsWith("sk-") && apiKey.length > 20;
  }

  static getContextLimit(model: string): number {
    const limits: Record<string, number> = {
      "gpt-5": 200000,
      "gpt-5-2025-08-07": 200000,
      "gpt-5-mini": 128000,
      "gpt-5-mini-2025-08-07": 128000,
      "gpt-5-nano": 128000,
      "gpt-5-nano-2025-08-07": 128000,
      "gpt-5-chat-latest": 200000,
      "gpt-5.1": 200000,
      "gpt-5.1-chat-latest": 200000,
      "gpt-4.1": 128000,
      "gpt-4.1-2025-04-14": 128000,
      "gpt-4.1-mini": 128000,
      "gpt-4.1-mini-2025-04-14": 128000,
      "gpt-4.1-nano": 128000,
      "gpt-4.1-nano-2025-04-14": 128000,
      "gpt-4o": 128000,
      "gpt-4o-2024-05-13": 128000,
      "gpt-4o-2024-08-06": 128000,
      "gpt-4o-2024-11-20": 128000,
      "gpt-4o-mini": 128000,
      "gpt-4o-mini-2024-07-18": 128000,
      "gpt-4-turbo": 128000,
      "gpt-4-turbo-2024-04-09": 128000,
      "gpt-4": 8192,
      "gpt-4-0613": 8192,
      "gpt-4.5-preview": 128000,
      "gpt-4.5-preview-2025-02-27": 128000,
      "gpt-3.5-turbo": 16385,
      "gpt-3.5-turbo-0125": 16385,
      "gpt-3.5-turbo-1106": 16385,
      "chatgpt-4o-latest": 128000,
      o1: 200000,
      "o1-2024-12-17": 200000,
      "o3-mini": 200000,
      "o3-mini-2025-01-31": 200000,
      o3: 200000,
      "o3-2025-04-16": 200000,
    };

    return limits[model] || 128000;
  }
}
