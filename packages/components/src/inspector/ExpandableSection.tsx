/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

export interface ExpandableSectionProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  children?: React.ReactNode;
}

export const ExpandableSection: React.FC<ExpandableSectionProps> = ({
  id,
  title,
  icon,
  isExpanded,
  onToggle,
  children,
}) => {
  return (
    <div>
      <div
        className="flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors"
        onClick={() => onToggle(id)}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
        {icon}
        <h5 className="font-medium text-gray-900 dark:text-gray-100 text-sm flex-1">
          {title}
        </h5>
      </div>

      {isExpanded && <div className="ml-6 mt-2">{children}</div>}
    </div>
  );
};
