/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React, { useEffect, useState, useCallback } from "react";
import { Connection, ConnectionType } from "@mcpconnect/schemas";
import { MessageSquare, Loader2 } from "lucide-react";
import { TruncatedText } from "./TruncatedText";

export interface ConnectionCardProps {
  connection: Connection;
  isSelected?: boolean;
  conversationCount?: number;
  onClick?: () => void;
  isDemoMode?: boolean;
  onCheckConnectivity?: (connectionId: string) => Promise<boolean>;
}

export const ConnectionCard: React.FC<ConnectionCardProps> = ({
  connection,
  isSelected = false,
  conversationCount = 0,
  onClick,
  isDemoMode = false,
  onCheckConnectivity,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  // Start with undefined to show checking state until first check completes
  const [localIsConnected, setLocalIsConnected] = useState<boolean | undefined>(
    undefined
  );

  // Store callback in ref to avoid re-running effect when callback reference changes
  const onCheckConnectivityRef = React.useRef(onCheckConnectivity);
  onCheckConnectivityRef.current = onCheckConnectivity;

  // Track the last check timestamp to prevent rapid re-checks
  const lastCheckRef = React.useRef<number>(0);
  const CHECK_COOLDOWN = 5000; // Minimum 5 seconds between checks

  // Perform a connectivity check
  const performCheck = useCallback(async () => {
    if (isDemoMode) return;

    const checkFn = onCheckConnectivityRef.current;
    if (!checkFn) return;

    // Prevent rapid re-checks (cooldown period)
    const now = Date.now();
    if (now - lastCheckRef.current < CHECK_COOLDOWN) {
      return;
    }
    lastCheckRef.current = now;

    setIsChecking(true);

    try {
      const result = await Promise.race([
        checkFn(connection.id),
        // 15 second timeout for the check
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 15000)
        ),
      ]);
      setLocalIsConnected(result);
    } catch (error) {
      console.error("[ConnectionCard] Connectivity check failed:", error);
      setLocalIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  }, [connection.id, isDemoMode]);

  // Check connectivity on mount (runs once per component mount)
  useEffect(() => {
    if (isDemoMode) {
      setLocalIsConnected(connection.isConnected ?? true);
      return;
    }

    performCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode]); // Only run on mount, not when performCheck reference changes

  // Re-check when page becomes visible (user switches tabs back)
  useEffect(() => {
    if (isDemoMode) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        performCheck();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isDemoMode, performCheck]);

  // Sync with prop when it changes externally (after check completes)
  useEffect(() => {
    if (!isChecking && localIsConnected !== undefined) {
      // Only sync if the prop changed and we're not checking
      if (connection.isConnected !== localIsConnected) {
        setLocalIsConnected(connection.isConnected);
      }
    }
  }, [connection.isConnected, isChecking, localIsConnected]);

  // Determine display status - show checking if we haven't completed first check
  const showChecking = isChecking || localIsConnected === undefined;
  const displayConnected = localIsConnected ?? false;
  const getConnectionTypeColor = (type: ConnectionType) => {
    switch (type) {
      case "sse":
        return "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30";
      case "http":
        return "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30";
      case "websocket":
        return "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30";
      default:
        return "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30";
    }
  };

  return (
    <div
      onClick={onClick}
      className={`p-2 rounded-md border cursor-pointer transition-all duration-200 relative ${
        isSelected
          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
      } ${isDemoMode ? "opacity-60" : ""}`}
    >
      {/* Demo overlay */}
      {isDemoMode && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-gray-800/50 rounded-md pointer-events-none"></div>
      )}

      <div className="space-y-1.5 relative">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium text-xs text-gray-900 dark:text-white min-w-0 flex-1">
            <TruncatedText text={connection.name} maxLength={28} />
          </div>
          <div
            className={`inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${getConnectionTypeColor(connection.connectionType || "http")}`}
          >
            {(connection.connectionType || "HTTP").toUpperCase()}
          </div>
        </div>

        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-900 px-1.5 py-0.5 rounded">
          <TruncatedText text={connection.url} maxLength={35} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {showChecking ? (
              <>
                <Loader2 className="w-2.5 h-2.5 text-gray-400 animate-spin" />
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  Checking...
                </span>
              </>
            ) : (
              <>
                <div
                  className={`w-1.5 h-1.5 rounded-full ${displayConnected ? "bg-green-500" : "bg-red-500"}`}
                />
                <span className="text-[10px] text-gray-600 dark:text-gray-400">
                  {displayConnected ? "Connected" : "Offline"}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <MessageSquare className="w-2.5 h-2.5 text-gray-400" />
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {conversationCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
