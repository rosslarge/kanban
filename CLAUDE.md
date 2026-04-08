# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A personal kanban board for organising software projects and ideas. Cards move through five stages: **Ideas → Planned → In Progress → Shipped → Retrospective**.

The board is designed for a single developer to track their own projects — past work (outcomes, lessons learned) and future work (raw ideas through active development). The Retrospective column serves as an archive where completed projects accumulate notes.

**Current state:** The frontend is fully built and works standalone using localStorage. The API is built and tested but not yet wired to the frontend — the frontend still reads/writes localStorage (`boardStore` with Zustand `persist`). Frontend–API integration is the next major phase (see `docs/frontend-plan.md`).

## Commands

### Frontend
```bash
npm run dev        # dev server — http://localhost:5173
npm run build      # tsc + vite production build
npm run preview    # preview production build locally
```

### API
```bash
# From src/api/
dotnet run                    # start API — http://localhost:5062
dotnet build                  # compile only
bash src/api/start.sh         # start Cosmos emulator then API (convenience script)
```

### Tests
```bash
# From tests/api/
dotnet test                                            # all tests (no emulator needed)
dotnet test --filter "Category!=EndToEnd"              # skip E2E tests
dotnet test --filter "Category=EndToEnd"               # only E2E tests (requires emulator)
dotnet test --filter "FullyQualifiedName~CardService"  # single test class
dotnet test --filter "DisplayName~MoveCard"            # single test by name fragment
```

---

## Project Standards

### Documentation

All methods and classes must be commented to describe their purpose, the parameters they accept, and what they return (if anything).

**C# example:**
```csharp
/// <summary>
/// Moves a card to a new column and/or position, recalculating positions of affected cards.
/// </summary>
/// <param name="userId">The ID of the user who owns the card.</param>
/// <param name="id">The ID of the card to move.</param>
/// <param name="request">The target column and position.</param>
/// <returns>The updated card, or null if the card was not found.</returns>
public async Task<Card?> MoveCardAsync(string userId, string id, MoveCardRequest request)
```

**TypeScript example:**
```typescript
/**
 * Returns a filtered and searched subset of cards for a given column.
 * @param columnId - The column to retrieve cards from.
 * @returns Cards matching the current search query and active filters, ordered by position.
 */
export function useFilteredCards(columnId: ColumnId): Card[]
```

### Tests

All tests must have a comment indicating their purpose — what behaviour they are verifying and why it matters.

**C# example:**
```csharp
[Fact]
// Verifies that moving a card to 'shipped' or 'retrospective' automatically sets completedAt,
// so the frontend can display a completion date.
public async Task MoveCard_ToShipped_SetsCompletedAt()
```

**TypeScript example:**
```typescript
// Ensures sidebar tag filters correctly scope the board view to matching cards only.
it('filters cards by active tag', () => {
```

### Plans

All plans must be created in the `/docs` folder (e.g. `docs/api-plan.md`). Do not use the default `.claude/plans/` location.

---

## Architecture

### Frontend

**Stack:** React 19 + TypeScript + Vite · Tailwind CSS v4 · @dnd-kit · Zustand (`persist` to localStorage) · lucide-react

**State:** `boardStore` owns cards and columns (normalised: `Record<string, Card>` + per-column `cardIds[]`). `filterStore` owns the search query and active tag/priority filters. `useFilteredCards(columnId)` derives the visible card list for a column by joining both stores.

**Drag & drop:** `Board.tsx` wraps everything in `DndContext`. Each `KanbanColumn` is a `useDroppable`. Each `KanbanCard` is a `useSortable`. `DragOverlay` renders the ghost card during a drag. Cross-column moves fire in `onDragOver`; same-column reorders fire in `onDragEnd`.

**Column IDs:** `ideas` | `planned` | `in-progress` | `shipped` | `retrospective`

### API

**Stack:** ASP.NET Core 10 Minimal API + Azure Cosmos DB (`Microsoft.Azure.Cosmos` 3.58.0)  
**Location:** `src/api/` · **Tests:** `tests/api/`

**Service layer:** `ICardRepository` abstracts Cosmos DB access. `ICardService` contains business logic (position management, `completedAt` stamping) and calls the repository. Endpoints call the service — they never touch the repository directly. This split is what makes the integration tests possible without the emulator.

#### Data model

```csharp
// Cosmos DB container: "cards", partition key: /userId
public class Card {
    public string Id { get; set; }          // document id
    public string UserId { get; set; }      // partition key — all of a user's cards co-located
    public string ColumnId { get; set; }    // column the card belongs to
    public int Position { get; set; }       // 0-based ordering within column
    public DateTime? CompletedAt { get; set; } // auto-set on move to shipped/retrospective
    // ... title, description, tags, priority, category, links, notes, createdAt
}
```

#### Key decisions

**Partition key `/userId`:** All of a user's cards sit in one partition so loading a full board is a single-partition query. Column filtering happens within the partition via a SQL `WHERE` clause.

**User resolution — `X-User-Id` header (pre-auth placeholder):** Reads the user ID from an `X-User-Id` header, defaulting to `"dev-user"`. `ICardService` always receives a `userId` parameter. When auth is added, this swaps to reading from JWT claims without changing the service interface.

**Position management — contiguous integer `position` field:** Card ordering is stored as an integer `position` on each document. On move/reorder, the service recalculates positions for all affected cards in source and destination columns (contiguous integers starting at 0).

**`completedAt` auto-stamping:** Moving a card to `shipped` or `retrospective` sets `completedAt` to UTC now. Moving it to any other column clears it. Enforced in `CardService.MoveCardAsync`.

**Cosmos emulator — `vnext-preview` image:** Native ARM64 (no Rosetta), uses plain HTTP on port 8081 (no self-signed certificate). Start via `bash src/api/start.sh`.

#### Endpoints

```
GET    /api/cards                  → all cards for current user
GET    /api/cards?columnId=ideas   → filtered by column
GET    /api/cards/{id}             → single card (404 if wrong user)
POST   /api/cards                  → create
PUT    /api/cards/{id}             → update fields
PATCH  /api/cards/{id}/move        → move to column + reorder
DELETE /api/cards/{id}             → delete (404 if wrong user)
GET    /api/board                  → all 5 columns with ordered cards
```

### Testing strategy (API)

**Unit tests** (`Services/`, `Endpoints/`) — mock `Container` via `CosmosContainerMockBuilder`. No external dependencies.

**Full-stack integration tests** (`Integration/`, non-E2E) — `KanbanApiFixture` swaps Cosmos for `InMemoryCardRepository`. Real `CardService` runs against it via real HTTP. No emulator needed.

**E2E Cosmos tests** (`EndToEndCosmosTests`, `[Trait("Category", "EndToEnd")]`) — `CosmosApiFixture` keeps real Cosmos registrations, connects to the local emulator, uses `kanban-e2e-tests` database (deleted after each run). Verifies SQL queries, partition key routing, SDK serialisation.

**Why the split:** The 20+ integration tests are emulator-free for everyday development. The 4 E2E tests exist solely to verify the Cosmos SDK layer — the one thing `InMemoryCardRepository` cannot test.
