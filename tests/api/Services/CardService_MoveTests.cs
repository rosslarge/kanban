using FluentAssertions;
using Kanban.Api.Models;
using Kanban.Api.Services;
using Kanban.Api.Tests.Helpers;
using Moq;

namespace Kanban.Api.Tests.Services;

public class CardService_MoveTests
{
    private readonly Mock<ICardRepository> _repo = new();
    private readonly CardService _sut;

    public CardService_MoveTests()
    {
        _sut = new CardService(_repo.Object);
        _repo.Setup(r => r.UpdateAsync(It.IsAny<Card>())).ReturnsAsync((Card c) => c);
    }

    /// <summary>Verifies that MoveCard returns null when the card does not exist for the user.</summary>
    [Fact]
    public async Task MoveCard_NonExistentCard_ReturnsNull()
    {
        _repo.Setup(r => r.GetByIdAsync("user-1", "missing")).ReturnsAsync((Card?)null);

        var result = await _sut.MoveCardAsync("user-1", "missing", new MoveCardRequest("planned", 0));

        result.Should().BeNull();
    }

    /// <summary>Verifies that moving a card across columns updates its ColumnId to the destination.</summary>
    [Fact]
    public async Task MoveCard_CrossColumn_UpdatesColumnId()
    {
        var card = CardTestFactory.Create(userId: "user-1", id: "card-1", columnId: "ideas", position: 0);

        _repo.Setup(r => r.GetByIdAsync("user-1", "card-1")).ReturnsAsync(card);
        _repo.Setup(r => r.GetByUserAsync("user-1", "ideas")).ReturnsAsync([card]);
        _repo.Setup(r => r.GetByUserAsync("user-1", "planned")).ReturnsAsync([]);

        var result = await _sut.MoveCardAsync("user-1", "card-1", new MoveCardRequest("planned", 0));

        result!.ColumnId.Should().Be("planned");
    }

    /// <summary>Verifies that moving a card to the Shipped column automatically sets CompletedAt.</summary>
    [Fact]
    public async Task MoveCard_ToShipped_SetsCompletedAt()
    {
        var card = CardTestFactory.Create(userId: "user-1", id: "card-1", columnId: "ideas");

        _repo.Setup(r => r.GetByIdAsync("user-1", "card-1")).ReturnsAsync(card);
        _repo.Setup(r => r.GetByUserAsync("user-1", "ideas")).ReturnsAsync([card]);
        _repo.Setup(r => r.GetByUserAsync("user-1", "shipped")).ReturnsAsync([]);

        var before = DateTime.UtcNow;
        var result = await _sut.MoveCardAsync("user-1", "card-1", new MoveCardRequest("shipped", 0));

        result!.CompletedAt.Should().NotBeNull();
        result.CompletedAt.Should().BeOnOrAfter(before);
    }

    /// <summary>Verifies that moving a card to the Retrospective column automatically sets CompletedAt.</summary>
    [Fact]
    public async Task MoveCard_ToRetrospective_SetsCompletedAt()
    {
        var card = CardTestFactory.Create(userId: "user-1", id: "card-1", columnId: "planned");

        _repo.Setup(r => r.GetByIdAsync("user-1", "card-1")).ReturnsAsync(card);
        _repo.Setup(r => r.GetByUserAsync("user-1", "planned")).ReturnsAsync([card]);
        _repo.Setup(r => r.GetByUserAsync("user-1", "retrospective")).ReturnsAsync([]);

        var result = await _sut.MoveCardAsync("user-1", "card-1", new MoveCardRequest("retrospective", 0));

        result!.CompletedAt.Should().NotBeNull();
    }

    /// <summary>Verifies that a card already in a completed column retains its original CompletedAt when moved again.</summary>
    [Fact]
    public async Task MoveCard_AlreadyHasCompletedAt_PreservesOriginalCompletedAt()
    {
        var originalDate = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var card = CardTestFactory.Create(userId: "user-1", id: "card-1", columnId: "shipped");
        card.CompletedAt = originalDate;

        _repo.Setup(r => r.GetByIdAsync("user-1", "card-1")).ReturnsAsync(card);
        _repo.Setup(r => r.GetByUserAsync("user-1", "shipped")).ReturnsAsync([card]);
        _repo.Setup(r => r.GetByUserAsync("user-1", "retrospective")).ReturnsAsync([]);

        var result = await _sut.MoveCardAsync("user-1", "card-1", new MoveCardRequest("retrospective", 0));

        result!.CompletedAt.Should().Be(originalDate);
    }

