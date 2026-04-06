using FluentAssertions;
using Kanban.Api.Models;
using Kanban.Api.Services;
using Kanban.Api.Tests.Helpers;
using Moq;

namespace Kanban.Api.Tests.Services;

public class CardService_UpdateDeleteTests
{
    private readonly Mock<ICardRepository> _repo = new();
    private readonly CardService _sut;

    public CardService_UpdateDeleteTests()
    {
        _sut = new CardService(_repo.Object);
    }

    /// <summary>Verifies that UpdateCard returns null when the card does not exist for the user.</summary>
    [Fact]
    public async Task UpdateCard_NonExistentCard_ReturnsNull()
    {
        _repo.Setup(r => r.GetByIdAsync("user-1", "missing")).ReturnsAsync((Card?)null);

        var result = await _sut.UpdateCardAsync("user-1", "missing", new UpdateCardRequest(null, null, null, null, null, null, null, null));

        result.Should().BeNull();
    }

    /// <summary>Verifies that only the supplied fields are overwritten; unset fields retain their original values.</summary>
    [Fact]
    public async Task UpdateCard_OnlyUpdatesProvidedFields()
    {
        var original = CardTestFactory.Create(userId: "user-1", id: "card-1", title: "Original");
        _repo.Setup(r => r.GetByIdAsync("user-1", "card-1")).ReturnsAsync(original);
        _repo.Setup(r => r.UpdateAsync(It.IsAny<Card>())).ReturnsAsync((Card c) => c);

        var result = await _sut.UpdateCardAsync("user-1", "card-1",
            new UpdateCardRequest(Title: "Updated", null, null, null, null, null, null, null));

        result!.Title.Should().Be("Updated");
        result.Description.Should().Be(original.Description);
        result.Tags.Should().BeEquivalentTo(original.Tags);
    }

    /// <summary>Verifies that updating a card's ColumnId triggers a full move (position renormalisation in both columns).</summary>
    [Fact]
    public async Task UpdateCard_WithNewColumnId_TriggersMove()
    {
        var card = CardTestFactory.Create(userId: "user-1", id: "card-1", columnId: "ideas");
        _repo.Setup(r => r.GetByIdAsync("user-1", "card-1")).ReturnsAsync(card);
        _repo.Setup(r => r.GetByUserAsync("user-1", "ideas")).ReturnsAsync([card]);
        _repo.Setup(r => r.GetByUserAsync("user-1", "planned")).ReturnsAsync([]);
        _repo.Setup(r => r.UpdateAsync(It.IsAny<Card>())).ReturnsAsync((Card c) => c);

        var result = await _sut.UpdateCardAsync("user-1", "card-1",
            new UpdateCardRequest(null, null, null, null, null, null, null, ColumnId: "planned"));

        result!.ColumnId.Should().Be("planned");
    }

    /// <summary>Verifies that deleting an existing card returns true and calls the repository delete method.</summary>
    [Fact]
    public async Task DeleteCard_ExistingCard_ReturnsTrueAndDeletesCard()
    {
        var card = CardTestFactory.Create(userId: "user-1", id: "card-1", columnId: "ideas");
        _repo.Setup(r => r.GetByIdAsync("user-1", "card-1")).ReturnsAsync(card);
        _repo.Setup(r => r.DeleteAsync("user-1", "card-1")).Returns(Task.CompletedTask);
        _repo.Setup(r => r.GetByUserAsync("user-1", "ideas")).ReturnsAsync([]);

        var result = await _sut.DeleteCardAsync("user-1", "card-1");

        result.Should().BeTrue();
        _repo.Verify(r => r.DeleteAsync("user-1", "card-1"), Times.Once);
    }

    /// <summary>Verifies that deleting a non-existent card returns false without calling the repository delete.</summary>
    [Fact]
    public async Task DeleteCard_NonExistentCard_ReturnsFalse()
    {
        _repo.Setup(r => r.GetByIdAsync("user-1", "missing")).ReturnsAsync((Card?)null);

        var result = await _sut.DeleteCardAsync("user-1", "missing");

        result.Should().BeFalse();
        _repo.Verify(r => r.DeleteAsync(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    /// <summary>Verifies that positions of remaining cards are renormalised to sequential 0-based integers after a deletion.</summary>
    [Fact]
    public async Task DeleteCard_RenormalisesPositionsOfRemainingCards()
    {
        var toDelete = CardTestFactory.Create(userId: "user-1", id: "card-1", columnId: "ideas", position: 0);
        var remaining1 = CardTestFactory.Create(userId: "user-1", id: "card-2", columnId: "ideas", position: 1);
        var remaining2 = CardTestFactory.Create(userId: "user-1", id: "card-3", columnId: "ideas", position: 2);

        _repo.Setup(r => r.GetByIdAsync("user-1", "card-1")).ReturnsAsync(toDelete);
        _repo.Setup(r => r.DeleteAsync("user-1", "card-1")).Returns(Task.CompletedTask);
        _repo.Setup(r => r.GetByUserAsync("user-1", "ideas")).ReturnsAsync([remaining1, remaining2]);
        _repo.Setup(r => r.UpdateAsync(It.IsAny<Card>())).ReturnsAsync((Card c) => c);

        await _sut.DeleteCardAsync("user-1", "card-1");

        // Verify positions 1 and 2 were renormalised to 0 and 1
        _repo.Verify(r => r.UpdateAsync(It.Is<Card>(c => c.Id == "card-2" && c.Position == 0)), Times.Once);
        _repo.Verify(r => r.UpdateAsync(It.Is<Card>(c => c.Id == "card-3" && c.Position == 1)), Times.Once);
    }
}
