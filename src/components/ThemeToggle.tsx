import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

/**
 * Icon button that toggles between light and dark mode.
 * Placed in the Header alongside the search bar.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer shrink-0"
      style={{
        background: 'rgba(255,255,255,0.12)',
        border: '1px solid rgba(255,255,255,0.20)',
        color: 'rgba(255,255,255,0.85)',
      }}
    >
      {theme === 'dark' ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
    </button>
  )
}
