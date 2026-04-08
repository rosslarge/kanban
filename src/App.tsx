import { useEffect } from 'react'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Board } from '@/components/Board'
import { ThemeProvider } from '@/components/ThemeProvider'
import { BackgroundAtmosphere } from '@/components/BackgroundAtmosphere'
import { useBoardStore } from '@/store/boardStore'
import { useMouseSpotlight } from '@/hooks/useMouseSpotlight'

/**
 * Inner shell — needs to be a child of ThemeProvider so useTheme works,
 * and calls useMouseSpotlight to wire up the cursor-driven glow.
 */
function AppShell() {
  const initialize = useBoardStore((s) => s.initialize)
  useMouseSpotlight()

  useEffect(() => { initialize() }, [initialize])

  return (
    <div className="relative flex h-screen overflow-hidden z-10">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto pt-12">
          <Board />
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BackgroundAtmosphere />
      <AppShell />
    </ThemeProvider>
  )
}
