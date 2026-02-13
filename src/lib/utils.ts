import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const normalizeText = (text: string | undefined | null): string => {
    if (!text) return '';
    return text
      .normalize('NFD') 
      .replace(/[\u0300-\u036f]/g, '') 
      .toUpperCase() 
      .replace(/\s+/g, ' ') 
      .trim();
};
