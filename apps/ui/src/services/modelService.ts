// apps/ui/src/services/modelService.ts - Refactored to use AISDKAdapter
import {
  AISDKAdapter,
  ModelOption,
  AnthropicProvider,
} from "@mcpconnect/adapter-ai-sdk";

export type ModelProvider = "anthropic";

// Local interface that matches what the UI needs
export interface LLMSettings {
  provider: "anthropic";
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
}

// Re-export ModelOption type from adapter
export type { ModelOption };

export class ModelService {
  /**
   * Get default settings for a provider
   */
  static getDefaultSettings(_provider?: ModelProvider): Partial<LLMSettings> {
    return AISDKAdapter.getDefaultSettings();
  }

  /**
   * Get available models for the current provider (Anthropic)
   */
  static getAvailableModels(_provider?: ModelProvider): ModelOption[] {
    return AISDKAdapter.getAvailableModels();
  }

  /**
   * Test API key validity for a provider
   */
  static async testApiKey(
    _provider: ModelProvider,
    apiKey: string,
    baseUrl?: string
  ): Promise<boolean> {
    return AISDKAdapter.testApiKey(apiKey, baseUrl);
  }

  /**
   * Fetch models dynamically from API (when possible)
   */
  static async fetchModelsFromAPI(
    provider: ModelProvider,
    _apiKey: string,
    _baseUrl?: string
  ): Promise<ModelOption[]> {
    try {
      // For Anthropic, we use static models as they don't provide a dynamic models API
      return this.getAvailableModels(provider);
    } catch (error) {
      console.error(`Failed to fetch models for ${provider}:`, error);
      return this.getAvailableModels(provider);
    }
  }

  /**
   * Validate API key format for a provider
   */
  static validateApiKeyFormat(
    _provider: ModelProvider,
    apiKey: string
  ): boolean {
    return AISDKAdapter.validateApiKey(apiKey);
  }

  /**
   * Get pricing information for a model
   */
  static getModelPricing(
    _provider: ModelProvider,
    model: string
  ): { input: number; output: number } | null {
    return AISDKAdapter.getModelPricing(model);
  }

  /**
   * Get context limit for a model
   */
  static getContextLimit(_provider: ModelProvider, model: string): number {
    return AISDKAdapter.getContextLimit(model);
  }

  /**
   * Save settings to localStorage
   */
  static saveSettings(settings: LLMSettings): void {
    AISDKAdapter.saveSettings(settings);
  }

  /**
   * Load settings from localStorage
   */
  static loadSettings(): LLMSettings | null {
    return AISDKAdapter.loadSettings();
  }

  /**
   * Clear saved settings
   */
  static clearSettings(): void {
    AISDKAdapter.clearSettings();
  }

  /**
   * Get placeholder text for API key input
   */
  static getApiKeyPlaceholder(_provider?: ModelProvider): string {
    return AISDKAdapter.getApiKeyPlaceholder();
  }

  /**
   * Get provider display name
   */
  static getProviderDisplayName(_provider?: ModelProvider): string {
    return AISDKAdapter.getProviderDisplayName();
  }

  /**
   * Get model capabilities (delegated to AnthropicProvider)
   */
  static getModelCapabilities(model: string) {
    return AnthropicProvider.getModelCapabilities(model);
  }

  /**
   * Create provider configuration
   */
  static createProviderConfig(settings: LLMSettings) {
    // @ts-ignore
    return AnthropicProvider.createConfig(settings);
  }
}
