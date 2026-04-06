using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Kanban.Api.Models;
using Kanban.Api.Tests.Helpers;

namespace Kanban.Api.Tests.Integration;

/// <summary>
/// Integration tests that verify CardService position management logic works correctly
/// through the full HTTP pipeline. Covers sequential positioning on create, same-column
/// reordering, cross-column moves with renormalisation, and position clamping.
/// </summary>
public class PositionManagementTests : IClassFixture<KanbanApiFixture>
{
    private readonly KanbanApiFixture _fixture;
    private readonly HttpClient _client;

    public PositionManagementTests(KanbanApiFixture fixture)
    {
        _fixture = fixture;
        _fixture.Repository.Clear();
        _client = _fixture.CreateClientForUser("position-user");
    }

    /// <summary>
    /// Creates a card in the given column via POST and returns the created card.
    /// </summary>
    /// <param name="title">The card title.</param>
    /// <param name="columnId">The target column ID.</param>
    /// <returns>The created card.</returns>
    private async Task<Card> CreateCardAsync(string title, string columnId = "ideas")
    {
        var request = new CreateCardRequest(title, "", [], "medium", "", [], "", columnId);
        var response = await _client.PostAsJsonAsync("/api/cards", request);
        return (await response.Content.ReadFromJsonAsync<Card>())!;
    }

    /// <summary>
    /// Fetches all cards in a column ordered by position via GET with columnId filter.
    /// </summary>
    /// <param name="columnId">The column to fetch.</param>
    /// <returns>Cards ordered by position.</returns>
    private async Task<List<Card>> GetColumnCardsAsync(string columnId)
    {
        var response = await _client.GetAsync($"/api/cards?columnId={columnId}");
        return (await response.Content.ReadFromJsonAsync<List<Card>>())!;
    }

    // Verifies that creating three cards in the same column assigns sequential positions 0, 1, 2.
    [Fact]
    public async Task CreateThreeCards_PositionsAreSequential()
    {
        var a = await CreateCardAsync("A");
        var b = await CreateCardAsync("B");
        var c = await CreateCardAsync("C");

        var cards = await GetColumnCardsAsync("ideas");

        cards.Should().HaveCount(3);
        cards[0].Id.Should().Be(a.Id);
        cards[0].Position.Should().Be(0);
        cards[1].Id.Should().Be(b.Id);
        cards[1].Position.Should().Be(1);
        cards[2].Id.Should().Be(c.Id);
        cards[2].Position.Should().Be(2);
    }

    // Verifies that moving a card within the same column reorders correctly and renormalises positions.
    [Fact]
    public async Task MoveCard_WithinColumn_ReordersCorrectly()
    {
        var a = await CreateCardAsync("A");
        var b = await CreateCardAsync("B");
        var c = await CreateCardAsync("C");

        // Move A from position 0 to position 2
        var moveRequest = new MoveCardRequest("ideas", 2);
        var moveResponse = await _client.PatchAsJsonAsync($"/api/cards/{a.Id}/move", moveRequest);
        moveResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var cards = await GetColumnCardsAsync("ideas");

        cards.Should().HaveCount(3);
        cards[0].Id.Should().Be(b.Id, "B should now be first");
        cards[1].Id.Should().Be(c.Id, "C should now be second");
        cards[2].Id.Should().Be(a.Id, "A should now be last");
        cards.Select(c => c.Position).Should().BeEquivalentTo([0, 1, 2]);
    }

    // Verifies that moving a card across columns renormalises positions in both source and destination.
    [Fact]
    public async Task MoveCard_AcrossColumns_RenormalisesBothColumns()
    {
        var a = await CreateCardAsync("A", "ideas");
        var b = await CreateCardAsync("B", "ideas");

        // Move A to "planned"
        var moveRequest = new MoveCardRequest("planned", 0);
        await _client.PatchAsJsonAsync($"/api/cards/{a.Id}/move", moveRequest);

        var ideas = await GetColumnCardsAsync("ideas");
        ideas.Should().HaveCount(1);
        ideas[0].Id.Should().Be(b.Id);
        ideas[0].Position.Should().Be(0, "remaining card should be renormalised to position 0");

        var planned = await GetColumnCardsAsync("planned");
        planned.Should().HaveCount(1);
        planned[0].Id.Should().Be(a.Id);
        planned[0].Position.Should().Be(0);
    }

    // Verifies that deleting a middle card renormalises positions of remaining cards to be sequential.
    [Fact]
    public async Task DeleteMiddleCard_RenormalisesRemainingPositions()
    {
        var a = await CreateCardAsync("A");
        var b = await CreateCardAsync("B");
        var c = await CreateCardAsync("C");

        await _client.DeleteAsync($"/api/cards/{b.Id}");

        var cards = await GetColumnCardsAsync("ideas");

        cards.Should().HaveCount(2);
        cards[0].Id.Should().Be(a.Id);
        cards[0].Position.Should().Be(0);
        cards[1].Id.Should().Be(c.Id);
        cards[1].Position.Should().Be(1, "position should be renormalised after deletion");
    }

    // Verifies that requesting a position beyond the column length clamps to the end.
    [Fact]
    public async Task MoveCard_ToPositionBeyondEnd_ClampsToEnd()
    {
        var existing = await CreateCardAsync("Existing", "planned");
        var mover = await CreateCardAsync("Mover", "ideas");

        var moveRequest = new MoveCardRequest("planned", 999);
        await _client.PatchAsJsonAsync($"/api/cards/{mover.Id}/move", moveRequest);

        var planned = await GetColumnCardsAsync("planned");

        planned.Should().HaveCount(2);
        planned[0].Id.Should().Be(existing.Id);
        planned[0].Position.Should().Be(0);
        planned[1].Id.Should().Be(mover.Id);
        planned[1].Position.Should().Be(1, "should be clamped to end of column");
    }
}
