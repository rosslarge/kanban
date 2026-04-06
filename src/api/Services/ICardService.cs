using Kanban.Api.Models;

namespace Kanban.Api.Services;

/// <summary>
/// Defines the business operations available for kanban cards.
/// All operations are scoped to a specific user — callers must supply a userId,
/// which comes from the request header now and JWT claims once auth is added.
/// </summary>
public interface ICardService
{
    /// <summary>
    /// Returns all cards for the given user, optionally filtered to a specific column.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="columnId">Optional column filter. If null, all columns are included.</param>
    Task<List<Card>> GetCardsAsync(string userId, string? columnId = null);

    /// <summary>
    /// Returns a single card by ID, or null if not found or not owned by the user.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="id">The card ID.</param>
    Task<Card?> GetCardAsync(string userId, string id);

    /// <summary>
    /// Creates a new card for the user, appending it at the end of the target column.
    /// Sets createdAt automatically. Sets completedAt if the target column is shipped or retrospective.
    /// </summary>
    /// <param name="userId">The ID of the owning user.</param>
    /// <param name="request">The card data to create.</param>
    /// <returns>The newly created card.</returns>
    Task<Card> CreateCardAsync(string userId, CreateCardRequest request);

    /// <summary>
    /// Applies a partial update to a card. Only non-null fields in the request are changed.
    /// If ColumnId changes, triggers a move to the end of the new column.
    /// </summary>
    /// <param name="userId">The ID of the owning user.</param>
    /// <param name="id">The ID of the card to update.</param>
    /// <param name="request">Fields to update. Null fields are ignored.</param>
    /// <returns>The updated card, or null if not found.</returns>
    Task<Card?> UpdateCardAsync(string userId, string id, UpdateCardRequest request);

    /// <summary>
    /// Moves a card to a new column and/or position, recalculating the positions of
    /// all affected cards in both source and destination columns.
    /// </summary>
    /// <param name="userId">The ID of the owning user.</param>
    /// <param name="id">The ID of the card to move.</param>
    /// <param name="request">The target column and position.</param>
    /// <returns>The moved card, or null if not found.</returns>
    Task<Card?> MoveCardAsync(string userId, string id, MoveCardRequest request);

    /// <summary>
    /// Deletes a card and renormalises the positions of remaining cards in its column.
    /// </summary>
    /// <param name="userId">The ID of the owning user.</param>
    /// <param name="id">The ID of the card to delete.</param>
    /// <returns>True if the card was found and deleted; false if not found.</returns>
    Task<bool> DeleteCardAsync(string userId, string id);

    /// <summary>
    /// Returns the full board state for a user: all five columns with their cards
    /// pre-sorted by position, ready for the frontend to render.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    Task<BoardResponse> GetBoardAsync(string userId);
}
