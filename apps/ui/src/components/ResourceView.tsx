import { Resource } from "@mcpconnect/schemas";
import { Database, FileText, Image, Code } from "lucide-react";

interface ResourceViewProps {
  selectedResource: Resource | null;
}

export const ResourceView = ({ selectedResource }: ResourceViewProps) => {
  const getResourceIcon = (type?: string) => {
    switch (type) {
      case "table":
        return Database;
      case "file":
        return FileText;
      case "image":
        return Image;
      case "code":
        return Code;
      default:
        return Database;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-900 transition-colors">
      <div className="max-w-2xl mx-auto">
        {selectedResource ? (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 transition-colors">
            <div className="flex items-start gap-4 mb-4">
              {(() => {
                const Icon = getResourceIcon(selectedResource.type);
                return (
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                );
              })()}
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {selectedResource.name}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-3">
                  {selectedResource.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedResource.type && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      {selectedResource.type}
                    </span>
                  )}
                  {selectedResource.mimeType && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {selectedResource.mimeType}
                    </span>
                  )}
                  {selectedResource.tags?.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Resource details */}
            <div className="space-y-4">
              {selectedResource.uri && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                    URI
                  </label>
                  <code className="block w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-md text-gray-800 dark:text-gray-200 font-mono">
                    {selectedResource.uri}
                  </code>
                </div>
              )}

              {selectedResource.permissions && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Permissions
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-md">
                      <div
                        className={`text-sm font-medium ${selectedResource.permissions.read ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                      >
                        {selectedResource.permissions.read ? "✓" : "✗"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Read
                      </div>
                    </div>
                    <div className="text-center p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-md">
                      <div
                        className={`text-sm font-medium ${selectedResource.permissions.write ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                      >
                        {selectedResource.permissions.write ? "✓" : "✗"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Write
                      </div>
                    </div>
                    <div className="text-center p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-md">
                      <div
                        className={`text-sm font-medium ${selectedResource.permissions.delete ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                      >
                        {selectedResource.permissions.delete ? "✓" : "✗"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Delete
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-4">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm">
                  Access Resource
                </button>
                <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm">
                  View Metadata
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Database className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Select a Resource
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Choose a resource from the sidebar to view its details
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
