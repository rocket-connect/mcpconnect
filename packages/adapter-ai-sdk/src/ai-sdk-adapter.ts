import {
  LLMAdapter,
  LLMConfig,
  LLMMessage,
  LLMResponse,
  LLMStreamResponse,
  LLMCapabilities,
  AdapterError,
  AdapterStatus,
  StorageAdapter,
} from "@mcpconnect/base-adapters";
import { ChatMessage, ToolExecution } from "@mcpconnect/schemas";
import { generateText } from "ai";
import {
  AISDKConfig,
  AISDKConfigSchema,
  ChatContext,
  ChatResponse,
  StreamingChatResponse,
  LLMSettings,
  ModelOption,
  AIModel,
} from "./types";
import {
  convertMCPToolToTool,
  convertToAIMessages,
  convertToAITools,
  createThinkingMessage,
  getErrorMessage,
  validateChatContext,
} from "./utils";
import { AnthropicProvider } from "./providers/anthropic";
import {
  initializeAIModel,
  needsReinit,
  updateConfigWithSettings,
} from "./model-manager";
import { getCapabilities } from "./capabilities-handler";
import { handleCompletion } from "./completion-handler";
import { handleStream, sendMessageStream } from "./streaming-handler";
import { sendMessage } from "./message-handler";

export class AISDKAdapter extends LLMAdapter {
  public config: AISDKConfig;
  public static storageAdapter: StorageAdapter | null = null;
  public aiModel: AIModel | null = null;

  constructor(config: AISDKConfig) {
    const parsedConfig = AISDKConfigSchema.parse(config);
    super(parsedConfig);
    this.config = parsedConfig;
    this.initializeAIModel();
  }

  initializeAIModel() {
    this.aiModel = initializeAIModel(this.config);
  }

  static setStorageAdapter(adapter: StorageAdapter) {
    this.storageAdapter = adapter;
  }

  async getCapabilities(): Promise<LLMCapabilities> {
    return getCapabilities(this.config);
  }

  async initialize(): Promise<void> {
    if (!this.aiModel) {
      this.initializeAIModel();
    }

    if (!this.aiModel) {
      throw new AdapterError(
        `Failed to initialize ${this.config.provider} model`,
        "MODEL_INITIALIZATION_FAILED"
      );
    }

    const isConnected = await this.testConnection();
    if (!isConnected) {
      throw new AdapterError(
        `Failed to connect to ${this.config.provider} provider`,
        "CONNECTION_FAILED"
      );
    }

    this.status = AdapterStatus.CONNECTED;
  }

  async testConnection(): Promise<boolean> {
    if (!this.aiModel) {
      return false;
    }

    try {
      await generateText({
        model: this.aiModel,
        messages: [{ role: "user", content: "Hi" }],
        maxOutputTokens: 1,
      });

      return true;
    } catch (error) {
      console.error("Connection test failed:", error);
      return false;
    }
  }

  async complete(
    messages: LLMMessage[],
    options?: Partial<LLMConfig>
  ): Promise<LLMResponse> {
    if (!this.aiModel) {
      throw new AdapterError(
        "AI model not initialized",
        "MODEL_NOT_INITIALIZED"
      );
    }

    this.status = AdapterStatus.PROCESSING;

    try {
      const result = await handleCompletion(this.aiModel, messages, {
        ...options,
        model: this.config.model,
        tools: options?.tools || this.config.tools,
        maxTokens: options?.maxTokens || this.config.maxTokens,
        temperature: options?.temperature || this.config.temperature,
      });

      this.status = AdapterStatus.CONNECTED;
      return result;
    } catch (error) {
      this.status = AdapterStatus.ERROR;
      this.handleError(error, "complete");
    }
  }

  protected convertMCPToolToTool = convertMCPToolToTool;

  async *stream(
    messages: LLMMessage[],
    options?: Partial<LLMConfig>
  ): AsyncIterable<LLMStreamResponse> {
    if (!this.aiModel) {
      throw new AdapterError(
        "AI model not initialized",
        "MODEL_NOT_INITIALIZED"
      );
    }

    this.status = AdapterStatus.PROCESSING;

    try {
      const aiMessages = convertToAIMessages(messages);
      const aiTools = convertToAITools(options?.tools || this.config.tools);

      for await (const chunk of handleStream(
        this.aiModel,
        aiMessages,
        aiTools,
        {
          maxTokens: options?.maxTokens || this.config.maxTokens,
          temperature: options?.temperature || this.config.temperature,
          model: this.config.model,
        }
      )) {
        yield chunk;
      }

      this.status = AdapterStatus.CONNECTED;
    } catch (error) {
      this.status = AdapterStatus.ERROR;
      console.error("Stream setup error:", error);

      let errorMessage = "Failed to start conversation";
      let errorType = "STREAM_SETUP_ERROR";

      if (error instanceof Error) {
        errorMessage = error.message;

        if (errorMessage.includes("API key")) {
          errorMessage = "Invalid API key. Please check your LLM API settings.";
          errorType = "AUTH_ERROR";
        } else if (
          errorMessage.includes("network") ||
          errorMessage.includes("fetch")
        ) {
          errorMessage =
            "Network error. Please check your connection and try again.";
          errorType = "NETWORK_ERROR";
        }
      }

      throw new AdapterError(errorMessage, errorType, { originalError: error });
    }
  }

  async cleanup(): Promise<void> {
    this.status = AdapterStatus.DISCONNECTED;
    this.aiModel = null;
  }

  async *sendMessageStream(
    userMessage: string,
    context: ChatContext,
    conversationHistory: ChatMessage[] = []
  ): AsyncIterable<StreamingChatResponse> {
    // Update configuration and reinitialize if needed
    if (needsReinit(this.config, context.llmSettings)) {
      this.config = updateConfigWithSettings(this.config, context.llmSettings);
      this.initializeAIModel();
    }

    for await (const response of sendMessageStream(
      this,
      userMessage,
      context,
      conversationHistory
    )) {
      yield response;
    }
  }

  /**
   * Send a message with chat context and tool execution
   */
  async sendMessage(
    userMessage: string,
    context: ChatContext,
    conversationHistory: ChatMessage[] = []
  ): Promise<ChatResponse> {
    return sendMessage(this, userMessage, context, conversationHistory);
  }

  // Static helper methods
  static getDefaultSettings(): Partial<LLMSettings> {
    return {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      temperature: 0.7,
      maxTokens: 4096,
    };
  }

  static getAvailableModels(): ModelOption[] {
    return AnthropicProvider.getAvailableModels();
  }

  static async testApiKey(apiKey: string, baseUrl?: string): Promise<boolean> {
    return AnthropicProvider.testApiKey(apiKey, baseUrl);
  }

  static validateApiKey(apiKey: string): boolean {
    return AnthropicProvider.validateApiKey(apiKey);
  }

  static getContextLimit(model: string): number {
    return AnthropicProvider.getContextLimit(model);
  }

  static getApiKeyPlaceholder(): string {
    return "sk-ant-api03-...";
  }

  static getProviderDisplayName(): string {
    return "Anthropic";
  }

  static createThinkingMessage = createThinkingMessage;
  static validateChatContext = validateChatContext;
  static getErrorMessage = getErrorMessage;

  static async storeToolExecution(
    connectionId: string,
    execution: ToolExecution
  ): Promise<void> {
    if (!this.storageAdapter) {
      console.warn("No storage adapter configured for AISDKAdapter");
      return;
    }

    try {
      await this.storageAdapter.addToolExecution(connectionId, execution);
    } catch (error) {
      console.error("Failed to store tool execution:", error);
    }
  }
}
