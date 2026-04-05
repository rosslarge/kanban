# Kanban Board for Software Projects

## Context
Build a personal kanban board web app for organizing software projects — both past work (archive, outcomes, lessons learned) and future work (ideas, plans, active development). Single unified board with a polished, Notion-like visual style.

## Architecture

**Tech stack**: React 18 + TypeScript + Vite  
**Styling**: Tailwind CSS v4 + shadcn/ui components  
**Drag & drop**: @dnd-kit/core + @dnd-kit/sortable  
**State**: Zustand with `persist` middleware (localStorage)  
**Icons**: lucide-react  
**Utilities**: nanoid, date-fns, clsx, tailwind-merge  

## Data Model

```typescript
type ColumnId = 'ideas' | 'planned' | 'in-progress' | 'shipped' | 'retrospective';
type Priority = 'high' | 'medium' | 'low';

interface Card {
  id: string;
  title: string;
  description: string;
  tags: string[];           // "Web App", "CLI Tool", "API", "ML", etc.
  priority: Priority;
  category: string;
  links: { label: string; url: string }[];
  notes: string;            // retrospective notes
  createdAt: string;        // ISO 8601
  completedAt: string | null;
  columnId: ColumnId;
}

// Columns store ordered card ID arrays. Cards normalized in a Record<string, Card>.
```

## File Structure

```
src/
├── main.tsx, App.tsx, index.css
├── types/index.ts
├── store/boardStore.ts, filterStore.ts
├── lib/utils.ts, constants.ts, sampleData.ts
├── hooks/useFilteredCards.ts, useDragHandlers.ts
├── components/
│   ├── ui/          (shadcn: Badge, Button, Dialog, Input, Select, Textarea, ScrollArea)
│   ├── Board.tsx    (DndContext, column layout)
│   ├── Column.tsx   (droppable + sortable container)
│   ├── Card.tsx     (draggable card with tags, priority, metadata)
│   ├── CardDetail.tsx (edit/view dialog)
│   ├── CardForm.tsx (create/edit form)
│   ├── Header.tsx   (gradient banner, search, "New Task" button)
│   ├── Sidebar.tsx  (branding, filters)
│   ├── FilterBar.tsx, SearchInput.tsx
│   ├── PriorityBadge.tsx, TagBadge.tsx
│   ├── DragOverlay.tsx, EmptyColumn.tsx
```

## Implementation Phases

### Phase 1: Scaffold & Static Layout
1. `npm create vite@latest . -- --template react-ts`
2. Install & configure Tailwind v4, shadcn/ui, all dependencies
3. Build `Header.tsx` — gradient banner, search bar, "New Task" button
4. Build `Board.tsx` with 5 `Column.tsx` components in horizontal flex
5. Build `Card.tsx` with sample data — tags, priority badges, hover effects
6. Build `Sidebar.tsx` with placeholder filters

### Phase 2: State & Persistence
1. `boardStore.ts` — Zustand store with cards, columns, CRUD ops, Zustand `persist` to localStorage
2. `filterStore.ts` — search query, tag/priority filters
3. `sampleData.ts` — 8-10 example cards seeded on first load
4. Wire Board/Column to read from store
5. `useFilteredCards.ts` — derived filtered card list

### Phase 3: Card CRUD
1. `CardForm.tsx` — all fields (title, description, tags, priority, category, links, notes)
2. `CardDetail.tsx` — Dialog wrapping CardForm, opens on card click
3. Wire "New Task" button, implement delete with confirmation
4. Auto-set `completedAt` when card moves to shipped/retrospective

### Phase 4: Drag & Drop
1. Wrap Board in `DndContext`, each Column in `SortableContext`
2. Cards as sortable items via `useSortable`
3. `useDragHandlers.ts` — onDragStart, onDragOver, onDragEnd
4. `DragOverlay.tsx` — ghost card during drag
5. `closestCorners` collision detection, `PointerSensor` + `TouchSensor`

### Phase 5: Polish
1. Wire search with debounce, build FilterBar with tag/priority toggles
2. Card hover effects (shadow lift), smooth transitions
3. Empty column placeholders
4. Column accent colors (blue=Ideas, yellow=Planned, green=In Progress, purple=Shipped, gray=Retrospective)
5. Responsive: horizontal scroll on narrow screens

## Visual Design Notes
- White cards on light gray column backgrounds, `rounded-xl shadow-sm`
- Tag colors: deterministic palette per tag name (blue=Web App, emerald=CLI, amber=API, purple=ML, rose=Mobile)
- Priority badges: red=High, amber=Medium, green=Low
- Header: `bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600`
- Column headers with card count badges

## Verification
1. `npm run dev` — app loads with sample data across all 5 columns
2. Create a new card via "New Task" — verify it appears in chosen column
3. Click a card — verify dialog opens with all fields editable
4. Drag a card between columns — verify it moves and persists after refresh
5. Use search and filters — verify cards filter correctly
6. Refresh browser — verify all data persists from localStorage
