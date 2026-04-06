using Kanban.Api.Models;
using Microsoft.Azure.Cosmos;
using Moq;

namespace Kanban.Api.Tests.Helpers;

/// <summary>
/// Builds a mocked Cosmos DB Container pre-seeded with cards.
/// </summary>
public class CosmosContainerMockBuilder
{
    private readonly List<Card> _cards = [];

    public CosmosContainerMockBuilder WithCard(Card card)
    {
        _cards.Add(card);
        return this;
    }

    public CosmosContainerMockBuilder WithCards(IEnumerable<Card> cards)
    {
        _cards.AddRange(cards);
        return this;
    }

    public (Mock<Container> Mock, List<Card> Store) Build()
    {
        var store = new List<Card>(_cards);
        var mock = new Mock<Container>();

        // ReadItemAsync — find by id and userId (partition key)
        mock.Setup(c => c.ReadItemAsync<Card>(
                It.IsAny<string>(),
                It.IsAny<PartitionKey>(),
                It.IsAny<ItemRequestOptions>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((string id, PartitionKey pk, ItemRequestOptions? _, CancellationToken _) =>
            {
                var card = store.FirstOrDefault(c => c.Id == id);
                if (card is null)
                    throw new CosmosException("Not found", System.Net.HttpStatusCode.NotFound, 0, "", 0);
                return CreateItemResponse(card);
            });

        // CreateItemAsync
        mock.Setup(c => c.CreateItemAsync(
                It.IsAny<Card>(),
                It.IsAny<PartitionKey?>(),
                It.IsAny<ItemRequestOptions>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((Card card, PartitionKey? _, ItemRequestOptions? _, CancellationToken _) =>
            {
                store.Add(card);
                return CreateItemResponse(card);
            });

        // ReplaceItemAsync
        mock.Setup(c => c.ReplaceItemAsync(
                It.IsAny<Card>(),
                It.IsAny<string>(),
                It.IsAny<PartitionKey?>(),
                It.IsAny<ItemRequestOptions>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((Card card, string id, PartitionKey? _, ItemRequestOptions? _, CancellationToken _) =>
            {
                var idx = store.FindIndex(c => c.Id == id);
                if (idx >= 0) store[idx] = card;
                return CreateItemResponse(card);
            });

        // DeleteItemAsync
        mock.Setup(c => c.DeleteItemAsync<Card>(
                It.IsAny<string>(),
                It.IsAny<PartitionKey>(),
                It.IsAny<ItemRequestOptions>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((string id, PartitionKey _, ItemRequestOptions? _, CancellationToken _) =>
            {
                store.RemoveAll(c => c.Id == id);
                return CreateItemResponse<Card>(default!);
            });

        // GetItemLinqQueryable — return a queryable over the in-memory store
        mock.Setup(c => c.GetItemLinqQueryable<Card>(
                It.IsAny<bool>(),
                It.IsAny<string?>(),
                It.IsAny<QueryRequestOptions?>(),
                It.IsAny<CosmosLinqSerializerOptions?>()))
            .Returns((bool _, string? _, QueryRequestOptions? opts, CosmosLinqSerializerOptions? _) =>
            {
                // Simulate partition key filtering by userId
                var userId = opts?.PartitionKey?.ToString()?.Trim('"');
                IQueryable<Card> q = userId is not null
                    ? store.Where(c => c.UserId == userId).AsQueryable()
                    : store.AsQueryable();
                return q.OrderBy(c => c.Position) as IOrderedQueryable<Card>
                    ?? store.AsQueryable().OrderBy(c => c.Position);
            });

        return (mock, store);
    }

    private static ItemResponse<T> CreateItemResponse<T>(T resource)
    {
        var responseMock = new Mock<ItemResponse<T>>();
        responseMock.SetupGet(r => r.Resource).Returns(resource);
        return responseMock.Object;
    }
}

