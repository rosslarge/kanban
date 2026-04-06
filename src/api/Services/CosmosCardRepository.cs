using Kanban.Api.Models;
using Microsoft.Azure.Cosmos;

namespace Kanban.Api.Services;

/// <summary>
/// Azure Cosmos DB implementation of ICardRepository.
/// All queries are partition-scoped by userId to ensure data isolation between users
/// and efficient single-partition reads. SQL queries are used in preference to LINQ
/// to keep the Cosmos SDK's FeedIterator mockable in tests.
/// </summary>
public class CosmosCardRepository : ICardRepository
{
    private readonly Container _container;

    public CosmosCardRepository(Container container)
    {
        _container = container;
    }

    /// <summary>
    /// Queries all cards for a user within their partition, optionally filtered to one column.
    /// Results are ordered by position ascending so callers receive cards in display order.
    /// </summary>
    /// <param name="userId">The owning user's ID (Cosmos DB partition key).</param>
    /// <param name="columnId">Optional column filter. If null, all columns are returned.</param>
    public async Task<List<Card>> GetByUserAsync(string userId, string? columnId = null)
    {
        var sql = columnId is not null
            ? "SELECT * FROM c WHERE c.columnId = @columnId ORDER BY c.position"
            : "SELECT * FROM c ORDER BY c.position";

        var queryDef = new QueryDefinition(sql);
        if (columnId is not null)
            queryDef = queryDef.WithParameter("@columnId", columnId);

        var options = new QueryRequestOptions { PartitionKey = new PartitionKey(userId) };
        var iterator = _container.GetItemQueryIterator<Card>(queryDef, requestOptions: options);
        var cards = new List<Card>();

        while (iterator.HasMoreResults)
        {
            var response = await iterator.ReadNextAsync();
            cards.AddRange(response);
        }

        return cards;
    }

    /// <summary>
    /// Reads a card by its document ID within the user's partition.
    /// Returns null rather than throwing when the card does not exist.
    /// </summary>
    /// <param name="userId">The owning user's ID.</param>
    /// <param name="id">The Cosmos DB document ID of the card.</param>
    public async Task<Card?> GetByIdAsync(string userId, string id)
    {
        try
        {
            var response = await _container.ReadItemAsync<Card>(id, new PartitionKey(userId));
            return response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    /// <summary>
    /// Creates a new card document in Cosmos DB and returns the stored result.
    /// </summary>
    /// <param name="card">The card to persist. Must have Id and UserId already set.</param>
    public async Task<Card> CreateAsync(Card card)
    {
        var response = await _container.CreateItemAsync(card, new PartitionKey(card.UserId));
        return response.Resource;
    }

    /// <summary>
    /// Replaces an existing card document with updated values and returns the stored result.
    /// </summary>
    /// <param name="card">The full card document with updated fields.</param>
    public async Task<Card> UpdateAsync(Card card)
    {
        var response = await _container.ReplaceItemAsync(card, card.Id, new PartitionKey(card.UserId));
        return response.Resource;
    }

    /// <summary>
    /// Deletes a card document from Cosmos DB.
    /// </summary>
    /// <param name="userId">The owning user's ID.</param>
    /// <param name="id">The document ID of the card to delete.</param>
    public async Task DeleteAsync(string userId, string id)
    {
        await _container.DeleteItemAsync<Card>(id, new PartitionKey(userId));
    }
}
