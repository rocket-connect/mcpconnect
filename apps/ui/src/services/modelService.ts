import {
  AISDKAdapter,
  ModelOption,
  LLMSettings,
} from "@mcpconnect/adapter-ai-sdk";
import { LocalStorageAdapter } from "@mcpconnect/adapter-localstorage";

export type ModelProvider = "anthropic";

// Re-export types from adapter for compatibility
export type { ModelOption, LLMSettings };

/**
 * Model service that delegates all operations to AISDKAdapter
 */
export class ModelService {
  private static adapter: LocalStorageAdapter | null = null;

  /**
   * Set the storage adapter to use
   */
  static setAdapter(adapter: LocalStorageAdapter) {
    this.adapter = adapter;
  }

  /**
   * Get default settings for a provider - delegates to AISDKAdapter
   */
  static getDefaultSettings(_provider?: ModelProvider): Partial<LLMSettings> {
    return AISDKAdapter.getDefaultSettings();
  }

  /**
   * Get available models for the current provider - delegates to AISDKAdapter
   */
  static getAvailableModels(_provider?: ModelProvider): ModelOption[] {
    return AISDKAdapter.getAvailableModels();
  }

  /**
   * Test API key validity - delegates to AISDKAdapter
   */
  static async testApiKey(
    _provider: ModelProvider,
    apiKey: string,
    baseUrl?: string
  ): Promise<boolean> {
    return AISDKAdapter.testApiKey(apiKey, baseUrl);
  }

  /**
   * Fetch models dynamically from API - delegates to AISDKAdapter
   */
  static async fetchModelsFromAPI(
    provider: ModelProvider,
    _apiKey: string,
    _baseUrl?: string
  ): Promise<ModelOption[]> {
    try {
      // For Anthropic, we use static models as they don't provide a dynamic models API
      // AISDKAdapter handles this internally
      return this.getAvailableModels(provider);
    } catch (error) {
      console.error(`Failed to fetch models for ${provider}:`, error);
      return this.getAvailableModels(provider);
    }
  }

  /**
   * Validate API key format - delegates to AISDKAdapter
   */
  static validateApiKeyFormat(
    _provider: ModelProvider,
    apiKey: string
  ): boolean {
    return AISDKAdapter.validateApiKey(apiKey);
  }

  /**
   * Get pricing information for a model - delegates to AISDKAdapter
   */
  static getModelPricing(
    _provider: ModelProvider,
    model: string
  ): { input: number; output: number } | null {
    return AISDKAdapter.getModelPricing(model);
  }

  /**
   * Get context limit for a model - delegates to AISDKAdapter
   */
  static getContextLimit(_provider: ModelProvider, model: string): number {
    return AISDKAdapter.getContextLimit(model);
  }

  /**
   * Save settings using the storage adapter
   */
  static async saveSettings(settings: LLMSettings): Promise<void> {
    if (!this.adapter) {
      console.warn("No storage adapter configured for ModelService");
      return;
    }

    try {
      await this.adapter.setLLMSettings(settings);
    } catch (error) {
      console.error("Failed to save LLM settings:", error);
      throw error;
    }
  }

  /**
   * Load settings using the storage adapter
   */
  static async loadSettings(): Promise<LLMSettings | null> {
    if (!this.adapter) {
      console.warn("No storage adapter configured for ModelService");
      return null;
    }

    try {
      return await this.adapter.getLLMSettings();
    } catch (error) {
      console.error("Failed to load LLM settings:", error);
      return null;
    }
  }

  /**
   * Clear saved settings using the storage adapter
   */
  static async clearSettings(): Promise<void> {
    if (!this.adapter) {
      console.warn("No storage adapter configured for ModelService");
      return;
    }

    try {
      await this.adapter.clearLLMSettings();
    } catch (error) {
      console.error("Failed to clear LLM settings:", error);
      throw error;
    }
  }

  /**
   * Get placeholder text for API key input - delegates to AISDKAdapter
   */
  static getApiKeyPlaceholder(_provider?: ModelProvider): string {
    return AISDKAdapter.getApiKeyPlaceholder();
  }

  /**
   * Get provider display name - delegates to AISDKAdapter
   */
  static getProviderDisplayName(_provider?: ModelProvider): string {
    return AISDKAdapter.getProviderDisplayName();
  }
}
