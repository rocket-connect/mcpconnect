// apps/ui/src/components/ToolDetailPage.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useStorage } from "../contexts/StorageContext";
import { Tool } from "@mcpconnect/schemas";
import { SystemToolsService } from "@mcpconnect/adapter-ai-sdk";
import { MCPService } from "@mcpconnect/adapter-ai-sdk";
import { ToolExecutionForm } from "./ToolExecutionForm";
import {
  ArrowLeft,
  Settings,
  Zap,
  Wrench,
  Cpu,
  CheckCircle,
  AlertCircle,
  Clock,
  Database,
} from "lucide-react";

export const ToolDetailPage: React.FC = () => {
  const { connectionId, toolId } = useParams<{
    connectionId: string;
    toolId: string;
  }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { connections, tools, systemTools, adapter } = useStorage();

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
  const [manualExecutions, setManualExecutions] = useState<any[]>([]);

  // Find the current connection
  const currentConnection = connections.find(conn => conn.id === connectionId);

  // Load tool and extract parameters from URL
  useEffect(() => {
    if (!connectionId || !toolId) return;

    // First check if it's a system tool
    const systemTool = systemTools.find(
      t => t.id === toolId || t.name === toolId
    );
    if (systemTool) {
      setTool(systemTool);
    } else {
      // Check MCP tools for this connection
      const connectionTools = tools[connectionId] || [];
      const mcpTool = connectionTools.find(
        t => t.id === toolId || t.name === toolId
      );
      setTool(mcpTool || null);
    }

    // Extract parameters from URL search params
    const urlParams: Record<string, any> = {};
    for (const [key, value] of searchParams.entries()) {
      try {
        // Try to parse as JSON first (for objects and arrays)
        urlParams[key] = JSON.parse(decodeURIComponent(value));
      } catch {
        // If JSON parsing fails, use as string
        urlParams[key] = decodeURIComponent(value);
      }
    }

    // Only set initial values if we have parameters
    if (Object.keys(urlParams).length > 0) {
      setInitialFormValues(urlParams);
    }
  }, [connectionId, toolId, tools, systemTools, searchParams]);

  // Load manual executions for this specific tool
  useEffect(() => {
    if (!connectionId || !tool) return;

    const loadManualExecutions = async () => {
      try {
        // Get manual executions for this specific tool from storage
        const stored = await adapter.get(
          `manual-executions-${connectionId}-${tool.name}`
        );
        if (stored?.value && Array.isArray(stored.value)) {
          setManualExecutions(stored.value);
        } else {
          setManualExecutions([]);
        }
      } catch (error) {
        console.error("Failed to load manual executions:", error);
        setManualExecutions([]);
      }
    };

    loadManualExecutions();
  }, [adapter, connectionId, tool]);

  const isSystemTool =
    tool && (tool.category === "system" || tool.tags?.includes("system"));

  const handleExecute = async (formValues: Record<string, any>) => {
    if (!tool || !currentConnection) return;

    setIsExecuting(true);
    setLastExecutionStatus({ status: "pending" });

    try {
      let result;

      if (isSystemTool) {
        // Execute system tool
        result = await SystemToolsService.executeSystemTool(
          tool.name,
          formValues
        );
      } else {
        // Execute MCP tool
        result = await MCPService.executeTool(
          currentConnection,
          tool.name,
          formValues
        );
      }

      // Store execution in adapter's general storage
      // @ts-ignore
      await adapter.addToolExecution(connectionId!, result.execution);

      // Also store in manual executions for this specific tool
      // @ts-ignore
      const manualExecution = {
        // @ts-ignore
        ...result.execution,
        isManual: true,
        toolContext: "manual", // Mark as manual execution
        formValues: formValues, // Store the form values used
      };

      // Save to manual executions storage
      const currentManualExecutions = [...manualExecutions, manualExecution];
      await adapter.set(
        `manual-executions-${connectionId}-${tool.name}`,
        currentManualExecutions,
        {
          type: "array",
          tags: ["mcp", "manual-executions", connectionId!, tool.name],
          compress: true,
          encrypt: false,
        }
      );

      // Update local state
      setManualExecutions(currentManualExecutions);

      // Set success status
      setLastExecutionStatus({
        status: "success",
        message: "Tool executed successfully",
      });

      // Clear the status after 3 seconds
      setTimeout(() => {
        setLastExecutionStatus(null);
      }, 3000);
    } catch (error) {
      console.error("Tool execution failed:", error);
      setLastExecutionStatus({
        status: "error",
        message:
          error instanceof Error ? error.message : "Tool execution failed",
      });

      // Clear the status after 5 seconds for errors
      setTimeout(() => {
        setLastExecutionStatus(null);
      }, 5000);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleBack = () => {
    if (currentConnection) {
      navigate(`/connections/${connectionId}/chat/current`);
    } else {
      navigate("/connections");
    }
  };

  if (!tool) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-center">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg mx-auto mb-4 flex items-center justify-center">
            <Settings className="w-6 h-6 text-gray-400 dark:text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Tool Not Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The requested tool could not be found.
          </p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              title="Back to chat"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>

            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isSystemTool
                    ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                    : "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                }`}
              >
                {isSystemTool ? (
                  <Wrench className="w-5 h-5" />
                ) : (
                  <Zap className="w-5 h-5" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {tool.name}
                  </h1>
                  {isSystemTool && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-md text-xs font-medium">
                      <Cpu className="w-3 h-3" />
                      System Tool
                    </div>
                  )}
                  {tool.category && !isSystemTool && (
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-md text-xs font-medium">
                      {tool.category}
                    </span>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                  {tool.description || "No description available"}
                </p>
              </div>
            </div>
          </div>

          {/* Status indicator */}
          {lastExecutionStatus && (
            <div className="flex items-center gap-2">
              {lastExecutionStatus.status === "success" && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md text-sm">
                  <CheckCircle className="w-4 h-4" />
                  <span>{lastExecutionStatus.message}</span>
                </div>
              )}
              {lastExecutionStatus.status === "error" && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{lastExecutionStatus.message}</span>
                </div>
              )}
              {lastExecutionStatus.status === "pending" && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-sm">
                  <Clock className="w-4 h-4 animate-pulse" />
                  <span>Executing...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area - Centered */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-center min-h-full p-6">
          <div className="w-full max-w-3xl">
            {/* Tool Execution Form Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Execute Tool
                </h2>
              </div>

              <ToolExecutionForm
                tool={tool}
                onExecute={handleExecute}
                isExecuting={isExecuting}
                disabled={!currentConnection}
                initialValues={initialFormValues}
              />
            </div>

            {/* Usage Instructions Card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                  How to Use
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      1
                    </span>
                  </div>
                  <p className="text-blue-800 dark:text-blue-200 text-sm">
                    Fill in the required parameters in the form above
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      2
                    </span>
                  </div>
                  <p className="text-blue-800 dark:text-blue-200 text-sm">
                    Press Enter or click "Execute Tool" to run the tool
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      3
                    </span>
                  </div>
                  <p className="text-blue-800 dark:text-blue-200 text-sm">
                    View results and execution details in the Request Inspector
                    panel
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      4
                    </span>
                  </div>
                  <p className="text-blue-800 dark:text-blue-200 text-sm">
                    Manual executions are marked with a green badge for easy
                    identification
                  </p>
                </div>
              </div>
            </div>

            {/* Inspector Guide Card */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <Database className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Request Inspector
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                The Request Inspector on the right shows detailed execution logs
                for this tool. Manual executions from this page are combined
                with any chat-based executions, giving you a complete view of
                all tool activity. Click on any execution to view full request
                and response details.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
