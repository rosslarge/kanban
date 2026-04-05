import { useState } from 'react'
import { Search, Plus, X } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { CardForm } from '@/components/CardForm'
import { useFilterStore } from '@/store/filterStore'
import { useBoardStore } from '@/store/boardStore'
import { cn } from '@/lib/utils'

export function Header() {
  const [addOpen, setAddOpen] = useState(false)
  const { searchQuery, setSearchQuery } = useFilterStore()
  const addCard = useBoardStore((s) => s.addCard)

  return (
    <header className="relative shrink-0">
      {/* Gradient banner */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-6 pt-8 pb-16">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Project Board</h1>
            <p className="text-violet-200 text-sm mt-1">Ideas, work in progress, and past projects</p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 bg-white text-violet-700 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-violet-50 transition-colors shadow-lg cursor-pointer"
          >
            <Plus size={16} />
            New Card
          </button>
        </div>
      </div>

      {/* Search bar overlapping the banner */}
      <div className="absolute bottom-0 translate-y-1/2 left-6 right-6">
        <div className="relative bg-white rounded-2xl shadow-lg border border-gray-100 flex items-center px-4 gap-2">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cards by title, description, or tag..."
            className={cn(
              'flex-1 py-3.5 text-sm text-gray-900 placeholder:text-gray-400',
              'bg-transparent outline-none border-none'
            )}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Add card dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent title="New card" description="Create a new card">
          <div className="px-6 pt-6 pb-2">
            <h2 className="text-lg font-semibold text-gray-900">New card</h2>
          </div>
          <CardForm
            onSubmit={(data) => { addCard(data); setAddOpen(false) }}
            onCancel={() => setAddOpen(false)}
            submitLabel="Create card"
          />
        </DialogContent>
      </Dialog>
    </header>
  )
}
