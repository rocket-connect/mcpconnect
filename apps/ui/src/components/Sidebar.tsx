import { ConnectionItem, ToolItem, ResourceItem } from "@mcpconnect/components";
import { RconnectLogo } from "./RconnectLogo";

interface SidebarProps {
  connections: any[];
  tools: any[];
  resources: any[];
  onToolSelect: (tool: any) => void;
}

export const Sidebar = ({
  connections,
  tools,
  resources,
  onToolSelect,
}: SidebarProps) => (
  <div className="flex flex-col h-full bg-white dark:bg-gray-800 transition-colors">
    <div className="flex-1 p-4">
      {/* Connections */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Connections
          </h2>
          <button className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium transition-colors">
            + Add Connection
          </button>
        </div>
        <div className="space-y-2">
          {connections.map((conn, idx) => (
            <ConnectionItem key={idx} {...conn} />
          ))}
        </div>
      </div>

      {/* Tools */}
      <div className="mb-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
          Tools ({tools.length})
        </h2>
        <div className="space-y-2">
          {tools.map((tool, idx) => (
            <ToolItem key={idx} {...tool} onClick={() => onToolSelect(tool)} />
          ))}
        </div>
      </div>

      {/* Resources */}
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
          Resources ({resources.length})
        </h2>
        <div className="space-y-2">
          {resources.map((resource, idx) => (
            <ResourceItem key={idx} {...resource} />
          ))}
        </div>
      </div>
    </div>

    {/* RconnectLogo at bottom */}
    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
      <RconnectLogo className="opacity-90 hover:opacity-100 transition-opacity" />
    </div>
  </div>
);
