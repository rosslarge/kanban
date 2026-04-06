using Kanban.Api.Models;

namespace Kanban.Api.Tests.Helpers;

/// <summary>
/// Creates fully-populated Card instances for use in tests.
/// Auto-increments IDs so each call produces a unique card without manual ID management.
/// </summary>
public static class CardTestFactory
{
    private static int _counter;

    /// <summary>
    /// Builds a Card with sensible defaults that can be selectively overridden.
    /// All fields are populated so the returned card is valid for any service or endpoint test.
    /// </summary>
    public static Card Create(
        string userId = "user-1",
        string columnId = "ideas",
        int position = 0,
        string? id = null,
        string title = "Test Card",
        string priority = "medium")
    {
        return new Card
        {
            Id = id ?? $"card-{++_counter}",
            UserId = userId,
            Title = title,
            Description = "Test description",
            Tags = ["Web App"],
            Priority = priority,
            Category = "Test",
            Links = [],
            Notes = "",
            ColumnId = columnId,
            Position = position,
            CreatedAt = DateTime.UtcNow,
            CompletedAt = null
        };
    }
}
