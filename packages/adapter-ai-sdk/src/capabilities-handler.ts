import { LLMCapabilities } from "@mcpconnect/base-adapters";
import { AISDKConfig } from "./types";

export function getCapabilities(config: AISDKConfig): LLMCapabilities {
  const baseCapabilities: LLMCapabilities = {
    streaming: true,
    tools: true,
    systemMessages: true,
    multiModal: false,
    maxContextLength: 4096,
    supportedModalities: ["text"],
  };

  switch (config.provider) {
    case "anthropic":
      return {
        ...baseCapabilities,
        maxContextLength: 200000,
        multiModal: true,
        supportedModalities: ["text", "image"],
        costPerToken: {
          input: 0.000008,
          output: 0.000024,
        },
      };
    default:
      return baseCapabilities;
  }
}
