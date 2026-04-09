# API Storage Integration Plan

## Context

The Kanban frontend currently stores all data in localStorage via Zustand's `persist` middleware. The C# ASP.NET Core backend API already exists and is feature-complete for card CRUD, but the frontend doesn't call it. This plan wires the frontend to the API with:

- Configurable storage backend (`local` vs `api`) via env var
- Retry with exponential backoff for transient errors
- Toast notifications (user-friendly messages, retry status)
- Optimistic updates with rollback for drag-and-drop and edits

---

## Architecture

```
VITE_STORAGE_BACKEND env var
        ↓
src/config.ts
        ↓
src/services/storage/index.ts  →  localAdapter (no-op stub)
                               →  apiAdapter (HTTP calls via apiClient)
        ↓
src/services/apiClient.ts  →  fetch with retry + sonner toasts
        ↓
src/store/boardStore.ts  →  async actions, optimistic updates, rollback
        ↓
Components (CardForm, Header, KanbanColumn, CardDetail, Board)
```

---

## Key Design Decisions

**`addCard` is NOT optimistic** — the server generates the UUID, so we wait for the API response before inserting into the store. The form shows a "Saving..." state while the request is in flight. On failure the form stays open for retry.

**All other mutations ARE optimistic** — `updateCard`, `deleteCard`, `moveCard`, `reorderCard` update the store immediately then call the API in the background. On failure: rollback the store state + show `toast.error`.

**No `persist` middleware in API mode** — localStorage conflicts with the server as source of truth. Local mode keeps `persist` unchanged.

---

## Files to Create

### `src/config.ts`
Reads `import.meta.env.VITE_STORAGE_BACKEND` at module load time.

```typescript
const backend = import.meta.env.VITE_STORAGE_BACKEND ?? 'local'
export const config = {
  storageBackend: backend as 'local' | 'api',
  apiBaseUrl: 'http://localhost:5062',
  apiUserId: 'dev-user',
} as const
```

### `src/services/storage/types.ts`
`StorageAdapter` interface + input types.

```typescript
export interface StorageAdapter {
  loadBoard(): Promise<{ cards: BoardCards; columns: BoardColumns }>
  addCard(data: AddCardInput): Promise<Card>
  updateCard(id: string, updates: UpdateCardInput): Promise<Card>
  deleteCard(id: string): Promise<void>
  moveCard(cardId: string, toColumnId: ColumnId, toPosition: number): Promise<void>
}
```

### `src/services/apiClient.ts`
`apiFetch` with retry loop (max 4 total attempts: 1 initial + 3 retries):
- Delays: 1 000 ms, 2 000 ms, 4 000 ms (backoff = `2^(attempt-1) * 1000`)
- Show `toast.loading("Retrying... (attempt X of 3)", { id: toastId })` during each delay — same `toastId` so toasts update in-place rather than stacking
- 4xx → throw immediately (no retry)
- Network error or 5xx → retry, then `toast.error` on final failure
- Exports `apiClient.get/post/put/patch/delete` convenience wrappers

### `src/services/storage/localAdapter.ts`
A stub that throws on every method — satisfies the interface but should never be called (Zustand `persist` handles local mode automatically).

### `src/services/storage/apiAdapter.ts`
Implements `StorageAdapter` via `apiClient`. Key mapping in `loadBoard`:

The API returns `{ columns: { [colId]: { id, title, cards: ApiCard[] } } }` where cards are sorted by `position` ascending. Map to normalized store shape:
- Iterate `COLUMN_ORDER` (guarantees all 5 columns present)
- Strip `userId` and `position` from each `ApiCard` before storing
- `cardIds` array order preserves API card array order (already position-sorted)

`moveCard` and `reorderCard` both map to `PATCH /api/cards/{id}/move` with `{ toColumnId, toPosition }`.

### `src/services/storage/index.ts`
Selects adapter at module-load time based on `config.storageBackend`.

### `.env.local`
```
VITE_STORAGE_BACKEND=api
```
(gitignored by Vite by default; default is `local` if absent)

---

## Files to Modify

### `src/vite-env.d.ts`
Add `VITE_STORAGE_BACKEND?: string` to `ImportMetaEnv` interface.

### `src/store/boardStore.ts`
Critical changes:

1. **Conditional persist middleware** at store creation time:
   ```typescript
   const storeFn: StateCreator<BoardState & BoardActions> = (set, get) => ({ ... })
   
   export const useBoardStore = config.storageBackend === 'api'
     ? create<BoardState & BoardActions>()(storeFn)
     : create<BoardState & BoardActions>()(persist(storeFn, { name: 'kanban-board-v1' }))
   ```

2. **`initialize()` becomes `async`**:
   - Local mode: existing logic unchanged (seed sample data if `!initialized`)
   - API mode: call `storageAdapter.loadBoard()`, set cards + columns, set `initialized: true`; on failure `toast.error`

