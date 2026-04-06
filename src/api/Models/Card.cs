using System.Text.Json.Serialization;

namespace Kanban.Api.Models;

/// <summary>
/// Represents a single kanban card as stored in Cosmos DB.
/// Each card belongs to a user (partition key) and a column, with an integer
/// position that determines its order within that column.
/// </summary>
public class Card
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    /// <summary>The ID of the user who owns this card. Used as the Cosmos DB partition key.</summary>
    public string UserId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;

    /// <summary>Free-form tags used for filtering, e.g. "Web App", "CLI Tool".</summary>
    public List<string> Tags { get; set; } = [];

    /// <summary>Priority level: "high", "medium", or "low".</summary>
    public string Priority { get; set; } = "medium";

    public string Category { get; set; } = string.Empty;
    public List<CardLink> Links { get; set; } = [];

    /// <summary>Freeform retrospective notes about the project outcome and lessons learned.</summary>
    public string Notes { get; set; } = string.Empty;

    /// <summary>The column this card belongs to, e.g. "ideas", "in-progress", "shipped".</summary>
    public string ColumnId { get; set; } = string.Empty;

    /// <summary>Zero-based display order within the card's column.</summary>
    public int Position { get; set; }

    public DateTime CreatedAt { get; set; }

    /// <summary>Set automatically when a card is moved to "shipped" or "retrospective".</summary>
    public DateTime? CompletedAt { get; set; }
}

/// <summary>
/// An external link associated with a card, such as a GitHub repo or live demo URL.
/// </summary>
public class CardLink
{
    /// <summary>Human-readable label for the link, e.g. "GitHub" or "Demo".</summary>
    public string Label { get; set; } = string.Empty;

    public string Url { get; set; } = string.Empty;
}
