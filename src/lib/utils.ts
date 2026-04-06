import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges Tailwind CSS class names, resolving conflicts so later classes win.
 * Combines clsx (conditional class logic) with tailwind-merge (conflict resolution).
 * @param inputs - Any number of class values, conditionals, or arrays.
 * @returns A single merged class name string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
