using Kanban.Api.Models;

namespace Kanban.Api.Services;

/// <summary>
/// Defines raw data access operations for cards against the underlying store.
/// Implementations handle database-specific concerns (e.g. Cosmos DB queries and
/// partition key routing). Business logic lives in ICardService, not here.
/// </summary>
public interface ICardRepository
{
    /// <summary>
    /// Returns all cards for a user, optionally filtered to a single column.
    /// Results are ordered by ascending position.
    /// </summary>
    /// <param name="userId">The owning user's ID (Cosmos DB partition key).</param>
    /// <param name="columnId">Optional column filter. If null, returns cards from all columns.</param>
    Task<List<Card>> GetByUserAsync(string userId, string? columnId = null);

    /// <summary>
    /// Returns a single card by ID, or null if it does not exist or belongs to a different user.
    /// </summary>
    /// <param name="userId">The owning user's ID.</param>
    /// <param name="id">The card document ID.</param>
    Task<Card?> GetByIdAsync(string userId, string id);

    /// <summary>
    /// Persists a new card document and returns the created card as stored.
    /// </summary>
    /// <param name="card">The card to create. Must have a valid UserId set.</param>
    Task<Card> CreateAsync(Card card);

    /// <summary>
    /// Replaces an existing card document with the provided card and returns the updated card.
    /// </summary>
    /// <param name="card">The card with updated values. Id and UserId must match the existing document.</param>
    Task<Card> UpdateAsync(Card card);

    /// <summary>
    /// Deletes a card document by ID.
    /// </summary>
    /// <param name="userId">The owning user's ID.</param>
    /// <param name="id">The card document ID to delete.</param>
    Task DeleteAsync(string userId, string id);
}
