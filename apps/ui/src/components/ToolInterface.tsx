import { Button } from "@mcpconnect/components";
import { Tool } from "@mcpconnect/schemas";
import { Play, Server } from "lucide-react";
import { useState } from "react";

interface ToolInterfaceProps {
  selectedTool: Tool | null;
}

export const ToolInterface = ({ selectedTool }: ToolInterfaceProps) => {
  const [arguments_, setArguments] = useState<Record<string, any>>({});

  const handleArgumentChange = (paramName: string, value: any) => {
    setArguments(prev => ({
      ...prev,
      [paramName]: value,
    }));
  };

  const handleExecute = () => {
    if (!selectedTool) return;
    
    console.log('Executing tool:', selectedTool.name, 'with arguments:', arguments_);
    // TODO: Implement actual tool execution
  };

  const renderParameterInput = (param: NonNullable<Tool['parameters']>[number]) => {
    if (!param) return null;

    const value = arguments_[param.name] ?? param.default ?? '';

    switch (param.type) {
      case 'string':
        return (
          <textarea
            key={param.name}
            rows={param.name === 'query' ? 4 : 1}
            placeholder={param.description || `Enter ${param.name}...`}
            value={value}
            onChange={(e) => handleArgumentChange(param.name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md 
                     bg-white dark:bg-gray-700
                     text-gray-900 dark:text-white
                     placeholder:text-gray-500 dark:placeholder:text-gray-400
                     focus:outline-none focus:ring-2 focus:ring-blue-500
                     transition-colors resize-none"
          />
        );

      case 'number':
        return (
          <input
            key={param.name}
            type="number"
            placeholder={param.description || `Enter ${param.name}...`}
            value={value}
            onChange={(e) => handleArgumentChange(param.name, parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md 
                     bg-white dark:bg-gray-700
                     text-gray-900 dark:text-white
                     placeholder:text-gray-500 dark:placeholder:text-gray-400
                     focus:outline-none focus:ring-2 focus:ring-blue-500
                     transition-colors"
          />
        );

      case 'boolean':
        return (
          <label key={param.name} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleArgumentChange(param.name, e.target.checked)}
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
            onChange={(e) => handleArgumentChange(param.name, e.target.value)}
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
    <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-900 transition-colors">
      <div className="max-w-2xl mx-auto">
        {selectedTool ? (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 transition-colors">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {selectedTool.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                {selectedTool.description}
              </p>
              {selectedTool.category && (
                <div className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  {selectedTool.category}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {selectedTool.parameters?.map((param) => (
                <div key={param.name}>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    {param.name}
                    {param.required && <span className="text-red-500 ml-1">*</span>}
                    {param.default !== undefined && (
                      <span className="text-gray-500 dark:text-gray-400 ml-2 font-normal">
                        (default: {String(param.default)})
                      </span>
                    )}
                  </label>
                  <div className="mb-2">
                    {renderParameterInput(param)}
                  </div>
                  {param.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {param.description}
                    </p>
                  )}
                </div>
              ))}

              <Button className="w-full" onClick={handleExecute}>
                <Play className="w-4 h-4 mr-2" />
                Run Tool
              </Button>
            </div>

            {selectedTool.tags && selectedTool.tags.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap gap-2">
                  {selectedTool.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <Server className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Select a Tool
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Choose a tool from the sidebar to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
};