import clsx, { ClassValue } from "clsx";

/**
 * Utility function to merge class names with clsx and tailwind-merge compatibility
 * This allows for conditional classes and proper class merging
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
