/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React, { useEffect, useState } from "react";
import { Connection, ConnectionType } from "@mcpconnect/schemas";
import { ConnectionStatus } from "./ConnectionStatus";
import { Zap, Globe, Radio } from "lucide-react";

export interface ConnectionItemProps
  extends Omit<
    Connection,
    "authType" | "credentials" | "headers" | "timeout" | "retryAttempts"
  > {
  onClick?: () => void;
  onCheckConnectivity?: (connectionId: string) => Promise<boolean>;
}

export const ConnectionItem: React.FC<ConnectionItemProps> = ({
  id,
  name,
  url,
  connectionType = "sse",
  isActive = false,
  isConnected = true,
  onClick,
  onCheckConnectivity,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [localIsConnected, setLocalIsConnected] = useState(isConnected);

  // Store callback in ref to avoid re-running effect when callback reference changes
  const onCheckConnectivityRef = React.useRef(onCheckConnectivity);
  onCheckConnectivityRef.current = onCheckConnectivity;

  // Track if we've already started a check for this connection
  const checkStartedRef = React.useRef(false);

  // Check connectivity on mount (only once per connection)
  useEffect(() => {
    if (!id) return;
    if (checkStartedRef.current) return;

    const checkFn = onCheckConnectivityRef.current;
    if (!checkFn) return;

    checkStartedRef.current = true;
    let mounted = true;
    setIsChecking(true);

    // Add a timeout to prevent infinite spinning
    const timeoutId = setTimeout(() => {
      if (mounted) {
        setIsChecking(false);
        setLocalIsConnected(isConnected ?? false);
      }
    }, 30000); // 30 second timeout

    checkFn(id)
      .then(result => {
        if (mounted) {
          setLocalIsConnected(result);
          setIsChecking(false);
        }
      })
      .catch(error => {
        console.error("[ConnectionItem] Connectivity check failed:", error);
        if (mounted) {
          setLocalIsConnected(false);
          setIsChecking(false);
        }
      });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Sync with prop when it changes externally (after check completes)
  useEffect(() => {
    if (!isChecking) {
      setLocalIsConnected(isConnected);
    }
  }, [isConnected, isChecking]);
  const getConnectionTypeIcon = (type: ConnectionType) => {
    switch (type) {
      case "sse":
        return <Zap className="w-3 h-3" />;
      case "http":
        return <Globe className="w-3 h-3" />;
      case "websocket":
        return <Radio className="w-3 h-3" />;
      default:
        return <Globe className="w-3 h-3" />;
    }
  };

  const getConnectionTypeColor = (type: ConnectionType) => {
    switch (type) {
      case "sse":
        return "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30";
      case "http":
        return "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30";
      case "websocket":
        return "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30";
      case "graphql":
        return "text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-900/30";
      default:
        return "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30";
    }
  };

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border cursor-pointer transition-colors h-[120px] flex flex-col ${
        isActive
          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
      }`}
    >
      <div className="flex flex-col h-full min-w-0 overflow-hidden">
        {/* Header with name and badge */}
        <div className="flex items-start justify-between gap-2 mb-2 min-w-0">
          <h3
            className="font-medium text-sm text-gray-900 dark:text-white truncate flex-1 min-w-0"
            title={name}
          >
            {name}
          </h3>
          <div
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${getConnectionTypeColor(connectionType)}`}
            title={`Connection type: ${connectionType.toUpperCase()}`}
          >
            {getConnectionTypeIcon(connectionType)}
            <span className="uppercase text-[10px]">{connectionType}</span>
          </div>
        </div>

        {/* URL - takes remaining space */}
        <div className="flex-1 min-h-0 mb-2">
          <div
            className="text-xs text-gray-500 dark:text-gray-400 truncate"
            title={url}
          >
            {url}
          </div>
        </div>

        {/* Status at bottom */}
        <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100 dark:border-gray-700">
          <ConnectionStatus
            isConnected={localIsConnected}
            isChecking={isChecking}
          />
        </div>
      </div>
    </div>
  );
};
