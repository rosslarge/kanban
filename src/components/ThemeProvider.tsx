import { createContext, useCallback, useState } from 'react'

interface ThemeContextValue {
  /** The currently active theme: 'light' or 'dark'. */
  theme: string
  /** Toggles between light and dark, persisting to localStorage. */
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
})

/**
 * Manages the 'light' / 'dark' colour theme. Reads the value already set
 * by the inline script in index.html so there is no flash of the wrong theme.
 * Toggling updates `data-theme` on `<html>` and writes to localStorage.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<string>(
    () => document.documentElement.getAttribute('data-theme') ?? 'light',
  )

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      localStorage.setItem('kanban-theme', next)
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
