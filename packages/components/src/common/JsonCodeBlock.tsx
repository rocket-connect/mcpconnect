import React from "react";
import { Copy } from "lucide-react";

interface JsonHighlighterProps {
  json: unknown;
  className?: string;
}

interface JsonCodeBlockProps {
  data: unknown;
  onCopy: () => void;
  showDemo?: boolean;
}

// Type guard for Date objects
const isDateLike = (obj: unknown): obj is Date => {
  return (
    obj != null &&
    typeof obj === "object" &&
    "getTime" in obj &&
    typeof (obj as any).getTime === "function"
  );
};

// JSON Syntax Highlighter Component
const JsonHighlighter: React.FC<JsonHighlighterProps> = ({
  json,
  className = "",
}) => {
  const formatJson = (obj: unknown): React.ReactElement[] => {
    const jsonString = JSON.stringify(obj, null, 2);
    const lines = jsonString.split("\n");

    return lines.map((line, index) => {
      // Preserve leading spaces by converting them to non-breaking spaces
      const leadingSpaces = line.match(/^(\s*)/)?.[1] || "";
      const restOfLine = line.slice(leadingSpaces.length);

      let highlightedLine = restOfLine;

      // Key highlighting (property names in quotes)
      highlightedLine = highlightedLine.replace(
        /"([^"]+)":/g,
        '<span class="json-key">"$1"</span>:'
      );

      // String value highlighting
      highlightedLine = highlightedLine.replace(
        /:\s*"([^"]*)"/g,
        ': <span class="json-string">"$1"</span>'
      );

      // Number highlighting
      highlightedLine = highlightedLine.replace(
        /:\s*(-?\d+\.?\d*)/g,
        ': <span class="json-number">$1</span>'
      );

      // Boolean highlighting
      highlightedLine = highlightedLine.replace(
        /:\s*(true|false)/g,
        ': <span class="json-boolean">$1</span>'
      );

      // Null highlighting
      highlightedLine = highlightedLine.replace(
        /:\s*(null)/g,
        ': <span class="json-null">$1</span>'
      );

      // Bracket and brace highlighting
      highlightedLine = highlightedLine.replace(
        /([{}[\]])/g,
        '<span class="json-bracket">$1</span>'
      );

      // Convert leading spaces to nbsp entities to preserve indentation
      const indentHtml = leadingSpaces.replace(/ /g, "&nbsp;");

      return (
        <div
          key={index}
          className="json-line"
          dangerouslySetInnerHTML={{ __html: indentHtml + highlightedLine }}
        />
      );
    });
  };

  return (
    <div className={`json-container ${className}`}>
      <style>{`
        .json-container {
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 0.75rem;
          line-height: 1.4;
        }
        .json-line {
          margin: 0;
          padding: 0;
        }
        .json-container .json-key {
          color: #0969da;
          font-weight: 500;
        }
        .json-container .json-string {
          color: #0a3069;
        }
        .json-container .json-number {
          color: #0550ae;
        }
        .json-container .json-boolean {
          color: #8250df;
        }
        .json-container .json-null {
          color: #656d76;
        }
        .json-container .json-bracket {
          color: #24292f;
          font-weight: bold;
        }
        
        /* Dark mode styles */
        .dark .json-container .json-key {
          color: #79c0ff;
        }
        .dark .json-container .json-string {
          color: #a5d6ff;
        }
        .dark .json-container .json-number {
          color: #79c0ff;
        }
        .dark .json-container .json-boolean {
          color: #d2a8ff;
        }
        .dark .json-container .json-null {
          color: #8b949e;
        }
        .dark .json-container .json-bracket {
          color: #f0f6fc;
        }
      `}</style>
      {formatJson(json)}
    </div>
  );
};

export const JsonCodeBlock: React.FC<JsonCodeBlockProps> = ({
  data,
  onCopy,
  showDemo = false,
}) => {
  return (
    <div className="relative">
      <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* Code block header */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              JSON
            </span>
            {showDemo && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                Demo
              </span>
            )}
          </div>
          <button
            onClick={onCopy}
            disabled={showDemo}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            title="Copy JSON"
            type="button"
          >
            <Copy className="w-3 h-3 text-gray-400" />
          </button>
        </div>

        {/* JSON content with syntax highlighting */}
        <div className="p-4 overflow-x-auto max-h-64">
          <JsonHighlighter
            json={data}
            className="text-gray-800 dark:text-gray-200"
          />
        </div>
      </div>
    </div>
  );
};

export const parseTimestampToNumber = (timestamp: unknown): number => {
  if (typeof timestamp === "number") {
    return timestamp;
  }

  if (isDateLike(timestamp)) {
    return timestamp.getTime();
  }

  if (typeof timestamp === "string") {
    const parsed = new Date(timestamp);
    if (!isNaN(parsed.getTime())) {
      return parsed.getTime();
    }

    const numericTimestamp = parseInt(timestamp, 10);
    if (!isNaN(numericTimestamp)) {
      return numericTimestamp;
    }
  }

  return Date.now();
};

export const formatTimestamp = (timestamp: unknown): string => {
  if (!timestamp) return "—";

  try {
    let date: Date;

    if (isDateLike(timestamp)) {
      date = timestamp;
    } else if (typeof timestamp === "string") {
      date = new Date(timestamp);

      if (isNaN(date.getTime())) {
        const numericTimestamp = parseInt(timestamp, 10);
        if (!isNaN(numericTimestamp)) {
          date = new Date(numericTimestamp);
        } else {
          return "Invalid Date";
        }
      }
    } else if (typeof timestamp === "number") {
      date = new Date(timestamp);
    } else {
      return "—";
    }

    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }

    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch (error) {
    console.warn("Error formatting timestamp:", timestamp, error);
    return "Invalid Date";
  }
};
