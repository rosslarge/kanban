import { useContext } from 'react'
import { ThemeContext } from '@/components/ThemeProvider'

/**
 * Returns the current theme string and a toggle function from the nearest ThemeProvider.
 * @returns `{ theme, toggleTheme }`
 */
export function useTheme() {
  return useContext(ThemeContext)
}
