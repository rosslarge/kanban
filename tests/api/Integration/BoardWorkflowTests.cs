using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Kanban.Api.Models;
using Kanban.Api.Tests.Helpers;

namespace Kanban.Api.Tests.Integration;

/// <summary>
/// Integration tests for the GET /api/board endpoint, verifying that the aggregate
/// board view correctly reflects multi-step operations performed through the full
/// HTTP pipeline (endpoints → CardService → InMemoryCardRepository).
/// </summary>
public class BoardWorkflowTests : IClassFixture<KanbanApiFixture>
{
    private readonly KanbanApiFixture _fixture;
    private readonly HttpClient _client;

    public BoardWorkflowTests(KanbanApiFixture fixture)
    {
        _fixture = fixture;
        _fixture.Repository.Clear();
        _client = _fixture.CreateClientForUser("board-user");
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
    /// Fetches the full board state via GET /api/board.
    /// </summary>
    /// <returns>The board response with all columns.</returns>
    private async Task<BoardResponse> GetBoardAsync()
    {
        var response = await _client.GetAsync("/api/board");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<BoardResponse>())!;
    }

    // Verifies that an empty board returns all five columns with no cards.
    [Fact]
    public async Task EmptyBoard_ReturnsAllFiveColumns()
    {
        var board = await GetBoardAsync();

        board.Columns.Should().HaveCount(5);
        board.Columns.Should().ContainKeys("ideas", "planned", "in-progress", "shipped", "retrospective");

        foreach (var column in board.Columns.Values)
            column.Cards.Should().BeEmpty();
    }

    // Verifies that cards created in different columns appear in the correct columns on the board.
    [Fact]
    public async Task CardsInMultipleColumns_BoardReflectsAll()
    {
        var ideaCard = await CreateCardAsync("Idea", "ideas");
        var plannedCard = await CreateCardAsync("Plan", "planned");
        var inProgressCard = await CreateCardAsync("Working", "in-progress");

        var board = await GetBoardAsync();

        board.Columns["ideas"].Cards.Should().ContainSingle(c => c.Id == ideaCard.Id);
        board.Columns["planned"].Cards.Should().ContainSingle(c => c.Id == plannedCard.Id);
        board.Columns["in-progress"].Cards.Should().ContainSingle(c => c.Id == inProgressCard.Id);
        board.Columns["shipped"].Cards.Should().BeEmpty();
        board.Columns["retrospective"].Cards.Should().BeEmpty();
    }

    // Verifies that moving a card to "shipped" causes the board to show it with a non-null completedAt.
    [Fact]
    public async Task MoveCardToShipped_BoardShowsCompletedAt()
    {
        var card = await CreateCardAsync("Ship Me", "ideas");
        card.CompletedAt.Should().BeNull("card starts in ideas, not a completed column");

        var moveRequest = new MoveCardRequest("shipped", 0);
        await _client.PatchAsJsonAsync($"/api/cards/{card.Id}/move", moveRequest);

        var board = await GetBoardAsync();
        var shippedCard = board.Columns["shipped"].Cards.Should().ContainSingle().Which;

        shippedCard.Id.Should().Be(card.Id);
        shippedCard.CompletedAt.Should().NotBeNull("moving to shipped should auto-set completedAt");
    }

    // Verifies a card's full kanban lifecycle from ideas through to retrospective,
    // ensuring completedAt is set on first move to shipped and preserved through retrospective.
    [Fact]
    public async Task FullWorkflow_IdeaToRetrospective()
    {
        var card = await CreateCardAsync("Journey", "ideas");

        // ideas → planned
        await _client.PatchAsJsonAsync($"/api/cards/{card.Id}/move", new MoveCardRequest("planned", 0));
        var planned = await _client.GetFromJsonAsync<Card>($"/api/cards/{card.Id}");
        planned!.ColumnId.Should().Be("planned");
        planned.CompletedAt.Should().BeNull();

        // planned → in-progress
        await _client.PatchAsJsonAsync($"/api/cards/{card.Id}/move", new MoveCardRequest("in-progress", 0));
        var inProgress = await _client.GetFromJsonAsync<Card>($"/api/cards/{card.Id}");
        inProgress!.ColumnId.Should().Be("in-progress");
        inProgress.CompletedAt.Should().BeNull();

        // in-progress → shipped (completedAt gets set)
        await _client.PatchAsJsonAsync($"/api/cards/{card.Id}/move", new MoveCardRequest("shipped", 0));
        var shipped = await _client.GetFromJsonAsync<Card>($"/api/cards/{card.Id}");
        shipped!.ColumnId.Should().Be("shipped");
        shipped.CompletedAt.Should().NotBeNull();
        var originalCompletedAt = shipped.CompletedAt;

        // shipped → retrospective (completedAt should be preserved, not overwritten)
        await _client.PatchAsJsonAsync($"/api/cards/{card.Id}/move", new MoveCardRequest("retrospective", 0));
        var retro = await _client.GetFromJsonAsync<Card>($"/api/cards/{card.Id}");
        retro!.ColumnId.Should().Be("retrospective");
        retro.CompletedAt.Should().Be(originalCompletedAt, "completedAt should be preserved from the shipped move");

        // Board should show the card in retrospective
        var board = await GetBoardAsync();
        board.Columns["retrospective"].Cards.Should().ContainSingle(c => c.Id == card.Id);
    }
}
