using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Kanban.Api.Models;
using Kanban.Api.Tests.Helpers;

namespace Kanban.Api.Tests.Integration;

/// <summary>
/// End-to-end tests that exercise the full stack from HTTP requests through to the
/// real Cosmos DB emulator. These tests verify that <see cref="Kanban.Api.Services.CosmosCardRepository"/>
/// SQL queries, partition key routing, and SDK serialization work correctly in the
/// complete pipeline — the one layer that the in-memory integration tests do not cover.
/// Requires the Cosmos DB emulator to be running on localhost:8081.
/// </summary>
[Trait("Category", "EndToEnd")]
public class EndToEndCosmosTests : IClassFixture<CosmosApiFixture>
{
    private readonly CosmosApiFixture _fixture;
    private readonly HttpClient _client;

    public EndToEndCosmosTests(CosmosApiFixture fixture)
    {
        _fixture = fixture;
        _client = _fixture.CreateClientForUser("e2e-test-user");
    }

    /// <summary>
    /// Creates a card in the given column via POST and returns the created card.
    /// </summary>
    /// <param name="client">The HttpClient to use (determines the user via X-User-Id header).</param>
    /// <param name="title">The card title.</param>
    /// <param name="columnId">The target column ID.</param>
    /// <returns>The created card.</returns>
    private static async Task<Card> CreateCardAsync(HttpClient client, string title, string columnId = "ideas")
    {
        var request = new CreateCardRequest(title, "E2E description", ["e2e"], "medium", "Test", [], "", columnId);
        var response = await client.PostAsJsonAsync("/api/cards", request);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        return (await response.Content.ReadFromJsonAsync<Card>())!;
    }

    // Verifies the full CRUD lifecycle against Cosmos DB: create, read, update, and delete
    // a card, confirming each operation is persisted to and retrieved from the real database.
    [Fact]
    public async Task CrudLifecycle_WorksAgainstRealCosmos()
    {
        // Create
        var created = await CreateCardAsync(_client, "E2E Card");
        created.Id.Should().NotBeNullOrEmpty();
        created.Title.Should().Be("E2E Card");
        created.UserId.Should().Be("e2e-test-user");

        // Read
        var getResponse = await _client.GetAsync($"/api/cards/{created.Id}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var fetched = await getResponse.Content.ReadFromJsonAsync<Card>();
        fetched!.Id.Should().Be(created.Id);
        fetched.Title.Should().Be("E2E Card");
        fetched.Description.Should().Be("E2E description");
        fetched.Tags.Should().BeEquivalentTo(["e2e"]);

        // Update
        var update = new UpdateCardRequest("Updated E2E Card", null, null, null, null, null, null, null);
        var putResponse = await _client.PutAsJsonAsync($"/api/cards/{created.Id}", update);
        putResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var updated = await _client.GetFromJsonAsync<Card>($"/api/cards/{created.Id}");
        updated!.Title.Should().Be("Updated E2E Card");
        updated.Description.Should().Be("E2E description", "unchanged fields should be preserved");

        // Delete
        var deleteResponse = await _client.DeleteAsync($"/api/cards/{created.Id}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var gone = await _client.GetAsync($"/api/cards/{created.Id}");
        gone.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // Verifies that card positions are managed correctly in Cosmos DB: sequential assignment
    // on create, and correct reordering after a same-column move.
    [Fact]
    public async Task PositionManagement_WorksAgainstRealCosmos()
    {
        var a = await CreateCardAsync(_client, "Pos A", "planned");
        var b = await CreateCardAsync(_client, "Pos B", "planned");
        var c = await CreateCardAsync(_client, "Pos C", "planned");

        // Verify sequential positions
        var cards = await _client.GetFromJsonAsync<List<Card>>("/api/cards?columnId=planned");
        cards.Should().HaveCount(3);
        cards![0].Id.Should().Be(a.Id);
        cards[0].Position.Should().Be(0);
        cards[1].Id.Should().Be(b.Id);
        cards[1].Position.Should().Be(1);
        cards[2].Id.Should().Be(c.Id);
        cards[2].Position.Should().Be(2);

        // Move A to position 2 (end)
        var moveRequest = new MoveCardRequest("planned", 2);
        await _client.PatchAsJsonAsync($"/api/cards/{a.Id}/move", moveRequest);

        var reordered = await _client.GetFromJsonAsync<List<Card>>("/api/cards?columnId=planned");
        reordered![0].Id.Should().Be(b.Id, "B should now be first");
        reordered[1].Id.Should().Be(c.Id, "C should now be second");
        reordered[2].Id.Should().Be(a.Id, "A should now be last");
    }

    // Verifies that the board endpoint returns correct aggregate state from Cosmos DB,
    // including completedAt being set when a card is moved to the shipped column.
    [Fact]
    public async Task BoardAndCompletedAt_WorkAgainstRealCosmos()
    {
        var card = await CreateCardAsync(_client, "Ship Me", "ideas");
        card.CompletedAt.Should().BeNull();

        // Move to shipped — should set completedAt
        await _client.PatchAsJsonAsync($"/api/cards/{card.Id}/move", new MoveCardRequest("shipped", 0));

        var board = await _client.GetFromJsonAsync<BoardResponse>("/api/board");
        board!.Columns.Should().HaveCount(5, "all five columns should always be present");

        var shippedCards = board.Columns["shipped"].Cards;
        shippedCards.Should().Contain(c => c.Id == card.Id);
        shippedCards.First(c => c.Id == card.Id).CompletedAt.Should().NotBeNull(
            "moving to shipped should auto-set completedAt in Cosmos DB");
    }

    // Verifies that Cosmos DB partition key scoping prevents one user from accessing
    // another user's cards, returning 404 rather than the card.
    [Fact]
    public async Task UserIsolation_WorksAgainstRealCosmos()
    {
        var userA = _fixture.CreateClientForUser("cosmos-user-a");
        var userB = _fixture.CreateClientForUser("cosmos-user-b");

        var card = await CreateCardAsync(userA, "User A's Card");

        // User B should not see User A's card
        var response = await userB.GetAsync($"/api/cards/{card.Id}");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        // User A should still see it
        var ownerResponse = await userA.GetAsync($"/api/cards/{card.Id}");
        ownerResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
