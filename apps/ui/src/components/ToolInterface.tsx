import { Button } from "@mcpconnect/components";
import { Tool } from "@mcpconnect/schemas";
import { Play, Server, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStorage } from "../contexts/StorageContext";

interface ToolInterfaceProps {
  selectedTool: Tool | null;
}

export const ToolInterface = ({ selectedTool }: ToolInterfaceProps) => {
  const { id: connectionId } = useParams();
  const navigate = useNavigate();
  const { connections, tools } = useStorage();
  const [arguments_, setArguments] = useState<Record<string, any>>({});

  // Get current connection and its tools
  const currentConnection = connectionId
    ? connections.find(conn => conn.id === connectionId)
    : null;
  const connectionTools = connectionId ? tools[connectionId] || [] : [];

  const handleArgumentChange = (paramName: string, value: any) => {
    setArguments(prev => ({
      ...prev,
      [paramName]: value,
    }));
  };

  const handleExecute = () => {
    if (!selectedTool) return;
  };

  const handleToolSelect = (tool: Tool) => {
    // Navigate to the tool and update arguments for the new tool
    setArguments({});
    if (connectionId) {
      navigate(`/connections/${connectionId}/tools/${tool.id}`);
    } else {
      navigate(`/tools/${tool.id}`);
    }
  };

  const handleBackToConnection = () => {
    if (connectionId && currentConnection) {
      navigate(`/connections/${connectionId}`);
    } else {
      navigate("/connections");
    }
  };

  const renderParameterInput = (
    param: NonNullable<Tool["parameters"]>[number]
  ) => {
    if (!param) return null;

    const value = arguments_[param.name] ?? param.default ?? "";

    switch (param.type) {
      case "string":
        return (
          <textarea
            key={param.name}
            rows={param.name === "query" ? 4 : 1}
            placeholder={param.description || `Enter ${param.name}...`}
            value={value}
            onChange={e => handleArgumentChange(param.name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md 
                     bg-white dark:bg-gray-700
                     text-gray-900 dark:text-white
                     placeholder:text-gray-500 dark:placeholder:text-gray-400
                     focus:outline-none focus:ring-2 focus:ring-blue-500
                     transition-colors resize-none"
          />
        );

      case "number":
        return (
          <input
            key={param.name}
            type="number"
            placeholder={param.description || `Enter ${param.name}...`}
            value={value}
            onChange={e =>
              handleArgumentChange(param.name, parseInt(e.target.value) || 0)
            }
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md 
                     bg-white dark:bg-gray-700
                     text-gray-900 dark:text-white
                     placeholder:text-gray-500 dark:placeholder:text-gray-400
                     focus:outline-none focus:ring-2 focus:ring-blue-500
                     transition-colors"
          />
        );

      case "boolean":
        return (
          <label key={param.name} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={e => handleArgumentChange(param.name, e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {param.description || param.name}
            </span>
          </label>
        );

      default:
        return (
          <input
            key={param.name}
            type="text"
            placeholder={param.description || `Enter ${param.name}...`}
            value={value}
            onChange={e => handleArgumentChange(param.name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md 
                     bg-white dark:bg-gray-700
                     text-gray-900 dark:text-white
                     placeholder:text-gray-500 dark:placeholder:text-gray-400
                     focus:outline-none focus:ring-2 focus:ring-blue-500
                     transition-colors"
          />
        );
    }
  };

  return (
    <div className="flex h-full bg-white dark:bg-gray-900 transition-colors">
      {/* Tools List Sidebar - Only show if we have connection tools */}
      {connectionTools.length > 0 && (
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-y-auto">
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {currentConnection
                  ? `${currentConnection.name} Tools`
                  : "Tools"}
              </h3>
              {currentConnection && (
                <button
                  onClick={handleBackToConnection}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  title="Back to connection"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Tools List */}
            <div className="space-y-2">
              {connectionTools.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => handleToolSelect(tool)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedTool?.id === tool.id
                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-md flex items-center justify-center">
                      <Server className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                        {tool.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {tool.description}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Tool Interface */}
      <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-900 transition-colors">
        <div className="max-w-2xl mx-auto">
          {selectedTool ? (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 transition-colors">
              {/* Tool Header */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                    <Server className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedTool.name}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      ID: {selectedTool.id}
                    </p>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-3">
                  {selectedTool.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedTool.category && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      {selectedTool.category}
                    </span>
                  )}
                  {selectedTool.tags?.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Parameters Form */}
              <div className="space-y-4">
                <h3 className="text-md font-medium text-gray-900 dark:text-white">
                  Parameters
                </h3>

                {selectedTool.parameters &&
                selectedTool.parameters.length > 0 ? (
                  selectedTool.parameters.map(param => (
                    <div key={param.name}>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                        {param.name}
                        {param.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                        {param.default !== undefined && (
                          <span className="text-gray-500 dark:text-gray-400 ml-2 font-normal">
                            (default: {String(param.default)})
                          </span>
                        )}
                      </label>
                      <div className="mb-2">{renderParameterInput(param)}</div>
                      {param.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {param.description}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    This tool doesn't require any parameters.
                  </p>
                )}

                {/* Execute Button */}
                <div className="pt-4">
                  <Button
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={handleExecute}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Execute {selectedTool.name}
                  </Button>
                </div>
              </div>

              {/* Tool Schema (collapsible) */}
              {selectedTool.inputSchema && (
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-gray-900 dark:text-white mb-2 list-none">
                      <span className="flex items-center gap-2">
                        <span>Input Schema</span>
                        <svg
                          className="w-4 h-4 transition-transform group-open:rotate-90"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    </summary>
                    <pre className="text-xs bg-white dark:bg-gray-900 p-3 rounded border border-gray-200 dark:border-gray-600 overflow-x-auto text-gray-800 dark:text-gray-200 font-mono">
                      {JSON.stringify(selectedTool.inputSchema, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Server className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {connectionTools.length > 0
                  ? "Select a Tool"
                  : "No Tools Available"}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {connectionTools.length > 0
                  ? "Choose a tool from the sidebar to get started"
                  : currentConnection
                    ? `No tools available for ${currentConnection.name}`
                    : "No connection selected"}
              </p>
              {!currentConnection && (
                <button
                  onClick={() => navigate("/connections")}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Select a Connection
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
