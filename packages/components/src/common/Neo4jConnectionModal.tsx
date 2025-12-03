import React, { useState } from "react";
import { X, Database } from "lucide-react";
import {
  Neo4jConfigSection,
  Neo4jConnectionConfig,
} from "./Neo4jConfigSection";

export type { Neo4jConnectionConfig };

export interface Neo4jConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: Neo4jConnectionConfig) => void;
  toolCount?: number;
  connectionName?: string;
  isOpenAIConfigured?: boolean;
}

export const Neo4jConnectionModal: React.FC<Neo4jConnectionModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  toolCount = 0,
  connectionName = "Connection",
  isOpenAIConfigured = true,
}) => {
  const [formData, setFormData] = useState<Neo4jConnectionConfig>({
    uri: "neo4j://localhost:7687",
    username: "neo4j",
    password: "",
    database: "neo4j",
  });
  const [isSyncing, setIsSyncing] = useState(false);

  if (!isOpen) return null;

  const handleTestConnection = async (): Promise<boolean> => {
    // Simulate connection test - in real implementation this would call the backend
    console.log("[Neo4jConnectionModal] Testing connection:", {
      uri: formData.uri,
      username: formData.username,
      database: formData.database,
    });

    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 1500));

    // For now, always succeed (mocked)
    console.log("[Neo4jConnectionModal] Connection test successful (mocked)");
    return true;
  };

  const handleSync = async () => {
    setIsSyncing(true);
    console.log("[Neo4jConnectionModal] Starting sync:", {
      config: { ...formData, password: "***" },
      toolCount,
    });

    // Simulate sync operation
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("[Neo4jConnectionModal] Sync complete (mocked)");
    onConnect(formData);
    setIsSyncing(false);
    onClose();
  };

  const handleClose = () => {
    if (!isSyncing) {
      setFormData({
        uri: "neo4j://localhost:7687",
        username: "neo4j",
        password: "",
        database: "neo4j",
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Set Up Vector Search
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Connect to Neo4j for {connectionName}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSyncing}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          <Neo4jConfigSection
            config={formData}
            onConfigChange={setFormData}
            onTestConnection={handleTestConnection}
            onSync={handleSync}
            toolCount={toolCount}
            isSyncing={isSyncing}
            isOpenAIConfigured={isOpenAIConfigured}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            disabled={isSyncing}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
