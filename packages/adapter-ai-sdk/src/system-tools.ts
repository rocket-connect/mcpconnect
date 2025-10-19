import { Tool, ToolExecution } from "@mcpconnect/schemas";
import { generateId } from "./utils";
import {
  generateVisualization,
  createVisualizationTool,
  type GenerateGraphArgs,
} from "./svg-visualization-tool";

/**
 * System tool execution result
 */
export interface SystemToolResult {
  success: boolean;
  result?: any;
  error?: string;
  execution: ToolExecution;
}

/**
 * Built-in system tools available without MCP connections
 */
export class SystemToolsService {
  /**
   * Get all available system tools
   */
  static getSystemTools(): Tool[] {
    return [
      {
        id: "system_get_today_date",
        name: "get_today_date",
        description: "Get today's date in various formats",
        inputSchema: {
          type: "object",
          properties: {
            format: {
              type: "string",
              enum: ["iso", "readable", "short", "long"],
              description: "Format for the date output",
            },
            timezone: {
              type: "string",
              description: "Timezone (e.g., 'America/New_York', 'UTC')",
            },
          },
          required: [],
        },
        parameters: [
          {
            name: "format",
            type: "string",
            description:
              "Format for the date output (iso, readable, short, long)",
            required: false,
            default: "readable",
          },
          {
            name: "timezone",
            type: "string",
            description: "Timezone for the date",
            required: false,
            default: "local",
          },
        ],
        category: "system",
        tags: ["date", "time", "utility", "system"],
        deprecated: false,
      },
      // Add the visualization tool
      createVisualizationTool(),
    ];
  }

  /**
   * Execute a system tool
   */
  static async executeSystemTool(
    toolName: string,
    args: Record<string, any> = {}
  ): Promise<SystemToolResult> {
    const executionId = generateId();
    const startTime = Date.now();

    const baseExecution: ToolExecution = {
      id: executionId,
      tool: toolName,
      status: "pending",
      duration: 0,
      timestamp: new Date().toLocaleTimeString(),
      request: {
        tool: toolName,
        arguments: args,
        timestamp: new Date().toISOString(),
      },
    };

    try {
      let result: any;

      switch (toolName) {
        case "get_today_date":
          result = await this.executeGetTodayDate(args);
          break;
        case "generate_svg_visualization":
          result = await this.executeGenerateVisualization(args);
          break;
        default:
          throw new Error(`Unknown system tool: ${toolName}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      const successExecution: ToolExecution = {
        ...baseExecution,
        status: "success",
        duration,
        response: {
          success: true,
          result,
          timestamp: new Date().toISOString(),
        },
      };

      return {
        success: true,
        result,
        execution: successExecution,
      };
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const errorExecution: ToolExecution = {
        ...baseExecution,
        status: "error",
        duration,
        error: errorMessage,
      };

      return {
        success: false,
        error: errorMessage,
        execution: errorExecution,
      };
    }
  }

  /**
   * Execute get_today_date tool
   */
  private static async executeGetTodayDate(args: Record<string, any>) {
    const format = args.format || "readable";
    const timezone = args.timezone || "local";

    const now = new Date();

    // Handle timezone
    let dateToUse = now;
    if (timezone !== "local") {
      try {
        // Convert to specified timezone
        dateToUse = new Date(
          now.toLocaleString("en-US", { timeZone: timezone })
        );
      } catch (error) {
        console.warn(`Invalid timezone: ${timezone}, using local time`);
      }
    }

    let formattedDate: string;

    switch (format) {
      case "iso":
        formattedDate = dateToUse.toISOString().split("T")[0];
        break;
      case "short":
        formattedDate = dateToUse.toLocaleDateString("en-US", {
          month: "numeric",
          day: "numeric",
          year: "numeric",
        });
        break;
      case "long":
        formattedDate = dateToUse.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        break;
      case "readable":
      default:
        formattedDate = dateToUse.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        break;
    }

    return {
      date: formattedDate,
      timestamp: now.toISOString(),
      timezone:
        timezone === "local"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : timezone,
      format,
      dayOfWeek: dateToUse.toLocaleDateString("en-US", { weekday: "long" }),
      dayOfYear: Math.floor(
        (dateToUse.getTime() -
          new Date(dateToUse.getFullYear(), 0, 0).getTime()) /
          86400000
      ),
    };
  }

  /**
   * Execute generate_svg_visualization tool
   */
  private static async executeGenerateVisualization(args: Record<string, any>) {
    try {
      const visualizationArgs = args as GenerateGraphArgs;
      const result = await generateVisualization(visualizationArgs);

      // Extract the SVG content from the result
      const svgContent = result.content[0]?.text;

      if (!svgContent) {
        throw new Error("No SVG content generated");
      }

      if (
        svgContent.startsWith("Error:") ||
        svgContent.startsWith("Validation error:")
      ) {
        throw new Error(svgContent);
      }

      return {
        svg: svgContent,
        format: "svg",
        nodeCount: visualizationArgs.nodes?.length || 0,
        relationshipCount: visualizationArgs.relationships?.length || 0,
        title: visualizationArgs.title,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error in executeGenerateVisualization:", error);
      throw error;
    }
  }

  /**
   * Check if a tool name is a system tool
   */
  static isSystemTool(toolName: string): boolean {
    const systemTools = this.getSystemTools();
    return systemTools.some(tool => tool.name === toolName);
  }

  /**
   * Get system tool by name
   */
  static getSystemTool(toolName: string): Tool | undefined {
    const systemTools = this.getSystemTools();
    return systemTools.find(tool => tool.name === toolName);
  }
}
