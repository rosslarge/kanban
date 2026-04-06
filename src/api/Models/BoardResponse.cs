namespace Kanban.Api.Models;

/// <summary>
/// The full board state returned by GET /api/board.
/// Contains all five columns with their cards pre-sorted by position,
/// shaped to match the structure the frontend expects.
/// </summary>
public class BoardResponse
{
    /// <summary>
    /// Map of column ID to column data. Always contains all five columns
    /// (ideas, planned, in-progress, shipped, retrospective), even if empty.
    /// </summary>
    public Dictionary<string, ColumnResponse> Columns { get; set; } = [];
}

/// <summary>
/// Represents a single column within the board response, including its ordered cards.
/// </summary>
public class ColumnResponse
{
    /// <summary>The column identifier, e.g. "ideas" or "in-progress".</summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>The human-readable column title, e.g. "In Progress".</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>Cards in this column, sorted by ascending position.</summary>
    public List<Card> Cards { get; set; } = [];
}
