using System.Collections.Concurrent;
using System.Text.Json;
using Kanban.Api.Models;
using Kanban.Api.Services;

namespace Kanban.Api.Tests.Helpers;

/// <summary>
/// In-memory implementation of <see cref="ICardRepository"/> for integration tests.
/// Backed by a <see cref="ConcurrentDictionary{TKey, TValue}"/> so tests can run
/// the full CardService pipeline without a Cosmos DB emulator.
/// Create and Update return deep copies (via JSON round-trip) to match the Cosmos SDK
/// behaviour of returning a deserialized server-side document.
/// </summary>
public class InMemoryCardRepository : ICardRepository
{
    private readonly ConcurrentDictionary<string, Card> _store = new();

    /// <summary>
    /// Returns all cards for the given user, optionally filtered to a single column,
    /// ordered by ascending position.
    /// </summary>
    /// <param name="userId">The owning user's ID.</param>
    /// <param name="columnId">Optional column filter. If null, returns cards from all columns.</param>
    public Task<List<Card>> GetByUserAsync(string userId, string? columnId = null)
    {
        var cards = _store.Values
            .Where(c => c.UserId == userId)
            .Where(c => columnId is null || c.ColumnId == columnId)
            .OrderBy(c => c.Position)
            .Select(DeepCopy)
            .ToList();

        return Task.FromResult(cards);
    }

    /// <summary>
    /// Returns a single card by ID if it belongs to the given user, or null otherwise.
    /// </summary>
    /// <param name="userId">The owning user's ID.</param>
    /// <param name="id">The card document ID.</param>
    public Task<Card?> GetByIdAsync(string userId, string id)
    {
        if (_store.TryGetValue(id, out var card) && card.UserId == userId)
            return Task.FromResult<Card?>(DeepCopy(card));

        return Task.FromResult<Card?>(null);
    }

    /// <summary>
    /// Stores a new card and returns a deep copy of the stored document.
    /// </summary>
    /// <param name="card">The card to create. Must have Id and UserId already set.</param>
    public Task<Card> CreateAsync(Card card)
    {
        var stored = DeepCopy(card);
        _store[stored.Id] = stored;
        return Task.FromResult(DeepCopy(stored));
    }

    /// <summary>
    /// Replaces an existing card document and returns a deep copy of the updated document.
    /// </summary>
    /// <param name="card">The card with updated values.</param>
    public Task<Card> UpdateAsync(Card card)
    {
        var stored = DeepCopy(card);
        _store[stored.Id] = stored;
        return Task.FromResult(DeepCopy(stored));
    }

    /// <summary>
    /// Removes a card from the store.
    /// </summary>
    /// <param name="userId">The owning user's ID.</param>
    /// <param name="id">The card document ID to delete.</param>
    public Task DeleteAsync(string userId, string id)
    {
        _store.TryRemove(id, out _);
        return Task.CompletedTask;
    }

    /// <summary>
    /// Removes all cards from the store. Used between tests to ensure isolation.
    /// </summary>
    public void Clear() => _store.Clear();

    /// <summary>
    /// Creates a deep copy of a card via JSON serialization round-trip,
    /// matching the Cosmos SDK behaviour of returning a fresh deserialized object.
    /// </summary>
    /// <param name="card">The card to copy.</param>
    /// <returns>A new Card instance with identical values.</returns>
    private static Card DeepCopy(Card card) =>
        JsonSerializer.Deserialize<Card>(JsonSerializer.Serialize(card))!;
}
