using Kanban.Api.Models;

namespace Kanban.Api.Services;

/// <summary>
/// Implements ICardService with all kanban business logic: CRUD, position management,
/// user scoping, and automatic completedAt stamping.
/// Delegates all data access to ICardRepository, keeping this class free of
/// database-specific concerns and fully unit-testable via mocking.
/// </summary>
public class CardService : ICardService
{
    private readonly ICardRepository _repo;

    /// <summary>Column IDs that represent completed work and trigger setting completedAt.</summary>
    private static readonly string[] CompletedColumns = ["shipped", "retrospective"];

    /// <summary>Display titles for all five board columns, used when building the board response.</summary>
    private static readonly Dictionary<string, string> ColumnTitles = new()
    {
        ["ideas"] = "Ideas",
        ["planned"] = "Planned",
        ["in-progress"] = "In Progress",
        ["shipped"] = "Shipped",
        ["retrospective"] = "Retrospective"
    };

    public CardService(ICardRepository repo)
    {
        _repo = repo;
    }

    /// <summary>
    /// Returns all cards for the user, optionally filtered to a specific column.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="columnId">Optional column filter.</param>
    public Task<List<Card>> GetCardsAsync(string userId, string? columnId = null) =>
        _repo.GetByUserAsync(userId, columnId);

    /// <summary>
    /// Returns a single card, or null if not found or not owned by the user.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="id">The card ID.</param>
    public Task<Card?> GetCardAsync(string userId, string id) =>
        _repo.GetByIdAsync(userId, id);

    /// <summary>
    /// Creates a card appended at the end of its target column.
    /// Position is calculated as max(existing positions) + 1, or 0 for an empty column.
    /// Sets completedAt if the target column is "shipped" or "retrospective".
    /// </summary>
    /// <param name="userId">The owning user's ID.</param>
    /// <param name="request">The card fields to set.</param>
    /// <returns>The newly created card.</returns>
    public async Task<Card> CreateCardAsync(string userId, CreateCardRequest request)
    {
        var existing = await _repo.GetByUserAsync(userId, request.ColumnId);
        var position = existing.Count > 0 ? existing.Max(c => c.Position) + 1 : 0;

        var card = new Card
        {
            Id = Guid.NewGuid().ToString(),
            UserId = userId,
            Title = request.Title,
            Description = request.Description,
            Tags = request.Tags,
            Priority = request.Priority,
            Category = request.Category,
            Links = request.Links,
            Notes = request.Notes,
            ColumnId = request.ColumnId,
            Position = position,
            CreatedAt = DateTime.UtcNow,
            CompletedAt = CompletedColumns.Contains(request.ColumnId) ? DateTime.UtcNow : null
        };

        return await _repo.CreateAsync(card);
    }

    /// <summary>
    /// Applies a partial update — only non-null request fields overwrite the card's current values.
    /// If ColumnId is supplied and differs from the card's current column, delegates to MoveCardAsync.
    /// </summary>
    /// <param name="userId">The owning user's ID.</param>
    /// <param name="id">The ID of the card to update.</param>
    /// <param name="request">Fields to update. Null values are ignored.</param>
    /// <returns>The updated card, or null if not found.</returns>
    public async Task<Card?> UpdateCardAsync(string userId, string id, UpdateCardRequest request)
    {
        var card = await _repo.GetByIdAsync(userId, id);
        if (card is null) return null;

        if (request.Title is not null) card.Title = request.Title;
        if (request.Description is not null) card.Description = request.Description;
        if (request.Tags is not null) card.Tags = request.Tags;
        if (request.Priority is not null) card.Priority = request.Priority;
        if (request.Category is not null) card.Category = request.Category;
        if (request.Links is not null) card.Links = request.Links;
        if (request.Notes is not null) card.Notes = request.Notes;

        if (request.ColumnId is not null && request.ColumnId != card.ColumnId)
            return await MoveCardAsync(userId, id, new MoveCardRequest(request.ColumnId, int.MaxValue));

        return await _repo.UpdateAsync(card);
    }

