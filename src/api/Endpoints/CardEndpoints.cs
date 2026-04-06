using Kanban.Api.Models;
using Kanban.Api.Services;

namespace Kanban.Api.Endpoints;

/// <summary>
/// Registers all card-related API endpoints under the /api route group.
/// User identity is resolved from the X-User-Id request header (set by middleware),
/// and passed through to the service layer for all operations.
/// </summary>
public static class CardEndpoints
{
    /// <summary>
    /// Maps all card and board endpoints onto the application.
    /// Called once from Program.cs during startup.
    /// </summary>
    /// <param name="app">The WebApplication to register routes on.</param>
    public static void MapCardEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api");

        group.MapGet("/board", async (HttpContext ctx, ICardService service) =>
        {
            var userId = GetUserId(ctx);
            var board = await service.GetBoardAsync(userId);
            return Results.Ok(board);
        })
        .WithName("GetBoard")
        .WithSummary("Get full board state for the current user");

        group.MapGet("/cards", async (HttpContext ctx, ICardService service, string? columnId) =>
        {
            var userId = GetUserId(ctx);
            var cards = await service.GetCardsAsync(userId, columnId);
            return Results.Ok(cards);
        })
        .WithName("GetCards")
        .WithSummary("Get all cards, optionally filtered by column");

        group.MapGet("/cards/{id}", async (HttpContext ctx, ICardService service, string id) =>
        {
            var userId = GetUserId(ctx);
            var card = await service.GetCardAsync(userId, id);
            return card is null ? Results.NotFound() : Results.Ok(card);
        })
        .WithName("GetCard")
        .WithSummary("Get a single card by ID");

        group.MapPost("/cards", async (HttpContext ctx, ICardService service, CreateCardRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request.Title))
                return Results.BadRequest("Title is required.");

            var userId = GetUserId(ctx);
            var card = await service.CreateCardAsync(userId, request);
            return Results.Created($"/api/cards/{card.Id}", card);
        })
        .WithName("CreateCard")
        .WithSummary("Create a new card");

        group.MapPut("/cards/{id}", async (HttpContext ctx, ICardService service, string id, UpdateCardRequest request) =>
        {
            var userId = GetUserId(ctx);
            var card = await service.UpdateCardAsync(userId, id, request);
            return card is null ? Results.NotFound() : Results.Ok(card);
        })
        .WithName("UpdateCard")
        .WithSummary("Update card fields");

        group.MapPatch("/cards/{id}/move", async (HttpContext ctx, ICardService service, string id, MoveCardRequest request) =>
        {
            var userId = GetUserId(ctx);
            var card = await service.MoveCardAsync(userId, id, request);
            return card is null ? Results.NotFound() : Results.Ok(card);
        })
        .WithName("MoveCard")
        .WithSummary("Move a card to a different column or position");

        group.MapDelete("/cards/{id}", async (HttpContext ctx, ICardService service, string id) =>
        {
            var userId = GetUserId(ctx);
            var deleted = await service.DeleteCardAsync(userId, id);
            return deleted ? Results.NoContent() : Results.NotFound();
        })
        .WithName("DeleteCard")
        .WithSummary("Delete a card");
    }

    /// <summary>
    /// Extracts the current user ID from the HttpContext items dict, where it was placed
    /// by the user resolution middleware. Falls back to "dev-user" if absent.
    /// </summary>
    /// <param name="ctx">The current HTTP context.</param>
    /// <returns>The resolved user ID string.</returns>
    private static string GetUserId(HttpContext ctx) =>
        ctx.Items["UserId"] as string ?? "dev-user";
}
