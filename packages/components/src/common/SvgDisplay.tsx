// packages/components/src/common/SvgDisplay.tsx
import React, { useState } from "react";
import {
  Download,
  Maximize2,
  Minimize2,
  Copy,
  CheckCircle,
} from "lucide-react";

export interface SvgDisplayProps {
  svgContent: string;
  title?: string;
  className?: string;
  showControls?: boolean;
}

export const SvgDisplay: React.FC<SvgDisplayProps> = ({
  svgContent,
  title,
  className = "",
  showControls = true,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleDownload = () => {
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "visualization"}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(svgContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy SVG:", error);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (!svgContent) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg">
        No SVG content to display
      </div>
    );
  }

  const containerClasses = isFullscreen
    ? "fixed inset-0 z-50 bg-white dark:bg-gray-900 p-4 flex flex-col"
    : `relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`;

  return (
    <div className={containerClasses}>
      {/* Header with controls */}
      {showControls && (
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {title || "SVG Visualization"}
            </span>
            <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
              SVG
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              title="Copy SVG code"
            >
              {isCopied ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-gray-500" />
              )}
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              title="Download SVG"
            >
              <Download className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-gray-500" />
              ) : (
                <Maximize2 className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* SVG Content */}
      <div className={`flex-1 overflow-auto ${isFullscreen ? "p-4" : "p-6"}`}>
        <div className="flex items-center justify-center min-h-full">
          <div
            className="max-w-full"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>
      </div>

      {/* Fullscreen overlay close */}
      {isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/30 text-white rounded-full transition-colors z-10"
          title="Close fullscreen"
        >
          <Minimize2 className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

// Helper function to detect if content is SVG
export function isSvgContent(content: string): boolean {
  return (
    typeof content === "string" &&
    content.trim().startsWith("<svg") &&
    content.trim().endsWith("</svg>")
  );
}

// Helper function to extract title from SVG content
export function extractSvgTitle(content: string): string | undefined {
  const titleMatch = content.match(
    /<text[^>]*text-anchor="middle"[^>]*font-weight="bold"[^>]*>([^<]+)<\/text>/
  );
  return titleMatch?.[1]?.trim();
}
