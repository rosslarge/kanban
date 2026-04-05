import { nanoid } from 'nanoid'
import type { BoardCards, BoardColumns, Card } from '@/types'

function card(partial: Omit<Card, 'id' | 'createdAt' | 'completedAt' | 'links' | 'notes'>): Card {
  return {
    ...partial,
    id: nanoid(),
    links: [],
    notes: '',
    createdAt: new Date().toISOString(),
    completedAt: ['shipped', 'retrospective'].includes(partial.columnId)
      ? new Date(Date.now() - Math.random() * 1e10).toISOString()
      : null,
  }
}

export function buildSampleData(): { cards: BoardCards; columns: BoardColumns } {
  const sampleCards: Card[] = [
    card({ title: 'AI-powered code review tool', description: 'Use an LLM to review PRs and suggest improvements inline. Could be a GitHub Action or CLI.', tags: ['CLI Tool', 'ML / AI'], priority: 'high', category: 'DevTool', columnId: 'ideas' }),
    card({ title: 'Browser-based SQLite explorer', description: 'Drag-and-drop a .sqlite file and browse, query, and export data in the browser using WASM.', tags: ['Web App'], priority: 'medium', category: 'Web', columnId: 'ideas' }),
    card({ title: 'Homelab monitoring dashboard', description: 'Real-time metrics from my servers — CPU, RAM, disk, network — in a clean self-hosted UI.', tags: ['Web App', 'DevOps'], priority: 'low', category: 'Infrastructure', columnId: 'ideas' }),
    card({ title: 'RSS reader with AI summaries', description: 'Subscribe to feeds, get AI-generated TLDRs and topic clusters. Desktop or web.', tags: ['Web App', 'ML / AI'], priority: 'medium', category: 'Productivity', columnId: 'planned' }),
    card({ title: 'CLI habit tracker', description: 'Terminal-based habit tracker. Log daily check-ins, view streaks, export to CSV.', tags: ['CLI Tool'], priority: 'low', category: 'Productivity', columnId: 'planned' }),
    card({ title: 'Kanban board', description: 'Personal kanban board for organizing software projects. Built with React + dnd-kit.', tags: ['Web App'], priority: 'high', category: 'Productivity', columnId: 'in-progress' }),
    card({ title: 'Personal portfolio v3', description: 'Redesigned portfolio with project showcase, writing section, and contact form.', tags: ['Web App', 'Design'], priority: 'medium', category: 'Personal', columnId: 'in-progress' }),
    card({ title: 'Markdown note-taking CLI', description: 'Quick notes in the terminal. Fuzzy search, tags, export to HTML. Stored as flat files.', tags: ['CLI Tool'], priority: 'high', category: 'Productivity', columnId: 'shipped' }),
    card({ title: 'Link shortener service', description: 'Self-hosted URL shortener with analytics. Built on Cloudflare Workers + KV.', tags: ['API', 'Web App'], priority: 'medium', category: 'API', columnId: 'shipped' }),
    card({ title: 'ML image classifier experiment', description: 'Fine-tuned ResNet on a custom dataset of product images. Achieved 94% accuracy.', tags: ['ML / AI'], priority: 'low', category: 'ML', columnId: 'retrospective' }),
    card({ title: 'React component library', description: 'Internal design system. Migrated to it but it was over-engineered for team size. Lesson: start simple.', tags: ['Library', 'Web App', 'Design'], priority: 'medium', category: 'Design System', columnId: 'retrospective' }),
  ]

  const cards: BoardCards = {}
  const columns: BoardColumns = {
    ideas: { id: 'ideas', title: 'Ideas', cardIds: [] },
    planned: { id: 'planned', title: 'Planned', cardIds: [] },
    'in-progress': { id: 'in-progress', title: 'In Progress', cardIds: [] },
    shipped: { id: 'shipped', title: 'Shipped', cardIds: [] },
    retrospective: { id: 'retrospective', title: 'Retrospective', cardIds: [] },
  }

  for (const c of sampleCards) {
    cards[c.id] = c
    columns[c.columnId].cardIds.push(c.id)
  }

  return { cards, columns }
}
