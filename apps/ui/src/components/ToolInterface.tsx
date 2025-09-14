import { Button } from "@mcpconnect/components";
import { Play, Server } from "lucide-react";

interface ToolInterfaceProps {
  selectedTool: any;
}

export const ToolInterface = ({ selectedTool }: ToolInterfaceProps) => (
  <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-900 transition-colors">
    <div className="max-w-2xl mx-auto">
      {selectedTool ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 transition-colors">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {selectedTool.name}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {selectedTool.description}
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Query
              </label>
              <textarea
                rows={4}
                placeholder="SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '1 month'"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700
                         text-gray-900 dark:text-white
                         placeholder:text-gray-500 dark:placeholder:text-gray-400
                         focus:outline-none focus:ring-2 focus:ring-blue-500
                         transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Timeout (ms)
              </label>
              <input
                type="number"
                defaultValue="5000"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700
                         text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500
                         transition-colors"
              />
            </div>

            <Button className="w-full">
              <Play className="w-4 h-4 mr-2" />
              Run Tool
            </Button>
          </div>
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
