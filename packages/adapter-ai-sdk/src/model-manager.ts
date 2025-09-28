// packages/adapter-ai-sdk/src/model-manager.ts
import { AdapterError } from "@mcpconnect/base-adapters";
import { AnthropicProvider } from "./providers/anthropic";
import { AISDKConfig, AIModel, LLMSettings } from "./types";

export function initializeAIModel(config: AISDKConfig): AIModel | null {
  try {
    switch (config.provider) {
      case "anthropic": {
        const anthropicProvider = AnthropicProvider.createProviderWithCors(
          config.apiKey!,
          config.baseUrl
        );
        return anthropicProvider(config.model);
      }
      default:
        throw new AdapterError(
          `Unsupported provider: ${config.provider}`,
          "UNSUPPORTED_PROVIDER"
        );
    }
  } catch (error) {
    console.error("Failed to initialize AI model:", error);
    return null;
  }
}

export function needsReinit(
  config: AISDKConfig,
  settings: LLMSettings
): boolean {
  return (
    config.apiKey !== settings.apiKey ||
    config.model !== settings.model ||
    config.baseUrl !== settings.baseUrl
  );
}

export function updateConfigWithSettings(
  config: AISDKConfig,
  settings: LLMSettings
): AISDKConfig {
  return {
    ...config,
    apiKey: settings.apiKey,
    model: settings.model,
    baseUrl: settings.baseUrl,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
  };
}