3. **`addCard()` becomes `async Promise<string>`**:
   - Local mode: existing `nanoid()` sync logic, wrapped in `Promise.resolve`
   - API mode: call `await storageAdapter.addCard(data)`, insert the returned card (with server UUID) into store, return `card.id`

4. **`updateCard()` — optimistic + rollback**:
   ```
   snapshot = get().cards[id]
   set(optimistic update)
   try { await storageAdapter.updateCard(id, updates) }
   catch { set(restore snapshot); toast.error(...); throw }
   ```

5. **`deleteCard()` — optimistic + rollback**:
   Snapshot: `{ card, prevCardIds }`. Remove optimistically. On failure: restore card and column's `cardIds`.

6. **`moveCard()` — optimistic + rollback**:
   Snapshot: `{ prevCards, prevColumns }`. Move optimistically (existing logic). On failure: `set({ cards: prevCards, columns: prevColumns })`.

7. **`reorderCard()` — optimistic + rollback**:
   Snapshot: `prevCardIds`. Extract `cardId = get().columns[columnId].cardIds[fromIndex]`. Reorder optimistically. On failure: restore `cardIds`. API call: `storageAdapter.moveCard(cardId, columnId, toIndex)`.

### `src/components/CardForm.tsx`
- Change `onSubmit` prop to `(data: ...) => Promise<void>`
- Add `isSubmitting` local state
- `handleSubmit` becomes `async`, calls `await onSubmit(...)` inside try/finally
- Submit button: `disabled={isSubmitting}`, text switches to `"Saving..."` when loading

### `src/components/Header.tsx` (line 62)
```typescript
onSubmit={async (data) => {
  try { await addCard(data); setAddOpen(false) }
  catch { /* toast shown by store; keep dialog open for retry */ }
}}
```

### `src/components/KanbanColumn.tsx` (line 73)
Same pattern as `Header.tsx`.

### `src/components/CardDetail.tsx`
- `handleUpdate` → `async`, awaits `updateCard` then `moveCard`; catches to keep edit open on failure
- `handleDelete` → `async`, awaits `deleteCard`; calls `onClose()` only on success
- `CardForm onSubmit` prop → `async (data) => handleUpdate(data)`

### `src/components/Board.tsx`
`moveCard` and `reorderCard` calls return Promises now. Fire-and-forget with `void` prefix to suppress unused-promise lint warnings:
```typescript
void moveCard(activeId, toCol, insertIndex)
void reorderCard(col, fromIndex, toIndex)
```

### `src/App.tsx`
- Import and render `<Toaster position="bottom-right" richColors />` from `sonner`
- Cast `initialize()` as void: `void initialize()` in `useEffect`

### `package.json`
Add `sonner` dependency via `npm install sonner`.

---

## Implementation Order

```
1.  npm install sonner
2.  src/vite-env.d.ts          — env type declaration
3.  src/config.ts              — env var reading
4.  .env.local                 — VITE_STORAGE_BACKEND=api
5.  src/services/storage/types.ts
6.  src/services/apiClient.ts  — fetch + retry + toast
7.  src/services/storage/localAdapter.ts
8.  src/services/storage/apiAdapter.ts
9.  src/services/storage/index.ts
10. src/store/boardStore.ts     — async actions, optimistic rollback
11. src/components/CardForm.tsx — async onSubmit, isSubmitting state
12. src/components/Header.tsx
13. src/components/KanbanColumn.tsx
14. src/components/CardDetail.tsx
15. src/components/Board.tsx
16. src/App.tsx                 — Toaster
```

---

## Verification

1. **Local mode** (`VITE_STORAGE_BACKEND` unset or `local`): Board behaves identically to current. No toast imports cause errors. localStorage key `kanban-board-v1` present in DevTools.

2. **API mode** (`VITE_STORAGE_BACKEND=api`, API running on port 5062):
   - Board loads via `GET /api/board` on init
   - `localStorage` has no `kanban-board-v1` key
   - Add card: form shows "Saving..." during POST; card appears after response; dialog closes on success; stays open on failure
   - Edit/delete: changes appear immediately (optimistic); error toast + rollback if API fails
   - Drag-and-drop: instant visual feedback; background PATCH fires; card snaps back + toast on failure
   - Refresh: board reloads from API, same state

3. **Retry flow** (simulate 5xx): Edit a card while server is returning 500. Three "Retrying..." toasts appear in succession, then a `toast.error` with the card snapping back to its original value.

4. **4xx flow**: Force a 404 (update a card that doesn't exist server-side). Single `toast.error` immediately, no retry toasts.

5. **TypeScript**: `npx tsc --noEmit` passes with zero errors.
