using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Kanban.Api.Models;
using Kanban.Api.Tests.Helpers;

namespace Kanban.Api.Tests.Integration;

/// <summary>
/// Integration tests verifying that multi-user isolation works correctly through the
/// full HTTP pipeline. Each user should only see and modify their own cards, enforced
/// by the userId middleware and partition-scoped repository queries.
/// </summary>
public class UserIsolationTests : IClassFixture<KanbanApiFixture>
{
    private readonly KanbanApiFixture _fixture;

    public UserIsolationTests(KanbanApiFixture fixture)
    {
        _fixture = fixture;
        _fixture.Repository.Clear();
    }

    /// <summary>
    /// Creates a card via POST for the given client and returns the created card.
    /// </summary>
    /// <param name="client">The HttpClient with a pre-set X-User-Id header.</param>
    /// <param name="title">The card title.</param>
    /// <returns>The created card.</returns>
    private static async Task<Card> CreateCardAsync(HttpClient client, string title)
    {
        var request = new CreateCardRequest(title, "", [], "medium", "", [], "", "ideas");
        var response = await client.PostAsJsonAsync("/api/cards", request);
        return (await response.Content.ReadFromJsonAsync<Card>())!;
    }

    // Verifies that two users each see only their own cards when listing all cards.
    [Fact]
    public async Task TwoUsers_CreateCards_EachSeesOnlyOwnCards()
    {
        var alice = _fixture.CreateClientForUser("alice");
        var bob = _fixture.CreateClientForUser("bob");

        var aliceCard = await CreateCardAsync(alice, "Alice's Card");
        var bobCard = await CreateCardAsync(bob, "Bob's Card");

        var aliceCards = await alice.GetFromJsonAsync<List<Card>>("/api/cards");
        aliceCards.Should().ContainSingle(c => c.Id == aliceCard.Id);
        aliceCards.Should().NotContain(c => c.Id == bobCard.Id);

        var bobCards = await bob.GetFromJsonAsync<List<Card>>("/api/cards");
        bobCards.Should().ContainSingle(c => c.Id == bobCard.Id);
        bobCards.Should().NotContain(c => c.Id == aliceCard.Id);
    }

    // Verifies that a user cannot fetch another user's card by ID (returns 404, not 403).
    [Fact]
    public async Task UserCannotAccessOtherUsersCard()
    {
        var alice = _fixture.CreateClientForUser("alice");
        var bob = _fixture.CreateClientForUser("bob");

        var aliceCard = await CreateCardAsync(alice, "Private Card");

        var response = await bob.GetAsync($"/api/cards/{aliceCard.Id}");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // Verifies that a user cannot delete another user's card, and the card remains accessible to its owner.
    [Fact]
    public async Task UserCannotDeleteOtherUsersCard()
    {
        var alice = _fixture.CreateClientForUser("alice");
        var bob = _fixture.CreateClientForUser("bob");

        var aliceCard = await CreateCardAsync(alice, "Protected Card");

        var deleteResponse = await bob.DeleteAsync($"/api/cards/{aliceCard.Id}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);

        // Alice's card should still exist
        var getResponse = await alice.GetAsync($"/api/cards/{aliceCard.Id}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // Verifies that the board endpoint returns only the current user's cards.
    [Fact]
    public async Task BoardEndpoint_ReturnsOnlyCurrentUsersCards()
    {
        var alice = _fixture.CreateClientForUser("alice");
        var bob = _fixture.CreateClientForUser("bob");

        await CreateCardAsync(alice, "Alice's Idea");
        await CreateCardAsync(bob, "Bob's Idea");

        var aliceBoard = await alice.GetFromJsonAsync<BoardResponse>("/api/board");
        var allAliceCards = aliceBoard!.Columns.Values.SelectMany(c => c.Cards).ToList();
        allAliceCards.Should().ContainSingle().Which.Title.Should().Be("Alice's Idea");

        var bobBoard = await bob.GetFromJsonAsync<BoardResponse>("/api/board");
        var allBobCards = bobBoard!.Columns.Values.SelectMany(c => c.Cards).ToList();
        allBobCards.Should().ContainSingle().Which.Title.Should().Be("Bob's Idea");
    }

    // Verifies that omitting the X-User-Id header defaults to "dev-user".
    [Fact]
    public async Task NoUserIdHeader_DefaultsToDevUser()
    {
        // Create a client without the X-User-Id header
        var anonymous = _fixture.CreateClient();
        var devUser = _fixture.CreateClientForUser("dev-user");

        var request = new CreateCardRequest("Anonymous Card", "", [], "medium", "", [], "", "ideas");
        var response = await anonymous.PostAsJsonAsync("/api/cards", request);
        var created = await response.Content.ReadFromJsonAsync<Card>();

        // The card should be accessible via the "dev-user" identity
        var getResponse = await devUser.GetAsync($"/api/cards/{created!.Id}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var fetched = await getResponse.Content.ReadFromJsonAsync<Card>();
        fetched!.UserId.Should().Be("dev-user");
    }
}
