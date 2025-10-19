import React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

export interface ExecutionTableHeaderProps {
  sortField?: "tool" | "status" | "time" | "duration";
  sortDirection?: "asc" | "desc";
  onSort?: (field: "tool" | "status" | "time" | "duration") => void;
}

export const ExecutionTableHeader: React.FC<ExecutionTableHeaderProps> = ({
  sortField,
  sortDirection,
  onSort,
}) => {
  const SortIcon = ({
    field,
  }: {
    field: "tool" | "status" | "time" | "duration";
  }) => {
    if (sortField !== field) {
      return <div className="w-3 h-3" />; // Placeholder for alignment
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );
  };

  const HeaderButton = ({
    field,
    children,
  }: {
    field: "tool" | "status" | "time" | "duration";
    children: React.ReactNode;
  }) => (
    <button
      onClick={() => onSort?.(field)}
      className={`flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100 transition-colors ${
        sortField === field
          ? "text-gray-900 dark:text-gray-100 font-semibold"
          : ""
      }`}
    >
      {children}
      <SortIcon field={field} />
    </button>
  );

  return (
    <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 flex-shrink-0">
      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-600 dark:text-gray-400">
        <div className="col-span-5 flex items-center gap-1">
          <HeaderButton field="tool">Tool</HeaderButton>
        </div>
        <div className="col-span-2 flex items-center justify-center">
          <HeaderButton field="status">Status</HeaderButton>
        </div>
        <div className="col-span-2 flex items-center justify-center">
          <HeaderButton field="time">Time</HeaderButton>
        </div>
        <div className="col-span-2 flex items-center justify-center">
          <HeaderButton field="duration">Duration</HeaderButton>
        </div>
        <div className="col-span-1"></div>
      </div>
    </div>
  );
};
