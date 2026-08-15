import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names safely (used by every UI component). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