    /// <summary>Verifies that the moved card is inserted at the requested index and subsequent cards are shifted down.</summary>
    [Fact]
    public async Task MoveCard_CrossColumn_InsertsAtRequestedPosition()
    {
        var card = CardTestFactory.Create(userId: "user-1", id: "card-1", columnId: "ideas");
        var dest1 = CardTestFactory.Create(userId: "user-1", id: "dest-1", columnId: "planned", position: 0);
        var dest2 = CardTestFactory.Create(userId: "user-1", id: "dest-2", columnId: "planned", position: 1);

        _repo.Setup(r => r.GetByIdAsync("user-1", "card-1")).ReturnsAsync(card);
        _repo.Setup(r => r.GetByUserAsync("user-1", "ideas")).ReturnsAsync([card]);
        _repo.Setup(r => r.GetByUserAsync("user-1", "planned")).ReturnsAsync([dest1, dest2]);

        await _sut.MoveCardAsync("user-1", "card-1", new MoveCardRequest("planned", 1));

        // dest-1 stays at 0, card-1 inserted at 1, dest-2 moves to 2
        _repo.Verify(r => r.UpdateAsync(It.Is<Card>(c => c.Id == "dest-1" && c.Position == 0)), Times.Never); // unchanged
        _repo.Verify(r => r.UpdateAsync(It.Is<Card>(c => c.Id == "dest-2" && c.Position == 2)), Times.Once);
    }

    /// <summary>Verifies that a card moved to an empty column is assigned position 0.</summary>
    [Fact]
    public async Task MoveCard_ToEmptyColumn_GetsPositionZero()
    {
        var card = CardTestFactory.Create(userId: "user-1", id: "card-1", columnId: "ideas");

        _repo.Setup(r => r.GetByIdAsync("user-1", "card-1")).ReturnsAsync(card);
        _repo.Setup(r => r.GetByUserAsync("user-1", "ideas")).ReturnsAsync([card]);
        _repo.Setup(r => r.GetByUserAsync("user-1", "planned")).ReturnsAsync([]);

        var result = await _sut.MoveCardAsync("user-1", "card-1", new MoveCardRequest("planned", 0));

        result!.Position.Should().Be(0);
    }

    /// <summary>Verifies that a requested position beyond the end of the destination column is clamped to the last index.</summary>
    [Fact]
    public async Task MoveCard_PositionBeyondEnd_ClampsToEnd()
    {
        var card = CardTestFactory.Create(userId: "user-1", id: "card-1", columnId: "ideas");
        var dest = CardTestFactory.Create(userId: "user-1", id: "dest-1", columnId: "planned", position: 0);

        _repo.Setup(r => r.GetByIdAsync("user-1", "card-1")).ReturnsAsync(card);
        _repo.Setup(r => r.GetByUserAsync("user-1", "ideas")).ReturnsAsync([card]);
        _repo.Setup(r => r.GetByUserAsync("user-1", "planned")).ReturnsAsync([dest]);

        var result = await _sut.MoveCardAsync("user-1", "card-1", new MoveCardRequest("planned", 999));

        result!.Position.Should().Be(1); // appended at end (index 1 in a 1-card list)
    }

    /// <summary>Verifies that reordering within the same column renormalises all positions correctly.</summary>
    [Fact]
    public async Task MoveCard_SameColumn_ReordersCorrectly()
    {
        var card1 = CardTestFactory.Create(userId: "user-1", id: "card-1", columnId: "ideas", position: 0, title: "First");
        var card2 = CardTestFactory.Create(userId: "user-1", id: "card-2", columnId: "ideas", position: 1, title: "Second");
        var card3 = CardTestFactory.Create(userId: "user-1", id: "card-3", columnId: "ideas", position: 2, title: "Third");

        _repo.Setup(r => r.GetByIdAsync("user-1", "card-1")).ReturnsAsync(card1);
        _repo.Setup(r => r.GetByUserAsync("user-1", "ideas")).ReturnsAsync([card1, card2, card3]);
        _repo.Setup(r => r.GetByIdAsync("user-1", "card-1")).ReturnsAsync(card1); // after move

        await _sut.MoveCardAsync("user-1", "card-1", new MoveCardRequest("ideas", 2));

        // card-1 moved from 0 to 2: card-2 → 0, card-3 → 1, card-1 → 2
        _repo.Verify(r => r.UpdateAsync(It.Is<Card>(c => c.Id == "card-2" && c.Position == 0)), Times.Once);
        _repo.Verify(r => r.UpdateAsync(It.Is<Card>(c => c.Id == "card-3" && c.Position == 1)), Times.Once);
    }

    /// <summary>Verifies that cards remaining in the source column are renormalised after a cross-column move.</summary>
    [Fact]
    public async Task MoveCard_CrossColumn_RenormalisesSourceColumn()
    {
        var card1 = CardTestFactory.Create(userId: "user-1", id: "card-1", columnId: "ideas", position: 0);
        var card2 = CardTestFactory.Create(userId: "user-1", id: "card-2", columnId: "ideas", position: 1);
        var card3 = CardTestFactory.Create(userId: "user-1", id: "card-3", columnId: "ideas", position: 2);

        _repo.Setup(r => r.GetByIdAsync("user-1", "card-2")).ReturnsAsync(card2);
        _repo.Setup(r => r.GetByUserAsync("user-1", "ideas")).ReturnsAsync([card1, card2, card3]);
        _repo.Setup(r => r.GetByUserAsync("user-1", "planned")).ReturnsAsync([]);

        await _sut.MoveCardAsync("user-1", "card-2", new MoveCardRequest("planned", 0));

        // card-1 stays at 0 (no update needed), card-3 should move to position 1
        _repo.Verify(r => r.UpdateAsync(It.Is<Card>(c => c.Id == "card-3" && c.Position == 1)), Times.Once);
    }
}
