/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React, { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

// Core UI Components
export const Button = ({
  children,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}) => {
  const baseClasses =
    "font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";

  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary:
      "bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500",
    ghost:
      "text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-500",
  };

  const sizeClasses = {
    sm: "px-3 py-1 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const className = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${props.className || ""}`;

  return (
    <button {...props} className={className}>
      {children}
    </button>
  );
};

export const Card = ({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

// MCP-specific Components
export interface ConnectionItemProps {
  name: string;
  url: string;
  isActive?: boolean;
  isConnected?: boolean;
  onClick?: () => void;
}

export const ConnectionItem: React.FC<ConnectionItemProps> = ({
  name,
  url,
  isActive = false,
  isConnected = true,
  onClick,
}) => (
  <div
    onClick={onClick}
    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
      isActive
        ? "bg-blue-50 border-blue-200"
        : "bg-white border-gray-200 hover:bg-gray-50"
    }`}
  >
    <div className="flex items-center gap-3">
      <div
        className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500" : "bg-gray-400"}`}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-gray-900">{name}</div>
        <div className="text-xs text-gray-500 truncate">{url}</div>
      </div>
    </div>
  </div>
);

export interface ToolItemProps {
  name: string;
  description: string;
  icon?: LucideIcon;
  onClick?: () => void;
}

export const ToolItem: React.FC<ToolItemProps> = ({
  name,
  description,
  icon: Icon,
  onClick,
}) => (
  <div
    onClick={onClick}
    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
  >
    <div className="flex items-center gap-3">
      {Icon && (
        <div className="w-8 h-8 bg-orange-100 rounded-md flex items-center justify-center">
          <Icon className="w-4 h-4 text-orange-600" />
        </div>
      )}
      <div className="flex-1">
        <div className="font-medium text-sm text-gray-900">{name}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
    </div>
  </div>
);

export interface ResourceItemProps {
  name: string;
  description: string;
  type?: string;
  icon?: LucideIcon;
  onClick?: () => void;
}

export const ResourceItem: React.FC<ResourceItemProps> = ({
  name,
  description,
  icon: Icon,
  onClick,
}) => (
  <div
    onClick={onClick}
    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
  >
    <div className="flex items-center gap-3">
      {Icon && (
        <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
      )}
      <div className="flex-1">
        <div className="font-medium text-sm text-gray-900">{name}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
    </div>
  </div>
);

export interface ChatMessageProps {
  message?: string;
  isUser?: boolean;
  isExecuting?: boolean;
  executingTool?: string;
  children?: ReactNode;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isUser = false,
  isExecuting = false,
  executingTool = "tool",
  children,
}) => (
  <div className={`flex gap-3 mb-4 ${isUser ? "flex-row-reverse" : ""}`}>
    <div
      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
        isUser
          ? "bg-blue-600 text-white"
          : isExecuting
            ? "bg-orange-100 text-orange-800 border border-orange-200"
            : "bg-green-100 text-green-800 border border-green-200"
      }`}
    >
      {isExecuting ? (
        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-4 animate-pulse bg-current rounded-full opacity-50" />
          Executing {executingTool}...
        </div>
      ) : (
        <div className="text-sm">{message || children}</div>
      )}
    </div>
  </div>
);

export interface ConnectionStatusProps {
  isConnected?: boolean;
  label?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected = true,
  label,
}) => (
  <div className="flex items-center gap-2">
    <div
      className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
    />
    <span className="text-sm font-medium">
      {label || (isConnected ? "Connected" : "Disconnected")}
    </span>
  </div>
);

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
    <Card className="bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Request Inspector</h3>
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
          <div className="text-sm font-medium text-gray-900">
            Latest Execution
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{tool}</span>
            <span>{duration}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Request Payload
            </h4>
            <div className="bg-gray-50 rounded-md p-3">
              <pre className="text-xs text-gray-700 font-mono">
                {JSON.stringify(request, null, 2)}
              </pre>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Response Data
            </h4>
            <div className="bg-gray-50 rounded-md p-3">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`px-2 py-1 text-xs rounded ${
                    success
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {success ? "200 OK" : "500 Error"}
                </div>
              </div>
              <pre className="text-xs text-gray-700 font-mono">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-200">
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">
                {metrics.responseTime}
              </div>
              <div className="text-xs text-gray-500">Response Time</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">
                {metrics.dataSize}
              </div>
              <div className="text-xs text-gray-500">Data Size</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">
                {metrics.successRate}
              </div>
              <div className="text-xs text-gray-500">Success Rate</div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export interface MCPLayoutProps {
  children?: ReactNode;
  sidebar?: ReactNode;
  inspector?: ReactNode;
  header?: ReactNode;
}

export const MCPLayout: React.FC<MCPLayoutProps> = ({
  children,
  sidebar,
  inspector,
  header,
}) => (
  <div className="h-screen bg-gray-50 flex flex-col">
    {header}
    <div className="flex-1 flex overflow-hidden">
      {sidebar && (
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          {sidebar}
        </div>
      )}
      <div className="flex-1 flex flex-col">{children}</div>
      {inspector && (
        <div className="w-96 border-l border-gray-200 bg-gray-50 overflow-y-auto">
          {inspector}
        </div>
      )}
    </div>
  </div>
);
