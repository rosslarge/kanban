using FluentAssertions;
using Kanban.Api.Models;
using Kanban.Api.Services;
using Kanban.Api.Tests.Helpers;
using Moq;

namespace Kanban.Api.Tests.Services;

public class CardService_CreateTests
{
    private readonly Mock<ICardRepository> _repo = new();
    private readonly CardService _sut;

    public CardService_CreateTests()
    {
        _sut = new CardService(_repo.Object);
    }

    /// <summary>Verifies that the userId parameter is stamped onto the created card.</summary>
    [Fact]
    public async Task CreateCard_SetsUserIdFromParameter()
    {
        _repo.Setup(r => r.GetByUserAsync("user-123", "ideas")).ReturnsAsync([]);
        _repo.Setup(r => r.CreateAsync(It.IsAny<Card>())).ReturnsAsync((Card c) => c);

        var request = MakeRequest(columnId: "ideas");
        var card = await _sut.CreateCardAsync("user-123", request);

        card.UserId.Should().Be("user-123");
    }

    /// <summary>Verifies that a non-empty ID is generated for the new card.</summary>
    [Fact]
    public async Task CreateCard_GeneratesId()
    {
        SetupEmptyColumn("ideas");
        SetupCreate();

        var card = await _sut.CreateCardAsync("user-1", MakeRequest());

        card.Id.Should().NotBeNullOrEmpty();
    }

    /// <summary>Verifies that CreatedAt is set to the current UTC time at the moment of creation.</summary>
    [Fact]
    public async Task CreateCard_SetsCreatedAt()
    {
        SetupEmptyColumn("ideas");
        SetupCreate();

        var before = DateTime.UtcNow;
        var card = await _sut.CreateCardAsync("user-1", MakeRequest());

        card.CreatedAt.Should().BeOnOrAfter(before);
    }

    /// <summary>Verifies that a card added to an empty column receives position 0.</summary>
    [Fact]
    public async Task CreateCard_InEmptyColumn_GetsPositionZero()
    {
        SetupEmptyColumn("ideas");
        SetupCreate();

        var card = await _sut.CreateCardAsync("user-1", MakeRequest(columnId: "ideas"));

        card.Position.Should().Be(0);
    }

    /// <summary>Verifies that a card appended to an occupied column receives the next sequential position.</summary>
    [Fact]
    public async Task CreateCard_InColumnWithExistingCards_GetsNextPosition()
    {
        var existing = new List<Card>
        {
            CardTestFactory.Create(position: 0),
            CardTestFactory.Create(position: 1)
        };
        _repo.Setup(r => r.GetByUserAsync("user-1", "ideas")).ReturnsAsync(existing);
        SetupCreate();

        var card = await _sut.CreateCardAsync("user-1", MakeRequest(columnId: "ideas"));

        card.Position.Should().Be(2);
    }

    /// <summary>Verifies that CompletedAt is set when a card is created directly in a completed column.</summary>
    [Theory]
    [InlineData("shipped")]
    [InlineData("retrospective")]
    public async Task CreateCard_InCompletedColumn_SetsCompletedAt(string columnId)
    {
        SetupEmptyColumn(columnId);
        SetupCreate();

        var before = DateTime.UtcNow;
        var card = await _sut.CreateCardAsync("user-1", MakeRequest(columnId: columnId));

        card.CompletedAt.Should().NotBeNull();
        card.CompletedAt.Should().BeOnOrAfter(before);
    }

    /// <summary>Verifies that CompletedAt is null when a card is created in an active (non-completed) column.</summary>
    [Theory]
    [InlineData("ideas")]
    [InlineData("planned")]
    [InlineData("in-progress")]
    public async Task CreateCard_InActiveColumn_DoesNotSetCompletedAt(string columnId)
    {
        SetupEmptyColumn(columnId);
        SetupCreate();

        var card = await _sut.CreateCardAsync("user-1", MakeRequest(columnId: columnId));

        card.CompletedAt.Should().BeNull();
    }

    /// <summary>Verifies that every field from the request is copied onto the created card.</summary>
    [Fact]
    public async Task CreateCard_MapsAllRequestFields()
    {
        SetupEmptyColumn("planned");
        SetupCreate();

        var request = new CreateCardRequest(
            Title: "My Project",
            Description: "A cool idea",
            Tags: ["Web App", "API"],
            Priority: "high",
            Category: "Productivity",
            Links: [new CardLink { Label = "GitHub", Url = "https://github.com" }],
            Notes: "Some notes",
            ColumnId: "planned"
        );

        var card = await _sut.CreateCardAsync("user-1", request);

        card.Title.Should().Be("My Project");
        card.Description.Should().Be("A cool idea");
        card.Tags.Should().BeEquivalentTo(["Web App", "API"]);
        card.Priority.Should().Be("high");
        card.Category.Should().Be("Productivity");
        card.Links.Should().HaveCount(1);
        card.Notes.Should().Be("Some notes");
        card.ColumnId.Should().Be("planned");
    }

    private void SetupEmptyColumn(string columnId) =>
        _repo.Setup(r => r.GetByUserAsync("user-1", columnId)).ReturnsAsync([]);

    private void SetupCreate() =>
        _repo.Setup(r => r.CreateAsync(It.IsAny<Card>()))
             .ReturnsAsync((Card c) => c);

    private static CreateCardRequest MakeRequest(string columnId = "ideas") =>
        new("Test Card", "Desc", [], "medium", "Cat", [], "", columnId);
}
