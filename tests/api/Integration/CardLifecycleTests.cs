using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Kanban.Api.Models;
using Kanban.Api.Tests.Helpers;

namespace Kanban.Api.Tests.Integration;

/// <summary>
/// Integration tests that exercise multi-step CRUD workflows through the full HTTP pipeline
/// (endpoints → CardService → InMemoryCardRepository), verifying that data round-trips
/// correctly without mocking any application-layer components.
/// </summary>
public class CardLifecycleTests : IClassFixture<KanbanApiFixture>
{
    private readonly KanbanApiFixture _fixture;
    private readonly HttpClient _client;

    public CardLifecycleTests(KanbanApiFixture fixture)
    {
        _fixture = fixture;
        _fixture.Repository.Clear();
        _client = _fixture.CreateClientForUser("lifecycle-user");
    }

    /// <summary>
    /// Creates a minimal valid <see cref="CreateCardRequest"/> with the given title and column.
    /// </summary>
    /// <param name="title">The card title.</param>
    /// <param name="columnId">The target column ID.</param>
    /// <returns>A request suitable for POST /api/cards.</returns>
    private static CreateCardRequest MakeRequest(string title = "Test Card", string columnId = "ideas") =>
        new(title, "A description", ["tag1"], "medium", "General", [], "", columnId);

    // Verifies that creating a card and then fetching it by ID returns the same card with all fields intact.
    [Fact]
    public async Task CreateCard_ThenGetById_ReturnsCreatedCard()
    {
        var response = await _client.PostAsJsonAsync("/api/cards", MakeRequest("My Card"));
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var created = await response.Content.ReadFromJsonAsync<Card>();
        created!.Title.Should().Be("My Card");

        var getResponse = await _client.GetAsync($"/api/cards/{created.Id}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var fetched = await getResponse.Content.ReadFromJsonAsync<Card>();
        fetched!.Id.Should().Be(created.Id);
        fetched.Title.Should().Be("My Card");
        fetched.Description.Should().Be("A description");
        fetched.ColumnId.Should().Be("ideas");
    }

    // Verifies that GET /api/cards includes a newly created card in its results.
    [Fact]
    public async Task CreateCard_ThenGetAllCards_IncludesNewCard()
    {
        var response = await _client.PostAsJsonAsync("/api/cards", MakeRequest("Listed Card"));
        var created = await response.Content.ReadFromJsonAsync<Card>();

        var listResponse = await _client.GetAsync("/api/cards");
        var cards = await listResponse.Content.ReadFromJsonAsync<List<Card>>();

        cards.Should().Contain(c => c.Id == created!.Id);
    }

    // Verifies that updating a card's title via PUT persists the change through a subsequent GET.
    [Fact]
    public async Task CreateCard_ThenUpdateTitle_ThenGet_ReturnsUpdatedTitle()
    {
        var response = await _client.PostAsJsonAsync("/api/cards", MakeRequest("Original"));
        var created = await response.Content.ReadFromJsonAsync<Card>();

        var update = new UpdateCardRequest("Updated Title", null, null, null, null, null, null, null);
        var putResponse = await _client.PutAsJsonAsync($"/api/cards/{created!.Id}", update);
        putResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var getResponse = await _client.GetAsync($"/api/cards/{created.Id}");
        var fetched = await getResponse.Content.ReadFromJsonAsync<Card>();

        fetched!.Title.Should().Be("Updated Title");
        fetched.Description.Should().Be("A description", "unchanged fields should be preserved");
    }

    // Verifies that deleting a card returns 204 and a subsequent GET returns 404.
    [Fact]
    public async Task CreateCard_ThenDelete_ThenGetReturns404()
    {
        var response = await _client.PostAsJsonAsync("/api/cards", MakeRequest("Doomed"));
        var created = await response.Content.ReadFromJsonAsync<Card>();

        var deleteResponse = await _client.DeleteAsync($"/api/cards/{created!.Id}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var getResponse = await _client.GetAsync($"/api/cards/{created.Id}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // Verifies that a newly created card gets a CreatedAt timestamp close to now.
    [Fact]
    public async Task CreateCard_ReturnsCreatedAtTimestamp()
    {
        var before = DateTime.UtcNow;
        var response = await _client.PostAsJsonAsync("/api/cards", MakeRequest());
        var card = await response.Content.ReadFromJsonAsync<Card>();

        card!.CreatedAt.Should().BeOnOrAfter(before.AddSeconds(-1));
        card.CreatedAt.Should().BeOnOrBefore(DateTime.UtcNow.AddSeconds(1));
    }

    // Verifies that complex nested fields (tags, links) survive the full HTTP round-trip.
    [Fact]
    public async Task CreateCard_WithAllFields_RoundTripsCorrectly()
    {
        var request = new CreateCardRequest(
            "Full Card",
            "Detailed description",
            ["Web App", "CLI Tool"],
            "high",
            "Side Project",
            [new CardLink { Label = "GitHub", Url = "https://github.com/test" }],
            "Some notes",
            "ideas"
        );

        var response = await _client.PostAsJsonAsync("/api/cards", request);
        var created = await response.Content.ReadFromJsonAsync<Card>();

        var getResponse = await _client.GetAsync($"/api/cards/{created!.Id}");
        var fetched = await getResponse.Content.ReadFromJsonAsync<Card>();

        fetched!.Tags.Should().BeEquivalentTo(["Web App", "CLI Tool"]);
        fetched.Priority.Should().Be("high");
        fetched.Category.Should().Be("Side Project");
        fetched.Links.Should().HaveCount(1);
        fetched.Links[0].Label.Should().Be("GitHub");
        fetched.Links[0].Url.Should().Be("https://github.com/test");
        fetched.Notes.Should().Be("Some notes");
    }

    // Verifies that updating a card's columnId via PUT triggers a move (delegated to MoveCardAsync).
    [Fact]
    public async Task UpdateCard_WithColumnChange_TriggersMove()
    {
        var response = await _client.PostAsJsonAsync("/api/cards", MakeRequest("Movable", "ideas"));
        var created = await response.Content.ReadFromJsonAsync<Card>();

        var update = new UpdateCardRequest(null, null, null, null, null, null, null, "planned");
        await _client.PutAsJsonAsync($"/api/cards/{created!.Id}", update);

        var getResponse = await _client.GetAsync($"/api/cards/{created.Id}");
        var fetched = await getResponse.Content.ReadFromJsonAsync<Card>();

        fetched!.ColumnId.Should().Be("planned");
    }
}
