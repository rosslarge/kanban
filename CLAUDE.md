# Project Standards

## Documentation

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

## Tests

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

## Plans

All plans must be created in the `/docs` folder (e.g. `docs/api-plan.md`, `docs/plan.md`). Do not use the default `.claude/plans/` location.
