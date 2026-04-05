import { useEffect } from 'react'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Board } from '@/components/Board'
import { useBoardStore } from '@/store/boardStore'

export default function App() {
  const initialize = useBoardStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
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
