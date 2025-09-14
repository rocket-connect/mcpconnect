import React, { ReactNode } from "react";

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
  <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors">
    {header}
    <div className="flex-1 flex overflow-hidden">
      {sidebar && (
        <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto transition-colors">
          {sidebar}
        </div>
      )}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
        {children}
      </div>
      {inspector && (
        <div className="w-96 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-y-auto transition-colors">
          {inspector}
        </div>
      )}
    </div>
  </div>
);
