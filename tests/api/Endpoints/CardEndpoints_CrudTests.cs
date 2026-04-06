using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Kanban.Api.Models;
using Kanban.Api.Services;
using Kanban.Api.Tests.Helpers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace Kanban.Api.Tests.Endpoints;

public class CardEndpoints_CrudTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly Mock<ICardService> _service = new();

    public CardEndpoints_CrudTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                // Remove real Cosmos registrations, inject mocked service
                var descriptors = services
                    .Where(d => d.ServiceType == typeof(ICardService)
                             || d.ServiceType == typeof(ICardRepository)
                             || d.ServiceType == typeof(Microsoft.Azure.Cosmos.Container)
                             || d.ServiceType == typeof(Microsoft.Azure.Cosmos.CosmosClient))
                    .ToList();

                foreach (var d in descriptors) services.Remove(d);

                services.AddSingleton(_service.Object);
            });
        });
    }

    private HttpClient CreateClient(string userId = "user-1")
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-User-Id", userId);
        return client;
    }

    /// <summary>Verifies that GET /api/cards returns 200 with the list of cards for the user.</summary>
    [Fact]
    public async Task GetCards_Returns200WithCards()
    {
        var cards = new List<Card> { CardTestFactory.Create(), CardTestFactory.Create() };
        _service.Setup(s => s.GetCardsAsync("user-1", null)).ReturnsAsync(cards);

        var response = await CreateClient().GetAsync("/api/cards");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<List<Card>>();
        result.Should().HaveCount(2);
    }

    /// <summary>Verifies that GET /api/cards/{id} returns 200 when the card exists for the user.</summary>
    [Fact]
    public async Task GetCard_ExistingCard_Returns200()
    {
        var card = CardTestFactory.Create(id: "card-1");
        _service.Setup(s => s.GetCardAsync("user-1", "card-1")).ReturnsAsync(card);

        var response = await CreateClient().GetAsync("/api/cards/card-1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    /// <summary>Verifies that GET /api/cards/{id} returns 404 when the card does not exist.</summary>
    [Fact]
    public async Task GetCard_MissingCard_Returns404()
    {
        _service.Setup(s => s.GetCardAsync("user-1", "missing")).ReturnsAsync((Card?)null);

        var response = await CreateClient().GetAsync("/api/cards/missing");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    /// <summary>Verifies that POST /api/cards returns 201 Created with a Location header pointing to the new card.</summary>
    [Fact]
    public async Task PostCard_ValidRequest_Returns201WithLocation()
    {
        var created = CardTestFactory.Create(id: "new-card");
        _service.Setup(s => s.CreateCardAsync("user-1", It.IsAny<CreateCardRequest>()))
                .ReturnsAsync(created);

        var request = new CreateCardRequest("Title", "Desc", [], "medium", "Cat", [], "", "ideas");
        var response = await CreateClient().PostAsJsonAsync("/api/cards", request);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Headers.Location!.ToString().Should().Contain("new-card");
    }

    /// <summary>Verifies that POST /api/cards returns 400 when the request title is empty.</summary>
    [Fact]
    public async Task PostCard_MissingTitle_Returns400()
    {
        var request = new CreateCardRequest("", "Desc", [], "medium", "Cat", [], "", "ideas");
        var response = await CreateClient().PostAsJsonAsync("/api/cards", request);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    /// <summary>Verifies that PUT /api/cards/{id} returns 200 with the updated card when it exists.</summary>
    [Fact]
    public async Task PutCard_ExistingCard_Returns200()
    {
        var updated = CardTestFactory.Create(id: "card-1");
        _service.Setup(s => s.UpdateCardAsync("user-1", "card-1", It.IsAny<UpdateCardRequest>()))
                .ReturnsAsync(updated);

        var request = new UpdateCardRequest("New Title", null, null, null, null, null, null, null);
        var response = await CreateClient().PutAsJsonAsync("/api/cards/card-1", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    /// <summary>Verifies that PUT /api/cards/{id} returns 404 when the card does not exist.</summary>
    [Fact]
    public async Task PutCard_MissingCard_Returns404()
    {
        _service.Setup(s => s.UpdateCardAsync("user-1", "missing", It.IsAny<UpdateCardRequest>()))
                .ReturnsAsync((Card?)null);

        var request = new UpdateCardRequest("Title", null, null, null, null, null, null, null);
        var response = await CreateClient().PutAsJsonAsync("/api/cards/missing", request);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    /// <summary>Verifies that PATCH /api/cards/{id}/move returns 200 with the relocated card when it exists.</summary>
    [Fact]
    public async Task PatchMove_ExistingCard_Returns200()
    {
        var moved = CardTestFactory.Create(id: "card-1", columnId: "shipped");
        _service.Setup(s => s.MoveCardAsync("user-1", "card-1", It.IsAny<MoveCardRequest>()))
                .ReturnsAsync(moved);

        var request = new MoveCardRequest("shipped", 0);
        var response = await CreateClient().PatchAsJsonAsync("/api/cards/card-1/move", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    /// <summary>Verifies that DELETE /api/cards/{id} returns 204 No Content when the card is successfully deleted.</summary>
    [Fact]
    public async Task DeleteCard_ExistingCard_Returns204()
    {
        _service.Setup(s => s.DeleteCardAsync("user-1", "card-1")).ReturnsAsync(true);

        var response = await CreateClient().DeleteAsync("/api/cards/card-1");

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    /// <summary>Verifies that DELETE /api/cards/{id} returns 404 when the card does not exist.</summary>
    [Fact]
    public async Task DeleteCard_MissingCard_Returns404()
    {
        _service.Setup(s => s.DeleteCardAsync("user-1", "missing")).ReturnsAsync(false);

        var response = await CreateClient().DeleteAsync("/api/cards/missing");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    /// <summary>Verifies that GET /api/board returns 200 with a board response containing the expected columns.</summary>
    [Fact]
    public async Task GetBoard_Returns200WithBoardStructure()
    {
        var board = new BoardResponse();
        board.Columns["ideas"] = new ColumnResponse { Id = "ideas", Title = "Ideas", Cards = [] };
        _service.Setup(s => s.GetBoardAsync("user-1")).ReturnsAsync(board);

        var response = await CreateClient().GetAsync("/api/board");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<BoardResponse>();
        result!.Columns.Should().ContainKey("ideas");
    }
}
