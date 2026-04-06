namespace Kanban.Api.Models;

/// <summary>
/// Request body for creating a new card. All fields are required.
/// The server generates the card ID, timestamps, and position automatically.
/// </summary>
public record CreateCardRequest(
    string Title,
    string Description,
    List<string> Tags,
    string Priority,
    string Category,
    List<CardLink> Links,
    string Notes,
    string ColumnId
);

/// <summary>
/// Request body for updating an existing card. All fields are optional —
/// only non-null values are applied, leaving other fields unchanged.
/// Setting ColumnId triggers a move to that column at the end position.
/// </summary>
public record UpdateCardRequest(
    string? Title,
    string? Description,
    List<string>? Tags,
    string? Priority,
    string? Category,
    List<CardLink>? Links,
    string? Notes,
    string? ColumnId
);

/// <summary>
/// Request body for moving or reordering a card.
/// Handles both cross-column moves and same-column reordering.
/// </summary>
public record MoveCardRequest(
    /// <summary>The target column ID. May be the same as the card's current column for a reorder.</summary>
    string ToColumnId,
    /// <summary>The zero-based target position within the column. Clamped to valid range.</summary>
    int ToPosition
);
