import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useStorage } from "../contexts/StorageContext";
import { useInspector } from "../contexts/InspectorProvider";
import { Tool } from "@mcpconnect/schemas";
import { SystemToolsService } from "@mcpconnect/adapter-ai-sdk";
import { MCPService } from "@mcpconnect/adapter-ai-sdk";
import { ToolExecutionForm } from "./ToolExecutionForm";
import {
  ArrowLeft,
  Zap,
  Wrench,
  Cpu,
  CheckCircle,
  AlertCircle,
  Clock,
  Info,
} from "lucide-react";
import { nanoid } from "nanoid";

export const ToolDetailPage: React.FC = () => {
  const { connectionId, toolId } = useParams<{
    connectionId: string;
    toolId: string;
  }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { connections, tools, systemTools, adapter, conversations } =
    useStorage();
  const { refreshManualExecutions } = useInspector();

  const [tool, setTool] = useState<Tool | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastExecutionStatus, setLastExecutionStatus] = useState<{
    status: "success" | "error" | "pending";
    message?: string;
  } | null>(null);
  const [initialFormValues, setInitialFormValues] = useState<Record<
    string,
    any
  > | null>(null);

  const currentConnection = connections.find(conn => conn.id === connectionId);

  useEffect(() => {
    if (connectionId && toolId) {
      refreshManualExecutions();
    }
  }, [connectionId, toolId, refreshManualExecutions]);

  useEffect(() => {
    if (!connectionId || !toolId) return;

    const systemTool = systemTools.find(
      t => t.id === toolId || t.name === toolId
    );
    if (systemTool) {
      setTool(systemTool);
    } else {
      const connectionTools = tools[connectionId] || [];
      const mcpTool = connectionTools.find(
        t => t.id === toolId || t.name === toolId
      );
      setTool(mcpTool || null);
    }

    const urlParams: Record<string, any> = {};
    for (const [key, value] of searchParams.entries()) {
      try {
        urlParams[key] = JSON.parse(decodeURIComponent(value));
      } catch {
        urlParams[key] = decodeURIComponent(value);
      }
    }

    if (Object.keys(urlParams).length > 0) {
      setInitialFormValues(urlParams);
    }
  }, [connectionId, toolId, tools, systemTools, searchParams]);

  const isSystemTool =
    tool && (tool.category === "system" || tool.tags?.includes("system"));

  const handleExecute = async (formValues: Record<string, any>) => {
    if (!tool || !currentConnection) return;

    setIsExecuting(true);
    setLastExecutionStatus({ status: "pending" });

    const startTime = Date.now();
    const now = new Date();

    try {
      let result;

      if (isSystemTool) {
        result = await SystemToolsService.executeSystemTool(
          tool.name,
          formValues
        );
      } else {
        result = await MCPService.executeTool(
          currentConnection,
          tool.name,
          formValues
        );
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      const executionId = nanoid();

      const isSuccess = result.success !== false;
      const resultData =
        result.result ||
        (result as any).data ||
        (result as any).response?.result;
      const errorData = result.error || (result as any).response?.error;

      const manualExecution = {
        id: executionId,
        tool: tool.name,
        status: isSuccess ? "success" : "error",
        duration: duration,
        timestamp: now.toISOString(),
        request: {
          tool: tool.name,
          arguments: formValues,
          timestamp: new Date(startTime).toISOString(),
        },
        ...(isSuccess && resultData
          ? {
              response: {
                success: true,
                result: resultData,
                timestamp: new Date(endTime).toISOString(),
              },
            }
          : {}),
        ...(errorData
          ? {
              error:
                typeof errorData === "string"
                  ? errorData
                  : JSON.stringify(errorData),
            }
          : {}),
        isManual: true,
        toolContext: "manual",
        formValues: formValues,
      };

      // Load current executions
      let currentManualExecutions: any[] = [];
      try {
        const stored = await adapter.get(
          `manual-executions-${connectionId}-${tool.name}`
        );

        if (stored?.value && Array.isArray(stored.value)) {
          const uniqueMap = new Map();
          stored.value.forEach((exec: any) => {
            if (exec.id && !uniqueMap.has(exec.id)) {
              uniqueMap.set(exec.id, exec);
            }
          });
          currentManualExecutions = Array.from(uniqueMap.values());
        }
      } catch (error) {
        console.error("[ToolDetail] Failed to load current executions:", error);
      }

      // Check for duplicates
      if (currentManualExecutions.some(exec => exec.id === executionId)) {
        console.warn(
          `[ToolDetail] Execution ${executionId} already exists, skipping save`
        );
        setLastExecutionStatus({
          status: "success",
          message: "Tool executed successfully",
        });
        return;
      }

      const updatedExecutions = [...currentManualExecutions, manualExecution];

      await adapter.set(
        `manual-executions-${connectionId}-${tool.name}`,
        updatedExecutions,
        {
          type: "array",
          tags: ["mcp", "manual-executions", connectionId!, tool.name],
          compress: true,
          encrypt: false,
        }
      );

      // Trigger inspector refresh immediately
      await refreshManualExecutions();

      setLastExecutionStatus({
        status: "success",
        message: "Tool executed successfully",
      });

      setTimeout(() => {
        setLastExecutionStatus(null);
      }, 3000);
    } catch (error) {
      console.error("[ToolDetail] Tool execution failed:", error);

      const endTime = Date.now();
      const duration = endTime - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const errorExecution = {
        id: nanoid(),
        tool: tool.name,
        status: "error",
        duration: duration,
        timestamp: now.toISOString(),
        request: {
          tool: tool.name,
          arguments: formValues,
          timestamp: new Date(startTime).toISOString(),
        },
        error: errorMessage,
        isManual: true,
        toolContext: "manual",
        formValues: formValues,
      };

      try {
        const stored = await adapter.get(
          `manual-executions-${connectionId}-${tool.name}`
        );
        const currentExecutions = Array.isArray(stored?.value)
          ? stored.value
          : [];
        await adapter.set(
          `manual-executions-${connectionId}-${tool.name}`,
          [...currentExecutions, errorExecution],
          {
            type: "array",
            tags: ["mcp", "manual-executions", connectionId!, tool.name],
            compress: true,
            encrypt: false,
          }
        );

        // Trigger inspector refresh for error case too
        await refreshManualExecutions();
      } catch (saveError) {
        console.error(
          "[ToolDetail] Failed to save error execution:",
          saveError
        );
      }

      setLastExecutionStatus({
        status: "error",
        message: errorMessage,
      });

      setTimeout(() => {
        setLastExecutionStatus(null);
      }, 3000);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleBack = () => {
    if (currentConnection) {
      // Get the conversations for this connection
      const connectionConversations = conversations[connectionId!] || [];

      // Find the first available chat, or use 'new' to trigger auto-creation
      const firstChatId =
        connectionConversations.length > 0
          ? connectionConversations[0].id
          : "new";

      // Navigate to the chat view with a specific chat ID
      navigate(`/connections/${connectionId}/chat/${firstChatId}`);
    } else {
      navigate("/connections");
    }
  };

  if (!tool) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg mx-auto mb-3 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-gray-400 dark:text-gray-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Tool Not Found
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            The requested tool could not be found.
          </p>
          <button
            type="submit"
            disabled={isExecuting}
            className="w-full px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExecuting ? "Executing..." : "Execute Tool"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Compact Header */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-start gap-3">
            <button
              onClick={handleBack}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
              title="Back to chat"
            >
              <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isSystemTool
                        ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                        : "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                    }`}
                  >
                    {isSystemTool ? (
                      <Wrench className="w-4 h-4" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {tool.name}
                      </h1>
                      {isSystemTool && (
                        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-xs font-medium">
                          <Cpu className="w-3 h-3" />
                          System
                        </div>
                      )}
                      {tool.category && !isSystemTool && (
                        <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-xs font-medium">
                          {tool.category}
                        </span>
                      )}
                    </div>
                    {tool.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                        {tool.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Compact Status indicator */}
                {lastExecutionStatus && (
                  <div className="flex-shrink-0">
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border">
                      {lastExecutionStatus.status === "success" && (
                        <>
                          <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                          <span className="text-green-700 dark:text-green-300">
                            Success
                          </span>
                        </>
                      )}
                      {lastExecutionStatus.status === "error" && (
                        <>
                          <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
                          <span className="text-red-700 dark:text-red-300">
                            Error
                          </span>
                        </>
                      )}
                      {lastExecutionStatus.status === "pending" && (
                        <>
                          <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400 animate-pulse" />
                          <span className="text-blue-700 dark:text-blue-300">
                            Running...
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {/* Compact Info Banner */}
          <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-0.5">
                  Manual Tool Execution
                </h3>
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  Configure parameters and execute. Results appear in the
                  Request Inspector on the right.
                </p>
              </div>
            </div>
          </div>

          {/* Compact Form Card */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Tool Parameters
              </h2>
            </div>

            <div className="p-4">
              <ToolExecutionForm
                tool={tool}
                onExecute={handleExecute}
                isExecuting={isExecuting}
                disabled={!currentConnection}
                initialValues={initialFormValues}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
