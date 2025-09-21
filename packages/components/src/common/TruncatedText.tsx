import React from "react";

export interface TruncatedTextProps {
  text: string;
  maxLength?: number;
  className?: string;
}

export const TruncatedText: React.FC<TruncatedTextProps> = ({
  text,
  maxLength = 50,
  className = "",
}) => {
  const isTruncated = text.length > maxLength;
  const displayText = isTruncated ? `${text.slice(0, maxLength)}...` : text;

  return (
    <span className={className} title={isTruncated ? text : undefined}>
      {displayText}
    </span>
  );
};
