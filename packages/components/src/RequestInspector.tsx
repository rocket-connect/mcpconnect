/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Card } from "./Card";
import { Button } from "./Button";

export interface RequestInspectorProps {
  execution?: {
    tool?: string;
    duration?: string;
    request?: any;
    response?: any;
    success?: boolean;
    metrics?: {
      responseTime?: string;
      dataSize?: string;
      successRate?: string;
    };
  };
}

export const RequestInspector: React.FC<RequestInspectorProps> = ({
  execution = {},
}) => {
  const {
    tool = "query_database",
    duration = "142ms",
    request = {
      tool: "query_database",
      arguments: {
        query:
          "SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '1 month'",
        timeout: 5000,
      },
      timestamp: "2025-01-15T10:30:45Z",
    },
    response = {
      success: true,
      result: {
        count: 47,
        execution_time: 142,
      },
      timestamp: "2025-01-15T10:30:47Z",
    },
    success = true,
    metrics = {
      responseTime: "142ms",
      dataSize: "3.2KB",
      successRate: "98.2%",
    },
  } = execution;

  return (
    <Card className="bg-white dark:bg-gray-800">
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Request Inspector
          </h3>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary">
              Request
            </Button>
            <Button size="sm" variant="ghost">
              Response
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            Latest Execution
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{tool}</span>
            <span>{duration}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Request Payload
            </h4>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-3">
              <pre className="text-xs text-gray-700 dark:text-gray-300 font-mono">
                {JSON.stringify(request, null, 2)}
              </pre>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Response Data
            </h4>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-3">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`px-2 py-1 text-xs rounded ${
                    success
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  }`}
                >
                  {success ? "200 OK" : "500 Error"}
                </div>
              </div>
              <pre className="text-xs text-gray-700 dark:text-gray-300 font-mono">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                {metrics.responseTime}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Response Time
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                {metrics.dataSize}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Data Size
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                {metrics.successRate}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Success Rate
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