    /// <summary>
    /// Moves a card to a target column and position, recalculating positions for all
    /// affected cards. Handles both same-column reorders and cross-column moves.
    /// Automatically sets completedAt when moving into "shipped" or "retrospective"
    /// if completedAt has not already been set.
    /// </summary>
    /// <param name="userId">The owning user's ID.</param>
    /// <param name="id">The ID of the card to move.</param>
    /// <param name="request">Target column and zero-based position (clamped to valid range).</param>
    /// <returns>The moved card with updated position and column, or null if not found.</returns>
    public async Task<Card?> MoveCardAsync(string userId, string id, MoveCardRequest request)
    {
        var card = await _repo.GetByIdAsync(userId, id);
        if (card is null) return null;

        var fromColumnId = card.ColumnId;
        var toColumnId = request.ToColumnId;

        if (fromColumnId == toColumnId)
        {
            var columnCards = (await _repo.GetByUserAsync(userId, fromColumnId))
                .OrderBy(c => c.Position).ToList();

            var oldIndex = columnCards.FindIndex(c => c.Id == id);
            if (oldIndex < 0) return null;

            columnCards.RemoveAt(oldIndex);
            columnCards.Insert(Math.Clamp(request.ToPosition, 0, columnCards.Count), card);

            await RenormalisePositionsAsync(userId, columnCards);
            return await _repo.GetByIdAsync(userId, id);
        }
        else
        {
            var sourceCards = (await _repo.GetByUserAsync(userId, fromColumnId))
                .OrderBy(c => c.Position)
                .Where(c => c.Id != id)
                .ToList();

            var destCards = (await _repo.GetByUserAsync(userId, toColumnId))
                .OrderBy(c => c.Position)
                .ToList();

            card.ColumnId = toColumnId;
            if (CompletedColumns.Contains(toColumnId) && card.CompletedAt is null)
                card.CompletedAt = DateTime.UtcNow;

            destCards.Insert(Math.Clamp(request.ToPosition, 0, destCards.Count), card);

            await RenormalisePositionsAsync(userId, sourceCards);
            await RenormalisePositionsAsync(userId, destCards);

            return await _repo.UpdateAsync(card);
        }
    }

    /// <summary>
    /// Deletes a card and renormalises the positions of remaining cards in the same column
    /// so there are no gaps in the position sequence.
    /// </summary>
    /// <param name="userId">The owning user's ID.</param>
    /// <param name="id">The ID of the card to delete.</param>
    /// <returns>True if deleted; false if the card was not found.</returns>
    public async Task<bool> DeleteCardAsync(string userId, string id)
    {
        var card = await _repo.GetByIdAsync(userId, id);
        if (card is null) return false;

        await _repo.DeleteAsync(userId, id);

        var remaining = (await _repo.GetByUserAsync(userId, card.ColumnId))
            .OrderBy(c => c.Position).ToList();
        await RenormalisePositionsAsync(userId, remaining);

        return true;
    }

    /// <summary>
    /// Builds the full board response for the user: all five columns populated with
    /// their cards sorted by position, in the shape the frontend expects.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    public async Task<BoardResponse> GetBoardAsync(string userId)
    {
        var allCards = await _repo.GetByUserAsync(userId);
        var board = new BoardResponse();

        foreach (var (colId, colTitle) in ColumnTitles)
        {
            board.Columns[colId] = new ColumnResponse
            {
                Id = colId,
                Title = colTitle,
                Cards = allCards
                    .Where(c => c.ColumnId == colId)
                    .OrderBy(c => c.Position)
                    .ToList()
            };
        }

        return board;
    }

    /// <summary>
    /// Reassigns zero-based sequential positions to a list of cards, persisting only
    /// the cards whose position value has changed. Runs updates in parallel.
    /// </summary>
    /// <param name="userId">The owning user's ID, required for the repository update call.</param>
    /// <param name="cards">Cards in their desired display order.</param>
    private async Task RenormalisePositionsAsync(string userId, List<Card> cards)
    {
        var tasks = cards.Select((card, index) =>
        {
            if (card.Position == index) return Task.CompletedTask;
            card.Position = index;
            return _repo.UpdateAsync(card).ContinueWith(_ => { });
        });

        await Task.WhenAll(tasks);
    }
}
