using FluentAssertions;
using Kanban.Api.Services;
using Kanban.Api.Tests.Helpers;
using Moq;

namespace Kanban.Api.Tests.Services;

public class CardService_ReadTests
{
    private readonly Mock<ICardRepository> _repo = new();
    private readonly CardService _sut;

    public CardService_ReadTests()
    {
        _sut = new CardService(_repo.Object);
    }

    /// <summary>Verifies that GetCards only returns cards belonging to the requested user.</summary>
    [Fact]
    public async Task GetCards_ReturnsOnlyCardsForUser()
    {
        var user1Cards = new[]
        {
            CardTestFactory.Create(userId: "user-1"),
            CardTestFactory.Create(userId: "user-1")
        };
        _repo.Setup(r => r.GetByUserAsync("user-1", null)).ReturnsAsync([.. user1Cards]);

        var result = await _sut.GetCardsAsync("user-1");

        result.Should().HaveCount(2);
        result.Should().AllSatisfy(c => c.UserId.Should().Be("user-1"));
    }

    /// <summary>Verifies that passing a columnId filters the result to cards in that column only.</summary>
    [Fact]
    public async Task GetCards_WithColumnId_FiltersToColumn()
    {
        var cards = new[]
        {
            CardTestFactory.Create(userId: "user-1", columnId: "ideas"),
            CardTestFactory.Create(userId: "user-1", columnId: "ideas")
        };
        _repo.Setup(r => r.GetByUserAsync("user-1", "ideas")).ReturnsAsync([.. cards]);

        var result = await _sut.GetCardsAsync("user-1", "ideas");

        result.Should().HaveCount(2);
        result.Should().AllSatisfy(c => c.ColumnId.Should().Be("ideas"));
    }

    /// <summary>Verifies that GetCard returns the correct card when it exists for the user.</summary>
    [Fact]
    public async Task GetCard_ExistingCard_ReturnsCard()
    {
        var card = CardTestFactory.Create(userId: "user-1", id: "card-abc");
        _repo.Setup(r => r.GetByIdAsync("user-1", "card-abc")).ReturnsAsync(card);

        var result = await _sut.GetCardAsync("user-1", "card-abc");

        result.Should().NotBeNull();
        result!.Id.Should().Be("card-abc");
    }

    /// <summary>Verifies that GetCard returns null when the card does not exist.</summary>
    [Fact]
    public async Task GetCard_NonExistentCard_ReturnsNull()
    {
        _repo.Setup(r => r.GetByIdAsync("user-1", "missing")).ReturnsAsync((Kanban.Api.Models.Card?)null);

        var result = await _sut.GetCardAsync("user-1", "missing");

        result.Should().BeNull();
    }

    /// <summary>Verifies that GetBoard always returns all five board columns, even when empty.</summary>
    [Fact]
    public async Task GetBoard_ReturnsAllFiveColumns()
    {
        _repo.Setup(r => r.GetByUserAsync("user-1", null)).ReturnsAsync([]);

        var board = await _sut.GetBoardAsync("user-1");

        board.Columns.Should().ContainKeys("ideas", "planned", "in-progress", "shipped", "retrospective");
    }

    /// <summary>Verifies that cards are placed in the correct column in the board response.</summary>
    [Fact]
    public async Task GetBoard_CardsArePlacedInCorrectColumns()
    {
        var cards = new[]
        {
            CardTestFactory.Create(userId: "user-1", columnId: "ideas", position: 0),
            CardTestFactory.Create(userId: "user-1", columnId: "shipped", position: 0)
        };
        _repo.Setup(r => r.GetByUserAsync("user-1", null)).ReturnsAsync([.. cards]);

        var board = await _sut.GetBoardAsync("user-1");

        board.Columns["ideas"].Cards.Should().HaveCount(1);
        board.Columns["shipped"].Cards.Should().HaveCount(1);
        board.Columns["planned"].Cards.Should().BeEmpty();
    }

    /// <summary>Verifies that cards within a column are sorted ascending by position in the board response.</summary>
    [Fact]
    public async Task GetBoard_CardsWithinColumnAreSortedByPosition()
    {
        var cards = new[]
        {
            CardTestFactory.Create(userId: "user-1", columnId: "ideas", position: 2, title: "Third"),
            CardTestFactory.Create(userId: "user-1", columnId: "ideas", position: 0, title: "First"),
            CardTestFactory.Create(userId: "user-1", columnId: "ideas", position: 1, title: "Second")
        };
        _repo.Setup(r => r.GetByUserAsync("user-1", null)).ReturnsAsync([.. cards]);

        var board = await _sut.GetBoardAsync("user-1");

        var ideaCards = board.Columns["ideas"].Cards;
        ideaCards[0].Title.Should().Be("First");
        ideaCards[1].Title.Should().Be("Second");
        ideaCards[2].Title.Should().Be("Third");
    }
}
