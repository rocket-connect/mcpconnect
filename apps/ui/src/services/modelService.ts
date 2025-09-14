import { AnthropicProvider } from "@mcpconnect/adapter-ai-sdk";

export type ModelProvider = "anthropic";

export interface ModelOption {
  value: string;
  label: string;
  description?: string;
}

export interface LLMSettings {
  provider: ModelProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
}

export class ModelService {
  private static readonly STORAGE_KEY = "mcpconnect-llm-settings";

  /**
   * Get default settings for a provider
   */
  static getDefaultSettings(provider: ModelProvider): Partial<LLMSettings> {
    const defaults: Record<ModelProvider, Partial<LLMSettings>> = {
      anthropic: {
        provider: "anthropic",
        model: "claude-3-5-sonnet-20241022",
        temperature: 0.7,
        maxTokens: 4096,
      },
    };

    return defaults[provider];
  }

  /**
   * Get available models for a provider (static list)
   */
  static getAvailableModels(provider: ModelProvider): ModelOption[] {
    switch (provider) {
      case "anthropic":
        return AnthropicProvider.getAvailableModels();
      default:
        return [];
    }
  }

  /**
   * Test API key validity for a provider
   */
  static async testApiKey(
    provider: ModelProvider,
    apiKey: string,
    baseUrl?: string
  ): Promise<boolean> {
    try {
      switch (provider) {
        case "anthropic":
          return AnthropicProvider.testApiKey(apiKey, baseUrl);
        // Keep cases for future expansion

        default:
          return false;
      }
    } catch (error) {
      console.error(`API key test failed for ${provider}:`, error);
      return false;
    }
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
      switch (provider) {
        case "anthropic":
          // Anthropic typically uses static models, but keep the pattern for consistency
          return this.getAvailableModels(provider);
        default:
          return this.getAvailableModels(provider);
      }
    } catch (error) {
      console.error(`Failed to fetch models for ${provider}:`, error);
      return this.getAvailableModels(provider);
    }
  }

  /**
   * Validate API key format for a provider
   */
  static validateApiKeyFormat(
    provider: ModelProvider,
    apiKey: string
  ): boolean {
    switch (provider) {
      case "anthropic":
        return AnthropicProvider.validateApiKey(apiKey);
      default:
        return provider === "custom" || false; // Custom can have any format
    }
  }

  /**
   * Get pricing information for a model
   */
  static getModelPricing(
    provider: ModelProvider,
    model: string
  ): { input: number; output: number } | null {
    switch (provider) {
      case "anthropic":
        return AnthropicProvider.getModelPricing(model);
      default:
        return null;
    }
  }

  /**
   * Get context limit for a model
   */
  static getContextLimit(provider: ModelProvider, model: string): number {
    switch (provider) {
      case "anthropic":
        return AnthropicProvider.getContextLimit(model);
      default:
        return 200000; // Claude's typical context limit as default
    }
  }

  /**
   * Save settings to localStorage
   */
  static saveSettings(settings: LLMSettings): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save LLM settings:", error);
    }
  }

  /**
   * Load settings from localStorage
   */
  static loadSettings(): LLMSettings | null {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as LLMSettings;
      }
    } catch (error) {
      console.error("Failed to load LLM settings:", error);
    }
    return null;
  }

  /**
   * Clear saved settings
   */
  static clearSettings(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear LLM settings:", error);
    }
  }

  /**
   * Get placeholder text for API key input
   */
  static getApiKeyPlaceholder(provider: ModelProvider): string {
    const placeholders: Record<ModelProvider, string> = {
      anthropic: "sk-ant-api03-...",
    };

    return placeholders[provider];
  }

  /**
   * Get provider display name
   */
  static getProviderDisplayName(provider: ModelProvider): string {
    const names: Record<ModelProvider, string> = {
      anthropic: "Anthropic",
    };

    return names[provider];
  }
}
