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
  <div className="h-screen bg-gray-50 dark:bg-gray-950 flex flex-col transition-colors">
    {header}
    <div className="flex-1 flex overflow-hidden relative">
      {sidebar && (
        <div className="w-80 flex-shrink-0 flex-grow-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-y-auto transition-colors">
          {sidebar}
        </div>
      )}
      <div
        className="flex-1 flex flex-col bg-white dark:bg-gray-950 overflow-hidden"
        style={{
          width: `calc(100% - ${sidebar ? "20rem" : "0px"} - ${inspector ? "31.25rem" : "0px"})`,
        }}
      >
        {children}
      </div>
      {inspector && (
        <div className="w-[500px] flex-shrink-0 flex-grow-0 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto transition-colors">
          {inspector}
        </div>
      )}
    </div>
  </div>
);
