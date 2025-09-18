import React from "react";
import { Loader } from "lucide-react";

export interface StreamingMessageProps {
  content: string;
  status: string;
}

export const StreamingMessage: React.FC<StreamingMessageProps> = ({
  content,
  status,
}) => {
  if (!content && !status) return null;

  return (
    <div className="group relative">
      <div className="flex gap-4 mb-6">
        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
          <Loader className="w-4 h-4 animate-spin" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-900 dark:text-gray-100">
            {content ? (
              <div className="leading-relaxed whitespace-pre-wrap">
                {content}
                <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse" />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                <span>{status}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
