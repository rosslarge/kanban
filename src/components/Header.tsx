import { useState } from 'react'
import { Search, Plus, X } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { CardForm } from '@/components/CardForm'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useFilterStore } from '@/store/filterStore'
import { useBoardStore } from '@/store/boardStore'
import { cn } from '@/lib/utils'

/**
 * App header containing the board title, global search, theme toggle, and
 * new-card shortcut. The banner uses the theme's header gradient tokens so
 * it transitions cleanly between light and dark.
 */
export function Header() {
  const [addOpen, setAddOpen] = useState(false)
  const { searchQuery, setSearchQuery } = useFilterStore()
  const addCard = useBoardStore((s) => s.addCard)

  return (
    <header className="relative shrink-0">
      {/* Gradient banner */}
      <div
        className="px-6 pt-8 pb-16"
        style={{
          background: 'linear-gradient(135deg, var(--bg-header-from) 0%, var(--bg-header-to) 100%)',
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="text-3xl font-semibold tracking-tight"
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontWeight: 600,
                color: 'rgba(255,255,255,0.95)',
                letterSpacing: '-0.01em',
              }}
            >
              Project Board
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.50)' }}>
              Ideas, work in progress, and past projects
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer shrink-0"
              style={{
                background: 'rgba(255,255,255,0.14)',
                border: '1px solid rgba(255,255,255,0.22)',
                color: 'rgba(255,255,255,0.90)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <Plus size={15} strokeWidth={2} />
              New Card
            </button>
          </div>
        </div>
      </div>

      {/* Search bar overlapping the banner */}
      <div className="absolute bottom-0 translate-y-1/2 left-6 right-6">
        <div
          className="relative rounded-2xl flex items-center px-4 gap-2"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--rim)',
            backdropFilter: 'blur(16px) saturate(1.4)',
            boxShadow: '0 4px 24px var(--shadow-a), 0 1px 4px var(--shadow-b)',
          }}
        >
          <Search size={15} strokeWidth={1.8} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cards by title, description, or tag…"
            className={cn('flex-1 py-3.5 text-sm bg-transparent outline-none border-none')}
            style={{ color: 'var(--ink-primary)' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="transition-opacity cursor-pointer"
              style={{ color: 'var(--ink-faint)' }}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Add card dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent title="New card" description="Create a new card">
          <div className="px-6 pt-6 pb-2">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--ink-primary)' }}>New card</h2>
          </div>
          <CardForm
            onSubmit={async (data) => {
              try { await addCard(data); setAddOpen(false) }
              catch { /* error toast shown by store; keep dialog open for retry */ }
            }}
            onCancel={() => setAddOpen(false)}
            submitLabel="Create card"
          />
        </DialogContent>
      </Dialog>
    </header>
  )
}
